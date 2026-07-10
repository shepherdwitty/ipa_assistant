#!/usr/bin/env python3
"""Upload local release artifacts to an existing GitHub Release."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OWNER = "shepherdwitty"
REPO = "ipa_assistant"
RELEASE_ID = int(os.environ.get("RELEASE_ID", "351925789"))
ROOT = Path(__file__).resolve().parents[1]
RELEASE_DIR = ROOT / "release"
FILES = [
    "音标小助手-0.1.0-mac-arm64.dmg",
    "音标小助手-0.1.0-mac-arm64.zip",
    "音标小助手-0.1.0-mac-x64.dmg",
    "音标小助手-0.1.0-mac-x64.zip",
]


def get_token() -> str:
    env = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if env:
        return env.strip()
    proc = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        text=True,
        capture_output=True,
        check=True,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    raise SystemExit("No GitHub token found (set GITHUB_TOKEN or git credential)")


def upload(token: str, path: Path) -> None:
    name = path.name
    q = urllib.parse.urlencode({"name": name})
    url = f"https://uploads.github.com/repos/{OWNER}/{REPO}/releases/{RELEASE_ID}/assets?{q}"
    data = path.read_bytes()
    ctype = "application/zip" if name.endswith(".zip") else "application/octet-stream"
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": ctype,
            "Content-Length": str(len(data)),
            "User-Agent": "ipa-assistant-release-upload",
        },
    )
    print(f"==> uploading {name} ({len(data) / 1024 / 1024:.1f} MB)")
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = json.loads(resp.read().decode())
            print(f"    OK {body.get('browser_download_url')}")
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"    FAIL HTTP {e.code}: {err[:500]}", file=sys.stderr)
        raise SystemExit(1) from e


def main() -> None:
    token = get_token()
    for name in FILES:
        path = RELEASE_DIR / name
        if not path.is_file():
            print(f"missing: {path}", file=sys.stderr)
            raise SystemExit(1)
        upload(token, path)
    print("all assets uploaded")


if __name__ == "__main__":
    main()
