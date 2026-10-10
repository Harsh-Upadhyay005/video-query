from dotenv import load_dotenv
load_dotenv(".env")
import yt_dlp, os, shutil

out = open("_diag_result.txt", "w", buffering=1)
def log(msg): out.write(str(msg) + "\n"); out.flush()

url = "https://www.youtube.com/watch?v=VSFuqMh4hus"
DOWNLOAD_DIR = "downloads"

log("=== Testing actual download with android client ===")
log("socket_timeout=30, retries=1")

options = {
    "format": "bestaudio[ext=m4a]/bestaudio/best",
    "outtmpl": os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s"),
    "restrictfilenames": True,
    "noplaylist": True,
    "quiet": False,
    "no_warnings": False,
    "extractor_args": {"youtube": {"player_client": ["android"]}},
    "http_headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    },
    "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "wav",
        "preferredquality": "192",
    }],
    "socket_timeout": 30,
    "retries": 1,
    "fragment_retries": 1,
    "progress_hooks": [lambda d: log("progress: " + d.get("status","?") + " " + str(d.get("downloaded_bytes","")) + "/" + str(d.get("total_bytes","?")))]
}

try:
    with yt_dlp.YoutubeDL(options) as ydl:
        log("calling extract_info...")
        info = ydl.extract_info(url, download=True)
        log("extract_info returned")
        if info:
            wav = os.path.splitext(ydl.prepare_filename(info))[0] + ".wav"
            log("expected wav: " + wav)
            log("wav exists: " + str(os.path.exists(wav)))
        else:
            log("info is falsy: " + repr(info))
except Exception as e:
    log("EXCEPTION: " + type(e).__name__ + ": " + repr(e)[:400])

out.close()
print("done")
