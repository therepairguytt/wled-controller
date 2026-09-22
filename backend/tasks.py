import asyncio
import websockets
import json
from datetime import timedelta
from sqlmodel import Session, select
from backend.database import engine
from backend.models import Broadcast, PlaylistItem, Preset, Controller, BroadcastSchedule, get_utc_now, ControllerSegment
from backend.utils import active_broadcast_state, apply_preset_to_wled, manager, wled_live_data
from backend.logger import write_log

async def playlist_runner():
    while True:
        try:
            with Session(engine) as session:
                broadcasts = session.exec(select(Broadcast).where(Broadcast.is_active == True)).all()
                now = get_utc_now()

                for b in broadcasts:
                    items = session.exec(
                        select(PlaylistItem)
                        .where(PlaylistItem.playlist_id == b.playlist_id)
                        .order_by(PlaylistItem.sort_order)
                    ).all()
                    if not items:
                        continue

                    state = active_broadcast_state.get(b.id)

                    # Only advance when the current item's duration has elapsed
                    if state and now < state["next_switch"]:
                        continue

                    next_idx     = (state["item_index"] + 1) % len(items) if state else 0
                    target_item  = items[next_idx]
                    target_preset = session.get(Preset, target_item.preset_id)

                    if not target_preset:
                        continue

                    previous_preset = None
                    if state:
                        current_idx = state["item_index"]
                        if current_idx < len(items):
                            previous_preset = session.get(Preset, items[current_idx].preset_id)

                    # Gather targets
                    targets = []
                    if b.controller_id:
                        c = session.get(Controller, b.controller_id)
                        if c:
                            targets.append(c)
                    elif b.group_id:
                        targets = list(session.exec(
                            select(Controller).where(Controller.group_id == b.group_id)
                        ).all())

                    if targets:
                        # Fallback to broadcast's controller delay if item delay is 0
                        ctrl_delay_ms = target_item.controller_delay_ms if hasattr(target_item, 'controller_delay_ms') and target_item.controller_delay_ms > 0 else (b.controller_delay_ms or 0)
                        seg_delay_ms = target_item.segment_delay_ms if hasattr(target_item, 'segment_delay_ms') else 0

                        async def delayed_apply_segment(target_id, preset_id, delay_sec, prev_preset_id, segment_ids):
                            if delay_sec > 0:
                                await asyncio.sleep(delay_sec)
                            with Session(engine) as inner_session:
                                inner_t = inner_session.get(Controller, target_id)
                                inner_preset = inner_session.get(Preset, preset_id)
                                inner_prev_preset = inner_session.get(Preset, prev_preset_id) if prev_preset_id else None
                                
                                inner_segments = None
                                if segment_ids:
                                    inner_segments = inner_session.exec(select(ControllerSegment).where(ControllerSegment.id.in_(segment_ids))).all()
                                else:
                                    inner_segments = inner_session.exec(select(ControllerSegment).where(ControllerSegment.controller_id == target_id)).all()
                                    
                                if inner_t and inner_preset:
                                    await apply_preset_to_wled(inner_t, inner_preset, inner_segments if inner_segments else None, effect_only=True, previous_preset=inner_prev_preset)

                        # Group controllers by sort_order
                        sorted_targets = sorted(targets, key=lambda c: c.sort_order)
                        
                        ctrl_sort_groups = {}
                        for t in sorted_targets:
                            ctrl_sort_groups.setdefault(t.sort_order, []).append(t)
                            
                        ctrl_group_idx = 0
                        for sort_order, group_targets in ctrl_sort_groups.items():
                            base_delay = (ctrl_delay_ms * ctrl_group_idx) / 1000.0
                            
                            for t in group_targets:
                                segs = session.exec(select(ControllerSegment).where(ControllerSegment.controller_id == t.id)).all()
                                
                                if seg_delay_ms > 0 and segs:
                                    sorted_segs = sorted(segs, key=lambda s: s.sort_order)
                                    seg_sort_groups = {}
                                    for s in sorted_segs:
                                        seg_sort_groups.setdefault(s.sort_order, []).append(s)
                                        
                                    seg_group_idx = 0
                                    for s_order, group_segs in seg_sort_groups.items():
                                        seg_delay = base_delay + ((seg_delay_ms * seg_group_idx) / 1000.0)
                                        prev_id = previous_preset.id if previous_preset else None
                                        seg_ids = [s.id for s in group_segs]
                                        asyncio.create_task(delayed_apply_segment(t.id, target_preset.id, seg_delay, prev_id, seg_ids))
                                        seg_group_idx += 1
                                else:
                                    prev_id = previous_preset.id if previous_preset else None
                                    seg_ids = [s.id for s in segs] if segs else None
                                    asyncio.create_task(delayed_apply_segment(t.id, target_preset.id, base_delay, prev_id, seg_ids))
                                    
                            ctrl_group_idx += 1
                            
                        print(f"[Playlist] Broadcast '{b.name}' → preset '{target_preset.name}' "
                              f"(item {next_idx + 1}/{len(items)}, duration {target_item.duration_seconds}s, c_delay {ctrl_delay_ms}ms, s_delay {seg_delay_ms}ms)")

                    # Save state AFTER successful send — use timedelta, not asyncio.to_timedelta
                    active_broadcast_state[b.id] = {
                        "item_index": next_idx,
                        "next_switch": now + timedelta(seconds=target_item.duration_seconds),
                    }

        except Exception as e:
            print(f"[Playlist] Error in playlist_runner: {e}")

        await asyncio.sleep(1)

