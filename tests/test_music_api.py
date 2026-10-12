"""Tests for the music endpoints. YouTube itself is never contacted:
yt-dlp is replaced by a fake that writes a real MP3 with ffmpeg."""

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_database")

import music  # noqa: E402
import server  # noqa: E402
import yt_dlp  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

VID = "dQw4w9WgXcQ"
VID2 = "jfKfPfyJRdk"


@pytest.fixture()
def media(tmp_path, monkeypatch):
    monkeypatch.setattr(music, "MEDIA_DIR", tmp_path)
    return tmp_path


@pytest.fixture()
def client(media):
    return TestClient(server.app)


def _make_mp3(path: Path, seconds: int = 2):
    ffmpeg = music.ffmpeg_path()
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi", "-i",
         f"sine=frequency=440:duration={seconds}", "-q:a", "9", str(path)],
        check=True,
    )


class FakeYDL:
    """Stands in for yt_dlp.YoutubeDL during downloads and searches."""

    behaviour = "ok"
    search_entries = []

    def __init__(self, opts):
        self.opts = opts

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def extract_info(self, url, download=False):
        if not download:
            return {"entries": FakeYDL.search_entries}
        for hook in self.opts["progress_hooks"]:
            hook({"status": "downloading", "downloaded_bytes": 50, "total_bytes": 100})
        if FakeYDL.behaviour == "fail":
            raise yt_dlp.utils.DownloadError("ERROR: \x1b[0;31mVideo unavailable\x1b[0m")
        for hook in self.opts["postprocessor_hooks"]:
            hook({"status": "started"})
        video_id = url.split("v=")[1]
        _make_mp3(music.MEDIA_DIR / f"{video_id}.mp3")
        (music.MEDIA_DIR / f"{video_id}.jpg").write_bytes(b"\xff\xd8\xff\xd9")
        return {"id": video_id, "title": "Test Tone", "channel": "Test Artist",
                "duration": 2, "track": None, "artist": None}


