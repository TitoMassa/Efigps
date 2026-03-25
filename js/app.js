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
        drawingRouteIndex: -1,

        // Itinerario Activo (Modo PRO)
        activeItinerary: null, // Lista completa de viajes
        activeTripIndex: -1,   // Índice del viaje actual
        isServiceFinished: false, // Indica si terminó todo el diagrama

        // Simulated Drivers
        simulatedDrivers: [], // Array of simulated driver objects

        // Driver Info
        driver: {
            driverId: null,
            carNumber: null,
            serviceId: null,
            scheduleType: null
        }
    };

    // Exponer estado para depuración
    window.appState = state;

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
        lapDisplay: document.getElementById('lap-display'),

        // Botones
        btnMap: document.getElementById('btn-map-toggle'),
        btnContrast: document.getElementById('btn-contrast'),
        btnRouteEditor: document.getElementById('btn-route-editor'),
        btnProMode: document.getElementById('btn-pro-mode'),
        btnSimStart: document.getElementById('btn-start-sim'),
        btnUp: document.getElementById('btn-up'),
        btnDown: document.getElementById('btn-down'),

        // Controles
        modeSwitch: document.getElementById('mode-switch-input'), // Checkbox

        // Editor
        modal: document.getElementById('editor-modal'),
        closeModal: document.getElementById('close-editor-modal'),
        stopsList: document.getElementById('stops-list'),
        btnCalc: document.getElementById('btn-calc-times'),
        btnSave: document.getElementById('btn-save-route'),
        btnClear: document.getElementById('btn-clear-route'),
        routeNameInput: document.getElementById('route-name-input'),
        savedList: document.getElementById('saved-routes-list'),

        // PRO Mode Elements
        proModal: document.getElementById('pro-modal'),
        closeProModal: document.getElementById('close-pro-modal'),
        proLinesView: document.getElementById('pro-lines-view'),
        proLineEditor: document.getElementById('pro-line-editor'),
        proDriverView: document.getElementById('pro-driver-view'),
        linesList: document.getElementById('lines-list'),
        btnCreateLine: document.getElementById('btn-create-line'),

        // Line Editor Inputs
        lineNameInput: document.getElementById('line-name-input'),
        lineStartTime: document.getElementById('line-start-time'),
        lineEndTime: document.getElementById('line-end-time'),
        lineTurns: document.getElementById('line-turns'),
        restsContainer: document.getElementById('rests-container'),
        btnSaveLine: document.getElementById('btn-save-line'),
        btnCancelLine: document.getElementById('btn-cancel-line'),
        btnDeleteLine: document.getElementById('btn-delete-line'),

        // Driver View
        driverLineTitle: document.getElementById('driver-line-title'),
        tripsList: document.getElementById('trips-list'),
        btnBackLines: document.getElementById('btn-back-lines'),

        // Menú de Usuario
        userMenu: document.getElementById('user-menu-modal'),
        closeUserMenu: document.getElementById('close-user-menu'),
        btnMenuEditor: document.getElementById('btn-menu-editor'),
        btnMenuStopNav: document.getElementById('btn-menu-stop-nav'),
        btnMenuLogout: document.getElementById('btn-menu-logout'),

        // Simulación
        simSlider: document.getElementById('sim-slider'),
        simStatus: document.getElementById('sim-status'),

        // Conductores Simulados (General)
        simulatedDriversContainer: document.getElementById('simulated-drivers-container') || null,

        // Modo Pasajeros
        btnPassengerMode: document.getElementById('btn-passenger-mode'),
        passengerModal: document.getElementById('passenger-modal'),
        btnClosePassenger: document.getElementById('btn-close-passenger'),
        passengerSelectLine: document.getElementById('passenger-select-line'),
        passengerSelectRoute: document.getElementById('passenger-select-route'),
        passengerSelectStop: document.getElementById('passenger-select-stop'),
        passengerEtaList: document.getElementById('passenger-eta-list'),
        btnPassengerMap: document.getElementById('btn-passenger-map'),
        passengerMapContainer: document.getElementById('passenger-map-container')
    };

    let passengerUpdateInterval = null;
    let passengerMapVisible = false;

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

        // Cargar Datos del Conductor
        loadDriverFromStorage();

        // Iniciar GPS
        startGpsTracking();

        // Eventos
        setupEventListeners();

        // Verificar Login
        checkLoginStatus();
    }

    function loadDriverFromStorage() {
        const stored = localStorage.getItem('gps_driver');
        if (stored) {
            state.driver = JSON.parse(stored);
        }
    }

    function checkLoginStatus() {
        if (!state.driver.driverId) {
            // Mostrar modal de login si no hay datos
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.classList.remove('hidden');
        } else {
             updateInfoBar();
        }
    }

    window.loginDriver = function(data) {
        state.driver = data;
        localStorage.setItem('gps_driver', JSON.stringify(data));
        updateInfoBar();
    };

    window.logoutDriver = function() {
        state.driver = { driverId: null, carNumber: null, serviceId: null, scheduleType: null };
        localStorage.removeItem('gps_driver');
        location.reload(); // Recargar para forzar login
    };

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
        els.btnRouteEditor.addEventListener('click', openUserMenu); // Cambiado a openUserMenu
        if (els.btnProMode) els.btnProMode.addEventListener('click', openProMode);

        // Cambio de Modo
        if (els.modeSwitch) {
             els.modeSwitch.addEventListener('change', (e) => {
                 toggleStopSelectionMode(e.target.checked);
             });
        }

        // Menú de Usuario
        if (els.closeUserMenu) els.closeUserMenu.addEventListener('click', () => els.userMenu.classList.add('hidden'));

        if (els.btnMenuEditor) {
            els.btnMenuEditor.addEventListener('click', () => {
                els.userMenu.classList.add('hidden');
                openEditor();
            });
        }

        if (els.btnMenuStopNav) {
            els.btnMenuStopNav.addEventListener('click', () => {
                if(confirm("¿Seguro que desea detener la navegación actual?")) {
                    stopNavigation();
                    els.userMenu.classList.add('hidden');
                }
            });
        }

        if (els.btnMenuLogout) {
            els.btnMenuLogout.addEventListener('click', () => {
                if(confirm("¿Seguro que desea cerrar sesión?")) {
                    window.logoutDriver();
                }
            });
        }

        // Editor Rutas
        els.closeModal.addEventListener('click', () => {
            els.modal.classList.add('hidden');
            stopDrawing(); // Asegurar salir modo dibujo y limpiar estado UI
            MapLogic.renderEditorRoute(tempStops); // Redibujar limpio
        });
        els.btnCalc.addEventListener('click', calculateEditorTimes);
        els.btnSave.addEventListener('click', saveRoute);
        els.btnClear.addEventListener('click', clearEditor);

        // PRO Mode Events
        els.closeProModal.addEventListener('click', () => els.proModal.classList.add('hidden'));
        els.btnCreateLine.addEventListener('click', () => openLineEditor(null));
        els.lineTurns.addEventListener('change', generateRestInputs);
        els.lineTurns.addEventListener('keyup', generateRestInputs);
        els.btnSaveLine.addEventListener('click', saveLine);
        els.btnCancelLine.addEventListener('click', () => {
            els.proLineEditor.classList.add('hidden');
            els.proLinesView.classList.remove('hidden');
        });
        els.btnDeleteLine.addEventListener('click', deleteLine);
        els.btnBackLines.addEventListener('click', () => {
            els.proDriverView.classList.add('hidden');
            els.proLinesView.classList.remove('hidden');
        });

        // Simulación
        els.btnSimStart.addEventListener('click', toggleSimulation);
        els.simSlider.addEventListener('input', (e) => {
            state.simProgress = parseFloat(e.target.value);
            updateSimulationLoop();
        });

        // Vinculación Teclas Físicas (Arriba/Abajo)
        els.btnUp.addEventListener('click', () => handleArrowKey('up'));
        els.btnDown.addEventListener('click', () => handleArrowKey('down'));

        // Login Events
        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) {
            btnLogin.addEventListener('click', handleLoginSubmit);
        }

        // Passenger Mode Events
        if (els.btnPassengerMode) {
            els.btnPassengerMode.addEventListener('click', openPassengerMode);
        }
        if (els.btnClosePassenger) {
            els.btnClosePassenger.addEventListener('click', closePassengerMode);
        }
        if (els.passengerSelectLine) {
            els.passengerSelectLine.addEventListener('change', updatePassengerRoutes);
        }
        if (els.passengerSelectRoute) {
            els.passengerSelectRoute.addEventListener('change', updatePassengerStops);
        }
        if (els.passengerSelectStop) {
            els.passengerSelectStop.addEventListener('change', () => {
                updatePassengerETAs();
                if (passengerMapVisible) {
                    updatePassengerMap();
                }
            });
        }
        if (els.btnPassengerMap) {
            els.btnPassengerMap.addEventListener('click', togglePassengerMap);
        }

        // User Button (Profile/Logout)
        // Buscamos el botón de usuario (el segundo botón amarillo en la imagen original, o creamos uno nuevo)
        // En el HTML actual no hay ID específico para ese botón, pero asumimos que el usuario
        // lo quiere en el botón "m" o "PRO" o uno nuevo.
        // El sketch muestra un botón "m".
        // Vamos a vincular un botón existente o añadir un handler genérico si existiera.
        // Por ahora, añadimos lógica para mostrar logout si se hace click en algún lugar específico o
        // añadimos un botón de logout en el modal de PRO mode temporalmente.
    }

    function handleLoginSubmit() {
        const legajo = document.getElementById('login-legajo').value;
        const coche = document.getElementById('login-coche').value;
        const servicio = document.getElementById('login-servicio').value;
        const horario = document.getElementById('login-horario').value;

        if (!legajo || legajo.length !== 5) {
            alert("El legajo debe tener 5 dígitos.");
            return;
        }
        if (!coche || !servicio || !horario) {
            alert("Complete todos los campos.");
            return;
        }

        const data = {
            driverId: legajo,
            carNumber: coche,
            serviceId: servicio,
            scheduleType: horario
        };

        window.loginDriver(data);
        document.getElementById('login-modal').classList.add('hidden');
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

                // Verificar si intentamos pasar del final (Transición de Tramo)
                if (state.manualStopIndex >= state.currentRoute.stops.length) {
                    state.manualStopIndex = state.currentRoute.stops.length - 1;

                    if (state.activeItinerary) {
                        checkEndOfLegTransition();
                        return; // Salir para evitar actualizar desviación con el índice viejo
                    }
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
    function simulateDriversTick(now) {
        const lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        const savedRoutes = JSON.parse(localStorage.getItem('gps_routes') || '[]');
        const persistentDrivers = JSON.parse(localStorage.getItem('gps_simulated_drivers') || '{}');
        const currentTimeSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        // Determine the line currently driven by human (if any)
        let humanLineId = null;
        if (state.activeItinerary && state.activeItinerary.length > 0) {
            const humanLineName = state.currentRoute ? state.currentRoute.lineName : null;
            if (humanLineName) {
                 const hLine = lines.find(l => l.name === humanLineName);
                 if (hLine) humanLineId = hLine.id;
            }
        }

        const activeDrivers = [];

        lines.forEach(line => {
            // Skip the human's line
            if (line.id === humanLineId) return;

            // Find or create simulated driver for this line
            let driver = state.simulatedDrivers.find(d => d.lineId === line.id);

            const trips = ScheduleLogic.calculateItinerary({
                startTime: line.start,
                endTime: line.end,
                turns: line.turns,
                rests: line.rests || []
            }, savedRoutes);

            if (!trips || trips.length === 0) {
                if (driver) state.simulatedDrivers = state.simulatedDrivers.filter(d => d.lineId !== line.id);
                return;
            }

            const startDt = new Date(line.start);
            const endDt = new Date(line.end);

            if (now >= startDt && now <= endDt) {
                if (!driver) {
                    let pDriver = persistentDrivers[line.id];

                    if (!pDriver) {
                        const firstNames = ["JUAN", "CARLOS", "MIGUEL", "JOSE", "LUIS", "DIEGO", "MARCOS", "PABLO", "GABRIEL", "ALEJANDRO"];
                        const lastNames = ["GOMEZ", "RODRIGUEZ", "FERNANDEZ", "LOPEZ", "MARTINEZ", "PEREZ", "GARCIA", "SANCHEZ", "ROMERO", "SOSA"];
                        const prefixes = ["10", "12", "14", "19", "98"];

                        const fn1 = firstNames[Math.floor(Math.random() * firstNames.length)];
                        const fn2 = firstNames[Math.floor(Math.random() * firstNames.length)];
                        const ln = lastNames[Math.floor(Math.random() * lastNames.length)];

                        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                        const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                        const legajo = prefix + suffix;

                        // Inicializar el offset de tiempo. Positivo = Chofer adelantado físicamente, Negativo = Atrasado.
                        const initialTimeOffset = Math.floor(Math.random() * 601) - 300;

                        pDriver = {
                            name: `${ln} ${fn1} ${fn2} (${legajo})`,
                            legajo: legajo,
                            timeOffset: initialTimeOffset,
                            showTrace: false
                        };
                        persistentDrivers[line.id] = pDriver;
                        localStorage.setItem('gps_simulated_drivers', JSON.stringify(persistentDrivers));
                    }

                    driver = {
                        lineId: line.id,
                        lineName: line.name,
                        name: pDriver.name,
                        legajo: pDriver.legajo,
                        timeOffset: pDriver.timeOffset, // Controla físicamente qué tan rápido va en la simulación
                        showTrace: pDriver.showTrace || false,
                        deviation: 0, // Se calculará abajo basándose en la posición física real
                        lat: null,
                        lng: null,
                        currentTripIndex: 0,
                        trips: trips
                    };
                    state.simulatedDrivers.push(driver);
                } else {
                    // Update from persistence in case it changed (like showTrace)
                    if (persistentDrivers[line.id]) {
                        driver.showTrace = persistentDrivers[line.id].showTrace;
                    }
                }

                // Random walk on timeOffset to humanize
                if (Math.random() < 0.05) {
                    driver.timeOffset += (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5 + 1);
                    driver.timeOffset = Math.max(-900, Math.min(900, driver.timeOffset));

                    // Persist
                    persistentDrivers[line.id].timeOffset = driver.timeOffset;
                    localStorage.setItem('gps_simulated_drivers', JSON.stringify(persistentDrivers));
                }

                // La posición física del chofer está dictada por su timeOffset
                const simTimeSec = currentTimeSec + driver.timeOffset;

                let currentTrip = null;
                let tripIndex = -1;

                for (let i = 0; i < trips.length; i++) {
                    const startSec = RouteLogic.timeToSeconds(trips[i].stops[0].time);
                    const endSec = RouteLogic.timeToSeconds(trips[i].stops[trips[i].stops.length - 1].time);
                    if (simTimeSec >= startSec && simTimeSec <= endSec) {
                        currentTrip = trips[i];
                        tripIndex = i;
                        break;
                    }
                }

                if (currentTrip) {
                    driver.currentTripIndex = tripIndex;
                    driver.bannerName = currentTrip.routeOriginalName || currentTrip.direction;

                    const stops = currentTrip.stops;
                    for (let i = 0; i < stops.length - 1; i++) {
                        const t1 = RouteLogic.timeToSeconds(stops[i].time);
                        const t2 = RouteLogic.timeToSeconds(stops[i+1].time);
                        if (simTimeSec >= t1 && simTimeSec <= t2) {
                            const ratio = t2 === t1 ? 0 : (simTimeSec - t1) / (t2 - t1);
                            const points = RouteLogic.getSegmentPoints(stops[i], stops[i+1]);
                            const totalDist = RouteLogic.getPathTotalDistance(points);
                            const targetDist = totalDist * ratio;

                            let accumDist = 0;
                            for(let j = 0; j < points.length - 1; j++) {
                                const d = RouteLogic.getDistance(points[j].lat, points[j].lng, points[j+1].lat, points[j+1].lng);
                                if (accumDist + d >= targetDist) {
                                    const subRatio = d === 0 ? 0 : (targetDist - accumDist) / d;
                                    driver.lat = points[j].lat + (points[j+1].lat - points[j].lat) * subRatio;
                                    driver.lng = points[j].lng + (points[j+1].lng - points[j].lng) * subRatio;
                                    break;
                                }
                                accumDist += d;
                            }
                            if (driver.lat === null && points.length > 0) {
                                 driver.lat = points[points.length-1].lat;
                                 driver.lng = points[points.length-1].lng;
                            }
                            break;
                        }
                    }

                    // Ahora que tenemos la posición física, calculamos la desviación estrictamente en base a ella
                    if (driver.lat !== null && driver.lng !== null) {
                        const devResult = RouteLogic.calculateDeviation(driver.lat, driver.lng, stops, currentTimeSec);
                        if (devResult) {
                            driver.deviation = devResult.deviationSec;
                        } else {
                            driver.deviation = 0;
                        }
                    }

                } else {
                     driver.bannerName = "ESPERA";
                     driver.deviation = 0;
                     driver.lat = null;
                     driver.lng = null;
                }

                activeDrivers.push(driver);
            } else {
                if (driver) state.simulatedDrivers = state.simulatedDrivers.filter(d => d.lineId !== line.id);
            }
        });

        renderSimulatedDrivers(activeDrivers);
        MapLogic.renderSimulatedDrivers(activeDrivers);
    }

    function renderSimulatedDrivers(drivers) {
        if (!els.simulatedDriversContainer) return;

        if (drivers.length === 0) {
            els.simulatedDriversContainer.innerHTML = '<i>Sin choferes simulados activos.</i>';
            return;
        }

        let html = '';
        drivers.forEach(d => {
            const sign = d.deviation >= 0 ? '+' : '-';
            const absDev = Math.abs(d.deviation);
            const m = Math.floor(absDev / 60).toString().padStart(2, '0');
            const s = Math.floor(absDev % 60).toString().padStart(2, '0');
            const devStr = `${sign}${m}:${s}`;

            const isChecked = d.showTrace ? 'checked' : '';

            html += `<div style="font-size:12px; font-family: 'Roboto Mono', monospace; background:#222; color:#fff; padding:5px; margin-bottom:5px; border-radius:3px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        LINEA: ${d.lineName}<br>
                        BANDERA: ${d.bannerName}<br>
                        CHOFER: ${d.name}<br>
                        DESVIO: ${devStr}
                    </div>
                    <div style="text-align: center;">
                        <input type="checkbox" id="trace-sim-${d.lineId}" onchange="window.toggleSimulatedTrace(${d.lineId}, this.checked)" ${isChecked}>
                        <label for="trace-sim-${d.lineId}" style="display:block; font-size:10px; cursor:pointer;">Trazado</label>
                    </div>
                </div>
            </div>`;
        });

        els.simulatedDriversContainer.innerHTML = html;
    }

    window.toggleSimulatedTrace = function(lineId, isChecked) {
        const persistentDrivers = JSON.parse(localStorage.getItem('gps_simulated_drivers') || '{}');
        if (persistentDrivers[lineId]) {
            persistentDrivers[lineId].showTrace = isChecked;
            localStorage.setItem('gps_simulated_drivers', JSON.stringify(persistentDrivers));

            // Update live state immediately
            const driver = state.simulatedDrivers.find(d => d.lineId === lineId);
            if (driver) {
                driver.showTrace = isChecked;
                updateClock(); // Force map render
            }
        }
    };

    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour12: false });
        els.clock.textContent = timeStr;

        if (state.currentRoute) {
            updateDeviation(now);
        }

        simulateDriversTick(now);

        // Update Info Bar if data changed or just to ensure consistency
        updateInfoBar();
    }

    function updateInfoBar() {
        // Format: Line - Service - Banner - Car - Schedule - Driver
        // Example: 106B - 1 - NUPU - 3222 - HABILES - 98538

        let lineName = "???";
        let bannerName = "???";

        if (state.currentRoute && state.currentRoute.bannerName) {
            // Pro Mode with stored details or manually selected route with banner info
            lineName = state.currentRoute.lineName || "---";
            bannerName = state.currentRoute.bannerName;
        } else if (state.activeItinerary && state.activeTripIndex >= 0) {
            // Fallback for Pro Mode if details missing
            const fullStr = state.currentRoute ? state.currentRoute.name : "---";
            // Heuristic: Split by '('
            const parts = fullStr.split('(');
            lineName = parts[0].trim();
            bannerName = parts[1] ? parts[1].replace(')', '').trim() : "---";
        } else {
            // Standard Mode
            lineName = "---";
            bannerName = state.currentRoute ? state.currentRoute.name : "SIN BANDERA";
        }

        const srv = state.driver.serviceId || "?";
        const car = state.driver.carNumber || "????";
        const sch = state.driver.scheduleType || "????";
        const leg = state.driver.driverId || "?????";

        const infoStr = `${lineName} - ${srv} - ${bannerName} - ${car} - ${sch} - ${leg}`;
        const el = document.getElementById('info-string');
        if (el) el.textContent = infoStr;
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

            // Si no hay ruta cargada, no calculamos desviación ni lógica de tramo
            if (!state.currentRoute) return;

            // Detectar fin de recorrido y cambiar automáticamente (Modo PRO + Auto)
            if (state.activeItinerary && !state.manualMode && state.currentRoute.stops.length > 0) {
                const lastStop = state.currentRoute.stops[state.currentRoute.stops.length - 1];
                const distToEnd = RouteLogic.getDistance(lat, lng, lastStop.lat, lastStop.lng) * 1000; // metros

                if (distToEnd < 50) {
                    // Evitar rebotes si la siguiente ruta empieza exactamente donde termina esta
                    // El cambio de ruta alejará el "último punto" (ahora será el de la nueva ruta)
                    checkEndOfLegTransition();
                    return; // Detener ejecución actual para evitar conflictos de renderizado
                }
            }

            // Calcular Desviación
            let result = null;

            // Detección de Fin de Tramo (Punta de Línea)
            const isLastStop = state.manualMode && state.manualStopIndex === state.currentRoute.stops.length - 1;

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

                    // El Modo Manual debe respetar la geometría de la Polilínea igual que el Modo Auto.
                    // Estamos restringidos al segmento entre prevStop y targetStop.

                    const points = RouteLogic.getSegmentPoints(prevStop, targetStop);

                    // Calcular longitudes de sub-segmentos y distancia total
                    let totalPathDist = 0;
                    const subSegmentDists = [];
                    for(let j=0; j<points.length-1; j++) {
                        const d = RouteLogic.getDistance(points[j].lat, points[j].lng, points[j+1].lat, points[j+1].lng);
                        subSegmentDists.push(d);
                        totalPathDist += d;
                    }

                    // Encontrar la proyección más cercana en esta cadena específica de camino
                    let minLocalDist = Infinity;
                    let bestRatio = 0;

                    for(let j=0; j<points.length-1; j++) {
                        const A = points[j];
                        const B = points[j+1];

                        // Proyectar Punto P en Segmento de Línea AB
                        const p = RouteLogic.projectPointOnSegment(
                            {x: lat, y: lng},
                            {x: A.lat, y: A.lng},
                            {x: B.lat, y: B.lng}
                        );

                        const dist = RouteLogic.getDistance(lat, lng, p.x, p.y);

                        if (dist < minLocalDist) {
                            minLocalDist = dist;

                            // Calcular ratio acumulativo
                            let distBefore = 0;
                            for(let k=0; k<j; k++) distBefore += subSegmentDists[k];
                            distBefore += subSegmentDists[j] * p.ratio;

                            bestRatio = totalPathDist > 0 ? distBefore / totalPathDist : 0;
                        }
                    }

                    const t1 = RouteLogic.timeToSeconds(prevStop.time);
                    const t2 = RouteLogic.timeToSeconds(targetStop.time);

                    const expectedTimeSec = t1 + (t2 - t1) * bestRatio;
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
            els.deviation.classList.remove('late', 'early', 'deviation-magenta', 'deviation-white');

            const absDiff = Math.abs(result.deviationSec);
            // Menos de 3 minutos (180 segundos) -> Magenta
            if (absDiff < 180) {
                els.deviation.classList.add('deviation-magenta');
            } else {
                // 3 minutos o más (adelanto o atraso) -> Blanco
                els.deviation.classList.add('deviation-white');
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

            // Verificar si estamos en Punta de Línea (Inicio de recorrido y dentro de 50m)
            checkTerminalStatus(lat, lng);
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

    /** Abre el menú de usuario */
    function openUserMenu() {
        els.userMenu.classList.remove('hidden');
    }

    // --- Lógica del Modo Pasajeros ---

    function openPassengerMode() {
        els.passengerModal.classList.remove('hidden');
        populatePassengerLines();

        // Iniciar intervalo de actualización
        if (passengerUpdateInterval) clearInterval(passengerUpdateInterval);
        passengerUpdateInterval = setInterval(() => {
            if (!els.passengerModal.classList.contains('hidden')) {
                updatePassengerETAs();
                if (passengerMapVisible) updatePassengerMapLocation();
            }
        }, 1000);
    }

    function closePassengerMode() {
        els.passengerModal.classList.add('hidden');
        if (passengerUpdateInterval) {
            clearInterval(passengerUpdateInterval);
            passengerUpdateInterval = null;
        }
        passengerMapVisible = false;
        els.passengerMapContainer.classList.add('hidden');
    }

    function populatePassengerLines() {
        els.passengerSelectLine.innerHTML = '<option value="">Seleccione Línea</option>';
        els.passengerSelectRoute.innerHTML = '<option value="">Seleccione Bandera</option>';
        els.passengerSelectStop.innerHTML = '<option value="">Seleccione Parada</option>';
        els.passengerEtaList.innerHTML = '';

        const addedLines = new Set();
        let hasCirculation = false;

        // 1. Agregar línea del usuario humano
        if (state.currentRoute) {
            hasCirculation = true;
            let currentLineName = state.currentRoute.lineName || "";
            if (!currentLineName && state.activeItinerary) {
                const parts = state.currentRoute.name.split('(');
                currentLineName = parts[0].trim();
            }

            if (currentLineName) {
                const opt = document.createElement('option');
                opt.value = `human_${currentLineName}`;
                opt.textContent = currentLineName;
                els.passengerSelectLine.appendChild(opt);
                addedLines.add(currentLineName);
            } else {
                const opt = document.createElement('option');
                opt.value = "human_current";
                opt.textContent = "Línea Actual";
                els.passengerSelectLine.appendChild(opt);
                addedLines.add("Línea Actual");
            }
        }

        // 2. Agregar líneas de choferes simulados
        if (state.simulatedDrivers && state.simulatedDrivers.length > 0) {
            state.simulatedDrivers.forEach(d => {
                if (!addedLines.has(d.lineName)) {
                    hasCirculation = true;
                    const opt = document.createElement('option');
                    opt.value = `sim_${d.lineId}`;
                    opt.textContent = d.lineName;
                    els.passengerSelectLine.appendChild(opt);
                    addedLines.add(d.lineName);
                }
            });
        }

        if (!hasCirculation) {
            els.passengerEtaList.innerHTML = '<p style="text-align:center; padding: 20px;">No hay colectivos en circulación en este momento.</p>';
            return;
        }

        // Autoseleccionar la primera línea disponible si hay
        if (els.passengerSelectLine.options.length > 1) {
            els.passengerSelectLine.selectedIndex = 1;
            updatePassengerRoutes();
        }
    }

    function updatePassengerRoutes() {
        els.passengerSelectRoute.innerHTML = '<option value="">Seleccione Bandera</option>';
        els.passengerSelectStop.innerHTML = '<option value="">Seleccione Parada</option>';
        els.passengerEtaList.innerHTML = '';

        const selectedVal = els.passengerSelectLine.value;
        if (!selectedVal) return;

        if (selectedVal.startsWith("human_")) {
            // Human user
            if (!state.currentRoute) return;

            if (state.activeItinerary && state.activeTripIndex >= 0) {
                for (let i = state.activeTripIndex; i < state.activeItinerary.length; i++) {
                    const trip = state.activeItinerary[i];
                    const bannerName = trip.routeOriginalName || trip.direction;
                    const uniqueName = `${bannerName} (Tramo ${i + 1})`;
                    const opt = document.createElement('option');
                    opt.value = `human_${i}`;
                    opt.textContent = i === state.activeTripIndex ? `${bannerName} (Actual)` : uniqueName;
                    els.passengerSelectRoute.appendChild(opt);
                }
            } else {
                let currentBannerName = state.currentRoute.bannerName || state.currentRoute.name;
                const opt = document.createElement('option');
                opt.value = "human_current";
                opt.textContent = currentBannerName;
                els.passengerSelectRoute.appendChild(opt);
            }
        } else if (selectedVal.startsWith("sim_")) {
            // Simulated user
            const lineId = parseInt(selectedVal.replace("sim_", ""));
            const driver = state.simulatedDrivers.find(d => d.lineId === lineId);
            if (driver && driver.trips) {
                for (let i = driver.currentTripIndex; i < driver.trips.length; i++) {
                    const trip = driver.trips[i];
                    const bannerName = trip.routeOriginalName || trip.direction;
                    const uniqueName = `${bannerName} (Tramo ${i + 1})`;
                    const opt = document.createElement('option');
                    opt.value = `sim_${lineId}_${i}`;
                    opt.textContent = i === driver.currentTripIndex ? `${bannerName} (Actual)` : uniqueName;
                    els.passengerSelectRoute.appendChild(opt);
                }
            }
        }

        if (els.passengerSelectRoute.options.length > 1) {
            els.passengerSelectRoute.selectedIndex = 1;
            updatePassengerStops();
        }
    }

    function updatePassengerStops() {
        els.passengerSelectStop.innerHTML = '<option value="">Seleccione Parada</option>';
        els.passengerEtaList.innerHTML = '';

        const selectedRouteVal = els.passengerSelectRoute.value;
        if (!selectedRouteVal) return;

        let stopsToUse = [];

        if (selectedRouteVal.startsWith("human_")) {
            if (!state.currentRoute) return;
            stopsToUse = state.currentRoute.stops;

            const val = selectedRouteVal.replace("human_", "");
            if (val !== "current" && state.activeItinerary) {
                const tripIndex = parseInt(val, 10);
                if (!isNaN(tripIndex) && state.activeItinerary[tripIndex]) {
                    stopsToUse = state.activeItinerary[tripIndex].stops;
                }
            }
        } else if (selectedRouteVal.startsWith("sim_")) {
            const parts = selectedRouteVal.replace("sim_", "").split("_");
            if (parts.length === 2) {
                const lineId = parseInt(parts[0]);
                const tripIndex = parseInt(parts[1]);
                const driver = state.simulatedDrivers.find(d => d.lineId === lineId);
                if (driver && driver.trips && driver.trips[tripIndex]) {
                    stopsToUse = driver.trips[tripIndex].stops;
                }
            }
        }

        stopsToUse.forEach((stop, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = stop.name;
            els.passengerSelectStop.appendChild(opt);
        });

        // Initialize Map if it's supposed to be visible but we just loaded stops
        if (passengerMapVisible) {
             MapLogic.initPassengerMap('passenger-map');
             MapLogic.loadRouteOnPassengerMap(stopsToUse);
             updatePassengerMapLocation();
        }
    }

    function updatePassengerETAs() {
        const stopIndexStr = els.passengerSelectStop.value;
        const routeVal = els.passengerSelectRoute.value;
        const lineVal = els.passengerSelectLine.value;

        if (stopIndexStr === "" || !lineVal) {
            els.passengerEtaList.innerHTML = '';
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

        if (lineVal.startsWith("human_")) {
            if (!state.currentRoute) return;

            stopsToUse = state.currentRoute.stops;

            if (routeVal !== "human_current" && state.activeItinerary) {
                const val = routeVal.replace("human_", "");
                const selectedTripIndex = parseInt(val, 10);
                if (!isNaN(selectedTripIndex) && selectedTripIndex > state.activeTripIndex) {
                    isFutureTrip = true;
                }
                if (!isNaN(selectedTripIndex) && state.activeItinerary[selectedTripIndex]) {
                    stopsToUse = state.activeItinerary[selectedTripIndex].stops;
                }
            }

            const targetStopIndex = parseInt(stopIndexStr, 10);
            const targetStop = stopsToUse[targetStopIndex];
            targetTimeSec = RouteLogic.timeToSeconds(targetStop.time);

            const pos = getCurrentPosition();
            if (!pos) {
                els.passengerEtaList.innerHTML = '<p style="text-align:center;">Esperando señal GPS...</p>';
                return;
            }
            currentLat = pos.lat;
            currentLng = pos.lng;

            const devResult = RouteLogic.calculateDeviation(pos.lat, pos.lng, state.currentRoute.stops, currentSec);
            if (devResult) {
                deviationSec = devResult.deviationSec;
                expectedCurrentLocationTimeSec = devResult.expectedTimeSec;

                const startStop = state.currentRoute.stops[0];
                const dist = RouteLogic.getDistance(pos.lat, pos.lng, startStop.lat, startStop.lng) * 1000;
                isOutsideTerminal = dist > 50;
            } else {
                 els.passengerEtaList.innerHTML = '<p style="text-align:center;">Calculando posición...</p>';
                 return;
            }

        } else if (lineVal.startsWith("sim_")) {
            const lineId = parseInt(lineVal.replace("sim_", ""));
            const driver = state.simulatedDrivers.find(d => d.lineId === lineId);
            if (!driver) {
                 els.passengerEtaList.innerHTML = '';
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
            targetTimeSec = RouteLogic.timeToSeconds(targetStop.time);

            if (driver.lat === null || driver.lng === null) {
                els.passengerEtaList.innerHTML = '<p style="text-align:center;">Chofer en espera...</p>';
                return;
            }

            currentLat = driver.lat;
            currentLng = driver.lng;

            const currentTripStops = driver.trips[driver.currentTripIndex].stops;
            const devResult = RouteLogic.calculateDeviation(currentLat, currentLng, currentTripStops, currentSec);

            if (devResult) {
                deviationSec = devResult.deviationSec;
                expectedCurrentLocationTimeSec = devResult.expectedTimeSec;

                const startStop = currentTripStops[0];
                const dist = RouteLogic.getDistance(currentLat, currentLng, startStop.lat, startStop.lng) * 1000;
                isOutsideTerminal = dist > 50;
            } else {
                els.passengerEtaList.innerHTML = '<p style="text-align:center;">Calculando posición...</p>';
                return;
            }
        }

        if (!isFutureTrip && expectedCurrentLocationTimeSec > targetTimeSec) {
            els.passengerEtaList.innerHTML = '<div class="eta-card" style="background-color: #666;"><div class="eta-card-left"><div class="eta-line">Colectivo ya pasó esta parada</div></div></div>';
            return;
        }

        let etaSec = targetTimeSec - expectedCurrentLocationTimeSec;

        if (etaSec < 0 && isFutureTrip) {
            etaSec += 86400;
        }

        if (deviationSec > 0) {
            if (isFutureTrip || !isOutsideTerminal) {
                etaSec += deviationSec;
            }
        }

        const etaMinutes = Math.floor(etaSec / 60);
        let etaDisplay = "";

        if (etaMinutes < 2) {
            etaDisplay = "Arribando";
        } else {
            etaDisplay = `${etaMinutes} min. aprox.`;
        }

        // Renderizar Tarjeta
        const lineName = els.passengerSelectLine.options[els.passengerSelectLine.selectedIndex].text;
        const bannerName = els.passengerSelectRoute.options[els.passengerSelectRoute.selectedIndex].text;
        const stopName = targetStop.name;

        els.passengerEtaList.innerHTML = `
            <div class="eta-card">
                <div class="eta-card-left">
                    <div class="eta-line">${lineName}</div>
                    <div class="eta-route">${bannerName}</div>
                    <div class="eta-stop">${stopName}</div>
                </div>
                <div class="eta-card-right">
                    ${etaDisplay}
                </div>
            </div>
        `;
    }

    function togglePassengerMap() {
        passengerMapVisible = !passengerMapVisible;
        if (passengerMapVisible) {
            els.passengerMapContainer.classList.remove('hidden');
            MapLogic.initPassengerMap('passenger-map');
            setTimeout(() => {
                MapLogic.passengerMap.invalidateSize();
                if (state.currentRoute) {
                    let stopsToUse = state.currentRoute.stops;
                    const val = els.passengerSelectRoute.value;
                    if (val !== "current" && state.activeItinerary) {
                        const tripIndex = parseInt(val, 10);
                        if (!isNaN(tripIndex) && state.activeItinerary[tripIndex]) {
                            stopsToUse = state.activeItinerary[tripIndex].stops;
                        }
                    }
                    MapLogic.loadRouteOnPassengerMap(stopsToUse);
                    updatePassengerMapLocation();
                }
            }, 200);
        } else {
            els.passengerMapContainer.classList.add('hidden');
        }
    }

    function updatePassengerMapLocation() {
        const pos = getCurrentPosition();
        if (pos && passengerMapVisible) {
            MapLogic.updatePassengerUserPosition(pos.lat, pos.lng);
        }
    }

    // --- Lógica del Modo PRO ---

    let editingLineId = null;

    /** Abre el modal de Modo Profesional y carga las líneas */
    function openProMode() {
        // Limpiar líneas viejas si es la primera vez que se abre con el nuevo formato
        let lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        const needsMigration = lines.some(l => l.routeIda !== undefined);
        if (needsMigration) {
            localStorage.setItem('gps_lines', JSON.stringify([]));
        }

        els.proModal.classList.remove('hidden');
        els.proLineEditor.classList.add('hidden');
        els.proDriverView.classList.add('hidden');
        els.proLinesView.classList.remove('hidden');
        loadLinesList();
    }

    /** Carga y renderiza la lista de líneas */
    function loadLinesList() {
        const lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        els.linesList.innerHTML = '';

        if (lines.length === 0) {
            els.linesList.innerHTML = '<li style="text-align:center; padding:10px; color:#777">No hay líneas creadas</li>';
            return;
        }

        lines.forEach(line => {
            const li = document.createElement('li');
            li.className = 'item-card';
            const startDate = new Date(line.start).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            const endDate = new Date(line.end).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            li.innerHTML = `
                <div>
                    <h4>${line.name}</h4>
                    <p>${startDate} a ${endDate} | ${line.turns} Tramos</p>
                </div>
                <div>
                    <button class="btn-small" onclick="window.driveLine(${line.id})">Conducir</button>
                    <button class="btn-small" onclick="window.editLine(${line.id})">Editar</button>
                </div>
            `;
            els.linesList.appendChild(li);
        });
    }

    window.driveLine = function(id) {
        const lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        const line = lines.find(l => l.id === id);
        if (!line) return;

        const savedRoutes = JSON.parse(localStorage.getItem('gps_routes') || '[]');

        // Verificar que todas las rutas referenciadas en rests sigan existiendo
        const missingRoutes = line.rests.some(rest => !savedRoutes.find(r => r.id == rest.routeId));
        if (missingRoutes) {
            alert("Error: Faltan algunas de las banderas asociadas a los tramos de esta línea. Por favor edite la línea.");
            return;
        }

        // Calcular Itinerario
        const trips = ScheduleLogic.calculateItinerary({
            startTime: line.start,
            endTime: line.end,
            turns: line.turns,
            rests: line.rests || [] // Configuraciones completas por tramo
        }, savedRoutes);

        if (!trips || trips.length === 0) {
            alert("No se pudo generar el cronograma. Verifique los horarios y distancias.");
            return;
        }

        // Mostrar Driver View
        els.proLinesView.classList.add('hidden');
        els.proDriverView.classList.remove('hidden');
        els.driverLineTitle.textContent = `Conducir: ${line.name}`;
        els.tripsList.innerHTML = '';

        trips.forEach(trip => {
            const div = document.createElement('div');
            div.className = 'trip-card';
            div.innerHTML = `
                <div class="trip-dir">${trip.routeOriginalName}</div>
                <div class="trip-time">${trip.startTime} - ${trip.endTime}</div>
                <div class="trip-leg">Tramo ${trip.legIndex} (${trip.durationWeight})</div>
            `;
            div.onclick = () => {
                startItinerary(trips, trips.indexOf(trip), line.name);
            };
            els.tripsList.appendChild(div);
        });
    };

    /**
     * Inicia un itinerario completo (o salta a un tramo específico).
     * @param {Array} trips - Lista completa de viajes calculados.
     * @param {number} startIndex - Índice del viaje inicial seleccionado.
     * @param {string} lineName - Nombre base de la línea.
     */
    function startItinerary(trips, startIndex, lineName) {
        state.activeItinerary = trips;
        state.activeTripIndex = startIndex;
        state.isServiceFinished = false;

        loadTripFromItinerary(lineName);
        els.proModal.classList.add('hidden');
    }

    function loadTripFromItinerary(lineName) {
        if (!state.activeItinerary || state.activeTripIndex < 0 || state.activeTripIndex >= state.activeItinerary.length) {
             finishService();
             return;
        }

        // Actualizar contador de vueltas (VH)
        const lapNumber = Math.floor(state.activeTripIndex / 2) + 1;
        if (els.lapDisplay) els.lapDisplay.textContent = `${lapNumber}`;

        const trip = state.activeItinerary[state.activeTripIndex];
        const routeObj = {
            id: trip.id,
            name: `${lineName} (${trip.direction})`,
            lineName: lineName,
            bannerName: trip.routeOriginalName,
            stops: trip.stops
        };

        // Cargar ruta
        selectRoute(routeObj);

        // Resetear visualización de servicio finalizado por si acaso
        state.isServiceFinished = false;
        els.deviation.classList.remove('service-finished');
    }

    function stopNavigation() {
        state.currentRoute = null;
        state.activeItinerary = null;
        state.activeTripIndex = -1;
        state.isServiceFinished = false;

        els.routeName.textContent = "SIN BANDERA";
        els.deviation.textContent = "+00:00";
        els.deviation.className = 'info-value deviation'; // Reset classes
        els.nextStop.textContent = "---";
        els.arrivalTime.textContent = "--:--";

        // Limpiar mapa
        if (state.mapVisible) {
             MapLogic.initNavMap('nav-map');
        }

        // Reset info bar specific values that might be leftover
        els.infoBanner.textContent = "---";
    }

    function finishService() {
        state.currentRoute = null;
        state.isServiceFinished = true;
        state.activeItinerary = null;
        state.activeTripIndex = -1;

        els.routeName.textContent = "SERVICIO FINALIZADO";
        els.deviation.textContent = "Servicio Finalizado";
        els.deviation.classList.remove('late', 'early', 'neutral');
        els.deviation.classList.add('service-finished'); // Clase para estilo especial
        els.nextStop.textContent = "---";
        els.arrivalTime.textContent = "--:--";

        // Limpiar mapa
        if (state.mapVisible) MapLogic.initNavMap('nav-map');
    }

    window.editLine = function(id) {
        const lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        const line = lines.find(l => l.id === id);
        openLineEditor(line);
    };

    function openLineEditor(line) {
        els.proLinesView.classList.add('hidden');
        els.proLineEditor.classList.remove('hidden');

        if (line) {
            editingLineId = line.id;
            els.lineNameInput.value = line.name;
            els.lineStartTime.value = line.start;
            els.lineEndTime.value = line.end;
            els.lineTurns.value = line.turns;

            // Generar Inputs de Espera y llenar valores
            generateRestInputs(null, line.rests || []);

            els.btnDeleteLine.classList.remove('hidden');
        } else {
            editingLineId = null;
            els.lineNameInput.value = '';
            els.lineStartTime.value = '';
            els.lineEndTime.value = '';
            els.lineTurns.value = '';
            els.restsContainer.innerHTML = '<p style="font-size:12px; color:#666">Ingrese cantidad de tramos (medias vueltas) para configurarlos.</p>';
            els.btnDeleteLine.classList.add('hidden');
        }
    }

    /**
     * Genera dinámicamente los inputs para configuración de cada tramo (media vuelta).
     * @param {Event|null} e
     * @param {Array|null} existingRests
     */
    function generateRestInputs(e, existingRests = []) {
        const totalLegs = parseInt(els.lineTurns.value);
        if (isNaN(totalLegs) || totalLegs <= 0) {
            els.restsContainer.innerHTML = '';
            return;
        }

        // Si viene de UI (keyup/change), queremos preservar lo que el usuario ya escribió si aumenta tramos
        let currentValues = [];
        if (e) {
            document.querySelectorAll('.rest-group-item').forEach(div => {
                const routeSelect = div.querySelector('.select-route');
                const restInp = div.querySelector('.input-rest');
                const weightSelect = div.querySelector('.select-weight');
                currentValues.push({
                    routeId: routeSelect ? routeSelect.value : "",
                    rest: restInp ? restInp.value : 0,
                    weight: weightSelect ? weightSelect.value : "media"
                });
            });
        } else {
            currentValues = existingRests;
        }

        els.restsContainer.innerHTML = '';
        const savedRoutes = JSON.parse(localStorage.getItem('gps_routes') || '[]');

        for(let i=0; i<totalLegs; i++) {
            const vals = currentValues[i] || {routeId: "", rest: 0, weight: "media"};

            const div = document.createElement('div');
            div.className = 'rest-group-item';
            div.style.display = "flex";
            div.style.gap = "5px";
            div.style.borderBottom = "1px solid #eee";
            div.style.paddingBottom = "5px";
            div.style.alignItems = "center";
            div.style.flexWrap = "wrap";

            // Selector de Bandera
            const selectRouteHtml = `<select class="select-route" style="flex: 2; font-size: 12px;">
                <option value="">Bandera...</option>
                ${savedRoutes.map(r => `<option value="${r.id}" ${vals.routeId == r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>`;

            // Input Espera
            const inputRestHtml = `<input type="number" class="input-rest" placeholder="Espera (min)" value="${vals.rest}" style="flex: 1; font-size: 12px;" min="0">`;

            // Selector Peso (Corta/Media/Larga)
            const selectWeightHtml = `<select class="select-weight" style="flex: 1; font-size: 12px;">
                <option value="corta" ${vals.weight === 'corta' ? 'selected' : ''}>Corta</option>
                <option value="media" ${vals.weight === 'media' ? 'selected' : ''}>Media</option>
                <option value="larga" ${vals.weight === 'larga' ? 'selected' : ''}>Larga</option>
            </select>`;

            div.innerHTML = `
                <span style="font-size:12px; font-weight:bold; width: 65px;">Tramo ${i + 1}:</span>
                ${selectRouteHtml}
                ${inputRestHtml}
                ${selectWeightHtml}
            `;
            els.restsContainer.appendChild(div);
        }
    }

    function saveLine() {
        const name = els.lineNameInput.value;
        const start = els.lineStartTime.value;
        const end = els.lineEndTime.value;
        const turns = els.lineTurns.value;

        if (!name || !start || !end || !turns) {
            alert("Complete nombre, fechas de inicio y fin, y cantidad de tramos");
            return;
        }

        // Recolectar Rests y Rutas
        const rests = [];
        let missingRoute = false;
        document.querySelectorAll('.rest-group-item').forEach(div => {
            const routeId = div.querySelector('.select-route').value;
            const restVal = div.querySelector('.input-rest').value;
            const weightVal = div.querySelector('.select-weight').value;

            if (!routeId) {
                missingRoute = true;
            }

            rests.push({
                routeId: routeId,
                rest: parseInt(restVal) || 0,
                weight: weightVal
            });
        });

        if (missingRoute) {
             alert("Debe seleccionar una bandera para todos los tramos configurados.");
             return;
        }

        const line = {
            id: editingLineId || Date.now(),
            name,
            start,
            end,
            turns: parseInt(turns),
            rests: rests
        };

        let lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        if (editingLineId) {
            const idx = lines.findIndex(l => l.id === editingLineId);
            if (idx !== -1) lines[idx] = line;
        } else {
            lines.push(line);
        }

        localStorage.setItem('gps_lines', JSON.stringify(lines));
        openProMode(); // Volver a lista
    }

    function deleteLine() {
        if (!editingLineId) return;
        if (!confirm("¿Eliminar esta línea?")) return;
        let lines = JSON.parse(localStorage.getItem('gps_lines') || '[]');
        lines = lines.filter(l => l.id !== editingLineId);
        localStorage.setItem('gps_lines', JSON.stringify(lines));
        openProMode();
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

        // Determinar coordenadas iniciales
        let initLat = -27.4692; // Corrientes fallback
        let initLng = -58.8302;
        if (state.lastGpsPosition) {
            initLat = state.lastGpsPosition.lat;
            initLng = state.lastGpsPosition.lng;
        }

        // Init mapa después de visible
        setTimeout(() => {
            const wasInitialized = !!MapLogic.editorMap;

            MapLogic.initEditorMap('editor-map', initLat, initLng, (latlng) => {
                handleMapClick(latlng);
            });
            MapLogic.editorMap.invalidateSize();

            // Si el mapa ya existía y estamos creando una ruta nueva, centrar en el GPS
            if (wasInitialized && !state.editingRouteId && tempStops.length === 0) {
                MapLogic.editorMap.setView([initLat, initLng], 13);
            }

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
                    <i class="fa-solid fa-location-dot"></i>
                    <input type="text" class="stop-name-input" value="${stop.name}" onchange="updateStopName(${idx}, this.value)" placeholder="Nombre Parada">
                </div>
                <div class="stop-details">
                    <div class="coord-wrapper">
                        <i class="fa-solid fa-map-pin"></i>
                        <span class="coord">${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</span>
                    </div>
                    <div class="time-input-group">
                        <i class="fa-regular fa-clock"></i>
                        <input type="time" step="1" value="${stop.time}" onchange="updateStopTime(${idx}, this.value)">
                    </div>
                </div>
            `;
            els.stopsList.appendChild(div);

            // Botón Dibujar (Solo entre paradas)
            if (idx < tempStops.length - 1) {
                const drawContainer = document.createElement('div');
                drawContainer.className = 'draw-container';

                if (state.drawingMode && state.drawingRouteIndex === idx) {
                    // Controles de Dibujo Activos
                    drawContainer.innerHTML = `
                        <div class="drawing-active-box">
                            <small><i class="fa-solid fa-pen-nib"></i> Dibujando tramo...</small>
                            <div class="drawing-actions">
                                <button class="btn-undo" onclick="window.undoDrawing()" title="Deshacer último punto"><i class="fa-solid fa-rotate-left"></i></button>
                                <button class="btn-finish" onclick="window.finishDrawing()">Completar Trazado</button>
                            </div>
                        </div>
                    `;
                } else {
                    // Botón Iniciar Dibujo
                    const btnDraw = document.createElement('button');
                    btnDraw.className = 'draw-btn';

                    // Show if path exists
                    const hasPath = stop.pathNext && stop.pathNext.length > 0;
                    if (hasPath) {
                        btnDraw.innerHTML = '<i class="fa-solid fa-route"></i> Redibujar Trazado';
                        btnDraw.style.color = '#28a745';
                        btnDraw.style.borderColor = '#28a745';
                    } else {
                        btnDraw.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Trazado Real';
                    }

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

    /**
     * Actualiza el nombre de una parada.
     * @param {number} idx - Índice de la parada.
     * @param {string} val - Nuevo nombre.
     */
    window.updateStopName = function(idx, val) {
        if (tempStops[idx]) {
            tempStops[idx].name = val;
        }
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

    /**
     * Realiza la transición inmediata al siguiente tramo si existe.
     */
    function checkEndOfLegTransition() {
        const nextTripIndex = state.activeTripIndex + 1;

        if (nextTripIndex >= state.activeItinerary.length) {
            // Fin de servicio
            finishService();
            return;
        }

        // Transición Inmediata: Cargar siguiente tramo
        state.activeTripIndex++;
        const nextTrip = state.activeItinerary[state.activeTripIndex];

        // Resetear a inicio para el nuevo tramo
        state.manualStopIndex = 0;

        // Cargar ruta
        // Usamos el nombre original si está disponible (hack: obtener de trip actual o anterior)
        const currentName = els.routeName.textContent;
        const baseName = currentName.split('(')[0].trim();

        loadTripFromItinerary(baseName);

        // Forzar actualización inmediata para mostrar el nuevo desvío (espera)
        updateClock();
    }

    /**
     * Verifica si se debe mostrar el mensaje "Punta de Línea" basado en la ubicación.
     * @param {number} lat - Latitud actual.
     * @param {number} lng - Longitud actual.
     */
    function checkTerminalStatus(lat, lng) {
        if (!state.currentRoute || state.currentRoute.stops.length === 0) return;

        // Verificar si estamos al inicio del recorrido (ej. índice 0 o 1)
        // O simplemente cerca de la primera parada.
        const startStop = state.currentRoute.stops[0];
        const dist = RouteLogic.getDistance(lat, lng, startStop.lat, startStop.lng); // km
        const distMeters = dist * 1000;

        if (distMeters <= 50) {
            // Dentro del radio de 50m de la punta
            const val = els.deviation.textContent;

            // Usar modo terminal: Texto simple en blanco, sin colores de semáforo
            els.deviation.classList.add('terminal-mode');
            els.deviation.classList.remove('early', 'late');

            // Formato de una sola línea
            els.deviation.textContent = `Punta de Línea: ${val}`;
        } else {
            // Fuera del radio
            els.deviation.classList.remove('terminal-mode');
            // Los colores early/late ya fueron asignados en updateDeviation
        }
    }

    // Run
    init();
});
