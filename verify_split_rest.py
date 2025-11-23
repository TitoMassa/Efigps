from playwright.sync_api import sync_playwright, expect
import json

def verify_split_rest_times():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            geolocation={"latitude": -34.6037, "longitude": -58.3816},
            permissions=["geolocation"]
        )
        page = context.new_page()

        try:
            print("Navegando a la aplicación...")
            page.goto("http://localhost:8080")

            # Inyectar rutas dummy en localStorage para poder crear una línea
            routes_dummy = [
                {"id": 1, "name": "Ruta A (Ida)", "stops": [{"name":"A","lat":0,"lng":0,"time":"00:00"},{"name":"B","lat":0,"lng":1,"time":"00:10"}]},
                {"id": 2, "name": "Ruta B (Vuelta)", "stops": [{"name":"B","lat":0,"lng":1,"time":"00:00"},{"name":"A","lat":0,"lng":0,"time":"00:10"}]}
            ]
            page.evaluate(f"localStorage.setItem('gps_routes', JSON.stringify({json.dumps(routes_dummy)}))")
            page.reload()

            print("Abriendo Modo PRO...")
            page.click("#btn-pro-mode")
            page.click("#btn-create-line")

            print("Verificando nuevos inputs...")
            expect(page.locator("#line-rest-ida")).to_be_visible()
            expect(page.locator("#line-rest-vuelta")).to_be_visible()
            # Asegurar que el viejo input no está o no es visible (aunque lo eliminé del HTML, verificar que no hay restos)
            expect(page.locator("#line-rest")).to_be_hidden()

            print("Rellenando formulario de línea...")
            page.fill("#line-name-input", "Linea Test")
            page.select_option("#select-route-ida", "1")
            page.select_option("#select-route-vuelta", "2")
            page.fill("#line-start-time", "10:00")
            page.fill("#line-end-time", "12:00")
            page.fill("#line-turns", "1") # 1 vuelta = Ida + Vuelta

            # Rellenar descansos diferenciados
            # Ida termina -> espera 10 min
            page.fill("#line-rest-ida", "10")
            # Vuelta termina -> espera 20 min (aunque al final del servicio no se usa, pero probamos guardado)
            page.fill("#line-rest-vuelta", "20")

            print("Guardando línea...")
            page.click("#btn-save-line")

            # Verificar que se guardó en localStorage con los campos nuevos
            lines = page.evaluate("JSON.parse(localStorage.getItem('gps_lines'))")
            line = lines[0]
            assert line['restIda'] == 10
            assert line['restVuelta'] == 20
            print(f"Datos guardados correctamente: restIda={line['restIda']}, restVuelta={line['restVuelta']}")

            # Volver a abrir para editar y verificar que carga los valores
            print("Reabriendo para editar...")
            page.evaluate(f"window.editLine({line['id']})")
            expect(page.locator("#line-rest-ida")).to_have_value("10")
            expect(page.locator("#line-rest-vuelta")).to_have_value("20")
            print("Valores cargados correctamente en el editor.")

            # Test de Integración: Generar Itinerario (Conducir)
            # 1 Vuelta (Ida + Vuelta).
            # Ida dura X. Descanso Ida = 10. Vuelta dura Y.
            # Start: 10:00. End: 12:00. Total 120min.
            # Legs: 2 (Ida, Vuelta). Descansos intermedios: 1 (tras Ida).
            # Tiempo descanso total = 10 min.
            # Tiempo manejo = 110 min.
            # Ida = 55 min, Vuelta = 55 min.
            # Itinerario esperado:
            # 1. Ida: 10:00 -> 10:55.
            # -- Descanso 10 min -- (10:55 -> 11:05)
            # 2. Vuelta: 11:05 -> 12:00.

            # Vamos a verificar esto ejecutando la lógica en el navegador
            trips = page.evaluate("""() => {
                const line = JSON.parse(localStorage.getItem('gps_lines'))[0];
                const routes = JSON.parse(localStorage.getItem('gps_routes'));
                const rIda = routes.find(r => r.id == line.routeIda);
                const rVuelta = routes.find(r => r.id == line.routeVuelta);
                return ScheduleLogic.calculateItinerary({
                    startTime: line.start,
                    endTime: line.end,
                    turns: line.turns,
                    restIda: line.restIda,
                    restVuelta: line.restVuelta
                }, rIda, rVuelta);
            }""")

            print("Verificando itinerario generado...")
            t1 = trips[0]
            t2 = trips[1]

            print(f"Viaje 1: {t1['startTime']} - {t1['endTime']}")
            print(f"Viaje 2: {t2['startTime']} - {t2['endTime']}")

            assert t1['startTime'] == "10:00:00"
            # Ida dura 55 min
            assert t1['endTime'] == "10:55:00"

            # Viaje 2 debe empezar 10 min después de t1 end
            assert t2['startTime'] == "11:05:00"
            assert t2['endTime'] == "12:00:00"

            print("Cálculo de itinerario verificado con éxito.")
            page.screenshot(path="verification_split_rest.png")

        except Exception as e:
            print(f"Error durante la verificación: {e}")
            page.screenshot(path="verification_error_split.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_split_rest_times()
