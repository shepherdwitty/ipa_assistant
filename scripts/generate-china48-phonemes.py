#!/usr/bin/env python3
"""
Generate a unified China-48 English IPA phoneme audio pack.

Target inventory: 中国英语教学常用 48 个国际音标（DJ / 英式教学）
  - 12 monophthongs + 8 diphthongs + 28 consonants

Voice: Microsoft Edge neural TTS en-GB-SoniaNeural（统一女声 RP）
Style: 中国音标教学习惯
  - 元音 / 双元音：尽量发纯音
  - 辅音：带轻微释放元音（puh/buh…），便于儿童辨认

Requires: edge-tts, ffmpeg
Usage:
  python3 scripts/generate-china48-phonemes.py
  # or with venv that has edge-tts:
  /path/to/venv/bin/python scripts/generate-china48-phonemes.py
"""

from __future__ import annotations

import asyncio
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("Please install edge-tts: pip install edge-tts", file=sys.stderr)
    sys.exit(1)

# ---------- config ----------
VOICE = "en-GB-SoniaNeural"
RATE = "-12%"  # slightly slower for kids / clarity
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "phonemes"
BACKUP_DIR = OUT_DIR / "_backup_old_wikimedia"

# (ipa_symbol, ascii_filename_stem, tts_prompt)
# prompts tuned for en-GB-SoniaNeural to approximate each target sound
CHINA_48: list[tuple[str, str, str]] = [
    # ===== 12 monophthongs =====
    ("iː", "i", "eee"),
    ("ɪ", "small_cap_i", "ih"),
    ("e", "e", "eh"),
    ("æ", "ae", "æ"),  # IPA letter often read as target /æ/
    ("ɑː", "aa", "ahh"),
    ("ɒ", "oopen", "o"),  # British short o
    ("ɔː", "openo", "aw"),
    ("ʊ", "upsilon", "uuh"),  # short back rounded, avoid full word "book"
    ("uː", "u", "ooo"),
    ("ʌ", "strut", "uh"),
    ("ɜː", "rev_epsilon", "err"),
    ("ə", "schwa", "uhm"),  # weak central — closer than full "the"
    # ===== 8 diphthongs =====
    ("eɪ", "ei", "ay"),
    ("aɪ", "ai", "eye"),
    ("ɔɪ", "oi", "oy"),
    ("əʊ", "ou", "oh"),
    ("aʊ", "au", "ow"),
    ("ɪə", "ia", "ear"),
    ("eə", "ea", "air"),
    ("ʊə", "ua", "oor"),
    # ===== 28 consonants (China textbook set) =====
    # plosives
    ("p", "p", "puh"),
    ("b", "b", "buh"),
    ("t", "t", "tuh"),
    ("d", "d", "duh"),
    ("k", "k", "kuh"),
    ("ɡ", "g", "guh"),
    # fricatives
    ("f", "f", "fff"),
    ("v", "v", "vvv"),
    ("θ", "th", "thuh"),
    ("ð", "dh", "dhuh"),  # voiced th + light release
    ("s", "s", "sss"),
    ("z", "z", "zzz"),
    ("ʃ", "sh", "shh"),
    ("ʒ", "zh", "zhuh"),
    ("h", "h", "huh"),
    # affricates + China-extra
    # 注意：macOS 默认大小写不敏感，不可用 tS/ts、dZ/dz 这种仅大小写不同的文件名
    ("tʃ", "ch", "chuh"),
    ("dʒ", "jh", "juh"),
    ("ts", "ts", "ts"),
    ("dz", "dz", "dz"),
    ("tr", "tr", "truh"),
    ("dr", "dr", "druh"),
    # nasals / liquids / glides
    ("m", "m", "mmm"),
    ("n", "n", "nnn"),
    ("ŋ", "ng", "nguh"),
    ("l", "l", "lll"),
    ("r", "r", "rrr"),  # teaching /r/ ≈ British ɹ
    ("j", "j", "yuh"),
    ("w", "w", "wuh"),
]

# Extra aliases used by the app (same file as primary)
ALIASES: dict[str, str] = {
    # long/short sharing where teaching uses one clip
    "i": "i",
    "ɑ": "aa",
    "ɔ": "openo",
    "u": "u",
    "ɜ": "rev_epsilon",
    "ɛ": "e",  # open e → same as e for teaching
    "o": "ou",  # rare
    "a": "aa",
    "eː": "e",
    "oʊ": "ou",  # AmE spelling of əʊ
    "g": "g",
    "ɹ": "r",
}


def require_ffmpeg() -> None:
    if not shutil.which("ffmpeg"):
        print("ffmpeg is required on PATH", file=sys.stderr)
        sys.exit(1)


def postprocess(src: Path, dest: Path) -> None:
    """Trim silence, loudnorm, mono 44.1kHz mp3."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-af",
        (
            "silenceremove=start_periods=1:start_duration=0.02:start_threshold=-40dB:"
            "stop_periods=1:stop_duration=0.15:stop_threshold=-40dB,"
            "loudnorm=I=-16:TP=-1.5:LRA=11"
        ),
        "-ar",
        "44100",
        "-ac",
        "1",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "128k",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


async def synthesize_one(text: str, raw_path: Path) -> None:
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(raw_path))


async def generate_all() -> None:
    require_ffmpeg()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # backup existing mp3 once
    existing = list(OUT_DIR.glob("*.mp3"))
    if existing and not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        for f in existing:
            if f.name.startswith("_"):
                continue
            shutil.copy2(f, BACKUP_DIR / f.name)
        print(f"Backed up {len(list(BACKUP_DIR.glob('*.mp3')))} files → {BACKUP_DIR}")

    with tempfile.TemporaryDirectory(prefix="china48-") as tmp:
        tmp_path = Path(tmp)
        for ipa, stem, prompt in CHINA_48:
            raw = tmp_path / f"{stem}.raw.mp3"
            final = OUT_DIR / f"{stem}.mp3"
            print(f"  /{ipa}/  ← “{prompt}”  →  {final.name}")
            try:
                await synthesize_one(prompt, raw)
                postprocess(raw, final)
            except Exception as e:
                print(f"  FAILED {ipa}: {e}", file=sys.stderr)
                raise
            await asyncio.sleep(0.15)  # be gentle to the service

    print(f"\nGenerated {len(CHINA_48)} phoneme clips in {OUT_DIR}")
    print(f"Voice: {VOICE}  rate: {RATE}")


def main() -> None:
    print("China-48 IPA phoneme pack generator")
    print(f"Output: {OUT_DIR}")
    asyncio.run(generate_all())


if __name__ == "__main__":
    main()
