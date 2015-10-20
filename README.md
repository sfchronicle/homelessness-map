# Homelessness Map
<img width="1150" alt="screen shot 2015-10-20 at 8 35 20 am" src="https://cloud.githubusercontent.com/assets/856628/10612447/b8c2fe22-7705-11e5-8443-f58100f2aee3.png">

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
$ fab rs
```

## Load data
