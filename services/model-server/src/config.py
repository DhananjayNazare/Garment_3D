import os

# Server config
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Model config
MODEL_NAME = os.getenv("MODEL_NAME", "tencent/Hunyuan3D-2")
DEVICE = os.getenv("DEVICE", "cuda")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "/tmp/hunyuan3d_outputs")

# Generation defaults
DEFAULT_STEPS = int(os.getenv("DEFAULT_STEPS", "50"))
DEFAULT_GUIDANCE_SCALE = float(os.getenv("DEFAULT_GUIDANCE_SCALE", "5.5"))
DEFAULT_OCTREE_RESOLUTION = int(os.getenv("DEFAULT_OCTREE_RESOLUTION", "256"))

# Maximum concurrent tasks
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT", "1"))

# Shap-E config (used when hy3dgen is not available)
# 32 steps gives good quality/speed balance on CPU (~2-3 min per model)
SHAP_E_STEPS = int(os.getenv("SHAP_E_STEPS", "32"))
SHAP_E_GUIDANCE_SCALE = float(os.getenv("SHAP_E_GUIDANCE_SCALE", "3.0"))
