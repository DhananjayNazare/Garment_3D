# Garment 3D

An AI-powered web application that converts flat garment photos into interactive 3D models with photorealistic fabric materials.

## What it does

1. Upload a garment image (JPEG / PNG / WebP)
2. AI generates a 3D mesh from the photo (GLB format)
3. Preview the model in an interactive 3D viewport
4. Apply PBR fabric materials — cotton, silk, denim, linen, velvet, wool, satin, or a custom texture
5. Adjust sheen, roughness, normal strength, anisotropy, texture scale and rotation in real time
6. Export the result as a GLB file or screenshot

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                      │
│  apps/web  (React 18 + Vite + Three.js / R3F)                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / SSE
┌────────────────────▼────────────────────────────────────────┐
│  apps/server  (Fastify 5 + BullMQ)                            │
│  POST /api/upload   POST /api/generate   GET /api/.../sse     │
└──────────┬──────────────────────────────┬───────────────────┘
           │ Redis (BullMQ)                │ HTTP
    ┌──────▼──────┐              ┌─────────▼──────────────────┐
    │  Redis 7    │              │  services/model-server      │
    │  (Docker)   │              │  (FastAPI + PyTorch)        │
    └─────────────┘              │  Shap-E  │  Hunyuan3D-2     │
                                 └──────────────────────────────┘
```

### Monorepo structure

```
.
├── apps/
│   ├── web/            React SPA — upload, 3D viewport, fabric editor
│   └── server/         Fastify API — upload, job queue, model proxy
├── packages/
│   ├── shared/         Shared TypeScript types and Zod schemas
│   ├── garment-3d-core/  Three.js viewer, PBR material, GLB loader/exporter
│   └── garment-3d-react/ React wrapper components built on core
└── services/
    └── model-server/   Python FastAPI + Shap-E inference server
```

## 3D Generation Backends

| Backend                 | Mode      | GPU required       | Quality |
| ----------------------- | --------- | ------------------ | ------- |
| **OpenAI Shap-E**       | `shap-e`  | No (CPU, ~2–3 min) | Good    |
| **Tencent Hunyuan3D-2** | `hunyuan` | Yes (CUDA)         | High    |

The model server auto-selects Hunyuan3D-2 when `hy3dgen` is installed and falls back to Shap-E (always available) otherwise. When the Python server is unreachable entirely, the Node server generates a placeholder mesh so the fabric editor remains usable.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Redis + model server)
- Node.js >= 20
- [pnpm](https://pnpm.io/) >= 9.15 — `npm i -g pnpm`

## Getting started

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd Garment_3D

# 2. Set up environment variables
cp .env.example .env
# Edit .env if you need non-default ports

# 3. Start Redis and the Python model server
docker compose up -d

# 4. Install JavaScript dependencies
pnpm install

# 5. Start all services in development mode
pnpm dev
```

| Service             | URL                   |
| ------------------- | --------------------- |
| Web frontend        | http://localhost:5173 |
| Node API server     | http://localhost:3001 |
| Python model server | http://localhost:8000 |
| Redis               | localhost:6379        |

## Environment variables

Copy `.env.example` to `.env` inside `apps/server/` (or the repo root) before running.

| Variable      | Default                  | Description             |
| ------------- | ------------------------ | ----------------------- |
| `PORT`        | `3001`                   | Node API server port    |
| `NODE_ENV`    | `development`            | Node environment        |
| `REDIS_URL`   | `redis://localhost:6379` | Redis connection string |
| `HUNYUAN_URL` | `http://localhost:8000`  | Python model server URL |

Python model server variables (set in `docker-compose.yml`):

| Variable                 | Default | Description                                       |
| ------------------------ | ------- | ------------------------------------------------- |
| `DEVICE`                 | `cpu`   | PyTorch device (`cpu` or `cuda`)                  |
| `SHAP_E_STEPS`           | `32`    | Diffusion steps — higher = better quality, slower |
| `SHAP_E_GUIDANCE_SCALE`  | `3.0`   | Classifier-free guidance scale                    |
| `DEFAULT_STEPS`          | `50`    | Diffusion steps for Hunyuan3D                     |
| `DEFAULT_GUIDANCE_SCALE` | `5.5`   | CFG scale for Hunyuan3D                           |
| `MAX_CONCURRENT`         | `1`     | Max parallel inference jobs                       |

