/*
 * Copyright (c) 2026 LouFou (https://github.com/loufou-lf)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/* ==========================================================================
   Global Configuration
   ========================================================================== */

const API_URL = `${window.location.protocol}//${window.location.hostname}:6700`;

let loadedImages = {};

/* ==========================================================================
   Toaster Notification System
   ========================================================================== */

const Toaster = {
  /**
   * Initialize the toast container on page load
   */
  init() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  },

  /**
   * Display a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
   * @param {number} duration - Display duration in ms (0 = permanent)
   */
  show(message, type = 'info', duration = 5000) {
    this.init();

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.classList.add('toast', type);

    // SVG icons (no external dependency)
    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    toast.innerHTML = `
      <div class="toast-content">
        <span class="icon">${icons[type] || icons.info}</span>
        <span class="message">${message}</span>
      </div>
      <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    let timeout;

    const removeToast = () => {
      toast.classList.add('hide');
      toast.addEventListener('animationend', () => toast.remove());
      clearTimeout(timeout);
    };

    if (duration > 0) {
      timeout = setTimeout(removeToast, duration);
    }

    toast.querySelector('.toast-close').addEventListener('click', removeToast);
  },

  /**
   * Clear all current toasts
   */
  clearAll() {
    const container = document.getElementById('toast-container');
    if (container) {
      container.querySelectorAll('.toast').forEach(toast => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => toast.remove());
      });
    }
  },

  /**
   * Display a confirmation dialog
   * @param {string} message - The message to display (supports HTML)
   * @param {Function} onConfirm - Callback when user confirms
   * @param {string} type - Dialog type: 'danger', 'warning', 'info'
   * @param {string} title - Optional custom title
   */
  ask(message, onConfirm, type = 'info', title = null) {
    // SVG icons for modal header
    const icons = {
      danger: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const titles = {
      danger: 'Confirm Deletion',
      warning: 'Warning',
      info: 'Confirm'
    };

    // Create overlay
    const overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');

    // Create modal dialog
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header ${type}">
          <span class="modal-icon">${icons[type] || icons.info}</span>
          <h3 class="modal-title">${title || titles[type] || 'Confirm'}</h3>
        </div>
        <div class="modal-body">
          ${message}
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel">Cancel</button>
          <button class="modal-btn modal-btn-confirm ${type}">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close modal function
    const closeModal = () => {
      overlay.classList.add('hide');
      overlay.addEventListener('animationend', () => overlay.remove());
    };

    // Event listeners
    overlay.querySelector('.modal-btn-cancel').addEventListener('click', closeModal);

    overlay.querySelector('.modal-btn-confirm').addEventListener('click', () => {
      closeModal();
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });

    // Close on overlay click (outside dialog)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
};

/* ==========================================================================
   Clipboard Utilities
   ========================================================================== */

/**
 * Copy text to clipboard with fallback for older browsers
 * @param {string} textToCopy - Text to copy
 */
async function copyText(textToCopy) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      Toaster.show("Copied: " + textToCopy, "success");
      return;
    } catch (err) {
      console.warn("Clipboard API failed, falling back...", err);
    }
  }

  // Fallback for older browsers
  const textArea = document.createElement("textarea");
  textArea.value = textToCopy;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      Toaster.show("Copied: " + textToCopy, "success");
    } else {
      Toaster.show("Copy failed.", "error");
    }
  } catch (err) {
    Toaster.show("Unable to copy: " + err, "error");
  }

  document.body.removeChild(textArea);
}

/* ==========================================================================
   Task Tracking
   ========================================================================== */

/**
 * Poll for task completion and show result via toast
 * @param {string} taskId - The task ID to poll
 * @param {number} interval - Polling interval in ms
 * @param {number} maxAttempts - Maximum polling attempts
 */
async function pollTaskStatus(taskId, interval = 2000, maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`);

      if (!res.ok) {
        if (res.status === 404) {
          Toaster.show("Task not found or expired.", "warning");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const task = await res.json();

      if (task.completed) {
        Toaster.clearAll();
        if (task.status === "success") {
          Toaster.show(task.message || `${task.action} completed.`, "success");
        } else if (task.status === "error") {
          Toaster.show(`Error: ${task.error || 'Unknown error'}`, "error");
        }
        loadContainers();
        return;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (err) {
      console.error("Error polling task:", err);
      Toaster.show("Error checking task status.", "error");
      return;
    }
  }

  Toaster.show("Task is taking too long. Check back later.", "warning");
}

/* ==========================================================================
   Form Initialization
   ========================================================================== */

/**
 * Initialize the OS selection form with available images
 */
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

/**
 * Update version dropdown based on selected OS
 */
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

/* ==========================================================================
   Container Management
   ========================================================================== */

/**
 * Load and display all containers
 */
async function loadContainers() {
  try {
    const response = await fetch(`${API_URL}/containers`);
    const data = await response.json();

    const tbody = document.querySelector("#containerTable tbody");
    tbody.innerHTML = "";

    if (!data.containers || data.containers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No containers found.</td></tr>';
    } else {
        if (data.error) {
        tbody.innerHTML = `<tr><td colspan="8">Error: ${data.error}</td></tr>`;
        return;
        }

        const exposeSelect = document.getElementById('exposeContainerSelect');
        let currentSelection = "";
        if (exposeSelect) {
        currentSelection = exposeSelect.value;
        exposeSelect.innerHTML = '<option value="">-- Choose a container --</option>';
        }

        data.containers.forEach(c => {
        const row = document.createElement("tr");

        const ramDisplay = c.status === "Running" ? formatBytes(c.memory) : "-";
        const diskDisplay = c.status === "Running" ? formatBytes(c.disk) : "-";
        const cpuDisplay = c.status === "Running" ? `${c.cpu_time}` : "-";

        const actionBtn = (c.status === "Running" || c.status === "RUNNING")
            ? `<button class="stop-btn" onclick="stopContainer('${c.name}')">Stop</button>`
            : `<button class="start-btn" onclick="startContainer('${c.name}')">Start</button>`;

        const ipDisplay = c.ipv4
            ? `${c.ipv4} <button class="copy-btn" onclick="copyText('${c.ipv4}')">COPY</button>`
            : `-`;

        row.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.status}</td>
            <td>${ipDisplay}</td>
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

        if (exposeSelect && (c.status === "Running" || c.status === "RUNNING")) {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.text = c.name;
            exposeSelect.appendChild(opt);
        }
        });
    }

    // Update redirections table
    const redTbody = document.querySelector("#redirectionsTable tbody");
    if (redTbody) {
      redTbody.innerHTML = "";

      if (data.redirections && data.redirections.length > 0) {
        data.redirections.forEach(r => {
          const tr = document.createElement("tr");
              
          const hostPort = r.listen.replace('tcp:0.0.0.0:', '').replace('tcp:', '');
          const targetPort = r.connect.replace('tcp:127.0.0.1:', '').replace('tcp:', '');

          tr.innerHTML = `
            <td><strong>${r.container}</strong></td>
            <td>${r.device_name}</td>
            <td><a href="${API_URL}:${hostPort}" style="color: var(--color-primary);">${hostPort}</a></td>
            <td>${targetPort}</td>
            <td>
              <button class="delete-btn" onclick="deleteRedirection('${r.container}', '${r.device_name}')">Delete</button>
            </td>
          `;
          redTbody.appendChild(tr);
        });
      } else {
        redTbody.innerHTML = '<tr><td colspan="5">No active redirections.</td></tr>';
      }
    }

    if (exposeSelect && currentSelection) {
      exposeSelect.value = currentSelection;
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Create a new container
 */
async function createContainer() {
  const name = document.getElementById('cName').value;
  const user = document.getElementById('cUser').value;
  const pass = document.getElementById('cPass').value;
  const distro = document.getElementById('osSelect').value;
  const version = document.getElementById('versionSelect').value;

  if (!name || !user || !pass) {
    Toaster.show("Please fill all fields", "error");
    return;
  }

  Toaster.show(`Creating container '${name}'. This will take a minute...`, "info", 0);

  try {
    const res = await fetch(`${API_URL}/containers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, user, password: pass, distro, version })
    });
    const data = await res.json();

    // Clear form
    document.getElementById('cName').value = '';
    document.getElementById('cUser').value = '';
    document.getElementById('cPass').value = '';

    // Poll for task completion
    if (data.task_id) {
      pollTaskStatus(data.task_id, 3000, 120);
    } else {
      Toaster.show(data.message, "success");
      loadContainers();
    }
  } catch (err) {
    Toaster.show("Error creating container: " + err, "error");
  }
}

/**
 * Delete a container
 * @param {string} name - Container name
 */
async function deleteContainer(name) {
  if (!confirm(`Are you sure you want to DELETE '${name}'?`)) return;

  Toaster.show(`Deleting container '${name}'...`, "info");

  try {
    const res = await fetch(`${API_URL}/containers/${name}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      Toaster.show(`Error: ${data.detail || 'Failed to delete'}`, "error");
    } else {
      Toaster.show(data.message || `Container ${name} deleted.`, "success");
    }
    loadContainers();
  } catch (err) {
    Toaster.show("Error deleting: " + err, "error");
  }
}

/**
 * Stop a container
 * @param {string} name - Container name
 */
async function stopContainer(name) {
  if (!confirm(`Are you sure you want to STOP '${name}'?`)) return;

  Toaster.show(`Stopping container '${name}'...`, "info");

  try {
    const res = await fetch(`${API_URL}/containers/${name}/stop`, { method: 'POST' });
    const data = await res.json();

    if (data.task_id) {
      pollTaskStatus(data.task_id);
    } else {
      loadContainers();
    }
  } catch (err) {
    Toaster.show("Error stopping: " + err, "error");
  }
}

/**
 * Start a container
 * @param {string} name - Container name
 */
async function startContainer(name) {
  Toaster.show(`Starting container '${name}'...`, "info");

  try {
    const res = await fetch(`${API_URL}/containers/${name}/start`, { method: 'POST' });
    const data = await res.json();

    if (data.task_id) {
      pollTaskStatus(data.task_id);
    } else {
      loadContainers();
    }
  } catch (err) {
    Toaster.show("Error starting: " + err, "error");
  }
}

/* ==========================================================================
   Port Redirection
   ========================================================================== */

/**
 * Expose a port from a container
 */
async function exposePort() {
  const name = document.getElementById('exposeContainerSelect').value;
  const hostPort = document.getElementById('hostPort').value;
  const containerPort = document.getElementById('containerPort').value;

  if (!name || !hostPort || !containerPort) {
    Toaster.show("Please select a container and set both ports.", "error");
    return;
  }

  Toaster.show(`Redirecting port ${hostPort}...`, "info");

  try {
    const res = await fetch(`${API_URL}/containers/${name}/expose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host_port: parseInt(hostPort),
        container_port: parseInt(containerPort)
      })
    });

    const data = await res.json();

    if (data.error) {
      Toaster.show("Error: " + data.error, "error");
    } else {
      Toaster.show(data.message, "success");
      document.getElementById('hostPort').value = '';
      document.getElementById('containerPort').value = '';
    }
  } catch (err) {
    Toaster.show("API Error: " + err, "error");
  }
}

/**
 * Delete a port redirection
 * @param {string} container - Container name
 * @param {string} deviceName - Device/proxy name
 */
function deleteRedirection(container, deviceName) {
  Toaster.ask(`Do you really want to delete the redirection (<b>${deviceName}</b>) on <b>${container}</b>?`, async () => {
    try {
      const res = await fetch(`${API_URL}/containers/${container}/expose/${deviceName}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.error) {
        Toaster.show("Error: " + data.error, "error");
      } else {
        Toaster.show(data.message, "success");
        loadContainers();
      }
    } catch (err) {
      Toaster.show("API Error: " + err, "error");
    }
  }, 'danger');
}

/* ==========================================================================
   Utilities
   ========================================================================== */

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

loadContainers();
setInterval(loadContainers, 5000);
