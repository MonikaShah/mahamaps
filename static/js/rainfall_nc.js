// ============================================================
// RAINFALL MONITORING - VILLAGE TIME SERIES
// IMD NETCDF DATA
//
// HIGHSTOCK VERSION
//
// IMPORTANT
// ------------------------------------------------------------
// location_filter.js owns:
//     districtSelect
//     talukaSelect
//     villageSelect
//
// DO NOT declare those variables here.
//
// This file owns:
//     map
//     village marker
//     village boundary
//     rainfall grid display
//     rainfall API request
//     Highstock rainfall chart
//
// CHART RULES
// ------------------------------------------------------------
// <= 60 days:
//     Daily rainfall columns
//
// > 60 days and <= 5 years:
//     Monthly rainfall totals
//
// > 5 years:
//     Annual rainfall totals
//
// Highstock navigator + scrollbar are enabled.
// ============================================================


console.log("==============================================");
console.log("rainfall_nc.js loaded - HIGHSTOCK VERSION");
console.log("==============================================");


// ============================================================
// GLOBAL STATE
// ============================================================

let selectedDistrictName = null;

let selectedTehsilName = null;


// ------------------------------------------------------------
// MAP
// ------------------------------------------------------------

let rainfallMap = null;

let statesWMS = null;


// ------------------------------------------------------------
// VILLAGE
// ------------------------------------------------------------

let villageMarker = null;

let villageBoundaryLayer = null;


// ------------------------------------------------------------
// GRID
// ------------------------------------------------------------

let rainfallGridLayer = null;

let selectedGrid = null;


// ------------------------------------------------------------
// API REQUEST
// ------------------------------------------------------------

let rainfallRequestController = null;

let rainfallRequestSequence = 0;


// ------------------------------------------------------------
// SELECTED VILLAGE
// ------------------------------------------------------------

let selectedVillageId = null;

let selectedVillageName = null;

let selectedLatitude = null;

let selectedLongitude = null;


// ------------------------------------------------------------
// RAINFALL DATA
// ------------------------------------------------------------

let rainfallData = [];


// ------------------------------------------------------------
// DATABASE DATE RANGE
// ------------------------------------------------------------

let MIN_RAINFALL_DATE = null;

let MAX_RAINFALL_DATE = null;


// ------------------------------------------------------------
// HIGHSTOCK INSTANCE
// ------------------------------------------------------------

let rainfallHighstock = null;


// ------------------------------------------------------------
// CURRENT CHART DATA
// ------------------------------------------------------------

let rainfallDailySeries = [];

let rainfallMonthlySeries = [];

let rainfallAnnualSeries = [];


// ------------------------------------------------------------
// CHART MODE
// ------------------------------------------------------------

let rainfallCurrentMode = "day";


// ============================================================
// CONSTANTS
// ============================================================

const RAINFALL_DATE_RANGE_API =
    "/rainfall-date-range/";


const RAINFALL_API =
    "/village-rainfall-timeseries/";


// ============================================================
// CHART THRESHOLDS
// ============================================================

const RAINFALL_DAILY_THRESHOLD_DAYS =
    60;


const RAINFALL_ANNUAL_THRESHOLD_DAYS =
    365 * 5;


const RAINFALL_ONE_DAY =
    24 * 60 * 60 * 1000;


// ============================================================
// DOM ELEMENTS
// ============================================================

const rainfallMapElement =
    document.getElementById("map");


const startDateElement =
    document.getElementById("startDate");


const endDateElement =
    document.getElementById("endDate");


const selectedGridInfoElement =
    document.getElementById("selectedGridInfo");


const timeseriesMessageElement =
    document.getElementById("timeseriesMessage");


const rainfallCheckElement =
    document.getElementById("rainfallCheck");


const gridCheckElement =
    document.getElementById("gridCheck");


// ============================================================
// INITIALIZE MAP
// ============================================================

if (!rainfallMapElement) {

    console.error(
        "Rainfall map container #map not found."
    );

} else {

    initializeRainfallMap();

}


// ============================================================
// INITIALIZE RAINFALL MAP
// ============================================================

function initializeRainfallMap() {

    console.log(
        "Initializing rainfall map..."
    );


    rainfallMap =
        L.map(
            rainfallMapElement,
            {
                zoomControl: true,
                preferCanvas: false
            }
        );


    // --------------------------------------------------------
    // OpenStreetMap
    // --------------------------------------------------------

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 18,

            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(
        rainfallMap
    );


    // --------------------------------------------------------
    // State boundary WMS
    // --------------------------------------------------------

    statesWMS =
        L.tileLayer.wms(
            "https://geonode.communitygis.in/geoserver/geonode/wms",
            {
                layers:
                    "geonode:states_in_india",

                format:
                    "image/png",

                transparent:
                    true,

                version:
                    "1.1.1",

                tiled:
                    true,

                opacity:
                    1
            }
        );


    statesWMS.addTo(
        rainfallMap
    );


    // --------------------------------------------------------
    // Initial Maharashtra view
    // --------------------------------------------------------

    rainfallMap.setView(
        [
            19.7515,
            75.7139
        ],
        6
    );


    console.log(
        "Rainfall map initialized."
    );
}


// ============================================================
// LOAD AVAILABLE RAINFALL DATE RANGE FROM DATABASE
// ============================================================

