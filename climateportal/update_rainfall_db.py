#!/usr/bin/env python3

"""
IMD Rainfall → PostgreSQL/PostGIS updater

Tables used:

    imd_rain_grid
    imd_rain_timeseries

IMPORTANT
---------
imd_rain_grid contains the Maharashtra subset:

    latitude  : 15.25 ... 22.50
    longitude : 72.25 ... 81.25

Its row_idx / col_idx are LOCAL Maharashtra indices:

    row_idx : 0 ... 29
    col_idx : 0 ... 36

The downloaded IMD GRD, however, is the FULL India grid:

    latitude  : 6.5 ... 38.5
    longitude : 66.5 ... 100.0

Therefore we MUST NOT directly use:

    rainfall_grid[row_idx, col_idx]

Instead we convert the database latitude/longitude to
the GLOBAL IMD GRD row/column.

For example:

    DB:
        latitude  = 19.00
        longitude = 75.75

    IMD GRD:
        row = (19.00 - 6.5) / 0.25 = 50
        col = (75.75 - 66.5) / 0.25 = 37

    Correct:
        rainfall_grid[50, 37]

Workflow:

    1. Read latest observation_date
    2. Determine missing dates up to yesterday
    3. Download each day's IMD 0.25° rainfall GRD
    4. Read 129 × 135 float32 values
    5. Convert DB latitude/longitude to global IMD indices
    6. Build one PostgreSQL array of 1110 values
    7. Insert one row per day
    8. Commit after each successful day
"""

import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import requests
import psycopg2
from decouple import Config, RepositoryEnv


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

ENV_FILE = BASE_DIR / ".env"

DOWNLOAD_DIR = (
    BASE_DIR
    / "data"
    / "rain_realtime"
)

DOWNLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# LOAD .ENV
# ============================================================

if not ENV_FILE.exists():

    raise FileNotFoundError(
        f".env file not found:\n{ENV_FILE}"
    )

config = Config(
    RepositoryEnv(str(ENV_FILE))
)


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_CONFIG = {
    "host": config("DB_HOST"),
    "port": config("DB_PORT", cast=int),
    "database": config("DB_NAME"),
    "user": config("DB_USER"),
    "password": config("DB_PASSWORD"),
}


# ============================================================
# IMD CONFIGURATION
# ============================================================

IMD_RAIN_URL = (
    "https://imdpune.gov.in/"
    "cmpg/Realtimedata/Rainfall/rain.php"
)


# ============================================================
# FULL IMD GRD
# ============================================================

# Full IMD rainfall GRD dimensions

IMD_LAT_SIZE = 129
IMD_LON_SIZE = 135


# Full IMD grid origin

IMD_MIN_LAT = 6.5
IMD_MIN_LON = 66.5


# IMD resolution

IMD_RESOLUTION = 0.25


# Expected number of float32 values

IMD_EXPECTED_VALUES = (
    IMD_LAT_SIZE
    * IMD_LON_SIZE
)


# Each float32 = 4 bytes

IMD_EXPECTED_BYTES = (
    IMD_EXPECTED_VALUES
    * 4
)


# ============================================================
# HTTP SESSION
# ============================================================

SESSION = requests.Session()

SESSION.headers.update(
    {
        "User-Agent": (
            "Mozilla/5.0 "
            "(X11; Linux x86_64) "
            "AppleWebKit/537.36 "
            "Chrome/149.0 Safari/537.36"
        )
    }
)


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db_connection():

    print("\nConnecting to PostgreSQL...")

    connection = psycopg2.connect(
        **DB_CONFIG
    )

    print(
        "Database connection successful."
    )

    return connection


# ============================================================
# GET LATEST DATE
# ============================================================

