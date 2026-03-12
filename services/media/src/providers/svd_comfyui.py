"""Stable Video Diffusion provider via ComfyUI for local video generation."""

from __future__ import annotations

import json
import random
import uuid
from pathlib import Path

import httpx
import structlog
import websockets

from .video_base import VideoProvider, VideoRequest, VideoResult

logger = structlog.get_logger(__name__)

# Maximum VRAM budget — SVD 1.1 requires ~8 GB; keep batch size at 1
_MAX_VRAM_GB = 8


def _svd_img2vid_workflow(
    image_path: str,
    width: int = 1080,
    height: int = 1920,
    motion_bucket_id: int = 127,
    fps: int = 8,
    frames: int = 25,
    seed: int | None = None,
) -> dict:
    """Build a ComfyUI API-format workflow for SVD img2vid.

    Pipeline: LoadImage -> SVD_img2vid_Conditioning -> KSampler
              -> VAEDecode -> SaveAnimatedWEBP (or VHS_VideoCombine)
    """
    if seed is None:
        seed = random.randint(0, 2**32 - 1)

    return {
        "1": {
            "class_type": "LoadImage",
            "inputs": {
                "image": image_path,
            },
        },
        "2": {
            "class_type": "ImageScaleToTotalPixels",
            "inputs": {
                "image": ["1", 0],
                "upscale_method": "bicubic",
                "megapixels": round(width * height / 1_000_000, 2),
            },
        },
        "3": {
            "class_type": "SVD_img2vid_Conditioning",
            "inputs": {
                "init_image": ["2", 0],
                "vae": ["4", 2],
                "width": width,
                "height": height,
                "video_frames": frames,
                "motion_bucket_id": motion_bucket_id,
                "fps": fps,
                "augmentation_level": 0.0,
            },
        },
        "4": {
            "class_type": "ImageOnlyCheckpointLoader",
            "inputs": {
                "ckpt_name": "svd_xt_1_1.safetensors",
            },
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 20,
                "cfg": 2.5,
                "sampler_name": "euler",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["3", 0],
                "negative": ["3", 1],
                "latent_image": ["3", 2],
            },
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["5", 0],
                "vae": ["4", 2],
            },
        },
        "7": {
            "class_type": "VHS_VideoCombine",
            "inputs": {
                "images": ["6", 0],
                "frame_rate": fps,
                "loop_count": 0,
                "filename_prefix": "orion_svd",
                "format": "video/h264-mp4",
                "save_output": True,
            },
        },
    }


class SVDProvider(VideoProvider):
    """Generate short video clips via Stable Video Diffusion on a local ComfyUI instance.

    Communicates over HTTP to queue prompts and WebSocket to receive
    execution progress updates, then downloads the resulting video.
    Designed for 8 GB VRAM constraints (batch size 1, SVD-XT 1.1).
    """

    def __init__(
        self,
        host: str = "http://localhost:8188",
        output_dir: str = "/tmp/orion/media/video",
    ) -> None:
        self._host = host.rstrip("/")
        self._ws_url = (
            self._host.replace("http://", "ws://").replace("https://", "wss://")
            + "/ws"
        )
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def is_available(self) -> bool:
        """Check that the ComfyUI server is reachable and has SVD model."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._host}/system_stats")
                if resp.status_code != 200:
                    return False
                stats = resp.json()
                # Verify enough VRAM is available
                vram = stats.get("system", {}).get("vram_total", 0)
                if vram and vram < _MAX_VRAM_GB * 1024 * 1024 * 1024:
                    logger.warning(
                        "svd_insufficient_vram",
                        vram_bytes=vram,
                        required_gb=_MAX_VRAM_GB,
                    )
                return True
        except Exception:
            return False

    async def generate_video(self, request: VideoRequest) -> VideoResult:
        """Queue an SVD img2vid workflow and wait for the result."""
        client_id = uuid.uuid4().hex
        frames = int(request.fps * request.duration_seconds)

        workflow = _svd_img2vid_workflow(
            image_path=request.image_path,
            width=request.width,
            height=request.height,
            motion_bucket_id=request.motion_bucket_id,
            fps=request.fps,
            frames=frames,
            seed=request.seed,
        )

        prompt_id = await self._queue_prompt(workflow, client_id)
        logger.info(
            "svd_prompt_queued",
            prompt_id=prompt_id,
            client_id=client_id,
            frames=frames,
        )

        output_files = await self._wait_for_completion(prompt_id, client_id)
        if not output_files:
            raise RuntimeError("SVD ComfyUI returned no video output")

        video_info = output_files[0]
        file_path = await self._download_video(video_info)

        return VideoResult(
            file_path=str(file_path),
            provider="svd_comfyui",
            width=request.width,
            height=request.height,
            duration_seconds=request.duration_seconds,
            metadata={
                "prompt_id": prompt_id,
                "seed": request.seed,
                "motion_bucket_id": request.motion_bucket_id,
                "fps": request.fps,
                "frames": frames,
            },
        )

    async def _queue_prompt(self, workflow: dict, client_id: str) -> str:
        """POST the workflow to ComfyUI and return the prompt_id."""
        payload = {"prompt": workflow, "client_id": client_id}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self._host}/prompt", json=payload)
            resp.raise_for_status()
            return resp.json()["prompt_id"]

    async def _wait_for_completion(
        self, prompt_id: str, client_id: str
    ) -> list[dict]:
        """Listen on the WebSocket until the prompt finishes executing."""
        ws_url = f"{self._ws_url}?clientId={client_id}"
        output_files: list[dict] = []

        async with websockets.connect(ws_url) as ws:
            async for raw_msg in ws:
                if isinstance(raw_msg, bytes):
                    continue
                msg = json.loads(raw_msg)
                msg_type = msg.get("type")

                if msg_type == "executed" and msg.get("data", {}).get(
                    "prompt_id"
                ) == prompt_id:
                    node_output = msg["data"].get("output", {})
                    gifs = node_output.get("gifs", [])
                    output_files.extend(gifs)
                    videos = node_output.get("videos", [])
                    output_files.extend(videos)

                if msg_type == "execution_complete" and msg.get("data", {}).get(
                    "prompt_id"
                ) == prompt_id:
                    break

                if msg_type == "execution_error" and msg.get("data", {}).get(
                    "prompt_id"
                ) == prompt_id:
                    error = msg.get("data", {}).get(
                        "exception_message", "unknown"
                    )
                    raise RuntimeError(f"SVD ComfyUI execution error: {error}")

        return output_files

    async def _download_video(self, video_info: dict) -> Path:
        """Download a generated video from the ComfyUI /view endpoint."""
        filename = video_info.get("filename", "output.mp4")
        subfolder = video_info.get("subfolder", "")
        vid_type = video_info.get("type", "output")

        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": vid_type,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(f"{self._host}/view", params=params)
            resp.raise_for_status()

        dest = self._output_dir / filename
        dest.write_bytes(resp.content)
        logger.info("svd_video_saved", path=str(dest))
        return dest
