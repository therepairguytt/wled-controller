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
        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)


manager = ConnectionManager()
active_broadcast_state: Dict[int, dict] = {}
wled_live_data: Dict[int, dict] = {}


def hex_to_rgb(hex_str: str) -> List[int]:
    h = (hex_str or "#000000").lstrip('#')
    if len(h) != 6:
        return [0, 0, 0]
    try:
        return [int(h[i:i+2], 16) for i in (0, 2, 4)]
    except ValueError:
        return [0, 0, 0]


async def apply_preset_to_wled(controller, preset, segments=None, effect_only: bool = True, previous_preset=None):
    """
    Send a preset to a WLED v0.16.1 controller via its WebSocket.

    effect_only=True  (default, used by playlist runner):
        Only sends effect/palette/color/brightness/custom slider fields that changed.
        WLED crossfades smoothly without reconfiguring segment geometry,
        which prevents the blink/flash between preset changes.

    effect_only=False (used for initial segment push / broadcast dispatch / quick actions):
        Also sends segment geometry (start, stop, grp, spc, of, rev, mi, frz, cct, bm).
        Use this when the segment layout or full state needs to be applied.
    """
    base_colors = [
        hex_to_rgb(preset.color1),
        hex_to_rgb(preset.color2),
        hex_to_rgb(preset.color3),
    ]

    p_c1 = getattr(preset, "custom1", 128)
    p_c2 = getattr(preset, "custom2", 128)
    p_c3 = getattr(preset, "custom3", 16)
    p_cct = getattr(preset, "cct", 127)
    p_frz = bool(getattr(preset, "freeze", False))
    p_bm = getattr(preset, "blend_mode", 0)

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
            if not previous_preset or p_c1 != getattr(previous_preset, "custom1", 128):
                entry["c1"] = p_c1
            if not previous_preset or p_c2 != getattr(previous_preset, "custom2", 128):
                entry["c2"] = p_c2
            if not previous_preset or p_c3 != getattr(previous_preset, "custom3", 16):
                entry["c3"] = p_c3

            # Effective freeze & CCT & blend mode (preset overrides or combines with segment)
            seg_frz = bool(getattr(seg, "freeze", False)) or p_frz
            seg_cct = p_cct if p_cct != 127 else getattr(seg, "cct", 127)
            seg_bm = p_bm if p_bm != 0 else getattr(seg, "blend_mode", 0)

            if not previous_preset or seg_frz != (bool(getattr(seg, "freeze", False)) or bool(getattr(previous_preset, "freeze", False))):
                entry["frz"] = seg_frz
            if not previous_preset or seg_cct != getattr(previous_preset, "cct", 127):
                entry["cct"] = seg_cct
            if not previous_preset or seg_bm != getattr(previous_preset, "blend_mode", 0):
                entry["bm"] = seg_bm

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
                    "frz":   seg_frz,
                    "cct":   seg_cct,
                    "bm":    seg_bm,
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
        if not previous_preset or p_c1 != getattr(previous_preset, "custom1", 128):
            entry["c1"] = p_c1
        if not previous_preset or p_c2 != getattr(previous_preset, "custom2", 128):
            entry["c2"] = p_c2
        if not previous_preset or p_c3 != getattr(previous_preset, "custom3", 16):
            entry["c3"] = p_c3
        if not previous_preset or p_cct != getattr(previous_preset, "cct", 127):
            entry["cct"] = p_cct
        if not previous_preset or p_frz != bool(getattr(previous_preset, "freeze", False)):
            entry["frz"] = p_frz
        if not previous_preset or p_bm != getattr(previous_preset, "blend_mode", 0):
            entry["bm"] = p_bm
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