def _wait_for(client, job_id, status_wanted=("done", "error"), timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/api/downloads/{job_id}").json()
        if job["status"] in status_wanted:
            return job
        time.sleep(0.05)
    raise AssertionError("job did not finish")


def test_validates_video_ids(client):
    assert music.valid_video_id(VID)
    assert not music.valid_video_id("../etc/passwd")
    assert not music.valid_video_id("short")
    resp = client.post("/api/downloads", json={"id": "../../secret"})
    assert resp.status_code == 400
    assert client.get("/api/library/..%2F..%2Fsecret/audio").status_code == 404


def test_search_maps_entries(client, monkeypatch):
    monkeypatch.setattr(music.yt_dlp, "YoutubeDL", FakeYDL)
    FakeYDL.search_entries = [
        {"id": VID, "title": "A", "channel": "Chan", "duration": 212},
        {"id": "bad id", "title": "skipped"},
        None,
    ]
    resp = client.get("/api/search", params={"q": "test"})
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == VID
    assert results[0]["thumbnail"].endswith(f"/{VID}/hqdefault.jpg")
    assert client.get("/api/search", params={"q": ""}).status_code == 422


def test_search_error_is_reported(client, monkeypatch):
    class Broken(FakeYDL):
        def extract_info(self, url, download=False):
            raise yt_dlp.utils.DownloadError("network down")

    monkeypatch.setattr(music.yt_dlp, "YoutubeDL", Broken)
    resp = client.get("/api/search", params={"q": "x"})
    assert resp.status_code == 502
    assert "network down" in resp.json()["detail"]


def test_ydl_options_are_accepted_by_yt_dlp(media):
    # Constructing YoutubeDL validates option and postprocessor names without any network access.
    yt_dlp.YoutubeDL(music._build_ydl_options(VID))


def test_download_creates_library_entry(client, monkeypatch, media):
    monkeypatch.setattr(music.yt_dlp, "YoutubeDL", FakeYDL)
    FakeYDL.behaviour = "ok"
    resp = client.post("/api/downloads", json={"id": VID, "title": "Test Tone", "channel": "Test Artist", "duration": 2,
                                              "thumbnail": f"https://i.ytimg.com/vi/{VID}/hqdefault.jpg"})
    assert resp.status_code == 202
    job = resp.json()["job"]
    done = _wait_for(client, job["id"])
    assert done["status"] == "done"
    assert done["track_id"] == VID
    assert done["progress"] == 1.0

    tracks = client.get("/api/library").json()["tracks"]
    assert [t["id"] for t in tracks] == [VID]
    track = tracks[0]
    assert track["title"] == "Test Tone"
    assert track["artist"] == "Test Artist"
    assert track["cover_url"] == f"/api/library/{VID}/cover"
    assert client.get(track["cover_url"]).headers["content-type"] == "image/jpeg"

    # Requesting the same video again is answered from the library, not re-downloaded.
    again = client.post("/api/downloads", json={"id": VID}).json()
    assert again["job"] is None
    assert again["track"]["id"] == VID


def test_failed_download_reports_clean_error(client, monkeypatch, media):
    monkeypatch.setattr(music.yt_dlp, "YoutubeDL", FakeYDL)
    FakeYDL.behaviour = "fail"
    try:
        job = client.post("/api/downloads", json={"id": VID2}).json()["job"]
        done = _wait_for(client, job["id"])
    finally:
        FakeYDL.behaviour = "ok"
    assert done["status"] == "error"
    assert done["error"] == "Video unavailable"
    assert client.get("/api/library").json()["tracks"] == []
    assert client.delete(f"/api/downloads/{job['id']}").status_code == 204
    assert client.get(f"/api/downloads/{job['id']}").status_code == 404


def test_audio_streaming_supports_ranges(client, media):
    _make_mp3(media / f"{VID}.mp3", seconds=2)
    size = (media / f"{VID}.mp3").stat().st_size
    (media / f"{VID}.json").write_text('{"id": "%s", "title": "T", "artist": "A"}' % VID)

    full = client.get(f"/api/library/{VID}/audio")
    assert full.status_code == 200
    assert full.headers["accept-ranges"] == "bytes"
    assert int(full.headers["content-length"]) == size
    assert len(full.content) == size

    part = client.get(f"/api/library/{VID}/audio", headers={"Range": "bytes=10-19"})
    assert part.status_code == 206
    assert part.headers["content-range"] == f"bytes 10-19/{size}"
    assert part.content == full.content[10:20]

    tail = client.get(f"/api/library/{VID}/audio", headers={"Range": "bytes=-5"})
    assert tail.content == full.content[-5:]

    open_ended = client.get(f"/api/library/{VID}/audio", headers={"Range": f"bytes={size - 3}-"})
    assert open_ended.content == full.content[-3:]

    bad = client.get(f"/api/library/{VID}/audio", headers={"Range": f"bytes={size + 10}-"})
    assert bad.status_code == 416

    head = client.head(f"/api/library/{VID}/audio")
    assert head.status_code == 200
    assert head.headers["content-length"] == str(size)


def test_update_and_delete_track(client, media):
    _make_mp3(media / f"{VID}.mp3")
    (media / f"{VID}.json").write_text('{"id": "%s", "title": "Old", "artist": "Someone"}' % VID)

    patched = client.patch(f"/api/library/{VID}", json={"title": "  New title  ", "artist": ""})
    assert patched.status_code == 200
    assert patched.json()["title"] == "New title"
    assert patched.json()["artist"] == "Someone"  # blank values are ignored

    assert client.delete(f"/api/library/{VID}").status_code == 204
    assert client.get(f"/api/library/{VID}").status_code == 404
    assert not (media / f"{VID}.mp3").exists()
    assert client.delete(f"/api/library/{VID}").status_code == 404


def test_library_listing_ignores_missing_audio(client, media):
    (media / f"{VID}.json").write_text('{"id": "%s", "title": "Orphan"}' % VID)
    assert client.get("/api/library").json()["tracks"] == []
