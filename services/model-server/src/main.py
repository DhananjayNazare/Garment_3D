"""
FastAPI server for Hunyuan3D-2.1 inference.
Provides endpoints for submitting images and retrieving generated 3D models.
"""

import asyncio
import logging
from pathlib import Path
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image
import io

from config import HOST, PORT, OUTPUT_DIR, MAX_CONCURRENT
from hunyuan_worker import generate_3d

# Detect hy3dgen availability once at startup (no model loading)
try:
    import hy3dgen  # noqa: F401
    _HY3DGEN_AVAILABLE = True
except ImportError:
    _HY3DGEN_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hunyuan3D-2.1 Model Server", version="0.1.0")

# Thread pool for GPU inference (blocking operations)
executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT)

# In-memory task tracking
class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskInfo(BaseModel):
    task_id: str
    status: TaskStatus
    progress: float = 0.0
    error: str | None = None
    model_path: str | None = None

tasks: dict[str, TaskInfo] = {}


@app.get("/health")
async def health():
    return {"status": "ok", "model": "hunyuan3d-2.1", "mock": not _HY3DGEN_AVAILABLE}


@app.post("/generate")
async def generate(image: UploadFile = File(...)):
    """Submit an image for 3D model generation."""
    # Validate file type
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Only JPEG, PNG, and WebP images are accepted")

    # Read and validate image
    contents = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image file")

    # Create a placeholder task
    import uuid
    task_id = str(uuid.uuid4())
    tasks[task_id] = TaskInfo(task_id=task_id, status=TaskStatus.PENDING)

    # Run generation in background
    asyncio.get_event_loop().run_in_executor(
        executor,
        _run_generation,
        task_id,
        pil_image,
    )

    return {"task_id": task_id}


def _run_generation(task_id: str, pil_image: Image.Image):
    """Run 3D generation in a background thread."""
    try:
        tasks[task_id].status = TaskStatus.PROCESSING
        tasks[task_id].progress = 10.0

        result = generate_3d(pil_image)

        tasks[task_id].status = TaskStatus.COMPLETED
        tasks[task_id].progress = 100.0
        tasks[task_id].model_path = result["model_path"]
        logger.info(f"Task {task_id} completed: {result['model_path']}")

    except Exception as e:
        tasks[task_id].status = TaskStatus.FAILED
        tasks[task_id].error = str(e)
        logger.error(f"Task {task_id} failed: {e}")


@app.get("/status/{task_id}")
async def get_status(task_id: str):
    """Get the status of a generation task."""
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")
    return tasks[task_id]


@app.get("/result/{task_id}/model.glb")
async def get_model(task_id: str):
    """Download the generated GLB model."""
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")

    task = tasks[task_id]
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(400, f"Task is {task.status}, not completed")

    model_path = Path(task.model_path)
    if not model_path.exists():
        raise HTTPException(404, "Model file not found")

    return FileResponse(
        model_path,
        media_type="model/gltf-binary",
        filename="model.glb",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
