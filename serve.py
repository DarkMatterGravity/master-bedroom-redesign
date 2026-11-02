"""Local-only static server for the bedroom model. No external dependencies."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import threading
import webbrowser

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8000)
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent
class RoomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # This viewer is edited in place; never reuse an older HTML/JS module.
        self.send_header('Cache-Control', 'no-store, max-age=0, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

handler = partial(RoomHandler, directory=str(root))
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError as exc:
    raise SystemExit(f'Cannot start on port {args.port}. Try: python serve.py --port 8001\n{exc}')
url = f'http://127.0.0.1:{args.port}'
print(f'Bedroom viewer: {url}\nKeep this window open. Press Ctrl+C to stop.', flush=True)
if not args.no_browser:
    threading.Timer(.7, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