## Available scripts

```bash
pnpm dev      # Start all apps in development mode (hot reload)
pnpm build    # Production build via Turborepo
pnpm lint     # ESLint across all packages
pnpm clean    # Remove dist/ directories
```

Docker commands:

```bash
docker compose up -d               # Start Redis + model server
docker compose down                # Stop all containers
docker compose build model-server  # Rebuild the Python image
docker compose logs -f model-server  # Tail model server logs
```

## Tech stack

### Frontend (`apps/web`)

- React 18, TypeScript, Vite 6
- React Three Fiber 8 + `@react-three/drei` — WebGL 3D rendering
- Three.js 0.171 — 3D engine, MeshPhysicalMaterial (PBR)
- Zustand 5 — state management
- React Router DOM 7
- Tailwind CSS 3

### API server (`apps/server`)

- Fastify 5, TypeScript, Node.js 20+
- BullMQ 5 — Redis-backed job queue
- ioredis — Redis client
- `@fastify/multipart` — image upload handling

### Python model server (`services/model-server`)

- FastAPI + Uvicorn — async REST API
- PyTorch (CPU wheel) — tensor operations
- OpenAI Shap-E — image-conditioned 3D diffusion (installed from GitHub)
- Tencent Hunyuan3D-2 — optional GPU inference
- Trimesh — mesh processing and GLB export
- Pillow, NumPy, SciPy

### Infrastructure

- Redis 7 Alpine — job queue store
- Docker Compose — container orchestration
- pnpm 9 + Turborepo 2 — monorepo tooling

## Project packages

### `packages/garment-3d-core`

Framework-agnostic Three.js library:

- `GarmentViewer` — scene setup, camera, lighting, orbit controls
- `FabricMaterial` — `MeshPhysicalMaterial` wrapper with sheen, anisotropy, normal map, seamless texture tiling
- `FabricPresets` — built-in PBR presets: cotton, silk, denim, linen, velvet, wool, satin
- `GLBModelLoader` — loads GLB with UV fallback (triplanar projection for meshes with missing UVs)
- `GLBExporter` / `ScreenshotExporter` — export utilities

### `packages/garment-3d-react`

React wrapper components and hooks built on `garment-3d-core`, for use in other React projects.

### `packages/shared`

Shared TypeScript interfaces and Zod validation schemas used by both `apps/web` and `apps/server`.

## API reference

### Upload

```
POST /api/upload
Content-Type: multipart/form-data
Body: file (image/jpeg | image/png | image/webp, max 10 MB)

Response: { imageId: string, url: string }
```

### Generate 3D model

```
POST /api/generate
Body: { imageId: string }

Response: { jobId: string }
```

### Poll job status

```
GET /api/generate/:jobId
Response: { status: "pending"|"processing"|"completed"|"failed", modelUrl?: string }
```

### Server-Sent Events (real-time progress)

```
GET /api/generate/:jobId/sse
Response: text/event-stream  →  data: { status, progress?, modelUrl? }
```

### AI backend status

```
GET /api/model-status
Response: { mode: "shap-e"|"hunyuan"|"offline", mock: boolean }
```

## Fabric presets

| Preset | Highlights                                        |
| ------ | ------------------------------------------------- |
| Cotton | Matte, soft sheen, high roughness                 |
| Silk   | High sheen, low roughness, anisotropic highlights |
| Denim  | Strong normal map, pronounced weave texture       |
| Linen  | Coarse texture, high roughness                    |
| Velvet | Maximum sheen, deep color absorption              |
| Wool   | Soft sheen, fuzzy appearance                      |
| Satin  | Smooth, directional anisotropic sheen             |
| Custom | User-supplied diffuse texture                     |

## Troubleshooting

**"Mock mode" shown in status bar**
The Node server cannot reach the Python model server. Check that Docker is running: `docker compose up -d`.

**Generation stays pending**
Redis may be unavailable. Verify: `docker compose ps`. The `REDIS_URL` in `.env` must match what Docker exposes.

**Model server slow to start**
Shap-E loads ~600 MB of model weights on startup. This is normal — wait for `Application startup complete` in the logs: `docker compose logs -f model-server`.

**Port already in use**
Change `PORT` in `.env` for the Node server, or update `VITE_PORT` in `apps/web/vite.config.ts` for the frontend.
