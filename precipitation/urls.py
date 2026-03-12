from django.urls import path
from . import views

urlpatterns = [
    path('', views.precipitation_home, name='precipitation_home'),
    path('api/extremes/', views.api_extremes, name='api_extremes'),
    path('form/', views.form_view, name='form'),
    path('download/index_values.csv', views.download_index_values, name='download_index_values'),
]