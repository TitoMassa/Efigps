from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print("PAGE LOG:", msg.text))
        page.goto("http://localhost:8080")

        # Inject data
        page.evaluate("""
            const now = new Date();
            const startStr = new Date(now.getTime() - 1000 * 3600).toISOString().substring(0, 16);
            const endStr = new Date(now.getTime() + 1000 * 3600).toISOString().substring(0, 16);

            const formatTime = (d) => d.toTimeString().substring(0, 8);

            const stops = [
                {name: "Stop 1", lat: -27.46, lng: -58.83, time: "07:00:00"},
                {name: "Stop 2", lat: -27.47, lng: -58.84, time: "09:00:00"}
            ];
            const route = { id: 1, name: "TEST ROUTE", bannerName: "TEST BANNER", stops: stops };
            localStorage.setItem('gps_routes', JSON.stringify([route]));

            const line = {
                id: 1, name: "TEST LINE", start: startStr, end: endStr, turns: 1,
                rests: [{routeId: 1, rest: 0, weight: "media"}]
            };
            localStorage.setItem('gps_lines', JSON.stringify([line]));

            localStorage.setItem('gps_simulated_drivers', JSON.stringify({
                "1": { name: "DRIVER", legajo: "10123", timeOffset: 0, showTrace: true }
            }));

            localStorage.setItem('gps_driver', JSON.stringify({
                driverId: "10123", carNumber: "123", serviceId: "1", scheduleType: "NORMAL"
            }));
        """)
        page.goto("http://localhost:8080")
        time.sleep(2)

        # Let's mock updatePassengerETAs inside the page via evaluate and overwrite before we use it
        page.evaluate("""
            const els = {
                passengerSelectStop: document.getElementById("passenger-select-stop"),
                passengerSelectRoute: document.getElementById("passenger-select-route"),
                passengerSelectLine: document.getElementById("passenger-select-line"),
                passengerEtaList: document.getElementById("passenger-eta-list")
            };

            // let's define a global so we can grab it
            window.debugETAs = function() {
                const stopIndexStr = els.passengerSelectStop.value;
                const routeVal = els.passengerSelectRoute.value;
                const lineVal = els.passengerSelectLine.value;

                console.log("stopIndexStr:", stopIndexStr, "routeVal:", routeVal, "lineVal:", lineVal);

                if (stopIndexStr === "" || !lineVal) {
                    console.log("Empty, returning");
                    return;
                }

                let stopsToUse = [];
                let isFutureTrip = false;
                let targetTimeSec = 0;

                let currentLat = null;
                let currentLng = null;
                let deviationSec = 0;
                let expectedCurrentLocationTimeSec = null;
                let isOutsideTerminal = false;

                const now = new Date();
                const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

                if (lineVal.startsWith("sim_")) {
                    const lineId = parseInt(lineVal.replace("sim_", ""));
                    const driver = window.appState.simulatedDrivers.find(d => d.lineId === lineId);

                    if (!driver) {
                        console.log("driver not found");
                        return;
                    }

                    const parts = routeVal.replace("sim_", "").split("_");
                    const tripIndex = parseInt(parts[1]);

                    if (tripIndex > driver.currentTripIndex) {
                        isFutureTrip = true;
                    }

                    stopsToUse = driver.trips[tripIndex].stops;
                    const targetStopIndex = parseInt(stopIndexStr, 10);
                    const targetStop = stopsToUse[targetStopIndex];
                    // we don't have RouteLogic but we can just print the driver state
                    console.log("Driver:", driver.name, "Trip:", tripIndex, "Future:", isFutureTrip, "targetStopIndex:", targetStopIndex, "lat:", driver.lat, "lng:", driver.lng);
                }
            };
        """)

        page.click("#btn-passenger-mode")
        time.sleep(1)

        page.evaluate("""
            document.getElementById("passenger-select-line").value = "sim_1";
            document.getElementById("passenger-select-line").dispatchEvent(new Event("change"));
        """)
        time.sleep(1)

        options = page.evaluate("Array.from(document.getElementById('passenger-select-route').options).map(o => o.value)")
        page.select_option("#passenger-select-route", value=options[1])
        time.sleep(1)
        stop_options = page.evaluate("Array.from(document.getElementById('passenger-select-stop').options).map(o => o.value)")

        page.select_option("#passenger-select-stop", value=stop_options[2])
        time.sleep(1)

        page.evaluate("window.debugETAs()")

        browser.close()

if __name__ == "__main__":
    run()
