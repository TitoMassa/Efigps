# Prompt Detallado para Crear el Simulador de Control de Flota GPS "Efigps"

Actúa como un desarrollador Senior experto en JavaScript Vanilla y simulaciones web. Tu tarea es construir desde cero una aplicación web llamada **"Efigps"**. Esta aplicación simula un dispositivo físico de control de flota GPS utilizado en transporte público.

## 1. Stack Tecnológico
*   **Lenguaje:** JavaScript Vanilla (ES6+), sin frameworks.
*   **Estructura:** HTML5 Semántico, CSS3 Moderno (Flexbox/Grid).
*   **Mapas:** Librería [Leaflet.js](https://leafletjs.com/) (versión 1.9.4 o superior).
*   **Persistencia:** `localStorage` del navegador para guardar rutas, líneas y configuraciones.
*   **Iconos:** FontAwesome (versión 6+).
*   **Fuente:** 'Roboto Mono' para los dígitos principales.

## 2. Arquitectura de Archivos
Organiza el proyecto en la siguiente estructura:
*   `index.html`: Estructura principal.
*   `css/style.css`: Todos los estilos.
*   `js/app.js`: Controlador principal (Estado, Eventos, DOM).
*   `js/map_logic.js`: Gestión de mapas Leaflet (inicialización, marcadores, polilíneas).
*   `js/route_logic.js`: Cálculos matemáticos (Haversine, proyección en segmentos, interpolación).
*   `js/schedule_logic.js`: Lógica de horarios y diagramas de servicio (Modo Pro).

## 3. Requerimientos de Interfaz (UI/UX)

### A. Diseño del Dispositivo (Carcasa)
*   La interfaz debe imitar un dispositivo físico robusto (color gris oscuro/negro) con bordes redondeados.
*   Debe tener una "Pantalla LCD" en el centro y una botonera física debajo.
*   **Botonera:**
    1.  `U+`: Alternar Alto Contraste.
    2.  `m`: Alternar Mapa en pantalla.
    3.  `Usuario` (Icono): Abre el "Menú de Chofer" (opciones: Ir al Editor, Cerrar Sesión).
    4.  `PRO`: Abre el modo de gestión profesional de líneas.
    5.  `Flechas` (Arriba/Abajo): Amarillas, usadas para control manual.

### B. Pantalla LCD
La pantalla debe tener un fondo claro (`#f0f2f5`) con texto negro (o invertido en alto contraste) y dividirse en secciones:
1.  **Barra Superior (Gris #e0e0e0):** Reloj (HH:MM:SS), Velocidad (KM/H), Contador de Vueltas (número simple), Iconos de estado (GPS/Señal).
2.  **Barra de Información (Negra, Texto Blanco):** Cadena de texto concatenada: `Línea - Servicio - Bandera (Destino) - Coche - Horario - Legajo`. *Nota: En móviles, reducir fuente drásticamente (~9px) para evitar cortes.*
3.  **Display Principal (Desviación):**
    *   Debe mostrar el adelanto/atraso en formato `+MM:SS` o `-MM:SS`.
    *   Fuente: 'Roboto Mono', tamaño grande (~3em).
    *   **Lógica de Color:**
        *   **Magenta (#ff00ff):** Si el valor absoluto es menor a 3 minutos (180 seg).
        *   **Blanco:** Si la diferencia es mayor o igual a 3 minutos.
        *   **Punta de Línea:** Si el vehículo está a <50m del inicio del recorrido, mostrar "Punta de Línea: +XX:XX" en texto blanco simple.
4.  **Footer (Negro, Texto Blanco):** Nombre de la próxima parada (izquierda) y hora de llegada (derecha).

## 4. Funcionalidades Core

### A. Lógica de Rutas (`route_logic.js`)
*   Implementar fórmula de **Haversine** para distancias.
*   **Proyección de Punto:** Para calcular la desviación, proyecta la posición GPS actual sobre el segmento de ruta más cercano (polilínea) para determinar el progreso exacto (ratio) entre dos paradas.
*   **Interpolación:** Capacidad de calcular horarios para paradas intermedias basándose en la distancia relativa entre dos paradas con horario fijo.

### B. Editor de Banderas (Rutas)
*   Mapa interactivo para añadir paradas con clic.
*   Capacidad de arrastrar paradas para corregir ubicación.
*   **Trazado:** Permitir dibujar puntos intermedios (sin ser paradas) para definir la curvatura de las calles.
*   Inputs para definir hora de inicio y fin. Botón para "Calcular Intermedios" automáticamente.
*   Guardar rutas en `localStorage` (`gps_routes`).

### C. Modo Profesional (Diagramas) (`schedule_logic.js`)
*   Permitir crear "Líneas" que asocian una ruta de IDA y una de VUELTA.
*   Configuración: Hora Inicio, Hora Fin, Cantidad de Vueltas (puede ser decimal, ej. 4.5).
*   **Ciclo Fijo:** Calcular la duración del ciclo como `(Fin - Inicio) / Vueltas`.
*   **Esperas (Descansos):** Permitir configurar minutos de espera específicos para cada media vuelta (Ida/Vuelta) de forma dinámica.
*   Generar un itinerario completo (lista de viajes) restando las esperas al tiempo de ciclo para obtener el tiempo de conducción puro.

### D. Simulación y Navegación
*   **Modo Simulación:** Un slider externo que permite mover el vehículo virtualmente a lo largo del % de la ruta activa para probar la desviación sin moverse.
*   **Mapa de Navegación:** Mostrar en la pantalla del dispositivo.
    *   Ruta: Polilínea Roja.
    *   Paradas: Círculos Azules.
    *   Próxima Parada: Círculo Verde.
    *   Usuario: Círculo Blanco.
*   **Login de Chofer:** Modal para ingresar Legajo, Coche, Servicio, Horario. Persistir en sesión.

## 5. Detalles de Implementación Críticos
1.  **Manejo de Tramos:** En modo PRO, al completar una "Ida", el sistema debe cargar automáticamente la ruta de "Vuelta" correspondiente (o siguiente tramo) cuando el vehículo llegue al final (<50m).
2.  **Cálculo de Desviación:** `Tiempo Esperado - Tiempo Actual`. (Negativo = Atrasado).
3.  **Documentación:** Todo el código JS debe tener comentarios JSDoc en Español explicativos.
4.  **Optimización:** Usar `L.LayerGroup` para marcadores si es posible.

Genera el código completo, archivo por archivo, asegurando que todo funcione integrado al abrir `index.html`.
