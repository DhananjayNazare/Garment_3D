"""
Depth-based relief mesh generator.
Uses MiDaS v3.1 (DPT-Small) for monocular depth estimation,
then converts the depth map into a displaced 3D mesh exported as GLB.

Runs entirely on CPU — no GPU required.
"""

import logging

import numpy as np
import torch
import torch.nn.functional as F
import trimesh
from PIL import Image
from scipy.ndimage import map_coordinates

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy-loaded MiDaS singleton
# ---------------------------------------------------------------------------

_depth_model = None
_depth_transform = None


def get_depth_model():
    """Load MiDaS v3.1 DPT-Small model (CPU). Cached after first call."""
    global _depth_model, _depth_transform

    if _depth_model is not None:
        return _depth_model, _depth_transform

    from config import DEPTH_MODEL

    logger.info(f"Loading MiDaS depth model: {DEPTH_MODEL}")

    _depth_model = torch.hub.load("intel-isl/MiDaS", DEPTH_MODEL, trust_repo=True)
    _depth_model.eval()

    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    # MiDaS_small uses the "small_transform" entry; DPT variants use "dpt_transform"
    if DEPTH_MODEL in ("MiDaS_small", "DPT_Small"):
        _depth_transform = midas_transforms.small_transform
    else:
        _depth_transform = midas_transforms.dpt_transform

    logger.info("MiDaS depth model loaded successfully")
    return _depth_model, _depth_transform


# ---------------------------------------------------------------------------
# Depth estimation
# ---------------------------------------------------------------------------


