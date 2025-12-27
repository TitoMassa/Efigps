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
     * @param {number} config.restIda - Minutos de espera tras finalizar Ida.
     * @param {number} config.restVuelta - Minutos de espera tras finalizar Vuelta.
     * @param {Object} routeIda - Objeto de la ruta de Ida (debe tener stops).
     * @param {Object} routeVuelta - Objeto de la ruta de Vuelta (debe tener stops).
     * @returns {Array<Object>} Lista de viajes generados.
     */
    calculateItinerary: function(config, routeIda, routeVuelta) {
        const startSec = RouteLogic.timeToSeconds(config.startTime + ":00");
        const endSec = RouteLogic.timeToSeconds(config.endTime + ":00");

        // Validación básica
        if (startSec === null || endSec === null || startSec >= endSec) {
            console.error("Horarios inválidos");
            return [];
        }

        const totalDurationSec = endSec - startSec;
        const turns = parseFloat(config.turns);
        const restIdaSec = parseInt(config.restIda) * 60;
        const restVueltaSec = parseInt(config.restVuelta) * 60;

        // Calcular número total de tramos (legs)
        const totalLegs = Math.floor(turns * 2);
        if (totalLegs === 0) return [];

        // NUEVA LÓGICA: Duración de Vuelta Fija
        // Calculamos cuánto dura una vuelta entera teórica (Ida + Vuelta)
        // basándonos puramente en el tiempo total y la cantidad de vueltas.
        const durationPerTurnSec = totalDurationSec / turns;

        // Calculamos el tiempo total de descanso por vuelta
        const restPerTurnSec = restIdaSec + restVueltaSec;

        // Calculamos el tiempo disponible para manejar en una vuelta
        const drivePerTurnSec = durationPerTurnSec - restPerTurnSec;

        if (drivePerTurnSec <= 0) {
            console.error("El tiempo de descanso excede la duración calculada para la vuelta");
            return [];
        }

        // Distribuimos el tiempo de manejo entre Ida y Vuelta según sus distancias
        const distIda = this.calculateRouteDistance(routeIda.stops);
        const distVuelta = this.calculateRouteDistance(routeVuelta.stops);
        const totalDist = distIda + distVuelta;

        if (totalDist === 0) return [];

        // Tiempo asignado a Ida y Vuelta (restando los descansos del bloque fijo)
        const durationIda = Math.round(drivePerTurnSec * (distIda / totalDist));
        const durationVuelta = Math.round(drivePerTurnSec * (distVuelta / totalDist));

        // Generar los viajes
        const trips = [];

        // Iteramos por tramos (legs)
        // Leg 0 = Ida 1, Leg 1 = Vuelta 1, Leg 2 = Ida 2, etc.
        for (let i = 0; i < totalLegs; i++) {
            const isIda = (i % 2) === 0;
            const turnIndex = Math.floor(i / 2); // En qué vuelta estamos (0, 1, 2...)

            // Calculamos el tiempo base de inicio de esta vuelta
            const turnStartSec = startSec + (turnIndex * durationPerTurnSec);

            // Determinar Inicio y Fin de este Tramo específico
            let legStartSec, legEndSec;

            if (isIda) {
                // Ida empieza al inicio del bloque de la vuelta
                legStartSec = turnStartSec;
                legEndSec = legStartSec + durationIda;
            } else {
                // Vuelta empieza después de la Ida + Descanso Ida
                // (Nota: durationIda es el tiempo de manejo de la ida)
                legStartSec = turnStartSec + durationIda + restIdaSec;
                legEndSec = legStartSec + durationVuelta;
            }

            const tripName = isIda ? "Ida" : "Vuelta";
            const routeTemplate = isIda ? routeIda : routeVuelta;

            // Generar paradas con horarios calculados
            const tripStops = JSON.parse(JSON.stringify(routeTemplate.stops));

            // Asignar horario inicio y fin
            tripStops[0].time = RouteLogic.secondsToTime(legStartSec);
            tripStops[tripStops.length - 1].time = RouteLogic.secondsToTime(legEndSec);

            // Limpiar intermedios
            for (let k = 1; k < tripStops.length - 1; k++) {
                tripStops[k].time = "";
            }

            // Recalcular intermedios
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
