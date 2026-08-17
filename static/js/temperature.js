// ============================================================
// TEMPERATURE MONITORING
// Maharashtra District Tmax
// ============================================================


// ============================================================
// MAP INITIALIZATION
// ============================================================

const map = L.map("temperatureMap", {
    zoomControl: true
});


// ============================================================
// BASE MAP
// ============================================================

const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "© OpenStreetMap",
        opacity: 0.8
    }
).addTo(map);


// ============================================================
// GEONODE STATES
// ============================================================

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


// ============================================================
// INITIAL MAHARASHTRA VIEW
// ============================================================

map.setView(
    [19.7515, 75.7139],
    6
);


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let districtLayer = null;

let temperatureData = {};

let currentAggregation = "daily";


// ============================================================
// DOM ELEMENTS
// IMPORTANT: THESE MATCH temperature.html
// ============================================================

const aggregationOptions =
    document.querySelectorAll(
        'input[name="temperatureAggregation"]'
    );


    const dailyDateContainer =
    document.getElementById(
        "daily-date-container"
    );


const aggregationPeriodContainer =
    document.getElementById(
        "aggregation-period-container"
    );


const aggregationYear =
    document.getElementById(
        "aggregationYear"
    );


const aggregationPeriod =
    document.getElementById(
        "aggregationPeriod"
    );


const startDate =
    document.getElementById(
        "startDate"
    );


const endDate =
    document.getElementById(
        "endDate"
    );

// ============================================================
// GEONODE
// ============================================================

const GEONODE_WFS =
    "https://geonode.communitygis.in/geoserver/geonode/ows";


const DISTRICT_LAYER =
    "geonode:maharashtra_districts";


// ============================================================
// AVAILABLE YEARS
// ============================================================

function populateYears() {

    if (!aggregationYear) {
        return;
    }

    aggregationYear.innerHTML = "";

    /*
       Change these years according to your
       actual temperature dataset.
    */

    for (
        let year = 2023;
        year >= 1981;
        year--
    ) {

        const option =
            document.createElement("option");

        option.value = String(year);

        option.textContent = String(year);

        aggregationYear.appendChild(option);
    }

    aggregationYear.value = "2023";
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ============================================================
// GET WEEK DATES
// ============================================================

function getWeekDates(year, week) {

    const start =
        new Date(
            year,
            0,
            1
        );

    start.setDate(
        start.getDate() +
        (week - 1) * 7
    );

    const end =
        new Date(start);

    end.setDate(
        end.getDate() + 6
    );

    const lastDay =
        new Date(
            year,
            11,
            31
        );

    if (end > lastDay) {
        end.setTime(
            lastDay.getTime()
        );
    }

    return {

        start:
            formatDate(start),

        end:
            formatDate(end)
    };
}


// ============================================================
// POPULATE PERIODS
// ============================================================

function populateAggregationPeriods(
    aggregation
) {

    if (!aggregationPeriod) {
        return;
    }

    aggregationPeriod.innerHTML = "";


    // ========================================================
    // WEEKLY
    // ========================================================

    if (aggregation === "weekly") {

        const year =
            parseInt(
                aggregationYear.value
            );

        for (
            let week = 1;
            week <= 52;
            week++
        ) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(week);

            const dates =
                getWeekDates(
                    year,
                    week
                );

            option.textContent =
                `Week ${week} (${dates.start} – ${dates.end})`;

            aggregationPeriod.appendChild(
                option
            );
        }

        aggregationPeriod.value = "1";

        return;
    }


    // ========================================================
    // MONTHLY
    // ========================================================

    if (aggregation === "monthly") {

        const months = [

            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"

        ];

        months.forEach(
            (month, index) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    String(index + 1);

                option.textContent =
                    month;

                aggregationPeriod.appendChild(
                    option
                );
            }
        );

        aggregationPeriod.value = "1";

        return;
    }


    // ========================================================
    // SEASONAL
    // ========================================================

    if (aggregation === "seasonal") {

        const seasons = [

            {
                value: "winter",
                label: "Winter (Jan–Feb)"
            },

            {
                value: "summer",
                label: "Summer /Pre-monsoon (Mar–May)"
            },

            {
                value: "monsoon",
                label: "Monsoon (Jun–Sep)"
            },

            {
                value: "post-monsoon",
                label: "Post-monsoon (Oct–Dec)"
            }

        ];

        seasons.forEach(
            season => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    season.value;

                option.textContent =
                    season.label;

                aggregationPeriod.appendChild(
                    option
                );
            }
        );

        aggregationPeriod.value =
            "monsoon";

        return;
    }


    // ========================================================
    // ANNUAL
    // ========================================================

    if (aggregation === "annual") {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            "annual";

        option.textContent =
            "Annual";

        aggregationPeriod.appendChild(
            option
        );

        aggregationPeriod.value =
            "annual";
    }
}


