(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.geobuf = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = decode;

var keys, values, lengths, dim, e, isTopo, transformed, names;

var geometryTypes = ['Point', 'MultiPoint', 'LineString', 'MultiLineString',
                      'Polygon', 'MultiPolygon', 'GeometryCollection'];

function decode(pbf) {
    dim = 2;
    e = Math.pow(10, 6);
    isTopo = false;
    transformed = false;
    lengths = null;

    keys = [];
    values = [];
    var obj = pbf.readFields(readDataField, {});
    keys = null;

    return obj;
}

function readDataField(tag, obj, pbf) {
    if (tag === 1) keys.push(pbf.readString());
    else if (tag === 2) dim = pbf.readVarint();
    else if (tag === 3) e = Math.pow(10, pbf.readVarint());

    else if (tag === 4) readFeatureCollection(pbf, obj);
    else if (tag === 5) readFeature(pbf, obj);
    else if (tag === 6) readGeometry(pbf, obj);
    else if (tag === 7) readTopology(pbf, obj);
}

function readFeatureCollection(pbf, obj) {
    obj.type = 'FeatureCollection';
    obj.features = [];
    return pbf.readMessage(readFeatureCollectionField, obj);
}

function readFeature(pbf, feature) {
    feature.type = 'Feature';
    return pbf.readMessage(readFeatureField, feature);
}

function readGeometry(pbf, geom) {
    return pbf.readMessage(readGeometryField, geom);
}

function readTopology(pbf, topology) {
    isTopo = true;
    topology.type = 'Topology';
    topology.objects = {};
    names = [];
    pbf.readMessage(readTopologyField, topology);
    names = null;
    return topology;
}

function readTopologyField(tag, topology, pbf) {
    if (tag === 1) {
        topology.transform = pbf.readMessage(readTransformField, {scale: [], translate: []});
        transformed = true;
    }
    else if (tag === 2) names.push(pbf.readString());
    else if (tag === 3) topology.objects[names.shift()] = pbf.readMessage(readGeometryField, {});

    else if (tag === 4) lengths = pbf.readPackedVarint();
    else if (tag === 5) topology.arcs = readArcs(pbf);

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 15) readProps(pbf, topology);
}

function readFeatureCollectionField(tag, obj, pbf) {
    if (tag === 1) obj.features.push(readFeature(pbf, {}));

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 15) readProps(pbf, obj);
}

function readFeatureField(tag, feature, pbf) {
    if (tag === 1) feature.geometry = readGeometry(pbf, {});

    else if (tag === 11) feature.id = pbf.readString();
    else if (tag === 12) feature.id = pbf.readSVarint();

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 14) feature.properties = readProps(pbf, {});
    else if (tag === 15) readProps(pbf, feature);
}

function readGeometryField(tag, geom, pbf) {
    if (tag === 1) geom.type = geometryTypes[pbf.readVarint()];

    else if (tag === 2) lengths = pbf.readPackedVarint();
    else if (tag === 3) readCoords(geom, pbf, geom.type);
    else if (tag === 4) {
        geom.geometries = geom.geometries || [];
        geom.geometries.push(readGeometry(pbf, {}));
    }

    else if (tag === 11) geom.id = pbf.readString();
    else if (tag === 12) geom.id = pbf.readSVarint();

    else if (tag === 13) values.push(readValue(pbf));
    else if (tag === 14) geom.properties = readProps(pbf, {});
    else if (tag === 15) readProps(pbf, geom);
}

function readCoords(geom, pbf, type) {
    var coordsOrArcs = isTopo ? 'arcs' : 'coordinates';
    if (type === 'Point') geom.coordinates = readPoint(pbf);
    else if (type === 'MultiPoint') geom.coordinates = readLine(pbf, true);
    else if (type === 'LineString') geom[coordsOrArcs] = readLine(pbf);
    else if (type === 'MultiLineString' || type === 'Polygon') geom[coordsOrArcs] = readMultiLine(pbf);
    else if (type === 'MultiPolygon') geom[coordsOrArcs] = readMultiPolygon(pbf);
}

function readValue(pbf) {
    var end = pbf.readVarint() + pbf.pos,
        value = null;

    while (pbf.pos < end) {
        var val = pbf.readVarint(),
            tag = val >> 3;

        if (tag === 1) value = pbf.readString();
        else if (tag === 2) value = pbf.readDouble();
        else if (tag === 3) value = pbf.readVarint();
        else if (tag === 4) value = -pbf.readVarint();
        else if (tag === 5) value = pbf.readBoolean();
        else if (tag === 6) value = JSON.parse(pbf.readString());
    }
    return value;
}

function readProps(pbf, props) {
    var end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) props[keys[pbf.readVarint()]] = values[pbf.readVarint()];
    values = [];
    return props;
}

function readTransformField(tag, tr, pbf) {
    if (tag === 1) tr.scale[0] = pbf.readDouble();
    else if (tag === 2) tr.scale[1] = pbf.readDouble();
    else if (tag === 3) tr.translate[0] = pbf.readDouble();
    else if (tag === 4) tr.translate[1] = pbf.readDouble();
}

function readPoint(pbf) {
    var end = pbf.readVarint() + pbf.pos,
        coords = [];
    while (pbf.pos < end) coords.push(transformCoord(pbf.readSVarint()));
    return coords;
}

function readLinePart(pbf, end, len, isMultiPoint) {
    var i = 0,
        coords = [],
        p, d;

    if (isTopo && !isMultiPoint) {
        p = 0;
        while (len ? i < len : pbf.pos < end) {
            p += pbf.readSVarint();
            coords.push(p);
            i++;
        }

    } else {
        var prevP = [];
        for (d = 0; d < dim; d++) prevP[d] = 0;

        while (len ? i < len : pbf.pos < end) {
            p = [];
            for (d = 0; d < dim; d++) {
                prevP[d] += pbf.readSVarint();
                p[d] = transformCoord(prevP[d]);
            }
            coords.push(p);
            i++;
        }
    }

    return coords;
}

function readLine(pbf, isMultiPoint) {
    return readLinePart(pbf, pbf.readVarint() + pbf.pos, null, isMultiPoint);
}

function readMultiLine(pbf) {
    var end = pbf.readVarint() + pbf.pos;
    if (!lengths) return [readLinePart(pbf, end)];

    var coords = [];
    for (var i = 0; i < lengths.length; i++) coords.push(readLinePart(pbf, end, lengths[i]));
    lengths = null;
    return coords;
}

function readMultiPolygon(pbf) {
    var end = pbf.readVarint() + pbf.pos;
    if (!lengths) return [[readLinePart(pbf, end)]];

    var coords = [];
    var j = 1;
    for (var i = 0; i < lengths[0]; i++) {
        var rings = [];
        for (var k = 0; k < lengths[j]; k++) rings.push(readLinePart(pbf, end, lengths[j + 1 + k]));
        j += lengths[j] + 1;
        coords.push(rings);
    }
    lengths = null;
    return coords;
}

function readArcs(pbf) {
    var lines = [],
        end = pbf.readVarint() + pbf.pos;

    for (var i = 0; i < lengths.length; i++) {
        var ring = [];
        for (var j = 0; j < lengths[i]; j++) {
            var p = [];
            for (var d = 0; d < dim && pbf.pos < end; d++) p[d] = transformCoord(pbf.readSVarint());
            ring.push(p);
        }
        lines.push(ring);
    }

    return lines;
}

