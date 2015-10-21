# Homelessness Map

## Minimum Requirements
This project supports Ubuntu Linux 14.04 and Mac OS X Yosemite. It is not tested or supported for the Windows OS.

- [Django 1.7+](https://www.djangoproject.com/)
- [PostgreSQL 9.3+](http://www.postgresql.org/)
- [PostGIS 2.1+](http://postgis.net/)
- [virtualenvwrapper](http://virtualenvwrapper.readthedocs.org/en/latest/)
- (optional) [Node.js 0.12.x](http://nodejs.org/) or [io.js 1.2.x](https://iojs.org/en/index.html)

## Quickstart
```bash
$ mkvirtualenv homelessness
$ git clone git@github.com:sfchronicle/homelessness-map.git && cd $_
$ pip install -r requirements/project.txt && fab npm:install && fab bower:install
$ fab bootstrap
```

## Load data

Fetch data and then
```bash
$ python manage.py loadcomplaints
```

### Build pbf file from geojson

We're using pbf since it's way more performant than geojson or topojson (in this case). Here's how you download the geojson from the local server and convert it to pbf:  

```bash
$ fab rs  # start server
$ curl http://127.0.0.1:8000/geojson.json/ > homelessness/assets/complaints.geojson  # download geojson
$ npm install geobuf -g  # install geobuf
$ json2geobuf homelessness/assets/complaints.json  #=> complaints.pbf convert JSON to pbf file
```

### Build pbf and geobuf from source for the web

To use a pbf file in the web, we need to build and include the pbf and geobuf libraries"

```bash
$ cd {PROJECT_ROOT}/homelessness/node_modules/pbf && npm install && npm run build-dev && cp dist/pbf-dev.js ../../assets/scripts/  # building browser version of pbf and copy file to assets
$ cd {PROJECT_ROOT/}homelessness/node_modules/geobuf && npm install && npm run build-dev && cp dist/geobuf-dev.js ../../assets/scripts/  # building browser version of geobuf and copy file to assets
```
