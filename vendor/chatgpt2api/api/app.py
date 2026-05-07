from __future__ import annotations

import os
from contextlib import asynccontextmanager
from threading import Event

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api import accounts, ai, image_tasks, register, system
from api.support import resolve_web_asset, start_limited_account_watcher
from services.backup_service import backup_service
from services.config import config


def create_app() -> FastAPI:
    app_version = config.app_version

    # When mounted under the parent gpt-image-studio reverse proxy at /upstream,
    # the admin UI, admin API and per-image static files are served under that
    # prefix so the iframe can talk to them on the same host. The OpenAI-compat
    # /v1/* router stays at the root because the parent app calls it directly
    # over the docker network without any prefix rewriting.
    base_path = (os.environ.get("BASE_PATH", "") or "").rstrip("/")

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        stop_event = Event()
        thread = start_limited_account_watcher(stop_event)
        backup_service.start()
        config.cleanup_old_images()
        try:
            yield
        finally:
            stop_event.set()
            thread.join(timeout=1)
            backup_service.stop()

    app = FastAPI(title="chatgpt2api", version=app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # /v1/* — OpenAI-compatible. Always at the root for direct upstream calls.
    app.include_router(ai.create_router())
    # Admin / management routers — gated behind base_path when configured.
    app.include_router(accounts.create_router(), prefix=base_path)
    app.include_router(image_tasks.create_router(), prefix=base_path)
    app.include_router(register.create_router(), prefix=base_path)
    app.include_router(system.create_router(app_version), prefix=base_path)
    if config.images_dir.exists():
        app.mount(
            f"{base_path}/images",
            StaticFiles(directory=str(config.images_dir)),
            name="images",
        )

    spa_route = f"{base_path}/{{full_path:path}}" if base_path else "/{full_path:path}"

    @app.get(spa_route, include_in_schema=False)
    async def serve_web(full_path: str):
        # Next.js `output: 'export'` keeps the file system layout flat —
        # files live at web_dist/<full_path> regardless of basePath; the
        # basePath only changes the URLs baked into the HTML. So we look
        # the file up directly without re-prepending base_path.
        asset = resolve_web_asset(full_path)
        if asset is not None:
            return FileResponse(asset)
        if full_path.strip("/").startswith("_next/"):
            raise HTTPException(status_code=404, detail="Not Found")
        fallback = resolve_web_asset("")
        if fallback is None:
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(fallback)

    return app