// ============================================================
// NORMALIZE DISTRICT NAME
// CSV → SHAPEFILE
// ============================================================

function normalizeDistrict(name) {

    if (
        name === null ||
        name === undefined
    ) {
        return "";
    }

    const district =
        name
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");


    const districtMap = {

        // --------------------------------------------
        // Name differences
        // --------------------------------------------

        "ahmadnagar":
            "ahmednagar",

        "ahmednagar":
            "ahmednagar",


        "bid":
            "beed",

        "beed":
            "beed",


        "aurangabad":
            "chhatrapati sambhajinagar",

        "chhatrapati sambhajinagar":
            "chhatrapati sambhajinagar",


        "osmanabad":
            "dharashiv",

        "dharashiv":
            "dharashiv",


        "garhchiroli":
            "gadchiroli",

        "gadchiroli":
            "gadchiroli",


        "gondiya":
            "gondia",

        "gondia":
            "gondia",


        "raigarh":
            "raigad",

        "raigad":
            "raigad",


        "mumbai suburban":
            "mumbai suburban",

        "mumbai_suburb":
            "mumbai suburban"

    };


    return (
        districtMap[district] ||
        district
    );
}


// ============================================================
// LOAD DISTRICT BOUNDARIES
// ============================================================

async function loadDistrictBoundaries() {

    const url =
        GEONODE_WFS +
        "?service=WFS" +
        "&version=1.0.0" +
        "&request=GetFeature" +
        "&typeName=" +
        encodeURIComponent(
            DISTRICT_LAYER
        ) +
        "&outputFormat=application/json" +
        "&srsName=EPSG:4326";


    console.log(
        "Loading district boundaries:",
        url
    );


    try {

        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                `District WFS failed: ${response.status}`
            );
        }


        const geojson =
            await response.json();


        console.log(
            "District boundaries loaded:",
            geojson
        );


        // ----------------------------------------------------
        // CHECK DISTRICT FIELD
        // ----------------------------------------------------

        if (
            geojson.features &&
            geojson.features.length > 0
        ) {

            console.log(
                "First district properties:",
                geojson.features[0].properties
            );
        }


        districtLayer =
            L.geoJSON(
                geojson,
                {

                    style:
                        districtDefaultStyle,

                    onEachFeature:
                        districtFeature

                }
            ).addTo(map);


        if (
            districtLayer
                .getBounds()
                .isValid()
        ) {

            map.fitBounds(
                districtLayer.getBounds(),
                {
                    padding: [
                        20,
                        20
                    ]
                }
            );
        }


        // ----------------------------------------------------
        // LOAD DATA AFTER SHAPEFILE
        // ----------------------------------------------------

        await loadTemperature();

    }
    catch (error) {

        console.error(
            "District boundary error:",
            error
        );
    }
}


// ============================================================
// DEFAULT DISTRICT STYLE
// ============================================================

function districtDefaultStyle() {

    return {

        fillColor:
            "#eeeeee",

        fillOpacity:
            0.6,

        color:
            "#555555",

        weight:
            1
    };
}