def get_latest_date(connection):

    sql = """
        SELECT MAX(observation_date)
        FROM imd_rain_timeseries;
    """

    with connection.cursor() as cursor:

        cursor.execute(sql)

        result = cursor.fetchone()

    latest_date = result[0]

    if latest_date is None:

        print(
            "No existing rainfall data found "
            "in imd_rain_timeseries."
        )

    else:

        print(
            "Latest rainfall date in database: "
            f"{latest_date}"
        )

    return latest_date


# ============================================================
# LOAD IMD GRID
# ============================================================

def load_imd_grid(connection):

    print("\nLoading imd_rain_grid...")

    sql = """
        SELECT
            grid_id,
            row_idx,
            col_idx,
            latitude,
            longitude,
            array_index
        FROM imd_rain_grid
        ORDER BY array_index;
    """

    with connection.cursor() as cursor:

        cursor.execute(sql)

        rows = cursor.fetchall()

    if not rows:

        raise RuntimeError(
            "imd_rain_grid contains no records."
        )

    print(
        f"Loaded {len(rows)} grid records."
    )

    # --------------------------------------------------------
    # Validate expected Maharashtra grid
    # --------------------------------------------------------

    if len(rows) != 1110:

        print(
            "WARNING: Expected 1110 Maharashtra "
            f"grid cells, but found {len(rows)}."
        )

    # --------------------------------------------------------
    # Print coordinate/index range
    # --------------------------------------------------------

    row_indices = [
        int(row[1])
        for row in rows
    ]

    col_indices = [
        int(row[2])
        for row in rows
    ]

    latitudes = [
        float(row[3])
        for row in rows
    ]

    longitudes = [
        float(row[4])
        for row in rows
    ]

    print(
        "DB row_idx range: "
        f"{min(row_indices)} - "
        f"{max(row_indices)}"
    )

    print(
        "DB col_idx range: "
        f"{min(col_indices)} - "
        f"{max(col_indices)}"
    )

    print(
        "DB latitude range: "
        f"{min(latitudes)} - "
        f"{max(latitudes)}"
    )

    print(
        "DB longitude range: "
        f"{min(longitudes)} - "
        f"{max(longitudes)}"
    )

    return rows


# ============================================================
# CONVERT DB COORDINATE → IMD GRD INDEX
# ============================================================

def coordinate_to_imd_index(
    latitude,
    longitude
):

    """
    Convert a database grid coordinate into
    the global IMD 129 × 135 GRD index.

    IMD GRD:

        latitude  starts at 6.5
        longitude starts at 66.5
        resolution = 0.25°

    Example:

        latitude  = 19.00
        longitude = 75.75

        row = (19.00 - 6.5) / 0.25
            = 50

        col = (75.75 - 66.5) / 0.25
            = 37
    """

    row_float = (
        float(latitude)
        - IMD_MIN_LAT
    ) / IMD_RESOLUTION

    col_float = (
        float(longitude)
        - IMD_MIN_LON
    ) / IMD_RESOLUTION

    # --------------------------------------------------------
    # Coordinates should fall exactly on the 0.25° grid.
    #
    # round() protects against floating point values such as:
    #
    # 36.999999999
    # --------------------------------------------------------

    row_idx = int(
        round(row_float)
    )

    col_idx = int(
        round(col_float)
    )

    # --------------------------------------------------------
    # Validate against full IMD GRD
    # --------------------------------------------------------

    if not (
        0 <= row_idx < IMD_LAT_SIZE
    ):

        raise RuntimeError(
            "Calculated IMD row index is outside "
            "the GRD.\n"
            f"Latitude: {latitude}\n"
            f"Calculated row: {row_idx}\n"
            f"Expected: 0-{IMD_LAT_SIZE - 1}"
        )

    if not (
        0 <= col_idx < IMD_LON_SIZE
    ):

        raise RuntimeError(
            "Calculated IMD column index is outside "
            "the GRD.\n"
            f"Longitude: {longitude}\n"
            f"Calculated col: {col_idx}\n"
            f"Expected: 0-{IMD_LON_SIZE - 1}"
        )

    # --------------------------------------------------------
    # Verify coordinate alignment
    # --------------------------------------------------------

    calculated_lat = (
        IMD_MIN_LAT
        + row_idx * IMD_RESOLUTION
    )

    calculated_lon = (
        IMD_MIN_LON
        + col_idx * IMD_RESOLUTION
    )

    if abs(
        calculated_lat
        - float(latitude)
    ) > 0.001:

        raise RuntimeError(
            "Latitude does not align with "
            "IMD 0.25° grid.\n"
            f"Database latitude: {latitude}\n"
            f"Calculated latitude: {calculated_lat}"
        )

    if abs(
        calculated_lon
        - float(longitude)
    ) > 0.001:

        raise RuntimeError(
            "Longitude does not align with "
            "IMD 0.25° grid.\n"
            f"Database longitude: {longitude}\n"
            f"Calculated longitude: {calculated_lon}"
        )

    return row_idx, col_idx


