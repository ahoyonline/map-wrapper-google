var GoogleMapHandler = {
  settings: {
    googleapisUrl: 'https://maps.googleapis.com/maps/api/js?callback=MapWrapper._handler._googleLoaded&libraries=drawing',
    strokeColor: '#FF0000',
    strokeOpacity: 0.7,
    strokeWeight: 8,
    editOnSelect: true
  },
  deferreds: {
    mapLoaded: null,
    mapInitialized: null
  },
  overlays: {
    polylines: [],
    markers: []
  },
  selectedOverlay: null,
  drawingManager: null,
  onLoad: function() {
    if (this.deferreds.mapLoaded) {
      return;
    }
    this.deferreds.mapLoaded = new $.Deferred();
    this.deferreds.mapInitialized = new $.Deferred();
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = this.settings.googleapisUrl;
    document.head.appendChild(script);
  },
  onInitialize: function(template) {
    var self = this;
    this.deferreds.mapLoaded.done(function() {
      self._onInitializeDeferred(template);
    });
  },
  onTemplateDestroyed: function(template) {
    if (MapWrapper.map) {
      google.maps.event.clearInstanceListeners(MapWrapper.map);
      delete MapWrapper.map;
    }
  },
  drawFeatures: function() {
    var self = this;
    this.deferreds.mapInitialized.done(function() {
      self._drawFeaturesDeferred();
    });
  },
  _googleLoaded: function() {
    this.deferreds.mapLoaded.resolve();
  },
  _onInitializeDeferred: function(template) {
    if (MapWrapper.map) {
      return;
    }
    var canvas = template.$('.map-canvas').get(0);
    MapWrapper.map = new google.maps.Map(canvas, {
      center: new google.maps.LatLng(MapWrapper.options.mapCentre[0], MapWrapper.options.mapCentre[1]),
      zoom: MapWrapper.options.mapZoom
    });

    this.drawingManager = new google.maps.drawing.DrawingManager({
      drawingControl: false
    });

    this.drawingManager.setMap(MapWrapper.map);
    this.deferreds.mapInitialized.resolve();
  },
  _drawFeaturesDeferred: function() {
    var bounds = new google.maps.LatLngBounds();
    this.overlays.markers.map(function(f) {
      f.setMap(null);
    });
    this.overlays.polylines.map(function(f) {
      f.setMap(null);
    });
    this.overlays.markers = [];
    this.overlays.polylines = [];
    var overlay;
    if (features && MapWrapper.mapData.markers) {
      for (var i = 0; i < MapWrapper.mapData.markers.length; i++) {
        if (MapWrapper.mapData.markers[i].point) {
          overlay = this._drawMarker(MapWrapper.mapData.markers[i], i);
        }
      }
    }
    if (MapWrapper.mapData && MapWrapper.mapData.polylines) {
      for (var j = 0; j < MapWrapper.mapData.polylines.length; j++) {
        overlay = this._drawPolyline(MapWrapper.mapData.polylines[j], j);
      }
    }

    if (overlay) {
      this.overlays[overlay.type].push(overlay);
    }

    // TODO: Build the bounds
    
    if (!bounds.isEmpty()) {
      MapWrapper.map.fitBounds(bounds);
      MapWrapper.map.panToBounds(bounds);
    }
  },
  /**
   *
   */
  _drawMarker: function(marker, featureIdx) {
    var gMarker = new google.maps.Marker({
      position: {
        lat: marker.point[0],
        lng: marker.point[1]
      },
      type: 'markers',
      featureIdx: featureIdx
    });
    gMarker.setMap(MapWrapper.map);
    return gMarker;
  },
  _drawPolyline: function(polyline, featureIdx) {
    var self = this;
    var featurePath = [];
    if (!polyline.points || polyline.points.length === 0) {
      MapWrapper.mapData.polylines[featureIdx].editedBy = Meteor.userId ? Meteor.userId : -1;
      var mapBounds = MapWrapper.map.getBounds();
      var lat = (mapBounds.getSouthWest().lat() + mapBounds.getNorthEast().lat()) / 2;
      var lng1 = mapBounds.getSouthWest().lng();
      var lng2 = mapBounds.getNorthEast().lng();
      polyline.points = [
        [lat, lng1 + (lng2 - lng1) / 4],
        [lat, lng2 - (lng2 - lng1) / 4]
      ];
    }
    for (var j = 0; j < polyline.points.length; j++) {
      var wp = polyline.points[j];
      var latLng = new google.maps.LatLng(wp[0], wp[1]);
      featurePath.push(latLng);
    }
    var overlay = new google.maps.Polyline({
      path: featurePath,
      map: MapWrapper.map,
      geodesic: false,
      strokeColor: this.settings.strokeColor,
      strokeOpacity: this.settings.strokeOpacity,
      strokeWeight: this.settings.strokeWeight,
      featureIdx: featureIdx,
      type: 'polylines'
    });
    if (polyline.editedBy === -1 ||
      polyline.editedBy !== undefined && polyline.editedBy === Meteor.userId) {
      self._setMapEdit(overlay);
    }
    if (this.settings.editOnSelect) {
      google.maps.event.addListener(overlay, 'click', function(e) {
        MapWrapper.mapData.polylines[featureIdx].editedBy = Meteor.userId ? Meteor.userId : -1;
        MapWrapper.notifyListener('polylines', featureIdx);
        self._setMapEdit(overlay);
      });
    }
    return overlay;
  },
  _setMapEdit: function(overlay) {
    var self = this;

    // If there is a feature already selected, we want to clear the selection
    if (this.selectedOverlay) {
      if (overlay.featureIdx !== this.selectedOverlay.featureIdx || overlay.type !== this.selectedOverlay.type) {
        self._clearMapSelection();
      }
    }
    if (overlay.editable) {
      return;
    }
    if (overlay) {
      overlay.setEditable(true);
      google.maps.event.addListener(overlay, 'click', function(e) {
        // When editing, remove vertexes by clicking on them
        if (e.vertex !== undefined) {
          var path = overlay.getPath();
          if (path.length > 2) {
            path.removeAt(e.vertex);
          }
        }
      });
      google.maps.event.addListener(MapWrapper.map, 'click', function(e) {
        self._clearMapSelection();
        MapWrapper.notifyListener(overlay.type, overlay.featureIdx);
      });
      google.maps.event.addListener(overlay.getPath(), 'set_at', function(index, latlng) {
        MapWrapper.mapData.polylines[overlay.featureIdx].points[index][0] = overlay.getPath().getAt(index).lat();
        MapWrapper.mapData.polylines[overlay.featureIdx].points[index][1] = overlay.getPath().getAt(index).lng();
        MapWrapper.notifyListener(overlay.type, overlay.featureIdx);
      });
      google.maps.event.addListener(overlay.getPath(), 'insert_at', function(index) {
        var newPoint = [
          overlay.getPath().getAt(index).lat(),
          overlay.getPath().getAt(index).lng()
        ];
        MapWrapper.mapData.polylines[overlay.featureIdx].points.splice(
          index,
          0,
          newPoint);
        MapWrapper.notifyListener(overlay.type, overlay.featureIdx);
      });
      google.maps.event.addListener(overlay.getPath(), 'remove_at', function(index) {
        MapWrapper.mapData.polylines[overlay.featureIdx].points.splice(index, 1);
        MapWrapper.notifyListener(overlay.type, overlay.featureIdx);
      });
    }
    this.selectedOverlay = overlay;
  },
  _clearMapSelection: function() {
    if (this.selectedOverlay) {
      this.selectedOverlay.setEditable(false);
      if (MapWrapper.mapData[this.selectedOverlay.type][this.selectedOverlay.featureIdx]) {
        delete MapWrapper.mapData[this.selectedOverlay.type][this.selectedOverlay.featureIdx].editedBy;
      }
      this.selectedOverlay = null;
    }
  },
  _updateMapData: function() {
    if (this.selectedOverlay && this.selectedOverlay.type === 'polylines') {
      var points = [];
      var gPathArray = this.selectedOverlay.getPath().getArray();
      for (var i = 0; i < gPathArray.length; i++) {
        points.push([gPathArray[i].lat(), gPathArray[i].lng()]);
      }
      MapWrapper.mapData.polylines[this.selectedOverlay.featureIdx].points = points;
      MapWrapper.notifyListener(this.selectedOverlay.type, this.selectedOverlay.featureIdx);
    }
  }
};

/**
 * Register the google maps handler to the map wrapper
 */
MapWrapper.regitsterMapHandler(GoogleMapHandler);