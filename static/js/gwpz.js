// ============================================================
// GWPZ MAP
// ============================================================

// ------------------------------------------------------------
// Global variables
// ------------------------------------------------------------

let map;
let baseLayer;
let gwpz;
let statesWMS;

let watershedLayer = null;
let villageBoundaryLayer = null;

window.currentWatershedLevel = 5;


// ============================================================
// MAP INITIALIZATION
// ============================================================

map = L.map("map", {
    zoomControl: false
}).setView([22, 78], 6);


// Zoom control
L.control.zoom({
    position: "topright"
}).addTo(map);


// Scale
L.control.scale({
    metric: true,
    imperial: false
}).addTo(map);


// ============================================================
// COORDINATES
// ============================================================

map.on("mousemove", function (e) {

    const coords = document.getElementById("coords-box");

    if (!coords) return;

    coords.innerHTML =
        "Lat : " +
        e.latlng.lat.toFixed(5) +
        "<br>Lon : " +
        e.latlng.lng.toFixed(5);
});


// ============================================================
// OSM BASE MAP
// ============================================================

baseLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors",
        opacity: 0.8,
        maxZoom: 19,
        crossOrigin: true
    }
).addTo(map);


// ============================================================
// GWPZ TILE LAYER
// ============================================================

gwpz = L.tileLayer(
    "/static/gwpz_tiles/{z}/{x}/{y}.png",
    {
        tms: true,
        opacity: 0.7,
        minZoom: 5,
        maxNativeZoom: 12,
        maxZoom: 12,
        crossOrigin: true
    }
).addTo(map);


// ============================================================
// INDIA BOUNDS
// ============================================================

const indiaBounds = L.latLngBounds(
    [6.5, 68],
    [37.5, 97]
);

map.setMaxBounds(indiaBounds);


// ============================================================
// STATE BOUNDARY
// ============================================================

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
).addTo(map);


// ============================================================
// INITIAL LAYER ORDER
// ============================================================

gwpz.bringToFront();
statesWMS.bringToFront();


// ============================================================
// GWPZ TOGGLE
// ============================================================

const toggleGwpz = document.getElementById("toggle-gwpz");

if (toggleGwpz) {

    toggleGwpz.addEventListener("change", function () {

        if (this.checked) {
            map.addLayer(gwpz);
        } else {
            map.removeLayer(gwpz);
        }

        updateLayerOrder();
    });
}


// ============================================================
// GWPZ OPACITY
// ============================================================

const gwpzOpacity = document.getElementById("gwpz-opacity");

if (gwpzOpacity) {

    gwpzOpacity.addEventListener("input", function () {

        gwpz.setOpacity(this.value / 100);

    });
}


// ============================================================
// STATE TOGGLE
// ============================================================

const toggleStates = document.getElementById("toggle-states");

if (toggleStates) {

    toggleStates.addEventListener("change", function () {

        if (this.checked) {
            map.addLayer(statesWMS);
        } else {
            map.removeLayer(statesWMS);
        }

        updateLayerOrder();
    });
}


// ============================================================
// VILLAGE BOUNDARY
// ============================================================

const toggleVillage = document.getElementById("toggle-village");

if (toggleVillage) {

    toggleVillage.addEventListener("change", function () {

        if (!villageBoundaryLayer) return;

        if (this.checked) {

            map.addLayer(villageBoundaryLayer);

        } else {

            map.removeLayer(villageBoundaryLayer);

        }

        updateLayerOrder();
    });
}


// ============================================================
// WATERSHED VARIABLES
// ============================================================


// ============================================================
// LOAD WATERSHED
// ============================================================

function loadWatershed(level) {

    level = Number(level);

    console.log("Loading watershed level:", level);

    // Store selected watershed level
    window.currentWatershedLevel = level;

    // Update legend
    updateWatershedLegend(level);

    // Remove old watershed
    if (watershedLayer) {

        if (map.hasLayer(watershedLayer)) {
            map.removeLayer(watershedLayer);
        }

        watershedLayer = null;
    }

    // Create new watershed WMS
    watershedLayer = L.tileLayer.wms(
        "https://geonode.communitygis.in/geoserver/geonode/wms",
        {
            layers:
                `geonode:india_watershed_level${level}`,

            format: "image/png",
            transparent: true,
            version: "1.1.1",
            tiled: true,
            opacity: 1
        }
    );

    const toggle =
        document.getElementById("toggle-watershed");

    if (toggle && toggle.checked) {
        watershedLayer.addTo(map);
    }

    updateLayerOrder();

    console.log(
        "Active watershed:",
        `geonode:india_watershed_level${level}`
    );
}


