async function loadContainers() {
  try {
    const response = await fetch('http://192.168.1.21:6700/containers');
    const data = await response.json();

    const tbody = document.querySelector("#containerTable tbody");
    tbody.innerHTML = "";

    if (data.error) {
      tbody.innerHTML = `<tr><td colspan="3">Error: ${data.error}</td></tr>`;
      return;
    }

    data.containers.forEach(c => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${c.name}</td>
        <td>${c.status}</td>
        <td>${c.ipv4 || '-'}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    const tbody = document.querySelector("#containerTable tbody");
    tbody.innerHTML = `<tr><td colspan="3">Error fetching containers</td></tr>`;
  }
}

loadContainers();
setInterval(loadContainers, 5000);