# ============================================================
# DOWNLOAD IMD RAINFALL
# ============================================================

def download_imd_rainfall(
    observation_date,
    max_retries=3
):

    """
    Download one day's IMD rainfall GRD file.

    IMD expects:

        POST rain=DDMMYYYY
    """

    filename = (
        f"rain_ind0.25_"
        f"{observation_date.strftime('%y_%m_%d')}"
        f".grd"
    )

    filepath = (
        DOWNLOAD_DIR
        / filename
    )

    # --------------------------------------------------------
    # Already downloaded
    # --------------------------------------------------------

    if filepath.exists():

        file_size = filepath.stat().st_size

        if file_size == IMD_EXPECTED_BYTES:

            print(
                f"  File already exists: "
                f"{filename}"
            )

            return filepath

        else:

            print(
                "  Existing file has wrong size "
                f"({file_size} bytes). "
                "Removing it."
            )

            filepath.unlink()


    # --------------------------------------------------------
    # Retry loop
    # --------------------------------------------------------

    for attempt in range(
        1,
        max_retries + 1
    ):

        print(
            f"  Downloading IMD rainfall "
            f"for {observation_date} "
            f"(attempt "
            f"{attempt}/{max_retries})"
        )

        try:

            response = SESSION.post(
                IMD_RAIN_URL,
                data={
                    "rain":
                    observation_date.strftime(
                        "%d%m%Y"
                    )
                },
                timeout=120
            )

            response.raise_for_status()

            content_length = len(
                response.content
            )

            print(
                "  HTTP status: "
                f"{response.status_code}"
            )

            print(
                "  Downloaded: "
                f"{content_length} bytes"
            )

            # ------------------------------------------------
            # Empty response
            # ------------------------------------------------

            if content_length == 0:

                raise RuntimeError(
                    "IMD returned an empty file."
                )

            # ------------------------------------------------
            # Check expected file size
            # ------------------------------------------------

            if (
                content_length
                != IMD_EXPECTED_BYTES
            ):

                raise RuntimeError(
                    "Unexpected IMD file size: "
                    f"{content_length} bytes. "
                    f"Expected "
                    f"{IMD_EXPECTED_BYTES} bytes."
                )

            # ------------------------------------------------
            # Save
            # ------------------------------------------------

            filepath.write_bytes(
                response.content
            )

            print(
                f"  Saved: {filepath}"
            )

            return filepath

        except Exception as exc:

            print(
                f"  Download failed: {exc}"
            )

            if attempt < max_retries:

                print(
                    "  Retrying in "
                    "10 seconds..."
                )

                time.sleep(10)

            else:

                raise RuntimeError(
                    "Unable to download IMD "
                    f"rainfall for "
                    f"{observation_date}"
                ) from exc


# ============================================================
# READ GRD FILE
# ============================================================

