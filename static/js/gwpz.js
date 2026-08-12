
// Init map
var map = L.map('map', {
    zoomControl: false
}).setView([22, 78], 6);

L.control.zoom({
    position: 'topright'
}).addTo(map);
L.control.zoom({
    position: 'bottomright'
}).addTo(map);
L.control.scale({
    metric:true,
    imperial:false
}).addTo(map);
map.on("mousemove", function(e){

    document.getElementById("coords-box")
    .innerHTML =

        "Lat : " +
        e.latlng.lat.toFixed(5)

        +

        "<br>Lon : " +
        e.latlng.lng.toFixed(5);

});
// Base layer (use a provider that doesn't block local/test referrers)
// OSM volunteers may block tile loading when the request referrer is missing/localhost.
var baseLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

{
attribution:'OpenStreetMap',
opacity: 0.8,
}
).addTo(map);

// ✅ YOUR TILE LAYER (from Django static)
var gwpz = L.tileLayer('/static/gwpz_tiles/{z}/{x}/{y}.png', {
    tms: true,
    opacity: 0.7,
    minZoom: 5,
    maxNativeZoom: 12,
    maxZoom: 12,
    crossOrigin: true
}).addTo(map);

// Optional control
L.control.layers(null, {
    "gwpz": gwpz
}).addTo(map);

// ✅ India bounds
var indiaBounds = L.latLngBounds(
    [6.5, 68],
    [37.5, 97]
);

// ✅ WMS states layer (FAST)
var statesWMS = L.tileLayer.wms(
    "https://geonode.communitygis.in/geoserver/geonode/wms",
    {
        layers: "geonode:states_in_india",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        tiled: true
    }
).addTo(map);

// ✅ Layer order (VERY IMPORTANT)
statesWMS.bringToFront();   // states above base
gwpz.bringToFront();        // gwpz above states

// ✅ Restrict map to India
map.setMaxBounds(indiaBounds);
// ----------Toggle layers
document.getElementById("toggle-gwpz")
.addEventListener("change", function(){

if(this.checked){
map.addLayer(gwpz);
}else{
map.removeLayer(gwpz);
}

});

