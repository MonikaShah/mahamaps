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
from .views import home,rainfall,rainfall_districts,gwpz_view,ff_view,about_team, districts_api,talukas_api, temperature_districts,villages_api,village_boundary_api,landslide_view,temperature
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Root URL must show landing page (home). Do not redirect / to /precipitation/ in server config.
    path('', home, name='landing'),
    path('precipitation/', include('precipitation.urls')),
    path("temperature/", temperature, name="temperature"),
    path("api/temperature-districts/",temperature_districts,name="temperature_districts"
    ),
    path('rainfall/', rainfall,name='rainfall'),
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