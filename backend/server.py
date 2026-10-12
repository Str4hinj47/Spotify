import asyncio
import re as _re
from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

import music
from music import MusicError


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ---------------------------------------------------------------------------
# Music: YouTube search, MP3 downloads and the local library
# ---------------------------------------------------------------------------

class DownloadRequest(BaseModel):
    id: str
    title: str = ""
    channel: str = ""
    duration: Optional[float] = None
    thumbnail: str = ""


class TrackUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    artist: Optional[str] = Field(default=None, max_length=200)


def _raise(exc: MusicError):
    raise HTTPException(status_code=exc.status, detail=exc.message)


@api_router.get("/search")
async def search_videos(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(12, ge=1, le=25),
):
    try:
        results = await asyncio.to_thread(music.search, q.strip(), limit)
    except MusicError as exc:
        _raise(exc)
    return {"results": results}


@api_router.get("/downloads")
async def list_downloads():
    return {"jobs": music.list_jobs()}


@api_router.post("/downloads", status_code=202)
async def create_download(body: DownloadRequest):
    try:
        return music.start_download(body.model_dump())
    except MusicError as exc:
        _raise(exc)


@api_router.get("/downloads/{job_id}")
async def get_download(job_id: str):
    job = music.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download not found")
    return job


@api_router.delete("/downloads/{job_id}", status_code=204)
async def dismiss_download(job_id: str):
    if not music.dismiss_job(job_id):
        raise HTTPException(status_code=404, detail="Download not found or still running")
    return Response(status_code=204)


@api_router.get("/library")
async def library_tracks():
    return {"tracks": music.list_tracks()}


@api_router.get("/library/{track_id}")
async def library_track(track_id: str):
    track = music.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


@api_router.patch("/library/{track_id}")
async def library_update(track_id: str, body: TrackUpdate):
    try:
        return music.update_track(track_id, title=body.title, artist=body.artist)
    except MusicError as exc:
        _raise(exc)


@api_router.delete("/library/{track_id}", status_code=204)
async def library_delete(track_id: str):
    if not music.delete_track(track_id):
        raise HTTPException(status_code=404, detail="Track not found")
    return Response(status_code=204)


_RANGE_RE = _re.compile(r"^bytes=(\d*)-(\d*)$")
_CHUNK = 64 * 1024


def _iter_file(path, start: int, end: int):
    with open(path, "rb") as fh:
        fh.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = fh.read(min(_CHUNK, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@api_router.api_route("/library/{track_id}/audio", methods=["GET", "HEAD"])
async def library_audio(track_id: str, request: Request):
    """Streams the MP3 with HTTP Range support so the browser can seek."""
    path = music.audio_path(track_id)
    if not path:
        raise HTTPException(status_code=404, detail="Track not found")
    size = path.stat().st_size
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
    }
    range_header = request.headers.get("range")
    if range_header:
        match = _RANGE_RE.match(range_header.strip())
        if not match or (not match.group(1) and not match.group(2)):
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        start_s, end_s = match.groups()
        if start_s == "":  # suffix range: the last N bytes
            start = max(size - int(end_s), 0)
            end = size - 1
        else:
            start = int(start_s)
            end = min(int(end_s), size - 1) if end_s else size - 1
        if start >= size or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        headers["Content-Length"] = str(end - start + 1)
        if request.method == "HEAD":
            return Response(status_code=206, headers=headers)
        return StreamingResponse(_iter_file(path, start, end), status_code=206, headers=headers)

    headers["Content-Length"] = str(size)
    if request.method == "HEAD":
        return Response(headers=headers)
    return StreamingResponse(_iter_file(path, 0, size - 1), headers=headers)


@api_router.get("/library/{track_id}/cover")
async def library_cover(track_id: str):
    path = music.cover_path(track_id)
    if not path:
        raise HTTPException(status_code=404, detail="Cover not found")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