def read_imd_grd(filepath):

    """
    Read IMD binary rainfall file.

    Format:

        float32

    Shape:

        129 × 135
    """

    print(
        f"  Reading GRD: "
        f"{filepath.name}"
    )

    data = np.fromfile(
        filepath,
        dtype=np.float32
    )

    print(
        f"  Values read: {len(data)}"
    )

    # --------------------------------------------------------
    # Validate number of values
    # --------------------------------------------------------

    if (
        len(data)
        != IMD_EXPECTED_VALUES
    ):

        raise RuntimeError(
            "Invalid IMD rainfall file.\n"
            f"Found {len(data)} values.\n"
            f"Expected "
            f"{IMD_EXPECTED_VALUES}."
        )

    # --------------------------------------------------------
    # Reshape
    # --------------------------------------------------------

    data = data.reshape(
        (
            IMD_LAT_SIZE,
            IMD_LON_SIZE
        )
    )

    print(
        f"  Grid shape: {data.shape}"
    )

    return data


# ============================================================
# BUILD RAINFALL ARRAY
# ============================================================

def build_rainfall_array(
    rainfall_grid,
    grid_rows
):

    """
    Convert the full IMD 129 × 135 rainfall
    grid into the PostgreSQL array used by
    imd_rain_timeseries.

    IMPORTANT:

    imd_rain_grid.row_idx / col_idx are
    LOCAL Maharashtra indices.

    Therefore they are NOT used directly
    against rainfall_grid.

    We use latitude/longitude instead.
    """

    number_of_db_grids = len(
        grid_rows
    )

    # --------------------------------------------------------
    # PostgreSQL array
    #
    # Start with -999 for missing values.
    # --------------------------------------------------------

    values = np.full(
        number_of_db_grids,
        -999.0,
        dtype=np.float32
    )

    # --------------------------------------------------------
    # Statistics
    # --------------------------------------------------------

    valid_count = 0
    missing_count = 0

    # --------------------------------------------------------
    # Process every DB grid cell
    # --------------------------------------------------------

    for row in grid_rows:

        (
            grid_id,
            db_row_idx,
            db_col_idx,
            latitude,
            longitude,
            array_index,
        ) = row

        grid_id = int(grid_id)
        db_row_idx = int(db_row_idx)
        db_col_idx = int(db_col_idx)
        array_index = int(array_index)

        latitude = float(latitude)
        longitude = float(longitude)

        # ----------------------------------------------------
        # Validate PostgreSQL array index
        # ----------------------------------------------------

        if not (
            1 <= array_index
            <= number_of_db_grids
        ):

            raise RuntimeError(
                "Invalid array_index="
                f"{array_index} "
                f"for grid_id={grid_id}"
            )

        # ----------------------------------------------------
        # Convert DB coordinate to GLOBAL IMD index
        # ----------------------------------------------------

        imd_row_idx, imd_col_idx = (
            coordinate_to_imd_index(
                latitude,
                longitude
            )
        )

        # ----------------------------------------------------
        # Read correct IMD rainfall cell
        # ----------------------------------------------------

        value = rainfall_grid[
            imd_row_idx,
            imd_col_idx
        ]

        # ----------------------------------------------------
        # Convert invalid values to -999
        # ----------------------------------------------------

        if (
            not np.isfinite(value)
            or value < 0
        ):

            values[
                array_index - 1
            ] = -999.0

            missing_count += 1

        else:

            values[
                array_index - 1
            ] = float(value)

            valid_count += 1

    # --------------------------------------------------------
    # Print statistics
    # --------------------------------------------------------

    print(
        f"  DB grid cells: "
        f"{number_of_db_grids}"
    )

    print(
        f"  Valid Maharashtra cells: "
        f"{valid_count}"
    )

    print(
        f"  Missing Maharashtra cells: "
        f"{missing_count}"
    )

    # --------------------------------------------------------
    # IMPORTANT VALIDATION
    #
    # If an IMD rainfall file has valid data but
    # absolutely none of the Maharashtra cells
    # are valid, something is wrong.
    # --------------------------------------------------------

    if valid_count == 0:

        raise RuntimeError(
            "No valid rainfall values found "
            "for any imd_rain_grid cell."
        )

    return values.tolist()


