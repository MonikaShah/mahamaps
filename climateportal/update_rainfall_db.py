#!/usr/bin/env python3

"""
IMD Rainfall → PostgreSQL/PostGIS updater

Tables used:

    imd_rain_grid
    imd_rain_timeseries

Workflow:

    1. Read latest observation_date from imd_rain_timeseries
    2. Determine missing dates up to yesterday
    3. Download each day's IMD 0.25° rainfall GRD file
    4. Read 129 × 135 float32 values
    5. Match IMD latitude/longitude with imd_rain_grid
    6. Build one PostgreSQL array per day
    7. Insert into imd_rain_timeseries
    8. Avoid duplicate dates
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

DOWNLOAD_DIR = BASE_DIR / "data" / "rain_realtime"

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


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


# IMD rainfall grid
#
# Latitude:
#     6.5 → 38.5
#     129 points
#
# Longitude:
#     66.5 → 100.0
#     135 points

IMD_LAT_SIZE = 129
IMD_LON_SIZE = 135

IMD_EXPECTED_VALUES = (
    IMD_LAT_SIZE * IMD_LON_SIZE
)

IMD_EXPECTED_BYTES = (
    IMD_EXPECTED_VALUES * 4
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

    print("Database connection successful.")

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
            f"Latest rainfall date in database: "
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

    return rows


# ============================================================
# CREATE GRID MAPPING
# ============================================================

def create_grid_mapping(grid_rows):

    """
    Create mapping:

        (row_idx, col_idx)
                ↓
        array_index

    PostgreSQL arrays are 1-based.

    Python arrays are 0-based.

    Therefore:

        Python index = array_index - 1
    """

    mapping = {}

    for row in grid_rows:

        (
            grid_id,
            row_idx,
            col_idx,
            latitude,
            longitude,
            array_index,
        ) = row

        mapping[
            (int(row_idx), int(col_idx))
        ] = int(array_index)

    return mapping


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

    filepath = DOWNLOAD_DIR / filename

    # --------------------------------------------------------
    # Already downloaded?
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
                f"  Existing file has wrong size "
                f"({file_size} bytes). "
                f"Removing it."
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
            f"(attempt {attempt}/{max_retries})"
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
                f"  HTTP status: "
                f"{response.status_code}"
            )

            print(
                f"  Downloaded: "
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

            if content_length != IMD_EXPECTED_BYTES:

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
                    "  Retrying in 10 seconds..."
                )

                time.sleep(10)

            else:

                raise RuntimeError(
                    f"Unable to download IMD "
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
        f"  Reading GRD: {filepath.name}"
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

    if len(data) != IMD_EXPECTED_VALUES:

        raise RuntimeError(
            "Invalid IMD rainfall file.\n"
            f"Found {len(data)} values.\n"
            f"Expected {IMD_EXPECTED_VALUES}."
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
    Convert IMD 129 × 135 grid into the
    PostgreSQL array expected by
    imd_rain_timeseries.grid_values.

    Mapping is based on row_idx / col_idx.

    PostgreSQL array:

        array_index = 1 → Python list index 0
        array_index = 2 → Python list index 1
        etc.
    """

    number_of_db_grids = len(
        grid_rows
    )

    values = np.full(
        number_of_db_grids,
        -999.0,
        dtype=np.float32
    )

    # --------------------------------------------------------
    # Create latitude/longitude arrays
    # --------------------------------------------------------

    # IMD data is stored as:
    #
    # latitude:
    #     6.5 ... 38.5
    #
    # longitude:
    #     66.5 ... 100.0

    # --------------------------------------------------------
    # Map every DB grid cell
    # --------------------------------------------------------

    for row in grid_rows:

        (
            grid_id,
            row_idx,
            col_idx,
            latitude,
            longitude,
            array_index,
        ) = row

        row_idx = int(row_idx)
        col_idx = int(col_idx)
        array_index = int(array_index)

        # ----------------------------------------------------
        # Safety check
        # ----------------------------------------------------

        if not (
            0 <= row_idx < IMD_LAT_SIZE
        ):

            raise RuntimeError(
                f"Invalid row_idx={row_idx} "
                f"for grid_id={grid_id}"
            )

        if not (
            0 <= col_idx < IMD_LON_SIZE
        ):

            raise RuntimeError(
                f"Invalid col_idx={col_idx} "
                f"for grid_id={grid_id}"
            )

        if not (
            1 <= array_index <= number_of_db_grids
        ):

            raise RuntimeError(
                f"Invalid array_index="
                f"{array_index} "
                f"for grid_id={grid_id}"
            )

        value = rainfall_grid[
            row_idx,
            col_idx
        ]

        # ----------------------------------------------------
        # Convert invalid values
        # ----------------------------------------------------

        if (
            np.isnan(value)
            or np.isinf(value)
            or value < 0
        ):

            value = -999.0

        # ----------------------------------------------------
        # PostgreSQL array is 1-based
        # Python list is 0-based
        # ----------------------------------------------------

        values[
            array_index - 1
        ] = float(value)

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
        f"Processing: {observation_date}"
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
    # Some useful statistics
    # --------------------------------------------------------

    valid = rainfall_grid[
        (
            np.isfinite(rainfall_grid)
        )
        &
        (
            rainfall_grid >= 0
        )
    ]

    if len(valid) > 0:

        print(
            f"  Valid values: {len(valid)}"
        )

        print(
            f"  Minimum rainfall: "
            f"{float(valid.min()):.3f} mm"
        )

        print(
            f"  Maximum rainfall: "
            f"{float(valid.max()):.3f} mm"
        )

        print(
            f"  Mean rainfall: "
            f"{float(valid.mean()):.3f} mm"
        )

    # --------------------------------------------------------
    # Build DB array
    # --------------------------------------------------------

    rainfall_values = build_rainfall_array(
        rainfall_grid,
        grid_rows
    )

    print(
        f"  DB array length: "
        f"{len(rainfall_values)}"
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
            f"  INSERTED: "
            f"{observation_date}"
        )

    else:

        print(
            f"  Already exists: "
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

    connection = None

    try:

        # ----------------------------------------------------
        # Connect DB
        # ----------------------------------------------------

        connection = get_db_connection()

        # ----------------------------------------------------
        # Latest DB date
        # ----------------------------------------------------

        latest_date = get_latest_date(
            connection
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
                "Please decide the initial "
                "historical start date before "
                "running the automatic updater."
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
                f"Latest date: {latest_date}"
            )

            print(
                f"Yesterday:   {yesterday}"
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
            f"\nMissing rainfall dates: "
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

        grid_rows = load_imd_grid(
            connection
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

                    # Commit after EACH successful day.
                    #
                    # This is safer than waiting until
                    # all dates finish. If day 3 succeeds
                    # and day 4 fails, days 1-3 remain saved.

                    connection.commit()

                    print(
                        f"  Database commit successful."
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

                # ------------------------------------------------
                # Roll back failed transaction
                # ------------------------------------------------

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