async function loadRainfallDateRange() {

    try {

        console.log(
            "Loading rainfall database date range..."
        );


        const response =
            await fetch(
                RAINFALL_DATE_RANGE_API,
                {
                    method:
                        "GET",

                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const range =
            await response.json();


        console.log(
            "Rainfall date range API:",
            range
        );


        if (
            !range.min_date ||
            !range.max_date
        ) {

            throw new Error(
                "Invalid rainfall date range returned by API."
            );
        }


        MIN_RAINFALL_DATE =
            String(
                range.min_date
            ).substring(
                0,
                10
            );


        MAX_RAINFALL_DATE =
            String(
                range.max_date
            ).substring(
                0,
                10
            );


        console.log(
            "Rainfall DB date range:",
            MIN_RAINFALL_DATE,
            "to",
            MAX_RAINFALL_DATE
        );


        // ----------------------------------------------------
        // Update HTML date constraints
        // ----------------------------------------------------

        if (startDateElement) {

            startDateElement.min =
                MIN_RAINFALL_DATE;

            startDateElement.max =
                MAX_RAINFALL_DATE;


            // IMPORTANT:
            // Use database minimum date.
            //
            // This fixes the old problem where HTML had:
            // value="2023-01-01"
            //
            // even when DB contained earlier data.

            startDateElement.value =
                MIN_RAINFALL_DATE;
        }


        if (endDateElement) {

            endDateElement.min =
                MIN_RAINFALL_DATE;

            endDateElement.max =
                MAX_RAINFALL_DATE;


            // IMPORTANT:
            // Use database maximum date.

            endDateElement.value =
                MAX_RAINFALL_DATE;
        }


        console.log(
            "Date inputs updated from database."
        );

        console.log(
            "Start:",
            startDateElement
                ? startDateElement.value
                : null
        );

        console.log(
            "End:",
            endDateElement
                ? endDateElement.value
                : null
        );

    }
    catch (error) {

        console.error(
            "Could not load rainfall date range:",
            error
        );

    }

}


// ============================================================
// GET SELECTED DATE RANGE
// ============================================================

function getSelectedDateRange() {

    const start =
        startDateElement
            ? startDateElement.value
            : null;


    const end =
        endDateElement
            ? endDateElement.value
            : null;


    if (
        !start ||
        !end
    ) {

        return null;
    }


    // --------------------------------------------------------
    // Validate against database range
    // --------------------------------------------------------

    if (
        MIN_RAINFALL_DATE &&
        start < MIN_RAINFALL_DATE
    ) {

        console.warn(
            "Start date is before available rainfall data:",
            start
        );

        return null;
    }


    if (
        MAX_RAINFALL_DATE &&
        end > MAX_RAINFALL_DATE
    ) {

        console.warn(
            "End date is after available rainfall data:",
            end
        );

        return null;
    }


    if (
        start > end
    ) {

        console.warn(
            "Start date cannot be after end date."
        );

        return null;
    }


    return {

        start:
            start,

        end:
            end

    };
}


// ============================================================
// CLEAR VILLAGE MARKER
// ============================================================

function clearVillageMarker() {

    if (
        villageMarker &&
        rainfallMap &&
        rainfallMap.hasLayer(
            villageMarker
        )
    ) {

        rainfallMap.removeLayer(
            villageMarker
        );
    }


    villageMarker = null;
}


// ============================================================
// CLEAR VILLAGE BOUNDARY
// ============================================================

function clearVillageBoundary() {

    if (
        villageBoundaryLayer &&
        rainfallMap &&
        rainfallMap.hasLayer(
            villageBoundaryLayer
        )
    ) {

        rainfallMap.removeLayer(
            villageBoundaryLayer
        );
    }


    villageBoundaryLayer = null;
}


// ============================================================
// CLEAR GRID
// ============================================================

function clearRainfallGrid() {

    if (
        rainfallGridLayer &&
        rainfallMap &&
        rainfallMap.hasLayer(
            rainfallGridLayer
        )
    ) {

        rainfallMap.removeLayer(
            rainfallGridLayer
        );
    }


    rainfallGridLayer = null;
}


// ============================================================
// CLEAR ALL VILLAGE LAYERS
// ============================================================

function clearVillageLayers() {

    clearVillageMarker();

    clearVillageBoundary();

    clearRainfallGrid();


    selectedGrid =
        null;


    selectedLatitude =
        null;


    selectedLongitude =
        null;
}


// ============================================================
// GEOJSON CENTROID FALLBACK
// ============================================================

function getGeometryCentroid(
    geometry
) {

    if (
        !geometry ||
        !geometry.coordinates
    ) {

        return null;
    }


    let sumLon = 0;

    let sumLat = 0;

    let count = 0;


    function walk(
        coordinates
    ) {

        if (
            !Array.isArray(
                coordinates
            )
        ) {

            return;
        }


        if (
            coordinates.length >= 2 &&
            typeof coordinates[0] === "number" &&
            typeof coordinates[1] === "number"
        ) {

            sumLon +=
                coordinates[0];

            sumLat +=
                coordinates[1];

            count++;

            return;
        }


        for (
            let i = 0;
            i < coordinates.length;
            i++
        ) {

            walk(
                coordinates[i]
            );
        }
    }


    walk(
        geometry.coordinates
    );


    if (
        count === 0
    ) {

        return null;
    }


    return {

        longitude:
            sumLon / count,

        latitude:
            sumLat / count

    };
}


// ============================================================
// EXTRACT VILLAGE ID
// ============================================================

function extractVillageId(
    data
) {

    if (
        data &&
        data.village_id !== undefined &&
        data.village_id !== null
    ) {

        const id =
            Number(
                data.village_id
            );


        if (
            Number.isFinite(id)
        ) {

            return id;
        }
    }


    if (
        data &&
        Array.isArray(
            data.features
        ) &&
        data.features.length > 0
    ) {

        const properties =
            data.features[0].properties ||
            {};


        const possibleId =
            properties.village_id ??
            properties.id;


        if (
            possibleId !== undefined &&
            possibleId !== null
        ) {

            const id =
                Number(
                    possibleId
                );


            if (
                Number.isFinite(id)
            ) {

                return id;
            }
        }
    }


    return null;
}


// ============================================================
// EXTRACT VILLAGE COORDINATES
// ============================================================

function extractVillageCoordinates(
    data
) {

    // --------------------------------------------------------
    // Direct coordinates
    // --------------------------------------------------------

    if (
        data &&
        data.latitude !== undefined &&
        data.longitude !== undefined
    ) {

        const latitude =
            Number(
                data.latitude
            );


        const longitude =
            Number(
                data.longitude
            );


        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {

            return {

                latitude:
                    latitude,

                longitude:
                    longitude

            };
        }
    }


    // --------------------------------------------------------
    // Feature coordinates
    // --------------------------------------------------------

    if (
        data &&
        Array.isArray(
            data.features
        ) &&
        data.features.length > 0
    ) {

        const feature =
            data.features[0];


        const properties =
            feature.properties ||
            {};


        const latitude =
            Number(
                properties.latitude ??
                properties.lat ??
                properties.y
            );


        const longitude =
            Number(
                properties.longitude ??
                properties.lon ??
                properties.lng ??
                properties.x
            );


        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {

            return {

                latitude:
                    latitude,

                longitude:
                    longitude

            };
        }


        // ----------------------------------------------------
        // Geometry fallback
        // ----------------------------------------------------

        if (
            feature.geometry
        ) {

            const centroid =
                getGeometryCentroid(
                    feature.geometry
                );


            if (
                centroid
            ) {

                return centroid;
            }
        }
    }


    // --------------------------------------------------------
    // Direct geometry fallback
    // --------------------------------------------------------

    if (
        data &&
        data.geometry
    ) {

        const centroid =
            getGeometryCentroid(
                data.geometry
            );


        if (
            centroid
        ) {

            return centroid;
        }
    }


    return null;
}


// ============================================================
// DRAW VILLAGE BOUNDARY
// ============================================================

function drawVillageBoundary(
    data
) {

    clearVillageBoundary();


    if (
        !rainfallMap
    ) {

        return;
    }


    let geojson =
        null;


    // --------------------------------------------------------
    // FeatureCollection
    // --------------------------------------------------------

    if (
        data &&
        data.type === "FeatureCollection"
    ) {

        geojson =
            data;
    }


    // --------------------------------------------------------
    // Single Feature
    // --------------------------------------------------------

    else if (
        data &&
        data.type === "Feature"
    ) {

        geojson = {

            type:
                "FeatureCollection",

            features:
                [data]

        };
    }


    if (
        !geojson ||
        !Array.isArray(
            geojson.features
        ) ||
        geojson.features.length === 0
    ) {

        console.warn(
            "No valid village geometry."
        );

        return;
    }


    villageBoundaryLayer =
        L.geoJSON(
            geojson,
            {

                interactive:
                    false,

                style:
                    function () {

                        return {

                            color:
                                "#ff0000",

                            weight:
                                2,

                            opacity:
                                1,

                            fillColor:
                                "#ffcccc",

                            fillOpacity:
                                0.10

                        };

                    }

            }
        );


    villageBoundaryLayer.addTo(
        rainfallMap
    );


    villageBoundaryLayer.bringToFront();


    console.log(
        "Village boundary added."
    );
}


// ============================================================
// DRAW VILLAGE MARKER
// ============================================================

function drawVillageMarker(
    latitude,
    longitude,
    villageName
) {

    clearVillageMarker();


    villageMarker =
        L.circleMarker(
            [
                latitude,
                longitude
            ],
            {

                radius:
                    7,

                weight:
                    2,

                fillOpacity:
                    0.9

            }
        );


    villageMarker.bindPopup(
        `
        <strong>${escapeHtml(villageName)}</strong>
        <br>
        Latitude:
        ${latitude.toFixed(6)}
        <br>
        Longitude:
        ${longitude.toFixed(6)}
        `
    );


    villageMarker.addTo(
        rainfallMap
    );


    console.log(
        "Village marker added."
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ?? ""
        );


    return div.innerHTML;
}


// ============================================================
// DISPLAY GRID INFORMATION
// ============================================================

function displayGridInformation(
    grid
) {

    if (
        !selectedGridInfoElement
    ) {

        return;
    }


    if (
        !grid
    ) {

        selectedGridInfoElement.textContent =
            "No rainfall grid found.";

        return;
    }


    selectedGridInfoElement.innerHTML =

        `
        <strong>Selected Grid</strong>
        <br>
        Grid ID:
        ${escapeHtml(grid.grid_id)}
        <br>
        Array Index:
        ${escapeHtml(grid.array_index)}
        <br>
        Latitude:
        ${Number(grid.latitude).toFixed(3)}°
        <br>
        Longitude:
        ${Number(grid.longitude).toFixed(3)}°
        `;
}


// ============================================================
// DRAW RAINFALL GRID
// ============================================================

function drawRainfallGrid(
    gridCells
) {

    clearRainfallGrid();


    if (
        !rainfallMap
    ) {

        return;
    }


    if (
        !Array.isArray(
            gridCells
        ) ||
        gridCells.length === 0
    ) {

        console.log(
            "No rainfall grid cells returned."
        );

        return;
    }


    console.log(
        "Drawing grid cells:",
        gridCells.length
    );


    const layers = [];


    for (
        let i = 0;
        i < gridCells.length;
        i++
    ) {

        const grid =
            gridCells[i];


        const latitude =
            Number(
                grid.latitude
            );


        const longitude =
            Number(
                grid.longitude
            );


        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            continue;
        }


        // ----------------------------------------------------
        // IMD 0.25° grid
        // ----------------------------------------------------

        const half =
            0.125;


        const bounds =
            [

                [
                    latitude - half,
                    longitude - half
                ],

                [
                    latitude + half,
                    longitude + half
                ]

            ];


        const rectangle =
            L.rectangle(
                bounds,
                {

                    color:
                        "#0066cc",

                    weight:
                        1,

                    fill:
                        false,

                    interactive:
                        false

                }
            );


        layers.push(
            rectangle
        );
    }


    if (
        layers.length === 0
    ) {

        return;
    }


    rainfallGridLayer =
        L.layerGroup(
            layers
        );


    if (
        gridCheckElement &&
        gridCheckElement.checked === false
    ) {

        return;
    }


    rainfallGridLayer.addTo(
        rainfallMap
    );


    if (
        villageBoundaryLayer
    ) {

        villageBoundaryLayer.bringToFront();
    }


    if (
        villageMarker
    ) {

        villageMarker.bringToFront();
    }


    console.log(
        "Grid layer added:",
        layers.length,
        "cells"
    );
}


// ============================================================
// PARSE RAINFALL VALUE
// ============================================================

function parseRainfall(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;
    }


    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;
    }


    // --------------------------------------------------------
    // IMD missing-value handling
    //
    // -999, -9999 etc.
    // --------------------------------------------------------

    if (
        number <= -900
    ) {

        return null;
    }


    return number;
}


