from bakery.views import BuildableTemplateView, BuildableListView
from .models import Complaint

class ComplaintBaseView(BuildableListView):
    model = Complaint
    context_object_name = 'complaints'


class ComplaintGeoJSONListView(ComplaintBaseView):
    template_name = 'complaints_geojson.html'
    content_type = 'application/json'


class ComplaintListView(ComplaintBaseView):
    template_name = 'complaints_list.html'
    build_path = 'index.html'

    # def get_context_data(self, **kwargs ):
    #     context = super(ComplaintListView, self).get_context_data(**kwargs)
    #     context['complaints'] = Complaint.objects.filter(
    #         date__range=['2007-01-01', '2015-12-31'])
    #     return context
