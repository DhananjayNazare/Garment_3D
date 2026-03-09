"""
Shap-E (OpenAI) based 3D mesh generation from single images.
CPU-capable — no GPU required. ~2-3 minutes per model at 32 diffusion steps.
Model weights (~600 MB) are pre-downloaded into the Docker image at build time.
"""

import logging
from pathlib import Path

import numpy as np
import torch
import trimesh
from PIL import Image

from config import SHAP_E_STEPS, SHAP_E_GUIDANCE_SCALE

logger = logging.getLogger(__name__)

# Singletons — loaded once at startup
_xm = None        # transmitter: decodes latents → 3D representation
_model = None     # image300M: image-conditioned diffusion model
_diffusion = None


def get_shap_e_models():
    """Lazy-load Shap-E models (singleton). Called at server startup to warm up."""
    global _xm, _model, _diffusion

    if _xm is not None:
        return _xm, _model, _diffusion

    from shap_e.models.download import load_model, load_config
    from shap_e.diffusion.gaussian_diffusion import diffusion_from_config

    device = torch.device("cpu")

    logger.info("Loading Shap-E transmitter model...")
    _xm = load_model("transmitter", device=device)

    logger.info("Loading Shap-E image300M diffusion model...")
    _model = load_model("image300M", device=device)

    _diffusion = diffusion_from_config(load_config("diffusion"))

    logger.info("Shap-E models loaded successfully")
    return _xm, _model, _diffusion


def generate_shap_e_glb(
    pil_image: Image.Image,
    output_path: str,
    num_steps: int = SHAP_E_STEPS,
    guidance_scale: float = SHAP_E_GUIDANCE_SCALE,
) -> None:
    """
    Generate a textured GLB mesh from a single PIL image using Shap-E.

    Args:
        pil_image:       Input garment image (any size / aspect ratio).
        output_path:     Destination .glb file path.
        num_steps:       Diffusion steps (32 = good CPU/quality balance).
        guidance_scale:  CFG scale — 3.0 is the recommended value for images.
    """
    from shap_e.diffusion.sample import sample_latents

    xm, model, diffusion = get_shap_e_models()

    # Shap-E image encoder expects a square 256×256 RGB image
    image = pil_image.convert("RGB").resize((256, 256), Image.LANCZOS)

    logger.info(f"Running Shap-E diffusion ({num_steps} steps, cfg={guidance_scale})...")

    with torch.no_grad():
        latents = sample_latents(
            batch_size=1,
            model=model,
            diffusion=diffusion,
            guidance_scale=guidance_scale,
            model_kwargs=dict(images=[image]),
            progress=False,
            clip_denoised=True,
            use_fp16=False,      # fp16 not supported on CPU
            use_karras=True,
            karras_steps=num_steps,
            sigma_min=1e-3,
            sigma_max=160,
            s_churn=0,
        )

    # Decode latent → TriMesh: inline the logic from shap_e.util.notebooks.decode_latent_mesh
    # but without importing that module (it has a top-level `import ipywidgets` for Jupyter).
    logger.info("Decoding Shap-E latent to mesh...")
    from shap_e.models.nn.camera import DifferentiableCameraBatch, DifferentiableProjectiveCamera
    from shap_e.models.transmitter.base import Transmitter
    from shap_e.util.collections import AttrDict

    def _make_pan_cameras(size: int, device: torch.device) -> DifferentiableCameraBatch:
        origins, xs, ys, zs = [], [], [], []
        for theta in np.linspace(0, 2 * np.pi, num=20):
            z = np.array([np.sin(theta), np.cos(theta), -0.5])
            z /= np.sqrt(np.sum(z**2))
            origin = -z * 4
            x = np.array([np.cos(theta), -np.sin(theta), 0.0])
            origins.append(origin)
            xs.append(x)
            ys.append(np.cross(z, x))
            zs.append(z)
        return DifferentiableCameraBatch(
            shape=(1, len(xs)),
            flat_camera=DifferentiableProjectiveCamera(
                origin=torch.from_numpy(np.stack(origins)).float().to(device),
                x=torch.from_numpy(np.stack(xs)).float().to(device),
                y=torch.from_numpy(np.stack(ys)).float().to(device),
                z=torch.from_numpy(np.stack(zs)).float().to(device),
                width=size, height=size, x_fov=0.7, y_fov=0.7,
            ),
        )

    latent = latents[0]
    cameras = _make_pan_cameras(2, latent.device)
    params = (xm.encoder if isinstance(xm, Transmitter) else xm).bottleneck_to_params(latent[None])

    with torch.no_grad():
        decoded = xm.renderer.render_views(
            AttrDict(cameras=cameras),
            params=params,
            options=AttrDict(rendering_mode="stf", render_with_direction=False),
        )
    tri_mesh = decoded.raw_meshes[0].tri_mesh()

    # Convert Shap-E TriMesh → trimesh for GLB export
    vertices = tri_mesh.verts   # (N, 3) float32
    faces = tri_mesh.faces      # (M, 3) int32

    # Extract per-vertex RGB colors if the model produced them
    vertex_colors = None
    if hasattr(tri_mesh, "vertex_channels") and tri_mesh.vertex_channels:
        r = tri_mesh.vertex_channels.get("R", np.ones(len(vertices)))
        g = tri_mesh.vertex_channels.get("G", np.ones(len(vertices)))
        b = tri_mesh.vertex_channels.get("B", np.ones(len(vertices)))
        rgba = np.column_stack([r, g, b, np.ones(len(vertices))]) * 255
        vertex_colors = rgba.astype(np.uint8)

    mesh = trimesh.Trimesh(
        vertices=vertices,
        faces=faces,
        vertex_colors=vertex_colors,
        process=False,
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    mesh.export(output_path, file_type="glb")
    logger.info(f"Shap-E GLB exported → {output_path}")