// ============================================================
// WATERSHED LEVEL DROPDOWN
// ============================================================

const watershedSelect =
    document.getElementById("watershed-level");

if (watershedSelect) {

    watershedSelect.addEventListener("change", function () {

        const level = Number(this.value);

        console.log(
            "Selected watershed level:",
            level
        );

        loadWatershed(level);

    });
}


// ============================================================
// WATERSHED TOGGLE
// ============================================================

const toggleWatershed =
    document.getElementById("toggle-watershed");

if (toggleWatershed) {

    toggleWatershed.addEventListener("change", function () {

        if (!watershedLayer) {

            loadWatershed(
                document.getElementById(
                    "watershed-level"
                ).value
            );

            return;
        }


        if (this.checked) {

            map.addLayer(watershedLayer);

        } else {

            map.removeLayer(watershedLayer);

        }

        updateLayerOrder();

    });
}


// ============================================================
// INITIAL WATERSHED
// ============================================================

// HTML has Level 5 selected
loadWatershed(
    watershedSelect
        ? watershedSelect.value
        : 5
);


// ============================================================
// VILLAGE CALLBACK
// ============================================================

window.onVillageSelected = function (geojson) {

    console.log("Village selected");

    // Remove old village
    if (villageBoundaryLayer) {

        map.removeLayer(villageBoundaryLayer);

        villageBoundaryLayer = null;
    }


    // Create new boundary
    villageBoundaryLayer = L.geoJSON(
        geojson,
        {
            style: {
                color: "#ff0000",
                weight: 3,
                fillOpacity: 0
            }
        }
    );


    const toggle =
        document.getElementById("toggle-village");


    if (toggle && toggle.checked) {

        villageBoundaryLayer.addTo(map);

    }


    // Zoom to village
    const bounds =
        villageBoundaryLayer.getBounds();

    if (bounds.isValid()) {

        map.fitBounds(
            bounds,
            {
                maxZoom: 12,
                padding: [20, 20]
            }
        );
    }


    updateLayerOrder();
};


// ============================================================
// LAYER ORDER
// ============================================================

function updateLayerOrder() {

    if (map.hasLayer(gwpz)) {
        gwpz.bringToFront();
    }

    if (map.hasLayer(statesWMS)) {
        statesWMS.bringToFront();
    }

    if (
        watershedLayer &&
        map.hasLayer(watershedLayer)
    ) {
        watershedLayer.bringToFront();
    }

    if (
        villageBoundaryLayer &&
        map.hasLayer(villageBoundaryLayer)
    ) {
        villageBoundaryLayer.bringToFront();
    }
}


// ============================================================
// WATERSHED GET FEATURE INFO
// ============================================================

map.on("click", function (e) {

    if (
        !watershedLayer ||
        !map.hasLayer(watershedLayer)
    ) {
        return;
    }

    getWatershedInfo(e.latlng);

});


function getWatershedInfo(latlng) {

    const point =
        map.latLngToContainerPoint(
            latlng
        );

    const size =
        map.getSize();


    const layerName =
        `geonode:india_watershed_level${window.currentWatershedLevel}`;


    const params = {

        SERVICE: "WMS",

        VERSION: "1.1.1",

        REQUEST: "GetFeatureInfo",

        LAYERS: layerName,

        QUERY_LAYERS: layerName,

        STYLES: "",

        BBOX:
            map.getBounds().toBBoxString(),

        WIDTH: size.x,

        HEIGHT: size.y,

        SRS: "EPSG:4326",

        X: Math.round(point.x),

        Y: Math.round(point.y),

        INFO_FORMAT:
            "application/json",

        FEATURE_COUNT: 1
    };


    const url =
        "https://geonode.communitygis.in/geoserver/geonode/wms?" +
        L.Util.getParamString(params);


    fetch(url)

        .then(response => {

            if (!response.ok) {
                throw new Error(
                    "GetFeatureInfo failed"
                );
            }

            return response.json();
        })

        .then(data => {

            showWatershedPopup(
                data,
                latlng
            );

        })

        .catch(error => {

            console.error(
                "Watershed GetFeatureInfo:",
                error
            );

        });
}


