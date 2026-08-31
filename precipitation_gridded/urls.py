from django.urls import path
from . import views

urlpatterns = [

    path(
        "rainfall/",
        views.imd_rainfall_api,
        name="imd_rainfall_api"
    ),
    

]