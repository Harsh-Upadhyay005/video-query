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


def download_youtube_audio(url: str) -> str:
    """
    Download audio from YouTube URL with robust fallback strategies.
    
    Strategy:
    1. Try without cookies (works for most public videos)
    2. If authentication needed, try with browser cookies
    3. Handle browser lock gracefully
    
    Args:
        url: YouTube URL
        
    Returns:
        Path to downloaded WAV file
        
    Raises:
        RuntimeError: If all download strategies fail with clear error message
    """
    logger.info(f"[YouTubeDownload] Starting download: {url}")

    output_path = os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s")
    last_error = None
    download_errors = []
    cookie_file = os.getenv("YOUTUBE_COOKIES_FILE")
    if cookie_file and not Path(cookie_file).is_file():
        download_errors.append(f"Configured cookie file not found: {cookie_file}")
        cookie_file = None
    
    # STRATEGY 1: Try WITHOUT cookies first (works for most public videos)
    logger.info("[YouTubeDownload] Strategy 1: Attempting download without cookies...")
    
    client_strategies = [
        ("android", "Android client"),
        ("ios", "iOS client"),
        ("web", "Web client"),
    ]
    
    for client, description in client_strategies:
        try:
            logger.info(f"[YouTubeDownload]   Trying {description} (no cookies)...")
            
            # Build options WITHOUT cookies
            options = {
                "format": "bestaudio/best",
                "outtmpl": output_path,
                "restrictfilenames": True,
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": [client],
                    }
                },
                "http_headers": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "192",
                }],
                "retries": 2,
                "fragment_retries": 2,
            }
            if cookie_file:
                options["cookiefile"] = cookie_file
            
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(url, download=True)
                if info:
                    filename = os.path.splitext(ydl.prepare_filename(info))[0] + ".wav"
                    if os.path.exists(filename):
                        logger.info(f"[YouTubeDownload] ✅ SUCCESS (no cookies needed): {filename}")
                        return filename
                    
        except Exception as e:
            error_str = str(e).lower()
            download_errors.append(f"{description} (no cookies): {str(e)[:100]}")
            
            # Check if authentication is actually required
            needs_auth = any(keyword in error_str for keyword in [
                "sign in",
                "login",
                "authenticate",
                "private",
                "members-only",
                "premium"
            ])
            
            if needs_auth:
                logger.info(f"[YouTubeDownload]   Authentication required, will try cookies")
                break  # Move to cookie strategy
            else:
                logger.debug(f"[YouTubeDownload]   Failed: {str(e)[:100]}")
                last_error = e
                continue
    
    # STRATEGY 2: Try WITH browser cookies if strategy 1 failed
    logger.info("[YouTubeDownload] Strategy 2: Attempting download with browser cookies...")
    
    # Find available browsers or use an explicitly supplied cookie file.
    available_browsers = []
    browser_candidates = [
        ("edge", "Edge"),       # Try Edge first (usually not running)
        ("firefox", "Firefox"), # Then Firefox
        ("chrome", "Chrome"),   # Chrome last (often running)
        ("brave", "Brave"),
    ]
    
    for browser_name, display_name in browser_candidates:
        if _find_browser_executable(browser_name):
            available_browsers.append((browser_name, display_name))
            logger.info(f"[YouTubeDownload]   Found browser: {display_name}")
    
    if not available_browsers and not cookie_file:
        # No browsers found - return clear error
        error_msg = (
            "YouTube download failed and no browsers are available for authentication.\n\n"
            "The video may require login. To fix:\n"
            "1. Install Chrome, Edge, or Firefox and login to YouTube\n"
            "2. Close the browser and try the download again\n"
            "   (or set YOUTUBE_COOKIES_FILE to a Netscape cookies.txt file)\n\n"
            "Alternatively: Download the video manually and upload the file."
        )
        logger.error(f"[YouTubeDownload] {error_msg}")
        if download_errors:
            logger.error(f"[YouTubeDownload] Previous errors: {'; '.join(download_errors)}")
        raise RuntimeError(error_msg)
    
    cookie_sources = [(None, "cookie file")] if cookie_file else available_browsers

    # Try each configured cookie source.
    for browser_name, display_name in cookie_sources:
        try:
            logger.info(f"[YouTubeDownload]   Trying with {display_name} cookies...")
            
            # Build options WITH cookies
            options = {
                "format": "bestaudio/best",
                "outtmpl": output_path,
                "restrictfilenames": True,
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["android"],
                    }
                },
                "http_headers": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "192",
                }],
                "retries": 2,
                "fragment_retries": 2,
            }
            if cookie_file:
                options["cookiefile"] = cookie_file
            else:
                options["cookiesfrombrowser"] = (browser_name,)
            
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(url, download=True)
                if info:
                    filename = os.path.splitext(ydl.prepare_filename(info))[0] + ".wav"
                    if os.path.exists(filename):
                        logger.info(f"[YouTubeDownload] ✅ SUCCESS (with {display_name} cookies): {filename}")
                        return filename
                        
        except Exception as e:
            error_str = str(e).lower()
            download_errors.append(f"{display_name} cookies: {str(e)[:100]}")
            last_error = e
            
            # Check for browser lock error
            if "could not copy" in error_str and "cookie" in error_str:
                logger.warning(
                    f"[YouTubeDownload]   {display_name} is running (cookies locked). "
                    "Trying next browser..."
                )
                continue
            
            # Check for other specific errors
            if "private" in error_str or "members-only" in error_str:
                raise RuntimeError(
                    "This video is private or members-only and cannot be accessed. "
                    "Please use a public video or upload the file directly."
                )
            
            logger.debug(f"[YouTubeDownload]   Failed with {display_name}: {str(e)[:100]}")
            continue
    
    # All strategies failed - provide helpful error message
    error_summary = "\n".join(f"  • {err}" for err in download_errors[-5:])  # Last 5 errors
    
    browser_list = ", ".join(name for _, name in available_browsers) or "none"
    
    error_msg = (
        f"YouTube download failed after trying multiple strategies.\n\n"
        f"Attempted:\n"
        f"1. Download without authentication  \n"
        f"2. Download with browser cookies ({browser_list})  \n\n"
        f"Recent errors:\n{error_summary}\n\n"
        f"Possible solutions:\n"
        f"1. If browsers are running: Close ALL browser windows and try again\n"
        f"2. Login to YouTube in Edge/Firefox (usually easier than Chrome)\n"
        f"3. Try a different YouTube video (this one may be restricted)\n"
        f"4. Download the video manually and upload the MP3/MP4 file\n\n"
        f"Video URL: {url}"
    )
    
    logger.error(f"[YouTubeDownload] All strategies failed")
    logger.error(error_msg)
    
    raise RuntimeError(error_msg)


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