// ============================================================
// WATERSHED POPUP
// ============================================================

function showWatershedPopup(
    data,
    latlng
) {

    if (
        !data.features ||
        !data.features.length
    ) {
        return;
    }


    const p =
        data.features[0].properties;


    L.popup({
        maxWidth: 350
    })

        .setLatLng(latlng)

        .setContent(`

            <div style="font-family:Arial">

                <h5 style="
                    color:#004466;
                    margin-bottom:10px;">
                    Watershed Information
                </h5>

                <table
                    style="
                    width:100%;
                    font-size:13px;
                    border-collapse:collapse;">

                    <tr>
                        <td><b>Level</b></td>
                        <td>
                            ${window.currentWatershedLevel}
                        </td>
                    </tr>

                    <tr>
                        <td><b>HYBAS ID</b></td>
                        <td>
                            ${p.HYBAS_ID ?? "-"}
                        </td>
                    </tr>

                    <tr>
                        <td><b>PFAF ID</b></td>
                        <td>
                            ${p.PFAF_ID ?? "-"}
                        </td>
                    </tr>

                    <tr>
                        <td><b>Sub Area</b></td>
                        <td>
                            ${p.SUB_AREA ?? "-"} km²
                        </td>
                    </tr>

                    <tr>
                        <td><b>Upstream Area</b></td>
                        <td>
                            ${p.UP_AREA ?? "-"} km²
                        </td>
                    </tr>

                    <tr>
                        <td><b>Main Basin</b></td>
                        <td>
                            ${p.MAIN_BAS ?? "-"}
                        </td>
                    </tr>

                    <tr>
                        <td><b>Next Down</b></td>
                        <td>
                            ${p.NEXT_DOWN ?? "-"}
                        </td>
                    </tr>

                    <tr>
                        <td><b>Coastal</b></td>
                        <td>
                            ${p.COAST == 1 ? "Yes" : "No"}
                        </td>
                    </tr>

                </table>

            </div>

        `)

        .openOn(map);
}// ============================================================
// MAP DOWNLOAD
// ============================================================

let downloadInProgress = false;


// ============================================================
// DOWNLOAD SPINNER
// ============================================================

function showDownloadSpinner(message) {

    const spinner = document.getElementById("download-spinner");
    const text = document.getElementById("download-spinner-text");

    if (!spinner) return;

    if (text) {
        text.textContent = message || "Preparing map...";
    }

    spinner.style.display = "block";
}


function hideDownloadSpinner() {

    const spinner = document.getElementById("download-spinner");

    if (spinner) {
        spinner.style.display = "none";
    }
}


// ============================================================
// DISABLE BUTTONS
// ============================================================

function setDownloadButtonsDisabled(disabled) {

    const png = document.getElementById("downloadPNGBtn");
    const pdf = document.getElementById("downloadPDFBtn");

    if (png) {
        png.disabled = disabled;
    }

    if (pdf) {
        pdf.disabled = disabled;
    }
}


// ============================================================
// DOWNLOAD STATUS
// ============================================================

function setDownloadStatus(message) {

    const el = document.getElementById(
        "gwpz-download-status"
    );

    if (!el) return;

    if (!message) {

        el.style.display = "none";
        el.innerHTML = "";

        return;
    }

    el.innerHTML = message;
    el.style.display = "block";
}


// ============================================================
// WAIT FOR MAP RENDER
// ============================================================

function waitForMapRender(ms = 800) {

    return new Promise(resolve => {

        requestAnimationFrame(() => {

            setTimeout(resolve, ms);

        });

    });

}


// ============================================================
// CREATE EXPORT MAP
// ============================================================

