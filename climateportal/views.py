from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

def home(request):
    return render(request, 'home.html')
@csrf_exempt
def gwpz_view(request):
    return render(request, "gwpz.html")