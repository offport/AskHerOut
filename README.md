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
| GitHub Pages (static) | Downloaded to her device as `date-details.txt` |

GitHub Pages serves static files only — there is no backend there to write into the
repo, so the hosted version hands over the text file instead. To collect answers into
`responses.txt` in the repo, run it locally:

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
  saveEndpoint: '/save',
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
