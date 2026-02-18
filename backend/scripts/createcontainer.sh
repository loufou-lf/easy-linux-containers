#!/bin/bash -e

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

# =============================================================================
# Script: create-ct
# Description: Create and configure a new LXD container
# Usage: create-ct <name> <user> <password> <distro> <version>
# =============================================================================

# -----------------------------------------------------------------------------
# Argument Validation
# -----------------------------------------------------------------------------

if [ ! $# -eq 5 ]; then
    echo "[error] Invalid arguments"
    echo "[usage] $0 <name> <user> <password> <distro> <version>"
    exit 1
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

CONTAINER_NAME=$(echo "$1" | tr 'A-Z' 'a-z')
CONTAINER_USER=$(echo "$2" | tr 'A-Z' 'a-z')
CONTAINER_PASSWORD="$3"
CONTAINER_DISTRO="$4"
CONTAINER_VERSION="$5"

if [ "$CONTAINER_DISTRO" == "kali" ]; then
    CONTAINER_IMAGE="images:kali"
else
    CONTAINER_IMAGE="images:$CONTAINER_DISTRO/$CONTAINER_VERSION"
fi

# -----------------------------------------------------------------------------
# Container Creation
# -----------------------------------------------------------------------------

echo "[create] Launching LXD container: $CONTAINER_NAME (image: $CONTAINER_IMAGE)"
lxc launch "$CONTAINER_IMAGE" "$CONTAINER_NAME"
sleep 5

echo "[create] Updating and installing packages..."
lxc exec "$CONTAINER_NAME" -- apt-get update
lxc exec "$CONTAINER_NAME" -- apt-get -y upgrade
lxc exec "$CONTAINER_NAME" -- apt-get -y install openssh-server python3 sudo

# -----------------------------------------------------------------------------
# User Setup
# -----------------------------------------------------------------------------

echo "[user] Creating user: $CONTAINER_USER"
lxc exec "$CONTAINER_NAME" -- sh -c "
    GROUP='sudo'
    useradd -m -G \"\$GROUP\" -s /bin/bash \"$CONTAINER_USER\"
    echo '$CONTAINER_USER:$CONTAINER_PASSWORD' | chpasswd
    echo '%sudo ALL=(ALL) ALL' > /etc/sudoers.d/sudo
"

# -----------------------------------------------------------------------------
# SSH Configuration
# -----------------------------------------------------------------------------

echo "[ssh] Configuring SSH access for user: $CONTAINER_USER"
HOST_KEY_MOUNT="/root/host_key.pub"

if [ ! -f "$HOST_KEY_MOUNT" ]; then
    echo "[error] SSH key missing. Generate one with:"
    echo '  ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519"'
    exit 2
fi

HOST_PUBKEY=$(cat "$HOST_KEY_MOUNT")

lxc exec "$CONTAINER_NAME" -- sh -c "
    mkdir -p /home/$CONTAINER_USER/.ssh
    echo '$HOST_PUBKEY' > /home/$CONTAINER_USER/.ssh/authorized_keys
    chown -R $CONTAINER_USER:$CONTAINER_USER /home/$CONTAINER_USER/.ssh
    chmod 700 /home/$CONTAINER_USER/.ssh
    chmod 600 /home/$CONTAINER_USER/.ssh/authorized_keys

    # Configure sshd for key-based authentication
    if [ -f /etc/ssh/sshd_config ]; then
        sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
        sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
        sed -i 's/^#\\?AuthorizedKeysFile.*/AuthorizedKeysFile .ssh\\/authorized_keys/' /etc/ssh/sshd_config
    fi

    # Override any sshd_config.d settings that might enable password auth
    if [ -d /etc/ssh/sshd_config.d ]; then
        echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/90-easy-lxc.conf
        echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config.d/90-easy-lxc.conf
    fi

    # Enable and restart sshd service
    systemctl daemon-reload
    systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null
    systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null
"

# -----------------------------------------------------------------------------
# Complete
# -----------------------------------------------------------------------------

CONTAINER_IP=$(lxc list "$CONTAINER_NAME" --format csv -c 4 | cut -d' ' -f1)

echo ""
echo "===================================="
echo "Container $CONTAINER_NAME is ready!"
echo "Connect with: ssh $CONTAINER_USER@$CONTAINER_IP"
echo "===================================="

exit 0
