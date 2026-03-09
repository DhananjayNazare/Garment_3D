FROM python:3.11-slim

# Install system dependencies (git required for shap-e + OpenAI CLIP)
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only PyTorch first (avoids pulling ~1.5 GB of CUDA libs)
COPY requirements.txt .
RUN pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install --no-cache-dir -r requirements.txt

# Install Shap-E from GitHub (not on PyPI); also installs OpenAI CLIP
RUN pip3 install --no-cache-dir git+https://github.com/openai/shap-e.git

# Install Hunyuan3D-2 (requires GPU — uncomment when NVIDIA is available)
# RUN pip3 install git+https://github.com/Tencent/Hunyuan3D-2.git

COPY src/ ./src/

EXPOSE 8000

# Pre-download Shap-E model weights during build (~600 MB baked into image)
# transmitter: latent → mesh decoder  (~300 MB)
# image300M:   image-conditioned diffusion model (~300 MB)
RUN python3 src/preload_shap_e.py

CMD ["python3", "src/main.py"]
