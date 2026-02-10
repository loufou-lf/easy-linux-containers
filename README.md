# Easy Linux Containers

An easy way to use LXC to create containers via an web interface.

## Requirements

- **LXC :** Required for low-level Linux containers functionnality.
- **LXD** *(via snap)* **:** Used as the container manager and API layer for creating and managing containers.
- > ⚠️ Note : LXD must be properly initialized (`lxd init`) before running the project.
- **Docker :** Required to run the web interface services.
- **Docker Compose :** Used to orchestrate the frontend and backend services.

### System Requirements

- **Operating System :** Linux-based distribution (LXC/LXD are not supported on macOS or Windows without a VM).
- **Memory :**
  - Minimum : 4GB RAM.
  - Recommended : 8GB or more RAM (for multiple containers).
- **Storage :**
  - At least 50 MB of free disk space.
  - Additional space required depending on container images and size.
  
### Ports Requirements

This project exposes the following ports on the host system :
- **6780** — Frontend UI
- **6700** — Backend API

*Ensure these ports are not in use by other services (otherwise change it in the docker-compose.yml) and are accessible from your browser or network as needed.*

## Installation

```
$ git clone https://github.com/loufou-lf/easy-linux-containers.git
$ cd easy-linux-containers
$ docker compose up -d --build
```
> ⚠️ Note : If you need to use `sudo` for Docker, you have to use the `--preserve-env` option  (`sudo -E docker compose up -d --build`). Otherwise, the script will fail to add the SSH key to the containers.

## Roadmap

### Current Version
- ✅ Containers management (creating, starting, stoping, deleting)
- ✅ Basic dashboard (container name, status, IP address, memory usage, disk usage, CPU usage, OS)

### Upcoming
- 🔄 Limit containers ressources
- 🔄 Better dashboard
- 🔄 Virtual Machines integration with QEMU/KVM

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
See the [LICENSE](LICENSE) file for details.
Proprietary/commercial licensing options are available upon request for those who wish to use the software under different terms than the GPL.

## Contact

For questions or support, please reach out:

- **Email :** loufou60@gmail.com

---

Copyright © 2026 [LouFou](https://github.com/loufou-lf)

