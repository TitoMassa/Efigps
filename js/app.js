document.addEventListener('DOMContentLoaded', () => {

    // State
    const state = {
        currentRoute: null, // { name: '', stops: [] }
        isSimulating: false,
        simProgress: 0, // 0 to 100
        simInterval: null,
        highContrast: false,
        mapVisible: false,
        speed: 0,
        lastGpsPosition: null, // { lat, lng, speed }
        gpsWatchId: null,

        // Stop Selection Mode
        manualMode: false,
        manualStopIndex: 0, // Index of the manually selected next stop

        // Editor
        editingRouteId: null,
        drawingMode: false,
        drawingRouteIndex: -1 // The index of the STOP we are drawing FROM (to next stop)
    };

    // DOM Elements
    const els = {
        clock: document.getElementById('clock'),
        deviation: document.getElementById('deviation-display'),
        nextStop: document.getElementById('next-stop-name'),
        arrivalTime: document.getElementById('arrival-time'),
        routeName: document.getElementById('route-name'),
        speed: document.getElementById('speed'),
        screenContent: document.querySelector('.screen-content'),
        navMapContainer: document.getElementById('nav-map-container'),

        // Buttons
        btnMap: document.getElementById('btn-map-toggle'),
        btnContrast: document.getElementById('btn-contrast'),
        btnRouteEditor: document.getElementById('btn-route-editor'),
        btnSimStart: document.getElementById('btn-start-sim'),
        btnUp: document.getElementById('btn-up'),
        btnDown: document.getElementById('btn-down'),

        // Controls (moved outside)
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

        // Sim
        simSlider: document.getElementById('sim-slider'),
        simStatus: document.getElementById('sim-status')
    };

    // --- Initialization ---

    function init() {
        // Clock loop
        setInterval(updateClock, 1000);

        // Init Maps
        // (MapLogic init is called when modal opens or map is toggled to avoid layout issues)

        // Load Saved Routes
        loadSavedRoutes();

        // Start GPS
        startGpsTracking();

        // Events
        setupEventListeners();
    }

    function startGpsTracking() {
        if (!navigator.geolocation) {
            console.error("Geolocation not supported");
            return;
        }

        state.gpsWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                state.lastGpsPosition = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    speed: pos.coords.speed // m/s
                };

                // Update Speed Display (convert m/s to km/h)
                if (pos.coords.speed !== null) {
                    state.speed = (pos.coords.speed * 3.6).toFixed(0);
                    els.speed.textContent = `${state.speed} km/h`;
                }
            },
            (err) => {
                console.error("GPS Error:", err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 5000
            }
        );
    }

    function setupEventListeners() {
        // Device Buttons
        els.btnContrast.addEventListener('click', toggleHighContrast);
        els.btnMap.addEventListener('click', toggleNavMap);
        els.btnRouteEditor.addEventListener('click', openEditor); // Using "User" icon for Editor as per plan

        // Mode Switch
        if (els.modeSwitch) {
             els.modeSwitch.addEventListener('change', (e) => {
                 toggleStopSelectionMode(e.target.checked);
             });
        }

        // Editor
        els.closeModal.addEventListener('click', () => {
            els.modal.classList.add('hidden');
            state.drawingMode = false; // Ensure we exit drawing mode
            MapLogic.renderEditorRoute(tempStops); // Redraw clean
        });
        els.btnCalc.addEventListener('click', calculateEditorTimes);
        els.btnSave.addEventListener('click', saveRoute);
        els.btnClear.addEventListener('click', clearEditor);

        // Simulation
        els.btnSimStart.addEventListener('click', toggleSimulation);
        els.simSlider.addEventListener('input', (e) => {
            state.simProgress = parseFloat(e.target.value);
            updateSimulationLoop();
        });

        // Physical Keys Binding (Up/Down)
        els.btnUp.addEventListener('click', () => handleArrowKey('up'));
        els.btnDown.addEventListener('click', () => handleArrowKey('down'));
    }

    function toggleStopSelectionMode(isManual) {
        state.manualMode = isManual;

        if (state.manualMode) {
            // Init manual index if needed, possibly to current auto index?
            // Ideally we find the closest next stop and set it there
            if (state.currentRoute) {
                // Find what the auto logic thinks is next
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

    function handleArrowKey(direction) {
        // User says: Up = +1 Stop, Down = -1 Stop
        // Previous implementation was Up = Next, Down = Prev
        // This matches logic.

        if (state.manualMode) {
            if (!state.currentRoute) return;

            if (direction === 'up') {
                // Next stop (Increment index)
                state.manualStopIndex++;
                if (state.manualStopIndex >= state.currentRoute.stops.length) {
                    state.manualStopIndex = state.currentRoute.stops.length - 1;
                }
            } else {
                // Prev stop (Decrement index)
                state.manualStopIndex--;
                if (state.manualStopIndex < 0) {
                    state.manualStopIndex = 0;
                }
            }
            // Force update immediately
            updateClock();

            // Ensure the UI is updated even if deviation doesn't change significantly?
            // Force deviation update call
            const now = new Date();
            updateDeviation(now);
        }
        // Else: Do nothing in Auto Mode as per requirements.
    }

    function adjustSim(delta) {
        if (!state.isSimulating && !state.currentRoute) return;
        let newVal = state.simProgress + delta;
        newVal = Math.max(0, Math.min(100, newVal));
        state.simProgress = newVal;
        els.simSlider.value = newVal;
        updateSimulationLoop();
    }

    function resetSimulation() {
        state.isSimulating = false;
        if (state.simInterval) clearInterval(state.simInterval);
        state.simProgress = 0;
        els.simSlider.value = 0;
        els.simStatus.textContent = "Inactivo";
        els.btnSimStart.textContent = "Iniciar Simulación";
        updateClock(); // Reset view
    }

    function getCurrentPosition() {
         if (state.isSimulating) {
            return getSimulatedPosition(state.simProgress);
        } else {
            // Real GPS
            if (!state.lastGpsPosition) return null;
            return {
                lat: state.lastGpsPosition.lat,
                lng: state.lastGpsPosition.lng
            };
        }
    }

    // --- Core Features ---

    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour12: false });
        els.clock.textContent = timeStr;

        if (state.currentRoute) {
            updateDeviation(now);
        }
    }

    function updateDeviation(nowDate) {
        try {
            const currentSec = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds();

            // Get Position
            const pos = getCurrentPosition();
            if (!pos) return;

            let lat = pos.lat;
            let lng = pos.lng;

            // Update Map Marker
            if (state.mapVisible) {
                MapLogic.updateUserPosition(lat, lng);
            }

            // Calculate Deviation
            let result = null;

            if (state.manualMode) {
                // Manual Deviation Calculation
                if (state.manualStopIndex < 0 || state.manualStopIndex >= state.currentRoute.stops.length) return;
                const targetStop = state.currentRoute.stops[state.manualStopIndex];
                const idx = state.manualStopIndex;

                if (idx === 0) {
                    // User selected the start point?
                    // Deviation is just TimeNow - TimeStart?
                    const tStart = RouteLogic.timeToSeconds(targetStop.time);
                    const diff = tStart - currentSec;
                    // If positive, we are early (start is in future).
                    // If negative, we are late (start was in past).
                    // Format logic shared?
                    result = formatDeviationResult(diff, targetStop.name, tStart);
                } else {
                    // Segment: idx-1 -> idx
                    const prevStop = state.currentRoute.stops[idx-1];

                    // Manual Mode must respect Polyline geometry just like Auto Mode.
                    // We are constrained to the segment between prevStop and targetStop.

                    const points = RouteLogic.getSegmentPoints(prevStop, targetStop);

                    // Calculate lengths of sub-segments and total distance
                    let totalPathDist = 0;
                    const subSegmentDists = [];
                    for(let j=0; j<points.length-1; j++) {
                        const d = RouteLogic.getDistance(points[j].lat, points[j].lng, points[j+1].lat, points[j+1].lng);
                        subSegmentDists.push(d);
                        totalPathDist += d;
                    }

                    // Find closest projection on this specific path chain
                    let minLocalDist = Infinity;
                    let bestRatio = 0;

                    for(let j=0; j<points.length-1; j++) {
                        const A = points[j];
                        const B = points[j+1];

                        // Project Point P onto Line Segment AB
                        const p = RouteLogic.projectPointOnSegment(
                            {x: lat, y: lng},
                            {x: A.lat, y: A.lng},
                            {x: B.lat, y: B.lng}
                        );

                        const dist = RouteLogic.getDistance(lat, lng, p.x, p.y);

                        if (dist < minLocalDist) {
                            minLocalDist = dist;

                            // Calculate cumulative ratio
                            let distBefore = 0;
                            for(let k=0; k<j; k++) distBefore += subSegmentDists[k];
                            distBefore += subSegmentDists[j] * p.ratio;

                            bestRatio = totalPathDist > 0 ? distBefore / totalPathDist : 0;
                        }
                    }

                    const t1 = RouteLogic.timeToSeconds(prevStop.time);
                    const t2 = RouteLogic.timeToSeconds(targetStop.time);

                    const expectedTimeSec = t1 + (t2 - t1) * bestRatio;
                    const diff = expectedTimeSec - currentSec; // + ahead, - behind

                    result = formatDeviationResult(diff, targetStop.name, expectedTimeSec);
                }

            } else {
            // Auto
            result = RouteLogic.calculateDeviation(lat, lng, state.currentRoute.stops, currentSec);
        }

        if (result) {
            // Display
            els.deviation.textContent = result.deviationStr;

            // Color/Style
            els.deviation.classList.remove('late', 'early');
            if (result.deviationSec >= 0) {
                els.deviation.classList.add('early');
            } else {
                els.deviation.classList.add('late');
            }

            els.nextStop.textContent = result.nextStop;

            // Update Arrival Time
            const nextStopObj = state.currentRoute.stops.find(s => s.name === result.nextStop);
            if (nextStopObj) {
                els.arrivalTime.textContent = nextStopObj.time.substring(0, 5);
            }

            // Sync Manual Index if in Auto Mode (so if we switch to manual, we start correct)
            if (!state.manualMode) {
                 const idx = state.currentRoute.stops.findIndex(s => s.name === result.nextStop);
                 if (idx !== -1) state.manualStopIndex = idx;
            }

            // Update Map Markers (Green for next stop)
            if (state.mapVisible) {
                MapLogic.updateStopMarkers(result.nextStop);
            }
        }
    } catch (e) {
        console.error("Deviation Error:", e);
    }
    }

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

    // --- Simulation Logic ---

    function getSimulatedPosition(progressPercent) {
        if (!state.currentRoute || state.currentRoute.stops.length < 2) return null;

        const stops = state.currentRoute.stops;
        // Calculate total distance
        let totalDist = 0;
        const dists = [];
        for(let i=0; i<stops.length-1; i++) {
            // Use getPathTotalDistance for accurate simulation
            const points = RouteLogic.getSegmentPoints(stops[i], stops[i+1]);
            const d = RouteLogic.getPathTotalDistance(points);
            dists.push(d);
            totalDist += d;
        }

        const targetDist = totalDist * (progressPercent / 100);

        // Find segment
        let covered = 0;
        for(let i=0; i<dists.length; i++) {
            if (covered + dists[i] >= targetDist) {
                // In this STOP-TO-STOP segment
                // Now we need to find where in the polyline we are.
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
        // End of route
        const last = stops[stops.length-1];
        return { lat: last.lat, lng: last.lng };
    }

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

            // Auto-move slider for effect? Or just manual?
            // Requirement says "Debe verse igual... navegara con este dispositivo... Agregar modo Demo".
            // Let's make it auto-increment slightly to show changes.
            state.simInterval = setInterval(() => {
                if (state.simProgress < 100) {
                   // state.simProgress += 0.1; // Slow auto move
                   // els.simSlider.value = state.simProgress;
                   // Not auto moving, let user control it or it might override manual test
                }
            }, 100);
        }
    }

    function updateSimulationLoop() {
        // Trigger update manually
        updateClock();
    }

    // --- Editor Logic ---

    let tempStops = [];

    function openEditor() {
        els.modal.classList.remove('hidden');
        // Init map after visible
        setTimeout(() => {
            MapLogic.initEditorMap('editor-map', (latlng) => {
                handleMapClick(latlng);
            });
            MapLogic.editorMap.invalidateSize();
        }, 100);

        // Reset editor state
        if (!state.editingRouteId) {
            clearEditor();
        } else {
            // If editing existing, render it
            MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        }
    }

    function handleMapClick(latlng) {
        if (state.drawingMode) {
            addPathPoint(latlng);
        } else {
            addStopToEditor(latlng);
        }
    }

    function addStopToEditor(latlng) {
        const count = tempStops.length + 1;
        const stop = {
            name: `Parada ${count}`,
            lat: latlng.lat,
            lng: latlng.lng,
            time: '',
            pathNext: [] // Init empty path
        };
        tempStops.push(stop);
        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList();
    }

    function updateStopLocation(index, lat, lng) {
        if (tempStops[index]) {
            tempStops[index].lat = lat;
            tempStops[index].lng = lng;

            // Re-render route line because it moved
            MapLogic.renderEditorRoute(tempStops, updateStopLocation);
            renderStopList(); // Update displayed coords
        }
    }

    function addPathPoint(latlng) {
        if (state.drawingRouteIndex === -1) return;
        const stop = tempStops[state.drawingRouteIndex];
        if (!stop.pathNext) stop.pathNext = [];

        stop.pathNext.push({lat: latlng.lat, lng: latlng.lng});

        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList(); // To show Undo button enabled?
    }

    function startDrawing(index) {
        state.drawingMode = true;
        state.drawingRouteIndex = index;

        // Clear existing path to let user redraw
        tempStops[index].pathNext = [];

        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList();
    }

    function undoLastPoint() {
        if (!state.drawingMode || state.drawingRouteIndex === -1) return;
        const stop = tempStops[state.drawingRouteIndex];
        if (stop.pathNext && stop.pathNext.length > 0) {
            stop.pathNext.pop();
            MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        }
    }

    function stopDrawing() {
        state.drawingMode = false;
        state.drawingRouteIndex = -1;
        renderStopList();
    }

    function renderStopList() {
        els.stopsList.innerHTML = '';
        tempStops.forEach((stop, idx) => {
            // Stop Item
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

            // Drawing Button (Only between stops)
            if (idx < tempStops.length - 1) {
                const drawContainer = document.createElement('div');
                drawContainer.className = 'draw-container';
                drawContainer.style.textAlign = 'center';
                drawContainer.style.margin = '5px 0';

                if (state.drawingMode && state.drawingRouteIndex === idx) {
                    // Active Drawing Controls
                    drawContainer.innerHTML = `
                        <div style="background: #eef; padding: 5px; border: 1px dashed #00f; border-radius: 5px;">
                            <small>Dibujando tramo...</small><br>
                            <button onclick="window.undoDrawing()" style="margin-right: 5px;">Deshacer Puntos</button>
                            <button onclick="window.finishDrawing()">Terminar</button>
                        </div>
                    `;
                } else {
                    // Start Drawing Button
                    const btnDraw = document.createElement('button');
                    btnDraw.innerHTML = '<i class="fa-solid fa-pencil"></i> Dibujar Trazado';
                    btnDraw.style.fontSize = '12px';
                    btnDraw.onclick = () => startDrawing(idx);
                    // Disable if currently drawing another segment
                    if (state.drawingMode) btnDraw.disabled = true;

                    drawContainer.appendChild(btnDraw);
                }
                els.stopsList.appendChild(drawContainer);
            }
        });
    }

    // Expose window helpers for innerHTML onclicks
    window.updateStopTime = function(idx, val) {
        tempStops[idx].time = val;
        if (val.length === 5) tempStops[idx].time = val + ":00";
        else tempStops[idx].time = val;
    };

    window.undoDrawing = function() {
        undoLastPoint();
    };

    window.finishDrawing = function() {
        stopDrawing();
    };

    function calculateEditorTimes() {
        tempStops = RouteLogic.calculateIntermediateTimes(tempStops);
        renderStopList();
    }

    function saveRoute() {
        const name = els.routeNameInput.value || "Sin Nombre";
        if (tempStops.length < 2) {
            alert("Necesita al menos 2 paradas.");
            return;
        }
        // Validation: Start and End times needed
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
            // Update existing
            const index = saved.findIndex(r => r.id === state.editingRouteId);
            if (index !== -1) {
                saved[index] = route;
            } else {
                saved.push(route); // Fallback
            }
        } else {
            // Create new
            saved.push(route);
        }

        localStorage.setItem('gps_routes', JSON.stringify(saved));

        // alert("Ruta guardada!"); // REMOVED ALERT TO FIX PLAYWRIGHT TIMING
        clearEditor(); // Reset
        loadSavedRoutes();
        els.modal.classList.add('hidden'); // Manually hide modal instead of waiting for alert

        // Always select the saved route to make it active immediately
        selectRoute(route);
    }

    function clearEditor() {
        tempStops = [];
        state.editingRouteId = null;
        els.routeNameInput.value = '';
        state.drawingMode = false; // Reset state
        state.drawingRouteIndex = -1;
        MapLogic.clearEditor();
        renderStopList();

        // If buttons for cancel/new are added later, update text
        els.btnSave.textContent = "Guardar Bandera";
    }

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

    function editRoute(route) {
        state.editingRouteId = route.id;
        els.routeNameInput.value = route.name;
        tempStops = JSON.parse(JSON.stringify(route.stops));

        // Ensure pathNext exists for all
        tempStops.forEach(s => {
            if (!s.pathNext) s.pathNext = [];
        });

        MapLogic.renderEditorRoute(tempStops, updateStopLocation);
        renderStopList();
        els.btnSave.textContent = "Actualizar Bandera";
    }

    function deleteRoute(id) {
        if (!confirm("¿Seguro que desea eliminar esta bandera?")) return;

        let saved = JSON.parse(localStorage.getItem('gps_routes') || '[]');
        saved = saved.filter(r => r.id !== id);
        localStorage.setItem('gps_routes', JSON.stringify(saved));

        loadSavedRoutes();

        if (state.currentRoute && state.currentRoute.id === id) {
            state.currentRoute = null;
            els.routeName.textContent = "SIN BANDERA";
            // Clear nav map
            if (state.mapVisible) MapLogic.initNavMap('nav-map'); // reset view not perfectly clean but okay
        }
    }

    function selectRoute(route) {
        state.currentRoute = route;
        els.routeName.textContent = route.name;

        // Reset Nav Map
        if (state.mapVisible) {
             MapLogic.loadRouteOnNavMap(route.stops);
        }
    }

    // --- Device UI Toggles ---

    function toggleHighContrast() {
        state.highContrast = !state.highContrast;
        if (state.highContrast) {
            els.screenContent.classList.add('high-contrast');
        } else {
            els.screenContent.classList.remove('high-contrast');
        }
    }

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
