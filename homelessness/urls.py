from django.contrib import admin
from django.conf.urls import patterns, include, url

from homelessness.apps.complaints import views

admin.autodiscover()

urlpatterns = patterns('',
    # Admin
(r'^admin/', admin.site.urls),
    (r'^$', views.ComplaintListView.as_view()),
    (r'^geojson.json/$', views.ComplaintGeoJSONListView.as_view()),
)
