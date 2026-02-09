const API_URL = `${window.location.protocol}//${window.location.hostname}:6700`;

let loadedImages = {};

async function initForm() {
    const osSelect = document.getElementById("osSelect");
    const versionSelect = document.getElementById("versionSelect");

    osSelect.innerHTML = "<option>Loading images...</option>";
    versionSelect.innerHTML = "<option>-</option>";
    osSelect.disabled = true;

    try {
        const res = await fetch(`${API_URL}/images`);
        loadedImages = await res.json();

        osSelect.innerHTML = "";

        Object.keys(loadedImages).sort().forEach(os => {
            const option = document.createElement("option");
            option.value = os;
            option.text = os.charAt(0).toUpperCase() + os.slice(1);
            osSelect.appendChild(option);
        });

        osSelect.disabled = false;
        updateVersions();

    } catch (err) {
        console.error("Failed to load images", err);
        osSelect.innerHTML = "<option>Error loading images</option>";
    }
}

function updateVersions() {
    const osSelect = document.getElementById("osSelect");
    const versionSelect = document.getElementById("versionSelect");
    const selectedOS = osSelect.value;

    versionSelect.innerHTML = "";

    if (loadedImages[selectedOS]) {
        loadedImages[selectedOS].forEach(ver => {
            const option = document.createElement("option");
            option.value = ver;
            option.text = ver;
            versionSelect.appendChild(option);
        });
    }
}

document.addEventListener('DOMContentLoaded', initForm);

async function loadContainers() {
  try {
    const response = await fetch(`${API_URL}/containers`);
    const data = await response.json();

    const tbody = document.querySelector("#containerTable tbody");
    tbody.innerHTML = "";

    if (data.error) {
      tbody.innerHTML = `<tr><td colspan="8">Error: ${data.error}</td></tr>`;
      return;
    }

    data.containers.forEach(c => {
      const row = document.createElement("tr");

      const ramDisplay = c.status === "Running" ? formatBytes(c.memory) : "-";
      const diskDisplay = c.status === "Running" ? formatBytes(c.disk) : "-";
      const cpuDisplay = c.status === "Running" ? `${c.cpu_time}` : "-";

      const actionBtn =
        c.status === "Running" || c.status === "RUNNING"
          ? `<button class="stop-btn" onclick="stopContainer('${c.name}')">Stop</button>`
          : `<button class="start-btn" onclick="startContainer('${c.name}')">Start</button>`;

      row.innerHTML = `
        <td>${c.name}</td>
        <td>${c.status}</td>
        <td>${c.ipv4 || '-'}</td>
        <td>${ramDisplay}</td>
        <td>${diskDisplay}</td>
        <td>${cpuDisplay}</td>
        <td>${c.os} ${c.release} (${c.architecture})</td>
        <td>
            <button class="delete-btn" onclick="deleteContainer('${c.name}')">Delete</button>
            ${actionBtn}
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
  }
}

async function createContainer() {
    const name = document.getElementById('cName').value;
    const user = document.getElementById('cUser').value;
    const pass = document.getElementById('cPass').value;
    const distro = document.getElementById('osSelect').value;
    const version = document.getElementById('versionSelect').value;

    if(!name || !user || !pass) {
        alert("Please fill all fields");
        return;
    }

    if(!confirm(`Create container '${name}'? This will take a minute.`)) return;

    try {
        const res = await fetch(`${API_URL}/containers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, user, password: pass, distro, version })
        });
        const data = await res.json();
        alert(data.message);
        document.getElementById('cName').value = '';
        document.getElementById('cUser').value = '';
        document.getElementById('cPass').value = '';
        loadContainers();
    } catch (err) {
        alert("Error creating container: " + err);
    }
}

async function deleteContainer(name) {
    if(!confirm(`Are you sure you want to DELETE '${name}'?`)) return;

    try {
        await fetch(`${API_URL}/containers/${name}`, { method: 'DELETE' });
        loadContainers();
    } catch (err) {
        alert("Error deleting: " + err);
    }
}

async function stopContainer(name) {
    if(!confirm(`Are you sure you want to STOP '${name}'?`)) return;

    try {
        await fetch(`${API_URL}/containers/${name}/stop`, { method: 'POST' });
        loadContainers();
    } catch (err) {
        alert("Error stopping: " + err);
    }
}

async function startContainer(name) {
    if(!confirm(`Are you sure you want to START '${name}'?`)) return;

    try {
        await fetch(`${API_URL}/containers/${name}/start`, { method: 'POST' });
        loadContainers();
    } catch (err) {
        alert("Error starting: " + err);
    }
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

loadContainers();
setInterval(loadContainers, 5000);
