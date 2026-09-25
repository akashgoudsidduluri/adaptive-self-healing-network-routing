"""Dependency-free HTTP server for the NetAdapt interactive network laboratory.

Run with::

    python lab_server.py --port 8765

The browser sends topology and simulation actions to :class:`LabSession`;
there is no frontend-only simulation state.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from lab_session import LabError, LabSession


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "lab_frontend"
SESSION = LabSession()


class LabHandler(BaseHTTPRequestHandler):
    server_version = "NetAdaptLab/1.0"

    def _json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise LabError(f"Invalid JSON: {exc}") from exc

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        path = urlparse(self.path).path
        if path == "/api/state":
            self._json(SESSION.state())
            return
        if path == "/api/presets":
            from lab_session import PRESETS
            self._json({"presets": [{"key": key, "name": value["name"]} for key, value in PRESETS.items()]})
            return
        relative = "index.html" if path in {"/", ""} else path.lstrip("/")
        target = (FRONTEND / relative).resolve()
        if FRONTEND not in target.parents and target != FRONTEND:
            self._json({"error": "Forbidden"}, 403)
            return
        if not target.is_file():
            self._json({"error": "Not found"}, 404)
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        if urlparse(self.path).path != "/api/action":
            self._json({"error": "Not found"}, 404)
            return
        try:
            payload = self._read_json()
            action = str(payload.get("action", ""))
            if action == "new":
                result = SESSION.new_network()
            elif action == "load_preset":
                result = SESSION.load_preset(str(payload["preset"]))
            elif action == "import":
                result = SESSION.import_document(payload["document"])
            elif action == "export":
                result = {"document": SESSION.export_document()}
            elif action == "add_device":
                result = SESSION.add_device(payload["type"], payload.get("x", 200), payload.get("y", 200), payload.get("name"))
            elif action == "move_device":
                result = SESSION.move_device(payload["id"], payload["x"], payload["y"])
            elif action == "rename_device":
                result = SESSION.rename_device(payload["id"], payload["name"])
            elif action == "delete_device":
                result = SESSION.delete_device(payload["id"])
            elif action == "duplicate_device":
                result = SESSION.duplicate_device(payload["id"])
            elif action == "add_link":
                result = SESSION.add_link(payload["source"], payload["target"], payload.get("latency", 5), payload.get("bandwidth", 100))
            elif action == "delete_link":
                result = SESSION.delete_link(payload["source"], payload["target"])
            elif action == "configure_link":
                result = SESSION.configure_link(payload["source"], payload["target"], payload.get("values", {}))
            elif action == "configure_interface":
                result = SESSION.configure_interface(payload["id"], payload["interface_id"], payload.get("values", {}))
            elif action == "shutdown_device":
                result = SESSION.shutdown_device(payload["id"])
            elif action == "restart_device":
                result = SESSION.restart_device(payload["id"])
            elif action == "start_traffic":
                result = SESSION.start_traffic(payload["source"], payload["destination"], int(payload.get("packet_count", 10)), float(payload.get("pps", 5)), str(payload.get("traffic_type", "Video")), int(payload.get("packet_size", 1500)))
            elif action == "step":
                result = SESSION.step()
            elif action == "running":
                result = SESSION.set_running(bool(payload.get("value", False)))
            elif action == "reset":
                result = SESSION.reset_simulation()
            elif action == "speed":
                result = SESSION.set_speed(float(payload.get("value", 1)))
            elif action == "scheduler":
                result = SESSION.set_scheduler(str(payload["scheduler"]))
            elif action == "qos_config":
                result = SESSION.set_qos_config(
                    payload.get("priorities"), payload.get("weights")
                )
            elif action == "routing_algorithm":
                result = SESSION.set_routing_algorithm(str(payload["algorithm"]))
            elif action == "routing_weights":
                result = SESSION.set_routing_weights(payload.get("weights", {}))
            elif action == "undo":
                result = SESSION.undo()
            elif action == "redo":
                result = SESSION.redo()
            elif action == "ping":
                result = SESSION.run_ping(
                    str(payload["source"]),
                    str(payload["destination"]),
                    int(payload.get("count", 4)),
                )
            elif action == "traceroute":
                result = SESSION.run_traceroute(
                    str(payload["source"]), str(payload["destination"])
                )
            elif action == "transport_create":
                result = SESSION.create_transport(
                    str(payload.get("protocol", "TCP")).upper(),
                    str(payload["source"]),
                    str(payload["destination"]),
                    int(payload.get("source_port", 5000)),
                    int(payload.get("destination_port", 8080)),
                    int(payload.get("payload_size", 1000)),
                    int(payload.get("initial_cwnd", 1)),
                    int(payload.get("receiver_window", 8)),
                    float(payload.get("ssthresh", 16)),
                    float(payload.get("timeout", 0.1)),
                    str(payload.get("traffic_class", "HTTP")),
                )
            elif action == "transport_send":
                result = SESSION.send_transport_data(
                    str(payload.get("protocol", "TCP")).upper(),
                    str(payload["flow_id"]),
                    int(payload.get("packet_count", 1)),
                    int(payload.get("payload_size", 1000)),
                )
            elif action == "transport_close":
                result = SESSION.close_transport(str(payload["flow_id"]))
            elif action == "transport_tick":
                result = SESSION.process_transport_tick(float(payload.get("delta", 0.1)))
            elif action == "transport_reset":
                result = SESSION.reset_transport()
            elif action == "transport_compare":
                result = SESSION.compare_transport(
                    str(payload["source"]),
                    str(payload["destination"]),
                    int(payload.get("packet_count", 6)),
                    int(payload.get("payload_size", 1000)),
                )
            elif action == "arp_table":
                result = SESSION.inspect_arp(str(payload["id"]))
            elif action == "clear_arp":
                result = SESSION.clear_arp(str(payload["id"]))
            elif action == "mac_table":
                result = SESSION.inspect_mac(str(payload["id"]))
            elif action == "clear_mac":
                result = SESSION.clear_mac(str(payload["id"]))
            elif action == "console":
                result = SESSION.console(str(payload["id"]), str(payload["command"]))
            else:
                raise LabError(f"Unknown action: {action}")
            self._json({"ok": True, "state": result})
        except (KeyError, TypeError, ValueError, LabError) as exc:
            self._json({"ok": False, "error": str(exc)}, 400)

    def log_message(self, format: str, *args: Any) -> None:
        # Keep the lab terminal quiet; the UI timeline is the event surface.
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="NetAdapt interactive network lab")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), LabHandler)
    print(f"NetAdapt network lab running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
