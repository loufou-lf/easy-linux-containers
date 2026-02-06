FROM python:3.12-trixie

ENV DEBIAN_FRONTEND=noninteractive

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

COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
