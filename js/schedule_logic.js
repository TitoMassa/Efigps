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
        // 1 Vuelta Completa = 2 Tramos (Ida + Vuelta)
        // 0.5 Vuelta = 1 Tramo (Ida)
        const totalLegs = Math.floor(turns * 2); // Ejemplo: 4.5 vueltas * 2 = 9 tramos

        if (totalLegs === 0) return [];

        // Calcular tiempo total de descanso
        let totalRestTimeSec = 0;
        for (let i = 0; i < totalLegs - 1; i++) {
            const isIda = (i % 2) === 0;
            // Si terminamos Ida (i=0,2...), descansamos restIda.
            // Si terminamos Vuelta (i=1,3...), descansamos restVuelta.
            totalRestTimeSec += isIda ? restIdaSec : restVueltaSec;
        }

        // Tiempo disponible para conducción
        const totalDrivingTimeSec = totalDurationSec - totalRestTimeSec;

        if (totalDrivingTimeSec <= 0) {
            console.error("El tiempo de descanso excede la duración del servicio");
            return [];
        }

        // Calcular distancias para distribuir el tiempo proporcionalmente
        const distIda = this.calculateRouteDistance(routeIda.stops);
        const distVuelta = this.calculateRouteDistance(routeVuelta.stops);

        if (distIda === 0 && distVuelta === 0) return []; // Evitar div 0

        // Calcular distancia total recorrrida en todo el diagrama
        let totalDiagramDistance = 0;

        // Pares completos (Ida + Vuelta)
        const fullCycles = Math.floor(turns);
        totalDiagramDistance += fullCycles * (distIda + distVuelta);

        // Media vuelta extra?
        const hasHalfTurn = (turns % 1) !== 0;
        if (hasHalfTurn) {
            totalDiagramDistance += distIda; // Asumimos que la media vuelta siempre es Ida
        }

        // Calcular tiempo por km (o unidad de distancia)
        const timePerUnit = totalDrivingTimeSec / totalDiagramDistance;

        // Tiempos asignados a cada tramo
        const durationIda = Math.round(distIda * timePerUnit);
        const durationVuelta = Math.round(distVuelta * timePerUnit);

        // Generar los viajes
        const trips = [];
        let currentSec = startSec;

        for (let i = 0; i < totalLegs; i++) {
            const isIda = (i % 2) === 0; // Pares son Ida (0, 2...), Impares Vuelta (1, 3...)
            const duration = isIda ? durationIda : durationVuelta;
            const routeTemplate = isIda ? routeIda : routeVuelta;
            const tripName = isIda ? "Ida" : "Vuelta";

            const tripStart = currentSec;
            const tripEnd = currentSec + duration;

            // Generar paradas con horarios calculados
            // Clonamos las paradas para no modificar la ruta original
            const tripStops = JSON.parse(JSON.stringify(routeTemplate.stops));

            // Asignar horario inicio y fin
            tripStops[0].time = RouteLogic.secondsToTime(tripStart);
            tripStops[tripStops.length - 1].time = RouteLogic.secondsToTime(tripEnd);

            // Limpiar intermedios para forzar recálculo
            for (let k = 1; k < tripStops.length - 1; k++) {
                tripStops[k].time = "";
            }

            // Recalcular intermedios usando la lógica existente
            RouteLogic.calculateIntermediateTimes(tripStops);

            trips.push({
                id: Date.now() + i, // ID único temporal
                direction: tripName,
                legIndex: i + 1,
                startTime: RouteLogic.secondsToTime(tripStart),
                endTime: RouteLogic.secondsToTime(tripEnd),
                stops: tripStops,
                routeOriginalName: routeTemplate.name
            });

            // Avanzar reloj (Sumar duración + descanso si no es el último)
            currentSec += duration;
            if (i < totalLegs - 1) {
                // Si terminamos Ida, aplicamos restIda antes de la vuelta.
                // Si terminamos Vuelta, aplicamos restVuelta antes de la siguiente ida.
                currentSec += isIda ? restIdaSec : restVueltaSec;
            }
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