// ============================================================
// GET DISTRICT NAME FROM FEATURE
// ============================================================

function getDistrictName(feature) {

    const properties =
        feature.properties || {};


    /*
       Your GeoNode layer may use a different
       property name.

       We check several common possibilities.
    */

    return (
        properties.district ||
        properties.DISTRICT ||
        properties.dist_name ||
        properties.DIST_NAME ||
        properties.name ||
        properties.NAME ||
        ""
    );
}


// ============================================================
// DISTRICT FEATURE
// ============================================================

function districtFeature(
    feature,
    layer
) {

    const district =
        getDistrictName(
            feature
        );


    console.log(
        "District:",
        district
    );


    layer.on({

        mouseover:
            function () {

                layer.setStyle({

                    weight:
                        2,

                    color:
                        "#222222"
                });

                layer.bringToFront();
            },


        mouseout:
            function () {

                updateDistrictStyle(
                    layer,
                    district
                );
            },


        click:
            function () {

                showDistrictInfo(
                    layer,
                    district
                );
            }

    });


    updateDistrictStyle(
        layer,
        district
    );
}


// ============================================================
// TEMPERATURE COLOUR
// ============================================================

function getTemperatureColor(
    temperature
) {

    if (
        temperature === null ||
        temperature === undefined ||
        temperature === "" ||
        isNaN(Number(temperature))
    ) {

        return "#d9d9d9";
    }


    temperature =
        Number(temperature);


    if (temperature < 20) {
        return "#ffffcc";
    }

    if (temperature < 25) {
        return "#ffeda0";
    }

    if (temperature < 30) {
        return "#feb24c";
    }

    if (temperature < 35) {
        return "#f03b20";
    }

    return "#bd0026";
}


// ============================================================
// AGGREGATION LABEL
// ============================================================

function getAggregationLabel() {

    switch (
        currentAggregation
    ) {

        case "daily":
            return "Average Daily Tmax";

        case "weekly":
            return "Weekly Average Tmax";

        case "monthly":
            return "Monthly Average Tmax";

        case "seasonal":
            return "Seasonal Average Tmax";

        case "annual":
            return "Annual Average Tmax";

        default:
            return "Temperature";
    }
}


// ============================================================
// UPDATE DISTRICT STYLE
// ============================================================

function updateDistrictStyle(
    layer,
    district
) {

    const normalized =
        normalizeDistrict(
            district
        );


    const value =
        temperatureData[
            normalized
        ];


    const numericValue =
        value === null ||
        value === undefined ||
        value === ""
            ? null
            : Number(value);


    const hasData =
        numericValue !== null &&
        !isNaN(numericValue);


    layer.setStyle({

        fillColor:
            hasData
                ? getTemperatureColor(
                    numericValue
                )
                : "#d9d9d9",

        fillOpacity:
            hasData
                ? 0.75
                : 0.35,

        color:
            "#555555",

        weight:
            1
    });


    const label =
        getAggregationLabel();


    const displayValue =
        hasData
            ? `${numericValue.toFixed(2)} °C`
            : "No data";


    layer.bindTooltip(
        `<strong>${district}</strong>
         <br>
         ${label}: ${displayValue}`,
        {
            sticky: true
        }
    );
}


// ============================================================
// UPDATE ENTIRE MAP
// ============================================================

function updateMapStyles() {

    if (!districtLayer) {

        console.warn(
            "District layer is not loaded yet"
        );

        return;
    }


    districtLayer.eachLayer(
        layer => {

            const district =
                getDistrictName(
                    layer.feature
                );


            updateDistrictStyle(
                layer,
                district
            );
        }
    );
}


// ============================================================
// LOAD TEMPERATURE FROM API
// ============================================================

