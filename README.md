# Here are your Instructions

## Tonal music player

- **Backend** (`backend/`): FastAPI. `music.py` handles YouTube search and MP3 downloads (yt-dlp + ffmpeg) and the local library. Files are stored in `backend/media/` (git-ignored) and can be moved with `MEDIA_DIR`.
- **Frontend** (`frontend/`): React. Calls `/api`, and the dev server proxies it to the backend (`src/setupProxy.js`).
- Design notes: `DESIGN.md`.

Run it:

```
pip install -r backend/requirements.txt
cd backend && uvicorn server:app --port 8001
cd frontend && yarn install && yarn start
```

ffmpeg is taken from `FFMPEG_LOCATION`, then from PATH, then from the `imageio-ffmpeg` package. Node.js on PATH is used as yt-dlp's JavaScript runtime when available.

Only download content you have the right to use. Downloading from YouTube may breach its terms unless the content is licensed for it.

Tests: `python -m pytest tests/` (YouTube is never contacted; yt-dlp is faked).