async function captureMapCanvas() {

    if (downloadInProgress) {
        return null;
    }

    downloadInProgress = true;

    setDownloadButtonsDisabled(true);

    showDownloadSpinner("Preparing map...");


    // --------------------------------------------------------
    // EXPORT SIZE
    // --------------------------------------------------------

    const exportWidth = 1200;
    const exportHeight = 700;


    // --------------------------------------------------------
    // CREATE HIDDEN EXPORT WRAPPER
    // --------------------------------------------------------

    const exportWrap = document.createElement("div");

    exportWrap.style.position = "fixed";
    exportWrap.style.left = "-20000px";
    exportWrap.style.top = "0";

    exportWrap.style.width =
        exportWidth + "px";

    exportWrap.style.height =
        exportHeight + "px";

        // ========================================================
        // EXPORT LEGEND
        // ========================================================
        
        const exportLegend =
            document.createElement("div");
        
        exportLegend.style.position = "absolute";
        exportLegend.style.right = "18px";
        exportLegend.style.bottom = "18px";
        exportLegend.style.width = "250px";
        exportLegend.style.background = "rgba(255,255,255,0.96)";
        exportLegend.style.border = "1px solid #999";
        exportLegend.style.borderRadius = "8px";
        exportLegend.style.padding = "14px 16px";
        exportLegend.style.fontFamily = "Arial, sans-serif";
        exportLegend.style.fontSize = "13px";
        exportLegend.style.lineHeight = "1.4";
        exportLegend.style.color = "#222";
        exportLegend.style.zIndex = "9999";
        exportLegend.style.boxShadow =
            "0 2px 8px rgba(0,0,0,.25)";
        
        const exportLevel =
            window.currentWatershedLevel || 5;
        
        exportLegend.innerHTML = `
        
            <div style="
                font-size:18px;
                font-weight:bold;
                color:#004466;
                margin-bottom:10px;
                border-bottom:1px solid #ddd;
                padding-bottom:6px;
            ">
                Legend
            </div>
        
            <div style="
                font-weight:bold;
                color:#004466;
                margin-bottom:7px;
            ">
                Ground Water Priority Zone
            </div>
        
            <div style="margin-bottom:5px;">
                <span style="
                    display:inline-block;
                    width:16px;
                    height:16px;
                    background:#d7191c;
                    border:1px solid #777;
                    vertical-align:middle;
                    margin-right:8px;
                "></span>
                Critical
            </div>
        
            <div style="margin-bottom:5px;">
                <span style="
                    display:inline-block;
                    width:16px;
                    height:16px;
                    background:#fdae61;
                    border:1px solid #777;
                    vertical-align:middle;
                    margin-right:8px;
                "></span>
                High
            </div>
        
            <div style="margin-bottom:5px;">
                <span style="
                    display:inline-block;
                    width:16px;
                    height:16px;
                    background:#ffffbf;
                    border:1px solid #777;
                    vertical-align:middle;
                    margin-right:8px;
                "></span>
                Moderate
            </div>
        
            <div style="margin-bottom:5px;">
                <span style="
                    display:inline-block;
                    width:16px;
                    height:16px;
                    background:#abd9e9;
                    border:1px solid #777;
                    vertical-align:middle;
                    margin-right:8px;
                "></span>
                Low
            </div>
        
            <div style="margin-bottom:12px;">
                <span style="
                    display:inline-block;
                    width:16px;
                    height:16px;
                    background:#2c7bb6;
                    border:1px solid #777;
                    vertical-align:middle;
                    margin-right:8px;
                "></span>
                Very Low
            </div>
        
        
            <div style="
                border-top:1px solid #ccc;
                padding-top:9px;
                margin-top:8px;
            ">
        
                <div style="
                    font-weight:bold;
                    color:#004466;
                    margin-bottom:7px;
                ">
                    Watershed Boundary
                </div>
        
                <div style="margin-bottom:12px;">
        
                    <span style="
                        display:inline-block;
                        width:30px;
                        border-top:3px solid #800080;
                        vertical-align:middle;
                        margin-right:8px;
                    "></span>
        
                    Selected Watershed -
                    Level ${exportLevel}
        
                </div>
        
            </div>
        
        
            <div style="
                border-top:1px solid #ccc;
                padding-top:9px;
            ">
        
                <div style="
                    font-weight:bold;
                    color:#004466;
                    margin-bottom:7px;
                ">
                    Other Boundaries
                </div>
        
                <div style="margin-bottom:6px;">
        
                    <span style="
                        display:inline-block;
                        width:30px;
                        border-top:3px solid #000;
                        vertical-align:middle;
                        margin-right:8px;
                    "></span>
        
                    State Boundary
        
                </div>
        
                <div style="margin-bottom:8px;">
        
                    <span style="
                        display:inline-block;
                        width:30px;
                        border-top:3px solid #ff0000;
                        vertical-align:middle;
                        margin-right:8px;
                    "></span>
        
                    Village Boundary
        
                </div>
        
            </div>
        
        
            <div style="
                border-top:1px solid #ccc;
                padding-top:8px;
                margin-top:8px;
                font-size:11px;
                color:#555;
            ">
        
                © OpenStreetMap contributors
        
            </div>
        
        `;

    exportWrap.style.background =
        "#ffffff";

    exportWrap.style.overflow =
        "hidden";

    exportWrap.style.zIndex = "-1";


    const exportMapDiv =
        document.createElement("div");

    exportMapDiv.style.width =
        exportWidth + "px";

    exportMapDiv.style.height =
        exportHeight + "px";

    exportMapDiv.style.background =
        "#ffffff";


        exportWrap.appendChild(exportMapDiv);
        exportWrap.appendChild(exportLegend);

    document.body.appendChild(exportWrap);


    let exportMap = null;


    try {

        // ----------------------------------------------------
        // CREATE EXPORT MAP
        // ----------------------------------------------------

        showDownloadSpinner(
            "Creating map..."
        );


        exportMap = L.map(
            exportMapDiv,
            {
                zoomControl: false,
                attributionControl: false
            }
        );


        // SAME VIEW AS CURRENT MAP

        exportMap.setView(
            map.getCenter(),
            map.getZoom()
        );


        exportMap.invalidateSize(true);


        // ----------------------------------------------------
        // OSM ONLY
        // ----------------------------------------------------

        const exportBase =
            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    crossOrigin: true,
                    attribution:
                        "&copy; OpenStreetMap contributors"
                }
            );


        exportBase.addTo(exportMap);


        // ----------------------------------------------------
        // GWPZ
        // ----------------------------------------------------

        let exportGwpz = null;


        if (
            toggleGwpz &&
            toggleGwpz.checked
        ) {

            exportGwpz =
                L.tileLayer(
                    "/static/gwpz_tiles/{z}/{x}/{y}.png",
                    {
                        tms: true,

                        opacity:
                            gwpz.options.opacity,

                        minZoom: 5,

                        maxNativeZoom: 12,

                        maxZoom: 12,

                        crossOrigin: true
                    }
                );

            exportGwpz.addTo(exportMap);
        }


        // ----------------------------------------------------
        // STATE BOUNDARY
        // ----------------------------------------------------

        let exportStates = null;


        if (
            toggleStates &&
            toggleStates.checked
        ) {

            exportStates =
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

                        opacity: 1
                    }
                );

            exportStates.addTo(exportMap);
        }


        // ----------------------------------------------------
        // WATERSHED
        // ----------------------------------------------------

        let exportWatershed = null;


        if (
            toggleWatershed &&
            toggleWatershed.checked
        ) {

            const level =
                Number(
                    window.currentWatershedLevel
                );


            exportWatershed =
                L.tileLayer.wms(
                    "https://geonode.communitygis.in/geoserver/geonode/wms",
                    {
                        layers:
                            `geonode:india_watershed_level${level}`,

                        format:
                            "image/png",

                        transparent:
                            true,

                        version:
                            "1.1.1",

                        tiled:
                            true,

                        opacity: 1
                    }
                );


            exportWatershed.addTo(
                exportMap
            );
        }


        // ----------------------------------------------------
        // VILLAGE
        // ----------------------------------------------------

        let exportVillage = null;


        if (
            toggleVillage &&
            toggleVillage.checked &&
            villageBoundaryLayer
        ) {

            exportVillage =
                L.geoJSON(
                    villageBoundaryLayer.toGeoJSON(),
                    {
                        style: {
                            color: "#ff0000",
                            weight: 3,
                            fillOpacity: 0
                        }
                    }
                );


            exportVillage.addTo(
                exportMap
            );
        }


        // ----------------------------------------------------
        // LAYER ORDER
        // ----------------------------------------------------

        if (exportGwpz) {
            exportGwpz.bringToFront();
        }

        if (exportStates) {
            exportStates.bringToFront();
        }

        if (exportWatershed) {
            exportWatershed.bringToFront();
        }

        if (exportVillage) {
            exportVillage.bringToFront();
        }


        // ----------------------------------------------------
        // WAIT FOR TILES
        // ----------------------------------------------------

        showDownloadSpinner(
            "Loading map layers..."
        );


        await waitForMapRender(1200);


        exportMap.invalidateSize(true);


        await waitForMapRender(500);


        // ----------------------------------------------------
        // CAPTURE MAP
        // ----------------------------------------------------

        showDownloadSpinner(
            "Creating image..."
        );


        let canvas =
            await html2canvas(
                exportWrap,
                {
                    useCORS: true,

                    allowTaint: false,

                    backgroundColor:
                        "#ffffff",

                    scale: 1.2,

                    logging: false,

                    imageTimeout: 3000
                }
            );


        // ----------------------------------------------------
        // ADD LEGEND
        // ----------------------------------------------------

        canvas =
            addLegendToCanvas(
                canvas
            );


        return canvas;


    } finally {

        if (exportMap) {

            try {
                exportMap.remove();
            } catch (e) {}

        }


        if (
            exportWrap &&
            exportWrap.parentNode
        ) {

            exportWrap.parentNode.removeChild(
                exportWrap
            );

        }

    }

}


