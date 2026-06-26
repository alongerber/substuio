// Serverless proxy → ElevenLabs. Eliminates CORS. The API key travels only to
// the user's own deployment (sent as x-el-key), never to a third party.
module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  res.setHeader('x-proxy', '1');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const u = new URL(req.url, 'http://x');
    const p = u.searchParams.get('p');           // EL path incl. its own query string
    if (!p) { res.status(400).json({ error: 'missing p' }); return; }

    const key = req.headers['x-el-key'] || '';
    const target = 'https://api.elevenlabs.io/v1' + p;

    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks);
    }

    const headers = { 'xi-api-key': key };
    const ct = req.headers['content-type'];
    if (ct) headers['content-type'] = ct;

    const r = await fetch(target, { method: req.method, headers, body });
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(r.status);
    const rct = r.headers.get('content-type');
    if (rct) res.setHeader('content-type', rct);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
