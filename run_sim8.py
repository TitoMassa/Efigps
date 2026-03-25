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

        # Overwrite the DOM instead to trace execution
        page.evaluate("""
            window.interceptDOM = () => {
                const els = document.getElementById("passenger-eta-list");
                const originalSet = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
                Object.defineProperty(els, 'innerHTML', {
                    set: function(val) {
                        console.log("ETA LIST INNERHTML SET TO:", val);
                        originalSet.call(this, val);
                    }
                });
            }
            window.interceptDOM();
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

        print("Selecting stop 2")
        page.select_option("#passenger-select-stop", value=stop_options[2])
        time.sleep(3)

        browser.close()

if __name__ == "__main__":
    run()
