import json
import os
import pandas as pd
from django.http import JsonResponse, HttpResponse, FileResponse
from django.shortcuts import render
from shapely.geometry import box

from backend.extremes_point import extremes_point
from backend.nc_to_rainfall_extremes import extremes
from backend.Rainfall_csv import rainfall
from backend.Extreme_significance_Test import statistical_test
from backend.Extreme_Plots import plots
from backend.Return_Period_Probability import return_period_prob
from backend.daily_raster import download_raster_daily_range
from backend.monthly_raster import download_raster_monthly_range
from backend.yearly_raster import download_raster_yearly_range

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def precipitation_home(request):
    return render(request, 'main.html')


def map_view(request):
    return render(request, 'precipitation/map.html')


def api_extremes(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    start_year = int(data.get('start_year', 1901))
    end_year = int(data.get('end_year', 2000))
    input_type = data.get('input_type', 'point')
    csv_path = os.path.join(BASE_DIR, 'index_values.csv')
    if os.path.exists(csv_path):
        try:
            os.remove(csv_path)
        except OSError:
            pass
    result = []
    if input_type == 'bbox':
        bbox_vals = data.get('bbox', [])
        if len(bbox_vals) == 4:
            bbox = box(*bbox_vals)
            extremes(start_year, end_year, bbox)
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path, index_col=0)
                result = df.iloc[[-1]].to_dict(orient='records')
    elif input_type == 'point':
        point_vals = data.get('point', [])
        if len(point_vals) == 2:
            extremes_point(start_year, end_year, point_vals[0], point_vals[1])
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path, index_col=0)
                result = df.iloc[[-1]].to_dict(orient='records')
    return JsonResponse(result, safe=False)


def form_view(request):
    if request.method != 'POST':
        return render(request, 'precipitation/index.html')
    function = request.POST.get('function')
    try:
        start_year = int(request.POST.get('start_year'))
        end_year = int(request.POST.get('end_year'))
    except (TypeError, ValueError):
        return HttpResponse("Start year and end year required.", status=400)
    input_type = request.POST.get('input_type', 'bbox')
    start_date = request.POST.get('start_date', '')
    end_date = request.POST.get('end_date', '')
    bbox = None
    point = None
    if input_type == 'bbox':
        bbox_str = request.POST.get('bbox', '')
        if bbox_str:
            try:
                bbox_vals = [float(x) for x in bbox_str.split(',')]
                if len(bbox_vals) == 4:
                    bbox = box(*bbox_vals)
            except ValueError:
                pass
    elif input_type == 'point':
        point_str = request.POST.get('point', '')
        if point_str:
            try:
                point_vals = [float(x) for x in point_str.split(',')]
                if len(point_vals) == 2:
                    point = tuple(point_vals)
            except ValueError:
                pass
    if function == 'rainfall_csv':
        if bbox:
            rainfall(start_year, end_year, bbox)
            path = os.path.join(BASE_DIR, 'daily_rainfall.csv')
            if os.path.exists(path):
                return FileResponse(open(path, 'rb'), as_attachment=True, filename='daily_rainfall.csv')
        return HttpResponse("Bounding box required for rainfall CSV.", status=400)
    if function == 'extremes':
        if os.path.exists(os.path.join(BASE_DIR, 'index_values.csv')):
            try:
                os.remove(os.path.join(BASE_DIR, 'index_values.csv'))
            except OSError:
                pass
        if bbox:
            extremes(start_year, end_year, bbox)
        elif point:
            extremes_point(start_year, end_year, point[0], point[1])
        else:
            return HttpResponse("Please provide either a bounding box or a point.", status=400)
        path = os.path.join(BASE_DIR, 'index_values.csv')
        if os.path.exists(path):
            return FileResponse(open(path, 'rb'), as_attachment=True, filename='index_values.csv')
        return HttpResponse("Extremes computation produced no file.", status=500)
    if function == 'statistical_test':
        statistical_test()
        path = os.path.join(BASE_DIR, 'results_5.csv')
        if os.path.exists(path):
            return FileResponse(open(path, 'rb'), as_attachment=True, filename='results_5.csv')
        return HttpResponse("Statistical test did not produce output.", status=500)
    if function == 'plots':
        plots()
        return HttpResponse("Plots generated successfully")
    if function == 'return_period_prob':
        return_period_prob()
        path = os.path.join(BASE_DIR, 'return_periods_and_probabilities_with_labels.csv')
        if os.path.exists(path):
            return FileResponse(open(path, 'rb'), as_attachment=True, filename='return_periods_and_probabilities_with_labels.csv')
        return HttpResponse("Return period computation did not produce output.", status=500)
    if function == 'daily_raster':
        if bbox:
            download_raster_daily_range(bbox, start_date, end_date)
            return HttpResponse("Raster downloaded successfully")
        return HttpResponse("Bounding box required for raster download.", status=400)
    if function == 'monthly_raster':
        if bbox:
            download_raster_monthly_range(bbox, start_date, end_date)
            return HttpResponse("Raster downloaded successfully")
        return HttpResponse("Bounding box required for raster download.", status=400)
    if function == 'yearly_raster':
        if bbox:
            download_raster_yearly_range(bbox, start_date, end_date)
            return HttpResponse("Raster downloaded successfully")
        return HttpResponse("Bounding box required for raster download.", status=400)
    return HttpResponse("Unknown function.", status=400)


def download_index_values(request):
    csv_path = os.path.join(BASE_DIR, 'index_values.csv')
    if not os.path.exists(csv_path):
        return HttpResponse("File not found.", status=404)
    return FileResponse(open(csv_path, 'rb'), as_attachment=True, filename='index_values.csv')
