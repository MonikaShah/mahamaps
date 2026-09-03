from django.db import models
from django.contrib.gis.db import models

from ckeditor.fields import RichTextField

class SiteSection(models.Model):

    title = models.CharField(max_length=200)

    slug = models.SlugField(unique=True)

    content = RichTextField()

    def __str__(self):
        return self.title
    
class MahaVillage(models.Model):
    id = models.IntegerField(primary_key=True)

    district = models.TextField()
    tehsil = models.TextField()
    village = models.TextField()

    geom = models.MultiPolygonField(srid=4326)

    # objectid_1 = models.IntegerField(null=True)
    # objectid = models.IntegerField(null=True)
    state = models.CharField(max_length=255, null=True)
    shape_leng = models.FloatField(null=True)
    # shape_le_1 = models.FloatField(null=True)
    shape_area = models.FloatField(null=True)
    # layer = models.CharField(max_length=255, null=True)
    # path = models.CharField(max_length=255, null=True)
    # long = models.IntegerField(null=True)

    class Meta:
        managed = False
        db_table = "mh_village_soi1sept26"