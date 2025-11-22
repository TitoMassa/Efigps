const RouteLogic = {

    // Calculate distance in km between two points (Haversine)
    getDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c; // Distance in km
        return d;
    },

    deg2rad: function(deg) {
        return deg * (Math.PI/180);
    },

    // Parse "HH:MM:SS" to seconds since midnight
    timeToSeconds: function(timeStr) {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parts[2] ? parseInt(parts[2]) : 0);
    },

    // Format seconds to "HH:MM:SS"
    secondsToTime: function(totalSeconds) {
        let h = Math.floor(totalSeconds / 3600);
        let m = Math.floor((totalSeconds % 3600) / 60);
        let s = Math.floor(totalSeconds % 60);
        return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
    },

    pad: function(num) {
        return num.toString().padStart(2, '0');
    },

    // Helper: Get full path points array [start, ...intermediates, end]
    getSegmentPoints: function(stopA, stopB) {
        const points = [{lat: stopA.lat, lng: stopA.lng}];
        if (stopA.pathNext && Array.isArray(stopA.pathNext)) {
            points.push(...stopA.pathNext);
        }
        points.push({lat: stopB.lat, lng: stopB.lng});
        return points;
    },

    // Helper: Get total distance of a path
    getPathTotalDistance: function(points) {
        let dist = 0;
        for(let i=0; i<points.length-1; i++) {
            dist += this.getDistance(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
        }
        return dist;
    },

    // Fill empty times in stops array
    calculateIntermediateTimes: function(stops) {
        // Sort by some index if needed, assuming stops are in order
        // Find indices of fixed times
        let fixedIndices = [];
        stops.forEach((s, i) => {
            if (s.time) fixedIndices.push(i);
        });

        if (fixedIndices.length < 2) return stops; // Not enough data

        for (let k = 0; k < fixedIndices.length - 1; k++) {
            let startIdx = fixedIndices[k];
            let endIdx = fixedIndices[k+1];

            let startSec = this.timeToSeconds(stops[startIdx].time);
            let endSec = this.timeToSeconds(stops[endIdx].time);
            let timeDiff = endSec - startSec;

            // Calculate total distance of this section (sum of segments)
            let totalSectionDist = 0;
            let segmentDists = []; // Distance of each STOP-TO-STOP segment

            for (let i = startIdx; i < endIdx; i++) {
                const points = this.getSegmentPoints(stops[i], stops[i+1]);
                const d = this.getPathTotalDistance(points);
                segmentDists.push(d);
                totalSectionDist += d;
            }

            // Interpolate
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

    // Main Deviation Calculation
    // returns { deviationSec: number, deviationStr: string, nextStop: object, expectedTimeSec: number }
    calculateDeviation: function(currentLat, currentLng, routeStops, currentTimeSec) {
        // 1. Find the active segment.
        // We search all detailed segments to find the closest point on the polyline network.

        let bestGlobalMatch = null;
        let minGlobalDist = Infinity;

        for (let i = 0; i < routeStops.length - 1; i++) {
            const stopA = routeStops[i];
            const stopB = routeStops[i+1];

            const points = this.getSegmentPoints(stopA, stopB);

            // Calculate lengths of sub-segments (A->p1, p1->p2, ...)
            let totalPathDist = 0;
            const subSegmentDists = [];

            for(let j=0; j<points.length-1; j++) {
                const d = this.getDistance(points[j].lat, points[j].lng, points[j+1].lat, points[j+1].lng);
                subSegmentDists.push(d);
                totalPathDist += d;
            }

            // Find user projection on this detailed path
            for(let j=0; j<points.length-1; j++) {
                const A = points[j];
                const B = points[j+1];

                // Project Point P onto Line Segment AB (sub-segment)
                const p = this.projectPointOnSegment(
                    {x: currentLat, y: currentLng},
                    {x: A.lat, y: A.lng},
                    {x: B.lat, y: B.lng}
                );

                // Distance from user to the segment line
                const dist = this.getDistance(currentLat, currentLng, p.x, p.y);

                if (dist < minGlobalDist) {
                    minGlobalDist = dist;

                    // Calculate how far along the STOP-TO-STOP path we are
                    let distBefore = 0;
                    for(let k=0; k<j; k++) distBefore += subSegmentDists[k];
                    distBefore += subSegmentDists[j] * p.ratio; // Add partial of current sub-segment

                    const totalRatio = totalPathDist > 0 ? distBefore / totalPathDist : 0;

                    bestGlobalMatch = {
                        stopIndex: i,
                        ratio: totalRatio
                    };
                }
            }
        }

        if (!bestGlobalMatch) return null;

        // 2. Calculate Expected Time
        const startNode = routeStops[bestGlobalMatch.stopIndex];
        const endNode = routeStops[bestGlobalMatch.stopIndex+1];

        const t1 = this.timeToSeconds(startNode.time);
        const t2 = this.timeToSeconds(endNode.time);

        const expectedTime = t1 + (t2 - t1) * bestGlobalMatch.ratio;

        // 3. Deviation
        const diff = expectedTime - currentTimeSec;

        // Format
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

    // Helper: Project point P onto segment AB. Returns {x, y, ratio}
    // Using simple Euclidean projection (flat earth approx is okay for short segments)
    projectPointOnSegment: function(P, A, B) {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        if (dx === 0 && dy === 0) return { x: A.x, y: A.y, ratio: 0 };

        const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / (dx * dx + dy * dy);

        // Clamp t to segment [0, 1]
        const clampedT = Math.max(0, Math.min(1, t));

        return {
            x: A.x + clampedT * dx,
            y: A.y + clampedT * dy,
            ratio: clampedT
        };
    }
};

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = RouteLogic;
}
