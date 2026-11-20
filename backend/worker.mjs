const byteLimit = 16 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readBody(request) {
  if (!request.body || Number(request.headers.get('Content-Length')) > byteLimit) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > byteLimit) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const reply = (status, body) => Response.json(body, { status, headers });
    if (new URL(request.url).pathname !== '/feedback') return reply(404, { error: 'route' });
    if (origin !== env.SITE_ORIGIN) return reply(403, { error: 'origin' });

    headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'POST';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Max-Age'] = '3600';
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') return reply(405, { error: 'method' });
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
      return reply(415, { error: 'content_type' });
    }
    try {
      const { success } = await env.SUBMISSIONS.limit({
        key: request.headers.get('CF-Connecting-IP') || 'unknown'
      });
      if (!success) {
        headers['Retry-After'] = '60';
        return reply(429, { error: 'rate' });
      }
      const input = await readBody(request);
      if (!input || typeof input.id !== 'string' || !uuid.test(input.id) ||
          !['bug', 'suggestion', 'general'].includes(input.category) ||
          !['pt', 'en'].includes(input.language) || input.website !== '' ||
          typeof input.message !== 'string' || typeof input.email !== 'string') {
        return reply(422, { error: 'fields' });
      }
      const message = input.message.trim();
      const email = input.email.trim();
      if (message.length < 10 || message.length > 3000 || email.length > 254 ||
          (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return reply(422, { error: 'fields' });
      }
      // An identical retry can recover its receipt after a lost HTTP response.
      const params = [input.id, input.category, input.language, message, email || null];
      const saved = await env.DB.prepare(`
        INSERT INTO feedback (id, category, language, message, email)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET id = excluded.id
        WHERE feedback.category = excluded.category AND feedback.language = excluded.language
          AND feedback.message = excluded.message AND feedback.email IS excluded.email
        RETURNING id
      `).bind(...params).first();
      if (!saved) return reply(409, { error: 'id_conflict' });
      return reply(200, { received: true, id: saved.id });
    } catch {
      return reply(503, { error: 'unavailable' });
    }
  }
};
