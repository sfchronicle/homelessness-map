from django.conf import settings

from bakery.views import BuildableTemplateView, BuildableListView
from .models import Complaint

class ComplaintBaseView(BuildableListView):
    model = Complaint
    context_object_name = 'complaints'


class ComplaintGeoJSONListView(ComplaintBaseView):
    template_name = 'complaints_geojson.html'
    content_type = 'application/json'

    def get_context_data(self, **kwargs ):
        context = super(ComplaintGeoJSONListView, self).get_context_data(**kwargs)
        context['complaints'] = Complaint.objects.filter()
        return context


class ComplaintListView(ComplaintBaseView):
    template_name = 'complaints_list.html'
    build_path = 'index.html'

    def get_context_data(self, **kwargs ):
        context = super(ComplaintListView, self).get_context_data(**kwargs)
        context['MAPZEN_SEARCH_KEY'] = settings.MAPZEN_SEARCH_KEY
        return context
