"""
Hunyuan3D-2.1 inference worker.
Handles model loading and 3D generation from single images.
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
        # Import Hunyuan3D-2 dependencies
        # NOTE: This requires the Hunyuan3D-2 package to be installed.
        # Clone from: https://github.com/Tencent/Hunyuan3D-2
        # Install with: pip install -e .
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
        from hy3dgen.texgen import Hunyuan3DPaintPipeline

        # Load shape generation pipeline
        shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            MODEL_NAME,
            subfolder="hunyuan3d-dit-v2-1",
            use_safetensors=True,
        )
        shape_pipeline = shape_pipeline.to(DEVICE)

        # Load texture generation pipeline
        texture_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
            MODEL_NAME,
            subfolder="hunyuan3d-paint-v2-1",
        )
        texture_pipeline = texture_pipeline.to(DEVICE)

        _pipeline = {
            "shape": shape_pipeline,
            "texture": texture_pipeline,
        }

        logger.info("Hunyuan3D model loaded successfully")
        return _pipeline

    except ImportError:
        logger.warning(
            "Hunyuan3D-2 package not installed. "
            "Using mock pipeline for development. "
            "Install from: https://github.com/Tencent/Hunyuan3D-2"
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
        # Mock mode for development without GPU
        logger.info(f"Mock generation for task {task_id}")
        _create_mock_output(output_dir)
        return {
            "task_id": task_id,
            "output_dir": str(output_dir),
            "model_path": str(output_dir / "model.glb"),
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


def _create_mock_output(output_dir: Path):
    """Create a minimal valid GLB file for development testing."""
    import struct

    # Minimal glTF 2.0 JSON chunk
    gltf_json = (
        '{"asset":{"version":"2.0","generator":"mock"},'
        '"scene":0,"scenes":[{"nodes":[0]}],'
        '"nodes":[{"mesh":0}],'
        '"meshes":[{"primitives":[{"attributes":{"POSITION":0},"indices":1}]}],'
        '"accessors":['
        '{"bufferView":0,"componentType":5126,"count":4,"type":"VEC3",'
        '"max":[0.5,0.8,0.2],"min":[-0.5,0.0,-0.2]},'
        '{"bufferView":1,"componentType":5123,"count":6,"type":"SCALAR"}'
        '],'
        '"bufferViews":['
        '{"buffer":0,"byteOffset":0,"byteLength":48},'
        '{"buffer":0,"byteOffset":48,"byteLength":12}'
        '],'
        '"buffers":[{"byteLength":60}]}'
    )

    # Pad JSON to 4-byte alignment
    json_bytes = gltf_json.encode('utf-8')
    json_padding = (4 - len(json_bytes) % 4) % 4
    json_bytes += b' ' * json_padding

    # Binary buffer: 4 vertices (VEC3) + 6 indices (uint16)
    import array

    vertices = array.array('f', [
        -0.5, 0.0, 0.0,   # v0
         0.5, 0.0, 0.0,   # v1
         0.5, 0.8, 0.0,   # v2
        -0.5, 0.8, 0.0,   # v3
    ])
    indices = array.array('H', [0, 1, 2, 0, 2, 3])

    bin_data = vertices.tobytes() + indices.tobytes()
    bin_padding = (4 - len(bin_data) % 4) % 4
    bin_data += b'\x00' * bin_padding

    # GLB header
    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    glb_path = output_dir / "model.glb"
    with open(glb_path, 'wb') as f:
        # Header
        f.write(b'glTF')                              # magic
        f.write(struct.pack('<I', 2))                  # version
        f.write(struct.pack('<I', total_length))       # total length
        # JSON chunk
        f.write(struct.pack('<I', len(json_bytes)))    # chunk length
        f.write(b'JSON')                               # chunk type
        f.write(json_bytes)
        # Binary chunk
        f.write(struct.pack('<I', len(bin_data)))      # chunk length
        f.write(b'BIN\x00')                            # chunk type
        f.write(bin_data)

    logger.info(f"Created mock GLB at {glb_path}")
