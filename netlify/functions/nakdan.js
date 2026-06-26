// Netlify Function: Niqqud (Hebrew vocalization) via Dicta Nakdan, server-side (no CORS).
exports.handler = async (event) => {
  const H = {
    'x-proxy': '1',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: H, body: '' };

  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (event.body || '{}');
    const { text, genre } = JSON.parse(raw || '{}');
    if (!text) return { statusCode: 400, headers: H, body: JSON.stringify({ error: 'no text' }) };

    const payload = {
      task: 'nakdan', data: text, genre: genre || 'modern',
      addmorph: true, matchpartial: true, keepmetagim: false,
      keepqq: false, nodageshdefault: false, patachma: false, addparshanim: false
    };

    const endpoints = [
      'https://nakdan-5-0.loadbalancer.dicta.org.il/api',
      'https://nakdan-2-0.loadbalancer.dicta.org.il/api',
      'https://nakdan.dicta.org.il/api'
    ];

    let data = null, lastErr = '';
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!r.ok) { lastErr = 'HTTP ' + r.status + ' @ ' + ep; continue; }
        data = await r.json();
        break;
      } catch (e) { lastErr = String((e && e.message) || e); }
    }
    if (!data) return { statusCode: 502, headers: H, body: JSON.stringify({ error: 'nakdan unreachable: ' + lastErr }) };

    const tokens = Array.isArray(data) ? data : (data.tokens || data.results || []);
    let out = '';
    for (const tok of tokens) {
      if (typeof tok === 'string') { out += tok; continue; }
      const isSep = tok.sep === true || tok.isSep === true;
      const opts = tok.options || tok.nakdanOptions || [];
      if (isSep || !opts || !opts.length) { out += (tok.word != null ? tok.word : (tok.w != null ? tok.w : '')); continue; }
      let w = opts[0].w != null ? opts[0].w : (opts[0].word != null ? opts[0].word : (opts[0].vocalized != null ? opts[0].vocalized : (tok.word || '')));
      w = String(w).replace(/\|/g, '').replace(/<[^>]+>/g, '');
      out += w;
    }
    if (!out) return { statusCode: 502, headers: H, body: JSON.stringify({ error: 'empty nakdan result' }) };
    return { statusCode: 200, headers: H, body: JSON.stringify({ vocalized: out }) };
  } catch (e) {
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
