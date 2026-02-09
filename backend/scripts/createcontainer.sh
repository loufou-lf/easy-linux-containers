#!/bin/bash -e

# Check args
if [ ! $# -eq 5 ]; then
  echo "[args] Invalid args !"
  echo "[args] $0 {name} {user} {password} {distro} {version}"
  exit 1
fi

# Container vars
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

# Container creation
echo "[create] Launching LXD container with name $CONTAINER_NAME and image $CONTAINER_IMAGE"
lxc launch "$CONTAINER_IMAGE" "$CONTAINER_NAME"
sleep 5
echo "[create] Updating and installing packages..."
ENV_VARS="--env DEBIAN_FRONTEND=noninteractive --env NEEDRESTART_MODE=a"
lxc exec "$CONTAINER_NAME" -- apt-get update
lxc exec "$CONTAINER_NAME" -- apt-get -y upgrade
lxc exec "$CONTAINER_NAME" -- apt-get -y install openssh-server python3 sudo


# Adding user
lxc exec "$CONTAINER_NAME" -- sh -c "
    GROUP='sudo'
    useradd -m -G \"\$GROUP\" -s /bin/bash \"$CONTAINER_USER\"
    echo '$CONTAINER_USER:$CONTAINER_PASSWORD' | chpasswd
    echo '%sudo ALL=(ALL) ALL' > /etc/sudoers.d/sudo
"

echo ""

# SSH setup
echo "[ssh] Adding ssh key to user $CONTAINER_USER"
HOST_KEY_MOUNT="/root/host_key.pub"

if [ ! -f "$HOST_KEY_MOUNT" ]; then
  echo "[ssh] Key missing, you need to create one with the command :"
  echo 'ssh-keygen -t ed25519 -N "" -f "$HOME/.ssh/id_ed25519"'
  exit 2
fi

HOST_PUBKEY=$(cat "$HOST_KEY_MOUNT")

lxc exec "$CONTAINER_NAME" -- sh -c "
  mkdir -p /home/$CONTAINER_USER/.ssh
  echo '$HOST_PUBKEY' > /home/$CONTAINER_USER/.ssh/authorized_keys
  chown -R $CONTAINER_USER:$CONTAINER_USER /home/$CONTAINER_USER/.ssh
  chmod 700 /home/$CONTAINER_USER/.ssh
  chmod 600 /home/$CONTAINER_USER/.ssh/authorized_keys

  if [ -f /etc/ssh/sshd_config ]; then
      sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
      sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
  fi

  systemctl daemon-reload
  systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd
"

CONTAINER_IP=$(lxc list "$CONTAINER_NAME" --format csv -c 4 | cut -d' ' -f1)

echo ""

# Finish
echo "###"
echo "Container $CONTAINER_NAME is ready!"
echo "Connect with: ssh $CONTAINER_USER@$CONTAINER_IP"
echo "###"

exit 0
