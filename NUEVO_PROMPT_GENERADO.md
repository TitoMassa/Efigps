# Prompt para Desarrollar "Efigps": Simulador de Control de Flota GPS

Actúa como un Desarrollador Frontend Senior experto en JavaScript Vanilla (ES6+) y sistemas de información geográfica (GIS) para la web. Tu tarea es construir desde cero y con máxima fidelidad una aplicación web llamada **"Efigps"**. Esta aplicación simula, dentro del navegador, un dispositivo físico de control de flota GPS utilizado en transporte público, junto con herramientas de gestión de rutas y una vista externa para pasajeros.

El proyecto **no utiliza frameworks ni bundlers** (ni React, Vue, Webpack, etc.). Todo el código debe ser estático (HTML, CSS, JS) y ejecutable sirviéndolo mediante un servidor HTTP local básico (ej. `python3 -m http.server 8080`).

A continuación, se detallan los requerimientos arquitectónicos, de interfaz de usuario y funcionales estrictos que debes implementar.

---

## 1. Arquitectura y Stack Tecnológico

*   **Lenguaje:** JavaScript Vanilla (ES6+), sin exports/imports tipo CommonJS o Modules complejos (los archivos se cargan secuencialmente en el HTML mediante etiquetas `<script>`).
*   **Interfaz:** HTML5 Semántico y CSS3 Moderno (Flexbox, Grid).
*   **Mapas:** Librería [Leaflet.js](https://leafletjs.com/) (versión 1.9.4 o superior).
*   **Persistencia:** `localStorage` exclusivo para guardar rutas ("banderas"), líneas ("diagramas pro") y datos de sesión del chofer.
*   **Iconos:** FontAwesome (v6+).
*   **Fuentes:** 'Roboto Mono' **exclusiva y obligatoriamente** para el texto de desviación principal. Otras fuentes sans-serif genéricas para el resto de la UI.
*   **Estado Global:** La aplicación debe exponer su estado global bajo la variable `window.appState` para facilitar depuración e inspección externa.

### Estructura de Archivos Requerida:
*   `index.html`: Punto de entrada único. Contiene el layout del dispositivo simulado, los modales (Editor, Pro, Login) y la Vista Pasajeros (fuera del contenedor del dispositivo).
*   `css/style.css`: Archivo único de estilos.
*   `js/app.js`: Controlador principal (Manejo de estado global, eventos DOM, simulación de tiempo/posición, ciclo de vida de la app).
*   `js/map_logic.js`: Encapsula toda la lógica de Leaflet (inicialización, marcadores, polilíneas, agrupamiento con `L.LayerGroup` para optimizar DOM).
*   `js/route_logic.js`: Funciones matemáticas puras para cálculos geográficos (Haversine estricto para distancia, proyección de puntos en segmentos de polilínea, interpolación de tiempos).
*   `js/schedule_logic.js`: Lógica compleja de horarios y diagramas de servicio para el "Modo Pro".

**Importante sobre JS:** El código debe estar exhaustivamente documentado utilizando convenciones JSDoc con descripciones en **español** para todas las funciones, parámetros y valores de retorno.

---

## 2. Requerimientos de Interfaz de Usuario (UI/UX) Estrictos

### A. El Dispositivo GPS (Hardware Simulado)
La interfaz principal debe imitar visualmente un dispositivo físico integrado en el tablero de un colectivo.
*   Debe tener un contenedor principal con aspecto de carcasa plástica oscura, bordes redondeados y una sombra proyectada para dar volumen.
*   **Pantalla LCD:** Ubicada en el centro superior de la carcasa. Fondo por defecto gris muy claro (`#f0f2f5`).
*   **Botonera Física:** Botones en la parte inferior de la carcasa.
    *   `U+`: Botón para alternar el modo de "Alto Contraste" de la pantalla LCD.
    *   `m`: Botón para alternar la visualización del mapa de navegación (ocultarlo o mostrarlo en la mitad inferior de la pantalla LCD).
    *   `Icono Usuario (FontAwesome)`: Botón que abre un modal de "Menú de Usuario" con dos opciones: "Editor de Banderas" y "Cerrar Sesión".
    *   `Botón PRO`: Para acceder a la configuración avanzada de líneas.
    *   `Flechas Arriba/Abajo`: Para control manual de la parada objetivo.

### B. Distribución de la Pantalla LCD
La pantalla se divide verticalmente en las siguientes secciones estáticas (y un área de mapa colapsable):

1.  **Top Bar (Barra Superior):** Fondo Gris Claro (`#e0e0e0`), texto negro. Muestra: Reloj actual, Velocidad (km/h), Contador numérico de Vueltas (elemento HTML con ID `lap-display`, sin prefijos, solo el número ej: "1"), Icono de Señal GPS. *(Nota: Excluir icono de batería).*
2.  **Info Bar (Barra de Información):** Fondo Negro, texto Blanco.
    *   Contiene la información del servicio concatenada: `Línea | Servicio | Bandera (Destino) | Coche | Horario | Legajo`.
    *   El campo "Bandera" debe mostrar el nombre de destino original de la ruta (ej. "CENTRO" o "BARRIO X"), priorizándolo sobre etiquetas genéricas de dirección.
    *   *Responsividad Móvil Crítica:* En pantallas menores a 600px, el tamaño de fuente en esta barra `.info-bar` debe reducirse agresivamente (a ~9px) para evitar truncamiento del texto.
3.  **Display Principal (Desviación del Horario):**
    *   Fuente: **'Roboto Mono'**.
    *   Tamaño: Ajustado al contenedor (~3em o 48px), evitando desbordamientos masivos (nunca usar tamaños como 72px o 5em).
    *   Muestra el cálculo de tiempo `Timestamp Esperado - Timestamp Actual`. Adelanto es positivo, atraso (Late) es negativo.
    *   **Reglas de Color Estrictas:**
        *   **Magenta (#ff00ff):** Si el valor absoluto de desviación es **menor a 3 minutos (180 segundos)**.
        *   **Blanco (#ffffff):** Si es mayor o igual a 3 minutos.
    *   **Estado Punta de Línea:** Si el vehículo está a menos de 50 metros del inicio de su ruta, o esperando salir, la pantalla debe sobreescribir la visualización normal y mostrar textualmente, en una sola línea blanca: `"Punta de Línea: +XX:XX"`. En este estado, un bus adelantado no acumula más adelanto; se considera que está "esperando su hora de salida" y el cálculo de ETA es estrictamente `Hora Programada - Hora Actual`.
4.  **Footer (Próxima Parada):** Fondo Negro, texto Blanco. Solo debe mostrar el nombre exacto de la parada a la izquierda, sin etiquetas previas como "Próxima:". A la derecha, el ETA (Hora Estimada de Llegada).

### C. Vista Pasajeros
*   Debe ubicarse **fuera** de la estructura visual del dispositivo GPS, simulando ser una app móvil de terceros.
*   **Tema visual:** Rojo y Blanco.
*   **Funcionalidad:** Muestra un dropdown (selector) para elegir la ruta actual. En Modo Pro (Automático), este dropdown debe llenarse dinámicamente con los tramos futuros del itinerario activo para que el pasajero vea no solo su ruta actual, sino los tiempos estimados para la vuelta.
*   **Regla de ETA "Arribando":** Si el tiempo estimado de llegada a una parada en esta vista cae por debajo de 2 minutos (120 seg), el texto debe mostrar obligatoriamente la palabra **"Arribando"** en lugar de los minutos restantes.

---

## 3. Funcionalidades Core a Implementar

### A. Login de Chofer
*   Al iniciar, un modal exige: Legajo (validación estricta de 5 dígitos numéricos), Coche, Servicio y Horario.
*   Persiste en `localStorage` bajo `gps_driver`.
*   Cerrar Sesión borra esta key, pero preserva rutas y líneas locales.
*   *Nota para QA/Testing:* Los IDs de los inputs deben ser `#login-legajo`, `#login-coche`, `#login-servicio` y `#login-horario` para permitir bypass automatizado (Playwright).

### B. Modo Manual vs Automático
*   **Manual (M):** El chofer selecciona la próxima parada con las flechas físicas. La desviación se calcula proyectando la ubicación GPS sobre la geometría completa (polyline) de la ruta para medir el progreso real de la distancia, **no** usando una línea recta entre paradas.
*   **Automático (Modo Pro):** El sistema avanza automáticamente la parada objetivo al acercarse. Además, al acercarse a <50m del final de un tramo, el sistema **cambia automáticamente a la siguiente ruta ("Bandera")** del itinerario programado sin intervención del chofer.

### C. Editor de Rutas ("Hacer una Bandera")
*   Acceso vía el "Menú de Usuario". Botones de cierre de modal deben usar IDs únicos (ej. `#close-editor-modal`) para evitar conflictos de selectores.
*   **Comportamiento del Mapa:** Al abrir por primera vez o crear nueva ruta, centrar el mapa en la ubicación GPS actual del usuario **estrictamente una vez**. Luego permitir paneo libre sin auto-centrados intrusivos. (Si no hay GPS, usar coordenadas de *Corrientes: -27.4692, -58.8302*).
*   **Geometría:** Diferenciar entre "Paradas" y "Puntos Intermedios" (Trazado) usados solo para definir la curva de la calle en la polilínea. El cálculo de duración y distancia para horarios se hace sobre el trazo real, no distancias en línea recta.
*   **UI "Seguidilla de Paradas":** La lista de paradas a la derecha debe representarse como un "Timeline" vertical: una línea que conecta nodos usando iconos FontAwesome, permitiendo renombrar paradas mediante inputs directamente incrustados en los ítems de la lista.

### D. Modo Profesional (Gestión de Líneas y Diagramas)
*   **Crucial:** El sistema de líneas no debe tener restricciones rígidas de "Ida" y "Vuelta". La configuración de una línea permite agregar *n* tramos (medias vueltas independientes) con rutas diferentes.
*   **Pesos de Duración:** Al programar un servicio, el tiempo total de conducción se distribuye proporcionalmente usando multiplicadores ("Pesos"):
    *   *Corta:* 0.8x
    *   *Media:* 1.0x
    *   *Larga:* 1.2x
*   **Esperas:** Permitir configurar tiempos de espera específicos (descanso) para cada medio giro de forma independiente.
*   Los inputs de hora de inicio/fin de servicio deben usar `datetime-local` para soportar turnos que cruzan la medianoche.

### E. Lógica Matemática Obligatoria (`route_logic.js`)
*   Usa **exclusivamente la fórmula de Haversine** para todos los cálculos de distancia. Queda prohibido el uso de distancia Euclidiana al cuadrado como "optimización" de rendimiento; prima la precisión geográfica.

---
**Entregable:** Genera el código completo de los archivos mencionados, garantizando que el diseño y la lógica cumplan a la perfección con estas instrucciones y el comportamiento del proyecto original.
