// ============================================================
// RAINFALL MONITORING - VILLAGE TIME SERIES
// IMD NETCDF DATA
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
//     lightweight SVG chart
//
// IMPORTANT DEBUG VERSION
// ------------------------------------------------------------
// Chart.js is intentionally NOT used here.
//
// The API returns daily data.
// We aggregate the daily data into monthly totals.
//
// Maximum chart points = 12.
// ============================================================

let selectedDistrictName = null;
let selectedTehsilName = null;
console.log("==============================================");
console.log("rainfall_nc.js loaded");
console.log("==============================================");


// ============================================================
// GLOBAL STATE
// ============================================================

let rainfallMap = null;

let villageMarker = null;

let villageBoundaryLayer = null;

let rainfallGridLayer = null;

let rainfallRequestController = null;

let rainfallRequestSequence = 0;

let selectedVillageId = null;

let selectedVillageName = null;

let selectedLatitude = null;

let selectedLongitude = null;

let selectedGrid = null;

let rainfallData = [];


// ============================================================
// API
// ============================================================

const RAINFALL_API =
    "/village-rainfall-timeseries/";


// ============================================================
// DOM
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
// VALIDATE MAP CONTAINER
// ============================================================

if (!rainfallMapElement) {

    console.error(
        "Rainfall map container #map not found."
    );

} else {

    initializeRainfallMap();

}


// ============================================================
// INITIALIZE MAP
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
    statesWMS = L.tileLayer.wms(
        "https://geonode.communitygis.in/geoserver/geonode/wms",
        {
            layers: "geonode:states_in_india",
            format: "image/png",
            transparent: true,
            version: "1.1.1",
            tiled: true,
            opacity: 1
        }
    ).addTo(rainfallMap);


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


    /*
     * IMPORTANT
     * --------------------------------------------------------
     * The GeoNode state WMS is temporarily disabled.
     *
     * We are debugging browser stability first.
     *
     * Once the page is stable, we can add the WMS back.
     *
     * This prevents WMS tile rendering from complicating
     * the browser-crash diagnosis.
     */


    console.log(
        "Rainfall map initialized."
    );
}


// ============================================================
// SAFE DATE READ
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


    if (!start || !end) {

        return null;
    }


    return {
        start: start,
        end: end
    };
}


// ============================================================
// CLEAR MARKER
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
// CLEAR MAP SELECTION
// ============================================================

