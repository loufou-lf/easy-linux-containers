#!/bin/bash -e

# Check args
if [ ! $# -eq 3 ]; then
  echo "[args] Invalid args !"
  echo "[args] ./createcontainer.sh {name} {user} {password}"
  exit 1
fi

# Container vars
CONTAINER_NAME=$(echo "$1" | tr 'A-Z' 'a-z')
CONTAINER_USER=$(echo "$2" | tr 'A-Z' 'a-z')
CONTAINER_PASSWORD="$3"

# Container creation
echo "[create] Launching LXD container with name $CONTAINER_NAME"
lxc launch images:debian/12 "$CONTAINER_NAME"
sleep 5
echo "[create] Updating and installing packages..."
lxc exec "$CONTAINER_NAME" -- apt update
lxc exec "$CONTAINER_NAME" -- apt -y upgrade
lxc exec "$CONTAINER_NAME" -- apt -y install openssh-server python3 sudo
lxc exec "$CONTAINER_NAME" -- adduser --disabled-password --gecos "" "$CONTAINER_USER"
lxc exec "$CONTAINER_NAME" -- bash -c "echo '$CONTAINER_USER:$CONTAINER_PASSWORD' | chpasswd"
lxc exec "$CONTAINER_NAME" -- usermod -a -G sudo "$CONTAINER_USER"

echo ""

# SSH setup
echo "[ssh] Adding ssh key to user $CONTAINER_USER"
HOST_KEY="$HOME/.ssh/id_ed25519.pub"

if [ ! -f "$HOST_KEY" ]; then
  ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519"
  echo "[ssh] Key missing, created one : $HOST_KEY"
fi

HOST_PUBKEY=$(cat "$HOST_KEY")

lxc exec "$CONTAINER_NAME" -- bash -c "
  mkdir -p /home/$CONTAINER_USER/.ssh
  echo '$HOST_PUBKEY' > /home/$CONTAINER_USER/.ssh/authorized_keys
  chown -R $CONTAINER_USER:$CONTAINER_USER /home/$CONTAINER_USER/.ssh
  chmod 700 /home/$CONTAINER_USER/.ssh
  chmod 600 /home/$CONTAINER_USER/.ssh/authorized_keys

  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
  systemctl reload ssh
"

CONTAINER_IP=$(lxc list "$CONTAINER_NAME" --format csv -c 4 | cut -d' ' -f1)

echo ""

# Finish
echo "###"
echo "Container $CONTAINER_NAME is ready!"
echo "Connect with: ssh $CONTAINER_USER@$CONTAINER_IP"
echo "###"

exit 0