function transformCoord(x) {
    return transformed ? x : x / e;
}

},{}],2:[function(require,module,exports){
'use strict';

module.exports = encode;

var keys, keysNum, dim, e, isTopo, transformed,
    maxPrecision = 1e6;

var geometryTypes = {
    'Point': 0,
    'MultiPoint': 1,
    'LineString': 2,
    'MultiLineString': 3,
    'Polygon': 4,
    'MultiPolygon': 5,
    'GeometryCollection': 6
};

function encode(obj, pbf) {
    keys = {};
    keysNum = 0;
    dim = 0;
    e = 1;
    transformed = false;
    isTopo = false;

    analyze(obj);

    e = Math.min(e, maxPrecision);
    var precision = Math.ceil(Math.log(e) / Math.LN10);

    var keysArr = Object.keys(keys);

    for (var i = 0; i < keysArr.length; i++) pbf.writeStringField(1, keysArr[i]);
    if (dim !== 2) pbf.writeVarintField(2, dim);
    if (precision !== 6) pbf.writeVarintField(3, precision);

    if (obj.type === 'FeatureCollection') pbf.writeMessage(4, writeFeatureCollection, obj);
    else if (obj.type === 'Feature') pbf.writeMessage(5, writeFeature, obj);
    else if (obj.type === 'Topology') pbf.writeMessage(7, writeTopology, obj);
    else pbf.writeMessage(6, writeGeometry, obj);

    keys = null;

    return pbf.finish();
}

function analyze(obj) {
    var i, key;

    if (obj.type === 'FeatureCollection') {
        for (i = 0; i < obj.features.length; i++) analyze(obj.features[i]);
        for (key in obj) if (key !== 'type' && key !== 'features') saveKey(key);

    } else if (obj.type === 'Feature') {
        analyze(obj.geometry);
        for (key in obj.properties) saveKey(key);
        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'properties' && key !== 'geometry') saveKey(key);
        }

    } else if (obj.type === 'Topology') {
        isTopo = true;

        for (key in obj) {
            if (key !== 'type' && key !== 'transform' && key !== 'arcs' && key !== 'objects') saveKey(key);
        }
        analyzeMultiLine(obj.arcs);

        for (key in obj.objects) {
            analyze(obj.objects[key]);
        }

    } else {
        if (obj.type === 'Point') analyzePoint(obj.coordinates);
        else if (obj.type === 'MultiPoint') analyzePoints(obj.coordinates);
        else if (obj.type === 'GeometryCollection') {
            for (i = 0; i < obj.geometries.length; i++) analyze(obj.geometries[i]);
        }
        else if (!isTopo) {
            if (obj.type === 'LineString') analyzePoints(obj.coordinates);
            else if (obj.type === 'Polygon' || obj.type === 'MultiLineString') analyzeMultiLine(obj.coordinates);
            else if (obj.type === 'MultiPolygon') {
                for (i = 0; i < obj.coordinates.length; i++) analyzeMultiLine(obj.coordinates[i]);
            }
        }

        for (key in obj.properties) saveKey(key);
        for (key in obj) {
            if (key !== 'type' && key !== 'id' && key !== 'coordinates' && key !== 'arcs' &&
                key !== 'geometries' && key !== 'properties') saveKey(key);
        }
    }
}

function analyzeMultiLine(coords) {
    for (var i = 0; i < coords.length; i++) analyzePoints(coords[i]);
}

function analyzePoints(coords) {
    for (var i = 0; i < coords.length; i++) analyzePoint(coords[i]);
}

function analyzePoint(point) {
    dim = Math.max(dim, point.length);

    // find max precision
    for (var i = 0; i < point.length; i++) {
        while (Math.round(point[i] * e) / e !== point[i] && e < maxPrecision) e *= 10;
    }
}

function saveKey(key) {
    if (keys[key] === undefined) keys[key] = keysNum++;
}

function writeFeatureCollection(obj, pbf) {
    for (var i = 0; i < obj.features.length; i++) {
        pbf.writeMessage(1, writeFeature, obj.features[i]);
    }
    writeProps(obj, pbf, true);
}

function writeFeature(feature, pbf) {
    pbf.writeMessage(1, writeGeometry, feature.geometry);

    if (feature.id !== undefined) {
        if (typeof feature.id === 'number' && feature.id % 1 === 0) pbf.writeSVarintField(12, feature.id);
        else pbf.writeStringField(11, feature.id);
    }

    if (feature.properties) writeProps(feature.properties, pbf);
    writeProps(feature, pbf, true);
}

function writeGeometry(geom, pbf) {
    pbf.writeVarintField(1, geometryTypes[geom.type]);

    var coords = geom.coordinates,
        coordsOrArcs = isTopo ? geom.arcs : coords;

    if (geom.type === 'Point') writePoint(coords, pbf);
    else if (geom.type === 'MultiPoint') writeLine(coords, pbf, true);
    else if (geom.type === 'LineString') writeLine(coordsOrArcs, pbf);
    if (geom.type === 'MultiLineString' || geom.type === 'Polygon') writeMultiLine(coordsOrArcs, pbf);
    else if (geom.type === 'MultiPolygon') writeMultiPolygon(coordsOrArcs, pbf);
    else if (geom.type === 'GeometryCollection') {
        for (var i = 0; i < geom.geometries.length; i++) pbf.writeMessage(4, writeGeometry, geom.geometries[i]);
    }

    if (isTopo && geom.id !== undefined) {
        if (typeof geom.id === 'number' && geom.id % 1 === 0) pbf.writeSVarintField(12, geom.id);
        else pbf.writeStringField(11, geom.id);
    }

    if (isTopo && geom.properties) writeProps(geom.properties, pbf);
    writeProps(geom, pbf, true);
}

function writeTopology(topology, pbf) {
    if (topology.transform) {
        pbf.writeMessage(1, writeTransform, topology.transform);
        transformed = true;
    }

    var names = Object.keys(topology.objects),
        i, j, d;

    for (i = 0; i < names.length; i++) pbf.writeStringField(2, names[i]);
    for (i = 0; i < names.length; i++) {
        pbf.writeMessage(3, writeGeometry, topology.objects[names[i]]);
    }

    var lengths = [],
        coords = [];

    for (i = 0; i < topology.arcs.length; i++) {
        var arc = topology.arcs[i];
        lengths.push(arc.length);

        for (j = 0; j < arc.length; j++) {
            for (d = 0; d < dim; d++) coords.push(transformCoord(arc[j][d]));
        }
    }

    pbf.writePackedVarint(4, lengths);
    pbf.writePackedSVarint(5, coords);

    writeProps(topology, pbf, true);
}

function writeProps(props, pbf, isCustom) {
    var indexes = [],
        valueIndex = 0;

    for (var key in props) {
        if (isCustom) {
            if (key === 'type') continue;
            else if (props.type === 'FeatureCollection') {
                if (key === 'features') continue;
            } else if (props.type === 'Feature') {
                if (key === 'id' || key === 'properties' || key === 'geometry') continue;
            } else if (props.type === 'Topology')  {
                if (key === 'transform' || key === 'arcs' || key === 'objects') continue;
            } else if (key === 'id' || key === 'coordinates' || key === 'arcs' ||
                       key === 'geometries' || key === 'properties') continue;
        }
        pbf.writeMessage(13, writeValue, props[key]);
        indexes.push(keys[key], valueIndex++);
    }
    pbf.writePackedVarint(isCustom ? 15 : 14, indexes);
}

function writeValue(value, pbf) {
    var type = typeof value;

    if (type === 'string') pbf.writeStringField(1, value);
    else if (type === 'boolean') pbf.writeBooleanField(5, value);
    else if (type === 'object') pbf.writeStringField(6, JSON.stringify(value));
    else if (type === 'number') {
       if (value % 1 !== 0) pbf.writeDoubleField(2, value);
       else if (value >= 0) pbf.writeVarintField(3, value);
       else pbf.writeVarintField(4, -value);
    }
}

