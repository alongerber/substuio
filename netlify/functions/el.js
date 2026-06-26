// Netlify Function: proxy -> ElevenLabs (eliminates CORS).
// The API key travels only to the user's own deployment (header x-el-key).
exports.handler = async (event) => {
  const base = {
    'x-proxy': '1',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: base, body: '' };

  try {
    const q = event.queryStringParameters || {};
    const p = q.p;                                  // EL path incl. its own query string
    if (!p) return { statusCode: 400, headers: base, body: JSON.stringify({ error: 'missing p' }) };

    const h = event.headers || {};
    const key = h['x-el-key'] || h['X-El-Key'] || '';
    const target = 'https://api.elevenlabs.io/v1' + p;
    const method = event.httpMethod;

    let body;
    if (method !== 'GET' && method !== 'HEAD' && event.body != null) {
      body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    }

    const headers = { 'xi-api-key': key };
    const ct = h['content-type'] || h['Content-Type'];
    if (ct) headers['content-type'] = ct;

    const r = await fetch(target, { method, headers, body });
    const rct = r.headers.get('content-type') || '';
    const out = Object.assign({}, base);
    if (rct) out['content-type'] = rct;

    // ElevenLabs with-timestamps returns JSON; other endpoints JSON too. Handle binary just in case.
    if (/application\/json|text\//i.test(rct)) {
      const t = await r.text();
      return { statusCode: r.status, headers: out, body: t };
    } else {
      const buf = Buffer.from(await r.arrayBuffer());
      return { statusCode: r.status, headers: out, body: buf.toString('base64'), isBase64Encoded: true };
    }
  } catch (e) {
    return { statusCode: 500, headers: base, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
