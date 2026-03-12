from django.urls import path
from . import views

urlpatterns = [
    path('', views.precipitation_home, name='precipitation_home'),
    path('api/extremes/', views.api_extremes, name='api_extremes'),
]