function writePoint(point, pbf) {
    var coords = [];
    for (var i = 0; i < dim; i++) coords.push(transformCoord(point[i]));
    pbf.writePackedSVarint(3, coords);
}

function writeLine(line, pbf, isMultiPoint) {
    var coords = [];
    populateLine(coords, line, isMultiPoint);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiLine(lines, pbf) {
    var len = lines.length,
        i;
    if (len !== 1) {
        var lengths = [];
        for (i = 0; i < len; i++) lengths.push(lines[i].length);
        pbf.writePackedVarint(2, lengths);
        // TODO faster with custom writeMessage?
    }
    var coords = [];
    for (i = 0; i < len; i++) populateLine(coords, lines[i]);
    pbf.writePackedSVarint(3, coords);
}

function writeMultiPolygon(polygons, pbf) {
    var len = polygons.length,
        i, j;
    if (len !== 1 || polygons[0].length !== 1 || polygons[0][0].length !== 1) {
        var lengths = [len];
        for (i = 0; i < len; i++) {
            lengths.push(polygons[i].length);
            for (j = 0; j < polygons[i].length; j++) lengths.push(polygons[i][j].length);
        }
        pbf.writePackedVarint(2, lengths);
    }

    var coords = [];
    for (i = 0; i < len; i++) {
        for (j = 0; j < polygons[i].length; j++) populateLine(coords, polygons[i][j]);
    }
    pbf.writePackedSVarint(3, coords);
}

function populateLine(coords, line, isMultiPoint) {
    var i, j;
    for (i = 0; i < line.length; i++) {
        if (isTopo && !isMultiPoint) coords.push(i ? line[i] - line[i - 1] : line[i]);
        else for (j = 0; j < dim; j++) coords.push(transformCoord(line[i][j] - (i ? line[i - 1][j] : 0)));
    }
}

function transformCoord(x) {
    return transformed ? x : Math.round(x * e);
}

function writeTransform(tr, pbf) {
    pbf.writeDoubleField(1, tr.scale[0]);
    pbf.writeDoubleField(2, tr.scale[1]);
    pbf.writeDoubleField(3, tr.translate[0]);
    pbf.writeDoubleField(4, tr.translate[1]);
}

},{}],3:[function(require,module,exports){
'use strict';

exports.encode = require('./encode');
exports.decode = require('./decode');

},{"./decode":1,"./encode":2}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImRlY29kZS5qcyIsImVuY29kZS5qcyIsImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBkZWNvZGU7XG5cbnZhciBrZXlzLCB2YWx1ZXMsIGxlbmd0aHMsIGRpbSwgZSwgaXNUb3BvLCB0cmFuc2Zvcm1lZCwgbmFtZXM7XG5cbnZhciBnZW9tZXRyeVR5cGVzID0gWydQb2ludCcsICdNdWx0aVBvaW50JywgJ0xpbmVTdHJpbmcnLCAnTXVsdGlMaW5lU3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAnUG9seWdvbicsICdNdWx0aVBvbHlnb24nLCAnR2VvbWV0cnlDb2xsZWN0aW9uJ107XG5cbmZ1bmN0aW9uIGRlY29kZShwYmYpIHtcbiAgICBkaW0gPSAyO1xuICAgIGUgPSBNYXRoLnBvdygxMCwgNik7XG4gICAgaXNUb3BvID0gZmFsc2U7XG4gICAgdHJhbnNmb3JtZWQgPSBmYWxzZTtcbiAgICBsZW5ndGhzID0gbnVsbDtcblxuICAgIGtleXMgPSBbXTtcbiAgICB2YWx1ZXMgPSBbXTtcbiAgICB2YXIgb2JqID0gcGJmLnJlYWRGaWVsZHMocmVhZERhdGFGaWVsZCwge30pO1xuICAgIGtleXMgPSBudWxsO1xuXG4gICAgcmV0dXJuIG9iajtcbn1cblxuZnVuY3Rpb24gcmVhZERhdGFGaWVsZCh0YWcsIG9iaiwgcGJmKSB7XG4gICAgaWYgKHRhZyA9PT0gMSkga2V5cy5wdXNoKHBiZi5yZWFkU3RyaW5nKCkpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gMikgZGltID0gcGJmLnJlYWRWYXJpbnQoKTtcbiAgICBlbHNlIGlmICh0YWcgPT09IDMpIGUgPSBNYXRoLnBvdygxMCwgcGJmLnJlYWRWYXJpbnQoKSk7XG5cbiAgICBlbHNlIGlmICh0YWcgPT09IDQpIHJlYWRGZWF0dXJlQ29sbGVjdGlvbihwYmYsIG9iaik7XG4gICAgZWxzZSBpZiAodGFnID09PSA1KSByZWFkRmVhdHVyZShwYmYsIG9iaik7XG4gICAgZWxzZSBpZiAodGFnID09PSA2KSByZWFkR2VvbWV0cnkocGJmLCBvYmopO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gNykgcmVhZFRvcG9sb2d5KHBiZiwgb2JqKTtcbn1cblxuZnVuY3Rpb24gcmVhZEZlYXR1cmVDb2xsZWN0aW9uKHBiZiwgb2JqKSB7XG4gICAgb2JqLnR5cGUgPSAnRmVhdHVyZUNvbGxlY3Rpb24nO1xuICAgIG9iai5mZWF0dXJlcyA9IFtdO1xuICAgIHJldHVybiBwYmYucmVhZE1lc3NhZ2UocmVhZEZlYXR1cmVDb2xsZWN0aW9uRmllbGQsIG9iaik7XG59XG5cbmZ1bmN0aW9uIHJlYWRGZWF0dXJlKHBiZiwgZmVhdHVyZSkge1xuICAgIGZlYXR1cmUudHlwZSA9ICdGZWF0dXJlJztcbiAgICByZXR1cm4gcGJmLnJlYWRNZXNzYWdlKHJlYWRGZWF0dXJlRmllbGQsIGZlYXR1cmUpO1xufVxuXG5mdW5jdGlvbiByZWFkR2VvbWV0cnkocGJmLCBnZW9tKSB7XG4gICAgcmV0dXJuIHBiZi5yZWFkTWVzc2FnZShyZWFkR2VvbWV0cnlGaWVsZCwgZ2VvbSk7XG59XG5cbmZ1bmN0aW9uIHJlYWRUb3BvbG9neShwYmYsIHRvcG9sb2d5KSB7XG4gICAgaXNUb3BvID0gdHJ1ZTtcbiAgICB0b3BvbG9neS50eXBlID0gJ1RvcG9sb2d5JztcbiAgICB0b3BvbG9neS5vYmplY3RzID0ge307XG4gICAgbmFtZXMgPSBbXTtcbiAgICBwYmYucmVhZE1lc3NhZ2UocmVhZFRvcG9sb2d5RmllbGQsIHRvcG9sb2d5KTtcbiAgICBuYW1lcyA9IG51bGw7XG4gICAgcmV0dXJuIHRvcG9sb2d5O1xufVxuXG5mdW5jdGlvbiByZWFkVG9wb2xvZ3lGaWVsZCh0YWcsIHRvcG9sb2d5LCBwYmYpIHtcbiAgICBpZiAodGFnID09PSAxKSB7XG4gICAgICAgIHRvcG9sb2d5LnRyYW5zZm9ybSA9IHBiZi5yZWFkTWVzc2FnZShyZWFkVHJhbnNmb3JtRmllbGQsIHtzY2FsZTogW10sIHRyYW5zbGF0ZTogW119KTtcbiAgICAgICAgdHJhbnNmb3JtZWQgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlIGlmICh0YWcgPT09IDIpIG5hbWVzLnB1c2gocGJmLnJlYWRTdHJpbmcoKSk7XG4gICAgZWxzZSBpZiAodGFnID09PSAzKSB0b3BvbG9neS5vYmplY3RzW25hbWVzLnNoaWZ0KCldID0gcGJmLnJlYWRNZXNzYWdlKHJlYWRHZW9tZXRyeUZpZWxkLCB7fSk7XG5cbiAgICBlbHNlIGlmICh0YWcgPT09IDQpIGxlbmd0aHMgPSBwYmYucmVhZFBhY2tlZFZhcmludCgpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gNSkgdG9wb2xvZ3kuYXJjcyA9IHJlYWRBcmNzKHBiZik7XG5cbiAgICBlbHNlIGlmICh0YWcgPT09IDEzKSB2YWx1ZXMucHVzaChyZWFkVmFsdWUocGJmKSk7XG4gICAgZWxzZSBpZiAodGFnID09PSAxNSkgcmVhZFByb3BzKHBiZiwgdG9wb2xvZ3kpO1xufVxuXG5mdW5jdGlvbiByZWFkRmVhdHVyZUNvbGxlY3Rpb25GaWVsZCh0YWcsIG9iaiwgcGJmKSB7XG4gICAgaWYgKHRhZyA9PT0gMSkgb2JqLmZlYXR1cmVzLnB1c2gocmVhZEZlYXR1cmUocGJmLCB7fSkpO1xuXG4gICAgZWxzZSBpZiAodGFnID09PSAxMykgdmFsdWVzLnB1c2gocmVhZFZhbHVlKHBiZikpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gMTUpIHJlYWRQcm9wcyhwYmYsIG9iaik7XG59XG5cbmZ1bmN0aW9uIHJlYWRGZWF0dXJlRmllbGQodGFnLCBmZWF0dXJlLCBwYmYpIHtcbiAgICBpZiAodGFnID09PSAxKSBmZWF0dXJlLmdlb21ldHJ5ID0gcmVhZEdlb21ldHJ5KHBiZiwge30pO1xuXG4gICAgZWxzZSBpZiAodGFnID09PSAxMSkgZmVhdHVyZS5pZCA9IHBiZi5yZWFkU3RyaW5nKCk7XG4gICAgZWxzZSBpZiAodGFnID09PSAxMikgZmVhdHVyZS5pZCA9IHBiZi5yZWFkU1ZhcmludCgpO1xuXG4gICAgZWxzZSBpZiAodGFnID09PSAxMykgdmFsdWVzLnB1c2gocmVhZFZhbHVlKHBiZikpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gMTQpIGZlYXR1cmUucHJvcGVydGllcyA9IHJlYWRQcm9wcyhwYmYsIHt9KTtcbiAgICBlbHNlIGlmICh0YWcgPT09IDE1KSByZWFkUHJvcHMocGJmLCBmZWF0dXJlKTtcbn1cblxuZnVuY3Rpb24gcmVhZEdlb21ldHJ5RmllbGQodGFnLCBnZW9tLCBwYmYpIHtcbiAgICBpZiAodGFnID09PSAxKSBnZW9tLnR5cGUgPSBnZW9tZXRyeVR5cGVzW3BiZi5yZWFkVmFyaW50KCldO1xuXG4gICAgZWxzZSBpZiAodGFnID09PSAyKSBsZW5ndGhzID0gcGJmLnJlYWRQYWNrZWRWYXJpbnQoKTtcbiAgICBlbHNlIGlmICh0YWcgPT09IDMpIHJlYWRDb29yZHMoZ2VvbSwgcGJmLCBnZW9tLnR5cGUpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gNCkge1xuICAgICAgICBnZW9tLmdlb21ldHJpZXMgPSBnZW9tLmdlb21ldHJpZXMgfHwgW107XG4gICAgICAgIGdlb20uZ2VvbWV0cmllcy5wdXNoKHJlYWRHZW9tZXRyeShwYmYsIHt9KSk7XG4gICAgfVxuXG4gICAgZWxzZSBpZiAodGFnID09PSAxMSkgZ2VvbS5pZCA9IHBiZi5yZWFkU3RyaW5nKCk7XG4gICAgZWxzZSBpZiAodGFnID09PSAxMikgZ2VvbS5pZCA9IHBiZi5yZWFkU1ZhcmludCgpO1xuXG4gICAgZWxzZSBpZiAodGFnID09PSAxMykgdmFsdWVzLnB1c2gocmVhZFZhbHVlKHBiZikpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gMTQpIGdlb20ucHJvcGVydGllcyA9IHJlYWRQcm9wcyhwYmYsIHt9KTtcbiAgICBlbHNlIGlmICh0YWcgPT09IDE1KSByZWFkUHJvcHMocGJmLCBnZW9tKTtcbn1cblxuZnVuY3Rpb24gcmVhZENvb3JkcyhnZW9tLCBwYmYsIHR5cGUpIHtcbiAgICB2YXIgY29vcmRzT3JBcmNzID0gaXNUb3BvID8gJ2FyY3MnIDogJ2Nvb3JkaW5hdGVzJztcbiAgICBpZiAodHlwZSA9PT0gJ1BvaW50JykgZ2VvbS5jb29yZGluYXRlcyA9IHJlYWRQb2ludChwYmYpO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aVBvaW50JykgZ2VvbS5jb29yZGluYXRlcyA9IHJlYWRMaW5lKHBiZiwgdHJ1ZSk7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSBnZW9tW2Nvb3Jkc09yQXJjc10gPSByZWFkTGluZShwYmYpO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnIHx8IHR5cGUgPT09ICdQb2x5Z29uJykgZ2VvbVtjb29yZHNPckFyY3NdID0gcmVhZE11bHRpTGluZShwYmYpO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSBnZW9tW2Nvb3Jkc09yQXJjc10gPSByZWFkTXVsdGlQb2x5Z29uKHBiZik7XG59XG5cbmZ1bmN0aW9uIHJlYWRWYWx1ZShwYmYpIHtcbiAgICB2YXIgZW5kID0gcGJmLnJlYWRWYXJpbnQoKSArIHBiZi5wb3MsXG4gICAgICAgIHZhbHVlID0gbnVsbDtcblxuICAgIHdoaWxlIChwYmYucG9zIDwgZW5kKSB7XG4gICAgICAgIHZhciB2YWwgPSBwYmYucmVhZFZhcmludCgpLFxuICAgICAgICAgICAgdGFnID0gdmFsID4+IDM7XG5cbiAgICAgICAgaWYgKHRhZyA9PT0gMSkgdmFsdWUgPSBwYmYucmVhZFN0cmluZygpO1xuICAgICAgICBlbHNlIGlmICh0YWcgPT09IDIpIHZhbHVlID0gcGJmLnJlYWREb3VibGUoKTtcbiAgICAgICAgZWxzZSBpZiAodGFnID09PSAzKSB2YWx1ZSA9IHBiZi5yZWFkVmFyaW50KCk7XG4gICAgICAgIGVsc2UgaWYgKHRhZyA9PT0gNCkgdmFsdWUgPSAtcGJmLnJlYWRWYXJpbnQoKTtcbiAgICAgICAgZWxzZSBpZiAodGFnID09PSA1KSB2YWx1ZSA9IHBiZi5yZWFkQm9vbGVhbigpO1xuICAgICAgICBlbHNlIGlmICh0YWcgPT09IDYpIHZhbHVlID0gSlNPTi5wYXJzZShwYmYucmVhZFN0cmluZygpKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiByZWFkUHJvcHMocGJmLCBwcm9wcykge1xuICAgIHZhciBlbmQgPSBwYmYucmVhZFZhcmludCgpICsgcGJmLnBvcztcbiAgICB3aGlsZSAocGJmLnBvcyA8IGVuZCkgcHJvcHNba2V5c1twYmYucmVhZFZhcmludCgpXV0gPSB2YWx1ZXNbcGJmLnJlYWRWYXJpbnQoKV07XG4gICAgdmFsdWVzID0gW107XG4gICAgcmV0dXJuIHByb3BzO1xufVxuXG5mdW5jdGlvbiByZWFkVHJhbnNmb3JtRmllbGQodGFnLCB0ciwgcGJmKSB7XG4gICAgaWYgKHRhZyA9PT0gMSkgdHIuc2NhbGVbMF0gPSBwYmYucmVhZERvdWJsZSgpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gMikgdHIuc2NhbGVbMV0gPSBwYmYucmVhZERvdWJsZSgpO1xuICAgIGVsc2UgaWYgKHRhZyA9PT0gMykgdHIudHJhbnNsYXRlWzBdID0gcGJmLnJlYWREb3VibGUoKTtcbiAgICBlbHNlIGlmICh0YWcgPT09IDQpIHRyLnRyYW5zbGF0ZVsxXSA9IHBiZi5yZWFkRG91YmxlKCk7XG59XG5cbmZ1bmN0aW9uIHJlYWRQb2ludChwYmYpIHtcbiAgICB2YXIgZW5kID0gcGJmLnJlYWRWYXJpbnQoKSArIHBiZi5wb3MsXG4gICAgICAgIGNvb3JkcyA9IFtdO1xuICAgIHdoaWxlIChwYmYucG9zIDwgZW5kKSBjb29yZHMucHVzaCh0cmFuc2Zvcm1Db29yZChwYmYucmVhZFNWYXJpbnQoKSkpO1xuICAgIHJldHVybiBjb29yZHM7XG59XG5cbmZ1bmN0aW9uIHJlYWRMaW5lUGFydChwYmYsIGVuZCwgbGVuLCBpc011bHRpUG9pbnQpIHtcbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGNvb3JkcyA9IFtdLFxuICAgICAgICBwLCBkO1xuXG4gICAgaWYgKGlzVG9wbyAmJiAhaXNNdWx0aVBvaW50KSB7XG4gICAgICAgIHAgPSAwO1xuICAgICAgICB3aGlsZSAobGVuID8gaSA8IGxlbiA6IHBiZi5wb3MgPCBlbmQpIHtcbiAgICAgICAgICAgIHAgKz0gcGJmLnJlYWRTVmFyaW50KCk7XG4gICAgICAgICAgICBjb29yZHMucHVzaChwKTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHByZXZQID0gW107XG4gICAgICAgIGZvciAoZCA9IDA7IGQgPCBkaW07IGQrKykgcHJldlBbZF0gPSAwO1xuXG4gICAgICAgIHdoaWxlIChsZW4gPyBpIDwgbGVuIDogcGJmLnBvcyA8IGVuZCkge1xuICAgICAgICAgICAgcCA9IFtdO1xuICAgICAgICAgICAgZm9yIChkID0gMDsgZCA8IGRpbTsgZCsrKSB7XG4gICAgICAgICAgICAgICAgcHJldlBbZF0gKz0gcGJmLnJlYWRTVmFyaW50KCk7XG4gICAgICAgICAgICAgICAgcFtkXSA9IHRyYW5zZm9ybUNvb3JkKHByZXZQW2RdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvb3Jkcy5wdXNoKHApO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvb3Jkcztcbn1cblxuZnVuY3Rpb24gcmVhZExpbmUocGJmLCBpc011bHRpUG9pbnQpIHtcbiAgICByZXR1cm4gcmVhZExpbmVQYXJ0KHBiZiwgcGJmLnJlYWRWYXJpbnQoKSArIHBiZi5wb3MsIG51bGwsIGlzTXVsdGlQb2ludCk7XG59XG5cbmZ1bmN0aW9uIHJlYWRNdWx0aUxpbmUocGJmKSB7XG4gICAgdmFyIGVuZCA9IHBiZi5yZWFkVmFyaW50KCkgKyBwYmYucG9zO1xuICAgIGlmICghbGVuZ3RocykgcmV0dXJuIFtyZWFkTGluZVBhcnQocGJmLCBlbmQpXTtcblxuICAgIHZhciBjb29yZHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aHMubGVuZ3RoOyBpKyspIGNvb3Jkcy5wdXNoKHJlYWRMaW5lUGFydChwYmYsIGVuZCwgbGVuZ3Roc1tpXSkpO1xuICAgIGxlbmd0aHMgPSBudWxsO1xuICAgIHJldHVybiBjb29yZHM7XG59XG5cbmZ1bmN0aW9uIHJlYWRNdWx0aVBvbHlnb24ocGJmKSB7XG4gICAgdmFyIGVuZCA9IHBiZi5yZWFkVmFyaW50KCkgKyBwYmYucG9zO1xuICAgIGlmICghbGVuZ3RocykgcmV0dXJuIFtbcmVhZExpbmVQYXJ0KHBiZiwgZW5kKV1dO1xuXG4gICAgdmFyIGNvb3JkcyA9IFtdO1xuICAgIHZhciBqID0gMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aHNbMF07IGkrKykge1xuICAgICAgICB2YXIgcmluZ3MgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBsZW5ndGhzW2pdOyBrKyspIHJpbmdzLnB1c2gocmVhZExpbmVQYXJ0KHBiZiwgZW5kLCBsZW5ndGhzW2ogKyAxICsga10pKTtcbiAgICAgICAgaiArPSBsZW5ndGhzW2pdICsgMTtcbiAgICAgICAgY29vcmRzLnB1c2gocmluZ3MpO1xuICAgIH1cbiAgICBsZW5ndGhzID0gbnVsbDtcbiAgICByZXR1cm4gY29vcmRzO1xufVxuXG5mdW5jdGlvbiByZWFkQXJjcyhwYmYpIHtcbiAgICB2YXIgbGluZXMgPSBbXSxcbiAgICAgICAgZW5kID0gcGJmLnJlYWRWYXJpbnQoKSArIHBiZi5wb3M7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHJpbmcgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBsZW5ndGhzW2ldOyBqKyspIHtcbiAgICAgICAgICAgIHZhciBwID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBkID0gMDsgZCA8IGRpbSAmJiBwYmYucG9zIDwgZW5kOyBkKyspIHBbZF0gPSB0cmFuc2Zvcm1Db29yZChwYmYucmVhZFNWYXJpbnQoKSk7XG4gICAgICAgICAgICByaW5nLnB1c2gocCk7XG4gICAgICAgIH1cbiAgICAgICAgbGluZXMucHVzaChyaW5nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGluZXM7XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUNvb3JkKHgpIHtcbiAgICByZXR1cm4gdHJhbnNmb3JtZWQgPyB4IDogeCAvIGU7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZW5jb2RlO1xuXG52YXIga2V5cywga2V5c051bSwgZGltLCBlLCBpc1RvcG8sIHRyYW5zZm9ybWVkLFxuICAgIG1heFByZWNpc2lvbiA9IDFlNjtcblxudmFyIGdlb21ldHJ5VHlwZXMgPSB7XG4gICAgJ1BvaW50JzogMCxcbiAgICAnTXVsdGlQb2ludCc6IDEsXG4gICAgJ0xpbmVTdHJpbmcnOiAyLFxuICAgICdNdWx0aUxpbmVTdHJpbmcnOiAzLFxuICAgICdQb2x5Z29uJzogNCxcbiAgICAnTXVsdGlQb2x5Z29uJzogNSxcbiAgICAnR2VvbWV0cnlDb2xsZWN0aW9uJzogNlxufTtcblxuZnVuY3Rpb24gZW5jb2RlKG9iaiwgcGJmKSB7XG4gICAga2V5cyA9IHt9O1xuICAgIGtleXNOdW0gPSAwO1xuICAgIGRpbSA9IDA7XG4gICAgZSA9IDE7XG4gICAgdHJhbnNmb3JtZWQgPSBmYWxzZTtcbiAgICBpc1RvcG8gPSBmYWxzZTtcblxuICAgIGFuYWx5emUob2JqKTtcblxuICAgIGUgPSBNYXRoLm1pbihlLCBtYXhQcmVjaXNpb24pO1xuICAgIHZhciBwcmVjaXNpb24gPSBNYXRoLmNlaWwoTWF0aC5sb2coZSkgLyBNYXRoLkxOMTApO1xuXG4gICAgdmFyIGtleXNBcnIgPSBPYmplY3Qua2V5cyhrZXlzKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5c0Fyci5sZW5ndGg7IGkrKykgcGJmLndyaXRlU3RyaW5nRmllbGQoMSwga2V5c0FycltpXSk7XG4gICAgaWYgKGRpbSAhPT0gMikgcGJmLndyaXRlVmFyaW50RmllbGQoMiwgZGltKTtcbiAgICBpZiAocHJlY2lzaW9uICE9PSA2KSBwYmYud3JpdGVWYXJpbnRGaWVsZCgzLCBwcmVjaXNpb24pO1xuXG4gICAgaWYgKG9iai50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSBwYmYud3JpdGVNZXNzYWdlKDQsIHdyaXRlRmVhdHVyZUNvbGxlY3Rpb24sIG9iaik7XG4gICAgZWxzZSBpZiAob2JqLnR5cGUgPT09ICdGZWF0dXJlJykgcGJmLndyaXRlTWVzc2FnZSg1LCB3cml0ZUZlYXR1cmUsIG9iaik7XG4gICAgZWxzZSBpZiAob2JqLnR5cGUgPT09ICdUb3BvbG9neScpIHBiZi53cml0ZU1lc3NhZ2UoNywgd3JpdGVUb3BvbG9neSwgb2JqKTtcbiAgICBlbHNlIHBiZi53cml0ZU1lc3NhZ2UoNiwgd3JpdGVHZW9tZXRyeSwgb2JqKTtcblxuICAgIGtleXMgPSBudWxsO1xuXG4gICAgcmV0dXJuIHBiZi5maW5pc2goKTtcbn1cblxuZnVuY3Rpb24gYW5hbHl6ZShvYmopIHtcbiAgICB2YXIgaSwga2V5O1xuXG4gICAgaWYgKG9iai50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmouZmVhdHVyZXMubGVuZ3RoOyBpKyspIGFuYWx5emUob2JqLmZlYXR1cmVzW2ldKTtcbiAgICAgICAgZm9yIChrZXkgaW4gb2JqKSBpZiAoa2V5ICE9PSAndHlwZScgJiYga2V5ICE9PSAnZmVhdHVyZXMnKSBzYXZlS2V5KGtleSk7XG5cbiAgICB9IGVsc2UgaWYgKG9iai50eXBlID09PSAnRmVhdHVyZScpIHtcbiAgICAgICAgYW5hbHl6ZShvYmouZ2VvbWV0cnkpO1xuICAgICAgICBmb3IgKGtleSBpbiBvYmoucHJvcGVydGllcykgc2F2ZUtleShrZXkpO1xuICAgICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICd0eXBlJyAmJiBrZXkgIT09ICdpZCcgJiYga2V5ICE9PSAncHJvcGVydGllcycgJiYga2V5ICE9PSAnZ2VvbWV0cnknKSBzYXZlS2V5KGtleSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAob2JqLnR5cGUgPT09ICdUb3BvbG9neScpIHtcbiAgICAgICAgaXNUb3BvID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmIChrZXkgIT09ICd0eXBlJyAmJiBrZXkgIT09ICd0cmFuc2Zvcm0nICYmIGtleSAhPT0gJ2FyY3MnICYmIGtleSAhPT0gJ29iamVjdHMnKSBzYXZlS2V5KGtleSk7XG4gICAgICAgIH1cbiAgICAgICAgYW5hbHl6ZU11bHRpTGluZShvYmouYXJjcyk7XG5cbiAgICAgICAgZm9yIChrZXkgaW4gb2JqLm9iamVjdHMpIHtcbiAgICAgICAgICAgIGFuYWx5emUob2JqLm9iamVjdHNba2V5XSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvYmoudHlwZSA9PT0gJ1BvaW50JykgYW5hbHl6ZVBvaW50KG9iai5jb29yZGluYXRlcyk7XG4gICAgICAgIGVsc2UgaWYgKG9iai50eXBlID09PSAnTXVsdGlQb2ludCcpIGFuYWx5emVQb2ludHMob2JqLmNvb3JkaW5hdGVzKTtcbiAgICAgICAgZWxzZSBpZiAob2JqLnR5cGUgPT09ICdHZW9tZXRyeUNvbGxlY3Rpb24nKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqLmdlb21ldHJpZXMubGVuZ3RoOyBpKyspIGFuYWx5emUob2JqLmdlb21ldHJpZXNbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFpc1RvcG8pIHtcbiAgICAgICAgICAgIGlmIChvYmoudHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSBhbmFseXplUG9pbnRzKG9iai5jb29yZGluYXRlcyk7XG4gICAgICAgICAgICBlbHNlIGlmIChvYmoudHlwZSA9PT0gJ1BvbHlnb24nIHx8IG9iai50eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykgYW5hbHl6ZU11bHRpTGluZShvYmouY29vcmRpbmF0ZXMpO1xuICAgICAgICAgICAgZWxzZSBpZiAob2JqLnR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9iai5jb29yZGluYXRlcy5sZW5ndGg7IGkrKykgYW5hbHl6ZU11bHRpTGluZShvYmouY29vcmRpbmF0ZXNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChrZXkgaW4gb2JqLnByb3BlcnRpZXMpIHNhdmVLZXkoa2V5KTtcbiAgICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAoa2V5ICE9PSAndHlwZScgJiYga2V5ICE9PSAnaWQnICYmIGtleSAhPT0gJ2Nvb3JkaW5hdGVzJyAmJiBrZXkgIT09ICdhcmNzJyAmJlxuICAgICAgICAgICAgICAgIGtleSAhPT0gJ2dlb21ldHJpZXMnICYmIGtleSAhPT0gJ3Byb3BlcnRpZXMnKSBzYXZlS2V5KGtleSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFuYWx5emVNdWx0aUxpbmUoY29vcmRzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIGFuYWx5emVQb2ludHMoY29vcmRzW2ldKTtcbn1cblxuZnVuY3Rpb24gYW5hbHl6ZVBvaW50cyhjb29yZHMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykgYW5hbHl6ZVBvaW50KGNvb3Jkc1tpXSk7XG59XG5cbmZ1bmN0aW9uIGFuYWx5emVQb2ludChwb2ludCkge1xuICAgIGRpbSA9IE1hdGgubWF4KGRpbSwgcG9pbnQubGVuZ3RoKTtcblxuICAgIC8vIGZpbmQgbWF4IHByZWNpc2lvblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG9pbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgd2hpbGUgKE1hdGgucm91bmQocG9pbnRbaV0gKiBlKSAvIGUgIT09IHBvaW50W2ldICYmIGUgPCBtYXhQcmVjaXNpb24pIGUgKj0gMTA7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzYXZlS2V5KGtleSkge1xuICAgIGlmIChrZXlzW2tleV0gPT09IHVuZGVmaW5lZCkga2V5c1trZXldID0ga2V5c051bSsrO1xufVxuXG5mdW5jdGlvbiB3cml0ZUZlYXR1cmVDb2xsZWN0aW9uKG9iaiwgcGJmKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmouZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGJmLndyaXRlTWVzc2FnZSgxLCB3cml0ZUZlYXR1cmUsIG9iai5mZWF0dXJlc1tpXSk7XG4gICAgfVxuICAgIHdyaXRlUHJvcHMob2JqLCBwYmYsIHRydWUpO1xufVxuXG5mdW5jdGlvbiB3cml0ZUZlYXR1cmUoZmVhdHVyZSwgcGJmKSB7XG4gICAgcGJmLndyaXRlTWVzc2FnZSgxLCB3cml0ZUdlb21ldHJ5LCBmZWF0dXJlLmdlb21ldHJ5KTtcblxuICAgIGlmIChmZWF0dXJlLmlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBmZWF0dXJlLmlkID09PSAnbnVtYmVyJyAmJiBmZWF0dXJlLmlkICUgMSA9PT0gMCkgcGJmLndyaXRlU1ZhcmludEZpZWxkKDEyLCBmZWF0dXJlLmlkKTtcbiAgICAgICAgZWxzZSBwYmYud3JpdGVTdHJpbmdGaWVsZCgxMSwgZmVhdHVyZS5pZCk7XG4gICAgfVxuXG4gICAgaWYgKGZlYXR1cmUucHJvcGVydGllcykgd3JpdGVQcm9wcyhmZWF0dXJlLnByb3BlcnRpZXMsIHBiZik7XG4gICAgd3JpdGVQcm9wcyhmZWF0dXJlLCBwYmYsIHRydWUpO1xufVxuXG5mdW5jdGlvbiB3cml0ZUdlb21ldHJ5KGdlb20sIHBiZikge1xuICAgIHBiZi53cml0ZVZhcmludEZpZWxkKDEsIGdlb21ldHJ5VHlwZXNbZ2VvbS50eXBlXSk7XG5cbiAgICB2YXIgY29vcmRzID0gZ2VvbS5jb29yZGluYXRlcyxcbiAgICAgICAgY29vcmRzT3JBcmNzID0gaXNUb3BvID8gZ2VvbS5hcmNzIDogY29vcmRzO1xuXG4gICAgaWYgKGdlb20udHlwZSA9PT0gJ1BvaW50Jykgd3JpdGVQb2ludChjb29yZHMsIHBiZik7XG4gICAgZWxzZSBpZiAoZ2VvbS50eXBlID09PSAnTXVsdGlQb2ludCcpIHdyaXRlTGluZShjb29yZHMsIHBiZiwgdHJ1ZSk7XG4gICAgZWxzZSBpZiAoZ2VvbS50eXBlID09PSAnTGluZVN0cmluZycpIHdyaXRlTGluZShjb29yZHNPckFyY3MsIHBiZik7XG4gICAgaWYgKGdlb20udHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycgfHwgZ2VvbS50eXBlID09PSAnUG9seWdvbicpIHdyaXRlTXVsdGlMaW5lKGNvb3Jkc09yQXJjcywgcGJmKTtcbiAgICBlbHNlIGlmIChnZW9tLnR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB3cml0ZU11bHRpUG9seWdvbihjb29yZHNPckFyY3MsIHBiZik7XG4gICAgZWxzZSBpZiAoZ2VvbS50eXBlID09PSAnR2VvbWV0cnlDb2xsZWN0aW9uJykge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20uZ2VvbWV0cmllcy5sZW5ndGg7IGkrKykgcGJmLndyaXRlTWVzc2FnZSg0LCB3cml0ZUdlb21ldHJ5LCBnZW9tLmdlb21ldHJpZXNbaV0pO1xuICAgIH1cblxuICAgIGlmIChpc1RvcG8gJiYgZ2VvbS5pZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZ2VvbS5pZCA9PT0gJ251bWJlcicgJiYgZ2VvbS5pZCAlIDEgPT09IDApIHBiZi53cml0ZVNWYXJpbnRGaWVsZCgxMiwgZ2VvbS5pZCk7XG4gICAgICAgIGVsc2UgcGJmLndyaXRlU3RyaW5nRmllbGQoMTEsIGdlb20uaWQpO1xuICAgIH1cblxuICAgIGlmIChpc1RvcG8gJiYgZ2VvbS5wcm9wZXJ0aWVzKSB3cml0ZVByb3BzKGdlb20ucHJvcGVydGllcywgcGJmKTtcbiAgICB3cml0ZVByb3BzKGdlb20sIHBiZiwgdHJ1ZSk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlVG9wb2xvZ3kodG9wb2xvZ3ksIHBiZikge1xuICAgIGlmICh0b3BvbG9neS50cmFuc2Zvcm0pIHtcbiAgICAgICAgcGJmLndyaXRlTWVzc2FnZSgxLCB3cml0ZVRyYW5zZm9ybSwgdG9wb2xvZ3kudHJhbnNmb3JtKTtcbiAgICAgICAgdHJhbnNmb3JtZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIHZhciBuYW1lcyA9IE9iamVjdC5rZXlzKHRvcG9sb2d5Lm9iamVjdHMpLFxuICAgICAgICBpLCBqLCBkO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSBwYmYud3JpdGVTdHJpbmdGaWVsZCgyLCBuYW1lc1tpXSk7XG4gICAgZm9yIChpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHBiZi53cml0ZU1lc3NhZ2UoMywgd3JpdGVHZW9tZXRyeSwgdG9wb2xvZ3kub2JqZWN0c1tuYW1lc1tpXV0pO1xuICAgIH1cblxuICAgIHZhciBsZW5ndGhzID0gW10sXG4gICAgICAgIGNvb3JkcyA9IFtdO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHRvcG9sb2d5LmFyY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGFyYyA9IHRvcG9sb2d5LmFyY3NbaV07XG4gICAgICAgIGxlbmd0aHMucHVzaChhcmMubGVuZ3RoKTtcblxuICAgICAgICBmb3IgKGogPSAwOyBqIDwgYXJjLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBmb3IgKGQgPSAwOyBkIDwgZGltOyBkKyspIGNvb3Jkcy5wdXNoKHRyYW5zZm9ybUNvb3JkKGFyY1tqXVtkXSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcGJmLndyaXRlUGFja2VkVmFyaW50KDQsIGxlbmd0aHMpO1xuICAgIHBiZi53cml0ZVBhY2tlZFNWYXJpbnQoNSwgY29vcmRzKTtcblxuICAgIHdyaXRlUHJvcHModG9wb2xvZ3ksIHBiZiwgdHJ1ZSk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlUHJvcHMocHJvcHMsIHBiZiwgaXNDdXN0b20pIHtcbiAgICB2YXIgaW5kZXhlcyA9IFtdLFxuICAgICAgICB2YWx1ZUluZGV4ID0gMDtcblxuICAgIGZvciAodmFyIGtleSBpbiBwcm9wcykge1xuICAgICAgICBpZiAoaXNDdXN0b20pIHtcbiAgICAgICAgICAgIGlmIChrZXkgPT09ICd0eXBlJykgY29udGludWU7XG4gICAgICAgICAgICBlbHNlIGlmIChwcm9wcy50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gJ2ZlYXR1cmVzJykgY29udGludWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BzLnR5cGUgPT09ICdGZWF0dXJlJykge1xuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09ICdpZCcgfHwga2V5ID09PSAncHJvcGVydGllcycgfHwga2V5ID09PSAnZ2VvbWV0cnknKSBjb250aW51ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcHMudHlwZSA9PT0gJ1RvcG9sb2d5JykgIHtcbiAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSAndHJhbnNmb3JtJyB8fCBrZXkgPT09ICdhcmNzJyB8fCBrZXkgPT09ICdvYmplY3RzJykgY29udGludWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ2lkJyB8fCBrZXkgPT09ICdjb29yZGluYXRlcycgfHwga2V5ID09PSAnYXJjcycgfHxcbiAgICAgICAgICAgICAgICAgICAgICAga2V5ID09PSAnZ2VvbWV0cmllcycgfHwga2V5ID09PSAncHJvcGVydGllcycpIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHBiZi53cml0ZU1lc3NhZ2UoMTMsIHdyaXRlVmFsdWUsIHByb3BzW2tleV0pO1xuICAgICAgICBpbmRleGVzLnB1c2goa2V5c1trZXldLCB2YWx1ZUluZGV4KyspO1xuICAgIH1cbiAgICBwYmYud3JpdGVQYWNrZWRWYXJpbnQoaXNDdXN0b20gPyAxNSA6IDE0LCBpbmRleGVzKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVWYWx1ZSh2YWx1ZSwgcGJmKSB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG5cbiAgICBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHBiZi53cml0ZVN0cmluZ0ZpZWxkKDEsIHZhbHVlKTtcbiAgICBlbHNlIGlmICh0eXBlID09PSAnYm9vbGVhbicpIHBiZi53cml0ZUJvb2xlYW5GaWVsZCg1LCB2YWx1ZSk7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHBiZi53cml0ZVN0cmluZ0ZpZWxkKDYsIEpTT04uc3RyaW5naWZ5KHZhbHVlKSk7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICBpZiAodmFsdWUgJSAxICE9PSAwKSBwYmYud3JpdGVEb3VibGVGaWVsZCgyLCB2YWx1ZSk7XG4gICAgICAgZWxzZSBpZiAodmFsdWUgPj0gMCkgcGJmLndyaXRlVmFyaW50RmllbGQoMywgdmFsdWUpO1xuICAgICAgIGVsc2UgcGJmLndyaXRlVmFyaW50RmllbGQoNCwgLXZhbHVlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHdyaXRlUG9pbnQocG9pbnQsIHBiZikge1xuICAgIHZhciBjb29yZHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRpbTsgaSsrKSBjb29yZHMucHVzaCh0cmFuc2Zvcm1Db29yZChwb2ludFtpXSkpO1xuICAgIHBiZi53cml0ZVBhY2tlZFNWYXJpbnQoMywgY29vcmRzKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVMaW5lKGxpbmUsIHBiZiwgaXNNdWx0aVBvaW50KSB7XG4gICAgdmFyIGNvb3JkcyA9IFtdO1xuICAgIHBvcHVsYXRlTGluZShjb29yZHMsIGxpbmUsIGlzTXVsdGlQb2ludCk7XG4gICAgcGJmLndyaXRlUGFja2VkU1ZhcmludCgzLCBjb29yZHMpO1xufVxuXG5mdW5jdGlvbiB3cml0ZU11bHRpTGluZShsaW5lcywgcGJmKSB7XG4gICAgdmFyIGxlbiA9IGxpbmVzLmxlbmd0aCxcbiAgICAgICAgaTtcbiAgICBpZiAobGVuICE9PSAxKSB7XG4gICAgICAgIHZhciBsZW5ndGhzID0gW107XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykgbGVuZ3Rocy5wdXNoKGxpbmVzW2ldLmxlbmd0aCk7XG4gICAgICAgIHBiZi53cml0ZVBhY2tlZFZhcmludCgyLCBsZW5ndGhzKTtcbiAgICAgICAgLy8gVE9ETyBmYXN0ZXIgd2l0aCBjdXN0b20gd3JpdGVNZXNzYWdlP1xuICAgIH1cbiAgICB2YXIgY29vcmRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSBwb3B1bGF0ZUxpbmUoY29vcmRzLCBsaW5lc1tpXSk7XG4gICAgcGJmLndyaXRlUGFja2VkU1ZhcmludCgzLCBjb29yZHMpO1xufVxuXG5mdW5jdGlvbiB3cml0ZU11bHRpUG9seWdvbihwb2x5Z29ucywgcGJmKSB7XG4gICAgdmFyIGxlbiA9IHBvbHlnb25zLmxlbmd0aCxcbiAgICAgICAgaSwgajtcbiAgICBpZiAobGVuICE9PSAxIHx8IHBvbHlnb25zWzBdLmxlbmd0aCAhPT0gMSB8fCBwb2x5Z29uc1swXVswXS5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdmFyIGxlbmd0aHMgPSBbbGVuXTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBsZW5ndGhzLnB1c2gocG9seWdvbnNbaV0ubGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwb2x5Z29uc1tpXS5sZW5ndGg7IGorKykgbGVuZ3Rocy5wdXNoKHBvbHlnb25zW2ldW2pdLmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcGJmLndyaXRlUGFja2VkVmFyaW50KDIsIGxlbmd0aHMpO1xuICAgIH1cblxuICAgIHZhciBjb29yZHMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IHBvbHlnb25zW2ldLmxlbmd0aDsgaisrKSBwb3B1bGF0ZUxpbmUoY29vcmRzLCBwb2x5Z29uc1tpXVtqXSk7XG4gICAgfVxuICAgIHBiZi53cml0ZVBhY2tlZFNWYXJpbnQoMywgY29vcmRzKTtcbn1cblxuZnVuY3Rpb24gcG9wdWxhdGVMaW5lKGNvb3JkcywgbGluZSwgaXNNdWx0aVBvaW50KSB7XG4gICAgdmFyIGksIGo7XG4gICAgZm9yIChpID0gMDsgaSA8IGxpbmUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGlzVG9wbyAmJiAhaXNNdWx0aVBvaW50KSBjb29yZHMucHVzaChpID8gbGluZVtpXSAtIGxpbmVbaSAtIDFdIDogbGluZVtpXSk7XG4gICAgICAgIGVsc2UgZm9yIChqID0gMDsgaiA8IGRpbTsgaisrKSBjb29yZHMucHVzaCh0cmFuc2Zvcm1Db29yZChsaW5lW2ldW2pdIC0gKGkgPyBsaW5lW2kgLSAxXVtqXSA6IDApKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Db29yZCh4KSB7XG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkID8geCA6IE1hdGgucm91bmQoeCAqIGUpO1xufVxuXG5mdW5jdGlvbiB3cml0ZVRyYW5zZm9ybSh0ciwgcGJmKSB7XG4gICAgcGJmLndyaXRlRG91YmxlRmllbGQoMSwgdHIuc2NhbGVbMF0pO1xuICAgIHBiZi53cml0ZURvdWJsZUZpZWxkKDIsIHRyLnNjYWxlWzFdKTtcbiAgICBwYmYud3JpdGVEb3VibGVGaWVsZCgzLCB0ci50cmFuc2xhdGVbMF0pO1xuICAgIHBiZi53cml0ZURvdWJsZUZpZWxkKDQsIHRyLnRyYW5zbGF0ZVsxXSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZW5jb2RlID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbmV4cG9ydHMuZGVjb2RlID0gcmVxdWlyZSgnLi9kZWNvZGUnKTtcbiJdfQ==
