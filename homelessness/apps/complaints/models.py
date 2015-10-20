from django.contrib.gis.db import models


class Complaint(models.Model):
    KIND_CHOICES = (
        ('waste', 'Human Waste'),
        ('encampment', 'Encampment'),
        ('needle', 'Needles'),
    )

    kind = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        choices=KIND_CHOICES
    )
    date = models.DateField()
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __unicode__(self):
        return "{} {}".format(self.kind, self.date)
