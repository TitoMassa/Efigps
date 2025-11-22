from playwright.sync_api import Page, expect

def test_load_app(app: Page):
    """Verify that the application loads and displays the main title."""
    expect(app).to_have_title("Efigps - Control de Flota")
    # Check for clock to ensure JS ran
    expect(app.locator("#clock")).not_to_have_text("--:--:--", timeout=5000)

def test_create_route_and_save(app: Page):
    """
    Test scenario:
    1. Open Route Editor.
    2. Add stops on map.
    3. Set times.
    4. Save route.
    5. Verify route is saved and selected.
    """

    # Open Editor
    app.locator("#btn-route-editor").click()
    expect(app.locator("#editor-modal")).to_be_visible()

    # Add stops by clicking on the editor map
    editor_map = app.locator("#editor-map")

    # Wait for map to be ready (leaflet init)
    app.wait_for_timeout(2000)

    # Click 1: Start (Use y=50 to avoid clicking bottom edge)
    editor_map.click(position={"x": 100, "y": 50}, force=True)

    # Small wait to ensure processing
    app.wait_for_timeout(500)

    # Click 2: End
    editor_map.click(position={"x": 200, "y": 50}, force=True)

    # Verify stops list has 2 items
    expect(app.locator(".stop-item")).to_have_count(2, timeout=5000)

    # Set Route Name
    app.locator("#route-name-input").fill("Test Route 1")

    # Set Times
    inputs = app.locator("#stops-list input[type='time']")
    inputs.nth(0).fill("10:00")
    inputs.nth(1).fill("10:30")

    # Handle dialog
    app.on("dialog", lambda d: d.accept())

    app.locator("#btn-save-route").click()

    # Modal should close
    expect(app.locator("#editor-modal")).to_be_hidden()

    # Verify Route Name in Display
    expect(app.locator("#route-name")).to_have_text("Test Route 1")

def test_simulation_deviation(app: Page):
    """
    Test scenario:
    1. Create a route.
    2. Start Simulation.
    3. Check if deviation updates.
    """

    # --- Setup Route ---
    app.locator("#btn-route-editor").click()
    app.wait_for_timeout(2000)
    editor_map = app.locator("#editor-map")
    editor_map.click(position={"x": 100, "y": 50}, force=True)
    app.wait_for_timeout(500)
    editor_map.click(position={"x": 300, "y": 50}, force=True)

    app.locator("#route-name-input").fill("Sim Route")
    inputs = app.locator("#stops-list input[type='time']")
    inputs.nth(0).fill("12:00")
    inputs.nth(1).fill("12:10")

    app.on("dialog", lambda d: d.accept())
    app.locator("#btn-save-route").click()

    # --- Start Simulation ---
    app.locator("#btn-start-sim").click()

    # Check status
    expect(app.locator("#sim-status")).to_have_text("Simulando...")

    # Move slider manually
    app.locator("#sim-slider").fill("50")
    app.locator("#sim-slider").dispatch_event("input")

    # Wait for update
    app.wait_for_timeout(1000)

    # Check Deviation Display
    deviation_text = app.locator("#deviation-display").text_content()
    assert deviation_text != "00:00"

    # Also check Next Stop
    expect(app.locator("#next-stop-name")).to_contain_text("Parada 2")

def test_manual_mode(app: Page):
    """
    Test Manual Mode toggle and interactions.
    """
    # Create Route
    app.locator("#btn-route-editor").click()
    app.wait_for_timeout(2000)
    app.locator("#editor-map").click(position={"x": 100, "y": 50}, force=True)
    app.wait_for_timeout(500)
    app.locator("#editor-map").click(position={"x": 150, "y": 50}, force=True)

    app.locator("#stops-list input[type='time']").nth(0).fill("08:00")
    app.locator("#stops-list input[type='time']").nth(1).fill("08:10")
    app.on("dialog", lambda d: d.accept())
    app.locator("#btn-save-route").click()

    # Toggle Manual Mode via Slider Click
    app.locator(".slider").click()

    # Use Up/Down buttons
    app.locator("#btn-up").click()
    app.locator("#btn-up").click()

    # Ensure display is visible
    expect(app.locator("#deviation-display")).to_be_visible()
