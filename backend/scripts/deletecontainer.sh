#!/bin/bash

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
# Script: delete-ct
# Description: Force delete an LXD container
# Usage: delete-ct <name>
# =============================================================================

if [ ! $# -eq 1 ]; then
    echo "[error] Invalid arguments"
    echo "[usage] $0 <name>"
    exit 1
fi

CONTAINER_NAME=$1

echo "[delete] Deleting container: $CONTAINER_NAME"
lxc delete "$CONTAINER_NAME" --force

exit 0
