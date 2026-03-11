"""ComfyUI WebSocket-based image generation provider."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

import httpx
import structlog
import websockets

from .base import ImageProvider, ImageRequest, ImageResult
from .comfyui_workflows import txt2img_workflow

logger = structlog.get_logger(__name__)


class ComfyUIProvider(ImageProvider):
    """Generate images via a local ComfyUI instance.

    Communicates over HTTP to queue prompts and WebSocket to receive
    execution progress updates, then downloads the resulting image.
    """

    def __init__(self, host: str, output_dir: str = "/tmp/orion/media") -> None:
        # Strip trailing slash; host is e.g. "http://localhost:8188"
        self._host = host.rstrip("/")
        self._ws_url = self._host.replace("http://", "ws://").replace(
            "https://", "wss://"
        ) + "/ws"
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    async def is_available(self) -> bool:
        """Check that the ComfyUI server is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._host}/system_stats")
                return resp.status_code == 200
        except Exception:
            return False

    async def generate(self, request: ImageRequest) -> ImageResult:
        """Queue a txt2img workflow and wait for the result."""
        client_id = uuid.uuid4().hex
        workflow = txt2img_workflow(
            prompt=request.prompt,
            negative=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg=request.cfg_scale,
            seed=request.seed,
        )

        # Queue the prompt
        prompt_id = await self._queue_prompt(workflow, client_id)
        logger.info(
            "comfyui_prompt_queued",
            prompt_id=prompt_id,
            client_id=client_id,
        )

        # Wait for execution to complete via WebSocket
        output_images = await self._wait_for_completion(prompt_id, client_id)

        # Download the first result image
        if not output_images:
            raise RuntimeError("ComfyUI returned no images")

        image_info = output_images[0]
        file_path = await self._download_image(image_info)

        return ImageResult(
            file_path=str(file_path),
            provider="comfyui",
            width=request.width,
            height=request.height,
            metadata={
                "prompt_id": prompt_id,
                "seed": request.seed,
                "steps": request.steps,
                "cfg_scale": request.cfg_scale,
                "filename": image_info.get("filename", ""),
            },
        )

    async def _queue_prompt(self, workflow: dict, client_id: str) -> str:
        """POST the workflow to ComfyUI and return the prompt_id."""
        payload = {
            "prompt": workflow,
            "client_id": client_id,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._host}/prompt",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["prompt_id"]

    async def _wait_for_completion(
        self, prompt_id: str, client_id: str
    ) -> list[dict]:
        """Listen on the WebSocket until the prompt finishes executing."""
        ws_url = f"{self._ws_url}?clientId={client_id}"
        output_images: list[dict] = []

        async with websockets.connect(ws_url) as ws:
            async for raw_msg in ws:
                if isinstance(raw_msg, bytes):
                    # Binary frames are preview images; skip them
                    continue
                msg = json.loads(raw_msg)
                msg_type = msg.get("type")

                if msg_type == "executed" and msg.get("data", {}).get(
                    "prompt_id"
                ) == prompt_id:
                    node_output = msg["data"].get("output", {})
                    images = node_output.get("images", [])
                    output_images.extend(images)

                if msg_type == "execution_complete" and msg.get("data", {}).get(
                    "prompt_id"
                ) == prompt_id:
                    break

                if msg_type == "execution_error" and msg.get("data", {}).get(
                    "prompt_id"
                ) == prompt_id:
                    error = msg.get("data", {}).get("exception_message", "unknown")
                    raise RuntimeError(f"ComfyUI execution error: {error}")

        return output_images

    async def _download_image(self, image_info: dict) -> Path:
        """Download a generated image from ComfyUI /view endpoint."""
        filename = image_info.get("filename", "output.png")
        subfolder = image_info.get("subfolder", "")
        img_type = image_info.get("type", "output")

        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": img_type,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(f"{self._host}/view", params=params)
            resp.raise_for_status()

        dest = self._output_dir / filename
        dest.write_bytes(resp.content)
        logger.info("comfyui_image_saved", path=str(dest))
        return dest
