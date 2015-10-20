"""
Django settings for homelessness project.

For more information on this file, see
https://docs.djangoproject.com/en/1.8/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.8/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
SITE_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
STATIC_ROOT = os.path.join(SITE_ROOT, 'static')

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.8/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'hmo9czh=5#lg&$)9lg3z@9!q++to)se3+%j^jlc5&&uome%cj3'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

TEMPLATE_DEBUG = True

TEMPLATE_DIRS = (
    os.path.join(SITE_ROOT, 'templates'),
)

INTERNAL_IPS = (
    '127.0.0.1',
    '0.0.0.0',
)

# Directory where you store all your data
DATA_DIR = os.path.join(SITE_ROOT, 'data')

ALLOWED_HOSTS = []

# Whether or not you want to use grunt.js with the runserver command and fab
# http://gruntjs.com/
USE_GRUNT = True

# Whether or not to use PostGIS
# http://postgis.net/
USE_POSTGIS = True


# Application definition
INSTALLED_APPS = (
    # Django apps
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.humanize',
    'django.contrib.staticfiles',
    'django.contrib.admin',
    'django.contrib.admindocs',

    #External Apps
    'compressor',
    'bakery',
    'django_extensions',
    'debug_toolbar',

    # Project Apps
    'lib',
    'homelessness.apps.complaints',
)

if USE_POSTGIS:
    INSTALLED_APPS += ('django.contrib.gis',)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'homelessness.urls'

WSGI_APPLICATION = 'homelessness.wsgi.application'


# Database
# https://docs.djangoproject.com/en/1.8/ref/settings/#databases
if USE_POSTGIS:
    DB = 'django.contrib.gis.db.backends.postgis'
else:
    # Add 'postgresql_psycopg2', 'mysql', 'sqlite3' or 'oracle'.
    DB = 'django.db.backends.postgresql_psycopg2'

DATABASES = {
    'default': {
        'ENGINE': DB,
        'NAME': 'homelessness',
    }
}

# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.8/howto/static-files/

STATIC_URL = '/static/'

# Additional locations of static files
STATICFILES_DIRS = (
    # File directories that you want to be collected into STATIC_ROOT using Django's
    # staticfiles toolkit. A good thing to put here would be the admin media directory.
    os.path.join(SITE_ROOT, 'assets'),
)

# List of finder classes that know how to find static files in
# various locations.
STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    # 'django.contrib.staticfiles.finders.DefaultStorageFinder',
    'compressor.finders.CompressorFinder',
)

# Check for local settings
try:
    from local_settings import *
except ImportError:
    pass