async def broadcast_scheduler():
    while True:
        try:
            now = get_utc_now()
            cur_time = now.strftime("%H:%M")
            cur_day = str(now.weekday())
            
            with Session(engine) as session:
                schedules = session.exec(select(BroadcastSchedule).where(BroadcastSchedule.is_enabled == True)).all()
                for s in schedules:
                    b = session.get(Broadcast, s.broadcast_id)
                    if not b or cur_day not in s.days_of_week.split(","): continue
                    
                    # Midnight wraparound logic
                    is_active = s.start_time <= cur_time < s.end_time if s.start_time <= s.end_time else cur_time >= s.start_time or cur_time < s.end_time
                    
                    if b.is_active != is_active:
                        b.is_active = is_active
                        if not is_active and b.id in active_broadcast_state:
                            del active_broadcast_state[b.id]
                        session.add(b)
                        session.commit()
        except Exception as e:
            print(f"Error in broadcast_scheduler: {e}")
            
        await asyncio.sleep(30)

async def controller_health_checker():
    """Periodically pings every controller's WebSocket and updates is_online in the DB."""
    while True:
        try:
            with Session(engine) as session:
                controllers = session.exec(select(Controller)).all()

                async def check_controller(ctrl):
                    try:
                        async with websockets.connect(
                            f"ws://{ctrl.ip_address}/ws",
                            open_timeout=3,
                            close_timeout=2
                        ) as ws:
                            is_online = True
                            try:
                                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                                wled_live_data[ctrl.id] = json.loads(msg)
                            except Exception:
                                pass
                    except Exception:
                        is_online = False

                    if ctrl.is_online != is_online:
                        with Session(engine) as inner_session:
                            db_ctrl = inner_session.get(Controller, ctrl.id)
                            if db_ctrl:
                                db_ctrl.is_online = is_online
                                inner_session.add(db_ctrl)
                                inner_session.commit()

                        write_log(
                            message=f"Controller '{ctrl.name}' ({ctrl.ip_address}) is {'ONLINE' if is_online else 'OFFLINE'}.",
                            category="controller",
                            action="online" if is_online else "offline",
                            level="SUCCESS" if is_online else "ERROR",
                            target_id=ctrl.id,
                            target_name=ctrl.name
                        )
                        await manager.broadcast({
                            "type": "controller_status",
                            "controller_id": ctrl.id,
                            "is_online": is_online
                        })
                        print(f"[Health] {ctrl.name} ({ctrl.ip_address}) is {'ONLINE' if is_online else 'OFFLINE'}")

                # Run all checks concurrently
                await asyncio.gather(*[check_controller(c) for c in controllers])

        except Exception as e:
            print(f"Error in controller_health_checker: {e}")

        await asyncio.sleep(30)
