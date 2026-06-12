import asyncio
from typing import List
from fastapi import APIRouter
from zeroconf import ServiceBrowser, Zeroconf
from pydantic import BaseModel

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

class DiscoveredDevice(BaseModel):
    name: str
    ip_address: str
    mac: str = ""

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
            
            is_wled = False
            if "_wled._tcp.local." in type:
                is_wled = True
            elif "wled" in name.lower() or "wled" in clean_name.lower():
                is_wled = True
            elif b'mac' in (info.properties or {}):
                is_wled = True  # WLED often includes the MAC in TXT records
                
            # Avoid duplicates
            if is_wled and ip and not any(d["ip_address"] == ip for d in self.devices):
                self.devices.append({
                    "name": clean_name,
                    "ip_address": ip,
                    "mac": mac
                })

    def update_service(self, zeroconf, type, name):
        pass

@router.get("", response_model=List[DiscoveredDevice])
async def discover_wled_devices():
    zeroconf = Zeroconf()
    listener = WLEDListener()
<<<<<<< Updated upstream
    browser = ServiceBrowser(zeroconf, "_http._tcp.local.", listener)
    
    # Wait for mDNS multicast responses (3 seconds is usually enough)
    await asyncio.sleep(6)
=======
    browser = ServiceBrowser(zeroconf, ["_wled._tcp.local.", "_http._tcp.local."], listener)
    
    # Wait for mDNS multicast responses (5 seconds is better for sleepy devices)
    await asyncio.sleep(5)
>>>>>>> Stashed changes
    
    zeroconf.close()
    return listener.devices