async function loadTemperature() {

    let url = "";


    // ========================================================
    // DAILY
    // ========================================================

    if (
        currentAggregation ===
        "daily"
    ) {

        const start =
            startDate
                ? startDate.value
                : null;


        const end =
            endDate
                ? endDate.value
                : null;


        if (!start || !end) {

            console.warn(
                "Daily dates missing"
            );

            return;
        }


        url =
            `/api/temperature-districts/` +
            `?aggregation=daily` +
            `&start_date=${encodeURIComponent(start)}` +
            `&end_date=${encodeURIComponent(end)}`;
    }


    // ========================================================
    // WEEKLY / MONTHLY / SEASONAL / ANNUAL
    // ========================================================

    else {

        const year =
            aggregationYear
                ? aggregationYear.value
                : null;


        const period =
            aggregationPeriod
                ? aggregationPeriod.value
                : null;


        if (!year || !period) {

            console.warn(
                "Year or period missing"
            );

            return;
        }


        url =
            `/api/temperature-districts/` +
            `?aggregation=${encodeURIComponent(
                currentAggregation
            )}` +
            `&year=${encodeURIComponent(year)}` +
            `&period=${encodeURIComponent(period)}`;
    }


    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
        "================================="
    );

    console.log(
        "TEMPERATURE REQUEST"
    );

    console.log(
        "Aggregation:",
        currentAggregation
    );

    console.log(
        "API URL:",
        url
    );

    console.log(
        "================================="
    );


    // ========================================================
    // FETCH
    // ========================================================

    try {

        const response =
            await fetch(url);


        const responseText =
            await response.text();


        console.log(
            "HTTP STATUS:",
            response.status
        );


        console.log(
            "API RESPONSE:",
            responseText
        );


        if (!response.ok) {

            console.error(
                "Temperature API error:",
                response.status,
                responseText
            );

            return;
        }


        let result;


        try {

            result =
                JSON.parse(
                    responseText
                );

        }
        catch (error) {

            console.error(
                "Invalid JSON response:",
                responseText
            );

            return;
        }


        console.log(
            "Temperature result:",
            result
        );


        // ====================================================
        // CLEAR OLD DATA
        // ====================================================

        temperatureData = {};


        // ====================================================
        // STORE NEW DATA
        // ====================================================

        if (
            result.data &&
            Array.isArray(
                result.data
            )
        ) {

            result.data.forEach(
                item => {

                    const district =
                        normalizeDistrict(
                            item.district
                        );


                    const value =
                        item.value;


                    temperatureData[
                        district
                    ] = value;
                }
            );
        }


        console.log(
            "Temperature data:",
            temperatureData
        );


        // ====================================================
        // UPDATE MAP
        // ====================================================

        updateMapStyles();


        // ====================================================
        // UPDATE LEGEND
        // ====================================================

        updateTemperatureLegend();

    }
    catch (error) {

        console.error(
            "Temperature fetch error:",
            error
        );
    }
}


// ============================================================
// UPDATE LEGEND
// ============================================================

function updateTemperatureLegend() {

    const title =
        document.getElementById(
            "legendAggregationTitle"
        );


    const label1 =
        document.getElementById(
            "legendLabel1"
        );


    const label2 =
        document.getElementById(
            "legendLabel2"
        );


    const label3 =
        document.getElementById(
            "legendLabel3"
        );


    const label4 =
        document.getElementById(
            "legendLabel4"
        );


    const label5 =
        document.getElementById(
            "legendLabel5"
        );


    const noData =
        document.getElementById(
            "legendLabelNoData"
        );


    if (title) {

        title.textContent =
            getAggregationLabel();
    }


    if (label1) {
        label1.textContent =
            "< 20 °C";
    }


    if (label2) {
        label2.textContent =
            "20 – 25 °C";
    }


    if (label3) {
        label3.textContent =
            "25 – 30 °C";
    }


    if (label4) {
        label4.textContent =
            "30 – 35 °C";
    }


    if (label5) {
        label5.textContent =
            "35 – 40 °C";
    }


    
    if (noData) {

        noData.textContent =
            "No data";
    }
}


// ============================================================
// SET AGGREGATION
// ============================================================

