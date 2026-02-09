#!/bin/bash

# Check args
if [ ! $# -eq 1 ]; then
  echo "[args] Invalid args !"
  echo "[args] $0 {name}"
  exit 1
fi

# Container vars
CONTAINER_NAME=$1

echo "[start] Starting container $CONTAINER_NAME"
lxc start "$CONTAINER_NAME"

exit 0
