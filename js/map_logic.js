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

    // Propiedades para Mapa de Pasajeros
    /** @type {L.Map|null} Referencia al mapa de pasajeros */
    passengerMap: null,
    /** @type {L.Polyline|null} Polilínea de la ruta en mapa de pasajeros */
    passengerPolyline: null,
    /** @type {L.CircleMarker|null} Marcador de la posición del usuario en mapa de pasajeros */
    passengerUserMarker: null,
    /** @type {Array<L.CircleMarker>} Lista de marcadores de paradas en el mapa de pasajeros */
    passengerMarkers: [],

    /** @type {Array<L.Marker>} Lista de marcadores para choferes simulados en el mapa de navegación */
    simulatedDriverMarkersNav: [],

    /** @type {Array<L.Marker>} Lista de marcadores para choferes simulados en el mapa de pasajeros */
    simulatedDriverMarkersPassenger: [],

    /** @type {Array<L.Polyline>} Lista de polilíneas de trazado para choferes simulados */
    simulatedDriverTracesNav: [],

    /** @type {Array<L.Polyline>} Lista de polilíneas de trazado para choferes simulados en mapa de pasajeros */
    simulatedDriverTracesPassenger: [],

    /** @type {Array<L.CircleMarker>} Lista de marcadores de parada para los trazados de choferes simulados (ambos mapas) */
    simulatedDriverStopMarkers: [],

    /**
     * Inicializa el mapa del editor en el elemento DOM especificado.
     * Configura la vista inicial y el manejo de eventos de clic.
     *
     * @param {string} elementId - El ID del elemento HTML contenedor del mapa.
     * @param {number} initialLat - Latitud inicial.
     * @param {number} initialLng - Longitud inicial.
     * @param {Function} onClickCallback - Función a llamar cuando se hace clic en el mapa. Recibe un objeto latlng.
     */
    initEditorMap: function(elementId, initialLat, initialLng, onClickCallback) {
        if (this.editorMap) return; // Ya inicializado

        this.editorMap = L.map(elementId).setView([initialLat, initialLng], 13);
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
        }).setView([-27.4692, -58.8302], 15);

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


    // Métodos de Modo Pasajeros

    /**
     * Inicializa el mapa para la vista de pasajeros.
     *
     * @param {string} elementId - El ID del elemento HTML contenedor del mapa.
     */
    initPassengerMap: function(elementId) {
        if (this.passengerMap) return;

        this.passengerMap = L.map(elementId, {
            zoomControl: true, // Permitir zoom al pasajero
            attributionControl: false
        }).setView([-27.4692, -58.8302], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.passengerMap);
    },

    /**
     * Carga la ruta actual en el mapa de pasajeros.
     *
     * @param {Array<Object>} stops - Lista de paradas de la ruta.
     */
    loadRouteOnPassengerMap: function(stops) {
        if (!this.passengerMap || !stops || stops.length === 0) return;

        // Limpiar capas anteriores
        if (this.passengerPolyline) this.passengerMap.removeLayer(this.passengerPolyline);
        this.passengerMarkers.forEach(m => this.passengerMap.removeLayer(m));
        this.passengerMarkers = [];

        // Construir polilínea detallada
        const latlngs = [];
        stops.forEach(stop => {
            latlngs.push([stop.lat, stop.lng]);
            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                stop.pathNext.forEach(pt => latlngs.push([pt.lat, pt.lng]));
            }
        });

        // Polilínea roja para el tema de pasajeros
        this.passengerPolyline = L.polyline(latlngs, {color: '#d00000', weight: 5}).addTo(this.passengerMap);

        // Añadir marcadores
        stops.forEach((stop) => {
             const marker = L.circleMarker([stop.lat, stop.lng], {
                 color: '#fff',
                 fillColor: '#666',
                 fillOpacity: 1,
                 weight: 2,
                 radius: 6
             }).addTo(this.passengerMap);

             marker.bindPopup(`<strong>${stop.name}</strong>`);
             this.passengerMarkers.push(marker);
        });

        if (latlngs.length > 0) {
            this.passengerMap.fitBounds(this.passengerPolyline.getBounds());
        }
    },

    /**
     * Actualiza la posición del colectivo en el mapa de pasajeros.
     *
     * @param {number} lat - Latitud actual.
     * @param {number} lng - Longitud actual.
     */
    updatePassengerUserPosition: function(lat, lng) {
        if (!this.passengerMap) return;

        if (!this.passengerUserMarker) {
            // Icono de un "colectivo" (en este caso un círculo más grande y distintivo)
            this.passengerUserMarker = L.circleMarker([lat, lng], {
                color: '#fff',
                fillColor: '#d00000',
                radius: 10,
                fillOpacity: 1,
                weight: 3
            }).addTo(this.passengerMap);
            this.passengerUserMarker.bindPopup("<strong>Colectivo Actual</strong>");
        } else {
            this.passengerUserMarker.setLatLng([lat, lng]);
        }
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
    },

    /**
     * Renderiza los choferes simulados en los mapas activos (Navegación y Pasajeros).
     * @param {Array<Object>} drivers - Lista de choferes simulados activos.
     */
    renderSimulatedDrivers: function(drivers) {
        // Limpiar marcadores de parada simulados de ambos mapas
        this.simulatedDriverStopMarkers.forEach(m => {
            if (this.navMap && this.navMap.hasLayer(m)) this.navMap.removeLayer(m);
            if (this.passengerMap && this.passengerMap.hasLayer(m)) this.passengerMap.removeLayer(m);
        });
        this.simulatedDriverStopMarkers = [];

        // --- Navegación Map ---
        if (this.navMap) {
            // Eliminar marcadores y trazos anteriores
            this.simulatedDriverMarkersNav.forEach(m => this.navMap.removeLayer(m));
            this.simulatedDriverMarkersNav = [];

            this.simulatedDriverTracesNav.forEach(l => this.navMap.removeLayer(l));
            this.simulatedDriverTracesNav = [];

            // Añadir nuevos marcadores
            drivers.forEach(d => {
                if (d.lat !== null && d.lng !== null) {
                    const marker = L.marker([d.lat, d.lng], {
                        icon: L.divIcon({
                            className: 'simulated-driver-icon',
                            html: '<i class="fa-solid fa-bus" style="color: #ff9800; font-size: 16px; text-shadow: 1px 1px 2px #000;"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(this.navMap);

                    const sign = d.deviation >= 0 ? '+' : '-';
                    const absDev = Math.abs(d.deviation);
                    const m = Math.floor(absDev / 60).toString().padStart(2, '0');
                    const s = Math.floor(absDev % 60).toString().padStart(2, '0');
                    const devStr = `${sign}${m}:${s}`;

                    marker.bindTooltip(`<b>${d.lineName}</b><br>${d.bannerName}<br>${devStr}`, {
                        direction: 'top',
                        offset: [0, -10]
                    });
                    this.simulatedDriverMarkersNav.push(marker);

                    // Dibujar trazo si está habilitado
                    if (d.showTrace && d.trips && d.trips[d.currentTripIndex]) {
                        const stops = d.trips[d.currentTripIndex].stops;
                        const latlngs = [];
                        stops.forEach(stop => {
                            latlngs.push([stop.lat, stop.lng]);
                            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                                stop.pathNext.forEach(pt => latlngs.push([pt.lat, pt.lng]));
                            }
                        });

                        const polyline = L.polyline(latlngs, {
                            color: '#ff9800',
                            weight: 3,
                            dashArray: '5, 5'
                        }).addTo(this.navMap);

                        this.simulatedDriverTracesNav.push(polyline);

                        stops.forEach(stop => {
                            const stopMarker = L.circleMarker([stop.lat, stop.lng], {
                                color: '#ff9800',
                                fillColor: '#333',
                                fillOpacity: 1,
                                weight: 2,
                                radius: 5
                            }).addTo(this.navMap);
                            stopMarker.bindPopup(`<strong>${stop.name}</strong>`);
                            this.simulatedDriverStopMarkers.push(stopMarker);
                        });
                    }
                }
            });
        }

        // --- Passenger Map ---
        if (this.passengerMap) {
            // Eliminar marcadores y trazos anteriores
            this.simulatedDriverMarkersPassenger.forEach(m => this.passengerMap.removeLayer(m));
            this.simulatedDriverMarkersPassenger = [];

            this.simulatedDriverTracesPassenger.forEach(l => this.passengerMap.removeLayer(l));
            this.simulatedDriverTracesPassenger = [];

            // Añadir nuevos marcadores
            drivers.forEach(d => {
                if (d.lat !== null && d.lng !== null) {
                    const marker = L.marker([d.lat, d.lng], {
                        icon: L.divIcon({
                            className: 'simulated-driver-icon',
                            html: '<i class="fa-solid fa-bus" style="color: #ff9800; font-size: 16px; text-shadow: 1px 1px 2px #000;"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(this.passengerMap);

                    const sign = d.deviation >= 0 ? '+' : '-';
                    const absDev = Math.abs(d.deviation);
                    const m = Math.floor(absDev / 60).toString().padStart(2, '0');
                    const s = Math.floor(absDev % 60).toString().padStart(2, '0');
                    const devStr = `${sign}${m}:${s}`;

                    marker.bindTooltip(`<b>${d.lineName}</b><br>${d.bannerName}<br>${devStr}`, {
                        direction: 'top',
                        offset: [0, -10]
                    });
                    this.simulatedDriverMarkersPassenger.push(marker);

                    // Dibujar trazo si está habilitado
                    if (d.showTrace && d.trips && d.trips[d.currentTripIndex]) {
                        const stops = d.trips[d.currentTripIndex].stops;
                        const latlngs = [];
                        stops.forEach(stop => {
                            latlngs.push([stop.lat, stop.lng]);
                            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                                stop.pathNext.forEach(pt => latlngs.push([pt.lat, pt.lng]));
                            }
                        });

                        const polyline = L.polyline(latlngs, {
                            color: '#ff9800',
                            weight: 3,
                            dashArray: '5, 5'
                        }).addTo(this.passengerMap);

                        this.simulatedDriverTracesPassenger.push(polyline);

                        stops.forEach(stop => {
                            const stopMarker = L.circleMarker([stop.lat, stop.lng], {
                                color: '#ff9800',
                                fillColor: '#333',
                                fillOpacity: 1,
                                weight: 2,
                                radius: 5
                            }).addTo(this.passengerMap);
                            stopMarker.bindPopup(`<strong>${stop.name}</strong>`);
                            this.simulatedDriverStopMarkers.push(stopMarker);
                        });
                    }
                }
            });
        }
    }
};
