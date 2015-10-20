from ipdb import set_trace as debugger

import os

from django.conf import settings
from django.core.management.base import BaseCommand

from lib.utils import all_files, log
from postgres_copy import CopyMapping

from homelessness.apps.complaints.models import Complaint


class Command(BaseCommand):
    ENCAMP_CSV = 'all_encampments_simple.csv'
    WASTE_CSV = 'all_human_waste_refined_simple.csv'
    NEEDLE_CSV = 'all_needle_refined_simple.csv'

    def update_records(self, filepath):
        log('  Updating Complaints associated with {} ...'.format(filepath))
        if filepath == self.ENCAMP_CSV:
            for complaint in Complaint.objects.filter(kind__isnull=True):
                complaint.kind = 'encampment'
                complaint.save()

        if filepath == self.WASTE_CSV:
            for complaint in Complaint.objects.filter(kind__isnull=True):
                complaint.kind = 'waste'
                complaint.save()

        if filepath == self.NEEDLE_CSV:
            for complaint in Complaint.objects.filter(kind__isnull=True):
                complaint.kind = 'needle'
                complaint.save()

    def handle(self, *args, **options):
        data = os.path.join(settings.BASE_DIR, 'data')
        files = list(all_files(data, '*_simple.csv'))

        for filepath in files:
            log('Opening file {}'.format(filepath), 'cyan')
            log('  Loading data ...')

            fields = dict()

            if os.path.basename(filepath) == self.ENCAMP_CSV:
                fields = dict(date='Day of EnteredCalendarDate', latitude='Latitude', longitude='Longitude')

            if os.path.basename(filepath) == self.WASTE_CSV:
                fields = dict(date='Opened', latitude='Lat', longitude='Long')

            if os.path.basename(filepath) == self.NEEDLE_CSV:
                fields = dict(date='Opened', latitude='Lat', longitude='Long')

            copy = CopyMapping(Complaint, filepath, fields)
            copy.save()

            self.update_records( os.path.basename(filepath) )

            log('    Data loaded!', 'green')
