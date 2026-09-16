// ============================================================
// IMD GRIDDED RAINFALL
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const RAINFALL_API = "/api/imd/rainfall/";


// Approximate grid resolution
// Your grid is 0.25° x 0.25°

const GRID_SIZE = 0.25;


// ============================================================
// MAP INITIALIZATION
// ============================================================

const map = L.map("griddedRainfallMap", {
    zoomControl: true
});


// ============================================================
// BASE MAP
// ============================================================

const osm =
//  L.tileLayer(
//     "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
//     {
//         attribution: "&copy; OpenStreetMap contributors",
//         maxZoom: 18
//     }
// );

// osm.addTo(map);

L.tileLayer(
    "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    {
        maxZoom: 19,
        crossOrigin: true,
        // opacity: 0.8,
        attribution: "&copy; Google"
    }
);
osm.addTo(map);
// ============================================================
// INITIAL MAP VIEW
// ============================================================

map.setView(
    [19.0, 75.5],
    6
);


// ============================================================
// RAINFALL GRID LAYER
// ============================================================

let rainfallGridLayer = L.layerGroup().addTo(map);


// ============================================================
// COLOR FUNCTION
// ============================================================

function getRainfallColor(value) {

    if (value === null || value === undefined || isNaN(value)) {
        return "#d9d9d9";
    }


    if (value <= 2.5) {
        return "#ffffcc";
    }


    if (value <= 10) {
        return "#c7e9b4";
    }


    if (value <= 25) {
        return "#7fcdbb";
    }


    if (value <= 50) {
        return "#41b6c4";
    }


    if (value <= 100) {
        return "#2c7fb8";
    }


    return "#253494";
}


// ============================================================
// FORMAT RAINFALL
// ============================================================

function formatRainfall(value) {

    if (value === null || value === undefined || isNaN(value)) {
        return "No data";
    }

    return `${Number(value).toFixed(2)} mm`;
}


// ============================================================
// DRAW GRID CELL
// ============================================================

function drawGridCell(point) {

    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    const value = Number(point.value);


    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(value)
    ) {
        return;
    }


    // --------------------------------------------------------
    // Calculate cell bounds
    // --------------------------------------------------------

    const half = GRID_SIZE / 2;


    const south = latitude - half;
    const north = latitude + half;

    const west = longitude - half;
    const east = longitude + half;


    const bounds = [
        [south, west],
        [north, east]
    ];


    // --------------------------------------------------------
    // Create rectangle
    // --------------------------------------------------------

    const cell = L.rectangle(
        bounds,
        {
            stroke: true,

            color: "#777",

            weight: 0.25,

            fillColor: getRainfallColor(value),

            fillOpacity: 0.75
        }
    );


    // --------------------------------------------------------
    // Popup
    // --------------------------------------------------------

    cell.bindPopup(`
        <div style="min-width:180px">

            <strong>IMD Grid Cell</strong>

            <hr style="margin:6px 0">

            <b>Grid ID:</b>
            ${point.grid_id}

            <br>

            <b>Latitude:</b>
            ${latitude.toFixed(3)}°

            <br>

            <b>Longitude:</b>
            ${longitude.toFixed(3)}°

            <br>

            <b>Rainfall:</b>
            ${formatRainfall(value)}

        </div>
    `);


    // --------------------------------------------------------
    // Hover
    // --------------------------------------------------------

    cell.on("mouseover", function () {

        this.setStyle({
            weight: 1.5,
            color: "#333",
            fillOpacity: 0.9
        });

    });


    cell.on("mouseout", function () {

        this.setStyle({
            weight: 0.25,
            color: "#777",
            fillOpacity: 0.75
        });

    });


    rainfallGridLayer.addLayer(cell);
}


// ============================================================
// LOAD RAINFALL DATA
// ============================================================

async function loadRainfall(date) {

    const status =
        document.getElementById("gridded-rainfall-status");


    if (!date) {

        status.textContent =
            "Please select a date.";

        return;
    }


    // --------------------------------------------------------
    // Loading message
    // --------------------------------------------------------

    status.textContent =
        `Loading rainfall data for ${date}...`;


    // --------------------------------------------------------
    // Clear previous grid
    // --------------------------------------------------------

    rainfallGridLayer.clearLayers();


    try {

        // ----------------------------------------------------
        // API request
        // ----------------------------------------------------

        const url =
            `${RAINFALL_API}?date=${encodeURIComponent(date)}`;


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const result =
            await response.json();


        // ----------------------------------------------------
        // Validate response
        // ----------------------------------------------------

        if (!result.data) {

            throw new Error(
                "Invalid API response"
            );

        }


        // ----------------------------------------------------
        // Draw grid
        // ----------------------------------------------------

        result.data.forEach(
            drawGridCell
        );


        // ----------------------------------------------------
        // Status
        // ----------------------------------------------------

        status.textContent =
            `${result.count.toLocaleString()} valid grid cells displayed for ${date}.`;


    }
    catch (error) {

        console.error(
            "Rainfall API error:",
            error
        );


        status.textContent =
            `Unable to load rainfall data: ${error.message}`;

    }
}


// ============================================================
// DATE CONTROL
// ============================================================

const rainfallDate =
    document.getElementById("rainfallDate");


if (rainfallDate) {

    rainfallDate.addEventListener(
        "change",
        function () {

            loadRainfall(
                this.value
            );

        }
    );

}


// ============================================================
// VARIABLE CONTROL
// ============================================================

const rainfallVariable =
    document.getElementById("rainfallVariable");


if (rainfallVariable) {

    rainfallVariable.addEventListener(
        "change",
        function () {

            if (this.value === "rainfall") {

                loadRainfall(
                    rainfallDate.value
                );

            }

        }
    );

}


// ============================================================
// MAP COORDINATES
// ============================================================

const coordsBox =
    document.getElementById(
        "gridded-rainfall-coords-box"
    );


map.on(
    "mousemove",
    function (event) {

        if (!coordsBox) {
            return;
        }


        coordsBox.innerHTML =

            `Lat: ${event.latlng.lat.toFixed(4)}° &nbsp; ` +
            `Lon: ${event.latlng.lng.toFixed(4)}°`;

    }
);


// ============================================================
// INITIAL LOAD
// ============================================================

loadRainfall(
    rainfallDate.value
);