import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import yt_dlp
from pydub import AudioSegment

from core.logger import get_logger

logger = get_logger(__name__)

DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


def _find_browser_executable(browser_name: str) -> Optional[str]:
    """
    Find browser executable on Windows by checking common installation paths.
    shutil.which() doesn't work because browsers aren't in PATH on Windows.
    """
    # Define Windows-specific paths for each browser
    browser_paths = {
        "chrome": [
            Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "Google" / "Chrome" / "Application" / "chrome.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "Google" / "Chrome" / "Application" / "chrome.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Google" / "Chrome" / "Application" / "chrome.exe",
        ],
        "edge": [
            Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        ],
        "firefox": [
            Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "Mozilla Firefox" / "firefox.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "Mozilla Firefox" / "firefox.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Mozilla Firefox" / "firefox.exe",
        ],
        "brave": [
            Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe",
        ],
        "opera": [
            Path(os.environ.get("PROGRAMFILES", "C:\\Program Files")) / "Opera" / "opera.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)")) / "Opera" / "opera.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Opera" / "opera.exe",
        ],
    }

    executable = shutil.which(browser_name)
    if executable:
        return executable
    
    # Check each path for this browser
    for path in browser_paths.get(browser_name.lower(), []):
        if path.exists():
            logger.info(f"  Found {browser_name} at: {path}")
            return str(path)
    
    return None


def _build_yt_dlp_options(output_path: str, node_path: str, client: str = "android") -> dict:
    """
    Build yt-dlp options with proper cookie-based authentication.
    
    YouTube now REQUIRES browser cookies (OAuth is deprecated).
    This function extracts cookies from installed browsers automatically.
    """
    cookie_file = os.getenv("YOUTUBE_COOKIES_FILE")
    if cookie_file and not Path(cookie_file).is_file():
        logger.warning("YOUTUBE_COOKIES_FILE does not exist: %s", cookie_file)
        cookie_file = None

    # Try to extract cookies from browsers when no cookie file was supplied.
    # Priority order: Chrome > Edge > Firefox > Brave > Opera
    cookiesfrombrowser = None
    available_browsers = []
    
    # Check which browsers are available using Windows-specific paths
    browser_candidates = [
        ("chrome", "Chrome"),
        ("edge", "Edge"),
        ("firefox", "Firefox"),
        ("brave", "Brave"),
        ("opera", "Opera"),
    ]
    
    for browser_name, display_name in browser_candidates:
        browser_path = _find_browser_executable(browser_name)
        if browser_path:
            available_browsers.append(display_name)
            if cookiesfrombrowser is None:  # Use first found
                cookiesfrombrowser = (browser_name, display_name)
                logger.info(f"  Will extract cookies from {display_name}")
    
    if not cookiesfrombrowser:
        logger.warning("⚠ No browser found for cookie extraction!")
        logger.warning("Checked: Chrome, Edge, Firefox, Brave, Opera")
        logger.warning("YouTube downloads may fail without browser cookies!")
    
    # Enhanced options for YouTube with cookie authentication
    options = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "restrictfilenames": True,
        "noplaylist": True,
        "no_warnings": False,  # Show warnings
        "quiet": False,  # Show output for debugging
        "verbose": False,
        
        # Node.js for signature deciphering
        "js_runtimes": {"node": {"executable": node_path}},
        
        # Client strategy
        "extractor_args": {
            "youtube": {
                "player_client": [client],
                "player_skip": ["webpage", "configs"],
                "skip": ["hls", "dash"],
            }
        },
        
        # Updated headers
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0",
        },
        
        # FFmpeg post-processing
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
        
        # Retry settings
        "retries": 3,
        "fragment_retries": 3,
        "skip_unavailable_fragments": True,
        "ignoreerrors": False,
    }
    
    # Add browser cookies - CRITICAL for YouTube
    if cookie_file:
        options["cookiefile"] = cookie_file
        logger.info("  Using YouTube cookies from %s", cookie_file)
    elif cookiesfrombrowser:
        browser_name, display_name = cookiesfrombrowser
        options["cookiesfrombrowser"] = (browser_name,)
        logger.info(f"  Using cookies from {display_name}")
        logger.warning(f"  IMPORTANT: {display_name} MUST be closed for cookie extraction!")
    else:
        logger.error("✗ NO BROWSER FOUND for cookie extraction!")
        logger.error("  YouTube downloads will likely FAIL without cookies")
        logger.error("  Install Chrome, Edge, or Firefox to enable cookie extraction")
    
    return options