function clearVillageLayers() {

    clearVillageMarker();

    clearVillageBoundary();

    clearRainfallGrid();

    selectedGrid = null;

    selectedLatitude = null;

    selectedLongitude = null;
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

            sumLon += coordinates[0];

            sumLat += coordinates[1];

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
                latitude,
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
                latitude,
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


            if (centroid) {

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


        if (centroid) {

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


    let geojson = null;


    // --------------------------------------------------------
    // FeatureCollection
    // --------------------------------------------------------

    if (
        data &&
        data.type === "FeatureCollection"
    ) {

        geojson = data;
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


    villageMarker
        .bindPopup(
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
//
// IMPORTANT
// ------------------------------------------------------------
// API currently returns only the grid cells actually used
// for the village.
//
// Usually this will be 1 cell.
//
// We draw only those cells.
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
        // IMD 0.25 degree grid
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


    // --------------------------------------------------------
    // Boundary must remain visible above grid
    // --------------------------------------------------------

    if (
        villageBoundaryLayer
    ) {

        villageBoundaryLayer.bringToFront();
    }


    console.log(
        "Grid layer added:",
        layers.length,
        "cells"
    );
}


// ============================================================
// PARSE RAINFALL
// ============================================================

function parseRainfall(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;
    }


    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(number)
    ) {

        return null;
    }


    if (
        number <= -900
    ) {

        return null;
    }


    return number;
}


// ============================================================
// AGGREGATE DAILY → MONTHLY
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


        // ----------------------------------------------------
        // YYYY-MM-DD parsing without Date object
        // ----------------------------------------------------

        const dateParts =
            String(
                item.date
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
            months.get(key);


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
// MONTH NAME
// ============================================================

const MONTH_NAMES_RAINFALL = [

    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"

];


// ============================================================
// CREATE SVG CHART
//
// NO CHART.JS
//
// This is intentionally simple and lightweight.
//
// Maximum points:
//     12 for one year
//     more than 12 if the date range is longer
//
// The browser therefore never receives a large chart dataset.
// ============================================================

// ============================================================
// CREATE SVG CHART
//
// MONTHLY TIME SERIES
//
// RULES
// ------------------------------------------------------------
// <= 12 months:
//     Monthly points
//     Monthly labels
//
// > 12 months:
//     Monthly points are ALL retained
//     X-axis labels become adaptive
//
// > 36 months:
//     Year labels are used
//
// IMPORTANT
// ------------------------------------------------------------
// We NEVER truncate the monthly rainfall data.
// ============================================================

function drawRainfallChart(
    data
) {

    console.log(
        "Preparing lightweight rainfall chart..."
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
    // Clear previous chart
    // --------------------------------------------------------

    container.innerHTML = "";


    // --------------------------------------------------------
    // Convert daily → monthly
    // --------------------------------------------------------

    const monthly =
        aggregateMonthlyRainfall(
            data
        );


    console.log(
        "Monthly data points:",
        monthly.length
    );


    if (
        monthly.length === 0
    ) {

        container.innerHTML =
            `
            <div style="
                padding:30px;
                text-align:center;
                color:#666;
            ">
                No rainfall data available.
            </div>
            `;

        return;
    }


    // --------------------------------------------------------
    // IMPORTANT
    //
    // Keep ALL monthly points.
    //
    // Do NOT do:
    //
    // chartData.slice(...)
    // --------------------------------------------------------

    const chartData =
        monthly;


    // --------------------------------------------------------
    // Dimensions
    // --------------------------------------------------------

    const width =
        Math.max(
            container.clientWidth || 700,
            500
        );


    const height =
        350;


    const margin = {

        top:
            30,

        right:
            30,

        bottom:
            65,

        left:
            85

    };


    const chartWidth =
        width -
        margin.left -
        margin.right;


    const chartHeight =
        height -
        margin.top -
        margin.bottom;


    // --------------------------------------------------------
    // Maximum rainfall
    // --------------------------------------------------------

    let maxValue = 0;


    for (
        let i = 0;
        i < chartData.length;
        i++
    ) {

        if (
            chartData[i].total >
            maxValue
        ) {

            maxValue =
                chartData[i].total;
        }
    }


    if (
        maxValue <= 0
    ) {

        maxValue = 1;
    }


    // --------------------------------------------------------
    // Add headroom
    // --------------------------------------------------------

    let yMax =
        maxValue * 1.10;


    if (
        yMax <= 0
    ) {

        yMax = 1;
    }


    // --------------------------------------------------------
    // Y-axis decimal precision
    // --------------------------------------------------------

    let decimalPlaces = 0;


    if (
        yMax < 10
    ) {

        decimalPlaces = 2;

    } else if (
        yMax < 100
    ) {

        decimalPlaces = 1;

    } else {

        decimalPlaces = 0;
    }


    // --------------------------------------------------------
    // SVG
    // --------------------------------------------------------

    const svg =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );


    svg.setAttribute(
        "viewBox",
        `0 0 ${width} ${height}`
    );


    svg.setAttribute(
        "width",
        "100%"
    );


    svg.setAttribute(
        "height",
        String(height)
    );


    svg.style.display =
        "block";


    svg.style.maxWidth =
        "100%";


    svg.style.height =
        `${height}px`;


    // --------------------------------------------------------
    // SVG helper
    // --------------------------------------------------------

    function createSvgElement(
        name,
        attributes
    ) {

        const element =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                name
            );


        Object.keys(
            attributes
        ).forEach(
            key => {

                element.setAttribute(
                    key,
                    attributes[key]
                );

            }
        );


        return element;
    }


    // ========================================================
    // Y AXIS
    // ========================================================

    const gridCount =
        5;


    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {

        const ratio =
            i / gridCount;


        const y =
            margin.top +
            chartHeight -
            (
                ratio *
                chartHeight
            );


        // ----------------------------------------------------
        // Grid line
        // ----------------------------------------------------

        const line =
            createSvgElement(
                "line",
                {

                    x1:
                        margin.left,

                    y1:
                        y,

                    x2:
                        width -
                        margin.right,

                    y2:
                        y,

                    stroke:
                        "#dddddd",

                    "stroke-width":
                        "1"

                }
            );


        svg.appendChild(
            line
        );


        // ----------------------------------------------------
        // Y value
        // ----------------------------------------------------

        const value =
            yMax *
            ratio;


        const text =
            createSvgElement(
                "text",
                {

                    x:
                        margin.left - 10,

                    y:
                        y + 4,

                    "text-anchor":
                        "end",

                    "font-size":
                        "11",

                    fill:
                        "#555"

                }
            );


        text.textContent =
            value.toFixed(
                decimalPlaces
            );


        svg.appendChild(
            text
        );
    }


    // ========================================================
    // X AXIS
    // ========================================================

    const axisY =
        margin.top +
        chartHeight;


    const axis =
        createSvgElement(
            "line",
            {

                x1:
                    margin.left,

                y1:
                    axisY,

                x2:
                    width -
                    margin.right,

                y2:
                    axisY,

                stroke:
                    "#333",

                "stroke-width":
                    "1"

            }
        );


    svg.appendChild(
        axis
    );


    // ========================================================
    // DETERMINE X-AXIS LABEL STRATEGY
    // ========================================================

    let labelInterval = 1;

    let labelMode = "monthly";


    // --------------------------------------------------------
    // Up to 12 months
    // --------------------------------------------------------

    if (
        chartData.length <= 12
    ) {

        labelInterval = 1;

        labelMode = "monthly";

    }


    // --------------------------------------------------------
    // 13–24 months
    // --------------------------------------------------------

    else if (
        chartData.length <= 24
    ) {

        labelInterval = 2;

        labelMode = "monthly";

    }


    // --------------------------------------------------------
    // 25–36 months
    // --------------------------------------------------------

    else if (
        chartData.length <= 36
    ) {

        labelInterval = 3;

        labelMode = "monthly";

    }


    // --------------------------------------------------------
    // More than 36 months
    //
    // Use year labels.
    // --------------------------------------------------------

    else {

        labelMode = "year";
    }


    console.log(
        "X-axis label mode:",
        labelMode
    );


    // ========================================================
    // CALCULATE POINTS
    // ========================================================

    const points = [];


    for (
        let i = 0;
        i < chartData.length;
        i++
    ) {

        const record =
            chartData[i];


        // ----------------------------------------------------
        // X position
        // ----------------------------------------------------

        const x =
            chartData.length === 1

                ? margin.left +
                  chartWidth / 2

                : margin.left +
                  (
                      i /
                      (chartData.length - 1)
                  ) *
                  chartWidth;


        // ----------------------------------------------------
        // Y position
        // ----------------------------------------------------

        const y =
            margin.top +
            chartHeight -
            (
                record.total /
                yMax
            ) *
            chartHeight;


        points.push(
            `${x},${y}`
        );


        // ====================================================
        // POINT
        // ====================================================

        const circle =
            createSvgElement(
                "circle",
                {

                    cx:
                        x,

                    cy:
                        y,

                    r:
                        3.5,

                    fill:
                        "#0077b6"

                }
            );


        // ----------------------------------------------------
        // Tooltip
        // ----------------------------------------------------

        const tooltip =
            createSvgElement(
                "title",
                {}
            );


        tooltip.textContent =
            `${MONTH_NAMES_RAINFALL[
                record.month - 1
            ]} ${record.year}
Rainfall: ${record.total.toFixed(2)} mm`;


        circle.appendChild(
            tooltip
        );


        svg.appendChild(
            circle
        );


        // ====================================================
        // X AXIS LABEL
        // ====================================================

        let showLabel =
            false;


        let labelText =
            "";


        // ----------------------------------------------------
        // Monthly mode
        // ----------------------------------------------------

        if (
            labelMode === "monthly"
        ) {

            showLabel =
                i % labelInterval === 0 ||
                i === chartData.length - 1;


            labelText =
                `${MONTH_NAMES_RAINFALL[
                    record.month - 1
                ]} ${record.year}`;

        }


        // ----------------------------------------------------
        // Year mode
        // ----------------------------------------------------

        else {

            // Show January
            // and first/last point

            showLabel =
                record.month === 1 ||
                i === 0 ||
                i === chartData.length - 1;


            labelText =
                String(
                    record.year
                );
        }


        if (
            showLabel
        ) {

            const label =
                createSvgElement(
                    "text",
                    {

                        x:
                            x,

                        y:
                            height - 25,

                        "text-anchor":
                            "middle",

                        "font-size":
                            "11",

                        fill:
                            "#444"

                    }
                );


            label.textContent =
                labelText;


            svg.appendChild(
                label
            );
        }
    }


    // ========================================================
    // LINE
    // ========================================================

    if (
        points.length > 1
    ) {

        const polyline =
            createSvgElement(
                "polyline",
                {

                    points:
                        points.join(" "),

                    fill:
                        "none",

                    stroke:
                        "#0077b6",

                    "stroke-width":
                        "2"

                }
            );


        // Put line behind circles
        svg.insertBefore(
            polyline,
            svg.firstChild
        );
    }


    // ========================================================
    // Y AXIS TITLE
    // ========================================================

    const yTitle =
        createSvgElement(
            "text",
            {

                x:
                    "18",

                y:
                    height / 2,

                "text-anchor":
                    "middle",

                "font-size":
                    "12",

                fill:
                    "#444",

                transform:
                    `rotate(-90 18 ${height / 2})`

            }
        );


    yTitle.textContent =
        "Rainfall (mm)";


    svg.appendChild(
        yTitle
    );


    // ========================================================
    // CHART TITLE
    // ========================================================

    const title =
        createSvgElement(
            "text",
            {

                x:
                    width / 2,

                y:
                    18,

                "text-anchor":
                    "middle",

                "font-size":
                    "14",

                "font-weight":
                    "600",

                fill:
                    "#004466"

            }
        );


    title.textContent =
        "Monthly Rainfall";


    svg.appendChild(
        title
    );


    // ========================================================
    // ADD SVG
    // ========================================================

    container.appendChild(
        svg
    );


    console.log(
        "Lightweight SVG rainfall chart successfully created."
    );
}

// ============================================================
// DESTROY CHART
// ============================================================
//
// No Chart.js instance exists anymore.
// Just clear the container.
// ============================================================

function destroyRainfallChart() {

    const container =
        document.getElementById(
            "rainfallChart"
        );


    if (
        container
    ) {

        container.innerHTML = "";
    }
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
            `Daily rainfall records: ${recordCount}`;
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
// LOAD RAINFALL
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
    // URL
    // --------------------------------------------------------

    const params =
        new URLSearchParams();


    params.set(
        "village_id",
        String(villageId)
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
        // Validate API
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


        // ----------------------------------------------------
        // GRID
        // ----------------------------------------------------

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

            console.log(
                "ACTUAL GRID:",
                JSON.stringify(result.grid, null, 2)
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


        // ----------------------------------------------------
        // DAILY DATA
        // ----------------------------------------------------

        rainfallData =
            result.data;

            console.log(
                "First 10 rainfall records:",
                rainfallData.slice(0, 10)
            );
            
            console.log(
                "Last 10 rainfall records:",
                rainfallData.slice(-10)
            );
            
            console.log(
                "Rainfall values:",
                rainfallData.map(
                    item => Number(item.rainfall)
                ).filter(
                    value => Number.isFinite(value)
                )
            );
        console.log(
            "Daily records:",
            rainfallData.length
        );
        const decemberRecords =
    rainfallData.filter(
        item =>
            String(item.date).startsWith("2023-12")
    );

console.log(
    "DECEMBER RECORDS:",
    decemberRecords
);

console.log(
    "DECEMBER TOTAL:",
    decemberRecords.reduce(
        (sum, item) =>
            sum + (
                Number(item.rainfall) || 0
            ),
        0
    )
);

        setSuccessMessage(
            rainfallData.length
        );


        // ----------------------------------------------------
        // CHART
        // ----------------------------------------------------

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
// Example data:
//
// {
//     type: "FeatureCollection",
//     village_id: 48915,
//     features: [...]
//
// }
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


    rainfallData = [];


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


    // --------------------------------------------------------
    // Village ID
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Village boundary
    // --------------------------------------------------------

    drawVillageBoundary(
        data
    );


    // --------------------------------------------------------
    // Village name
    //
    // IMPORTANT:
    // We do NOT declare villageSelect here.
    // location_filter.js already owns it.
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Coordinates
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Marker
    // --------------------------------------------------------

    drawVillageMarker(
        selectedLatitude,
        selectedLongitude,
        villageName
    );


    // --------------------------------------------------------
    // Zoom
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Dates
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // API
    // --------------------------------------------------------

    await loadVillageRainfall(
        selectedVillageId,
        dateRange.start,
        dateRange.end
    );
}


// ============================================================
// DATE CHANGE
//
// When the user changes Start Date / End Date,
// reload rainfall only if a village is already selected.
// ============================================================

function handleDateChange() {

    if (
        !selectedVillageId
    ) {

        return;
    }


    const range =
        getSelectedDateRange();


    if (
        !range
    ) {

        return;
    }


    loadVillageRainfall(
        selectedVillageId,
        range.start,
        range.end
    );
}


if (
    startDateElement
) {

    startDateElement.addEventListener(
        "change",
        handleDateChange
    );
}


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
        function () {

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
        }
    );
}


// ============================================================
// RAINFALL CHECKBOX
//
// Currently the API returns rainfall values for the selected
// grid, but the actual rainfall surface is not rendered here.
// Keep this handler harmless.
// ============================================================

if (
    rainfallCheckElement
) {

    rainfallCheckElement.addEventListener(
        "change",
        function () {

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
// INITIAL STATE
// ============================================================

if (
    startDateElement &&
    !startDateElement.value
) {

    startDateElement.value =
        "2023-01-01";
}


if (
    endDateElement &&
    !endDateElement.value
) {

    endDateElement.value =
        "2023-12-31";
}


console.log(
    "=============================================="
);

console.log(
    "rainfall_nc.js initialization complete."
);

console.log(
    "Chart.js is NOT used."
);

console.log(
    "=============================================="
);