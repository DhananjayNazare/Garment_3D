FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Install Python
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-venv \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Install Hunyuan3D-2 (if available)
# RUN pip3 install git+https://github.com/Tencent/Hunyuan3D-2.git

COPY src/ ./src/

EXPOSE 8000

CMD ["python3", "src/main.py"]
