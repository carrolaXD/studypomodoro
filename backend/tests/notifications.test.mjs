import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import worker from '../worker.mjs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = source('../migrations/0002_feedback_notifications.sql');
const mailUrl = 'https://script.google.com/macros/s/local-test/exec';
const receiptUrl = 'https://script.googleusercontent.com/macros/echo?test';
const origin = 'https://site.example';
const recipient = 'owner@example.test';
const submission = {
  id: 'bfb27dd2-b282-48a0-9e80-807c05000fda',
  category: 'bug', language: 'pt', website: '',
  message: 'Notificação de teste.\nTexto integral, incluindo acentos e emoji 🐞.',
  email: 'visitor@example.test'
};

function setup(t, { historical = false } = {}) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec(source('../migrations/0001_feedback.sql'));
  if (historical) {
    sql.prepare('INSERT INTO feedback (id, category, language, message) VALUES (?, ?, ?, ?)')
      .run(submission.id, submission.category, submission.language, submission.message);
  }
  sql.exec(migration);
  const env = {
    SITE_ORIGIN: origin,
    FEEDBACK_MAIL_URL: mailUrl,
    FEEDBACK_MAIL_SECRET: randomBytes(32).toString('hex'),
    SUBMISSIONS: { limit: async () => ({ success: true }) },
    DB: {
      prepare(statement) {
        return {
          bind(...args) {
            const query = sql.prepare(statement);
            const numbered = Object.fromEntries(args.map((value, i) => [String(i + 1), value]));
            const bindings = /\?\d/.test(statement) ? [numbered] : args;
            return { first: () => query.get(...bindings), run: () => query.run(...bindings) };
          }
        };
      }
    }
  };
  // Keep the test clock ahead of SQLite's real clock when it enqueues the first row.
  let now = Math.floor(Date.now() / 1000) + 2;
  t.mock.method(Date, 'now', () => now * 1000);
  const props = new Map([['FEEDBACK_MAIL_SECRET', env.FEEDBACK_MAIL_SECRET], ['FEEDBACK_RECIPIENT', recipient]]);
  const mail = [];
  const gateway = { posts: 0, quota: 100, failPost: false, failAck: false, throwFromMailApp: false };
  const doPost = runInNewContext(source('../apps-script/Code.gs') + '\ndoPost', {
    Date,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props.get(key) ?? null,
      getProperties: () => Object.fromEntries(props),
      setProperty: (key, value) => props.set(key, value),
      deleteProperty: key => props.delete(key)
    }) },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (data, key, charset) =>
        Array.from(createHmac('sha256', key).update(data, charset).digest(), byte => byte > 127 ? byte - 256 : byte)
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: value => ({ setMimeType: () => value })
    },
    MailApp: {
      getRemainingDailyQuota: () => gateway.quota,
      sendEmail(to, subject, body) {
        mail.push({ to, subject, body });
        if (gateway.throwFromMailApp) throw new Error('Local test: ambiguous provider result');
      }
    }
  });

  let acknowledgement;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === mailUrl) {
      gateway.posts++;
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'manual');
      if (gateway.failPost) throw new Error('Local test: temporarily unavailable');
      gateway.lastEnvelope = options.body;
      acknowledgement = doPost({ postData: { contents: options.body } });
      return new Response(null, { status: 302, headers: { Location: receiptUrl } });
    }
    assert.equal(url, receiptUrl);
    assert.equal(options.body, undefined);
    if (gateway.failAck) throw new Error('Local test: acknowledgement lost');
    return new Response(acknowledgement, { headers: { 'Content-Type': 'application/json' } });
  });
  return {
    env, props, mail, gateway, doPost,
    submit: (data = submission) => worker.fetch(new Request('https://worker.example/feedback', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }), env),
    tick: () => worker.scheduled({}, env),
    feedback: () => sql.prepare('SELECT * FROM feedback').all(),
    queue: () => sql.prepare('SELECT * FROM feedback_notifications').all(),
    advance: value => { now += value; }
  };
}

