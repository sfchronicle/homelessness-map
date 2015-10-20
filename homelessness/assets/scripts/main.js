/*global $, L */

'use strict';

var App = App || {};

App.map = L.map('map').setView([37.7833, -122.4167], 13);

App.init = function () {
  this.render();
};

App.render = function () {
  var layer = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{
    attribution: '© OpenStreetMap contributors, © CartoDB'
  });

  this.map.addLayer(layer);
};

App.renderJson = function (geoJson) {
  function colorPicker (feature) {
    switch (feature.properties.kind) {
      case 'encampment': return 'white';
      case 'needle':     return 'yellow';
      case 'waste':      return 'brown';
    }
  }

  L.geoJson(geoJson, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 2,
        fillColor: colorPicker(feature),
        color: 'white',
        weight: 0,
        opacity: 1,
        fillOpacity: 0.8,
      });
    }
  }).addTo(App.map);
};
