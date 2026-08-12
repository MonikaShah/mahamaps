// ======================================
// Forest Fire Monitoring
// ======================================
const map = L.map("map", {
    zoomControl: true,
    attributionControl: true
}).setView([19.75, 75.30], 7);



// ======================================
// Google Satellite
// ======================================

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

{
attribution:'OpenStreetMap',
opacity: 0.8,
}
).addTo(map);


// ======================================
// India States Boundary
// ======================================

const statesWMS = L.tileLayer.wms(
    "https://geonode.communitygis.in/geoserver/geonode/wms",
    {
        layers: "geonode:states_in_india",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        tiled: true
    }
).addTo(map);


// ======================================
// Restrict Map to India
// ======================================

map.setMaxBounds([
    [6.0, 67.0],
    [38.5, 98.0]
]);


// ======================================
// Global Variables
// ======================================

let freqLayer;
let hotspotLayer;
let fireCountLayer;
let villageBoundaryLayer;

let layersLoaded = 0;


// ======================================
// Loading Screen
// ======================================

function layerFinished() {

    layersLoaded++;

    if (layersLoaded >= 3) {

        const loading = document.getElementById("loading");

        if (loading) {
            loading.style.display = "none";
        }
    }
}


// ======================================
// Village Boundary
// ======================================

window.onVillageSelected = function(data) {

    if (villageBoundaryLayer) {
        map.removeLayer(villageBoundaryLayer);
    }

    villageBoundaryLayer = L.geoJSON(data, {
        style: {
            color: "#ff0000",
            weight: 3,
            fillOpacity: 0
        }
    }).addTo(map);

    const bounds = villageBoundaryLayer.getBounds();

    if (bounds.isValid()) {
        map.fitBounds(bounds, {
            maxZoom: 12
        });
    }

};


// ======================================
// Fire Frequency WMS
// ======================================

freqLayer = L.tileLayer.wms(
    "https://geonode.communitygis.in/geoserver/geonode/wms",
    {
        layers: "geonode:frequency",   // <-- Change to your layer
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        tiled: true,
        opacity: 0.65
    }
);
map.getContainer().style.cursor = "crosshair";
layerFinished();

// ======================================
// Fire Frequency Class
// ======================================

function getFireClass(value){

    if(value < 0.08) return "Very Low";
    if(value < 0.12) return "Low";
    if(value < 0.18) return "Moderate";
    if(value < 0.30) return "Moderately High";
    if(value < 0.60) return "High";
    if(value < 1.00) return "Very High";
    if(value < 2.00) return "Severe";

    return "Critical";
}


// ======================================
// GetFeatureInfo Popup
// ======================================

map.on("click", function (e) {

    if (!map.hasLayer(freqLayer)) return;

    const size = map.getSize();
    const bounds = map.getBounds();
    const point = map.latLngToContainerPoint(e.latlng);

    const url =
        "https://geonode.communitygis.in/geoserver/geonode/wms?" +
        "SERVICE=WMS" +
        "&VERSION=1.1.1" +
        "&REQUEST=GetFeatureInfo" +
        "&LAYERS=geonode:frequency" +
        "&QUERY_LAYERS=geonode:frequency" +
        "&STYLES=" +
        "&BBOX=" + bounds.toBBoxString() +
        "&WIDTH=" + size.x +
        "&HEIGHT=" + size.y +
        "&SRS=EPSG:4326" +
        "&X=" + Math.round(point.x) +
        "&Y=" + Math.round(point.y) +
        "&INFO_FORMAT=application/json" +
        "&FEATURE_COUNT=1";

    fetch(url)
    .then(r => r.json())
    .then(data => {

        if (!data.features || data.features.length === 0) {

            L.popup()
                .setLatLng(e.latlng)
                .setContent("<b>No fire frequency data</b>")
                .openOn(map);

            return;
        }

        const props = data.features[0].properties;

        const value =
            Number(
                props.GRAY_INDEX ??
                props.value ??
                props.Band1 ??
                Object.values(props)[0]
            );

        const cls = getFireClass(value);

        L.popup({
            maxWidth:260
        })
        .setLatLng(e.latlng)
        .setContent(`
        <div style="font-family:Arial">

            <h6 style="
                color:#b30000;
                margin-bottom:10px;">
                🔥 Forest Fire Frequency
            </h6>

            <table style="width:100%;font-size:13px">

                <tr>
                    <td><b>Average Annual</b></td>
                    <td>${value.toFixed(3)} / year</td>
                </tr>

                <tr>
                    <td><b>Category</b></td>
                    <td>
                        <span style="
                            background:#f46d43;
                            color:white;
                            padding:3px 10px;
                            border-radius:12px;
                            font-weight:bold;">
                            ${cls}
                        </span>
                    </td>
                </tr>

                <tr>
                    <td><b>Latitude</b></td>
                    <td>${e.latlng.lat.toFixed(5)}</td>
                </tr>

                <tr>
                    <td><b>Longitude</b></td>
                    <td>${e.latlng.lng.toFixed(5)}</td>
                </tr>

            </table>

        </div>
        `)
        .openOn(map);

    });

});
// ======================================
// Fire Hotspots WMS
// ======================================