// ============================================================
// ADD LEGEND TO EXPORTED IMAGE
// ============================================================

function addLegendToCanvas(originalCanvas) {


    const legendWidth = 250;
    const legendHeight = 205;

    const padding = 20;


    const finalCanvas =
        document.createElement("canvas");


    finalCanvas.width =
        originalCanvas.width;


    finalCanvas.height =
        originalCanvas.height;


    const ctx =
        finalCanvas.getContext("2d");


    // --------------------------------------------------------
    // MAP
    // --------------------------------------------------------

    ctx.drawImage(
        originalCanvas,
        0,
        0
    );


    // --------------------------------------------------------
    // LEGEND POSITION
    // --------------------------------------------------------

    const x =
        finalCanvas.width -
        legendWidth -
        padding;


    const y =
        finalCanvas.height -
        legendHeight -
        padding;


    // White background

    ctx.fillStyle =
        "rgba(255,255,255,0.95)";


    ctx.fillRect(
        x,
        y,
        legendWidth,
        legendHeight
    );


    // Border

    ctx.strokeStyle =
        "#777";

    ctx.lineWidth = 1;


    ctx.strokeRect(
        x,
        y,
        legendWidth,
        legendHeight
    );


    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    ctx.fillStyle =
        "#004466";


    ctx.font =
        "bold 16px Arial";


    ctx.fillText(
        "Legend",
        x + 12,
        y + 25
    );


    // --------------------------------------------------------
    // GWPZ
    // --------------------------------------------------------

    ctx.font =
        "bold 13px Arial";


    ctx.fillStyle =
        "#004466";


    ctx.fillText(
        "Ground Water Priority Zone",
        x + 12,
        y + 48
    );


    const legendItems = [

        {
            color: "#d7191c",
            label: "Critical"
        },

        {
            color: "#fdae61",
            label: "High"
        },

        {
            color: "#ffffbf",
            label: "Moderate"
        },

        {
            color: "#abd9e9",
            label: "Low"
        },

        {
            color: "#2c7bb6",
            label: "Very Low"
        }

    ];


    let itemY = y + 68;


    ctx.font =
        "12px Arial";


    legendItems.forEach(
        item => {

            ctx.fillStyle =
                item.color;


            ctx.fillRect(
                x + 12,
                itemY - 10,
                16,
                16
            );


            ctx.strokeStyle =
                "#555";


            ctx.strokeRect(
                x + 12,
                itemY - 10,
                16,
                16
            );


            ctx.fillStyle =
                "#222";


            ctx.fillText(
                item.label,
                x + 38,
                itemY + 3
            );


            itemY += 23;

        }
    );


    // --------------------------------------------------------
    // WATERSHED
    // --------------------------------------------------------

    ctx.fillStyle =
        "#004466";


    ctx.font =
        "bold 13px Arial";


    ctx.fillText(
        "Watershed Boundary",
        x + 12,
        itemY + 10
    );


    ctx.strokeStyle =
        "#800080";


    ctx.lineWidth = 3;


    ctx.beginPath();


    ctx.moveTo(
        x + 12,
        itemY + 25
    );


    ctx.lineTo(
        x + 42,
        itemY + 25
    );


    ctx.stroke();


    ctx.fillStyle =
        "#222";


    ctx.font =
        "12px Arial";


    ctx.fillText(
        `Selected Watershed - Level ${window.currentWatershedLevel}`,
        x + 50,
        itemY + 29
    );


    return finalCanvas;

}
// ============================================================
// UPDATE WATERSHED LEVEL IN LEGEND
// ============================================================

