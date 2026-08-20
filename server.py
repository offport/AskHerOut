#!/usr/bin/env python3
"""
AskHerOut - tiny local server.

Serves index.html and accepts POST /save, appending each answer to responses.txt
(and a machine-readable copy to responses.json).

    python server.py            # http://localhost:8777
    python server.py 9000       # custom port
"""
import json
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TXT = ROOT / "responses.txt"
JSONL = ROOT / "responses.json"


def render(p: dict) -> str:
    return "\n".join([
        "=" * 44,
        "             SHE SAID YES",
        "=" * 44,
        f"Answer      : {p.get('answer', 'YES')}",
        f"Date        : {p.get('pretty', '')}",
        f"ISO         : {p.get('date', '')}T{p.get('time', '')}",
        f"Timezone    : {p.get('tz', '')}",
        f"Note        : {p.get('note') or '(none)'}",
        f'"No" dodges : {p.get("dodges_before_yes", 0)}',
        f"Submitted   : {p.get('submitted_at', '')}",
        f"Received    : {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        "",
    ])


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_POST(self):
        if self.path.rstrip("/") != "/save":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_error(400, "bad json")
            return

        with TXT.open("a", encoding="utf-8") as f:
            f.write(render(payload))
        with JSONL.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")

        print(f"  saved -> {TXT.name}: {payload.get('pretty', '?')}")
        body = json.dumps({"ok": True, "file": TXT.name}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet except for saves


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    print(f"AskHerOut running -> http://localhost:{port}")
    print(f"Answers append to  -> {TXT}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