test('keeps the original receipt and delivers the correct notification only once', async t => {
  const f = setup(t);
  for (let i = 0; i < 2; i++) {
    const response = await f.submit();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, id: submission.id });
  }
  assert.equal((await f.submit({ ...submission, message: 'Different content for this ID' })).status, 409);
  assert.equal(f.feedback().length, 1);
  assert.equal(f.queue().length, 1);
  await Promise.all([f.tick(), f.tick()]);
  await f.submit();
  await f.tick();
  assert.equal(f.queue()[0].status, 'sent');
  assert.equal(f.queue()[0].attempts, 1);
  assert.equal(f.mail.length, 1);
  assert.deepEqual(f.mail[0], {
    to: recipient, subject: '[Study Pomodoro] New feedback: bug',
    body: `Category: bug\nSubmitted (UTC): ${f.feedback()[0].created_at}\nSubmission ID: ${submission.id}\nEmail: ${submission.email}\n\n${submission.message}`
  });
});

test('leaves historical rows out of the queue and waits for configuration on new rows', async t => {
  const historical = setup(t, { historical: true });
  assert.equal((await historical.submit({ ...submission, email: '' })).status, 200);
  assert.equal(historical.queue().length, 0);
  delete historical.env.FEEDBACK_MAIL_SECRET;
  await historical.submit({ ...submission, id: '35434a2a-42bf-49b0-be29-b18ce8e90c87' });
  await historical.tick();
  assert.equal(historical.queue()[0].attempts, 0);
  assert.equal(historical.gateway.posts, 0);
});

test('recovers a transient failure and a lost acknowledgement without duplicating the email', async t => {
  const f = setup(t);
  await f.submit({ ...submission, email: '' });
  f.gateway.failPost = true;
  await f.tick();
  assert.equal(f.feedback().length, 1);
  assert.equal(f.queue()[0].status, 'pending');
  await f.tick();
  assert.equal(f.gateway.posts, 1);
  f.advance(300);
  f.gateway.failPost = false;
  f.gateway.failAck = true;
  await f.tick();
  assert.equal(f.queue()[0].status, 'pending');
  assert.equal(f.mail.length, 1);
  assert.ok(!f.mail[0].body.includes('\nEmail:'));
  f.advance(600);
  f.gateway.failAck = false;
  await f.tick();
  assert.equal(f.queue()[0].status, 'sent');
  assert.equal(f.queue()[0].attempts, 3);
  assert.equal(f.mail.length, 1);
});

test('retries quota exhaustion and pause, but stops at an ambiguous MailApp outcome', async t => {
  const f = setup(t);
  await f.submit();
  f.gateway.quota = 0;
  await f.tick();
  assert.equal(f.queue()[0].last_error, 'quota');
  assert.equal(f.queue()[0].next_attempt_at, Date.now() / 1000 + 86400);
  f.advance(86400);
  f.gateway.quota = 100;
  f.props.set('FEEDBACK_PAUSED', 'true');
  await f.tick();
  assert.equal(f.queue()[0].last_error, 'paused');
  assert.equal(f.mail.length, 0);
  f.advance(600);
  f.props.delete('FEEDBACK_PAUSED');
  f.gateway.throwFromMailApp = true;
  await f.tick();
  assert.equal(f.queue()[0].status, 'review');
  f.advance(3600);
  await f.tick();
  assert.equal(f.mail.length, 1);
  assert.equal(f.feedback().length, 1);
});

test('exhausts bounded retries and rejects tampered, stale or unsigned payloads', async t => {
  const f = setup(t);
  await f.submit();
  f.gateway.failPost = true;
  for (let i = 0; i < 8; i++) {
    await f.tick();
    f.advance(f.queue()[0].next_attempt_at - Date.now() / 1000);
  }
  assert.equal(f.queue()[0].status, 'failed');
  await f.tick();
  assert.equal(f.gateway.posts, 8);
  assert.equal(f.feedback().length, 1);

  const { id, created_at, category, message, email } = f.feedback()[0];
  const timestamp = Date.now() / 1000;
  const payload = JSON.stringify({ id, created_at, category, message, email, started_at: timestamp });
  const sign = time => createHmac('sha256', f.env.FEEDBACK_MAIL_SECRET)
    .update(`studypomodoro-feedback:v1\n${time}\n${payload}`).digest('hex');
  for (const envelope of [
    { timestamp, payload, signature: '' },
    { timestamp, payload: payload.replace('bug', 'general'), signature: sign(timestamp) },
    { timestamp: timestamp - 301, payload, signature: sign(timestamp - 301) }
  ]) {
    assert.deepEqual(JSON.parse(f.doPost({ postData: { contents: JSON.stringify(envelope) } })), { status: 'rejected' });
  }
  assert.equal(f.mail.length, 0);
});
