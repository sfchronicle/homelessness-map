/*global document, L, d3, XMLHttpRequest, Pbf, geobuf */

'use strict';

var App = App || {};
var config = {
  center: [37.7605, -122.4727],
  zoom: 13,
  zoomControl: false,
  minZoom: 13,
  fullscreenControl: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,

};

App.map = L.map('map', config);
App.dataView = 'all'; // default

App.init = function () {
  var self = this;
  self.getArrayBuffer(PBF_DATA_URL, self.render);
  self.buildMapComponents();
};

App.getArrayBuffer = function (url, callback) {
  /* Borrowed from mapbox-gl-js
    https://github.com/mapbox/mapbox-gl-js/blob/d932579e6ef68479c799ff71affbc1520c19c3b7/js/util/browser/ajax.js#L27-L43
    ====

    Fetch an array buffer and pass to a callback
  */
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'arraybuffer';
  xhr.onerror = function(e) {
      callback(e);
  };
  xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          callback(null, xhr.response);
      } else {
          callback(new Error(xhr.statusText));
      }
  };
  xhr.send();
  return xhr;
};

App._decodeGeoBuffer = function (response) {
  /* Take an array buffer (in this case a geobuf) and decode it to geojson)
  */
  var pbf = new Pbf( new Uint8Array( response ) );
  return geobuf.decode( pbf );
};

App.buildMapComponents = function () {
  /* Add tilelayer to leaflet map
  */
  var self = this;
  var layer = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{
    attribution: '© OpenStreetMap contributors, © CartoDB'
  });

  self.map.addLayer(layer);

  new L.Control.Zoom({ position: 'topright' }).addTo(self.map);

  // add the event handler
  function handleCommand (event) {
    var pointClass = '.'+event.target.id;
    if (event.target.checked) {
      d3.selectAll(pointClass).attr('visibility', 'visible');
    } else {
      d3.selectAll(pointClass).attr('visibility', 'hidden');
    }
  }

  var nodes = document.querySelectorAll('.toggle');
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].addEventListener('click', handleCommand, false);
  }
};