// Opacity slider
// -------------------------------
document.getElementById("gwpz-opacity")
.addEventListener("input", function(){

    gwpz.setOpacity(
        this.value / 100
    );

});
// ----------------------------
// State boundary toggle
// -------------------------------
document.getElementById("toggle-states")
.addEventListener("change", function(){

    if(this.checked){
        statesWMS.addTo(map);
    } else {
        map.removeLayer(statesWMS);
    }

});
// -------------------------------
// Village boundary toggle
// -------------------------------
document.getElementById("toggle-village")
.addEventListener("change", function(){

    if(!villageBoundaryLayer) return;

    if(this.checked){
        map.addLayer(villageBoundaryLayer);
    } else {
        map.removeLayer(villageBoundaryLayer);
    }

});
// ---------------------------
// Download map (client-side)
// ---------------------------
function setDownloadStatus(msg) {
    var el = document.getElementById('gwpz-download-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
    if (msg) {
        setTimeout(function() { el.style.display = 'none'; }, 4000);
    }
}
function waitForTiles(layer) {
    return new Promise((resolve) => {
        let loading = true;

        layer.on('load', function () {
            if (loading) {
                loading = false;
                setTimeout(resolve, 800); // small buffer
            }
        });

        // fallback safety
        setTimeout(resolve, 3000);
    });
 }
// var legend = L.control({ position: 'bottomright' });

// legend.onAdd = function () {
//     var div = L.DomUtil.create('div', 'gwpz-legend');

//     div.innerHTML = `
//         <b>GWPZ (0.55 → 5)</b><br>
//         <i style="background:#d7191c"></i> 0.55 – Critical<br>
//         <i style="background:#fdae61"></i> 1.66 – High<br>
//         <i style="background:#ffffbf"></i> 2.77 – Moderate<br>
//         <i style="background:#abd9e9"></i> 3.88 – Low<br>
//         <i style="background:#2c7bb6"></i> 5.00 – Very Low

//         <hr>

//     <b>Watershed Boundary</b><br>

//     <div>
//         <svg width="30" height="10">
//             <line x1="0" y1="5" x2="30" y2="5"
//                   stroke="#800080"
//                   stroke-width="3"/>
//         </svg>
//         Selected Watershed Level
//     </div>
//     `;

    
//     return div;
// };

// legend.addTo(map);
async function captureMapCanvas() {
    setDownloadStatus('Preparing download...');
    var sourceWrap = document.getElementById('map-wrapper');
    if (!sourceWrap) throw new Error('Map wrapper not found');

    // Wait until boundaries are loaded (used in the export map).
    try {
        if (typeof indiaFetchPromise !== 'undefined' && indiaFetchPromise) {
            await indiaFetchPromise;
        }
    } catch (e) {
        console.warn('India boundary not available for export:', e);
    }

    var exportWidth = 1200;
    var exportHeight = 700;   // perfect landscape ratio
    // Off-screen cloned map so downloading doesn't disturb user's zoom/view.
    var exportId = 'gwpz-export-map-' + Date.now();
    var exportWrapId = 'gwpz-export-wrap-' + Date.now();

    var exportWrap = document.createElement('div');
    exportWrap.id = exportWrapId;
    exportWrap.style.position = 'absolute';
    exportWrap.style.left = '-100000px';
    exportWrap.style.top = '0';
    exportWrap.style.width = exportWidth + 'px';
    exportWrap.style.height = exportHeight + 'px';
    exportWrap.style.background = '#ffffff';
    exportWrap.style.zIndex = '0';
    exportWrap.style.overflow = 'hidden';

    var exportMapDiv = document.createElement('div');
    exportMapDiv.id = exportId;
    exportMapDiv.style.width = exportWidth + 'px';
    exportMapDiv.style.height = exportHeight + 'px';

    var exportLabel = document.createElement('div');
    exportLabel.className = 'gwpz-basin-label';
    exportLabel.textContent = 'Godavari Basin';

    exportWrap.appendChild(exportMapDiv);
    exportWrap.appendChild(exportLabel);
    document.body.appendChild(exportWrap);

    var exportMap = null;
    var exportGwpz = null;
    try {
        exportMap = L.map(exportId, { zoomControl: false, attributionControl: false })
            .setView(map.getCenter(), map.getZoom());  // ✅ EXACT SAME VIEW

        setTimeout(() => {
            exportMap.invalidateSize();
        }, 300);
        // Base tiles (Carto) - should allow crossOrigin export.
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap & Carto',
            maxZoom: 12,
            crossOrigin: true
        }).addTo(exportMap);

        exportGwpz = L.tileLayer('/static/gwpz_tiles/{z}/{x}/{y}.png', {
            tms: true,
            opacity: 0.35,
            minZoom: 5,
            maxZoom: 12,
            crossOrigin: true
        }).addTo(exportMap);

        // State boundaries (below gwpz)
        L.tileLayer.wms(
    "https://geonode.communitygis.in/geoserver/geonode/wms",
    {
        layers: "geonode:states_in_india",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        tiled: true
    }
).addTo(exportMap);
        var gwpzBounds = L.latLngBounds(
            [12, 72],   // SW (adjust if needed)
            [22, 82]    // NE
        );

        // exportMap.fitBounds(gwpzBounds, { padding: [20, 20], maxZoom: 8, animate: false });
        
        await new Promise(function(resolve) {
            var resolved = false;
            var fallback = setTimeout(function() {
                if (resolved) return;
                resolved = true;
                resolve();
            }, 2500);
            exportMap.once('moveend', function() {
                if (resolved) return;
                resolved = true;
                clearTimeout(fallback);
                setTimeout(resolve, 1200);
            });
        });

        // Ensure gwpz is on top.
        if (exportGwpz) exportGwpz.bringToFront();

        await waitForTiles(exportGwpz);
        await new Promise(r => setTimeout(r, 500));  // extra safety
        exportMap.invalidateSize();
        var canvas = await html2canvas(exportWrap, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            scale: 2,   // ✅ HIGH QUALITY
            logging: false
        });
        return canvas;
    } finally {
        try { if (exportMap) exportMap.remove(); } catch (e) {}
        try { exportWrap.parentNode && exportWrap.parentNode.removeChild(exportWrap); } catch (e) {}
    }
}

async function downloadMapPNG() {
    try {
        var canvas = await captureMapCanvas();
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'gwpz_map.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setDownloadStatus('PNG downloaded.');
    } catch (e) {
        console.error(e);
        setDownloadStatus('Could not export PNG (tile CORS might block it).');
        alert('Could not export PNG. If you see CORS/tile errors, the tile server may not allow screenshot export.');
    }
}

