from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LXD_ENV = {
    **os.environ,
    "LXD_DIR": "/var/snap/lxd/common/lxd"
}

@app.get("/containers")
def list_containers():
    try:
        result = subprocess.run(
            ["lxc", "list", "--format=json"],
            env=LXD_ENV,
            capture_output=True,
            text=True,
            check=True
        )

        raw = json.loads(result.stdout)
        containers = []

        for c in raw:
            name = c.get("name", "unknown")
            status = c.get("status", "UNKNOWN")

            ipv4 = "-"

            state = c.get("state")
            if isinstance(state, dict):
                network = state.get("network")
                if isinstance(network, dict):
                    for ifname, net in network.items():
                        if ifname == "lo":
                            continue

                        if not isinstance(net, dict):
                            continue

                        for addr in net.get("addresses", []):
                            if (
                                isinstance(addr, dict)
                                and addr.get("family") == "inet"
                                and not addr.get("address", "").startswith("127.")
                            ):
                                ipv4 = addr["address"]
                                break

                        if ipv4 != "-":
                            break

            containers.append({
                "name": name,
                "status": status,
                "ipv4": ipv4
            })

        return {"containers": containers}

    except Exception as e:
        return {
            "error": str(e)
        }
