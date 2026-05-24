import asyncio
from sqlmodel import Session, select
from backend.database import engine
from backend.models import Broadcast, PlaylistItem, Preset, Controller, BroadcastSchedule, get_utc_now
from backend.utils import active_broadcast_state, apply_preset_to_wled

async def playlist_runner():
    while True:
        try:
            with Session(engine) as session:
                broadcasts = session.exec(select(Broadcast).where(Broadcast.is_active == True)).all()
                now = get_utc_now()

                for b in broadcasts:
                    items = session.exec(select(PlaylistItem).where(PlaylistItem.playlist_id == b.playlist_id).order_by(PlaylistItem.sort_order)).all()
                    if not items: continue

                    state = active_broadcast_state.get(b.id)
                    if not state or now >= state["next_switch"]:
                        next_idx = (state["item_index"] + 1) % len(items) if state else 0
                        target_item = items[next_idx]
                        target_preset = session.get(Preset, target_item.preset_id)

                        # Gather targets
                        targets = []
                        if b.controller_id:
                            c = session.get(Controller, b.controller_id)
                            if c: targets.append(c)
                        elif b.group_id:
                            targets = session.exec(select(Controller).where(Controller.group_id == b.group_id)).all()

                        await asyncio.gather(*[apply_preset_to_wled(t, target_preset) for t in targets])
                        
                        active_broadcast_state[b.id] = {
                            "item_index": next_idx,
                            "next_switch": now + asyncio.to_timedelta(seconds=target_item.duration_seconds)
                        }
        except Exception as e:
            print(f"Error in playlist_runner: {e}")
            
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
