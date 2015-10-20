from django.contrib import admin
from .models import Complaint

@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    date_hierarchy = 'date'
    list_filter = ('kind',)
    list_display = ('date', 'kind', 'latitude', 'longitude',)
