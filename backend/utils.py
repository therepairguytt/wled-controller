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

async def apply_preset_to_wled(controller, preset, segments=None):
    """
    Send a preset to a WLED controller via its WebSocket.
    If `segments` (list of ControllerSegment) is provided, each segment gets
    its own entry in the `seg` array with the preset effect/palette and its
    own start/stop/brightness/grouping/spacing/reverse/mirror settings.
    Falls back to a single global segment when no segments are configured.
    """
    base_colors = [
        hex_to_rgb(preset.color1),
        hex_to_rgb(preset.color2),
        hex_to_rgb(preset.color3),
    ]

    if segments:
        seg_list = []
        for seg in segments:
            seg_list.append({
                "id":  seg.segment_id,
                "start": seg.start_led,
                "stop":  seg.stop_led,
                "grp":   seg.grouping,
                "spc":   seg.spacing,
                "of":    seg.offset,
                "rev":   seg.reverse_direction,
                "mi":    seg.mirror_effect,
                "bri":   seg.seg_bri,
                "col":   base_colors,
                "fx":    preset.effect_id,
                "sx":    preset.effect_speed,
                "ix":    preset.effect_intensity,
                "pal":   preset.palette_id,
                "on":    True,
            })
    else:
        seg_list = [{
            "col": base_colors,
            "fx":  preset.effect_id,
            "sx":  preset.effect_speed,
            "ix":  preset.effect_intensity,
            "pal": preset.palette_id,
        }]

    payload = {
        "on":  preset.is_on,
        "bri": controller.main_brightness,
        "transition": preset.transition,
        "seg": seg_list,
    }

    try:
        async with websockets.connect(
            f"ws://{controller.ip_address}/ws",
            open_timeout=5,
            close_timeout=3,
        ) as ws:
            await ws.send(json.dumps(payload))
            return True
    except Exception as e:
        print(f"[Broadcast] Failed to update '{controller.name}' ({controller.ip_address}): {e}")
        return False
