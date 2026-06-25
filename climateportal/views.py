from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import SiteSection 
import json
import os
from django.http import JsonResponse
from django.conf import settings
from .models import MahaVillage
from django.db import connection

def home(request):
    return render(request, 'home.html', {"iot_dashboard_url": settings.IOT_DASHBOARD_URL})
@csrf_exempt
def gwpz_view(request):
    return render(request, "gwpz.html")
def ff_view(request):
    return render(request, "forestfire.html")



def about_team(request):

    context = {
        'overview':
            SiteSection.objects.filter(
                slug='overview'
            ).first(),

        'research':
            SiteSection.objects.filter(
                slug='research'
            ).first(),

        'contact':
            SiteSection.objects.filter(
                slug='contact'
            ).first(),

        # 'pi':
        #     TeamMember.objects.filter(
        #         category='pi'
        #     ).first(),

        # 'current_members':
        #     TeamMember.objects.filter(
        #         category='current'
        #     ),

        # 'alumni':
        #     TeamMember.objects.filter(
        #         category='alumni'
        #     ),

        # 'publications':
        #     Publication.objects.order_by('-year')
    }

    return render(
        request,
        'about_team.html',
        context
    )

# GEOJSON_FILE = os.path.join(
#     settings.BASE_DIR,
#     "static",
#     "data",
#     "mahavillagesall_mar23.geojson"
# )

# def load_geojson():
#     with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
#         return json.load(f)
    

# def districts_api(request):

#     data = load_geojson()

#     print("Total features:", len(data["features"]))

#     if data["features"]:
#         print("Sample properties:")
#         print(data["features"][0]["properties"])

#     districts = sorted(
#         list({
#             f["properties"].get("DISTRICT")
#             for f in data["features"]
#             if f.get("properties")
#         })
#     )

#     print("District count:", len(districts))

#     return JsonResponse(districts, safe=False)
# def talukas_api(request):

#     district = request.GET.get("district")

#     data = load_geojson()

#     talukas = sorted(
#         list({
#             f["properties"]["TEHSIL"]
#             for f in data["features"]
#             if f["properties"]["DISTRICT"] == district
#         })
#     )

#     return JsonResponse(talukas, safe=False)

# def villages_api(request):

#     district = request.GET.get("district")
#     tehsil = request.GET.get("tehsil")

#     data = load_geojson()

#     villages = sorted(
#         list({
#             f["properties"]["VILLAGE"]
#             for f in data["features"]
#             if (
#                 f["properties"]["DISTRICT"] == district
#                 and
#                 f["properties"]["TEHSIL"] == tehsil
#             )
#         })
#     )

#     return JsonResponse(villages, safe=False)

# def village_boundary_api(request):

#     district = request.GET.get("district")
#     tehsil = request.GET.get("tehsil")
#     village = request.GET.get("village")

#     data = load_geojson()

#     features = [
#         f
#         for f in data["features"]
#         if (
#             f["properties"]["DISTRICT"] == district
#             and
#             f["properties"]["TEHSIL"] == tehsil
#             and
#             f["properties"]["VILLAGE"] == village
#         )
#     ]

#     return JsonResponse({
#         "type": "FeatureCollection",
#         "features": features
#     })

def districts_api(request):

    districts = (
        MahaVillage.objects
        .exclude(district__isnull=True)
        .exclude(district='')
        .values_list('district', flat=True)
        .distinct()
        .order_by('district')
    )

    return JsonResponse(list(districts), safe=False)

def talukas_api(request):

    district = request.GET.get("district")

    tehsils = (
        MahaVillage.objects
        .filter(district=district)
        .exclude(tehsil__isnull=True)
        .exclude(tehsil='')
        .values_list('tehsil', flat=True)
        .distinct()
        .order_by('tehsil')
    )

    return JsonResponse(list(tehsils), safe=False)

def villages_api(request):

    district = request.GET.get("district")
    tehsil = request.GET.get("tehsil")

    villages = (
        MahaVillage.objects
        .filter(
            district=district,
            tehsil=tehsil
        )
        .exclude(village__isnull=True)
        .exclude(village='')
        .values_list('village', flat=True)
        .distinct()
        .order_by('village')
    )

    return JsonResponse(list(villages), safe=False)

def village_boundary_api(request):

    district = request.GET.get("district")
    tehsil = request.GET.get("tehsil")
    village = request.GET.get("village")

    sql = """
    SELECT json_build_object(
        'type','FeatureCollection',
        'features',
        COALESCE(
            json_agg(
                json_build_object(
                    'type','Feature',
                    'geometry', ST_AsGeoJSON(geom)::json,
                    'properties',
                    json_build_object(
                        'district', district,
                        'tehsil', tehsil,
                        'village', village
                    )
                )
            ),
            '[]'::json
        )
    )
    FROM mahavillages_clean
    WHERE district=%s
      AND tehsil=%s
      AND village=%s
    """

    with connection.cursor() as cursor:
        cursor.execute(
            sql,
            [district, tehsil, village]
        )
        geojson = cursor.fetchone()[0]

    return JsonResponse(geojson)