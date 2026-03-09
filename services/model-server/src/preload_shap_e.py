"""Pre-download Shap-E model weights during Docker image build."""
import torch
from shap_e.models.download import load_model, load_config
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config

device = torch.device("cpu")
print("Downloading Shap-E transmitter (~300 MB)...")
load_model("transmitter", device=device)
print("Downloading Shap-E image300M (~300 MB)...")
load_model("image300M", device=device)
diffusion_from_config(load_config("diffusion"))
print("Shap-E models pre-loaded successfully")