async function downloadMapPDF() {
    try {
        var canvas = await captureMapCanvas();
        var imgData = canvas.toDataURL('image/png');
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        var pageWidth = pdf.internal.pageSize.getWidth();
        var pageHeight = pdf.internal.pageSize.getHeight();

        // Fit image onto A4 landscape, keeping aspect ratio.
        var ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        var imgW = canvas.width * ratio;
        var imgH = canvas.height * ratio;
        if (imgH > pageHeight) {
            imgH = pageHeight;
            imgW = (canvas.width / canvas.height) * imgH;
        }

        var x = (pageWidth - imgW) / 2;
        var y = (pageHeight - imgH) / 2;
        pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
        pdf.save('gwpz_map.pdf');
        setDownloadStatus('PDF downloaded.');
    } catch (e) {
        console.error(e);
        setDownloadStatus('Could not export PDF (tile CORS might block it).');
        alert('Could not export PDF. If you see CORS/tile errors, the tile server may not allow screenshot export.');
    }
}
//Connect watershed level radio buttons

document
    .getElementById("watershed-level")
    .addEventListener("change", function(){
    loadWatershed(this.value);
});


//watershed levels
let watershedLayer = null;

window.currentWatershedLevel = 5;

function loadWatershed(level){

    if(watershedLayer){
        map.removeLayer(watershedLayer);
    }

    watershedLayer = L.tileLayer.wms(
        "https://geonode.communitygis.in/geoserver/geonode/wms",
        {
            layers: `geonode:india_watershed_level${level}`,
            format: "image/png",
            transparent: true,
            version: "1.1.1",
            tiled: true
        }
    );

    if(document.getElementById("toggle-watershed").checked){
        watershedLayer.addTo(map);
    }

    watershedLayer.bringToFront();
}

map.on("click", function(e){

    if(!map.hasLayer(watershedLayer)) return;

    getWatershedInfo(e.latlng);

});

function getWatershedInfo(latlng){

    const point = map.latLngToContainerPoint(latlng, map.getZoom());
    const size = map.getSize();

    const params = {
        request: "GetFeatureInfo",
        service: "WMS",
        srs: "EPSG:4326",
        styles: "",
        transparent: true,
        version: "1.1.1",
        format: "image/png",
        bbox: map.getBounds().toBBoxString(),
        height: size.y,
        width: size.x,
        layers: `geonode:india_watershed_level${window.currentWatershedLevel}`,
        query_layers: `geonode:india_watershed_level${window.currentWatershedLevel}`,
        info_format: "application/json",
        x: Math.round(point.x),
        y: Math.round(point.y)
    };

    const url =
        "https://geonode.communitygis.in/geoserver/geonode/wms?" +
        L.Util.getParamString(params);

    fetch(url)
        .then(r => r.json())
        .then(r => r.json())
        .then(data => showWatershedPopup(data, latlng));
}

function showWatershedPopup(data){

    if(!data.features.length) return;

    const p = data.features[0].properties;

    L.popup()
        .setLatLng(map.mouseEventToLatLng(window.event))
        .setContent(`
            <b>Watershed Information</b><hr>

            <b>Level:</b> ${window.currentWatershedLevel}<br>
            <b>HYBAS ID:</b> ${p.HYBAS_ID}<br>
            <b>PFAF ID:</b> ${p.PFAF_ID}<br>
            <b>Sub Area:</b> ${p.SUB_AREA} km²<br>
            <b>Upstream Area:</b> ${p.UP_AREA} km²<br>
            <b>Main Basin:</b> ${p.MAIN_BAS}<br>
            <b>Next Down:</b> ${p.NEXT_DOWN}<br>
            <b>Coastal:</b> ${p.COAST==1?"Yes":"No"}
        `)
        .openOn(map);

}

// loadWatershed(5);
document.getElementById("toggle-watershed")
.addEventListener("change", function(){

    if(!watershedLayer) return;

    if(this.checked){
        map.addLayer(watershedLayer);
    }else{
        map.removeLayer(watershedLayer);
    }

});
// map.fitBounds(indiaBounds);

/* =====================================================
   Shared Location Filter Callback
===================================================== */

let villageBoundaryLayer = null;

window.onVillageSelected = function (geojson) {

    if (villageBoundaryLayer) {
        map.removeLayer(villageBoundaryLayer);
    }

    villageBoundaryLayer = L.geoJSON(geojson, {
        style: {
            color: "#ff0000",
            weight: 3,
            fillOpacity: 0
        }
    });

    if (document.getElementById("toggle-village").checked) {
        villageBoundaryLayer.addTo(map);
    }

    if (villageBoundaryLayer.getBounds().isValid()) {
        map.fitBounds(villageBoundaryLayer.getBounds(), {
            maxZoom: 12,
            padding: [20, 20]
        });
    }

    // Maintain drawing order
    if (statesWMS) statesWMS.bringToFront();
    if (watershedLayer) watershedLayer.bringToFront();
    if (villageBoundaryLayer) villageBoundaryLayer.bringToFront();
};