def estimate_depth(pil_image: Image.Image) -> np.ndarray:
    """
    Run MiDaS depth estimation on a PIL image.

    Returns a 2D float32 numpy array with values normalised to [0, 1],
    where 1 represents the closest surface.
    """
    model, transform = get_depth_model()

    img_np = np.array(pil_image)
    input_batch = transform(img_np)

    with torch.no_grad():
        prediction = model(input_batch)
        # Resize to original image dimensions
        prediction = F.interpolate(
            prediction.unsqueeze(1),
            size=img_np.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth = prediction.cpu().numpy()

    # MiDaS returns *inverse* depth (closer = higher value).
    # Normalise to [0, 1].
    d_min, d_max = depth.min(), depth.max()
    if d_max - d_min > 1e-6:
        depth = (depth - d_min) / (d_max - d_min)
    else:
        depth = np.zeros_like(depth)

    return depth.astype(np.float32)


# ---------------------------------------------------------------------------
# Mesh generation from depth map
# ---------------------------------------------------------------------------


def depth_to_mesh(
    depth_map: np.ndarray,
    grid_resolution: int = 128,
    depth_scale: float = 0.3,
    width: float = 0.6,
) -> trimesh.Trimesh:
    """
    Convert a depth map into a displaced planar mesh with a flat back face.

    Parameters
    ----------
    depth_map : 2D array of depth values in [0, 1].
    grid_resolution : vertex count along the longest image axis.
    depth_scale : maximum Z displacement in mesh units.
    width : total width of the mesh in mesh units.

    Returns
    -------
    trimesh.Trimesh with per-vertex UVs suitable for GLB export.
    """
    h_img, w_img = depth_map.shape
    aspect = h_img / w_img
    height = width * aspect

    # Grid dimensions proportional to image aspect ratio
    if w_img >= h_img:
        cols = grid_resolution
        rows = max(2, int(grid_resolution * aspect))
    else:
        rows = grid_resolution
        cols = max(2, int(grid_resolution / aspect))

    # Spatial coordinates
    xs = np.linspace(-width / 2, width / 2, cols)
    ys = np.linspace(0, height, rows)

    # UV coordinates [0, 1]
    us = np.linspace(0, 1, cols)
    vs = np.linspace(0, 1, rows)

    grid_x, grid_y = np.meshgrid(xs, ys)
    grid_u, grid_v = np.meshgrid(us, vs)

    # Sample depth map at grid positions (bilinear interpolation)
    sample_x = np.linspace(0, w_img - 1, cols)
    sample_y = np.linspace(h_img - 1, 0, rows)  # flip Y: image top = mesh top
    sample_gx, sample_gy = np.meshgrid(sample_x, sample_y)

    depth_sampled = map_coordinates(depth_map, [sample_gy, sample_gx], order=1)
    grid_z = depth_sampled * depth_scale

    # -- Front face vertices & UVs --
    front_verts = np.column_stack(
        [grid_x.ravel(), grid_y.ravel(), grid_z.ravel()]
    )
    front_uvs = np.column_stack([grid_u.ravel(), grid_v.ravel()])

    # -- Front face triangles --
    front_faces = _grid_faces(rows, cols, vertex_offset=0)

    # -- Back face (flat at z=0, reversed winding) --
    n_front = len(front_verts)
    back_verts = front_verts.copy()
    back_verts[:, 2] = 0.0
    back_faces = _grid_faces(rows, cols, vertex_offset=n_front)[:, ::-1]

    # -- Side walls --
    side_faces = _side_faces(rows, cols, n_front)

    # Combine
    all_verts = np.vstack([front_verts, back_verts])
    all_faces = np.vstack([front_faces, back_faces, side_faces])
    all_uvs = np.vstack([front_uvs, front_uvs])  # back reuses front UVs

    mesh = trimesh.Trimesh(vertices=all_verts, faces=all_faces, process=False)
    mesh.fix_normals()

    # Attach UVs for GLB export
    mesh.visual = trimesh.visual.TextureVisuals(uv=all_uvs)

    return mesh


def _grid_faces(rows: int, cols: int, vertex_offset: int = 0) -> np.ndarray:
    """Generate triangle indices for a rows x cols vertex grid."""
    faces = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            i = vertex_offset + r * cols + c
            #  i --- i+1
            #  |  \   |
            # i+c -- i+c+1
            faces.append([i, i + cols, i + 1])
            faces.append([i + 1, i + cols, i + cols + 1])
    return np.array(faces, dtype=np.int32)


def _side_faces(rows: int, cols: int, back_offset: int) -> np.ndarray:
    """Generate triangle indices connecting front and back edge vertices."""
    faces = []

    def _edge_strip(indices):
        """Create a triangle strip between front[indices] and back[indices]."""
        for k in range(len(indices) - 1):
            fi, fj = indices[k], indices[k + 1]
            bi, bj = fi + back_offset, fj + back_offset
            faces.append([fi, bi, fj])
            faces.append([fj, bi, bj])

    # Bottom edge (row 0, left to right)
    _edge_strip([c for c in range(cols)])

    # Top edge (last row, right to left — reversed for correct winding)
    top_start = (rows - 1) * cols
    _edge_strip([top_start + c for c in range(cols - 1, -1, -1)])

    # Left edge (col 0, bottom to top)
    _edge_strip([r * cols for r in range(rows)])

    # Right edge (last col, top to bottom — reversed)
    _edge_strip([(rows - 1 - r) * cols + (cols - 1) for r in range(rows)])

    return np.array(faces, dtype=np.int32)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_relief_glb(
    pil_image: Image.Image,
    output_path: str,
    grid_resolution: int = 128,
    depth_scale: float = 0.3,
) -> str:
    """
    Full pipeline: image -> depth estimation -> relief mesh -> GLB file.

    Parameters
    ----------
    pil_image : Input image (RGB).
    output_path : Where to write the GLB file.
    grid_resolution : Vertex count along longest axis (default 128).
    depth_scale : Maximum Z displacement (default 0.3 mesh units).

    Returns
    -------
    The output_path string.
    """
    logger.info("Estimating depth map ...")
    depth_map = estimate_depth(pil_image)

    logger.info(
        f"Generating relief mesh (grid={grid_resolution}, scale={depth_scale}) ..."
    )
    mesh = depth_to_mesh(
        depth_map,
        grid_resolution=grid_resolution,
        depth_scale=depth_scale,
    )

    logger.info(f"Exporting GLB to {output_path}")
    mesh.export(output_path, file_type="glb")

    return output_path