# ============================================================
# INSERT DAILY DATA
# ============================================================

def insert_rainfall(
    connection,
    observation_date,
    rainfall_values
):

    """
    Insert one day's rainfall array.

    ON CONFLICT protects against
    accidental duplicate insertion.
    """

    sql = """
        INSERT INTO imd_rain_timeseries
        (
            observation_date,
            grid_values,
            created_at
        )
        VALUES
        (
            %s,
            %s,
            NOW()
        )
        ON CONFLICT (observation_date)
        DO NOTHING;
    """

    with connection.cursor() as cursor:

        cursor.execute(
            sql,
            (
                observation_date,
                rainfall_values
            )
        )

        inserted = (
            cursor.rowcount == 1
        )

    return inserted


# ============================================================
# PROCESS ONE DATE
# ============================================================

def process_date(
    connection,
    observation_date,
    grid_rows
):

    print(
        "\n"
        + "=" * 60
    )

    print(
        f"Processing: "
        f"{observation_date}"
    )

    print(
        "=" * 60
    )

    # --------------------------------------------------------
    # Download
    # --------------------------------------------------------

    filepath = download_imd_rainfall(
        observation_date
    )

    # --------------------------------------------------------
    # Read binary
    # --------------------------------------------------------

    rainfall_grid = read_imd_grd(
        filepath
    )

    # --------------------------------------------------------
    # Full GRD statistics
    # --------------------------------------------------------

    valid = rainfall_grid[
        (
            np.isfinite(
                rainfall_grid
            )
        )
        &
        (
            rainfall_grid >= 0
        )
    ]

    if len(valid) > 0:

        print(
            f"  Full IMD valid values: "
            f"{len(valid)}"
        )

        print(
            f"  Full IMD minimum rainfall: "
            f"{float(valid.min()):.3f} mm"
        )

        print(
            f"  Full IMD maximum rainfall: "
            f"{float(valid.max()):.3f} mm"
        )

        print(
            f"  Full IMD mean rainfall: "
            f"{float(valid.mean()):.3f} mm"
        )

    else:

        raise RuntimeError(
            "Downloaded IMD GRD contains "
            "no valid rainfall values."
        )

    # --------------------------------------------------------
    # Build DB array
    # --------------------------------------------------------

    rainfall_values = (
        build_rainfall_array(
            rainfall_grid,
            grid_rows
        )
    )

    print(
        f"  DB array length: "
        f"{len(rainfall_values)}"
    )

    # --------------------------------------------------------
    # IMPORTANT SAMPLE CHECK
    #
    # Rajkapur cells:
    #
    # array 570 = 19.00, 75.75
    # array 571 = 19.00, 76.00
    # --------------------------------------------------------

    if len(rainfall_values) >= 571:

        rajkapur_570 = (
            rainfall_values[569]
        )

        rajkapur_571 = (
            rainfall_values[570]
        )

        print(
            "  Rajkapur test cells:"
        )

        print(
            "    array_index 570 "
            f"(19.00,75.75): "
            f"{rajkapur_570}"
        )

        print(
            "    array_index 571 "
            f"(19.00,76.00): "
            f"{rajkapur_571}"
        )

    # --------------------------------------------------------
    # Insert
    # --------------------------------------------------------

    inserted = insert_rainfall(
        connection,
        observation_date,
        rainfall_values
    )

    if inserted:

        print(
            "  INSERTED: "
            f"{observation_date}"
        )

    else:

        print(
            "  Already exists: "
            f"{observation_date}"
        )

    return inserted


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n")
    print("=" * 60)
    print("IMD RAINFALL DATABASE UPDATER")
    print("=" * 60)

    print(
        f"Started: "
        f"{datetime.now()}"
    )

    print(
        f"Download directory: "
        f"{DOWNLOAD_DIR}"
    )

    print(
        "\nIMPORTANT:"
    )

    print(
        "Using DB latitude/longitude → "
        "global IMD GRD index mapping."
    )

    print(
        "DB row_idx/col_idx are NOT used "
        "directly against the full IMD GRD."
    )

    connection = None

    try:

        # ----------------------------------------------------
        # Connect DB
        # ----------------------------------------------------

        connection = (
            get_db_connection()
        )

        # ----------------------------------------------------
        # Latest DB date
        # ----------------------------------------------------

        latest_date = (
            get_latest_date(
                connection
            )
        )

        # ----------------------------------------------------
        # Yesterday
        # ----------------------------------------------------

        yesterday = (
            datetime.now().date()
            - timedelta(days=1)
        )

        print(
            f"Target end date: "
            f"{yesterday}"
        )

        # ----------------------------------------------------
        # Determine start date
        # ----------------------------------------------------

        if latest_date is None:

            raise RuntimeError(
                "Database contains no rainfall "
                "records.\n"
                "Please insert the historical "
                "dataset through 2025-12-31 "
                "before running the automatic "
                "updater."
            )

        start_date = (
            latest_date
            + timedelta(days=1)
        )

        # ----------------------------------------------------
        # Already up to date
        # ----------------------------------------------------

        if start_date > yesterday:

            print("\n")
            print(
                "Dataset is already up to date."
            )

            print(
                f"Latest date: "
                f"{latest_date}"
            )

            print(
                f"Yesterday:   "
                f"{yesterday}"
            )

            connection.close()

            return 0

        # ----------------------------------------------------
        # Missing dates
        # ----------------------------------------------------

        number_of_days = (
            yesterday - start_date
        ).days + 1

        print(
            "\nMissing rainfall dates: "
            f"{number_of_days}"
        )

        print(
            f"From: {start_date}"
        )

        print(
            f"To:   {yesterday}"
        )

        # ----------------------------------------------------
        # Load DB grid
        # ----------------------------------------------------

        grid_rows = (
            load_imd_grid(
                connection
            )
        )

        # ----------------------------------------------------
        # Process every missing date
        # ----------------------------------------------------

        inserted_count = 0

        current_date = start_date

        while current_date <= yesterday:

            try:

                inserted = process_date(
                    connection,
                    current_date,
                    grid_rows
                )

                if inserted:

                    inserted_count += 1

                    # ------------------------------------------------
                    # Commit after EACH successful day.
                    # ------------------------------------------------

                    connection.commit()

                    print(
                        "  Database commit "
                        "successful."
                    )

            except Exception as exc:

                print("\n")
                print(
                    "ERROR while processing "
                    f"{current_date}"
                )

                print(
                    str(exc)
                )

                connection.rollback()

                raise

            current_date += timedelta(
                days=1
            )

        # ----------------------------------------------------
        # Final result
        # ----------------------------------------------------

        print("\n")
        print("=" * 60)
        print("UPDATE COMPLETED")
        print("=" * 60)

        print(
            f"Dates inserted: "
            f"{inserted_count}"
        )

        print(
            f"Latest processed date: "
            f"{yesterday}"
        )

        print(
            f"Finished: "
            f"{datetime.now()}"
        )

        return 0

    except KeyboardInterrupt:

        print("\n")
        print(
            "Updater interrupted by user."
        )

        if connection:

            connection.rollback()

        return 1

    except Exception as exc:

        print("\n")
        print("=" * 60)
        print("UPDATE FAILED")
        print("=" * 60)

        print(
            f"Error: {exc}"
        )

        if connection:

            connection.rollback()

        return 1

    finally:

        if connection:

            connection.close()

            print(
                "Database connection closed."
            )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    sys.exit(main())
