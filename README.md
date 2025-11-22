# Efigps - Simulador de Control de Flota GPS

Este repositorio contiene el código fuente de **Efigps**, una aplicación web que simula un dispositivo de control de flota GPS. La aplicación permite gestionar rutas ("banderas"), simular recorridos y visualizar desviaciones de tiempo en tiempo real.

## Propósito

El objetivo principal de este proyecto es proporcionar una interfaz simulada de un dispositivo de hardware GPS utilizado en transporte público o logística. Permite:

*   Crear y editar rutas con paradas y horarios.
*   Simular el movimiento de un vehículo a lo largo de una ruta.
*   Calcular y visualizar el adelanto o atraso (desviación) respecto al horario planificado.
*   Interpolar tiempos entre paradas principales.
*   Visualizar la posición en un mapa interactivo.

## Estructura del Proyecto

El proyecto está organizado de la siguiente manera:

*   `index.html`: El punto de entrada de la aplicación. Define la estructura HTML de la interfaz del dispositivo y el editor.
*   `css/style.css`: Contiene todos los estilos visuales de la aplicación, incluyendo el diseño del dispositivo, la pantalla digital y el modo de alto contraste.
*   `js/`: Directorio que contiene la lógica de la aplicación en JavaScript.
    *   `app.js`: El controlador principal. Gestiona el estado de la aplicación, los eventos del DOM, la simulación y la coordinación entre módulos.
    *   `map_logic.js`: Encapsula la lógica relacionada con los mapas (usando Leaflet). Maneja marcadores, polilíneas y actualizaciones de posición.
    *   `route_logic.js`: Contiene funciones matemáticas puras para cálculos de rutas, como distancia Haversine, proyecciones de puntos en segmentos e interpolación de tiempos.

## Configuración e Instalación

La aplicación es puramente estática (HTML/CSS/JS), pero requiere un servidor HTTP local para funcionar correctamente debido a las políticas de seguridad del navegador (especialmente para módulos o geolocalización).

### Requisitos

*   Un navegador web moderno (Chrome, Firefox, Edge).
*   Python 3 (recomendado para iniciar un servidor local rápido).

### Pasos para ejecutar

1.  Clone o descargue este repositorio.
2.  Abra una terminal en la carpeta raíz del proyecto.
3.  Inicie un servidor HTTP simple con Python:

    ```bash
    python3 -m http.server 8080
    ```

4.  Abra su navegador web y navegue a: `http://localhost:8080`

## Guía de Uso

### 1. Interfaz del Dispositivo

La interfaz principal imita un dispositivo físico con pantalla y botones:

*   **Pantalla**: Muestra la hora actual, el nombre de la ruta ("Bandera"), la velocidad (simulada o real) y, lo más importante, la **Desviación** (en el centro).
    *   Verde: Adelantado.
    *   Rojo: Atrasado.
*   **Botones**:
    *   `U+`: Alterna el modo de Alto Contraste.
    *   `m`: Alterna la visualización del mapa de navegación en la pantalla.
    *   `Icono Usuario`: Abre el Editor de Rutas (Banderas).
    *   `Flechas Arriba/Abajo`: En modo manual (M), permiten cambiar la parada objetivo.

### 2. Editor de Rutas (Banderas)

Para simular, primero necesita una ruta.

1.  Haga clic en el botón de usuario (tercero desde la izquierda).
2.  En el mapa del editor, haga clic para añadir paradas secuencialmente.
3.  En la lista de la derecha, asigne una **Hora** de inicio a la primera parada y una Hora de fin a la última.
4.  Puede usar el botón "Dibujar Trazado" entre dos paradas para añadir puntos intermedios que definan la curvatura de la calle (sin ser paradas).
5.  Haga clic en "Calcular Intermedios" para rellenar automáticamente los horarios de las paradas intermedias basándose en la distancia.
6.  Asigne un nombre y haga clic en "Guardar Bandera".

### 3. Simulación

La aplicación permite simular el recorrido sin moverse físicamente:

1.  En el panel inferior "Modo Simulación", asegúrese de haber cargado una bandera (se selecciona automáticamente al guardar).
2.  Haga clic en "Iniciar Simulación".
3.  Use el deslizador (slider) para avanzar o retroceder el progreso del vehículo a lo largo de la ruta.
4.  Observe cómo cambia la desviación en la pantalla del dispositivo y cómo se mueve el marcador en el mapa (si está activo con el botón `m`).

### 4. Modo Manual (M)

El interruptor "M" en el panel de simulación activa el modo manual de selección de parada.

*   **Automático (M apagado)**: El sistema detecta automáticamente la parada siguiente más cercana basándose en la posición.
*   **Manual (M encendido)**: El conductor (o usuario) selecciona manualmente hacia qué parada se dirige usando las flechas Arriba/Abajo del dispositivo.

## Desarrollo y Documentación

El código fuente ha sido documentado exhaustivamente usando JSDoc. Consulte los archivos `.js` para obtener detalles sobre funciones y parámetros específicos.

---
*Documentación generada automáticamente por Jules.*
