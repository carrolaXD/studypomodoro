const maxAttempts = 8;
const maxAge = 7 * 86400;
const leaseSeconds = 300;
const batchSize = 3;
const encoder = new TextEncoder();
const seconds = () => Math.floor(Date.now() / 1000);

async function claim(db) {
  const now = seconds();
  const token = crypto.randomUUID();
  const item = await db.prepare(`
    UPDATE feedback_notifications
    SET claim_token = ?1, next_attempt_at = ?2, attempts = attempts + 1,
        first_attempt_at = coalesce(first_attempt_at, ?3)
    WHERE id = (
      SELECT id FROM feedback_notifications
      WHERE status = 'pending' AND next_attempt_at <= ?3 AND attempts < ?4
        AND (first_attempt_at IS NULL OR first_attempt_at > ?5)
      ORDER BY next_attempt_at, id LIMIT 1
    )
    RETURNING id, attempts, first_attempt_at
  `).bind(token, now + leaseSeconds, now, maxAttempts, now - maxAge).first();
  return item && { ...item, token };
}

async function send(url, key, data) {
  const timestamp = seconds();
  const payload = JSON.stringify(data);
  const bytes = encoder.encode(`studypomodoro-feedback:v1\n${timestamp}\n${payload}`);
  const hash = await crypto.subtle.sign('HMAC', key, bytes);
  const signature = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const signal = AbortSignal.timeout(25000);
  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp, payload, signature }),
      redirect: 'manual',
      signal
    });
    if (response.status === 302 || response.status === 303) {
      const location = response.headers.get('Location');
      if (!location?.startsWith('https://script.googleusercontent.com/')) return 'invalid_response';
      // Apps Script redirects its acknowledgement to a one-time URL. Fetch it without the POST body.
      response = await fetch(location, { redirect: 'error', signal });
    }
    if (!response.ok) return 'http';
    const result = await response.json();
    if (result?.id !== data.id || !['sent', 'review', 'busy', 'quota', 'paused', 'unavailable'].includes(result.status)) {
      return 'invalid_response';
    }
    return result.status;
  } catch {
    return 'transport';
  }
}

async function finish(db, item, result) {
  const now = seconds();
  const sent = result === 'sent';
  const status = sent || result === 'review' ? result : item.attempts >= maxAttempts ? 'failed' : 'pending';
  const retryDelay = result === 'quota' ? 86400 : 300 * 2 ** (item.attempts - 1);
  await db.prepare(`
    UPDATE feedback_notifications
    SET status = ?, claim_token = NULL, sent_at = ?, last_error = ?, next_attempt_at = ?
    WHERE id = ? AND claim_token = ?
  `).bind(status, sent ? now : null, sent ? null : result, now + retryDelay, item.id, item.token).run();
}

export async function processNotifications(env) {
  const url = env.FEEDBACK_MAIL_URL;
  const secret = env.FEEDBACK_MAIL_SECRET;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url ?? '') ||
      !/^[0-9a-f]{64}$/.test(secret ?? '')) return;

  const db = env.DB;
  const now = seconds();
  await db.prepare(`
    UPDATE feedback_notifications
    SET status = 'failed', claim_token = NULL, last_error = coalesce(last_error, 'retry_limit')
    WHERE status = 'pending' AND next_attempt_at <= ?1
      AND (attempts >= ?2 OR first_attempt_at <= ?3)
  `).bind(now, maxAttempts, now - maxAge).run();

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (let index = 0; index < batchSize; index++) {
    const item = await claim(db);
    if (!item) return;
    const feedback = await db.prepare(`
      SELECT id, created_at, category, message, email FROM feedback WHERE id = ?
    `).bind(item.id).first();
    if (!feedback) continue;
    const result = await send(url, key, { ...feedback, started_at: item.first_attempt_at });
    await finish(db, item, result);
    if (result !== 'sent' && result !== 'review') return;
  }
}
