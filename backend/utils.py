import websockets
import json
from fastapi import WebSocket
from typing import List, Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Failed to send to websocket: {e}")
                continue

manager = ConnectionManager()
active_broadcast_state: Dict[int, dict] = {}

def hex_to_rgb(hex_str: str) -> List[int]:
    h = hex_str.lstrip('#')
    return [int(h[i:i+2], 16) for i in (0, 2, 4)]

async def apply_preset_to_wled(controller, preset):
    payload = {
        "on": preset.is_on,
        "bri": controller.main_brightness,
        "seg": [{
            "col": [hex_to_rgb(preset.color1), hex_to_rgb(preset.color2), hex_to_rgb(preset.color3)],
            "fx": preset.effect_id, "sx": preset.effect_speed, "ix": preset.effect_intensity,
            "pal": preset.palette_id
        }]
    }
    try:
        async with websockets.connect(f"ws://{controller.ip_address}/ws") as ws:
            await ws.send(json.dumps(payload))
    except Exception as e:
        print(f"Failed to update {controller.name}: {e}")
