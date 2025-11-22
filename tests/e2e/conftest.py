import pytest
from playwright.sync_api import Page, expect
import time
import subprocess
import os
import signal
import sys
import socket

# Helper to find a free port
def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

@pytest.fixture(scope="session")
def app_server():
    port = get_free_port()
    # Start the http server
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=".",  # Root of the repo
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # Wait a bit for it to start
    time.sleep(1)

    yield f"http://localhost:{port}"

    # Teardown
    process.terminate()
    process.wait()

@pytest.fixture
def app(page: Page, app_server):
    page.goto(app_server)
    # Mock Geolocation to Buenos Aires Obelisco
    page.context.grant_permissions(["geolocation"])
    page.context.set_geolocation({"latitude": -34.6037, "longitude": -58.3816})
    return page
