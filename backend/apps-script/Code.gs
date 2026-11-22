const DELIVERY_PREFIX = 'feedback:';
const DELIVERY_WINDOW = 7 * 86400;
const RETENTION = 14 * 86400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Run once from the project editor to grant MailApp access.
function authorizeMail() {
  MailApp.getRemainingDailyQuota();
}

function doPost(e) {
  let data;
  try {
    const now = Math.floor(Date.now() / 1000);
    const props = PropertiesService.getScriptProperties();
    data = authenticate_(e?.postData?.contents, props, now);
    if (!data) return receipt_('rejected');

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return receipt_('busy', data.id);
    try {
      return receipt_(deliver_(props, data, now), data.id);
    } finally {
      lock.releaseLock();
    }
  } catch {
    return receipt_('unavailable', data?.id);
  }
}

function authenticate_(raw, props, now) {
  if (!raw || raw.length > 32768) return null;
  const envelope = JSON.parse(raw);
  if (!Number.isInteger(envelope?.timestamp) || Math.abs(now - envelope.timestamp) > 300 ||
      typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string' ||
      !/^[0-9a-f]{64}$/.test(envelope.signature)) return null;
  const secret = props.getProperty('FEEDBACK_MAIL_SECRET');
  if (!/^[0-9a-f]{64}$/.test(secret || '')) return null;

  const signed = 'studypomodoro-feedback:v1\n' + envelope.timestamp + '\n' + envelope.payload;
  const bytes = Utilities.computeHmacSha256Signature(signed, secret, Utilities.Charset.UTF_8);
  const expected = Array.from(bytes, byte => (byte & 255).toString(16).padStart(2, '0')).join('');
  let mismatch = 0;
  for (let i = 0; i < 64; i++) {
    mismatch |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  const data = JSON.parse(envelope.payload);
  if (typeof data?.id !== 'string' || !UUID.test(data.id) ||
      !['bug', 'suggestion', 'general'].includes(data.category) ||
      typeof data.created_at !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data.created_at) ||
      typeof data.message !== 'string' || data.message.length < 10 || data.message.length > 3000 ||
      (data.email !== null && (typeof data.email !== 'string' || data.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) ||
      !Number.isInteger(data.started_at) || data.started_at > now + 300 ||
      now - data.started_at > DELIVERY_WINDOW) return null;
  return data;
}

function deliver_(props, data, now) {
  const key = DELIVERY_PREFIX + data.id;
  const previous = props.getProperty(key);
  if (previous) return previous.startsWith('sent:') ? 'sent' : 'review';
  if (props.getProperty('FEEDBACK_PAUSED') === 'true') return 'paused';
  const to = props.getProperty('FEEDBACK_RECIPIENT');
  if (!to || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return 'unavailable';
  if (MailApp.getRemainingDailyQuota() < 1) return 'quota';
  pruneDeliveries_(props, now);

  const lines = [
    'Category: ' + data.category,
    'Submitted (UTC): ' + data.created_at,
    'Submission ID: ' + data.id
  ];
  if (data.email) lines.push('Email: ' + data.email);
  const body = lines.join('\n') + '\n\n' + data.message;

  // MailApp provides no idempotency key. Persist the intent before calling it.
  props.setProperty(key, 'sending:' + now);
  try {
    MailApp.sendEmail(to, '[Study Pomodoro] New feedback: ' + data.category, body);
    props.setProperty(key, 'sent:' + now);
    return 'sent';
  } catch {
    // MailApp may already have accepted the email. Keep the intent for manual reconciliation.
    return 'review';
  }
}

function pruneDeliveries_(props, now) {
  const day = Math.floor(now / 86400);
  if (props.getProperty('FEEDBACK_PRUNED_DAY') === String(day)) return;
  const entries = props.getProperties();
  for (const key of Object.keys(entries)) {
    if (key.startsWith(DELIVERY_PREFIX) && Number(entries[key].split(':')[1]) < now - RETENTION) {
      props.deleteProperty(key);
    }
  }
  props.setProperty('FEEDBACK_PRUNED_DAY', String(day));
}

// Only run from the editor after verifying the inbox and stopping retries for this ID.
function resetReviewedDelivery() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty('FEEDBACK_RESET_ID');
    if (!id || !UUID.test(id)) throw new Error('Set FEEDBACK_RESET_ID to the reviewed submission ID.');
    const key = DELIVERY_PREFIX + id;
    const state = props.getProperty(key);
    if (state?.startsWith('sent:')) throw new Error('This submission is already recorded as sent.');
    if (state?.startsWith('sending:')) props.deleteProperty(key);
    props.deleteProperty('FEEDBACK_RESET_ID');
  } finally {
    lock.releaseLock();
  }
}

function receipt_(status, id) {
  return ContentService.createTextOutput(JSON.stringify({ status, id }))
    .setMimeType(ContentService.MimeType.JSON);
}
