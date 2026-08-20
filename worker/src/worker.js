/**
 * AskHerOut save relay.
 *
 * The page on GitHub Pages is static and cannot commit anything. It POSTs the
 * answer here instead; this Worker holds the GitHub token (as a secret, never in
 * the page) and appends the answer to responses.txt in the repo.
 *
 * Secrets / vars (see wrangler.toml + README):
 *   GITHUB_TOKEN   secret  fine-grained PAT, Contents: Read and write, this repo only
 *   REPO           var     "offport/AskHerOut"
 *   FILE           var     "responses.txt"
 *   ALLOWED_ORIGIN var     "https://offport.github.io"
 */

const MAX_BODY = 4096;          // an answer is a few hundred bytes; anything else is junk
const MAX_RETRIES = 4;          // GitHub returns 409 if the file moved under us

const json = (obj, status, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });

function corsHeaders(env, request) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : (origin === allowed ? origin : allowed),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

const b64encode = str => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const b64decode = str => {
  const bin = atob(str.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const clean = (v, max = 200) =>
  String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, max);

/** The exact block appended to responses.txt. */
function entry(p, meta) {
  return [
    '='.repeat(44),
    '             SHE SAID YES',
    '='.repeat(44),
    `Answer      : ${clean(p.answer) || 'YES'}`,
    `Date        : ${clean(p.pretty)}`,
    `ISO         : ${clean(p.date)}T${clean(p.time)}`,
    `Timezone    : ${clean(p.tz, 60)}`,
    `Note        : ${clean(p.note, 500) || '(none)'}`,
    `"No" dodges : ${parseInt(p.dodges_before_yes, 10) || 0}`,
    `Submitted   : ${clean(p.submitted_at, 40)}`,
    `Received    : ${meta.now}`,
    '',
    '',
  ].join('\n');
}

async function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'askherout-worker',
      ...(init.headers || {}),
    },
  });
}

/** Read → append → write, retrying when someone else commits in between. */
async function appendToFile(env, block) {
  const file = env.FILE || 'responses.txt';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const get = await gh(env, `contents/${encodeURIComponent(file)}`);

    let existing = '', sha;
    if (get.status === 200) {
      const meta = await get.json();
      existing = b64decode(meta.content || '');
      sha = meta.sha;
    } else if (get.status !== 404) {
      return { ok: false, status: get.status, detail: await get.text() };
    }

    const put = await gh(env, `contents/${encodeURIComponent(file)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'She picked a date',
        content: b64encode(existing + block),
        ...(sha ? { sha } : {}),
      }),
    });

    if (put.ok) return { ok: true };
    if (put.status !== 409 && put.status !== 422) {
      return { ok: false, status: put.status, detail: await put.text() };
    }
    // 409/422 = the file changed under us; re-read and try again
  }
  return { ok: false, status: 409, detail: 'too many conflicts' };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors);

    const url = new URL(request.url);
    if (url.pathname !== '/save' && url.pathname !== '/') {
      return json({ error: 'not found' }, 404, cors);
    }

    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY) return json({ error: 'bad payload' }, 400, cors);

    let payload;
    try { payload = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400, cors); }
    if (!payload || typeof payload !== 'object' || !payload.date || !payload.time) {
      return json({ error: 'missing date/time' }, 400, cors);
    }

    if (!env.GITHUB_TOKEN || !env.REPO) return json({ error: 'worker not configured' }, 500, cors);

    const result = await appendToFile(env, entry(payload, { now: new Date().toISOString() }));
    if (!result.ok) {
      console.log('github write failed', result.status, result.detail);
      return json({ error: 'could not save' }, 502, cors);
    }
    return json({ ok: true, file: env.FILE || 'responses.txt' }, 200, cors);
  },
};