// ============================================================
// PARSE YYYY-MM-DD AS UTC
//
// IMPORTANT
// ------------------------------------------------------------
// We deliberately do not use:
//
// new Date("2023-01-01")
//
// for chart dates.
//
// Instead we explicitly create UTC timestamps.
// This avoids timezone shifting of rainfall dates.
// ============================================================

function rainfallDateToUTC(
    dateString
) {

    if (
        !dateString
    ) {

        return null;
    }


    const parts =
        String(
            dateString
        ).substring(
            0,
            10
        ).split("-");


    if (
        parts.length !== 3
    ) {

        return null;
    }


    const year =
        Number(
            parts[0]
        );


    const month =
        Number(
            parts[1]
        );


    const day =
        Number(
            parts[2]
        );


    if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day)
    ) {

        return null;
    }


    return Date.UTC(
        year,
        month - 1,
        day
    );
}


// ============================================================
// GET DATE RANGE IN DAYS
// ============================================================

function getRainfallRangeDays(
    data
) {

    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        return 0;
    }


    let minTime =
        null;


    let maxTime =
        null;


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const time =
            rainfallDateToUTC(
                data[i].date
            );


        if (
            time === null
        ) {

            continue;
        }


        if (
            minTime === null ||
            time < minTime
        ) {

            minTime =
                time;
        }


        if (
            maxTime === null ||
            time > maxTime
        ) {

            maxTime =
                time;
        }
    }


    if (
        minTime === null ||
        maxTime === null
    ) {

        return 0;
    }


    return (
        maxTime - minTime
    ) /
    RAINFALL_ONE_DAY;
}


// ============================================================
// AGGREGATE DAILY → MONTHLY
// ============================================================
//
// Missing rainfall values are NOT included.
//
// Monthly total = sum of valid daily rainfall.
// ============================================================

function aggregateMonthlyRainfall(
    data
) {

    const months =
        new Map();


    if (
        !Array.isArray(data)
    ) {

        return [];
    }


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const item =
            data[i];


        if (
            !item ||
            !item.date
        ) {

            continue;
        }


        const rainfall =
            parseRainfall(
                item.rainfall
            );


        if (
            rainfall === null
        ) {

            continue;
        }


        const dateParts =
            String(
                item.date
            ).substring(
                0,
                10
            ).split("-");


        if (
            dateParts.length !== 3
        ) {

            continue;
        }


        const year =
            Number(
                dateParts[0]
            );


        const month =
            Number(
                dateParts[1]
            );


        if (
            !Number.isFinite(year) ||
            !Number.isFinite(month) ||
            month < 1 ||
            month > 12
        ) {

            continue;
        }


        const key =
            `${year}-${String(month).padStart(2, "0")}`;


        if (
            !months.has(key)
        ) {

            months.set(
                key,
                {

                    year:
                        year,

                    month:
                        month,

                    total:
                        0

                }
            );
        }


        const record =
            months.get(
                key
            );


        record.total +=
            rainfall;
    }


    const result =
        Array.from(
            months.values()
        );


    result.sort(
        function (
            a,
            b
        ) {

            if (
                a.year !== b.year
            ) {

                return a.year - b.year;
            }


            return a.month - b.month;
        }
    );


    return result;
}


// ============================================================
// AGGREGATE DAILY → ANNUAL
// ============================================================
//
// Annual total = sum of valid daily rainfall.
// ============================================================

function aggregateAnnualRainfall(
    data
) {

    const years =
        new Map();


    if (
        !Array.isArray(data)
    ) {

        return [];
    }


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const item =
            data[i];


        if (
            !item ||
            !item.date
        ) {

            continue;
        }


        const rainfall =
            parseRainfall(
                item.rainfall
            );


        if (
            rainfall === null
        ) {

            continue;
        }


        const dateParts =
            String(
                item.date
            ).substring(
                0,
                10
            ).split("-");


        if (
            dateParts.length !== 3
        ) {

            continue;
        }


        const year =
            Number(
                dateParts[0]
            );


        if (
            !Number.isFinite(year)
        ) {

            continue;
        }


        if (
            !years.has(year)
        ) {

            years.set(
                year,
                0
            );
        }


        years.set(
            year,
            years.get(year) +
            rainfall
        );
    }


    return Array
        .from(
            years.entries()
        )
        .sort(
            function (
                a,
                b
            ) {

                return a[0] - b[0];

            }
        )
        .map(
            function (
                item
            ) {

                return {

                    year:
                        item[0],

                    total:
                        item[1]

                };

            }
        );
}


// ============================================================
// BUILD DAILY HIGHSTOCK SERIES
// ============================================================