def _export_cookies_to_file(browser: str, dest: str) -> bool:
    """
    Export cookies from a browser profile copy to a Netscape cookies.txt file.
    Copies the profile first so the export works even when the browser is open.
    Returns True if export succeeded.
    """
    import tempfile
    try:
        opts = {
            "quiet": True, "no_warnings": True,
            "cookiesfrombrowser": (browser,),
            "cookiefile": dest,
            "simulate": True,
            "skip_download": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info("https://www.youtube.com/", download=False)
        return Path(dest).is_file() and Path(dest).stat().st_size > 0
    except Exception as e:
        logger.debug(f"[YouTubeDownload] Cookie export from {browser} failed: {e}")
        return False


def _find_wav(ydl: "yt_dlp.YoutubeDL", info: dict) -> Optional[str]:
    """Return the WAV path after a completed download, using stem-glob as fallback."""
    expected = os.path.splitext(ydl.prepare_filename(info))[0] + ".wav"
    if os.path.exists(expected):
        return expected
    stem = Path(ydl.prepare_filename(info)).stem
    for f in Path(DOWNLOAD_DIR).glob(f"{stem}*.wav"):
        if "_chunk_" not in f.name:
            return str(f)
    return None


def _base_ydl_opts(output_path: str) -> dict:
    return {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "restrictfilenames": True,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 60,
        "retries": 3,
        "fragment_retries": 3,
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
        "extractor_args": {"youtube": {"player_client": ["android"]}},
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }],
    }


