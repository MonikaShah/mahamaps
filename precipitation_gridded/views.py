from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
from django.db import connection
from django.views.decorators.http import require_GET
from datetime import datetime
import json

def imd_rainfall_api(request):

    observation_date = request.GET.get("date")

    if not observation_date:
        return JsonResponse(
            {
                "error": "date parameter is required",
                "example": "/api/imd/rainfall/?date=2000-01-01"
            },
            status=400
        )

    sql = """
        SELECT
            g.id AS grid_id,
            g.latitude,
            g.longitude,
            d.values[g.id] AS value
        FROM imd_daily_climate_data d
        CROSS JOIN imd_rainfall_grid g
        WHERE d.observation_date = %s
          AND d.variable = 'rainfall'
          AND d.values[g.id] IS NOT NULL
        ORDER BY g.id;
    """

    with connection.cursor() as cursor:

        cursor.execute(
            sql,
            [observation_date]
        )

        rows = cursor.fetchall()

    data = []

    for grid_id, latitude, longitude, value in rows:

        data.append({
            "grid_id": grid_id,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "value": float(value)
        })

    return JsonResponse({
        "date": observation_date,
        "variable": "rainfall",
        "count": len(data),
        "data": data
    })



@require_GET

def village_rainfall_timeseries(request):
    """
    Return area-weighted daily rainfall time series for a selected village.

    Logic:

        village
            ↓
        village_rain_grid_weights_soi1sept26
            ↓
        array_index + weight
            ↓
        imd_rain_timeseries.grid_values[array_index]
            ↓
        rainfall × weight
            ↓
        SUM across grids
            ↓
        daily village rainfall
    """

    # ========================================================
    # 1. GET PARAMETERS
    # ========================================================

    village_id = request.GET.get("village_id")
    start_date = request.GET.get("start_date")
    end_date = request.GET.get("end_date")

    # ========================================================
    # 2. VALIDATE PARAMETERS
    # ========================================================

    if not village_id:
        return JsonResponse(
            {
                "error": "village_id is required"
            },
            status=400
        )

    if not start_date or not end_date:
        return JsonResponse(
            {
                "error": "start_date and end_date are required"
            },
            status=400
        )

    try:
        start_date_obj = datetime.strptime(
            start_date,
            "%Y-%m-%d"
        ).date()

        end_date_obj = datetime.strptime(
            end_date,
            "%Y-%m-%d"
        ).date()

    except ValueError:
        return JsonResponse(
            {
                "error": "Dates must be in YYYY-MM-DD format"
            },
            status=400
        )

    if start_date_obj > end_date_obj:
        return JsonResponse(
            {
                "error": "start_date cannot be after end_date"
            },
            status=400
        )

    # ========================================================
    # 3. GET VILLAGE INFORMATION
    # ========================================================

    village_sql = """
        SELECT
            id,
            district,
            tehsil,
            village,
            ST_AsGeoJSON(geom) AS gevometry
        FROM mh_village_soi1sept26
        WHERE id = %s
        LIMIT 1
    """

    with connection.cursor() as cursor:

        cursor.execute(
            village_sql,
            [village_id]
        )

        village_row = cursor.fetchone()

    if not village_row:

        return JsonResponse(
            {
                "error": "Village not found"
            },
            status=404
        )

    (
        village_db_id,
        district,
        tehsil,
        village,
        geometry_json
    ) = village_row

    # ========================================================
    # 4. GET PRECOMPUTED VILLAGE-GRID WEIGHTS
    # ========================================================
    #
    # This replaces the old ST_Intersects logic.
    #
    # The table already contains:
    #
    #   village_id
    #   grid_id
    #   array_index
    #   intersection_area
    #   weight
    #
    # ========================================================

    weight_sql = """
        SELECT
            grid_id,
            array_index,
            intersection_area,
            weight
        FROM village_rain_grid_weights_soi1sept26
        WHERE village_id = %s
        ORDER BY array_index
    """

    with connection.cursor() as cursor:

        cursor.execute(
            weight_sql,
            [village_id]
        )

        weight_rows = cursor.fetchall()

    if not weight_rows:

        return JsonResponse(
            {
                "error": "No rainfall grid weights found for village"
            },
            status=404
        )

    # ========================================================
    # 5. GET GRID INFORMATION
    # ========================================================

    grid_ids = [
        row[0]
        for row in weight_rows
    ]

    grid_cells = []

    grid_sql = """
        SELECT
            grid_id,
            latitude,
            longitude
        FROM imd_rain_grid
        WHERE grid_id = ANY(%s)
        ORDER BY grid_id
    """

    with connection.cursor() as cursor:

        cursor.execute(
            grid_sql,
            [grid_ids]
        )

        grid_rows = cursor.fetchall()

    grid_lookup = {}

    for row in grid_rows:

        grid_id, latitude, longitude = row

        grid_lookup[grid_id] = {
            "latitude": float(latitude),
            "longitude": float(longitude)
        }

    # ========================================================
    # 6. BUILD GRID INFORMATION
    # ========================================================

    grid_cells = []

    for (
        grid_id,
        array_index,
        intersection_area,
        weight
    ) in weight_rows:

        grid_info = grid_lookup.get(grid_id)

        if not grid_info:
            continue

        grid_cells.append(
            {
                "grid_id": grid_id,
                "array_index": array_index,
                "latitude": grid_info["latitude"],
                "longitude": grid_info["longitude"],
                "intersection_area": float(intersection_area),
                "weight": float(weight)
            }
        )

    # ========================================================
    # 7. GET DAILY AREA-WEIGHTED VILLAGE RAINFALL
    # ========================================================

    rainfall_sql = """
        SELECT
            t.observation_date,
            SUM(
                t.grid_values[v.array_index] * v.weight
            ) AS daily_village_rainfall
        FROM imd_rain_timeseries t
        JOIN village_rain_grid_weights_soi1sept26 v
            ON v.village_id = %s
        WHERE t.observation_date >= %s
        AND t.observation_date <= %s
        GROUP BY t.observation_date
        ORDER BY t.observation_date
    """

    with connection.cursor() as cursor:

        cursor.execute(
            rainfall_sql,
            [
                village_id,
                start_date_obj,
                end_date_obj
            ]
        )

        rainfall_rows = cursor.fetchall()


    # ========================================================
    # 8. BUILD TIME SERIES
    # ========================================================

    timeseries = []

    for observation_date, rainfall in rainfall_rows:

        if rainfall is None:

            rainfall_value = None

        else:

            rainfall_value = float(rainfall)

        timeseries.append(
            {
                "date": observation_date.isoformat(),
                "rainfall": rainfall_value
            }
        )

    # ========================================================
    # 9. RETURN JSON
    # ========================================================

    return JsonResponse(
        {
            "village": {
                "id": village_db_id,
                "district": district,
                "tehsil": tehsil,
                "village": village,
                "geometry": json.loads(geometry_json)
            },

            "grid": grid_cells,

            "start_date": start_date,
            "end_date": end_date,

            "grid_count": len(grid_cells),

            "data": timeseries
        }
    )

# -------------Date range selector api----------------

def rainfall_date_range(request):
    """
    Return the minimum and maximum observation dates
    available in imd_rain_timeseries.
    """

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                MIN(observation_date),
                MAX(observation_date)
            FROM imd_rain_timeseries
        """)

        min_date, max_date = cursor.fetchone()

    if min_date is None or max_date is None:
        return JsonResponse(
            {
                "error": "No rainfall dates available."
            },
            status=404
        )

    return JsonResponse({
        "min_date": min_date.isoformat(),
        "max_date": max_date.isoformat()
    })
# --------------------------------------------------