function setAggregation(
    aggregation
) {

    currentAggregation =
        aggregation;


    updateTemperatureLegend();


    // ========================================================
    // DAILY
    // ========================================================

    if (
        aggregation ===
        "daily"
    ) {

        if (dailyDateContainer) {

            dailyDateContainer.style.display =
                "flex";
        }


        if (aggregationPeriodContainer) {

            aggregationPeriodContainer.style.display =
                "none";
        }


        loadTemperature();

        return;
    }


    // ========================================================
    // OTHER
    // ========================================================

    if (dailyDateContainer) {

        dailyDateContainer.style.display =
            "none";
    }


    if (aggregationPeriodContainer) {

        aggregationPeriodContainer.style.display =
            "flex";
    }


    populateYears();


    populateAggregationPeriods(
        aggregation
    );


    loadTemperature();
}


// ============================================================
// RADIO EVENTS
// ============================================================

aggregationOptions.forEach(
    radio => {

        radio.addEventListener(
            "change",
            function () {

                if (this.checked) {

                    setAggregation(
                        this.value
                    );
                }
            }
        );
    }
);


// ============================================================
// YEAR CHANGE
// ============================================================

if (aggregationYear) {

    aggregationYear.addEventListener(
        "change",
        function () {

            if (
                currentAggregation !==
                "daily"
            ) {

                populateAggregationPeriods(
                    currentAggregation
                );

                loadTemperature();
            }
        }
    );
}


// ============================================================
// PERIOD CHANGE
// ============================================================

if (aggregationPeriod) {

    aggregationPeriod.addEventListener(
        "change",
        function () {

            if (
                currentAggregation !==
                "daily"
            ) {

                loadTemperature();
            }
        }
    );
}


// ============================================================
// START DATE
// ============================================================

if (startDate) {

    startDate.addEventListener(
        "change",
        function () {

            if (
                currentAggregation ===
                "daily"
            ) {

                loadTemperature();
            }
        }
    );
}


// ============================================================
// END DATE
// ============================================================

if (endDate) {

    endDate.addEventListener(
        "change",
        function () {

            if (
                currentAggregation ===
                "daily"
            ) {

                loadTemperature();
            }
        }
    );
}


// ============================================================
// DISTRICT POPUP
// ============================================================

function showDistrictInfo(
    layer,
    district
) {

    const value =
        temperatureData[
            normalizeDistrict(
                district
            )
        ];


    const numericValue =
        value === null ||
        value === undefined ||
        value === ""
            ? null
            : Number(value);


    const hasData =
        numericValue !== null &&
        !isNaN(numericValue);


    const displayValue =
        hasData
            ? `${numericValue.toFixed(2)} °C`
            : "No data";


    const label =
        getAggregationLabel();


    layer.bindPopup(

        `<div class="temperature-popup">

            <h6>
                ${district}
            </h6>

            <div>
                ${label}
            </div>

            <strong>
                ${displayValue}
            </strong>

        </div>`

    ).openPopup();
}


// ============================================================
// DEFAULT DATE
// ============================================================

function setDefaultDates() {

    if (startDate) {
        startDate.value = "2023-01-01";
    }

    if (endDate) {
        endDate.value = "2023-12-31";
    }

    console.log(
        "Default temperature dates:",
        startDate ? startDate.value : null,
        endDate ? endDate.value : null
    );
}


// ============================================================
// INITIALIZE
// ============================================================

function initializeTemperature() {

    console.log(
        "Initializing Temperature Monitoring"
    );


    setDefaultDates();


    populateYears();


    aggregationOptions.forEach(
        radio => {

            radio.checked =
                radio.value === "daily";
        }
    );


    currentAggregation =
        "daily";


    if (dailyDateContainer) {

        dailyDateContainer.style.display =
            "flex";
    }


    if (aggregationPeriodContainer) {

        aggregationPeriodContainer.style.display =
            "none";
    }


    updateTemperatureLegend();


    loadDistrictBoundaries();
}


// ============================================================
// START
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    initializeTemperature();
});