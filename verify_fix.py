from playwright.sync_api import sync_playwright, expect
import time

def verify_modal_fix():
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

            # Esperar carga
            page.wait_for_selector("#btn-route-editor")

            print("Abriendo Editor de Rutas...")
            page.click("#btn-route-editor")

            # Verificar que el modal aparece (no tiene clase hidden)
            editor_modal = page.locator("#editor-modal")
            expect(editor_modal).to_be_visible()
            print("Modal abierto correctamente.")

            # Intentar cerrar con el botón X
            print("Haciendo clic en el botón de cierre (X)...")
            # Usamos el nuevo ID
            page.click("#close-editor-modal")

            # Verificar que el modal se oculta
            expect(editor_modal).to_be_hidden()
            print("Modal cerrado correctamente.")

            # Tomar captura final
            page.screenshot(path="verification_success.png")
            print("Verificación exitosa. Captura guardada en verification_success.png")

        except Exception as e:
            print(f"Error durante la verificación: {e}")
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_modal_fix()
