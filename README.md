# AskHerOut 💌

A single-page invitation to ask someone out.

- **Yes** → confetti + fireworks, then a calendar to pick the day and time
- **No** → runs away from the cursor. It dodges on proximity, hover, touch, focus and
  even a direct click, so it can never actually be pressed.
- The chosen date/time is written to a **plain text file**.

**Live:** https://offport.github.io/AskHerOut/

## Where the answer goes

| How you run it | What happens on "Lock it in" |
| --- | --- |
| `python server.py` (local) | Appended to `responses.txt` in this folder (plus `responses.json`) |
| GitHub Pages + Worker relay | Appended to `responses.txt` **in this repo** (see `worker/`) |
| GitHub Pages alone | Downloaded to her device as `date-details.txt` |

GitHub Pages serves static files only — there is no backend there to write into the
repo. To have the hosted page commit answers to `responses.txt`, deploy the small
Cloudflare Worker in [`worker/`](worker/README.md) and set `remoteEndpoint` in the
`CONFIG` block; the write token lives in the Worker, never in this public page. Without
it the hosted page just hands over the text file.

To collect answers locally instead:

```bash
python server.py          # http://localhost:8777
python server.py 9000     # custom port
```

Then `git add responses.txt && git commit` whenever you want to keep a record.

Sample output:

```
============================================
             SHE SAID YES
============================================
Answer      : YES
Date        : Saturday, August 22, 2026 at 7:00 PM
ISO         : 2026-08-22T19:00
Timezone    : Asia/Riyadh
Note        : dinner somewhere with good dessert
"No" dodges : 7
Submitted   : 2026-08-19T12:00:00Z
```

## Tweaks

Everything lives in `index.html`. Near the top of the `<script>` block:

```js
const CONFIG = {
  monthsAhead: 4,                  // how far ahead she can book
  saveEndpoint: '/save',           // local server
  remoteEndpoint: '',              // Cloudflare Worker URL, for the hosted page
  fileName: 'date-details.txt',
  sendTo: ''                       // add your email -> adds a "send it to him" link
                                   // on the final screen (mailto, pre-filled)
};
```

Other things worth editing:

- The question itself — the `<h1>` inside `<section id="s-ask">`
- `TAUNTS` — the lines that appear each time the No button escapes
- `TIMES` — the preset time slots on the calendar screen

No dependencies, no build step, no tracking. One HTML file.
