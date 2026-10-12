"""YouTube search, MP3 download jobs and the local music library.

Everything lives under MEDIA_DIR (default: backend/media, git-ignored):

    <video_id>.mp3    the converted audio
    <video_id>.jpg    cover art (YouTube thumbnail, converted to JPEG)
    <video_id>.json   metadata sidecar used to build the library listing
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import yt_dlp
from yt_dlp.utils import DownloadError

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parent
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", ROOT_DIR / "media"))

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
ACTIVE_STATUSES = {"queued", "downloading", "converting"}

_JOBS_LOCK = threading.Lock()
_JOBS: dict[str, dict[str, Any]] = {}
_LIBRARY_LOCK = threading.Lock()
# Limit how many conversions run at once; ffmpeg is CPU heavy.
_SLOTS = threading.BoundedSemaphore(2)


class MusicError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def valid_video_id(value: Any) -> bool:
    return isinstance(value, str) and bool(VIDEO_ID_RE.match(value))


def _clean_error(exc: Exception) -> str:
    text = ANSI_RE.sub("", str(exc)).strip()
    text = text.replace("ERROR: ", "", 1)
    return text[:300] or "Download failed"


def ffmpeg_path() -> str:
    """Find ffmpeg: explicit setting, then PATH, then the binary bundled by imageio-ffmpeg."""
    explicit = os.environ.get("FFMPEG_LOCATION")
    if explicit:
        return explicit
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # bundled ffmpeg binary, installed via requirements.txt

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:  # pragma: no cover - depends on the environment
        raise MusicError("ffmpeg is required to create MP3 files but was not found.", 500) from exc


def _base_opts() -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
    }
    # YouTube needs a JavaScript runtime for some formats; use Node when it is available.
    if shutil.which("node"):
        opts["js_runtimes"] = {"node": {}}
    return opts


def thumbnail_url(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search(query: str, limit: int = 12) -> list[dict[str, Any]]:
    opts = {**_base_opts(), "skip_download": True, "extract_flat": "in_playlist"}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
    except DownloadError as exc:
        raise MusicError(_clean_error(exc), 502) from exc

    results: list[dict[str, Any]] = []
    for entry in (info or {}).get("entries") or []:
        if not entry:
            continue
        video_id = entry.get("id")
        if not valid_video_id(video_id):
            continue
        results.append(
            {
                "id": video_id,
                "title": entry.get("title") or "Untitled",
                "channel": entry.get("channel") or entry.get("uploader") or "",
                "duration": entry.get("duration"),
                "thumbnail": thumbnail_url(video_id),
                "url": f"https://www.youtube.com/watch?v={video_id}",
            }
        )
    return results


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------

def _audio_file(video_id: str) -> Path:
    return MEDIA_DIR / f"{video_id}.mp3"


def _cover_file(video_id: str) -> Path:
    return MEDIA_DIR / f"{video_id}.jpg"


def _sidecar_file(video_id: str) -> Path:
    return MEDIA_DIR / f"{video_id}.json"


def _public_track(meta: dict[str, Any]) -> dict[str, Any]:
    video_id = meta["id"]
    return {
        **meta,
        "audio_url": f"/api/library/{video_id}/audio",
        "cover_url": f"/api/library/{video_id}/cover" if _cover_file(video_id).exists() else None,
        "fallback_cover_url": meta.get("thumbnail") or None,
    }


def get_track(video_id: str) -> Optional[dict[str, Any]]:
    if not valid_video_id(video_id) or not _audio_file(video_id).exists():
        return None
    try:
        meta = json.loads(_sidecar_file(video_id).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        # The audio exists but its metadata is missing: still playable.
        meta = {"id": video_id, "title": video_id, "artist": "Unknown artist", "duration": None}
    return _public_track(meta)


def list_tracks() -> list[dict[str, Any]]:
    if not MEDIA_DIR.exists():
        return []
    tracks = []
    for sidecar in MEDIA_DIR.glob("*.json"):
        track = get_track(sidecar.stem)
        if track:
            tracks.append(track)
    tracks.sort(key=lambda t: t.get("added_at") or "", reverse=True)
    return tracks


def _write_sidecar(video_id: str, meta: dict[str, Any]) -> None:
    target = _sidecar_file(video_id)
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, target)


def update_track(video_id: str, title: Optional[str] = None, artist: Optional[str] = None) -> dict[str, Any]:
    with _LIBRARY_LOCK:
        track = get_track(video_id)
        if not track:
            raise MusicError("Track not found", 404)
        meta = {k: track[k] for k in track if k not in ("audio_url", "cover_url", "fallback_cover_url")}
        if title is not None and title.strip():
            meta["title"] = title.strip()[:200]
        if artist is not None and artist.strip():
            meta["artist"] = artist.strip()[:200]
        _write_sidecar(video_id, meta)
    return get_track(video_id)  # type: ignore[return-value]


def delete_track(video_id: str) -> bool:
    if not valid_video_id(video_id):
        return False
    with _LIBRARY_LOCK:
        existed = _audio_file(video_id).exists()
        for path in (_audio_file(video_id), _cover_file(video_id), _sidecar_file(video_id)):
            path.unlink(missing_ok=True)
    return existed


def audio_path(video_id: str) -> Optional[Path]:
    if not valid_video_id(video_id) or not _audio_file(video_id).exists():
        return None
    return _audio_file(video_id)


def cover_path(video_id: str) -> Optional[Path]:
    if not valid_video_id(video_id) or not _cover_file(video_id).exists():
        return None
    return _cover_file(video_id)


# ---------------------------------------------------------------------------
# Download jobs
# ---------------------------------------------------------------------------

def _public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {k: job[k] for k in job}


def list_jobs() -> list[dict[str, Any]]:
    with _JOBS_LOCK:
        jobs = [_public_job(j) for j in _JOBS.values()]
    jobs.sort(key=lambda j: j["created_at"], reverse=True)
    return jobs


def get_job(job_id: str) -> Optional[dict[str, Any]]:
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        return _public_job(job) if job else None


def dismiss_job(job_id: str) -> bool:
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job or job["status"] in ACTIVE_STATUSES:
            return False
        del _JOBS[job_id]
        return True


def _update_job(job_id: str, **changes: Any) -> None:
    with _JOBS_LOCK:
        if job_id in _JOBS:
            _JOBS[job_id].update(changes)


def start_download(request: dict[str, Any]) -> dict[str, Any]:
    """Queue an MP3 download. Returns {"job": ..., "track": ...}."""
    video_id = request.get("id")
    if not valid_video_id(video_id):
        raise MusicError("Invalid YouTube video id", 400)

    existing = get_track(video_id)
    if existing:
        return {"job": None, "track": existing}

    with _JOBS_LOCK:
        for job in _JOBS.values():
            if job["video_id"] == video_id and job["status"] in ACTIVE_STATUSES:
                return {"job": _public_job(job), "track": None}
        job = {
            "id": uuid.uuid4().hex,
            "video_id": video_id,
            "title": (request.get("title") or "Untitled")[:200],
            "channel": (request.get("channel") or "")[:200],
            "thumbnail": request.get("thumbnail") or thumbnail_url(video_id),
            "duration": request.get("duration"),
            "status": "queued",
            "progress": 0.0,
            "error": None,
            "track_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _JOBS[job["id"]] = job

    threading.Thread(target=_run_job, args=(job["id"], dict(job)), daemon=True).start()
    return {"job": _public_job(job), "track": None}


def _progress_hook(job_id: str):
    def hook(d: dict[str, Any]) -> None:
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            fraction = min(done / total, 1.0) if total else 0.0
            # The first 90% is the download; conversion fills the rest.
            _update_job(job_id, status="downloading", progress=round(fraction * 0.9, 4))
        elif status == "finished":
            _update_job(job_id, progress=0.9)

    return hook


def _postprocessor_hook(job_id: str):
    def hook(d: dict[str, Any]) -> None:
        if d.get("status") == "started":
            _update_job(job_id, status="converting", progress=0.92)
        elif d.get("status") == "finished":
            _update_job(job_id, progress=0.98)

    return hook


def _build_ydl_options(job_id: str) -> dict[str, Any]:
    return {
        **_base_opts(),
        "format": "bestaudio/best",
        "outtmpl": {"default": str(MEDIA_DIR / "%(id)s.%(ext)s")},
        "ffmpeg_location": ffmpeg_path(),
        "writethumbnail": True,
        "progress_hooks": [_progress_hook(job_id)],
        "postprocessor_hooks": [_postprocessor_hook(job_id)],
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"},
            {"key": "FFmpegMetadata", "add_metadata": True},
            {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"},
        ],
        "retries": 3,
        "fragment_retries": 3,
    }


def _run_job(job_id: str, job: dict[str, Any]) -> None:
    video_id = job["video_id"]
    with _SLOTS:
        _update_job(job_id, status="downloading", progress=0.0)
        try:
            MEDIA_DIR.mkdir(parents=True, exist_ok=True)
            url = f"https://www.youtube.com/watch?v={video_id}"
            with yt_dlp.YoutubeDL(_build_ydl_options(job_id)) as ydl:
                info = ydl.extract_info(url, download=True) or {}

            if not _audio_file(video_id).exists():
                raise MusicError("The MP3 file was not created.", 500)

            meta = {
                "id": video_id,
                "title": info.get("track") or info.get("title") or job["title"],
                "artist": (
                    info.get("artist")
                    or info.get("creator")
                    or info.get("channel")
                    or info.get("uploader")
                    or job["channel"]
                    or "Unknown artist"
                ),
                "album": info.get("album") or "",
                "duration": info.get("duration") or job["duration"],
                "thumbnail": job["thumbnail"],
                "source_url": url,
                "added_at": datetime.now(timezone.utc).isoformat(),
            }
            with _LIBRARY_LOCK:
                _write_sidecar(video_id, meta)
            _update_job(job_id, status="done", progress=1.0, track_id=video_id)
            logger.info("Downloaded %s (%s)", video_id, meta["title"])
        except Exception as exc:  # surfaced to the UI as the job error
            logger.exception("Download failed for %s", video_id)
            _update_job(job_id, status="error", error=_clean_error(exc) if not isinstance(exc, MusicError) else exc.message)