function buildDailySeries(
    data
) {

    const series = [];


    if (
        !Array.isArray(data)
    ) {

        return series;
    }


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const item =
            data[i];


        const time =
            rainfallDateToUTC(
                item.date
            );


        const rainfall =
            parseRainfall(
                item.rainfall
            );


        if (
            time === null
        ) {

            continue;
        }


        if (
            rainfall === null
        ) {

            // ------------------------------------------------
            // Keep missing values as null.
            // This allows Highstock to show a gap instead
            // of falsely treating missing data as zero.
            // ------------------------------------------------

            series.push(
                [
                    time,
                    null
                ]
            );

        } else {

            series.push(
                [
                    time,
                    Number(
                        rainfall.toFixed(3)
                    )
                ]
            );
        }
    }


    series.sort(
        function (
            a,
            b
        ) {

            return a[0] - b[0];

        }
    );


    return series;
}


// ============================================================
// BUILD MONTHLY HIGHSTOCK SERIES
// ============================================================

function buildMonthlySeries(
    monthly
) {

    if (
        !Array.isArray(monthly)
    ) {

        return [];
    }


    return monthly.map(
        function (
            item
        ) {

            return [

                Date.UTC(
                    item.year,
                    item.month - 1,
                    1
                ),

                Number(
                    item.total.toFixed(3)
                )

            ];

        }
    );
}


// ============================================================
// BUILD ANNUAL HIGHSTOCK SERIES
// ============================================================

function buildAnnualSeries(
    annual
) {

    if (
        !Array.isArray(annual)
    ) {

        return [];
    }


    return annual.map(
        function (
            item
        ) {

            return [

                Date.UTC(
                    item.year,
                    0,
                    1
                ),

                Number(
                    item.total.toFixed(3)
                )

            ];

        }
    );
}


// ============================================================
// GET CHART MODE
// ============================================================

function getRainfallChartMode(
    minTime,
    maxTime
) {

    if (
        minTime === null ||
        maxTime === null
    ) {

        return "day";
    }


    const days =
        (
            maxTime -
            minTime
        ) /
        RAINFALL_ONE_DAY;


    if (
        days <=
        RAINFALL_DAILY_THRESHOLD_DAYS
    ) {

        return "day";
    }


    if (
        days <=
        RAINFALL_ANNUAL_THRESHOLD_DAYS
    ) {

        return "month";
    }


    return "year";
}


// ============================================================
// GET MODE FROM CURRENT HIGHSTOCK EXTREMES
// ============================================================

function getModeFromExtremes(
    minTime,
    maxTime
) {

    const days =
        (
            maxTime -
            minTime
        ) /
        RAINFALL_ONE_DAY;


    if (
        days <=
        RAINFALL_DAILY_THRESHOLD_DAYS
    ) {

        return "day";
    }


    if (
        days <=
        RAINFALL_ANNUAL_THRESHOLD_DAYS
    ) {

        return "month";
    }


    return "year";
}


// ============================================================
// GET DATA FOR MODE
// ============================================================

function getRainfallSeriesForMode(
    mode
) {

    if (
        mode === "day"
    ) {

        return rainfallDailySeries;
    }


    if (
        mode === "year"
    ) {

        return rainfallAnnualSeries;
    }


    return rainfallMonthlySeries;
}


// ============================================================
// GET SERIES NAME
// ============================================================

function getRainfallSeriesName(
    mode
) {

    if (
        mode === "day"
    ) {

        return "Rainfall";
    }


    if (
        mode === "year"
    ) {

        return "Annual Rainfall";
    }


    return "Monthly Rainfall";
}


// ============================================================
// GET CHART MODE TEXT
// ============================================================

function getRainfallModeText(
    mode
) {

    if (
        mode === "day"
    ) {

        return "Daily";
    }


    if (
        mode === "year"
    ) {

        return "Annual";
    }


    return "Monthly";
}


// ============================================================
// UPDATE TIMESERIES MESSAGE
// ============================================================

function updateRainfallModeMessage(
    mode
) {

    if (
        !timeseriesMessageElement
    ) {

        return;
    }


    const recordCount =
        rainfallData.length;


    const text =
        `${getRainfallModeText(mode)} rainfall • ${recordCount.toLocaleString()} daily records`;


    timeseriesMessageElement.textContent =
        text;
}


// ============================================================
// CALCULATE RAINFALL STATISTICS
// ============================================================

// function calculateRainfallStatistics(
//     data
// ) {

//     let total =
//         0;


//     let rainyDays =
//         0;


//     let wettest =
//         {

//             time:
//                 null,

//             value:
//                 0

//         };


//     if (
//         !Array.isArray(data)
//     ) {

//         return {

//             total:
//                 0,

//             wettest:
//                 wettest,

//             rainyDays:
//                 0,

//             average:
//                 0

//         };
//     }


//     for (
//         let i = 0;
//         i < data.length;
//         i++
//     ) {

//         const item =
//             data[i];


//         const rainfall =
//             parseRainfall(
//                 item.rainfall
//             );


//         if (
//             rainfall === null
//         ) {

//             continue;
//         }


//         total +=
//             rainfall;


//         if (
//             rainfall > 0
//         ) {

//             rainyDays++;
//         }


//         if (
//             rainfall > wettest.value
//         ) {

//             wettest = {

//                 time:
//                     rainfallDateToUTC(
//                         item.date
//                     ),

//                 value:
//                     rainfall

//             };
//         }
//     }


//     const average =
//         rainyDays > 0
//             ? total / rainyDays
//             : 0;


//     return {

//         total:
//             total,

//         wettest:
//             wettest,

//         rainyDays:
//             rainyDays,

//         average:
//             average

//     };
// }


// // ============================================================
// // CREATE STATISTICS HEADER
// // ============================================================
// //
// // The supplied standalone HTML has four statistic cards.
// //
// // Your Django HTML currently only has #rainfallChart.
// //
// // Therefore this function creates the cards automatically
// // immediately above the Highstock chart.
// //
// // ============================================================

// function ensureRainfallStats() {

//     const chartContainer =
//         document.getElementById(
//             "rainfallChart"
//         );


//     if (
//         !chartContainer
//     ) {

//         return null;
//     }


//     let stats =
//         document.getElementById(
//             "rainfallStats"
//         );


//     if (
//         stats
//     ) {

//         return stats;
//     }


//     stats =
//         document.createElement(
//             "div"
//         );


//     stats.id =
//         "rainfallStats";


//     stats.innerHTML =
//         `
//         <div class="rainfall-stat-card">
//             <div
//                 class="rainfall-stat-value"
//                 id="stat-total"
//             >—</div>

//             <div class="rainfall-stat-label">
//                 Total rainfall (mm)
//             </div>
//         </div>

//         <div class="rainfall-stat-card">
//             <div
//                 class="rainfall-stat-value"
//                 id="stat-wettest"
//             >—</div>

//             <div class="rainfall-stat-label">
//                 Wettest day (mm)
//             </div>
//         </div>

//         <div class="rainfall-stat-card">
//             <div
//                 class="rainfall-stat-value"
//                 id="stat-rainy"
//             >—</div>

//             <div class="rainfall-stat-label">
//                 Rainy days
//             </div>
//         </div>

//         <div class="rainfall-stat-card">
//             <div
//                 class="rainfall-stat-value"
//                 id="stat-avg"
//             >—</div>

//             <div class="rainfall-stat-label">
//                 Avg. per rainy day (mm)
//             </div>
//         </div>
//         `;


//     // --------------------------------------------------------
//     // Styling matching supplied HTML
//     // --------------------------------------------------------

