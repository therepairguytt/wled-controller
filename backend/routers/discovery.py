import asyncio
import httpx
from typing import List
from fastapi import APIRouter, Depends
from zeroconf import ServiceBrowser, Zeroconf
from pydantic import BaseModel
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import Controller

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

class DiscoveredDevice(BaseModel):
    name: str
    ip_address: str
    mac: str = ""
    version: str = "Unknown"
    is_added: bool = False

class WLEDListener:
    def __init__(self):
        self.devices = []

    def remove_service(self, zeroconf, type, name):
        pass

    def add_service(self, zeroconf, type, name):
        info = zeroconf.get_service_info(type, name)
        if info:
            addresses = info.parsed_addresses()
            ip = addresses[0] if addresses else ""
            
            mac = ""
            if info.properties:
                mac_bytes = info.properties.get(b'mac', b'')
                if mac_bytes:
                    mac = mac_bytes.decode('utf-8', errors='ignore')
            
            clean_name = name.replace("._wled._tcp.local.", "").replace("._http._tcp.local.", "").replace(".local.", "")
            
            is_trusted = False
            if "_wled._tcp.local." in type:
                is_trusted = True
            elif "wled" in name.lower() or "wled" in clean_name.lower():
                is_trusted = True
                
            # Avoid duplicates
            if ip and not any(d["ip_address"] == ip for d in self.devices):
                self.devices.append({
                    "name": clean_name,
                    "ip_address": ip,
                    "mac": mac,
                    "_trusted": is_trusted
                })

    def update_service(self, zeroconf, type, name):
        pass

@router.get("", response_model=List[DiscoveredDevice])
async def discover_wled_devices(session: Session = Depends(get_session)):
    zeroconf = Zeroconf()
    listener = WLEDListener()
    browser = ServiceBrowser(zeroconf, ["_wled._tcp.local.", "_http._tcp.local."], listener)
    
    # Wait for mDNS multicast responses
    await asyncio.sleep(5)
    
    zeroconf.close()
    
    verified_devices = []
    
    async def verify_device(device):
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"http://{device['ip_address']}/json/info")
                if res.status_code == 200:
                    data = res.json()
                    
                    if "info" in data:
                        data = data["info"]
                        
                    device["version"] = data.get("ver", "Unknown")
                    
                    if not device.get("mac") and data.get("mac"):
                        device["mac"] = data.get("mac")
                        
                    return device
        except Exception:
            pass
            
        if device.get("_trusted"):
            device["version"] = "Unknown"
            return device
            
        return None

    tasks = [verify_device(d) for d in listener.devices]
    results = await asyncio.gather(*tasks)
    
    existing_ips = set(session.exec(select(Controller.ip_address)).all())
    
    for r in results:
        if r and not any(v["ip_address"] == r["ip_address"] for v in verified_devices):
            r["is_added"] = r["ip_address"] in existing_ips
            verified_devices.append(r)
            
    return verified_devices
