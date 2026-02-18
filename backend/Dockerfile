# =============================================================================
# Easy LXC - Backend Dockerfile
# Description: Python FastAPI backend for LXC container management
# =============================================================================

FROM python:3.12-trixie

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    lxc \
    sudo \
    curl \
    gnupg \
    iproute2 \
    iputils-ping \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Make scripts executable and install to /usr/local/bin
RUN chmod +x scripts/*
COPY scripts/createcontainer.sh /usr/local/bin/create-ct
COPY scripts/deletecontainer.sh /usr/local/bin/delete-ct
COPY scripts/stopcontainer.sh /usr/local/bin/stop-ct
COPY scripts/startcontainer.sh /usr/local/bin/start-ct

# Start the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
