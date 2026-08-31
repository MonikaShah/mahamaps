"""
URL configuration for climateportal project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from precipitation_gridded import views
# from precipitation_gridded.views import imd_rainfall_api
from .views import home, precipitation_gridded_nc,precipitation_gridded,rainfall,rainfall_districts,gwpz_view,ff_view,about_team, districts_api,talukas_api, temperature_districts,villages_api,village_boundary_api,landslide_view,temperature,district_boundary,taluka_boundary,village_at_point
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Root URL must show landing page (home). Do not redirect / to /precipitation/ in server config.
    path('', home, name='landing'),
    # Precipitaiton from Aakash code-------------------
    # path('precipitation/', include('precipitation.urls')),
    # ----------------------------
    # path("precipitation-gridded/",precipitation_gridded,name="precipitation_gridded"),
    path("village-rainfall-timeseries/", views.village_rainfall_timeseries, name="village_rainfall_timeseries"),
    path("precipitation-gridded-nc/",precipitation_gridded_nc,name="precipitation_gridded_nc"),
    path("api/imd/rainfall/",views.imd_rainfall_api,name="imd_rainfall_api"),
    path("temperature/", temperature, name="temperature"),
    path("api/temperature-districts/",temperature_districts,name="temperature_districts"
    ),
    # -------------------------District wise rainfall-------------------------------
    # path('rainfall/', rainfall,name='rainfall'),
    # -------------------------District wise rainfall-------------------------------
    path('gwpz/', gwpz_view, name='gwpz'),  # Temporary, replace with gwpz_view when ready
    path('ff/', ff_view, name='ff'),  # Temporary, replace with gwpz_view when ready
    path('landslide/', landslide_view, name='landslide'),  # Temporary, replace with landslide_view when ready
    path('about-team/', about_team, name='about_team'),
    path(
        "api/districts/",
        districts_api
    ),

    path(
        "api/talukas/",
        talukas_api
    ),

    path(
        "api/villages/",
        villages_api
    ),

    path(
        "api/village-boundary/",
        village_boundary_api
    ),
    
    path(
        "api/rainfall-districts/",
        rainfall_districts,
        name="rainfall_districts"
    ),

    # --------------------------------------------------------
    # Administrative boundaries
    # --------------------------------------------------------

    path(
        "api/district-boundary/",
        district_boundary,
        name="district_boundary"
    ),

    path(
        "api/taluka-boundary/",
        taluka_boundary,
        name="taluka_boundary"
    ),

    # --------------------------------------------------------
    # Map click → village
    # --------------------------------------------------------

    path(
        "api/village-at-point/",
        village_at_point,
        name="village_at_point"
    ),

]
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )

    urlpatterns += static(
        settings.STATIC_URL,
        document_root=settings.STATIC_ROOT
    )