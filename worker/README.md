# Save relay (Cloudflare Worker)

GitHub Pages is static, so the page cannot commit anything by itself. This Worker sits
between the page and the GitHub API: the page POSTs the answer here, the Worker holds
the write token as a secret, and appends the answer to `responses.txt` in the repo.

The token never appears in the page or in this repo - which matters, because the repo
is public.

## Setup (about 5 minutes, one time)

**1. Create the GitHub token**

<https://github.com/settings/personal-access-tokens/new>

| Field | Value |
| --- | --- |
| Token name | `askherout-worker` |
| Expiration | whatever suits you (90 days is fine) |
| Repository access | **Only select repositories** -> `AskHerOut` |
| Permissions -> Repository -> **Contents** | **Read and write** |

Generate it and copy the `github_pat_...` string. It is shown once. Treat it like a
password: it never goes in this repo, in the page, or in a chat window.

**2a. Deploy from the Cloudflare dashboard (no tooling required)**

1. <https://dash.cloudflare.com> -> Workers & Pages -> **Create** -> **Start from Hello World**
2. Name it `askherout-save`, click **Deploy**, then **Edit code**
3. Replace everything in the editor with the contents of `src/worker.js`, **Deploy** again
4. Worker -> **Settings** -> **Variables and Secrets** -> add a secret:
   name `GITHUB_TOKEN`, value the token from step 1 -> **Deploy**

`REPO`, `FILE` and `ALLOWED_ORIGIN` have defaults baked into the script, so the token
is the only thing you must set. Override them as plaintext variables if any of them
change.

**2b. Or deploy from the command line** (needs Node.js installed)

```bash
cd worker
npx wrangler login                    # opens a browser, one-time Cloudflare login
npx wrangler secret put GITHUB_TOKEN  # paste the token when prompted
npx wrangler deploy
```

Either way you end up with a URL like `https://askherout-save.<subdomain>.workers.dev`.

**3. Point the page at it**

In `../index.html`, set `remoteEndpoint` in the `CONFIG` block:

```js
remoteEndpoint: 'https://askherout-save.<your-subdomain>.workers.dev/save',
```

Commit and push. Pages redeploys in a minute or two.

**4. Check it**

```bash
curl -X POST https://askherout-save.<your-subdomain>.workers.dev/save   -H 'Content-Type: application/json'   -d '{"answer":"YES","date":"2026-09-01","time":"19:00","pretty":"Tuesday, September 1, 2026 at 7:00 PM","tz":"Asia/Riyadh","note":"test","dodges_before_yes":3,"submitted_at":"2026-08-20T10:00:00Z"}'
```

Expect `{"ok":true,"file":"responses.txt"}`, then a new commit titled "She picked a date"
on the repo. Delete that test entry afterwards.

## Behaviour

- `POST /save` only; everything else gets 405/404.
- CORS is limited to `ALLOWED_ORIGIN` (`wrangler.toml`), so only your page can call it
  from a browser.
- Bodies over 4 KB, malformed JSON, and payloads without a date/time are rejected.
- Every field is stripped of newlines and length-capped before being written, so nothing
  can inject fake entries into the file.
- Read-append-write retries on 409, so two answers submitted at once cannot clobber
  each other.

Note that the endpoint is public by nature - someone who finds the URL could append junk
entries. They cannot read the token, touch other repos, or write to any file other than
`responses.txt`. If it ever gets abused, `npx wrangler delete` removes it instantly.

## If the page cannot reach the Worker

The page falls back to handing the visitor the `.txt` file directly, so an answer is
never lost.