function updateWatershedLegend(level) {

    const legendLevel =
        document.getElementById("legendWatershedLevel");

    if (legendLevel) {
        legendLevel.textContent = level;
    }
}

// ============================================================
// PNG DOWNLOAD
// ============================================================

async function downloadMapPNG() {

    if (downloadInProgress) {
        return;
    }


    try {

        const canvas =
            await captureMapCanvas();


        if (!canvas) {
            return;
        }


        showDownloadSpinner(
            "Downloading PNG..."
        );


        const link =
            document.createElement("a");


        link.download =
            "gwpz_map.png";


        link.href =
            canvas.toDataURL(
                "image/png"
            );


        document.body.appendChild(
            link
        );


        link.click();


        document.body.removeChild(
            link
        );


        hideDownloadSpinner();


        setDownloadStatus(
            "PNG downloaded successfully."
        );


    } catch (error) {

        console.error(
            "PNG download error:",
            error
        );


        hideDownloadSpinner();


        setDownloadStatus(
            "PNG download failed."
        );


    } finally {

        downloadInProgress = false;

        setDownloadButtonsDisabled(
            false
        );

    }

}


// ============================================================
// PDF DOWNLOAD
// ============================================================

async function downloadMapPDF() {

    if (downloadInProgress) {
        return;
    }


    try {

        const canvas =
            await captureMapCanvas();


        if (!canvas) {
            return;
        }


        showDownloadSpinner(
            "Creating PDF..."
        );


        const imgData =
            canvas.toDataURL(
                "image/png"
            );


        const jsPDF =
            window.jspdf.jsPDF;


        const pdf =
            new jsPDF(
                {
                    orientation:
                        "landscape",

                    unit:
                        "pt",

                    format:
                        "a4"
                }
            );


        const pageWidth =
            pdf.internal.pageSize.getWidth();


        const pageHeight =
            pdf.internal.pageSize.getHeight();


        const ratio =
            Math.min(
                pageWidth /
                    canvas.width,

                pageHeight /
                    canvas.height
            );


        const imgWidth =
            canvas.width * ratio;


        const imgHeight =
            canvas.height * ratio;


        const x =
            (pageWidth -
                imgWidth) / 2;


        const y =
            (pageHeight -
                imgHeight) / 2;


        pdf.addImage(
            imgData,
            "PNG",
            x,
            y,
            imgWidth,
            imgHeight
        );


        pdf.save(
            "gwpz_map.pdf"
        );


        hideDownloadSpinner();


        setDownloadStatus(
            "PDF downloaded successfully."
        );


    } catch (error) {

        console.error(
            "PDF download error:",
            error
        );


        hideDownloadSpinner();


        setDownloadStatus(
            "PDF download failed."
        );


    } finally {

        downloadInProgress = false;

        setDownloadButtonsDisabled(
            false
        );

    }

}


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.downloadMapPNG =
    downloadMapPNG;


window.downloadMapPDF =
    downloadMapPDF;
