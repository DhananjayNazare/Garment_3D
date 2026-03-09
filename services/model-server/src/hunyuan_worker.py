"""
Hunyuan3D-2.1 inference worker.
Handles model loading and 3D generation from single images.
Falls back to Shap-E (CPU, no GPU required) when hy3dgen is not installed.
"""

import os
import uuid
import logging
from pathlib import Path
from PIL import Image

from config import (
    MODEL_NAME,
    DEVICE,
    OUTPUT_DIR,
    DEFAULT_STEPS,
    DEFAULT_GUIDANCE_SCALE,
    DEFAULT_OCTREE_RESOLUTION,
)

logger = logging.getLogger(__name__)

# Global model reference (loaded once)
_pipeline = None


def get_pipeline():
    """Lazy-load the Hunyuan3D-2.1 pipeline."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    logger.info(f"Loading Hunyuan3D model: {MODEL_NAME}")

    try:
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
        from hy3dgen.texgen import Hunyuan3DPaintPipeline

        shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            MODEL_NAME,
            subfolder="hunyuan3d-dit-v2-1",
            use_safetensors=True,
        )
        shape_pipeline = shape_pipeline.to(DEVICE)

        texture_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
            MODEL_NAME,
            subfolder="hunyuan3d-paint-v2-1",
        )
        texture_pipeline = texture_pipeline.to(DEVICE)

        _pipeline = {"shape": shape_pipeline, "texture": texture_pipeline}
        logger.info("Hunyuan3D model loaded successfully")
        return _pipeline

    except ImportError:
        logger.warning(
            "hy3dgen not installed — using Shap-E for CPU-based 3D generation."
        )
        _pipeline = {"shape": None, "texture": None}
        return _pipeline


def generate_3d(
    image: Image.Image,
    steps: int = DEFAULT_STEPS,
    guidance_scale: float = DEFAULT_GUIDANCE_SCALE,
    octree_resolution: int = DEFAULT_OCTREE_RESOLUTION,
) -> dict:
    """
    Generate a 3D model from an input image.

    Returns:
        dict with task_id and output paths
    """
    task_id = str(uuid.uuid4())
    output_dir = Path(OUTPUT_DIR) / task_id
    output_dir.mkdir(parents=True, exist_ok=True)

    pipeline = get_pipeline()

    if pipeline["shape"] is None:
        # Shap-E fallback: CPU-based generation, no GPU required
        from shap_e_generator import generate_shap_e_glb

        logger.info(f"Shap-E generation for task {task_id}")
        glb_path = str(output_dir / "model.glb")
        generate_shap_e_glb(image, glb_path)
        return {
            "task_id": task_id,
            "output_dir": str(output_dir),
            "model_path": glb_path,
        }

    try:
        # Step 1: Generate 3D shape (mesh)
        logger.info(f"Generating shape for task {task_id}")
        mesh = pipeline["shape"](
            image=image,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            octree_resolution=octree_resolution,
        )

        # Step 2: Generate texture
        logger.info(f"Generating texture for task {task_id}")
        textured_mesh = pipeline["texture"](
            mesh=mesh,
            image=image,
        )

        # Step 3: Export as GLB
        glb_path = output_dir / "model.glb"
        textured_mesh.export(str(glb_path))
        logger.info(f"Exported GLB to {glb_path}")

        return {
            "task_id": task_id,
            "output_dir": str(output_dir),
            "model_path": str(glb_path),
        }

    except Exception as e:
        logger.error(f"Generation failed for task {task_id}: {e}")
        raise
