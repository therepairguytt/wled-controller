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
wled_live_data: Dict[int, dict] = {}

def hex_to_rgb(hex_str: str) -> List[int]:
    h = hex_str.lstrip('#')
    return [int(h[i:i+2], 16) for i in (0, 2, 4)]

async def apply_preset_to_wled(controller, preset, segments=None, effect_only: bool = True, previous_preset=None):
    """
    Send a preset to a WLED controller via its WebSocket.

    effect_only=True  (default, used by playlist runner):
        Only sends effect/palette/color/brightness fields.
        WLED crossfades smoothly without reconfiguring the segment,
        which prevents the blink/flash between preset changes.

    effect_only=False (used for initial segment push / broadcast dispatch):
        Also sends segment geometry (start, stop, grp, spc, of, rev, mi).
        Use this only when the segment layout itself needs to change.
    """
    base_colors = [
        hex_to_rgb(preset.color1),
        hex_to_rgb(preset.color2),
        hex_to_rgb(preset.color3),
    ]

    if segments:
        seg_list = []
        for seg in segments:
            entry = {
                "id":  seg.segment_id,
                "col": base_colors,
                "bri": seg.seg_bri,
                "on":  True,
            }
            if not previous_preset or preset.effect_id != previous_preset.effect_id:
                entry["fx"] = preset.effect_id
            if not previous_preset or preset.effect_speed != previous_preset.effect_speed:
                entry["sx"] = preset.effect_speed
            if not previous_preset or preset.effect_intensity != previous_preset.effect_intensity:
                entry["ix"] = preset.effect_intensity
            if not previous_preset or preset.palette_id != previous_preset.palette_id:
                entry["pal"] = preset.palette_id
                
            new_rev = bool(seg.reverse_direction) != bool(preset.reverse_direction)
            if not previous_preset:
                entry["rev"] = new_rev
            else:
                old_rev = bool(seg.reverse_direction) != bool(previous_preset.reverse_direction)
                if new_rev != old_rev:
                    entry["rev"] = new_rev
            # Only include geometry when doing a full reconfigure
            if not effect_only:
                entry.update({
                    "start": seg.start_led,
                    "stop":  seg.stop_led,
                    "grp":   seg.grouping,
                    "spc":   seg.spacing,
                    "of":    seg.offset,
                    "mi":    seg.mirror_effect,
                })
            seg_list.append(entry)
    else:
        entry = {
            "col": base_colors,
        }
        if not previous_preset or preset.effect_id != previous_preset.effect_id:
            entry["fx"] = preset.effect_id
        if not previous_preset or preset.effect_speed != previous_preset.effect_speed:
            entry["sx"] = preset.effect_speed
        if not previous_preset or preset.effect_intensity != previous_preset.effect_intensity:
            entry["ix"] = preset.effect_intensity
        if not previous_preset or preset.palette_id != previous_preset.palette_id:
            entry["pal"] = preset.palette_id
        if not previous_preset or preset.reverse_direction != previous_preset.reverse_direction:
            entry["rev"] = preset.reverse_direction
        seg_list = [entry]

    payload = {
        "on":         preset.is_on,
        "bri":        controller.main_brightness,
        "transition": preset.transition,
        "seg":        seg_list,
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
