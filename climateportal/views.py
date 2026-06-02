from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
def home(request):
    return render(request, 'home.html', {"iot_dashboard_url": settings.IOT_DASHBOARD_URL})
@csrf_exempt
def gwpz_view(request):
    return render(request, "gwpz.html")
def ff_view(request):
    return render(request, "forestfire.html")