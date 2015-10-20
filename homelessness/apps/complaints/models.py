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
        choices=KIND_CHOICES,
        db_index=True
    )
    date = models.DateField(db_index=True)
    latitude = models.FloatField(db_index=True)
    longitude = models.FloatField(db_index=True)

    def __unicode__(self):
        return "{} {}".format(self.kind, self.date)
