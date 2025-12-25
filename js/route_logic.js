/**
 * Lógica de enrutamiento y cálculos matemáticos para la navegación.
 * Maneja distancias, tiempos, interpolaciones y proyecciones geométricas.
 */
const RouteLogic = {

    /**
     * Calcula la distancia en kilómetros entre dos coordenadas geográficas usando la fórmula de Haversine.
     *
     * @param {number} lat1 - Latitud del primer punto.
     * @param {number} lon1 - Longitud del primer punto.
     * @param {number} lat2 - Latitud del segundo punto.
     * @param {number} lon2 - Longitud del segundo punto.
     * @returns {number} La distancia en kilómetros entre los dos puntos.
     */
    getDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la tierra en km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c; // Distancia en km
        return d;
    },

    /**
     * Calcula una aproximación de la distancia al cuadrado entre dos puntos.
     * Útil para comparaciones rápidas donde la precisión geodésica exacta no es crítica (distancias cortas).
     * Utiliza proyección equirectangular para evitar múltiples funciones trigonométricas y raíces cuadradas.
     *
     * @param {number} lat1
     * @param {number} lon1
     * @param {number} lat2
     * @param {number} lon2
     * @returns {number} Valor proporcional a la distancia al cuadrado.
     */
    getApproxDistanceSq: function(lat1, lon1, lat2, lon2) {
        const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2 * (Math.PI / 180));
        const y = lat2 - lat1;
        return x * x + y * y;
    },

    /**
     * Convierte grados a radianes.
     *
     * @param {number} deg - El valor en grados.
     * @returns {number} El valor convertido a radianes.
     */
    deg2rad: function(deg) {
        return deg * (Math.PI/180);
    },

    /**
     * Convierte una cadena de tiempo en formato "HH:MM:SS" a segundos transcurridos desde la medianoche.
     *
     * @param {string} timeStr - La cadena de tiempo (ej. "14:30:00").
     * @returns {number|null} El tiempo en segundos, o null si la entrada no es válida.
     */
    timeToSeconds: function(timeStr) {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parts[2] ? parseInt(parts[2]) : 0);
    },

    /**
     * Convierte un total de segundos a una cadena de tiempo en formato "HH:MM:SS".
     *
     * @param {number} totalSeconds - El total de segundos desde la medianoche.
     * @returns {string} La cadena de tiempo formateada.
     */
    secondsToTime: function(totalSeconds) {
        let h = Math.floor(totalSeconds / 3600);
        let m = Math.floor((totalSeconds % 3600) / 60);
        let s = Math.floor(totalSeconds % 60);
        return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
    },

    /**
     * Rellena un número con ceros a la izquierda para asegurar al menos dos dígitos.
     *
     * @param {number} num - El número a formatear.
     * @returns {string} El número como cadena con padding de ceros.
     */
    pad: function(num) {
        return num.toString().padStart(2, '0');
    },

    /**
     * Obtiene la lista completa de puntos de coordenadas para un segmento entre dos paradas.
     * Incluye los puntos intermedios (trazado) si existen.
     *
     * @param {Object} stopA - Objeto de la parada de inicio. Debe contener lat, lng y opcionalmente pathNext.
     * @param {Object} stopB - Objeto de la parada final. Debe contener lat, lng.
     * @returns {Array<Object>} Lista de objetos con propiedades {lat, lng} representando el camino completo.
     */
    getSegmentPoints: function(stopA, stopB) {
        const points = [{lat: stopA.lat, lng: stopA.lng}];
        if (stopA.pathNext && Array.isArray(stopA.pathNext)) {
            points.push(...stopA.pathNext);
        }
        points.push({lat: stopB.lat, lng: stopB.lng});
        return points;
    },

    /**
     * Calcula la distancia total acumulada de una ruta definida por una lista de puntos.
     *
     * @param {Array<Object>} points - Lista de puntos {lat, lng}.
     * @returns {number} La distancia total del camino en kilómetros.
     */
    getPathTotalDistance: function(points) {
        let dist = 0;
        for(let i=0; i<points.length-1; i++) {
            dist += this.getDistance(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
        }
        return dist;
    },

    /**
     * Calcula y rellena los horarios intermedios faltantes en una lista de paradas.
     * Utiliza la distancia de los segmentos para interpolar el tiempo entre dos paradas con horario fijo.
     *
     * @param {Array<Object>} stops - La lista de objetos de parada. Se modifica in-situ.
     * @returns {Array<Object>} La lista de paradas con los tiempos actualizados.
     */
    calculateIntermediateTimes: function(stops) {
        // Ordenar por algún índice si es necesario, asumiendo que las paradas están en orden
        // Encontrar índices de tiempos fijos
        let fixedIndices = [];
        stops.forEach((s, i) => {
            if (s.time) fixedIndices.push(i);
        });

        if (fixedIndices.length < 2) return stops; // No hay suficientes datos

        for (let k = 0; k < fixedIndices.length - 1; k++) {
            let startIdx = fixedIndices[k];
            let endIdx = fixedIndices[k+1];

            let startSec = this.timeToSeconds(stops[startIdx].time);
            let endSec = this.timeToSeconds(stops[endIdx].time);
            let timeDiff = endSec - startSec;

            // Calcular distancia total de esta sección (suma de segmentos)
            let totalSectionDist = 0;
            let segmentDists = []; // Distancia de cada segmento PARADA-PARADA

            for (let i = startIdx; i < endIdx; i++) {
                const points = this.getSegmentPoints(stops[i], stops[i+1]);
                const d = this.getPathTotalDistance(points);
                segmentDists.push(d);
                totalSectionDist += d;
            }

            // Interpolar
            let accumDist = 0;
            for (let i = startIdx + 1; i < endIdx; i++) {
                accumDist += segmentDists[i - startIdx - 1];
                let ratio = totalSectionDist > 0 ? accumDist / totalSectionDist : 0;
                let interpSec = startSec + (timeDiff * ratio);
                stops[i].time = this.secondsToTime(interpSec);
            }
        }
        return stops;
    },

    /**
     * Calcula la desviación (adelanto/atraso) de la posición actual respecto a la ruta planificada.
     * Proyecta la posición actual sobre el segmento de ruta más cercano para estimar el tiempo esperado.
     *
     * @param {number} currentLat - Latitud actual del dispositivo.
     * @param {number} currentLng - Longitud actual del dispositivo.
     * @param {Array<Object>} routeStops - Lista de paradas de la ruta actual.
     * @param {number} currentTimeSec - Tiempo actual en segundos desde medianoche.
     * @returns {Object|null} Objeto con detalles de la desviación { deviationSec, deviationStr, nextStop, expectedTimeSec }, o null si no se encuentra coincidencia.
     */
    calculateDeviation: function(currentLat, currentLng, routeStops, currentTimeSec) {
        // 1. Encontrar el segmento activo.
        // Buscamos todos los segmentos detallados para encontrar el punto más cercano en la red de polilíneas.

        let bestGlobalMatch = null;
        let minGlobalDistSq = Infinity;

        for (let i = 0; i < routeStops.length - 1; i++) {
            const stopA = routeStops[i];
            const stopB = routeStops[i+1];

            const points = this.getSegmentPoints(stopA, stopB);

            // Calcular longitudes de sub-segmentos (A->p1, p1->p2, ...)
            let totalPathDist = 0;
            const subSegmentDists = [];

            for(let j=0; j<points.length-1; j++) {
                const d = this.getDistance(points[j].lat, points[j].lng, points[j+1].lat, points[j+1].lng);
                subSegmentDists.push(d);
                totalPathDist += d;
            }

            // Encontrar proyección del usuario en este camino detallado
            for(let j=0; j<points.length-1; j++) {
                const A = points[j];
                const B = points[j+1];

                // Proyectar Punto P sobre Segmento de Línea AB (sub-segmento)
                const p = this.projectPointOnSegment(
                    {x: currentLat, y: currentLng},
                    {x: A.lat, y: A.lng},
                    {x: B.lat, y: B.lng}
                );

                // Distancia del usuario a la línea del segmento (Aproximación cuadrática para rendimiento)
                const distSq = this.getApproxDistanceSq(currentLat, currentLng, p.x, p.y);

                if (distSq < minGlobalDistSq) {
                    minGlobalDistSq = distSq;

                    // Calcular qué tan avanzado estamos en el camino PARADA-PARADA
                    let distBefore = 0;
                    for(let k=0; k<j; k++) distBefore += subSegmentDists[k];
                    distBefore += subSegmentDists[j] * p.ratio; // Añadir parcial del sub-segmento actual

                    const totalRatio = totalPathDist > 0 ? distBefore / totalPathDist : 0;

                    bestGlobalMatch = {
                        stopIndex: i,
                        ratio: totalRatio
                    };
                }
            }
        }

        if (!bestGlobalMatch) return null;

        // 2. Calcular Tiempo Esperado
        const startNode = routeStops[bestGlobalMatch.stopIndex];
        const endNode = routeStops[bestGlobalMatch.stopIndex+1];

        const t1 = this.timeToSeconds(startNode.time);
        const t2 = this.timeToSeconds(endNode.time);

        const expectedTime = t1 + (t2 - t1) * bestGlobalMatch.ratio;

        // 3. Desviación
        const diff = expectedTime - currentTimeSec;

        // Formato
        const sign = diff >= 0 ? '+' : '-';
        const absDiff = Math.abs(diff);
        const m = Math.floor(absDiff / 60);
        const s = Math.floor(absDiff % 60);

        const mStr = m.toString().padStart(2, '0');
        const sStr = s.toString().padStart(2, '0');

        return {
            deviationSec: diff,
            deviationStr: `${sign}${mStr}:${sStr}`,
            nextStop: endNode.name,
            expectedTimeSec: expectedTime
        };
    },

    /**
     * Proyecta un punto P sobre un segmento de línea definido por los puntos A y B.
     * Utiliza proyección euclidiana simple (aproximación aceptable para segmentos cortos).
     *
     * @param {Object} P - Punto a proyectar {x, y}.
     * @param {Object} A - Punto inicial del segmento {x, y}.
     * @param {Object} B - Punto final del segmento {x, y}.
     * @returns {Object} Objeto con el punto proyectado {x, y} y el ratio de progreso (0-1).
     */
    projectPointOnSegment: function(P, A, B) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        if (dx === 0 && dy === 0) return { x: A.x, y: A.y, ratio: 0 };

        const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / (dx * dx + dy * dy);

        // Limitar t al segmento [0, 1]
        const clampedT = Math.max(0, Math.min(1, t));

        return {
            x: A.x + clampedT * dx,
            y: A.y + clampedT * dy,
            ratio: clampedT
        };
    }
};

// Exportar para pruebas
if (typeof module !== 'undefined') {
    module.exports = RouteLogic;
}
