// Big Top Bonzo leaderboard: a Neon Function in front of the `scores` table.
//   GET  /scores?limit=10        -> { top: [{ id, name, score, stage, created_at }] }
//   POST /scores {name,score,stage} -> { id, rank, top }
// No dependencies: queries go over Neon's HTTPS SQL endpoint using the injected DATABASE_URL.

const CORS = {
  'Access-Control-Allow-Origin': '*', // the website, the installed app and the Android app all call this
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

async function sql(query, params = []) {
  const url = process.env.DATABASE_URL;
  const host = new URL(url).hostname;
  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': url, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'false' },
    body: JSON.stringify({ query, params })
  });
  if (!res.ok) throw new Error(`sql ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).rows;
}

const top = async n => (await sql(
  'SELECT id, name, score, stage, created_at FROM scores ORDER BY score DESC, id ASC LIMIT $1', [n]
)).map(r => ({ id: String(r.id), name: r.name, score: Number(r.score), stage: Number(r.stage), created_at: r.created_at }));

// at most 6 submissions per minute from one address (per running instance)
const hits = new Map();
function limited(ip) {
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 6;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/scores')) {
        const n = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 10));
        return json({ top: await top(n) });
      }
      if (request.method === 'POST' && url.pathname === '/scores') {
        const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
        if (limited(ip)) return json({ error: 'Too many scores at once. Try again in a minute.' }, 429);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'That request could not be read.' }, 400); }
        const name = String(body.name ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
        const score = Number(body.score), stage = Number(body.stage);
        if (!name) return json({ error: 'Enter a name using letters or numbers.' }, 400);
        // a stage is worth well under 25,000 points, so anything above that is not a real score
        if (!Number.isInteger(score) || !Number.isInteger(stage) || score < 1 || stage < 1 || stage > 500 || score > stage * 25000)
          return json({ error: 'That score could not be accepted.' }, 400);
        const [row] = await sql('INSERT INTO scores (name, score, stage) VALUES ($1, $2, $3) RETURNING id', [name, score, stage]);
        // ties go to whoever scored first, matching the order of the list
        const [rank] = await sql('SELECT count(*) + 1 AS rank FROM scores WHERE score > $1 OR (score = $1 AND id < $2)', [score, row.id]);
        return json({ id: String(row.id), rank: Number(rank.rank), top: await top(10) }, 201);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'The leaderboard is unavailable right now.' }, 500);
    }
  }
};
