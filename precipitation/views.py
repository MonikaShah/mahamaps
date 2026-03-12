import os
import pandas as pd
from django.http import JsonResponse
from django.shortcuts import render
from shapely.geometry import box

from backend.extremes_point import extremes_point
from backend.nc_to_rainfall_extremes import extremes

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def precipitation_home(request):
    return render(request, 'main.html')

def map_view(request):
    return render(request, 'precipitation/map.html')

def api_extremes(request):
    if request.method == "POST":
        import json
        data = json.loads(request.body)

        start_year = 1901
        end_year = 2000
        lon = float(request.GET.get("lon"))
    lat = float(request.GET.get("lat"))

    extremes_point(start_year, end_year, lon, lat)

    csv_path = "index_values.csv"
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        return JsonResponse(df.to_dict(orient="records"), safe=False)
    else:
        return JsonResponse({"error": "No data"}, status=400)