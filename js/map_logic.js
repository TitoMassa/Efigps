// Map Logic using Leaflet

const MapLogic = {
    editorMap: null,
    navMap: null,
    editorMarkers: [], // Only for STOPS
    editorIntermediateMarkers: [], // Small dots for path points
    editorPolyline: null,
    navPolyline: null,
    navUserMarker: null,
    navMarkers: [], // Stores { marker: L.Layer, stopName: string }

    initEditorMap: function(elementId, onClickCallback) {
        if (this.editorMap) return; // Already init

        this.editorMap = L.map(elementId).setView([-34.6037, -58.3816], 13); // Buenos Aires default
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.editorMap);

        this.editorMap.on('click', (e) => {
            onClickCallback(e.latlng);
        });
    },

    initNavMap: function(elementId) {
        if (this.navMap) return;

        this.navMap = L.map(elementId, {
            zoomControl: false, // Minimal UI
            attributionControl: false
        }).setView([-34.6037, -58.3816], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.navMap);
    },

    // Editor Methods

    // Clears all editor layers
    clearEditor: function() {
        this.editorMarkers.forEach(m => this.editorMap.removeLayer(m));
        this.editorMarkers = [];
        this.editorIntermediateMarkers.forEach(m => this.editorMap.removeLayer(m));
        this.editorIntermediateMarkers = [];

        if (this.editorPolyline) this.editorMap.removeLayer(this.editorPolyline);
        this.editorPolyline = null;
    },

    // Render the full route (stops + paths) on the editor map
    renderEditorRoute: function(stops, onStopDragCallback) {
        if (!this.editorMap) return;

        // Clear existing visual elements first
        this.clearEditor();

        if (!stops || stops.length === 0) return;

        const fullPathLatLngs = [];

        stops.forEach((stop, i) => {
            // 1. Add Marker for the Stop
            const marker = L.marker([stop.lat, stop.lng], { draggable: true }).addTo(this.editorMap);
            marker.bindPopup(`<strong>${stop.name}</strong>`); // Removed .openPopup() to prevent auto-centering

            marker.on('dragend', function(event) {
                const marker = event.target;
                const position = marker.getLatLng();
                if (onStopDragCallback) {
                    onStopDragCallback(i, position.lat, position.lng);
                }
            });

            this.editorMarkers.push(marker);

            // 2. Collect Path Points
            fullPathLatLngs.push([stop.lat, stop.lng]);

            // 3. Add Intermediate Points if they exist
            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                stop.pathNext.forEach(pt => {
                    fullPathLatLngs.push([pt.lat, pt.lng]);

                    // Add small dot for intermediate point
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

        // Draw Polyline
        if (fullPathLatLngs.length > 1) {
            this.editorPolyline = L.polyline(fullPathLatLngs, {color: 'blue', weight: 3}).addTo(this.editorMap);
        }
    },

    // Legacy method for compatibility if needed, but refactored to use renderEditorRoute in app.js
    addEditorMarker: function(lat, lng, label) {
        // This method is deprecated in favor of renderEditorRoute
        // keeping it minimal just in case
        const marker = L.marker([lat, lng]).addTo(this.editorMap);
        if(label) marker.bindPopup(label).openPopup();
        this.editorMarkers.push(marker);
    },


    // Nav Methods
    loadRouteOnNavMap: function(stops) {
        if (!this.navMap) return;
        // Clear prev polyline
        if (this.navPolyline) this.navMap.removeLayer(this.navPolyline);
        // Clear prev markers
        this.navMarkers.forEach(obj => this.navMap.removeLayer(obj.marker));
        this.navMarkers = [];

        // Build detailed polyline
        const latlngs = [];
        stops.forEach(stop => {
            latlngs.push([stop.lat, stop.lng]);
            if (stop.pathNext && Array.isArray(stop.pathNext)) {
                stop.pathNext.forEach(pt => latlngs.push([pt.lat, pt.lng]));
            }
        });

        this.navPolyline = L.polyline(latlngs, {color: 'red', weight: 5}).addTo(this.navMap);

        // Add markers for stops ONLY (skip intermediates)
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

    updateStopMarkers: function(nextStopName) {
        this.navMarkers.forEach(obj => {
            if (obj.stopName === nextStopName) {
                // Set Green
                obj.marker.setStyle({
                    color: 'green',
                    fillColor: '#00ff00'
                });
                // Maybe bring to front?
                obj.marker.bringToFront();
            } else {
                // Set Blue
                obj.marker.setStyle({
                    color: 'blue',
                    fillColor: '#3388ff'
                });
            }
        });
    },

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
        this.navMap.setView([lat, lng]); // Follow user
    }
};
