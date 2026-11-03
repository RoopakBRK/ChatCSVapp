import socket

import httpx
import pytest

from chatapp import remote
from chatapp.remote import RemoteFileError, check_public, direct_link, fetch_csv


def resolver(table: dict[str, str]):
    """Fake DNS: host -> IP."""
    def resolve(host, port, proto=0):
        if host not in table:
            raise socket.gaierror("unknown")
        return [(socket.AF_INET, socket.SOCK_STREAM, proto, "", (table[host], port))]
    return resolve


PUBLIC = resolver({"data.example.com": "93.184.216.34", "evil.example.com": "10.0.0.5",
                   "meta.example.com": "169.254.169.254", "local.example.com": "127.0.0.1"})


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)


def test_share_links_become_direct_downloads():
    assert direct_link("https://docs.google.com/spreadsheets/d/abc_123/edit#gid=42") == \
        "https://docs.google.com/spreadsheets/d/abc_123/export?format=csv&gid=42"
    assert direct_link("https://drive.google.com/file/d/XYZ-9/view?usp=sharing") == \
        "https://drive.google.com/uc?export=download&id=XYZ-9"
    assert direct_link("https://drive.google.com/open?id=QQ") == "https://drive.google.com/uc?export=download&id=QQ"
    assert direct_link("https://github.com/a/b/blob/main/data/x.csv") == "https://raw.githubusercontent.com/a/b/main/data/x.csv"
    assert direct_link("https://www.dropbox.com/s/k/x.csv?dl=0") == "https://www.dropbox.com/s/k/x.csv?dl=1"
    assert direct_link("https://data.example.com/x.csv") == "https://data.example.com/x.csv"


@pytest.mark.parametrize("url", [
    "http://evil.example.com/x.csv",       # private 10.x
    "http://meta.example.com/latest",      # cloud metadata, link-local
    "http://local.example.com/x.csv",      # loopback
    "http://127.0.0.1/x.csv",
    "http://[::1]/x.csv",
    "ftp://data.example.com/x.csv",
    "file:///etc/passwd",
    "http://nowhere.example.com/x.csv",    # does not resolve
])
def test_non_public_or_odd_links_are_refused(url):
    resolve = PUBLIC if "example.com" in url else socket.getaddrinfo
    with pytest.raises(RemoteFileError):
        check_public(url, resolve)


def test_fetches_a_csv_and_names_it():
    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/csv",
                                            "content-disposition": 'attachment; filename="Sales Q1.csv"'}, content=b"a,b\n1,2\n")
    name, data = fetch_csv("https://data.example.com/download?id=1", client(handler), PUBLIC)
    assert (name, data) == ("Sales Q1.csv", b"a,b\n1,2\n")


def test_name_falls_back_to_the_path_and_gets_csv_extension():
    handler = lambda request: httpx.Response(200, headers={"content-type": "text/plain"}, content=b"a\n1\n")
    assert fetch_csv("https://data.example.com/files/report", client(handler), PUBLIC)[0] == "report.csv"


def test_a_redirect_to_a_private_address_is_blocked():
    def handler(request):
        if request.url.host == "data.example.com":
            return httpx.Response(302, headers={"location": "http://evil.example.com/secret.csv"})
        raise AssertionError("must never connect to the private host")
    with pytest.raises(RemoteFileError, match="private or local"):
        fetch_csv("https://data.example.com/x.csv", client(handler), PUBLIC)


def test_too_many_redirects():
    handler = lambda request: httpx.Response(302, headers={"location": "https://data.example.com/again"})
    with pytest.raises(RemoteFileError, match="too many"):
        fetch_csv("https://data.example.com/x.csv", client(handler), PUBLIC)


def test_html_pages_and_private_files_explain_what_to_do():
    html = lambda request: httpx.Response(200, headers={"content-type": "text/html"}, content=b"<html>")
    with pytest.raises(RemoteFileError, match="Anyone with the link"):
        fetch_csv("https://data.example.com/x.csv", client(html), PUBLIC)
    forbidden = lambda request: httpx.Response(403)
    with pytest.raises(RemoteFileError, match="isn't public"):
        fetch_csv("https://data.example.com/x.csv", client(forbidden), PUBLIC)


def test_size_cap_is_enforced_while_streaming(monkeypatch):
    monkeypatch.setattr(remote, "MAX_BYTES", 10)
    big = lambda request: httpx.Response(200, headers={"content-type": "text/csv"}, content=b"x" * 50)
    with pytest.raises(RemoteFileError, match="larger than 50 MB"):
        fetch_csv("https://data.example.com/x.csv", client(big), PUBLIC)