hotspotLayer = L.tileLayer.wms(
    "https://geonode.communitygis.in/geoserver/geonode/wms",
    {
        layers: "geonode:hotspots",    // <-- Change to your layer
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        tiled: true,
        opacity: 1.0
    }
);

// hotspotLayer.bringToFront();

layerFinished();

function getHotspotClass(v){

    // Gi* z-score

    if(v >= 2.58){
        return {
            label:"99% Hotspot",
            colour:"#b30000",
            meaning:"Very strong hotspot"
        };
    }

    if(v >= 1.96){
        return {
            label:"95% Hotspot",
            colour:"#ff6600",
            meaning:"Strong hotspot"
        };
    }

    if(v <= -2.58){
        return {
            label:"99% Coldspot",
            colour:"#006837",
            meaning:"Very strong coldspot"
        };
    }

    if(v <= -1.96){
        return {
            label:"95% Coldspot",
            colour:"#66bd63",
            meaning:"Strong coldspot"
        };
    }

    return {
        label:"Not Significant",
        colour:"#999999",
        meaning:"No significant clustering"
    };

}

// ======================================
// Hotspot GetFeatureInfo Popup (Gi* Raster)
// ======================================

map.on("click", function (e) {

    if (!map.hasLayer(hotspotLayer)) return;

    const size = map.getSize();
    const bounds = map.getBounds();
    const point = map.latLngToContainerPoint(e.latlng);

    const url =
        "https://geonode.communitygis.in/geoserver/geonode/wms?" +
        "SERVICE=WMS" +
        "&VERSION=1.1.1" +
        "&REQUEST=GetFeatureInfo" +
        "&LAYERS=geonode:hotspots" +
        "&QUERY_LAYERS=geonode:hotspots" +
        "&STYLES=" +
        "&BBOX=" + bounds.toBBoxString() +
        "&WIDTH=" + size.x +
        "&HEIGHT=" + size.y +
        "&SRS=EPSG:4326" +
        "&X=" + Math.round(point.x) +
        "&Y=" + Math.round(point.y) +
        "&INFO_FORMAT=application/json" +
        "&FEATURE_COUNT=1";

    fetch(url)
        .then(r => r.json())
        .then(data => {

            if (!data.features || data.features.length === 0) {

                L.popup()
                    .setLatLng(e.latlng)
                    .setContent("<b>No hotspot information available.</b>")
                    .openOn(map);

                return;
            }

            const props = data.features[0].properties;

            const z =
                Number(
                    props.GRAY_INDEX ??
                    props.value ??
                    props.Band1 ??
                    Object.values(props)[0]
                );

            const cls = getHotspotClass(z);

            L.popup({
                maxWidth: 320
            })
            .setLatLng(e.latlng)
            .setContent(`
            <div style="font-family:Arial">

                <h5 style="margin:0 0 10px;color:#b30000;">
                    🔥 Forest Fire Hotspot
                </h5>

                <table style="width:100%;font-size:13px">

                    <tr>
                        <td><b>Gi* Z-score</b></td>
                        <td>${z.toFixed(2)}</td>
                    </tr>

                    <tr>
                        <td><b>Hotspot Class</b></td>
                        <td>
                            <span style="
                                background:${cls.colour};
                                color:white;
                                padding:4px 10px;
                                border-radius:12px;
                                font-weight:bold;">
                                ${cls.label}
                            </span>
                        </td>
                    </tr>

                    <tr>
                        <td><b>Interpretation</b></td>
                        <td>${cls.meaning}</td>
                    </tr>

                    <tr>
                        <td><b>Latitude</b></td>
                        <td>${e.latlng.lat.toFixed(5)}</td>
                    </tr>

                    <tr>
                        <td><b>Longitude</b></td>
                        <td>${e.latlng.lng.toFixed(5)}</td>
                    </tr>

                </table>

            </div>
            `)
            .openOn(map);

        })
        .catch(err => {
            console.error(err);
        });

}); 
// ======================================
// Fire Count WMS
// ======================================

fireCountLayer = L.tileLayer.wms(
    "https://geonode.communitygis.in/geoserver/geonode/wms",
    {
        layers: "geonode:firecount_5aug235",
        styles: "",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        tiled: true,
        opacity: 0.75
    }
);

console.log("Fire Count layer created:", fireCountLayer);

// Uncomment if you want it visible by default
// fireCountLayer.addTo(map);

layerFinished();

freqLayer.setZIndex(10);
hotspotLayer.setZIndex(20);
fireCountLayer.setZIndex(30);
statesWMS.setZIndex(40);

// ======================================
// Fire Count GetFeatureInfo Popup
// ======================================