def download_youtube_audio(url: str) -> str:
    """
    Download audio from a YouTube URL.

    Strategy:
    1. Skip re-download if WAV already exists.
    2. Try with browser cookies (Chrome/Edge/Firefox) — copies profile so
       it works even when the browser is open. Cookies give yt-dlp the PO
       token YouTube now requires for stream delivery.
    3. Try with an explicit YOUTUBE_COOKIES_FILE if set.
    4. Try without any cookies (last resort — often throttled by YouTube).

    Args:
        url: YouTube URL
    Returns:
        Path to downloaded WAV file
    Raises:
        RuntimeError: If all strategies fail.
    """
    logger.info(f"[YouTubeDownload] Starting download: {url}")

    output_path = os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s")
    download_errors: list = []

    # --- STEP 0: skip if WAV already on disk ---
    try:
        probe_opts = {
            "quiet": True, "no_warnings": True, "simulate": True,
            "socket_timeout": 15,
            "outtmpl": output_path,
            "restrictfilenames": True,
            "extractor_args": {"youtube": {"player_client": ["android"]}},
        }
        with yt_dlp.YoutubeDL(probe_opts) as _ydl:
            _info = _ydl.extract_info(url, download=False)
            if _info:
                existing = _find_wav(_ydl, _info)
                if existing:
                    logger.info(f"[YouTubeDownload] WAV already exists, skipping download: {existing}")
                    return existing
    except Exception as _e:
        logger.debug(f"[YouTubeDownload] Pre-check skipped: {_e}")

    import tempfile

    # --- STEP 1: browser cookies (primary path, needed for PO token) ---
    browser_candidates = [
        ("chrome", "Chrome"),
        ("edge", "Edge"),
        ("firefox", "Firefox"),
        ("brave", "Brave"),
    ]

    cookie_file_env = os.getenv("YOUTUBE_COOKIES_FILE")
    if cookie_file_env and not Path(cookie_file_env).is_file():
        logger.warning(f"[YouTubeDownload] YOUTUBE_COOKIES_FILE not found: {cookie_file_env}")
        cookie_file_env = None

    for browser_name, display_name in browser_candidates:
        if not _find_browser_executable(browser_name):
            continue

        logger.info(f"[YouTubeDownload] Trying with {display_name} cookies...")
        tmp_cookie = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tf:
                tmp_cookie = tf.name

            exported = _export_cookies_to_file(browser_name, tmp_cookie)
            if not exported:
                logger.debug(f"[YouTubeDownload] Could not export {display_name} cookies, skipping")
                continue

            opts = _base_ydl_opts(output_path)
            opts["cookiefile"] = tmp_cookie

            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if info:
                    wav = _find_wav(ydl, info)
                    if wav:
                        logger.info(f"[YouTubeDownload] ✅ SUCCESS with {display_name} cookies: {wav}")
                        return wav

        except Exception as e:
            err_str = str(e)
            download_errors.append(f"{display_name}: {err_str[:120]}")
            logger.debug(f"[YouTubeDownload] {display_name} failed: {err_str[:120]}")
            if "private" in err_str.lower() or "members-only" in err_str.lower():
                raise RuntimeError("This video is private or members-only. Please use a public video or upload the file directly.")
        finally:
            if tmp_cookie and Path(tmp_cookie).exists():
                try:
                    Path(tmp_cookie).unlink()
                except Exception:
                    pass

    # --- STEP 2: explicit cookie file ---
    if cookie_file_env:
        logger.info(f"[YouTubeDownload] Trying with YOUTUBE_COOKIES_FILE...")
        try:
            opts = _base_ydl_opts(output_path)
            opts["cookiefile"] = cookie_file_env
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if info:
                    wav = _find_wav(ydl, info)
                    if wav:
                        logger.info(f"[YouTubeDownload] ✅ SUCCESS with cookie file: {wav}")
                        return wav
        except Exception as e:
            download_errors.append(f"cookie file: {str(e)[:120]}")

    # --- STEP 3: no cookies last resort ---
    logger.info(f"[YouTubeDownload] Trying without cookies (last resort)...")
    try:
        opts = _base_ydl_opts(output_path)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info:
                wav = _find_wav(ydl, info)
                if wav:
                    logger.info(f"[YouTubeDownload] ✅ SUCCESS without cookies: {wav}")
                    return wav
    except Exception as e:
        download_errors.append(f"no-cookies: {str(e)[:120]}")

    error_summary = "\n".join(f"  • {e}" for e in download_errors[-5:])
    raise RuntimeError(
        f"YouTube download failed.\n\n"
        f"Errors:\n{error_summary}\n\n"
        f"To fix: make sure Chrome, Edge, or Firefox is installed and you are logged in to YouTube, "
        f"then restart the app and try again.\n"
        f"Alternatively, set YOUTUBE_COOKIES_FILE in .env to a Netscape cookies.txt export, "
        f"or upload the video file directly.\n\nURL: {url}"
    )


def convert_to_wav(input_path: str) -> str:
    """
    Convert any audio/video file to WAV format using FFmpeg directly.
    Handles both audio and video files, extracting audio from video.
    """
    logger.info(f"Converting file to WAV: {input_path}")
    
    input_path_obj = Path(input_path)
    if not input_path_obj.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    # Output path in same directory
    output_path = input_path_obj.parent / f"{input_path_obj.stem}_converted.wav"
    
    try:
        # Use FFmpeg for robust conversion
        # Extract audio, convert to mono, 16kHz sample rate
        command = [
            "ffmpeg",
            "-i", str(input_path),
            "-vn",  # No video
            "-acodec", "pcm_s16le",  # PCM 16-bit
            "-ar", "16000",  # 16kHz sample rate
            "-ac", "1",  # Mono
            "-y",  # Overwrite output
            str(output_path)
        ]
        
        logger.info(f"Running FFmpeg: {' '.join(command)}")
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise RuntimeError(f"FFmpeg conversion failed: {result.stderr}")
        
        if not output_path.exists():
            raise RuntimeError("FFmpeg conversion completed but output file not found")
        
        logger.info(f"Conversion successful: {output_path}")
        return str(output_path)
        
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg conversion timed out")
        raise RuntimeError("File conversion timed out (maximum 5 minutes)")
    except FileNotFoundError:
        logger.error("FFmpeg not found in PATH")
        raise RuntimeError(
            "FFmpeg not installed. Please install FFmpeg and ensure it's in your PATH. "
            "Windows: Download from https://ffmpeg.org/download.html"
        )
    except Exception as e:
        logger.error(f"Conversion failed: {str(e)}", exc_info=True)
        raise RuntimeError(f"Failed to convert file: {str(e)}")

