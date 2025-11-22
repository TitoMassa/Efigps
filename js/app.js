document.addEventListener('DOMContentLoaded', () => {

    /**
     * @typedef {Object} AppState
     * @property {Object|null} currentRoute - La ruta seleccionada actualmente { name, stops: [] }.
     * @property {boolean} isSimulating - Indica si la simulación está activa.
     * @property {number} simProgress - Progreso de la simulación (0 a 100).
     * @property {number|null} simInterval - ID del intervalo de la simulación.
     * @property {boolean} highContrast - Estado del modo de alto contraste.
     * @property {boolean} mapVisible - Visibilidad del mapa de navegación.
     * @property {number} speed - Velocidad actual en km/h.
     * @property {Object|null} lastGpsPosition - Última posición GPS conocida { lat, lng, speed }.
     * @property {number|null} gpsWatchId - ID del watcher de geolocalización.
     * @property {boolean} manualMode - Modo de selección manual de parada activado.
     * @property {number} manualStopIndex - Índice de la parada seleccionada manualmente.
     * @property {number|null} editingRouteId - ID de la ruta que se está editando actualmente.
     * @property {boolean} drawingMode - Indica si se está dibujando un trazado en el editor.
     * @property {number} drawingRouteIndex - Índice de la parada desde la que se está dibujando.
     */

    /**
     * Estado global de la aplicación.
     * @type {AppState}
     */
    const state = {
        currentRoute: null,
        isSimulating: false,
        simProgress: 0,
        simInterval: null,
        highContrast: false,
        mapVisible: false,
        speed: 0,
        lastGpsPosition: null,
        gpsWatchId: null,

        // Stop Selection Mode
        manualMode: false,
        manualStopIndex: 0,

        // Editor
        editingRouteId: null,
        drawingMode: false,
        drawingRouteIndex: -1
    };

    /**
     * Referencias a elementos del DOM utilizados en la aplicación.
     */
    const els = {
        clock: document.getElementById('clock'),
        deviation: document.getElementById('deviation-display'),
        nextStop: document.getElementById('next-stop-name'),
        arrivalTime: document.getElementById('arrival-time'),
        routeName: document.getElementById('route-name'),
        speed: document.getElementById('speed'),
        screenContent: document.querySelector('.screen-content'),
        navMapContainer: document.getElementById('nav-map-container'),

        // Botones
        btnMap: document.getElementById('btn-map-toggle'),
        btnContrast: document.getElementById('btn-contrast'),
        btnRouteEditor: document.getElementById('btn-route-editor'),
        btnSimStart: document.getElementById('btn-start-sim'),
        btnUp: document.getElementById('btn-up'),
        btnDown: document.getElementById('btn-down'),

        // Controles
        modeSwitch: document.getElementById('mode-switch-input'), // Checkbox

        // Editor
        modal: document.getElementById('editor-modal'),
        closeModal: document.querySelector('.close-modal'),
        stopsList: document.getElementById('stops-list'),
        btnCalc: document.getElementById('btn-calc-times'),
        btnSave: document.getElementById('btn-save-route'),
        btnClear: document.getElementById('btn-clear-route'),
        routeNameInput: document.getElementById('route-name-input'),
        savedList: document.getElementById('saved-routes-list'),

        // Simulación
        simSlider: document.getElementById('sim-slider'),
        simStatus: document.getElementById('sim-status')
    };

    // --- Inicialización ---

    /**
     * Inicializa la aplicación.
     * Configura el reloj, carga rutas guardadas, inicia el GPS y configura eventos.
     */
    function init() {
        // Bucle del reloj
        setInterval(updateClock, 1000);

        // Init Maps
        // (MapLogic init se llama cuando se abre el modal o se alterna el mapa para evitar problemas de layout)

        // Cargar Rutas Guardadas
        loadSavedRoutes();

        // Iniciar GPS
        startGpsTracking();

        // Eventos
        setupEventListeners();
    }

    /**
     * Inicia el rastreo de ubicación GPS del navegador.
     * Actualiza `state.lastGpsPosition` y la velocidad en pantalla.
     */
    function startGpsTracking() {
        if (!navigator.geolocation) {
            console.error("Geolocalización no soportada");
            return;
        }

        state.gpsWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                state.lastGpsPosition = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    speed: pos.coords.speed // m/s
                };

                // Actualizar Visualización de Velocidad (convertir m/s a km/h)
                if (pos.coords.speed !== null) {
                    state.speed = (pos.coords.speed * 3.6).toFixed(0);
                    els.speed.textContent = `${state.speed} km/h`;
                }
            },
            (err) => {
                console.error("Error de GPS:", err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 5000
            }
        );
    }

    /**
     * Configura los listeners de eventos para botones y elementos de la interfaz.
     */
    function setupEventListeners() {
        // Botones del Dispositivo
        els.btnContrast.addEventListener('click', toggleHighContrast);
        els.btnMap.addEventListener('click', toggleNavMap);
        els.btnRouteEditor.addEventListener('click', openEditor);

        // Cambio de Modo
        if (els.modeSwitch) {
             els.modeSwitch.addEventListener('change', (e) => {
                 toggleStopSelectionMode(e.target.checked);
             });
        }

        // Editor
        els.closeModal.addEventListener('click', () => {
            els.modal.classList.add('hidden');
            state.drawingMode = false; // Asegurar salir modo dibujo
            MapLogic.renderEditorRoute(tempStops); // Redibujar limpio
        });
        els.btnCalc.addEventListener('click', calculateEditorTimes);
        els.btnSave.addEventListener('click', saveRoute);
        els.btnClear.addEventListener('click', clearEditor);

        // Simulación
        els.btnSimStart.addEventListener('click', toggleSimulation);
        els.simSlider.addEventListener('input', (e) => {
            state.simProgress = parseFloat(e.target.value);
            updateSimulationLoop();
        });

        // Vinculación Teclas Físicas (Arriba/Abajo)
        els.btnUp.addEventListener('click', () => handleArrowKey('up'));
        els.btnDown.addEventListener('click', () => handleArrowKey('down'));
    }

    /**
     * Alterna el modo de selección de parada entre Automático y Manual.
     *
     * @param {boolean} isManual - True para modo manual, False para automático.
     */
    function toggleStopSelectionMode(isManual) {
        state.manualMode = isManual;

        if (state.manualMode) {
            // Inicializar índice manual si es necesario, posiblemente al índice automático actual
            if (state.currentRoute) {
                // Encontrar lo que la lógica automática piensa que es siguiente
                const now = new Date();
                const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                const pos = getCurrentPosition();
                if (pos) {
                    const res = RouteLogic.calculateDeviation(pos.lat, pos.lng, state.currentRoute.stops, currentSec);
                    if (res) {
                        const idx = state.currentRoute.stops.findIndex(s => s.name === res.nextStop);
                        if (idx !== -1) state.manualStopIndex = idx;
                    }
                }
            }
        }
        updateClock();
    }

    /**
     * Maneja las pulsaciones de las teclas de flecha (físicas o virtuales).
     * En modo manual, cambia la parada seleccionada.
     *
     * @param {string} direction - 'up' para siguiente parada, 'down' para anterior.
     */
    function handleArrowKey(direction) {
        // Usuario: Arriba = +1 Parada, Abajo = -1 Parada

        if (state.manualMode) {
            if (!state.currentRoute) return;

            if (direction === 'up') {
                // Siguiente parada (Incrementar índice)
                state.manualStopIndex++;
                if (state.manualStopIndex >= state.currentRoute.stops.length) {
                    state.manualStopIndex = state.currentRoute.stops.length - 1;
                }
            } else {
                // Parada anterior (Decrementar índice)
                state.manualStopIndex--;
                if (state.manualStopIndex < 0) {
                    state.manualStopIndex = 0;
                }
            }
            // Forzar actualización inmediata
            updateClock();

            // Forzar llamada de actualización de desviación
            const now = new Date();
            updateDeviation(now);
        }
        // Sino: No hacer nada en Modo Auto según requerimientos.
    }

    /**
     * Ajusta el progreso de la simulación (No utilizado actualmente en la UI principal, pero útil para lógica interna).
     *
     * @param {number} delta - Cambio en el progreso.
     */
    function adjustSim(delta) {
        if (!state.isSimulating && !state.currentRoute) return;
        let newVal = state.simProgress + delta;
        newVal = Math.max(0, Math.min(100, newVal));
        state.simProgress = newVal;
        els.simSlider.value = newVal;
        updateSimulationLoop();
    }

    /**
     * Reinicia el estado de la simulación.
     */
    function resetSimulation() {
        state.isSimulating = false;
        if (state.simInterval) clearInterval(state.simInterval);
        state.simProgress = 0;
        els.simSlider.value = 0;
        els.simStatus.textContent = "Inactivo";
        els.btnSimStart.textContent = "Iniciar Simulación";
        updateClock(); // Resetear vista
    }

    /**
     * Obtiene la posición actual del dispositivo.
     * Si está simulando, devuelve la posición interpolada. Si no, devuelve la del GPS real.
     *
     * @returns {Object|null} Objeto con {lat, lng} o null si no está disponible.
     */
    function getCurrentPosition() {
         if (state.isSimulating) {
            return getSimulatedPosition(state.simProgress);
        } else {
            // GPS Real
            if (!state.lastGpsPosition) return null;
            return {
                lat: state.lastGpsPosition.lat,
                lng: state.lastGpsPosition.lng
            };
        }
    }

    // --- Características Principales ---

    /**
     * Actualiza el reloj de la pantalla y desencadena la actualización de desviación.
     * Se ejecuta cada segundo.
     */
    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour12: false });
        els.clock.textContent = timeStr;

        if (state.currentRoute) {
            updateDeviation(now);
        }
    }

    /**
     * Calcula y actualiza la visualización de la desviación (adelanto/atraso).
     *
     * @param {Date} nowDate - Objeto Date actual.
     */
    function updateDeviation(nowDate) {
        try {
            const currentSec = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds();

            // Obtener Posición
            const pos = getCurrentPosition();
            if (!pos) return;

            let lat = pos.lat;
            let lng = pos.lng;

            // Actualizar Marcador Mapa
            if (state.mapVisible) {
                MapLogic.updateUserPosition(lat, lng);
            }

            // Calcular Desviación
            let result = null;

            if (state.manualMode) {
                // Cálculo de Desviación Manual
                if (state.manualStopIndex < 0 || state.manualStopIndex >= state.currentRoute.stops.length) return;
                const targetStop = state.currentRoute.stops[state.manualStopIndex];
                const idx = state.manualStopIndex;

                if (idx === 0) {
                    // ¿Usuario seleccionó el punto de inicio?
                    // Desviación es TiempoAhora - TiempoInicio
                    const tStart = RouteLogic.timeToSeconds(targetStop.time);
                    const diff = tStart - currentSec;
                    // Si positivo, estamos temprano (inicio es en futuro).
                    // Si negativo, estamos tarde (inicio fue en pasado).
                    result = formatDeviationResult(diff, targetStop.name, tStart);
                } else {
                    // Segmento: idx-1 -> idx
                    const prevStop = state.currentRoute.stops[idx-1];

                    // Proyectar en segmento
                    const proj = RouteLogic.projectPointOnSegment(
                        {x: lat, y: lng},
                        {x: prevStop.lat, y: prevStop.lng},
                        {x: targetStop.lat, y: targetStop.lng}
                    );

                    const t1 = RouteLogic.timeToSeconds(prevStop.time);
                    const t2 = RouteLogic.timeToSeconds(targetStop.time);

                    const expectedTimeSec = t1 + (t2 - t1) * proj.ratio;
                    const diff = expectedTimeSec - currentSec; // + adelante, - atrás

                    result = formatDeviationResult(diff, targetStop.name, expectedTimeSec);
                }

            } else {
            // Auto
            result = RouteLogic.calculateDeviation(lat, lng, state.currentRoute.stops, currentSec);
        }

        if (result) {
            // Mostrar
            els.deviation.textContent = result.deviationStr;

            // Color/Estilo
            els.deviation.classList.remove('late', 'early');
            if (result.deviationSec >= 0) {
                els.deviation.classList.add('early');
            } else {
                els.deviation.classList.add('late');
            }

            els.nextStop.textContent = result.nextStop;

            // Actualizar Hora de Llegada
            const nextStopObj = state.currentRoute.stops.find(s => s.name === result.nextStop);
            if (nextStopObj) {
                els.arrivalTime.textContent = nextStopObj.time.substring(0, 5);
            }

            // Sincronizar Índice Manual si en Modo Auto (para que al cambiar a manual estemos en el correcto)
            if (!state.manualMode) {
                 const idx = state.currentRoute.stops.findIndex(s => s.name === result.nextStop);
                 if (idx !== -1) state.manualStopIndex = idx;
            }

            // Actualizar Marcadores Mapa (Verde para siguiente parada)
            if (state.mapVisible) {
                MapLogic.updateStopMarkers(result.nextStop);
            }
        }
    } catch (e) {
        console.error("Error de Desviación:", e);
    }
    }

    /**
     * Formatea el resultado numérico de la desviación en una estructura utilizable por la UI.
     *
     * @param {number} diff - Diferencia en segundos.
     * @param {string} nextStopName - Nombre de la siguiente parada.
     * @param {number} expectedTime - Tiempo esperado en segundos.
     * @returns {Object} Objeto con datos formateados de desviación.
     */
    function formatDeviationResult(diff, nextStopName, expectedTime) {
        const absDiff = Math.abs(diff);
        const m = Math.floor(absDiff / 60);
        const s = Math.floor(absDiff % 60);
        const sign = diff >= 0 ? '+' : '-';
        const str = `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        return {
            deviationSec: diff,
            deviationStr: str,
            nextStop: nextStopName,
            expectedTimeSec: expectedTime
        };
    }

    // --- Lógica de Simulación ---

    /**
     * Calcula la posición simulada en la ruta basada en un porcentaje de progreso.
     *
     * @param {number} progressPercent - Porcentaje de progreso (0-100).
     * @returns {Object|null} Coordenadas {lat, lng} correspondientes al progreso.
     */
    function getSimulatedPosition(progressPercent) {
        if (!state.currentRoute || state.currentRoute.stops.length < 2) return null;

        const stops = state.currentRoute.stops;
        // Calcular distancia total
        let totalDist = 0;
        const dists = [];
        for(let i=0; i<stops.length-1; i++) {
            // Usar getPathTotalDistance para simulación precisa
            const points = RouteLogic.getSegmentPoints(stops[i], stops[i+1]);
            const d = RouteLogic.getPathTotalDistance(points);
            dists.push(d);
            totalDist += d;
        }

        const targetDist = totalDist * (progressPercent / 100);

        // Encontrar segmento
        let covered = 0;
        for(let i=0; i<dists.length; i++) {
            if (covered + dists[i] >= targetDist) {
                // En este segmento PARADA-A-PARADA
                // Ahora necesitamos encontrar dónde en la polilínea estamos.
                const points = RouteLogic.getSegmentPoints(stops[i], stops[i+1]);
                const distInSegment = targetDist - covered;

                let subCovered = 0;
                for(let j=0; j<points.length-1; j++) {
                    const d = RouteLogic.getDistance(points[j].lat, points[j].lng, points[j+1].lat, points[j+1].lng);
                    if (subCovered + d >= distInSegment) {
                         const ratio = d > 0 ? (distInSegment - subCovered) / d : 0;
                         const A = points[j];
                         const B = points[j+1];
                         return {
                            lat: A.lat + (B.lat - A.lat) * ratio,
                            lng: A.lng + (B.lng - A.lng) * ratio
                         };
                    }
                    subCovered += d;
                }
            }
            covered += dists[i];
        }
        // Fin de ruta
        const last = stops[stops.length-1];
        return { lat: last.lat, lng: last.lng };
    }

    /**
     * Inicia o detiene la simulación.
     */
    function toggleSimulation() {
        if (state.isSimulating) {
            state.isSimulating = false;
            els.btnSimStart.textContent = "Iniciar Simulación";
            els.simSlider.disabled = true;
            els.simStatus.textContent = "Inactivo";
            if (state.simInterval) clearInterval(state.simInterval);
        } else {
            if (!state.currentRoute) {
                alert("Primero cargue una bandera.");
                return;
            }
            state.isSimulating = true;
            els.btnSimStart.textContent = "Detener Simulación";
            els.simSlider.disabled = false;
            els.simStatus.textContent = "Simulando...";

            state.simInterval = setInterval(() => {
                if (state.simProgress < 100) {
                   // Espacio para auto-movimiento si se desea
                }
            }, 100);
        }
    }

    /**
     * Actualiza el bucle de simulación (refresca reloj y cálculos).
     */
    function updateSimulationLoop() {
        // Disparar actualización manualmente
        updateClock();
    }

    // --- Lógica del Editor ---

    /** @type {Array<Object>} Lista temporal de paradas en edición */
    let tempStops = [];

    /**
     * Abre el modal del editor de rutas.
     * Inicializa el mapa del editor si es necesario y carga la ruta a editar.
     */
    function openEditor() {
        els.modal.classList.remove('hidden');
        // Init mapa después de visible
        setTimeout(() => {
            MapLogic.initEditorMap('editor-map', (latlng) => {
                handleMapClick(latlng);
            });
            MapLogic.editorMap.invalidateSize();
        }, 100);

        // Reset estado editor
        if (!state.editingRouteId) {
            clearEditor();
        } else {
            // Si editando existente, renderizarla
            MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        }
    }

    /**
     * Maneja el clic en el mapa del editor.
     * Dependiendo del modo, añade una parada o un punto de trazado.
     *
     * @param {Object} latlng - Coordenadas del clic.
     */
    function handleMapClick(latlng) {
        if (state.drawingMode) {
            addPathPoint(latlng);
        } else {
            addStopToEditor(latlng);
        }
    }

    /**
     * Añade una nueva parada a la lista de edición.
     *
     * @param {Object} latlng - Coordenadas de la nueva parada.
     */
    function addStopToEditor(latlng) {
        const count = tempStops.length + 1;
        const stop = {
            name: `Parada ${count}`,
            lat: latlng.lat,
            lng: latlng.lng,
            time: '',
            pathNext: [] // Init path vacío
        };
        tempStops.push(stop);
        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList();
    }

    /**
     * Actualiza la ubicación de una parada existente (por arrastre).
     *
     * @param {number} index - Índice de la parada.
     * @param {number} lat - Nueva latitud.
     * @param {number} lng - Nueva longitud.
     */
    function updateStopLocation(index, lat, lng) {
        if (tempStops[index]) {
            tempStops[index].lat = lat;
            tempStops[index].lng = lng;

            // Re-render ruta línea porque se movió
            MapLogic.renderEditorRoute(tempStops, updateStopLocation);
            renderStopList(); // Actualizar coordenadas mostradas
        }
    }

    /**
     * Añade un punto intermedio (trazado) a la parada activa.
     *
     * @param {Object} latlng - Coordenadas del punto.
     */
    function addPathPoint(latlng) {
        if (state.drawingRouteIndex === -1) return;
        const stop = tempStops[state.drawingRouteIndex];
        if (!stop.pathNext) stop.pathNext = [];

        stop.pathNext.push({lat: latlng.lat, lng: latlng.lng});

        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList(); // Para mostrar botón Deshacer habilitado?
    }

    /**
     * Inicia el modo de dibujo para un segmento específico.
     *
     * @param {number} index - Índice de la parada de origen.
     */
    function startDrawing(index) {
        state.drawingMode = true;
        state.drawingRouteIndex = index;

        // Limpiar camino existente para dejar al usuario redibujar
        tempStops[index].pathNext = [];

        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList();
    }

    /**
     * Deshace el último punto añadido en modo dibujo.
     */
    function undoLastPoint() {
        if (!state.drawingMode || state.drawingRouteIndex === -1) return;
        const stop = tempStops[state.drawingRouteIndex];
        if (stop.pathNext && stop.pathNext.length > 0) {
            stop.pathNext.pop();
            MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        }
    }

    /**
     * Finaliza el modo de dibujo.
     */
    function stopDrawing() {
        state.drawingMode = false;
        state.drawingRouteIndex = -1;
        renderStopList();
    }

    /**
     * Renderiza la lista de paradas en el panel lateral del editor.
     * Genera el HTML para cada ítem de parada y controles de dibujo.
     */
    function renderStopList() {
        els.stopsList.innerHTML = '';
        tempStops.forEach((stop, idx) => {
            // Item Parada
            const div = document.createElement('div');
            div.className = 'stop-item';
            div.innerHTML = `
                <div class="stop-header">
                    <strong>${idx === 0 ? 'Inicio' : idx === tempStops.length - 1 ? 'Fin' : 'Parada ' + (idx+1)}</strong>
                </div>
                <div class="stop-details">
                    <span class="coord">Lat: ${stop.lat.toFixed(4)}, Lng: ${stop.lng.toFixed(4)}</span>
                    <div class="time-input-group">
                        <label>Hora:</label>
                        <input type="time" step="1" value="${stop.time}" onchange="updateStopTime(${idx}, this.value)">
                    </div>
                </div>
            `;
            els.stopsList.appendChild(div);

            // Botón Dibujar (Solo entre paradas)
            if (idx < tempStops.length - 1) {
                const drawContainer = document.createElement('div');
                drawContainer.className = 'draw-container';
                drawContainer.style.textAlign = 'center';
                drawContainer.style.margin = '5px 0';

                if (state.drawingMode && state.drawingRouteIndex === idx) {
                    // Controles de Dibujo Activos
                    drawContainer.innerHTML = `
                        <div style="background: #eef; padding: 5px; border: 1px dashed #00f; border-radius: 5px;">
                            <small>Dibujando tramo...</small><br>
                            <button onclick="window.undoDrawing()" style="margin-right: 5px;">Deshacer Puntos</button>
                            <button onclick="window.finishDrawing()">Terminar</button>
                        </div>
                    `;
                } else {
                    // Botón Iniciar Dibujo
                    const btnDraw = document.createElement('button');
                    btnDraw.innerHTML = '<i class="fa-solid fa-pencil"></i> Dibujar Trazado';
                    btnDraw.style.fontSize = '12px';
                    btnDraw.onclick = () => startDrawing(idx);
                    // Deshabilitar si ya se está dibujando otro segmento
                    if (state.drawingMode) btnDraw.disabled = true;

                    drawContainer.appendChild(btnDraw);
                }
                els.stopsList.appendChild(drawContainer);
            }
        });
    }

    // Exponer helpers a window para onclicks en innerHTML
    /**
     * Actualiza la hora de una parada desde el input HTML.
     * @param {number} idx - Índice de la parada.
     * @param {string} val - Valor de tiempo.
     */
    window.updateStopTime = function(idx, val) {
        tempStops[idx].time = val;
        if (val.length === 5) tempStops[idx].time = val + ":00";
        else tempStops[idx].time = val;
    };

    /** Wrapper global para deshacer dibujo */
    window.undoDrawing = function() {
        undoLastPoint();
    };

    /** Wrapper global para finalizar dibujo */
    window.finishDrawing = function() {
        stopDrawing();
    };

    /**
     * Calcula los tiempos intermedios para las paradas en el editor utilizando RouteLogic.
     */
    function calculateEditorTimes() {
        tempStops = RouteLogic.calculateIntermediateTimes(tempStops);
        renderStopList();
    }

    /**
     * Guarda la ruta actual en el LocalStorage.
     * Valida que haya al menos 2 paradas y horarios de inicio/fin.
     */
    function saveRoute() {
        const name = els.routeNameInput.value || "Sin Nombre";
        if (tempStops.length < 2) {
            alert("Necesita al menos 2 paradas.");
            return;
        }
        // Validación: Tiempos inicio y fin requeridos
        if (!tempStops[0].time || !tempStops[tempStops.length-1].time) {
            alert("La primera y última parada deben tener horario.");
            return;
        }

        const route = {
            id: state.editingRouteId || Date.now(),
            name: name,
            stops: JSON.parse(JSON.stringify(tempStops))
        };

        const saved = JSON.parse(localStorage.getItem('gps_routes') || '[]');

        if (state.editingRouteId) {
            // Actualizar existente
            const index = saved.findIndex(r => r.id === state.editingRouteId);
            if (index !== -1) {
                saved[index] = route;
            } else {
                saved.push(route); // Fallback
            }
        } else {
            // Crear nueva
            saved.push(route);
        }

        localStorage.setItem('gps_routes', JSON.stringify(saved));

        // alert("Ruta guardada!"); // REMOVED ALERT TO FIX PLAYWRIGHT TIMING
        clearEditor(); // Reset
        loadSavedRoutes();
        els.modal.classList.add('hidden'); // Ocultar manual en lugar de esperar alerta

        // Seleccionar siempre la ruta guardada
        selectRoute(route);
    }

    /**
     * Limpia el estado del editor y resetea la vista.
     */
    function clearEditor() {
        tempStops = [];
        state.editingRouteId = null;
        els.routeNameInput.value = '';
        state.drawingMode = false; // Reset estado
        state.drawingRouteIndex = -1;
        MapLogic.clearEditor();
        renderStopList();

        // Si se añaden botones cancelar/nuevo luego, actualizar texto
        els.btnSave.textContent = "Guardar Bandera";
    }

    /**
     * Carga las rutas guardadas desde LocalStorage y las renderiza en la lista.
     */
    function loadSavedRoutes() {
        const saved = JSON.parse(localStorage.getItem('gps_routes') || '[]');
        els.savedList.innerHTML = '';
        if (saved.length === 0) {
            els.savedList.innerHTML = '<li>No hay banderas guardadas.</li>';
            return;
        }

        saved.forEach(r => {
            const li = document.createElement('li');
            li.className = 'saved-route-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'route-name-label';
            nameSpan.textContent = r.name;
            nameSpan.onclick = () => {
                selectRoute(r);
                els.modal.classList.add('hidden');
            };

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'route-actions';

            const editBtn = document.createElement('button');
            editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            editBtn.title = "Editar";
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editRoute(r);
            };

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.title = "Eliminar";
            delBtn.className = 'btn-danger';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteRoute(r.id);
            };

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(delBtn);

            li.appendChild(nameSpan);
            li.appendChild(actionsDiv);

            els.savedList.appendChild(li);
        });
    }

    /**
     * Carga una ruta en el editor para su modificación.
     *
     * @param {Object} route - Objeto de ruta a editar.
     */
    function editRoute(route) {
        state.editingRouteId = route.id;
        els.routeNameInput.value = route.name;
        tempStops = JSON.parse(JSON.stringify(route.stops));

        // Asegurar pathNext existe
        tempStops.forEach(s => {
            if (!s.pathNext) s.pathNext = [];
        });

        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList();
        els.btnSave.textContent = "Actualizar Bandera";
    }

    /**
     * Elimina una ruta guardada.
     *
     * @param {number} id - ID de la ruta a eliminar.
     */
    function deleteRoute(id) {
        if (!confirm("¿Seguro que desea eliminar esta bandera?")) return;

        let saved = JSON.parse(localStorage.getItem('gps_routes') || '[]');
        saved = saved.filter(r => r.id !== id);
        localStorage.setItem('gps_routes', JSON.stringify(saved));

        loadSavedRoutes();

        if (state.currentRoute && state.currentRoute.id === id) {
            state.currentRoute = null;
            els.routeName.textContent = "SIN BANDERA";
            // Limpiar nav map
            if (state.mapVisible) MapLogic.initNavMap('nav-map'); // reset view
        }
    }

    /**
     * Selecciona una ruta como activa para la navegación.
     *
     * @param {Object} route - La ruta a activar.
     */
    function selectRoute(route) {
        state.currentRoute = route;
        els.routeName.textContent = route.name;

        // Reset Nav Map
        if (state.mapVisible) {
             MapLogic.loadRouteOnNavMap(route.stops);
        }
    }

    // --- Toggles UI Dispositivo ---

    /**
     * Alterna el modo de alto contraste de la pantalla.
     */
    function toggleHighContrast() {
        state.highContrast = !state.highContrast;
        if (state.highContrast) {
            els.screenContent.classList.add('high-contrast');
        } else {
            els.screenContent.classList.remove('high-contrast');
        }
    }

    /**
     * Alterna la visibilidad del mapa de navegación en pantalla.
     */
    function toggleNavMap() {
        state.mapVisible = !state.mapVisible;
        if (state.mapVisible) {
            els.navMapContainer.classList.remove('hidden');
            MapLogic.initNavMap('nav-map');
            setTimeout(() => {
                MapLogic.navMap.invalidateSize();
                if (state.currentRoute) {
                    MapLogic.loadRouteOnNavMap(state.currentRoute.stops);
                }
            }, 100);
        } else {
            els.navMapContainer.classList.add('hidden');
        }
    }

    // Run
    init();
});
