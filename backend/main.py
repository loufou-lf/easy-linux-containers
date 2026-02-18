# Copyright (c) 2026 LouFou (https://github.com/loufou-lf)
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

"""
Easy LXC Backend API

A FastAPI-based REST API for managing LXD containers.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import json
import os
import time
import platform
import uuid
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

# =============================================================================
# Configuration
# =============================================================================

IMAGES_CACHE = {}
LAST_CACHE_UPDATE = 0
CACHE_DURATION = 3600  # 1 hour

CPU_CACHE = {}

LXD_ENV = {
    **os.environ,
    "LXD_DIR": "/var/snap/lxd/common/lxd"
}

WHITELIST_OS = ["debian", "ubuntu", "kali"]

# Task tracking storage
TASK_STORE = {}
TASK_EXPIRY = 300  # Tasks expire after 5 minutes


@dataclass
class TaskResult:
    """Represents the result of a background task."""
    task_id: str
    status: str  # 'pending', 'running', 'success', 'error'
    action: str
    target: str
    message: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None

# =============================================================================
# Application Setup
# =============================================================================

app = FastAPI(
    title="Easy LXC API",
    description="REST API for managing LXD containers",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Request Models
# =============================================================================


class ContainerRequest(BaseModel):
    """Request model for container creation."""
    name: str
    user: str
    password: str
    distro: str
    version: str


class ExposeRequest(BaseModel):
    """Request model for port exposure."""
    host_port: int
    container_port: int


# =============================================================================
# Helper Functions
# =============================================================================


def cleanup_old_tasks():
    """Remove expired tasks from the store."""
    current_time = time.time()
    expired = [
        task_id for task_id, task in TASK_STORE.items()
        if current_time - task.created_at > TASK_EXPIRY
    ]
    for task_id in expired:
        del TASK_STORE[task_id]


def run_script(script_name: str, args: list) -> dict:
    """
    Execute a shell script with the given arguments.

    Args:
        script_name: Name of the script in /usr/local/bin/
        args: List of command-line arguments

    Returns:
        dict with 'success', 'stdout', 'stderr' keys
    """
    command = [f"/usr/local/bin/{script_name}"] + args
    try:
        result = subprocess.run(
            command,
            env=LXD_ENV,
            check=True,
            capture_output=True,
            text=True
        )
        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except subprocess.CalledProcessError as e:
        print(f"Error running {script_name}: {e.stderr}")
        return {
            "success": False,
            "stdout": e.stdout,
            "stderr": e.stderr
        }


def run_tracked_task(task_id: str, script_name: str, args: list, action: str, target: str):
    """
    Run a script and track its status in TASK_STORE.

    Args:
        task_id: Unique task identifier
        script_name: Name of the script to run
        args: Arguments for the script
        action: Human-readable action name
        target: Target of the action (e.g., container name)
    """
    TASK_STORE[task_id].status = "running"

    result = run_script(script_name, args)

    task = TASK_STORE[task_id]
    task.completed_at = time.time()

    if result["success"]:
        task.status = "success"
        task.message = f"{action} completed successfully for {target}"
    else:
        task.status = "error"
        task.error = result["stderr"].strip() or "Unknown error occurred"


# =============================================================================
# Container Endpoints
# =============================================================================


@app.get("/containers")
def list_containers():
    """Get list of all containers with their status and metrics."""
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
        redirections = []

        for c in raw:
            name = c.get("name", "unknown")
            status = c.get("status", "Unknown")
            state = c.get("state", {})
            config = c.get("config", {})
            devices = c.get("devices", {})

            ipv4 = "-"
            memory_usage = 0
            disk_usage = 0
            cpu_usage = 0
            os_name = "-"
            release = "-"
            architecture = "-"

            if config:
                os_name = config.get("image.os", "Unknown")
                release = config.get("image.release", "Unknown")
                architecture = config.get("image.architecture", "Unknown")

            if status == "Running" and state:
                # Get IPv4 address
                network = state.get("network", {})
                for ifname, net in network.items():
                    if ifname != "lo" and isinstance(net, dict):
                        for addr in net.get("addresses", []):
                            if addr.get("family") == "inet":
                                ipv4 = addr["address"]

                # Get memory usage
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

                # Get disk usage
                disk = state.get("disk", {})
                if isinstance(disk, dict):
                    for _, d in disk.items():
                        disk_usage += d.get("usage", 0)
                if disk_usage == 0:
                    try:
                        cmd = "df -P / | tail -n 1 | awk '{print $3 * 1024}'"
                        res = subprocess.run(
                            ["lxc", "exec", name, "--", "sh", "-c", cmd],
                            env=LXD_ENV, capture_output=True, text=True
                        )
                        if res.returncode == 0 and res.stdout.strip():
                            disk_usage = int(res.stdout.strip())
                    except Exception:
                        pass

                # Calculate CPU usage
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

                # Get proxy devices (port redirections)
                if devices:
                    for dev_name, dev_config in devices.items():
                        if dev_config.get("type") == "proxy":
                            redirections.append({
                                "container": name,
                                "device_name": dev_name,
                                "listen": dev_config.get("listen", ""),
                                "connect": dev_config.get("connect", "")
                            })

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
                "os": os_name,
                "release": release,
                "architecture": architecture
            })

        return {"containers": containers, "redirections": redirections}
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# Task Tracking Endpoints
# =============================================================================


@app.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    """Get the status of a background task."""
    cleanup_old_tasks()

    if task_id not in TASK_STORE:
        raise HTTPException(status_code=404, detail="Task not found")

    task = TASK_STORE[task_id]
    return {
        "task_id": task.task_id,
        "status": task.status,
        "action": task.action,
        "target": task.target,
        "message": task.message,
        "error": task.error,
        "completed": task.status in ["success", "error"]
    }


@app.post("/containers")
async def create_container(req: ContainerRequest, background_tasks: BackgroundTasks):
    """Create a new container in the background."""
    task_id = str(uuid.uuid4())
    distro_clean = req.distro.lower().replace(" ", "")

    # Create task entry
    TASK_STORE[task_id] = TaskResult(
        task_id=task_id,
        status="pending",
        action="Container creation",
        target=req.name
    )

    background_tasks.add_task(
        run_tracked_task,
        task_id,
        "create-ct",
        [req.name, req.user, req.password, distro_clean, req.version],
        "Container creation",
        req.name
    )

    return {
        "message": f"Creation of {req.name} ({req.distro}) started.",
        "task_id": task_id
    }


@app.delete("/containers/{name}")
def delete_container(name: str):
    """Delete a container by name."""
    result = run_script("delete-ct", [name])

    if result["success"]:
        return {"message": f"Container {name} deleted."}
    else:
        raise HTTPException(
            status_code=500,
            detail=result["stderr"].strip() or "Failed to delete container"
        )


@app.post("/containers/{name}/stop")
async def stop_container(name: str, background_tasks: BackgroundTasks):
    """Stop a running container."""
    task_id = str(uuid.uuid4())

    TASK_STORE[task_id] = TaskResult(
        task_id=task_id,
        status="pending",
        action="Stop container",
        target=name
    )

    background_tasks.add_task(
        run_tracked_task,
        task_id,
        "stop-ct",
        [name],
        "Stop container",
        name
    )

    return {"message": f"Stopping container {name}.", "task_id": task_id}


@app.post("/containers/{name}/start")
async def start_container(name: str, background_tasks: BackgroundTasks):
    """Start a stopped container."""
    task_id = str(uuid.uuid4())

    TASK_STORE[task_id] = TaskResult(
        task_id=task_id,
        status="pending",
        action="Start container",
        target=name
    )

    background_tasks.add_task(
        run_tracked_task,
        task_id,
        "start-ct",
        [name],
        "Start container",
        name
    )

    return {"message": f"Starting container {name}.", "task_id": task_id}


# =============================================================================
# Image Endpoints
# =============================================================================


@app.get("/images")
def get_available_images():
    """Get list of available LXD images (cached for 1 hour)."""
    global IMAGES_CACHE, LAST_CACHE_UPDATE

    current_time = time.time()

    # Return cache if still valid
    if IMAGES_CACHE and (current_time - LAST_CACHE_UPDATE < CACHE_DURATION):
        return IMAGES_CACHE

    try:
        # Determine system architecture
        arch = platform.machine()
        if arch == "x86_64":
            lxc_arch = "amd64"
        elif arch == "aarch64":
            lxc_arch = "arm64"
        else:
            lxc_arch = arch

        print(f"Fetching images for architecture: {lxc_arch}...")

        cmd = [
            "lxc", "image", "list", "images:",
            f"type=container",
            f"architecture={lxc_arch}",
            "--format=json"
        ]

        result = subprocess.run(
            cmd, env=LXD_ENV, capture_output=True, text=True, check=True
        )
        raw_images = json.loads(result.stdout)

        processed = {}

        for img in raw_images:
            props = img.get("properties", {})
            os_name = props.get("os")
            release = props.get("release")

            if not os_name or not release:
                continue

            os_name = os_name.lower()

            if os_name not in WHITELIST_OS:
                continue

            if os_name not in processed:
                processed[os_name] = []

            if release not in processed[os_name]:
                processed[os_name].append(release)

        # Sort releases in descending order
        for os_name in processed:
            processed[os_name].sort(reverse=True)

        IMAGES_CACHE = processed
        LAST_CACHE_UPDATE = current_time

        return processed

    except Exception as e:
        print(f"Error fetching images: {e}")
        return {}


# =============================================================================
# Port Redirection Endpoints
# =============================================================================


@app.post("/containers/{name}/expose")
async def expose_container_port(name: str, req: ExposeRequest):
    """Expose a container port to the host."""
    device_name = f"proxy-{req.container_port}"

    cmd = [
        "lxc", "config", "device", "add", name, device_name, "proxy",
        f"listen=tcp:0.0.0.0:{req.host_port}",
        f"connect=tcp:127.0.0.1:{req.container_port}"
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            return {"error": result.stderr.strip()}

        return {
            "message": f"Port {req.host_port} redirected to container {name}:{req.container_port}"
        }
    except Exception as e:
        return {"error": str(e)}


@app.delete("/containers/{name}/expose/{device_name}")
def remove_expose(name: str, device_name: str):
    """Remove a port redirection from a container."""
    cmd = ["lxc", "config", "device", "remove", name, device_name]

    try:
        result = subprocess.run(cmd, env=LXD_ENV, capture_output=True, text=True)

        if result.returncode != 0:
            return {"error": result.stderr.strip()}

        return {"message": f"Redirection {device_name} removed."}
    except Exception as e:
        return {"error": str(e)}