//     stats.style.display =
//         "grid";


//     stats.style.gridTemplateColumns =
//         "repeat(4, minmax(0, 1fr))";


//     stats.style.gap =
//         "12px";


//     stats.style.marginBottom =
//         "15px";


//     chartContainer.parentNode.insertBefore(
//         stats,
//         chartContainer
//     );


//     const cards =
//         stats.querySelectorAll(
//             ".rainfall-stat-card"
//         );


//     cards.forEach(
//         function(card) {

//             card.style.background =
//                 "#FFFFFF";

//             card.style.border =
//                 "1px solid #E3E9EE";

//             card.style.borderRadius =
//                 "10px";

//             card.style.padding =
//                 "14px 16px";
//         }
//     );


//     const values =
//         stats.querySelectorAll(
//             ".rainfall-stat-value"
//         );


//     values.forEach(
//         function(value) {

//             value.style.fontSize =
//                 "21px";

//             value.style.fontWeight =
//                 "650";

//             value.style.lineHeight =
//                 "1.2";
//         }
//     );


//     const labels =
//         stats.querySelectorAll(
//             ".rainfall-stat-label"
//         );


//     labels.forEach(
//         function(label) {

//             label.style.fontSize =
//                 "13px";

//             label.style.color =
//                 "#6B7785";

//             label.style.marginTop =
//                 "3px";
//         }
//     );


//     // --------------------------------------------------------
//     // Responsive
//     // --------------------------------------------------------

//     const responsiveStyle =
//         document.createElement(
//             "style"
//         );


//     responsiveStyle.id =
//         "rainfallStatsResponsiveStyle";


//     responsiveStyle.textContent =
//         `
//         @media (max-width: 700px) {

//             #rainfallStats {
//                 grid-template-columns:
//                     repeat(2, minmax(0, 1fr)) !important;
//             }

//         }

//         @media (max-width: 450px) {

//             #rainfallStats {
//                 grid-template-columns:
//                     1fr !important;
//             }

//         }
//         `;


//     if (
//         !document.getElementById(
//             "rainfallStatsResponsiveStyle"
//         )
//     ) {

//         document.head.appendChild(
//             responsiveStyle
//         );
//     }


//     return stats;
// }


// // ============================================================
// // UPDATE STATISTICS
// // ============================================================

// function updateRainfallStatistics(
//     data
// ) {

//     ensureRainfallStats();


//     const statistics =
//         calculateRainfallStatistics(
//             data
//         );


//     const totalElement =
//         document.getElementById(
//             "stat-total"
//         );


//     const wettestElement =
//         document.getElementById(
//             "stat-wettest"
//         );


//     const rainyElement =
//         document.getElementById(
//             "stat-rainy"
//         );


//     const averageElement =
//         document.getElementById(
//             "stat-avg"
//         );


//     if (
//         totalElement
//     ) {

//         totalElement.textContent =
//             statistics.total.toLocaleString(
//                 undefined,
//                 {
//                     maximumFractionDigits:
//                         1
//                 }
//             );
//     }


//     if (
//         wettestElement
//     ) {

//         if (
//             statistics.wettest.time !== null
//         ) {

//             wettestElement.textContent =
//                 `${statistics.wettest.value.toFixed(1)} (${Highcharts.dateFormat(
//                     "%d %b %Y",
//                     statistics.wettest.time
//                 )})`;

//         } else {

//             wettestElement.textContent =
//                 "—";
//         }
//     }


//     if (
//         rainyElement
//     ) {

//         rainyElement.textContent =
//             statistics.rainyDays.toLocaleString();
//     }


//     if (
//         averageElement
//     ) {

//         averageElement.textContent =
//             statistics.rainyDays > 0
//                 ? statistics.average.toFixed(1)
//                 : "—";
//     }
// }


// ============================================================
// SET CHART HEIGHT
// ============================================================

function prepareRainfallChartContainer() {

    const container =
        document.getElementById(
            "rainfallChart"
        );


    if (
        !container
    ) {

        return;
    }


    // --------------------------------------------------------
    // Supplied HTML uses 620px.
    // --------------------------------------------------------

    container.style.width =
        "100%";


    container.style.height =
        "620px";


    container.style.minHeight =
        "620px";


    container.style.display =
        "block";
}


// ============================================================
// CREATE / UPDATE HIGHSTOCK CHART
// ============================================================

