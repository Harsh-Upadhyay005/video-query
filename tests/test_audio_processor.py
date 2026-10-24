import os
import base64

import yt_dlp

from utils.audio_processor import _prepare_cookie_file, download_youtube_audio


class FakeYoutubeDL:
    def __init__(self, opts):
        self.opts = opts

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def extract_info(self, url, download):
        assert os.path.basename(self.opts["js_runtimes"]["node"]["executable"]).lower() in {"node", "node.exe"}
        youtube_args = self.opts["extractor_args"]["youtube"]
        assert youtube_args["player_client"] in [["web"], ["android"], ["ios"]]
        if "player_skip" in youtube_args:
            assert youtube_args["player_skip"] == ["webpage", "configs"]
            os.makedirs("downloads", exist_ok=True)
            open(os.path.join("downloads", "demo.wav"), "a").close()
        return {"title": "demo", "ext": "mp4"}

    def prepare_filename(self, info):
        return os.path.join("downloads", "demo.mp4")


def test_download_youtube_audio_uses_node_runtime(monkeypatch):
    monkeypatch.setattr(yt_dlp, "YoutubeDL", FakeYoutubeDL)

    result = download_youtube_audio("https://youtu.be/dQw4w9WgXcQ")

    assert result == os.path.join("downloads", "demo.wav")


def test_prepare_cookie_file_supports_base64_utf8_export(monkeypatch, tmp_path):
    cookie_contents = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue\n"
    monkeypatch.setenv(
        "YOUTUBE_COOKIES_BASE64",
        base64.b64encode(cookie_contents.encode("utf-8")).decode("ascii"),
    )

    cookie_path, temporary_path = _prepare_cookie_file()

    assert cookie_path == temporary_path
    assert open(cookie_path, encoding="utf-8").read() == cookie_contents
    os.unlink(temporary_path)


def test_prepare_cookie_file_rejects_non_utf8_file(monkeypatch, tmp_path):
    cookie_path = tmp_path / "cookies.txt"
    cookie_path.write_bytes(b"# Netscape HTTP Cookie File\n\xe3")
    monkeypatch.setenv("YOUTUBE_COOKIES_FILE", str(cookie_path))

    try:
        _prepare_cookie_file()
    except RuntimeError as exc:
        assert "not valid UTF-8" in str(exc)
    else:
        raise AssertionError("Expected invalid cookie encoding to be rejected")
