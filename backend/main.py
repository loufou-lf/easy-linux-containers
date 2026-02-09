from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import json
import os
import time
import platform

IMAGES_CACHE = {}
LAST_CACHE_UPDATE = 0
CACHE_DURATION = 3600

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

CPU_CACHE = {}

class ContainerRequest(BaseModel):
    name: str
    user: str
    password: str
    distro: str
    version: str

def run_script(script_name, args):
    command = [f"/usr/local/bin/{script_name}"] + args
    try:
        subprocess.run(
            command,
            env=LXD_ENV,
            check=True,
            capture_output=True,
            text=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error running {script_name}: {e.stderr}")
        raise e

@app.get("/containers")
def list_containers():
    try:
        current_time = time.time()

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
            status = c.get("status", "Unknown")
            state = c.get("state", {})
            config = c.get("config", {})

            ipv4 = "-"
            memory_usage = 0
            disk_usage = 0
            cpu_usage = 0
            os = "-"
            release = "-"
            architecture = "-"

            if config:
                os = config.get("image.os", "Unknown")
                release = config.get("image.release", "Unknown")
                architecture = config.get("image.architecture", "Unknown")

            if status == "Running" and state:
                network = state.get("network", {})
                for ifname, net in network.items():
                    if ifname != "lo" and isinstance(net, dict):
                        for addr in net.get("addresses", []):
                            if addr.get("family") == "inet":
                                ipv4 = addr["address"]

                memory = state.get("memory", {})
                memory_usage = memory.get("usage", 0)
                if memory_usage == 0:
                    try:
                        cmd = "awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END {print (t-a)*1024}' /proc/meminfo"
                        res = subprocess.run(
                            ["lxc", "exec", name, "--", "sh", "-c", cmd],
                            env=LXD_ENV, capture_output=True, text=True
                        )
                        if res.returncode == 0 and res.stdout.strip():
                            memory_usage = int(float(res.stdout.strip()))
                    except Exception:
                        pass

                disk = state.get("disk", {})
                if isinstance(disk, dict):
                    for _, d in disk.items(): disk_usage += d.get("usage", 0)
                if disk_usage == 0:
                    try:
                        cmd = "df -P / | tail -n 1 | awk '{print $3 * 1024}'"
                        res = subprocess.run(
                            ["lxc", "exec", name, "--", "sh", "-c", cmd],
                            env=LXD_ENV, capture_output=True, text=True
                        )
                        if res.returncode == 0 and res.stdout.strip():
                            disk_usage = int(res.stdout.strip())
                        if lines:
                            disk_usage = int(lines[-1])
                    except Exception:
                        pass

                cpu = state.get("cpu", {})
                current_cpu_ns = cpu.get("usage", 0)

                if name in CPU_CACHE:
                    prev = CPU_CACHE[name]
                    prev_time = prev['time']
                    prev_usage = prev['usage']

                    time_delta = current_time - prev_time

                    cpu_delta_ns = current_cpu_ns - prev_usage
                    cpu_delta_sec = cpu_delta_ns / 1_000_000_000

                    if time_delta > 0:
                        cpu_usage = (cpu_delta_sec / time_delta) * 100
                        cpu_usage = round(cpu_usage, 2)

                CPU_CACHE[name] = {
                    'time': current_time,
                    'usage': current_cpu_ns
                }

            containers.append({
                "name": name,
                "status": status,
                "ipv4": ipv4,
                "memory": memory_usage,
                "disk": disk_usage,
                "cpu_time": f"{cpu_usage}%",
                "os": os,
                "release": release,
                "architecture": architecture
            })

        return {"containers": containers}
    except Exception as e:
        return {"error": str(e)}

@app.post("/containers")
async def create_container(req: ContainerRequest, background_tasks: BackgroundTasks):
    distro_clean = req.distro.lower().replace(" ", "")
    background_tasks.add_task(run_script, "create-ct", [req.name, req.user, req.password, distro_clean, req.version])
    return {"message": f"Creation of {req.name} ({req.distro}) started via script."}

@app.delete("/containers/{name}")
def delete_container(name: str):
    try:
        run_script("delete-ct", [name])
        return {"message": f"Deleting container {name} via script."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")

@app.post("/containers/{name}/stop")
async def stop_container(name: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_script, "stop-ct", [name])
    return {"message": f"Stopping container {name} via script."}

@app.post("/containers/{name}/start")
async def start_container(name: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_script, "start-ct", [name])
    return {"message": f"Starting container {name} via script."}

@app.get("/images")
def get_available_images():
    global IMAGES_CACHE, LAST_CACHE_UPDATE

    current_time = time.time()

    if IMAGES_CACHE and (current_time - LAST_CACHE_UPDATE < CACHE_DURATION):
        return IMAGES_CACHE

    try:
        arch = platform.machine()
        if arch == "x86_64": lxc_arch = "amd64"
        elif arch == "aarch64": lxc_arch = "arm64"
        else: lxc_arch = arch

        print(f"Fetching images for architecture: {lxc_arch}...")

        cmd = [
            "lxc", "image", "list", "images:",
            f"type=container",
            f"architecture={lxc_arch}",
            "--format=json"
        ]

        result = subprocess.run(cmd, env=LXD_ENV, capture_output=True, text=True, check=True)
        raw_images = json.loads(result.stdout)

        processed = {}

        for img in raw_images:
            props = img.get("properties", {})

            os_name = props.get("os")
            release = props.get("release")

            if not os_name or not release:
                continue

            os_name = os_name.lower()

            WHITELIST_OS = ["debian", "ubuntu", "kali"]
            if os_name not in WHITELIST_OS:
                continue

            if os_name not in processed:
                processed[os_name] = []

            if release not in processed[os_name]:
                processed[os_name].append(release)

        for os_name in processed:
            processed[os_name].sort(reverse=True)

        IMAGES_CACHE = processed
        LAST_CACHE_UPDATE = current_time

        return processed

    except Exception as e:
        print(f"Error fetching images: {e}")
        return {}
