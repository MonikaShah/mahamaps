from django.db import models
from ckeditor.fields import RichTextField

class SiteSection(models.Model):

    title = models.CharField(max_length=200)

    slug = models.SlugField(unique=True)

    content = RichTextField()

    def __str__(self):
        return self.title