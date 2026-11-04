"""Fetch a CSV from a link: a direct URL, or a share link from Google Drive / Sheets, Dropbox or GitHub.

The server fetches the URL itself, so it must never be usable to reach internal machines (SSRF):
  * only http and https;
  * the host must resolve to public addresses only (no localhost, private, link-local, cloud
    metadata or reserved ranges), checked again on every redirect, which is followed by hand;
  * at most 3 redirects, a timeout (LINK_FETCH_TIMEOUT_SECONDS) and the upload size cap
    (MAX_UPLOAD_MB), enforced while streaming the file to disk in chunks.

Residual risk (production note): the check resolves the name, then httpx resolves it again when
connecting, so a hostile DNS server could answer differently the second time (DNS rebinding). In
production, run fetches through an egress proxy that enforces the same rules, or pin the checked IP.
"""
import ipaddress
import re
import socket
from pathlib import Path, PurePath
from typing import Callable
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import httpx

from chatapp.config import settings

MAX_REDIRECTS = 3

Resolver = Callable[..., list]


class RemoteFileError(Exception):
    """Raised with a message that can be shown to the user as is."""


def direct_link(url: str) -> str:
    """Turn common share links into links that download the file itself."""
    url = url.strip()
    if m := re.match(r"https://docs\.google\.com/spreadsheets/d/([\w-]+)", url):
        gid = parse_qs(urlparse(url).query).get("gid") or re.findall(r"[#&?]gid=(\d+)", url)
        return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv" + (f"&gid={gid[0]}" if gid else "")
    if m := re.match(r"https://drive\.google\.com/file/d/([\w-]+)", url):
        return f"https://drive.google.com/uc?export=download&id={m.group(1)}"
    if url.startswith("https://drive.google.com/") and (ids := parse_qs(urlparse(url).query).get("id")):
        return f"https://drive.google.com/uc?export=download&id={ids[0]}"
    if m := re.match(r"https://github\.com/([^/]+)/([^/]+)/blob/(.+)", url):
        return f"https://raw.githubusercontent.com/{m.group(1)}/{m.group(2)}/{m.group(3)}"
    if re.match(r"https://(www\.)?dropbox\.com/", url):
        return re.sub(r"([?&])dl=0", r"\1dl=1", url) if "dl=0" in url else url + ("&" if "?" in url else "?") + "dl=1"
    return url


def check_public(url: str, resolve: Resolver = socket.getaddrinfo) -> None:
    """Refuse anything that isn't http(s) to a public internet address."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise RemoteFileError("Only http and https links can be used.")
    try:
        infos = resolve(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError):
        raise RemoteFileError("That link's address could not be found.") from None
    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise RemoteFileError("That link's address could not be found.")
    for address in addresses:
        ip = ipaddress.ip_address(address.split("%")[0])
        if not ip.is_global or ip.is_multicast:
            raise RemoteFileError("Links to private or local network addresses are not allowed.")


def _filename(response: httpx.Response, url: str) -> str:
    disposition = response.headers.get("content-disposition", "")
    name = ""
    if m := re.search(r"filename\*\s*=\s*[^']*''([^;]+)", disposition):
        name = unquote(m.group(1))
    elif m := re.search(r'filename\s*=\s*"?([^";]+)"?', disposition):
        name = m.group(1)
    if not name:
        name = unquote(PurePath(urlparse(url).path).name)
    name = PurePath(name.replace("\\", "/")).name.strip()[:120] or "download"
    if name in ("export", "uc"):
        name = "download"
    return name if name.lower().endswith(".csv") else f"{name}.csv"


def fetch_csv(url: str, dest: Path, client: httpx.Client | None = None, resolve: Resolver = socket.getaddrinfo) -> str:
    """Download the file behind a link into `dest`, chunk by chunk. Returns the file name to use."""
    url = direct_link(url)
    limit = settings.max_upload_bytes
    too_big = f"That file is larger than {settings.max_upload_mb:g} MB."
    own = client is None
    http = client or httpx.Client(timeout=settings.link_fetch_timeout_seconds, follow_redirects=False, headers={"User-Agent": "CSVChat/1.0"})
    try:
        for _ in range(MAX_REDIRECTS + 1):
            check_public(url, resolve)
            try:
                with http.stream("GET", url) as response:
                    if response.is_redirect:
                        url = urljoin(url, response.headers.get("location", ""))
                        continue
                    if response.status_code in (401, 403):
                        raise RemoteFileError(
                            "That file isn't public. Share it as 'Anyone with the link' and try again.")
                    if response.status_code != 200:
                        raise RemoteFileError(f"The link answered with an error (HTTP {response.status_code}).")
                    if "text/html" in response.headers.get("content-type", ""):
                        raise RemoteFileError(
                            "That link opens a web page, not a CSV file. For Google Drive or Sheets, "
                            "share it as 'Anyone with the link'.")
                    if int(response.headers.get("content-length") or 0) > limit:
                        raise RemoteFileError(too_big)
                    size = 0
                    with dest.open("wb") as out:
                        for chunk in response.iter_bytes():
                            size += len(chunk)
                            if size > limit:
                                raise RemoteFileError(too_big)
                            out.write(chunk)
                    return _filename(response, url)
            except httpx.TimeoutException:
                raise RemoteFileError("The link took too long to respond.") from None
            except httpx.HTTPError:
                raise RemoteFileError("The file could not be downloaded from that link.") from None
        raise RemoteFileError("That link redirected too many times.")
    finally:
        if own:
            http.close()