App.render = function (error, response) {
  /*
  Function to render data onto map using d3 quadtrees
  */
  if (error) { throw error; }

  var geoJson = App._decodeGeoBuffer( response );

  var qtree = d3.geom.quadtree(geoJson.features.map(function (data, i) {
    return { x: data.geometry.coordinates[0], y: data.geometry.coordinates[1], all: data };
  }));

  // Find the nodes within the specified rectangle.
  function search(quadtree, x0, y0, x3, y3) {
    var pts = [];
    var subPixel = false;
    var subPts = [];
    var scale = getZoomScale();
    console.log(' scale: ' + scale);
    var counter = 0;
    quadtree.visit(function (node, x1, y1, x2, y2) {
      var p = node.point;
      var pwidth = node.width * scale;
      var pheight = node.height * scale;

      // -- if this is too small rectangle only count the branch and set opacity
      if ((pwidth * pheight) <= 1) {
        // start collecting sub Pixel points
        subPixel = true;
      }
      // -- jumped to super node large than 1 pixel
      else {
        // end collecting sub Pixel points
        if (subPixel && subPts && subPts.length > 0) {

          subPts[0].group = subPts.length;
          pts.push(subPts[0]); // add only one todo calculate intensity
          counter += subPts.length - 1;
          subPts = [];
        }
        subPixel = false;
      }

      if ((p) && (p.x >= x0) && (p.x < x3) && (p.y >= y0) && (p.y < y3)) {
        if (subPixel) {
          subPts.push(p.all);
        }
        else {
          if (p.all.group) {
            delete (p.all.group);
          }
          pts.push(p.all);
        }
      }
      // if quad rect is outside of the search rect do nto search in sub nodes (returns true)
      return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
    });
    console.log(' Number of removed  points: ' + counter);
    return pts;
  }

  function updateNodes(quadtree) {
    var nodes = [];
    quadtree.depth = 0; // root

    quadtree.visit(function (node, x1, y1, x2, y2) {
      var nodeRect = {
        left: mercatorXofLongitude(x1),
        right: mercatorXofLongitude(x2),
        bottom: mercatorYofLatitude(y1),
        top: mercatorYofLatitude(y2)
      };
      node.width = (nodeRect.right - nodeRect.left);
      node.height = (nodeRect.top - nodeRect.bottom);

      if (node.depth === 0) {
        console.log(' width: ' + node.width + 'height: ' + node.height);
      }
      nodes.push(node);
      for (var i = 0; i < 4; i++) {
        if (node.nodes[i]) { node.nodes[i].depth = node.depth + 1; }
      }
    });
    return nodes;
  }

  //-------------------------------------------------------------------------------------
  var mercatorXofLongitude = function (lon) {
    return lon * 20037508.34 / 180;
  };
  var mercatorYofLatitude = function (lat) {
    return (Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)) * 20037508.34 / 180;
  };

  var svg = d3.select(App.map.getPanes().overlayPane).append('svg');
  var g = svg.append('g').attr('class', 'leaflet-zoom-hide');

  // Use Leaflet to implement a D3 geometric transformation.
  function projectPoint(x, y) {
    var point = App.map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
  }

  function getZoomScale() {
    var mapWidth = App.map.getSize().x;
    var bounds = App.map.getBounds();
    var planarWidth = mercatorXofLongitude(bounds.getEast()) - mercatorXofLongitude(bounds.getWest());
    var zoomScale = mapWidth / planarWidth;
    return zoomScale;
  }

  function redrawSubset(subset) {
    path.pointRadius(2);// * scale);

    if (App.dataView !== 'all') {
      subset = subset.filter(function (d) {
        return new Date( d.properties.date ).getFullYear() === parseInt( App.dataView );
      });
    }

    function checkForToggle () {
      var toggles = document.querySelectorAll('.toggle');
      for (var i = 0; i < toggles.length; i++) {
        var pointClass = '.'+toggles[i].id;

        if (toggles[i].checked) {
          d3.selectAll(pointClass).attr('visibility', 'visible');
        } else {
          d3.selectAll(pointClass).attr('visibility', 'hidden');
        }
      }
    }

    var bounds = path.bounds({ type: 'FeatureCollection', features: subset });
    var topLeft = bounds[0];
    var bottomRight = bounds[1];

    svg.attr('width', bottomRight[0] - topLeft[0])
      .attr('height', bottomRight[1] - topLeft[1])
      .style('left', topLeft[0] + 'px')
      .style('top', topLeft[1] + 'px');


    g.attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');

    var start = new Date();


    var points = g.selectAll('path')
                  .data(subset, function (d) {
                      return d.id;
                  });
    points.enter().append('path');
    points.exit().remove();
    points.attr('d', path);
    points.attr('class', function(d) { return d.properties.kind; });

    points.style('fill-opacity', function (d) {
      if (d.group) {
        return (d.group * 0.1) + 0.2;
      }
    });


    console.log('updated at  ' + new Date().setTime(new Date().getTime() - start.getTime()) + ' ms ');

    checkForToggle();

  }

  function mapmove (e) {
    var mapBounds = App.map.getBounds();
    var subset = search(qtree, mapBounds.getWest(), mapBounds.getSouth(), mapBounds.getEast(), mapBounds.getNorth());
    console.log('subset: ' + subset.length);

    App.currentSubset = subset; // cache value for filtering
    redrawSubset(subset);
  }

  function handleChange (e) {
    var option   = e.target.options[e.target.selectedIndex];
    App.dataView =  option.value;

    redrawSubset( App.currentSubset );
  }

  var yearSelect = document.querySelector('select');
  yearSelect.addEventListener('change', handleChange, false);

  var transform = d3.geo.transform({ point: projectPoint });
  var path = d3.geo.path().projection(transform);

  updateNodes(qtree);

  App.map.on('moveend', mapmove);

  mapmove();

};
