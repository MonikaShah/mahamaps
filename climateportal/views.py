from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import SiteSection 
import json
import os
from datetime import date, timedelta
import calendar
from django.http import JsonResponse
from django.conf import settings
from .models import MahaVillage
from django.db import connection
from django.views.decorators.http import require_GET

def home(request):
    return render(request, 'home.html', {"iot_dashboard_url": settings.IOT_DASHBOARD_URL})
@csrf_exempt
def gwpz_view(request):
    return render(request, "gwpz.html")
def ff_view(request):
    return render(request, "forestfire.html")
def landslide_view(request):
    return render(request, "landslide.html")
def temperature(request):
    return render(request, "temperature.html")

def temperature_districts(request):

    # ============================================================
    # PARAMETERS
    # ============================================================

    aggregation = request.GET.get(
        "aggregation",
        "daily"
    )

    start_date = request.GET.get(
        "start_date"
    )

    end_date = request.GET.get(
        "end_date"
    )

    year = request.GET.get(
        "year"
    )

    period = request.GET.get(
        "period"
    )


    # ============================================================
    # VALID AGGREGATIONS
    # ============================================================

    valid_aggregations = [
        "daily",
        "weekly",
        "monthly",
        "seasonal",
        "annual"
    ]

    if aggregation not in valid_aggregations:

        return JsonResponse(
            {
                "error": "Invalid aggregation"
            },
            status=400
        )


    # ============================================================
    # DAILY
    # ============================================================

    if aggregation == "daily":

        if not start_date or not end_date:

            return JsonResponse(
                {
                    "error":
                    "start_date and end_date are required for daily aggregation"
                },
                status=400
            )


    # ============================================================
    # OTHER AGGREGATIONS
    # ============================================================

    else:

        if not year:

            return JsonResponse(
                {
                    "error":
                    "year is required for this aggregation"
                },
                status=400
            )


        if not period:

            return JsonResponse(
                {
                    "error":
                    "period is required for this aggregation"
                },
                status=400
            )


        # --------------------------------------------------------
        # Convert year
        # --------------------------------------------------------

        try:

            year = int(year)

        except ValueError:

            return JsonResponse(
                {
                    "error": "Invalid year"
                },
                status=400
            )


        # ========================================================
        # WEEKLY
        # ========================================================

        if aggregation == "weekly":

            try:

                week = int(period)

            except ValueError:

                return JsonResponse(
                    {
                        "error":
                        "Weekly period must be a number from 1 to 52"
                    },
                    status=400
                )


            if week < 1 or week > 52:

                return JsonResponse(
                    {
                        "error":
                        "Weekly period must be between 1 and 52"
                    },
                    status=400
                )


            start = (
                date(year, 1, 1)
                + timedelta(days=(week - 1) * 7)
            )


            end = start + timedelta(days=6)


            last_day_of_year = date(
                year,
                12,
                31
            )


            if end > last_day_of_year:

                end = last_day_of_year


            start_date = start.isoformat()
            end_date = end.isoformat()


        # ========================================================
        # MONTHLY
        # ========================================================

        elif aggregation == "monthly":

            try:

                month = int(period)

            except ValueError:

                return JsonResponse(
                    {
                        "error":
                        "Monthly period must be a number from 1 to 12"
                    },
                    status=400
                )


            if month < 1 or month > 12:

                return JsonResponse(
                    {
                        "error":
                        "Monthly period must be between 1 and 12"
                    },
                    status=400
                )


            start = date(
                year,
                month,
                1
            )


            last_day = calendar.monthrange(
                year,
                month
            )[1]


            end = date(
                year,
                month,
                last_day
            )


            start_date = start.isoformat()
            end_date = end.isoformat()


        # ========================================================
        # SEASONAL
        # ========================================================

        elif aggregation == "seasonal":

            period_lower = str(
                period
            ).strip().lower()


            if period_lower == "winter":

                start = date(
                    year,
                    1,
                    1
                )

                end = date(
                    year,
                    2,
                    calendar.monthrange(
                        year,
                        2
                    )[1]
                )


            elif period_lower == "pre-monsoon":

                start = date(
                    year,
                    3,
                    1
                )

                end = date(
                    year,
                    5,
                    31
                )


            elif period_lower == "monsoon":

                start = date(
                    year,
                    6,
                    1
                )

                end = date(
                    year,
                    9,
                    30
                )


            elif period_lower == "post-monsoon":

                start = date(
                    year,
                    10,
                    1
                )

                end = date(
                    year,
                    12,
                    31
                )


            else:

                return JsonResponse(
                    {
                        "error":
                        "Invalid seasonal period"
                    },
                    status=400
                )


            start_date = start.isoformat()
            end_date = end.isoformat()


        # ========================================================
        # ANNUAL
        # ========================================================

        elif aggregation == "annual":

            start = date(
                year,
                1,
                1
            )

            end = date(
                year,
                12,
                31
            )


            start_date = start.isoformat()
            end_date = end.isoformat()


    # ============================================================
    # DEBUG
    # ============================================================

    print(
        "Temperature request:",
        aggregation,
        year,
        period,
        start_date,
        end_date
    )


    # ============================================================
    # TEMPERATURE AGGREGATION
    # ============================================================

    # Daily = average Tmax over selected dates
    # Everything else = average Tmax over the period

    aggregation_sql = "AVG(tmax)"


    # ============================================================
    # QUERY
    # ============================================================

    query = f"""
        SELECT
            temp_district,
            {aggregation_sql} AS temperature_value
        FROM maharashtra_daily_temperature
        WHERE temperature_date >= %s
          AND temperature_date <= %s
        GROUP BY temp_district
        ORDER BY temp_district;
    """


    params = [
        start_date,
        end_date
    ]


    # ============================================================
    # EXECUTE
    # ============================================================

    with connection.cursor() as cursor:

        cursor.execute(
            query,
            params
        )

        rows = cursor.fetchall()


    # ============================================================
    # RESPONSE
    # ============================================================

    data = []


    for district, value in rows:

        data.append(
            {
                "district": district,

                "value":
                    round(
                        float(value),
                        2
                    )
                    if value is not None
                    else None
            }
        )


    # ============================================================
    # JSON
    # ============================================================

    return JsonResponse(
        {
            "start_date":
                start_date,

            "end_date":
                end_date,

            "aggregation":
                aggregation,

            "year":
                year,

            "period":
                period,

            "data":
                data
        }
    )

