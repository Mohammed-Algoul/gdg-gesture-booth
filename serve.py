#!/usr/bin/env python3
"""Local server for the GDG Gesture Photo Booth.

Same as `python -m http.server 8000`, but forces correct MIME types for
.js/.mjs/.wasm (some Windows machines map .js to text/plain, which breaks
ES modules) and binds to localhost only.

Usage:  python serve.py [port]
"""
import http.server
import socketserver
import sys
import webbrowser
from functools import partial
from pathlib import Path

_args = [a for a in sys.argv[1:] if not a.startswith("-")]
PORT = int(_args[0]) if _args else 8000
ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".task": "application/octet-stream",
        ".svg": "image/svg+xml",
        ".css": "text/css",
        ".png": "image/png",
        ".json": "application/json",
    }


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    handler = partial(Handler, directory=str(ROOT))
    with Server(("127.0.0.1", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"GDG Gesture Photo Booth → {url}  (Ctrl+C to stop)")
        if "--no-browser" not in sys.argv:
            try:
                webbrowser.open(url)
            except Exception:
                pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
