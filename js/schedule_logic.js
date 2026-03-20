/**
 * Lógica para el cálculo de cronogramas y diagramas de servicio.
 * Distribuye los tiempos de conducción basándose en configuraciones de inicio, fin, vueltas y descansos.
 */
const ScheduleLogic = {

    /**
     * Calcula el itinerario completo (lista de viajes) para una línea.
     *
     * @param {Object} config - Configuración del diagrama.
     * @param {string} config.startTime - Fecha y hora de inicio (YYYY-MM-DDTHH:MM).
     * @param {string} config.endTime - Fecha y hora de fin (YYYY-MM-DDTHH:MM).
     * @param {number} config.turns - Cantidad de tramos.
     * @param {Array<Object>} config.rests - Lista de configuraciones por tramo [{routeId, rest, weight}, ...].
     * @param {Array<Object>} savedRoutes - Lista de todas las rutas guardadas disponibles.
     * @returns {Array<Object>} Lista de viajes generados.
     */
    calculateItinerary: function(config, savedRoutes) {
        const startTimestamp = new Date(config.startTime).getTime();
        const endTimestamp = new Date(config.endTime).getTime();

        if (isNaN(startTimestamp) || isNaN(endTimestamp) || startTimestamp >= endTimestamp) {
            console.error("Horarios de inicio o fin inválidos");
            return [];
        }

        const totalDurationSec = (endTimestamp - startTimestamp) / 1000;
        const totalLegs = config.turns;

        if (totalLegs <= 0 || !config.rests || config.rests.length !== totalLegs) {
            console.error("Configuración de tramos inválida");
            return [];
        }

        // Determinar pesos numéricos para las duraciones
        const weightMap = {
            'corta': 0.8,
            'media': 1.0,
            'larga': 1.2
        };

        // Recopilar datos de cada tramo y calcular la suma de los "pesos de distancia" totales
        let totalWaitTimeSec = 0;
        let totalDistanceWeight = 0;
        const legsData = [];

        for (let i = 0; i < totalLegs; i++) {
            const restConfig = config.rests[i];
            const route = savedRoutes.find(r => r.id == restConfig.routeId);

            if (!route) {
                console.error(`No se encontró la ruta para el tramo ${i + 1}`);
                return [];
            }

            const dist = this.calculateRouteDistance(route.stops);
            const weightValue = weightMap[restConfig.weight] || 1.0;
            const distanceWeight = dist * weightValue;
            const waitTimeSec = (restConfig.rest || 0) * 60;

            totalDistanceWeight += distanceWeight;
            totalWaitTimeSec += waitTimeSec;

            legsData.push({
                route: route,
                dist: dist,
                weightValue: weightValue,
                distanceWeight: distanceWeight,
                waitTimeSec: waitTimeSec,
                weightName: restConfig.weight
            });
        }

        const totalDriveTimeSec = totalDurationSec - totalWaitTimeSec;

        if (totalDriveTimeSec <= 0) {
            console.error("Los tiempos de espera superan el tiempo total disponible.");
            return [];
        }

        if (totalDistanceWeight === 0) {
            console.error("Las rutas no tienen distancia válida.");
            return [];
        }

        const trips = [];
        let currentLegStartSec = startTimestamp / 1000;

        // Iteramos por tramos (legs) para calcular sus tiempos absolutos
        for (let i = 0; i < totalLegs; i++) {
            const legData = legsData[i];

            // Distribuir el tiempo de conducción proporcionalmente a la distancia ponderada
            const legDriveDurationSec = Math.round(totalDriveTimeSec * (legData.distanceWeight / totalDistanceWeight));

            const legStartSec = currentLegStartSec;
            const legEndSec = legStartSec + legDriveDurationSec;

            // Generar paradas
            const tripStops = JSON.parse(JSON.stringify(legData.route.stops));
            tripStops[0].time = this.formatDateTimeSecondsToTime(legStartSec);
            tripStops[tripStops.length - 1].time = this.formatDateTimeSecondsToTime(legEndSec);

            for (let k = 1; k < tripStops.length - 1; k++) {
                tripStops[k].time = "";
            }

            this.calculateIntermediateTimesWithAbsoluteSeconds(tripStops, legStartSec, legEndSec, legData.route);

            trips.push({
                id: Date.now() + i,
                direction: legData.route.name, // Fallback visual de compatibilidad
                legIndex: i + 1,
                startTime: this.formatDateTimeSecondsToTime(legStartSec),
                endTime: this.formatDateTimeSecondsToTime(legEndSec),
                stops: tripStops,
                routeOriginalName: legData.route.name,
                durationWeight: legData.weightName
            });

            // Preparar inicio del siguiente tramo
            currentLegStartSec = legEndSec + legData.waitTimeSec;
        }

        return trips;
    },

    /**
     * Formatea segundos absolutos a un string HH:MM:SS para compatibilidad.
     * Toma en cuenta los cruces de medianoche.
     */
    formatDateTimeSecondsToTime: function(absoluteSec) {
        const date = new Date(absoluteSec * 1000);
        return date.toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    },

    /**
     * Calcula tiempos intermedios basándose en timestamps absolutos para evitar problemas
     * al cruzar la medianoche con RouteLogic estándar.
     */
    calculateIntermediateTimesWithAbsoluteSeconds: function(stops, startSec, endSec, originalRoute) {
        if (stops.length < 2) return stops;

        const totalTime = endSec - startSec;
        const dists = [];
        let totalDist = 0;

        // Calcular distancias acumulativas de la ruta original usando polilíneas si las tiene
        for (let i = 0; i < stops.length - 1; i++) {
            const points = RouteLogic.getSegmentPoints(stops[i], stops[i+1]);
            const d = RouteLogic.getPathTotalDistance(points);
            dists.push(d);
            totalDist += d;
        }

        let accumulatedDist = 0;
        for (let i = 1; i < stops.length - 1; i++) {
            accumulatedDist += dists[i - 1];
            const ratio = totalDist > 0 ? (accumulatedDist / totalDist) : 0;
            const expectedSec = startSec + (totalTime * ratio);
            stops[i].time = this.formatDateTimeSecondsToTime(expectedSec);
        }

        return stops;
    },

    /**
     * Helper para calcular distancia total de paradas (usando lógica existente).
     * @param {Array} stops
     */
    calculateRouteDistance: function(stops) {
        let total = 0;
        for (let i = 0; i < stops.length - 1; i++) {
            const points = RouteLogic.getSegmentPoints(stops[i], stops[i+1]);
            total += RouteLogic.getPathTotalDistance(points);
        }
        return total;
    }
};