function drawRainfallChart(
    data
) {

    console.log(
        "=============================================="
    );


    console.log(
        "Preparing Highstock rainfall chart..."
    );


    const container =
        document.getElementById(
            "rainfallChart"
        );


    if (
        !container
    ) {

        console.warn(
            "#rainfallChart not found."
        );

        return;
    }


    // --------------------------------------------------------
    // Highstock availability
    // --------------------------------------------------------

    if (
        typeof Highcharts === "undefined"
    ) {

        console.error(
            "Highcharts / Highstock is not loaded."
        );


        container.innerHTML =
            `
            <div style="
                padding:40px;
                text-align:center;
                color:#6B7785;
            ">
                Highstock could not be loaded.
                Please check the Highstock script.
            </div>
            `;


        return;
    }


    // --------------------------------------------------------
    // Prepare
    // --------------------------------------------------------

    prepareRainfallChartContainer();


    // ensureRainfallStats();


    // --------------------------------------------------------
    // No data
    // --------------------------------------------------------

    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        destroyRainfallChart();


        container.innerHTML =
            `
            <div style="
                padding:40px;
                text-align:center;
                color:#6B7785;
            ">
                No rainfall data available.
            </div>
            `;


        return;
    }


    // --------------------------------------------------------
    // Build all resolutions once.
    //
    // This is important because the chart can change
    // between daily/monthly/annual while zooming.
    // --------------------------------------------------------

    rainfallDailySeries =
        buildDailySeries(
            data
        );


    const monthly =
        aggregateMonthlyRainfall(
            data
        );


    rainfallMonthlySeries =
        buildMonthlySeries(
            monthly
        );


    const annual =
        aggregateAnnualRainfall(
            data
        );


    rainfallAnnualSeries =
        buildAnnualSeries(
            annual
        );


    console.log(
        "Highstock data:",
        {

            daily:
                rainfallDailySeries.length,

            monthly:
                rainfallMonthlySeries.length,

            annual:
                rainfallAnnualSeries.length

        }
    );


    // --------------------------------------------------------
    // Determine initial mode
    // --------------------------------------------------------

    const firstTime =
        rainfallDailySeries.length > 0
            ? rainfallDailySeries[0][0]
            : null;


    const lastTime =
        rainfallDailySeries.length > 0
            ? rainfallDailySeries[
                rainfallDailySeries.length - 1
              ][0]
            : null;


    rainfallCurrentMode =
        getRainfallChartMode(
            firstTime,
            lastTime
        );


    console.log(
        "Initial rainfall chart mode:",
        rainfallCurrentMode
    );


    // updateRainfallStatistics(
    //     data
    // );


    // --------------------------------------------------------
    // Destroy previous chart
    // --------------------------------------------------------

    if (
        rainfallHighstock
    ) {

        try {

            rainfallHighstock.destroy();

        }
        catch (error) {

            console.warn(
                "Could not destroy previous Highstock:",
                error
            );

        }


        rainfallHighstock =
            null;
    }


    container.innerHTML =
        "";


    // --------------------------------------------------------
    // Initial chart data
    // --------------------------------------------------------

    const initialSeries =
        getRainfallSeriesForMode(
            rainfallCurrentMode
        );


    // --------------------------------------------------------
    // Initial extremes
    // --------------------------------------------------------

    const initialMin =
        firstTime;


    const initialMax =
        lastTime;


    // ========================================================
    // CREATE HIGHSTOCK
    // ========================================================

    rainfallHighstock =
        Highcharts.stockChart(
            "rainfallChart",
            {

                chart: {

                    height:
                        620,

                    backgroundColor:
                        "#FFFFFF",

                    spacingTop:
                        10,

                    spacingBottom:
                        15,

                    style: {

                        fontFamily:
                            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

                    },

                    events: {

                        load:
                            function() {

                                console.log(
                                    "Highstock rainfall chart loaded."
                                );

                            }

                    }

                },


                // ------------------------------------------------
                // TITLE
                // ------------------------------------------------

                title: {

                    text:
                        null

                },


                // ------------------------------------------------
                // SUBTITLE
                // ------------------------------------------------

                subtitle: {

                    text:
                        null

                },


                // ------------------------------------------------
                // CREDITS
                // ------------------------------------------------

                credits: {

                    enabled:
                        false

                },


                // ------------------------------------------------
                // RANGE SELECTOR
                // ------------------------------------------------

                rangeSelector: {

                    selected:
                        4,

                    inputEnabled:
                        true,

                    buttons:
                        [

                            {
                                type:
                                    "month",

                                count:
                                    1,

                                text:
                                    "1M"
                            },

                            {
                                type:
                                    "month",

                                count:
                                    3,

                                text:
                                    "3M"
                            },

                            {
                                type:
                                    "month",

                                count:
                                    6,

                                text:
                                    "6M"
                            },

                            {
                                type:
                                    "year",

                                count:
                                    1,

                                text:
                                    "1Y"
                            },

                            {
                                type:
                                    "year",

                                count:
                                    3,

                                text:
                                    "3Y"
                            },

                            {
                                type:
                                    "year",

                                count:
                                    5,

                                text:
                                    "5Y"
                            },

                            {
                                type:
                                    "all",

                                text:
                                    "All"
                            }

                        ]

                },


                // ------------------------------------------------
                // X AXIS
                // ------------------------------------------------

                xAxis: {

                    type:
                        "datetime",

                    min:
                        initialMin,

                    max:
                        initialMax,

                    tickPixelInterval:
                        80,

                    events: {

                        afterSetExtremes:
                            function(e) {

                                if (
                                    !e ||
                                    e.min === undefined ||
                                    e.max === undefined
                                ) {

                                    return;
                                }


                                const min =
                                    e.min;


                                const max =
                                    e.max;


                                const mode =
                                    getModeFromExtremes(
                                        min,
                                        max
                                    );


                                if (
                                    mode !==
                                    rainfallCurrentMode
                                ) {

                                    updateRainfallChartResolution(
                                        mode
                                    );

                                }

                            }

                    },

                    labels: {

                        formatter:
                            function() {

                                const extremes =
                                    this.chart
                                        .xAxis[0]
                                        .getExtremes();


                                const days =
                                    (
                                        extremes.max -
                                        extremes.min
                                    ) /
                                    RAINFALL_ONE_DAY;


                                if (
                                    days <=
                                    RAINFALL_DAILY_THRESHOLD_DAYS
                                ) {

                                    return Highcharts.dateFormat(
                                        "%d %b",
                                        this.value
                                    );
                                }


                                if (
                                    days <=
                                    RAINFALL_ANNUAL_THRESHOLD_DAYS
                                ) {

                                    return Highcharts.dateFormat(
                                        "%b %Y",
                                        this.value
                                    );
                                }


                                return Highcharts.dateFormat(
                                    "%Y",
                                    this.value
                                );

                            }

                    }

                },


                // ------------------------------------------------
                // Y AXIS
                // ------------------------------------------------

                yAxis: {

                    title: {

                        text:
                            "Rainfall (mm)"

                    },

                    min:
                        0,

                    opposite:
                        false,

                    labels: {

                        formatter:
                            function() {

                                return Highcharts.numberFormat(
                                    this.value,
                                    0
                                );

                            }

                    }

                },


                // ------------------------------------------------
                // NAVIGATOR
                // ------------------------------------------------

                navigator: {

                    enabled:
                        true,

                    height:
                        70,

                    margin:
                        10,

                    series: {

                        type:
                            "line",

                        data:
                            rainfallDailySeries,

                        lineWidth:
                            1,

                        fillOpacity:
                            0.08

                    }

                },


                // ------------------------------------------------
                // SCROLLBAR
                // ------------------------------------------------

                scrollbar: {

                    enabled:
                        true

                },


                // ------------------------------------------------
                // TOOLTIP
                // ------------------------------------------------

                tooltip: {

                    shared:
                        false,

                    valueDecimals:
                        1,

                    valueSuffix:
                        " mm",

                    xDateFormat:
                        "%d %b %Y",

                    formatter:
                        function() {

                            let dateFormat =
                                "%d %b %Y";


                            if (
                                rainfallCurrentMode ===
                                "month"
                            ) {

                                dateFormat =
                                    "%b %Y";

                            }


                            if (
                                rainfallCurrentMode ===
                                "year"
                            ) {

                                dateFormat =
                                    "%Y";
                            }


                            const value =
                                this.y;


                            if (
                                value === null ||
                                value === undefined
                            ) {

                                return `
                                    <b>${Highcharts.dateFormat(
                                        dateFormat,
                                        this.x
                                    )}</b>
                                    <br>
                                    No rainfall data
                                `;
                            }


                            return `
                                <b>${Highcharts.dateFormat(
                                    dateFormat,
                                    this.x
                                )}</b>
                                <br>
                                Rainfall:
                                <strong>
                                    ${Highcharts.numberFormat(
                                        value,
                                        1
                                    )} mm
                                </strong>
                            `;

                        }

                },


                // ------------------------------------------------
                // LEGEND
                // ------------------------------------------------

                legend: {

                    enabled:
                        false

                },


                // ------------------------------------------------
                // PLOT OPTIONS
                // ------------------------------------------------

                plotOptions: {

                    series: {

                        animation:
                            false,

                        turboThreshold:
                            0

                    },

                    column: {

                        borderWidth:
                            0,

                        borderRadius:
                            1,

                        pointPadding:
                            0.05,

                        groupPadding:
                            0.05

                    }

                },


                // ------------------------------------------------
                // SERIES
                // ------------------------------------------------

                series:
                    [

                        {

                            name:
                                getRainfallSeriesName(
                                    rainfallCurrentMode
                                ),

                            type:
                                "column",

                            data:
                                initialSeries,

                            color:
                                "#3E8FD0",

                            borderRadius:
                                1,

                            tooltip: {

                                valueSuffix:
                                    " mm"

                            }

                        }

                    ]

            }
        );


    console.log(
        "Highstock rainfall chart successfully created."
    );


    console.log(
        "=============================================="
    );
}


// ============================================================
// UPDATE CHART RESOLUTION
// ============================================================
//
// This is the important part.
//
// Highstock itself controls zoom.
//
// We switch the actual data source:
//
// daily  -> monthly -> annual
//
// according to visible date range.
// ============================================================