def get_audio_duration_seconds(file_path: str) -> float:
    """Fast audio duration check using file size for 16kHz 16-bit mono WAV or ffprobe."""
    try:
        # For 16kHz mono 16-bit PCM WAV: 32000 bytes/sec
        if file_path.lower().endswith(".wav"):
            size = os.path.getsize(file_path)
            # 44 byte header
            pcm_bytes = max(0, size - 44)
            return pcm_bytes / 32000.0
    except Exception:
        pass
    return 0.0


def chunk_audio(wav_path: str, chunk_minutes: int = 25) -> list:
    """
    Split audio file into chunks of specified duration only if necessary.
    Faster-whisper and modern STT engines prefer continuous files up to 30+ minutes.
    
    Args:
        wav_path: Path to WAV file
        chunk_minutes: Duration of each chunk in minutes (default: 25)
        
    Returns:
        List of chunk file paths
    """
    # Check estimated duration
    duration_sec = get_audio_duration_seconds(wav_path)
    max_chunk_sec = chunk_minutes * 60

    # If audio is under chunk threshold (e.g. 25-30 minutes), do NOT chunk!
    if duration_sec > 0 and duration_sec <= max_chunk_sec:
        logger.info(f"Audio duration is {duration_sec/60:.1f} mins (<= {chunk_minutes} mins). Processing as single stream (no chunking needed).")
        return [wav_path]

    logger.info(f"Chunking long audio: {wav_path} ({chunk_minutes} min chunks)")
    
    try:
        audio = AudioSegment.from_wav(wav_path)
        chunk_ms = chunk_minutes * 60 * 1000
        
        if len(audio) <= chunk_ms:
            return [wav_path]
            
        chunks = []
        total_duration = len(audio) / 1000 / 60  # minutes
        logger.info(f"Audio duration: {total_duration:.2f} minutes")
        
        for i, start in enumerate(range(0, len(audio), chunk_ms)):
            chunk = audio[start: start + chunk_ms]
            chunk_path = f"{wav_path}_chunk_{i}.wav"
            chunk.export(chunk_path, format="wav")
            chunks.append(chunk_path)
            chunk_duration = len(chunk) / 1000 / 60
            logger.info(f"Created chunk {i + 1}: {chunk_duration:.2f} minutes")
        
        logger.info(f"Created {len(chunks)} chunk(s)")
        return chunks
    except Exception as e:
        logger.warning(f"Audio chunking encountered error: {e}. Falling back to single file.")
        return [wav_path]

def process_input(source: str) -> list:
    """
    Unified media processing pipeline.
    Handles YouTube URLs, local audio files, and local video files.
    
    Args:
        source: YouTube URL or local file path
        
    Returns:
        List of audio chunk file paths
    """
    logger.info(f"Processing input: {source}")
    
    # Determine source type and process accordingly
    if source.startswith("http://") or source.startswith("https://"):
        logger.info("Detected YouTube URL - downloading audio...")
        wav_path = download_youtube_audio(source)
    else:
        logger.info("Detected local file - converting to WAV...")
        
        # Check if file exists
        if not Path(source).exists():
            raise FileNotFoundError(f"File not found: {source}")
        
        # Convert to WAV (works for both audio and video)
        wav_path = convert_to_wav(source)
    
    chunks = chunk_audio(wav_path, chunk_minutes=25)
    logger.info(f"  Audio processing complete - {len(chunks)} chunk(s) prepared")
    return chunks