def rainfall(request):
    return render(request, "rainfall.html")

def rainfall_districts(request):

    # ============================================================
    # PARAMETERS
    # ============================================================

    aggregation = request.GET.get(
        "aggregation",
        "daily"
    )

    start_date = request.GET.get(
        "start_date"
    )

    end_date = request.GET.get(
        "end_date"
    )

    year = request.GET.get(
        "year"
    )

    period = request.GET.get(
        "period"
    )


    # ============================================================
    # VALID AGGREGATIONS
    # ============================================================

    valid_aggregations = [
        "daily",
        "weekly",
        "monthly",
        "seasonal",
        "annual"
    ]

    if aggregation not in valid_aggregations:

        return JsonResponse(
            {
                "error": "Invalid aggregation"
            },
            status=400
        )


    # ============================================================
    # DAILY
    # ============================================================

    if aggregation == "daily":

        # Daily requires explicit date range

        if not start_date or not end_date:

            return JsonResponse(
                {
                    "error":
                    "start_date and end_date are required for daily aggregation"
                },
                status=400
            )


    # ============================================================
    # OTHER AGGREGATIONS
    # ============================================================

    else:

        if not year:

            return JsonResponse(
                {
                    "error":
                    "year is required for this aggregation"
                },
                status=400
            )


        if not period:

            return JsonResponse(
                {
                    "error":
                    "period is required for this aggregation"
                },
                status=400
            )


        # --------------------------------------------------------
        # Convert year to integer
        # --------------------------------------------------------

        try:

            year = int(year)

        except ValueError:

            return JsonResponse(
                {
                    "error":
                    "Invalid year"
                },
                status=400
            )


        # ========================================================
        # WEEKLY
        # ========================================================

        if aggregation == "weekly":

            try:

                week = int(period)

            except ValueError:

                return JsonResponse(
                    {
                        "error":
                        "Weekly period must be a number from 1 to 52"
                    },
                    status=400
                )


            if week < 1 or week > 52:

                return JsonResponse(
                    {
                        "error":
                        "Weekly period must be between 1 and 52"
                    },
                    status=400
                )


            # Week 1 = Jan 1 - Jan 7
            # Week 2 = Jan 8 - Jan 14
            # etc.

            start = date(
                year,
                1,
                1
            ) + timedelta(
                days=(week - 1) * 7
            )


            end = start + timedelta(
                days=6
            )


            # Don't go beyond December 31

            last_day_of_year = date(
                year,
                12,
                31
            )


            if end > last_day_of_year:

                end = last_day_of_year


            start_date = start.isoformat()
            end_date = end.isoformat()


        # ========================================================
        # MONTHLY
        # ========================================================

        elif aggregation == "monthly":

            try:

                month = int(period)

            except ValueError:

                return JsonResponse(
                    {
                        "error":
                        "Monthly period must be a number from 1 to 12"
                    },
                    status=400
                )


            if month < 1 or month > 12:

                return JsonResponse(
                    {
                        "error":
                        "Monthly period must be between 1 and 12"
                    },
                    status=400
                )


            # First day

            start = date(
                year,
                month,
                1
            )


            # Last day

            last_day = calendar.monthrange(
                year,
                month
            )[1]


            end = date(
                year,
                month,
                last_day
            )


            start_date = start.isoformat()
            end_date = end.isoformat()


        # ========================================================
        # SEASONAL
        # ========================================================

        elif aggregation == "seasonal":

            period_lower = str(
                period
            ).strip().lower()


            # ----------------------------------------------------
            # WINTER
            # December - February
            #
            # For a selected year, we use:
            # Jan 1 - Feb 28/29
            #
            # December belongs to the previous year's season.
            # ----------------------------------------------------

            if period_lower == "winter":

                start = date(
                    year,
                    1,
                    1
                )

                end = date(
                    year,
                    2,
                    calendar.monthrange(
                        year,
                        2
                    )[1]
                )


            # ----------------------------------------------------
            # PRE-MONSOON
            # March - May
            # ----------------------------------------------------

            elif period_lower == "pre-monsoon":

                start = date(
                    year,
                    3,
                    1
                )

                end = date(
                    year,
                    5,
                    31
                )


            # ----------------------------------------------------
            # MONSOON
            # June - September
            # ----------------------------------------------------

            elif period_lower == "monsoon":

                start = date(
                    year,
                    6,
                    1
                )

                end = date(
                    year,
                    9,
                    30
                )


            # ----------------------------------------------------
            # POST-MONSOON
            # October - December
            # ----------------------------------------------------

            elif period_lower == "post-monsoon":

                start = date(
                    year,
                    10,
                    1
                )

                end = date(
                    year,
                    12,
                    31
                )


            else:

                return JsonResponse(
                    {
                        "error":
                        "Invalid seasonal period. "
                        "Use winter, pre-monsoon, monsoon or post-monsoon."
                    },
                    status=400
                )


            start_date = start.isoformat()
            end_date = end.isoformat()


        # ========================================================
        # ANNUAL
        # ========================================================

        elif aggregation == "annual":

            start = date(
                year,
                1,
                1
            )

            end = date(
                year,
                12,
                31
            )


            start_date = start.isoformat()
            end_date = end.isoformat()


    # ============================================================
    # DEBUG
    # ============================================================

    print(
        "Rainfall request:",
        aggregation,
        year,
        period,
        start_date,
        end_date
    )


    # ============================================================
    # QUERY
    # ============================================================

    # Daily = average
    # Everything else = sum

    if aggregation == "daily":

        aggregation_sql = "AVG(rainfall)"

    else:

        aggregation_sql = "SUM(rainfall)"


    query = f"""
        SELECT
            rain_district,
            {aggregation_sql} AS rainfall_value
        FROM maharashtra_daily_rainfall
        WHERE rainfall_date >= %s
          AND rainfall_date <= %s
        GROUP BY rain_district
        ORDER BY rain_district;
    """


    params = [
        start_date,
        end_date
    ]


    # ============================================================
    # EXECUTE
    # ============================================================

    with connection.cursor() as cursor:

        cursor.execute(
            query,
            params
        )

        rows = cursor.fetchall()


    # ============================================================
    # RESPONSE DATA
    # ============================================================

    data = []


    for district, value in rows:

        data.append(
            {
                "district": district,

                "value":
                    round(
                        float(value),
                        2
                    )
                    if value is not None
                    else None
            }
        )


    # ============================================================
    # RESPONSE
    # ============================================================

    return JsonResponse(
        {
            "start_date":
                start_date,

            "end_date":
                end_date,

            "aggregation":
                aggregation,

            "year":
                year,

            "period":
                period,

            "data":
                data
        }
    )

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
        SELECT
            json_build_object(
                'type', 'FeatureCollection',

                'village_id',
                (
                    SELECT id
                    FROM mahavillages_clean
                    WHERE district = %s
                      AND tehsil = %s
                      AND village = %s
                    ORDER BY id
                    LIMIT 1
                ),

                'features',
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(geom)::json,
                                'properties', json_build_object(
                                    'id', id,
                                    'district', district,
                                    'tehsil', tehsil,
                                    'village', village
                                )
                            )
                        )
                        FROM mahavillages_clean
                        WHERE district = %s
                          AND tehsil = %s
                          AND village = %s
                    ),
                    '[]'::json
                )
            )
    """

    params = [
        district,
        tehsil,
        village,

        district,
        tehsil,
        village
    ]

    with connection.cursor() as cursor:

        cursor.execute(
            sql,
            params
        )

        geojson = cursor.fetchone()[0]

    return JsonResponse(geojson)

def precipitation_gridded(request):
    return render(
        request,
        "precipitation_gridded.html"
    )

def precipitation_gridded_nc(request):
    return render(
        request,
        "precipitation_gridded_nc.html"
    )

# ============================================================
# DISTRICT BOUNDARY
# ============================================================

@require_GET
def district_boundary(request):

    district = request.GET.get("district", "").strip()

    if not district:
        return JsonResponse(
            {
                "error": "District is required."
            },
            status=400
        )

    sql = """
        SELECT
            ST_AsGeoJSON(
                ST_Union(geom)
            ) AS geometry
        FROM mahavillages_clean
        WHERE district = %s;
    """

    with connection.cursor() as cursor:

        cursor.execute(
            sql,
            [district]
        )

        row = cursor.fetchone()

    if not row or not row[0]:

        return JsonResponse(
            {
                "error": "District boundary not found."
            },
            status=404
        )

    geometry = json.loads(row[0])

    return JsonResponse(
        {
            "type": "Feature",
            "properties": {
                "district": district
            },
            "geometry": geometry
        }
    )


# ============================================================
# TALUKA / TEHSIL BOUNDARY
# ============================================================

@require_GET
def taluka_boundary(request):

    district = request.GET.get(
        "district",
        ""
    ).strip()

    tehsil = request.GET.get(
        "tehsil",
        ""
    ).strip()

    if not district or not tehsil:

        return JsonResponse(
            {
                "error":
                    "District and tehsil are required."
            },
            status=400
        )

    sql = """
        SELECT
            ST_AsGeoJSON(
                ST_Union(geom)
            ) AS geometry
        FROM mahavillages_clean
        WHERE district = %s
          AND tehsil = %s;
    """

    with connection.cursor() as cursor:

        cursor.execute(
            sql,
            [
                district,
                tehsil
            ]
        )

        row = cursor.fetchone()

    if not row or not row[0]:

        return JsonResponse(
            {
                "error":
                    "Taluka boundary not found."
            },
            status=404
        )

    geometry = json.loads(row[0])

    return JsonResponse(
        {
            "type": "Feature",
            "properties": {
                "district": district,
                "tehsil": tehsil
            },
            "geometry": geometry
        }
    )


# ============================================================
# FIND VILLAGE AT MAP CLICK
# ============================================================

@require_GET
def village_at_point(request):

    try:

        longitude = float(
            request.GET.get("lon")
        )

        latitude = float(
            request.GET.get("lat")
        )

    except (TypeError, ValueError):

        return JsonResponse(
            {
                "error":
                    "Valid lon and lat are required."
            },
            status=400
        )

    sql = """
        SELECT
            district,
            tehsil,
            village
        FROM mahavillages_clean
        WHERE ST_Covers(
            geom,
            ST_SetSRID(
                ST_Point(%s, %s),
                4326
            )
        )
        LIMIT 1;
    """

    with connection.cursor() as cursor:

        cursor.execute(
            sql,
            [
                longitude,
                latitude
            ]
        )

        row = cursor.fetchone()

    if not row:

        return JsonResponse(
            {
                "found": False,
                "message":
                    "No village found at this location."
            }
        )

    district, tehsil, village = row

    return JsonResponse(
        {
            "found": True,

            "district": district,

            "tehsil": tehsil,

            "village": village
        }
    )