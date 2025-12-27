/**
 * Lógica para el cálculo de cronogramas y diagramas de servicio.
 * Distribuye los tiempos de conducción basándose en configuraciones de inicio, fin, vueltas y descansos.
 */
const ScheduleLogic = {

    /**
     * Calcula el itinerario completo (lista de viajes) para una línea.
     *
     * @param {Object} config - Configuración del diagrama.
     * @param {string} config.startTime - Hora inicio (HH:MM).
     * @param {string} config.endTime - Hora fin (HH:MM).
     * @param {number} config.turns - Cantidad de vueltas (puede ser decimal, ej. 4.5).
     * @param {Array<Object>} [config.rests] - Lista de esperas por vuelta [{ida: 5, vuelta: 5}, ...].
     * @param {number} [config.restIda] - Fallback: Minutos espera Ida global.
     * @param {number} [config.restVuelta] - Fallback: Minutos espera Vuelta global.
     * @param {Object} routeIda - Objeto de la ruta de Ida (debe tener stops).
     * @param {Object} routeVuelta - Objeto de la ruta de Vuelta (debe tener stops).
     * @returns {Array<Object>} Lista de viajes generados.
     */
    calculateItinerary: function(config, routeIda, routeVuelta) {
        const startSec = RouteLogic.timeToSeconds(config.startTime + ":00");
        const endSec = RouteLogic.timeToSeconds(config.endTime + ":00");

        if (startSec === null || endSec === null || startSec >= endSec) {
            console.error("Horarios inválidos");
            return [];
        }

        const totalDurationSec = endSec - startSec;
        const turns = parseFloat(config.turns);
        const totalLegs = Math.floor(turns * 2);
        if (totalLegs === 0) return [];

        // NUEVA LÓGICA: Duración de Vuelta Fija
        const durationPerTurnSec = totalDurationSec / turns;

        // Distribuimos el tiempo de manejo entre Ida y Vuelta según sus distancias
        const distIda = this.calculateRouteDistance(routeIda.stops);
        const distVuelta = this.calculateRouteDistance(routeVuelta.stops);
        const totalDist = distIda + distVuelta;

        if (totalDist === 0) return [];

        const trips = [];

        // Iteramos por tramos (legs)
        for (let i = 0; i < totalLegs; i++) {
            const isIda = (i % 2) === 0;
            const turnIndex = Math.floor(i / 2); // 0, 1, 2...

            // Determinar descansos para ESTA vuelta específica
            let currentRestIdaSec = 0;
            let currentRestVueltaSec = 0;

            if (config.rests && config.rests[turnIndex]) {
                currentRestIdaSec = (config.rests[turnIndex].ida || 0) * 60;
                currentRestVueltaSec = (config.rests[turnIndex].vuelta || 0) * 60;
            } else {
                // Fallback a global
                currentRestIdaSec = (parseInt(config.restIda) || 0) * 60;
                currentRestVueltaSec = (parseInt(config.restVuelta) || 0) * 60;
            }

            // Calculamos tiempos para ESTA vuelta
            const restPerTurnSec = currentRestIdaSec + currentRestVueltaSec;
            const drivePerTurnSec = durationPerTurnSec - restPerTurnSec;

            if (drivePerTurnSec <= 0) {
                console.error(`El descanso de la vuelta ${turnIndex + 1} excede su duración.`);
                return [];
            }

            const durationIda = Math.round(drivePerTurnSec * (distIda / totalDist));
            const durationVuelta = Math.round(drivePerTurnSec * (distVuelta / totalDist));

            // Calculamos el tiempo base de inicio de esta vuelta
            const turnStartSec = startSec + (turnIndex * durationPerTurnSec);

            // Determinar Inicio y Fin de este Tramo específico
            let legStartSec, legEndSec;

            if (isIda) {
                legStartSec = turnStartSec;
                legEndSec = legStartSec + durationIda;
            } else {
                // Vuelta empieza después de la Ida + Descanso Ida específico
                legStartSec = turnStartSec + durationIda + currentRestIdaSec;
                legEndSec = legStartSec + durationVuelta;
            }

            const tripName = isIda ? "Ida" : "Vuelta";
            const routeTemplate = isIda ? routeIda : routeVuelta;

            // Generar paradas
            const tripStops = JSON.parse(JSON.stringify(routeTemplate.stops));
            tripStops[0].time = RouteLogic.secondsToTime(legStartSec);
            tripStops[tripStops.length - 1].time = RouteLogic.secondsToTime(legEndSec);

            for (let k = 1; k < tripStops.length - 1; k++) {
                tripStops[k].time = "";
            }

            RouteLogic.calculateIntermediateTimes(tripStops);

            trips.push({
                id: Date.now() + i,
                direction: tripName,
                legIndex: i + 1,
                startTime: RouteLogic.secondsToTime(legStartSec),
                endTime: RouteLogic.secondsToTime(legEndSec),
                stops: tripStops,
                routeOriginalName: routeTemplate.name
            });
        }

        return trips;
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
