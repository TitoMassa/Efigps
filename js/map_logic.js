/**
 * Lógica de Mapas utilizando la librería Leaflet.
 * Gestiona la inicialización de mapas, renderizado de rutas y marcadores tanto para el editor como para la navegación.
 */
const MapLogic = {
    /** @type {L.Map|null} Referencia al mapa del editor */
    editorMap: null,
    /** @type {L.Map|null} Referencia al mapa de navegación */
    navMap: null,
    /** @type {Array<L.Marker>} Lista de marcadores de paradas en el editor */
    editorMarkers: [],
    /** @type {Array<L.CircleMarker>} Lista de marcadores intermedios (puntos de trazado) en el editor */
    editorIntermediateMarkers: [],
    /** @type {L.Polyline|null} Polilínea de la ruta en el editor */
    editorPolyline: null,
    /** @type {L.Polyline|null} Polilínea de la ruta en navegación */
    navPolyline: null,
    /** @type {L.CircleMarker|null} Marcador de la posición del usuario en navegación */
    navUserMarker: null,
    /** @type {Array<Object>} Lista de marcadores de navegación con metadatos { marker, stopName } */
    navMarkers: [],

    /**
     * Inicializa el mapa del editor en el elemento DOM especificado.
     * Configura la vista inicial y el manejo de eventos de clic.
     *
     * @param {string} elementId - El ID del elemento HTML contenedor del mapa.
     * @param {Function} onClickCallback - Función a llamar cuando se hace clic en el mapa. Recibe un objeto latlng.
     */
    initEditorMap: function(elementId, onClickCallback) {
        if (this.editorMap) return; // Ya inicializado

        this.editorMap = L.map(elementId).setView([-34.6037, -58.3816], 13); // Default Buenos Aires
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.editorMap);

        this.editorMap.on('click', (e) => {
            onClickCallback(e.latlng);
        });
    },

    /**
     * Inicializa el mapa de navegación (visualización para el conductor).
     * Configura un mapa con interfaz mínima.
     *
     * @param {string} elementId - El ID del elemento HTML contenedor del mapa.
     */
    initNavMap: function(elementId) {
        if (this.navMap) return;

        this.navMap = L.map(elementId, {
            zoomControl: false, // UI Mínima
            attributionControl: false
        }).setView([-34.6037, -58.3816], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.navMap);
    },

    // Métodos del Editor

    /**
     * Limpia todas las capas (marcadores y polilíneas) del mapa del editor.
     */
    clearEditor: function() {
        this.editorMarkers.forEach(m => this.editorMap.removeLayer(m));
        this.editorMarkers = [];
        this.editorIntermediateMarkers.forEach(m => this.editorMap.removeLayer(m));
        this.editorIntermediateMarkers = [];

        if (this.editorPolyline) this.editorMap.removeLayer(this.editorPolyline);
        this.editorPolyline = null;
    },

    /**
     * Renderiza la ruta completa (paradas + trazados) en el mapa del editor.
     * Dibuja marcadores para paradas, puntos para intermedios y una polilínea conectando todo.
     *
     * @param {Array<Object>} stops - Lista de objetos de parada.
     * @param {Function} [onStopDragCallback] - Callback opcional para manejar el evento de arrastrar una parada.
     */
    renderEditorRoute: function(stops, onStopDragCallback) {
        if (!this.editorMap) return;

        // Limpiar elementos visuales existentes primero
        this.clearEditor();

        if (!stops || stops.length === 0) return;

        const fullPathLatLngs = [];

        stops.forEach((stop, i) => {
            // 1. Añadir Marcador para la Parada
            const marker = L.marker([stop.lat, stop.lng], { draggable: true }).addTo(this.editorMap);
            marker.bindPopup(`<strong>${stop.name}</strong>`); // Se quitó .openPopup() para evitar centrado automático

            marker.on('dragend', function(event) {
                const marker = event.target;
                const position = marker.getLatLng();
                if (onStopDragCallback) {
                    onStopDragCallback(i, position.lat, position.lng);
                }
            });

            this.editorMarkers.push(marker);

            // 2. Recolectar Puntos del Camino
            fullPathLatLngs.push([stop.lat, stop.lng]);

            // 3. Añadir Puntos Intermedios si existen
            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                stop.pathNext.forEach(pt => {
                    fullPathLatLngs.push([pt.lat, pt.lng]);

                    // Añadir punto pequeño para intermedio
                    const dot = L.circleMarker([pt.lat, pt.lng], {
                        radius: 3,
                        color: '#666',
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 1
                    }).addTo(this.editorMap);
                    this.editorIntermediateMarkers.push(dot);
                });
            }
        });

        // Dibujar Polilínea
        if (fullPathLatLngs.length > 1) {
            this.editorPolyline = L.polyline(fullPathLatLngs, {color: 'blue', weight: 3}).addTo(this.editorMap);
        }
    },

    /**
     * Método legado para compatibilidad. Se recomienda usar renderEditorRoute.
     * Añade un marcador simple al editor.
     *
     * @deprecated
     * @param {number} lat - Latitud.
     * @param {number} lng - Longitud.
     * @param {string} label - Etiqueta para el popup.
     */
    addEditorMarker: function(lat, lng, label) {
        const marker = L.marker([lat, lng]).addTo(this.editorMap);
        if(label) marker.bindPopup(label).openPopup();
        this.editorMarkers.push(marker);
    },


    // Métodos de Navegación

    /**
     * Carga y visualiza una ruta en el mapa de navegación.
     * Dibuja la polilínea roja y marcadores azules para las paradas.
     *
     * @param {Array<Object>} stops - Lista de paradas de la ruta.
     */
    loadRouteOnNavMap: function(stops) {
        if (!this.navMap) return;
        // Limpiar polilínea anterior
        if (this.navPolyline) this.navMap.removeLayer(this.navPolyline);
        // Limpiar marcadores anteriores
        this.navMarkers.forEach(obj => this.navMap.removeLayer(obj.marker));
        this.navMarkers = [];

        // Construir polilínea detallada
        const latlngs = [];
        stops.forEach(stop => {
            latlngs.push([stop.lat, stop.lng]);
            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                stop.pathNext.forEach(pt => latlngs.push([pt.lat, pt.lng]));
            }
        });

        this.navPolyline = L.polyline(latlngs, {color: 'red', weight: 5}).addTo(this.navMap);

        // Añadir marcadores SOLO para paradas (saltar intermedios)
        stops.forEach((stop, index) => {
             const marker = L.circleMarker([stop.lat, stop.lng], {
                 color: 'blue',
                 fillColor: '#3388ff',
                 fillOpacity: 0.8,
                 radius: 8
             }).addTo(this.navMap);

             marker.bindPopup(`<strong>${stop.name}</strong><br>Hora: ${stop.time || '--'}`);

             this.navMarkers.push({ marker: marker, stopName: stop.name });
        });

        if (latlngs.length > 0) {
            this.navMap.fitBounds(this.navPolyline.getBounds());
        }
    },

    /**
     * Actualiza el estilo de los marcadores de parada para indicar cuál es la siguiente.
     * La siguiente parada se marca en verde, las demás en azul.
     *
     * @param {string} nextStopName - El nombre de la siguiente parada objetivo.
     */
    updateStopMarkers: function(nextStopName) {
        this.navMarkers.forEach(obj => {
            if (obj.stopName === nextStopName) {
                // Poner Verde
                obj.marker.setStyle({
                    color: 'green',
                    fillColor: '#00ff00'
                });
                // Traer al frente
                obj.marker.bringToFront();
            } else {
                // Poner Azul
                obj.marker.setStyle({
                    color: 'blue',
                    fillColor: '#3388ff'
                });
            }
        });
    },

    /**
     * Actualiza la posición del usuario en el mapa de navegación.
     * Mueve el marcador del usuario y centra el mapa en la nueva posición.
     *
     * @param {number} lat - Latitud actual.
     * @param {number} lng - Longitud actual.
     */
    updateUserPosition: function(lat, lng) {
        if (!this.navMap) return;

        if (!this.navUserMarker) {
            this.navUserMarker = L.circleMarker([lat, lng], {
                color: 'white',
                fillColor: 'blue',
                radius: 6,
                fillOpacity: 1,
                weight: 2
            }).addTo(this.navMap);
        } else {
            this.navUserMarker.setLatLng([lat, lng]);
        }
        this.navMap.setView([lat, lng]); // Seguir usuario
    }
};