function updateRainfallChartResolution(
    mode
) {

    if (
        !rainfallHighstock
    ) {

        return;
    }


    if (
        mode ===
        rainfallCurrentMode
    ) {

        return;
    }


    console.log(
        "Changing rainfall chart resolution:",
        rainfallCurrentMode,
        "→",
        mode
    );


    rainfallCurrentMode =
        mode;


    const newData =
        getRainfallSeriesForMode(
            mode
        );


    if (
        !Array.isArray(
            newData
        )
    ) {

        return;
    }


    const series =
        rainfallHighstock.series[0];


    if (
        !series
    ) {

        return;
    }


    // --------------------------------------------------------
    // Preserve visible range
    // --------------------------------------------------------

    const axis =
        rainfallHighstock.xAxis[0];


    const oldMin =
        axis.min;


    const oldMax =
        axis.max;


    // --------------------------------------------------------
    // Update series
    // --------------------------------------------------------

    series.update(
        {

            name:
                getRainfallSeriesName(
                    mode
                ),

            type:
                "column",

            data:
                newData,

            color:
                "#3E8FD0",

            tooltip: {

                valueSuffix:
                    " mm"

            }

        },
        false
    );


    // --------------------------------------------------------
    // Recalculate axis
    // --------------------------------------------------------

    rainfallHighstock.redraw(
        false
    );


    // --------------------------------------------------------
    // Restore reasonable visible range
    //
    // Highstock data has different timestamps:
    //
    // daily:
    //     actual date
    //
    // monthly:
    //     first day of month
    //
    // annual:
    //     first day of year
    // --------------------------------------------------------

    if (
        oldMin !== undefined &&
        oldMax !== undefined
    ) {

        const dataExtremes =
            rainfallHighstock
                .xAxis[0]
                .getExtremes();


        let newMin =
            oldMin;


        let newMax =
            oldMax;


        if (
            newMin <
            dataExtremes.dataMin
        ) {

            newMin =
                dataExtremes.dataMin;
        }


        if (
            newMax >
            dataExtremes.dataMax
        ) {

            newMax =
                dataExtremes.dataMax;
        }


        if (
            newMin < newMax
        ) {

            rainfallHighstock
                .xAxis[0]
                .setExtremes(
                    newMin,
                    newMax,
                    true,
                    false
                );

        } else {

            rainfallHighstock.redraw();

        }

    } else {

        rainfallHighstock.redraw();

    }


    updateRainfallModeMessage(
        mode
    );


    console.log(
        "Rainfall chart resolution updated:",
        mode,
        "points:",
        newData.length
    );
}


// ============================================================
// DESTROY CHART
// ============================================================

function destroyRainfallChart() {

    if (
        rainfallHighstock
    ) {

        try {

            rainfallHighstock.destroy();

        }
        catch (error) {

            console.warn(
                "Error destroying rainfall chart:",
                error
            );

        }


        rainfallHighstock =
            null;
    }


    const container =
        document.getElementById(
            "rainfallChart"
        );


    if (
        container
    ) {

        container.innerHTML =
            "";
    }


    rainfallDailySeries =
        [];


    rainfallMonthlySeries =
        [];


    rainfallAnnualSeries =
        [];
}


// ============================================================
// DISPLAY LOADING MESSAGE
// ============================================================

function setLoadingMessage() {

    if (
        timeseriesMessageElement
    ) {

        timeseriesMessageElement.textContent =
            "Loading rainfall data...";
    }
}


// ============================================================
// DISPLAY SUCCESS MESSAGE
// ============================================================

function setSuccessMessage(
    recordCount
) {

    if (
        timeseriesMessageElement
    ) {

        timeseriesMessageElement.textContent =
            `Rainfall data loaded • ${recordCount.toLocaleString()} daily records`;
    }
}


// ============================================================
// DISPLAY ERROR
// ============================================================

function setErrorMessage(
    message
) {

    if (
        timeseriesMessageElement
    ) {

        timeseriesMessageElement.textContent =
            message;
    }
}


// ============================================================
// LOAD VILLAGE RAINFALL
// ============================================================

async function loadVillageRainfall(
    villageId,
    startDate,
    endDate
) {

    console.log(
        "=============================================="
    );


    console.log(
        "CALLING RAINFALL API"
    );


    console.log(
        "Village ID:",
        villageId
    );


    console.log(
        "Start:",
        startDate
    );


    console.log(
        "End:",
        endDate
    );


    console.log(
        "=============================================="
    );


    if (
        !villageId
    ) {

        console.error(
            "Village ID missing."
        );

        return;
    }


    if (
        !startDate ||
        !endDate
    ) {

        console.error(
            "Date range missing."
        );

        return;
    }


    // --------------------------------------------------------
    // Cancel previous request
    // --------------------------------------------------------

    if (
        rainfallRequestController
    ) {

        rainfallRequestController.abort();
    }


    rainfallRequestController =
        new AbortController();


    const requestSequence =
        ++rainfallRequestSequence;


    // --------------------------------------------------------
    // Build URL
    // --------------------------------------------------------

    const params =
        new URLSearchParams();


    params.set(
        "village_id",
        String(
            villageId
        )
    );


    params.set(
        "start_date",
        startDate
    );


    params.set(
        "end_date",
        endDate
    );


    const url =
        `${RAINFALL_API}?${params.toString()}`;


    console.log(
        "Rainfall URL:",
        url
    );


    setLoadingMessage();


    try {

        const response =
            await fetch(
                url,
                {

                    method:
                        "GET",

                    signal:
                        rainfallRequestController.signal,

                    cache:
                        "no-store"

                }
            );


        console.log(
            "Rainfall HTTP status:",
            response.status
        );


        if (
            !response.ok
        ) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const result =
            await response.json();


        // ----------------------------------------------------
        // Ignore stale response
        // ----------------------------------------------------

        if (
            requestSequence !==
            rainfallRequestSequence
        ) {

            console.log(
                "Ignoring stale rainfall response."
            );

            return;
        }


        console.log(
            "Rainfall API returned:",
            {

                gridCount:
                    Array.isArray(result.grid)
                        ? result.grid.length
                        : 0,

                dataLength:
                    Array.isArray(result.data)
                        ? result.data.length
                        : 0

            }
        );


        // ----------------------------------------------------
        // API error
        // ----------------------------------------------------

        if (
            result.error
        ) {

            throw new Error(
                result.error
            );
        }


        if (
            !Array.isArray(
                result.data
            )
        ) {

            throw new Error(
                "API did not return rainfall data."
            );
        }


        // ====================================================
        // GRID
        // ====================================================

        if (
            Array.isArray(
                result.grid
            ) &&
            result.grid.length > 0
        ) {

            selectedGrid =
                result.grid[0];


            console.log(
                "Grid cells returned:",
                result.grid.length
            );


            displayGridInformation(
                selectedGrid
            );


            drawRainfallGrid(
                result.grid
            );

        } else {

            selectedGrid =
                null;


            displayGridInformation(
                null
            );
        }


        // ====================================================
        // DAILY DATA
        // ====================================================

        rainfallData =
            result.data;


        console.log(
            "Daily records:",
            rainfallData.length
        );


        // ----------------------------------------------------
        // Debug first / last values
        // ----------------------------------------------------

        console.log(
            "First 10 rainfall records:",
            rainfallData.slice(
                0,
                10
            )
        );


        console.log(
            "Last 10 rainfall records:",
            rainfallData.slice(
                -10
            )
        );


        // ----------------------------------------------------
        // Find valid values
        // ----------------------------------------------------

        const validValues =
            rainfallData
                .map(
                    function(item) {

                        return parseRainfall(
                            item.rainfall
                        );

                    }
                )
                .filter(
                    function(value) {

                        return value !== null;

                    }
                );


        console.log(
            "Valid rainfall values:",
            validValues.length
        );


        // ----------------------------------------------------
        // December debug
        // ----------------------------------------------------

        const decemberRecords =
            rainfallData.filter(
                function(item) {

                    return String(
                        item.date
                    ).startsWith(
                        "2023-12"
                    );

                }
            );


        console.log(
            "DECEMBER RECORDS:",
            decemberRecords
        );


        console.log(
            "DECEMBER TOTAL:",
            decemberRecords.reduce(
                function(
                    sum,
                    item
                ) {

                    const value =
                        parseRainfall(
                            item.rainfall
                        );


                    return sum +
                        (
                            value === null
                                ? 0
                                : value
                        );

                },
                0
            )
        );


        // ====================================================
        // SUCCESS
        // ====================================================

        setSuccessMessage(
            rainfallData.length
        );


        // ====================================================
        // CHART
        // ====================================================

        drawRainfallChart(
            rainfallData
        );


        console.log(
            "Rainfall processing complete."
        );

    }
    catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            console.log(
                "Rainfall request aborted."
            );

            return;
        }


        console.error(
            "Rainfall API error:",
            error
        );


        setErrorMessage(
            "Unable to load rainfall data."
        );


        destroyRainfallChart();
    }
    finally {

        rainfallRequestController =
            null;
    }
}


