// donkeytalk.sankhacooray.com. Files in public/ are served directly (headers in
// public/_headers). This Worker adds the enquiry API backed by D1.
//
//   POST /api/enquire      { name, email, org?, role?, space?, message?, website? }  → { ok, id }
//   GET  /api/enquiries    Authorization: Bearer <ENQUIRY_KEY>  → { enquiries: [...] }   (?status=new, ?limit=)
//   POST /api/enquiries/:id/status  Bearer  { status }         → { ok }
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STATUSES = new Set(['new', 'contacted', 'qualified', 'closed', 'spam']);
const ROLES = new Set(['librarian', 'educator', 'facilities', 'student', 'other']);

async function enquire(request, env) {
  if (!/application\/json/.test(request.headers.get('content-type') || '')) return json({ error: 'send JSON' }, 415);
  let b; try { b = await request.json(); } catch { return json({ error: 'bad JSON' }, 400); }
  if (clean(b.website, 10)) return json({ ok: true, id: 0 }); // honeypot: pretend success
  const name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase();
  if (name.length < 2) return json({ error: 'Please tell me your name.' }, 422);
  if (!EMAIL.test(email)) return json({ error: 'That email address does not look right.' }, 422);
  const role = clean(b.role, 20).toLowerCase();
  const row = {
    name, email, org: clean(b.org, 160) || null, role: ROLES.has(role) ? role : null, space: clean(b.space, 160) || null,
    message: clean(b.message, 2000) || null,
    ip: request.headers.get('cf-connecting-ip') || null, country: request.cf?.country || null, ua: clean(request.headers.get('user-agent'), 240) || null,
  };
  // one enquiry per address per minute
  const recent = await env.DB.prepare("SELECT count(*) AS n FROM enquiries WHERE (email = ?1 OR ip = ?2) AND at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 seconds')").bind(row.email, row.ip).first('n');
  if (recent > 0) return json({ error: 'Thanks, I already have your message. I will be in touch.' }, 429);
  const r = await env.DB.prepare('INSERT INTO enquiries (name,email,org,role,space,message,ip,country,ua) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)')
    .bind(row.name, row.email, row.org, row.role, row.space, row.message, row.ip, row.country, row.ua).run();
  return json({ ok: true, id: r.meta.last_row_id });
}

function authed(request, env) {
  const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return !!env.ENQUIRY_KEY && key.length > 0 && key === env.ENQUIRY_KEY;
}
async function listEnquiries(request, env, url) {
  if (!authed(request, env)) return json({ error: 'unauthorised' }, 401);
  const status = url.searchParams.get('status');
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 100));
  const q = status && STATUSES.has(status)
    ? env.DB.prepare('SELECT * FROM enquiries WHERE status = ?1 ORDER BY at DESC LIMIT ?2').bind(status, limit)
    : env.DB.prepare('SELECT * FROM enquiries ORDER BY at DESC LIMIT ?1').bind(limit);
  const { results } = await q.all();
  return json({ enquiries: results });
}
async function setStatus(request, env, id) {
  if (!authed(request, env)) return json({ error: 'unauthorised' }, 401);
  const { status } = await request.json().catch(() => ({}));
  if (!STATUSES.has(status)) return json({ error: `status must be one of ${[...STATUSES].join(', ')}` }, 422);
  const r = await env.DB.prepare('UPDATE enquiries SET status = ?1 WHERE id = ?2').bind(status, Number(id)).run();
  return json({ ok: r.meta.changes === 1 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let res;
    try {
      if (url.pathname === '/api/enquire' && request.method === 'POST') res = await enquire(request, env);
      else if (url.pathname === '/api/enquiries' && request.method === 'GET') res = await listEnquiries(request, env, url);
      else if (/^\/api\/enquiries\/\d+\/status$/.test(url.pathname) && request.method === 'POST') res = await setStatus(request, env, url.pathname.split('/')[3]);
      else if (url.pathname.startsWith('/api/')) res = json({ error: 'not found' }, 404);
      else res = await env.ASSETS.fetch(request);
    } catch (e) { res = json({ error: e.message }, 500); }
    const headers = new Headers(res.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