map.on("click", function (e) {

    if (!map.hasLayer(fireCountLayer)) return;

    const size = map.getSize();
    const bounds = map.getBounds();
    const point = map.latLngToContainerPoint(e.latlng);

    const url =
        "https://geonode.communitygis.in/geoserver/geonode/wms?" +
        "SERVICE=WMS" +
        "&VERSION=1.1.1" +
        "&REQUEST=GetFeatureInfo" +
        "&LAYERS=geonode:firecount_5aug235" +
        "&QUERY_LAYERS=geonode:firecount_5aug235" +
        "&STYLES=" +
        "&BBOX=" + bounds.toBBoxString() +
        "&WIDTH=" + size.x +
        "&HEIGHT=" + size.y +
        "&SRS=EPSG:4326" +
        "&X=" + Math.round(point.x) +
        "&Y=" + Math.round(point.y) +
        "&INFO_FORMAT=application/json" +
        "&FEATURE_COUNT=1";

    fetch(url)
        .then(r => r.json())
        .then(data => {

            if (!data.features || data.features.length === 0) return;

            const p = data.features[0].properties;

            L.popup({
                maxWidth: 340
            })
            .setLatLng(e.latlng)
            .setContent(`
            <div style="font-family:Arial">

                <h5 style="margin:0 0 10px;color:#b30000;">
                    🔥 Fire Count
                </h5>

                <table class="table table-sm table-bordered"
                       style="margin-bottom:0;font-size:13px">

                    <tr>
                        <th>Tehsil</th>
                        <td>${p.tehsil ?? "-"}</td>
                    </tr>

                    <tr>
                        <th>Acquisition Date</th>
                        <td>${p.acq_date ?? "-"}</td>
                    </tr>

                    <tr>
                        <th>Satellite</th>
                        <td>${p.satellite ?? "-"}</td>
                    </tr>

                    <tr>
                        <th>Instrument</th>
                        <td>${p.instrument ?? "-"}</td>
                    </tr>

                    <tr>
                        <th>Fire Count</th>
                        <td>${p.join_count ?? "-"}</td>
                    </tr>

                    <tr>
                        <th>Average Frequency per Year</th>
                        <td>${p.joint_aver ?? "-"}</td>
                    </tr>

                </table>

            </div>
            `)
            .openOn(map);

        })
        .catch(console.error);

});
// ======================================
// Keep Hotspots Above Frequency
// ======================================

// map.on("layeradd", function () {
//     if (map.hasLayer(freqLayer))
//         freqLayer.bringToBack();

//     if (map.hasLayer(fireCountLayer))
//         fireCountLayer.bringToFront();

//     if (map.hasLayer(hotspotLayer)) {
//         hotspotLayer.bringToFront();
//     }

//     if (map.hasLayer(statesWMS)) {
//         statesWMS.bringToFront();
//     }

// });

const legendToggle = document.getElementById("legendToggle");
const legendContent = document.getElementById("legendContent");

legendToggle.onclick = function(){

    if(legendContent.style.display==="none"){

        legendContent.style.display="block";
        legendToggle.innerHTML="−";

    }else{

        legendContent.style.display="none";
        legendToggle.innerHTML="+";
    }

};

function updateLegend(){

    document.getElementById("freqLegend").style.display =
        map.hasLayer(freqLayer) ? "block":"none";

    document.getElementById("hotspotLegend").style.display =
        map.hasLayer(hotspotLayer) ? "block":"none";

    document.getElementById("firecountLegend").style.display =
        map.hasLayer(fireCountLayer) ? "block":"none";

}

// ======================================
// Layer Toggle
// ======================================

const freqCheck = document.getElementById("freqCheck");
const hotspotCheck = document.getElementById("hotspotCheck");
const firecountCheck = document.getElementById("firecountCheck");


freqCheck.addEventListener("change", function () {

    console.log("Frequency checkbox:", this.checked);

    if (this.checked) {
        map.addLayer(freqLayer);
        freqLayer.setOpacity(0.65);
    } else {
        map.removeLayer(freqLayer);
    }

    updateLegend();
});


hotspotCheck.addEventListener("change", function () {

    if (this.checked) {
        map.addLayer(hotspotLayer);
        hotspotLayer.bringToFront();
    } else {
        map.removeLayer(hotspotLayer);
    }

    updateLegend();
});


firecountCheck.addEventListener("change", function () {

    if (this.checked) {
        map.addLayer(fireCountLayer);
        fireCountLayer.bringToFront();
    } else {
        map.removeLayer(fireCountLayer);
    }

    updateLegend();
});

// ======================================
// Initial Layer State
// ======================================

if (freqCheck.checked) {
    map.addLayer(freqLayer);
}

if (hotspotCheck.checked) {
    map.addLayer(hotspotLayer);
}

if (firecountCheck.checked) {
    map.addLayer(fireCountLayer);
}



updateLegend();