// ============================================================
// VILLAGE SELECTED
//
// location_filter.js calls this function.
//
// IMPORTANT
// ------------------------------------------------------------
// No districtSelect / talukaSelect / villageSelect variables
// are declared here.
// ============================================================

async function onVillageSelected(
    data
) {

    console.log(
        "=============================================="
    );


    console.log(
        "onVillageSelected()"
    );


    console.log(
        data
    );


    console.log(
        "=============================================="
    );


    // --------------------------------------------------------
    // Cancel previous request
    // --------------------------------------------------------

    if (
        rainfallRequestController
    ) {

        rainfallRequestController.abort();

        rainfallRequestController =
            null;
    }


    ++rainfallRequestSequence;


    // --------------------------------------------------------
    // Clear old chart
    // --------------------------------------------------------

    destroyRainfallChart();


    rainfallData =
        [];


    // --------------------------------------------------------
    // Clear old layers
    // --------------------------------------------------------

    clearVillageLayers();


    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (
        !data
    ) {

        console.error(
            "No village data received."
        );

        return;
    }


    // ========================================================
    // VILLAGE ID
    // ========================================================

    selectedVillageId =
        extractVillageId(
            data
        );


    console.log(
        "Village ID:",
        selectedVillageId
    );


    if (
        !selectedVillageId
    ) {

        console.error(
            "Could not determine village ID."
        );

        return;
    }


    // ========================================================
    // VILLAGE BOUNDARY
    // ========================================================

    drawVillageBoundary(
        data
    );


    // ========================================================
    // VILLAGE NAME
    //
    // IMPORTANT:
    // We access the DOM directly.
    //
    // We do NOT declare villageSelect.
    // ========================================================

    let villageName =
        "Selected Village";


    const villageSelectElement =
        document.getElementById(
            "villageSelect"
        );


    if (
        villageSelectElement
    ) {

        const selectedOption =
            villageSelectElement.options[
                villageSelectElement.selectedIndex
            ];


        if (
            selectedOption
        ) {

            villageName =
                selectedOption.textContent.trim();
        }
    }


    selectedVillageName =
        villageName;


    // ========================================================
    // COORDINATES
    // ========================================================

    const coordinates =
        extractVillageCoordinates(
            data
        );


    if (
        !coordinates
    ) {

        console.error(
            "Could not determine village coordinates."
        );

        return;
    }


    selectedLatitude =
        coordinates.latitude;


    selectedLongitude =
        coordinates.longitude;


    console.log(
        "Village coordinates:",
        {

            latitude:
                selectedLatitude,

            longitude:
                selectedLongitude

        }
    );


    // ========================================================
    // MARKER
    // ========================================================

    drawVillageMarker(
        selectedLatitude,
        selectedLongitude,
        villageName
    );


    // ========================================================
    // ZOOM TO VILLAGE
    // ========================================================

    if (
        rainfallMap
    ) {

        rainfallMap.setView(
            [
                selectedLatitude,
                selectedLongitude
            ],
            12,
            {
                animate:
                    false
            }
        );

    }


    // ========================================================
    // DATES
    // ========================================================

    const dateRange =
        getSelectedDateRange();


    if (
        !dateRange
    ) {

        console.warn(
            "Rainfall date range not available."
        );

        return;
    }


    // ========================================================
    // LOAD API
    // ========================================================

    await loadVillageRainfall(
        selectedVillageId,
        dateRange.start,
        dateRange.end
    );
}


// ============================================================
// DATE CHANGE
//
// Reload only if village is selected.
// ============================================================

function handleDateChange() {

    if (
        !selectedVillageId
    ) {

        console.log(
            "Date changed but no village selected."
        );

        return;
    }


    const range =
        getSelectedDateRange();


    if (
        !range
    ) {

        console.warn(
            "Invalid selected date range."
        );

        return;
    }


    console.log(
        "Date changed. Reloading rainfall..."
    );


    loadVillageRainfall(
        selectedVillageId,
        range.start,
        range.end
    );
}


// ============================================================
// START DATE CHANGE
// ============================================================

if (
    startDateElement
) {

    startDateElement.addEventListener(
        "change",
        handleDateChange
    );
}


// ============================================================
// END DATE CHANGE
// ============================================================

if (
    endDateElement
) {

    endDateElement.addEventListener(
        "change",
        handleDateChange
    );
}


// ============================================================
// GRID CHECKBOX
// ============================================================

if (
    gridCheckElement
) {

    gridCheckElement.addEventListener(
        "change",
        function() {

            if (
                !rainfallGridLayer
            ) {

                return;
            }


            if (
                this.checked
            ) {

                rainfallGridLayer.addTo(
                    rainfallMap
                );

            } else {

                if (
                    rainfallMap.hasLayer(
                        rainfallGridLayer
                    )
                ) {

                    rainfallMap.removeLayer(
                        rainfallGridLayer
                    );
                }
            }


            if (
                villageBoundaryLayer
            ) {

                villageBoundaryLayer.bringToFront();
            }


            if (
                villageMarker
            ) {

                villageMarker.bringToFront();
            }

        }
    );
}


// ============================================================
// RAINFALL CHECKBOX
//
// Currently there is no separate rainfall surface returned
// by the API. Keep the checkbox harmless.
// ============================================================

if (
    rainfallCheckElement
) {

    rainfallCheckElement.addEventListener(
        "change",
        function() {

            console.log(
                "Rainfall layer:",
                this.checked
                    ? "ON"
                    : "OFF"
            );

        }
    );
}


// ============================================================
// LEGEND TOGGLE
//
// Supports the existing HTML:
//
// #legendToggle
// #legendContent
// ============================================================

const legendToggleElement =
    document.getElementById(
        "legendToggle"
    );


const legendContentElement =
    document.getElementById(
        "legendContent"
    );


if (
    legendToggleElement &&
    legendContentElement
) {

    legendToggleElement.addEventListener(
        "click",
        function() {

            const hidden =
                legendContentElement.style.display ===
                "none";


            if (
                hidden
            ) {

                legendContentElement.style.display =
                    "block";

                this.textContent =
                    "−";

            } else {

                legendContentElement.style.display =
                    "none";

                this.textContent =
                    "+";

            }

        }
    );
}


// ============================================================
// INITIAL DATE STATE
// ============================================================
//
// Do NOT force 2023 dates here.
//
// The database API will set the actual min/max dates.
// ============================================================


// ============================================================
// LOAD DB DATE RANGE
// ============================================================

loadRainfallDateRange();


// ============================================================
// INITIALIZATION COMPLETE
// ============================================================

console.log(
    "=============================================="
);


console.log(
    "rainfall_nc.js initialization complete."
);


console.log(
    "Highstock is used."
);


console.log(
    "Chart.js is NOT used by rainfall_nc.js."
);


console.log(
    "=============================================="
);