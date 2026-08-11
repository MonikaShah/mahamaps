// ============================================================
// RAINFALL MONITORING
// Maharashtra District Rainfall
// ============================================================


// ============================================================
// MAP INITIALIZATION
// ============================================================

const map = L.map("rainfallMap", {
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


// Initial Maharashtra view
map.setView(
    [19.7515, 75.7139],
    6
);


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let districtLayer = null;

let rainfallData = {};

let currentAggregation = "daily";

let rainfallRequestNumber = 0;


// ============================================================
// DOM ELEMENTS
// ============================================================

const aggregationOptions =
    document.querySelectorAll(
        'input[name="rainfallAggregation"]'
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

const legendAggregationTitle =
    document.getElementById(
        "legendAggregationTitle"
    );


// ============================================================
// DEBUG - CHECK ELEMENTS
// ============================================================

console.log(
    "Rainfall JS loaded"
);

console.log(
    "Aggregation radios:",
    aggregationOptions.length
);

console.log(
    "Daily container:",
    dailyDateContainer
);

console.log(
    "Period container:",
    aggregationPeriodContainer
);

console.log(
    "Year select:",
    aggregationYear
);

console.log(
    "Period select:",
    aggregationPeriod
);


// ============================================================
// AVAILABLE YEARS
// ============================================================

function populateYears() {

    if (!aggregationYear) {
        return;
    }

    aggregationYear.innerHTML = "";

    for (
        let year = 2023;
        year >= 1981;
        year--
    ) {

        const option =
            document.createElement("option");

        option.value = String(year);

        option.textContent = String(year);

        aggregationYear.appendChild(
            option
        );
    }

    aggregationYear.value = "2023";
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

        for (
            let week = 1;
            week <= 52;
            week++
        ) {

            const option =
                document.createElement("option");

            option.value = String(week);

            const dates =
                getWeekDates(
                    parseInt(
                        aggregationYear.value
                    ),
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
                label: "Winter"
            },
            {
                value: "pre-monsoon",
                label: "Pre-monsoon"
            },
            {
                value: "monsoon",
                label: "Monsoon"
            },
            {
                value: "post-monsoon",
                label: "Post-monsoon"
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

        option.value = "annual";

        option.textContent = "Annual";

        aggregationPeriod.appendChild(
            option
        );

        aggregationPeriod.value =
            "annual";

        return;
    }
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
// GET WEEK INFORMATION
// ============================================================

function getWeekDates(
    year,
    week
) {

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


    // Don't go into next year
    if (
        end.getFullYear() >
        year
    ) {

        end.setFullYear(year);

        end.setMonth(11);

        end.setDate(31);
    }


    return {

        start: formatDate(start),

        end: formatDate(end)

    };
}


// ============================================================
// NORMALIZE DISTRICT NAME
// ============================================================

function normalizeDistrict(
    name
) {

    if (
        name === null ||
        name === undefined
    ) {

        return "";
    }


    let district =
        name
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");


    // ========================================================
    // DISTRICT NAME MAPPINGS
    // ========================================================

    const districtMap = {

        "ahmadnagar":
            "ahmednagar",

        "ahmednagar":
            "ahmednagar",

        "aurangabad":
            "chhatrapati sambhajinagar",

        "buldana":
            "buldhana",

        "chhatrapati sambhajinagar":
            "chhatrapati sambhajinagar",

        "osmanabad":
            "dharashiv",

        "dharashiv":
            "dharashiv",

        "mumbai suburban":
            "mumbai suburban",

        "mumbai_suburban":
            "mumbai suburban"

    };


    return (
        districtMap[district] ||
        district
    );
}


// ============================================================
// GEONODE
// ============================================================

const GEONODE_WFS =
    "https://geonode.communitygis.in/geoserver/geonode/ows";

const DISTRICT_LAYER =
    "geonode:maharashtra_districts";


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


        // IMPORTANT:
        // Load rainfall only after
        // district boundaries exist

        await loadRainfall();


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
// DISTRICT FEATURE
// ============================================================

function districtFeature(
    feature,
    layer
) {

    const properties =
        feature.properties ||
        {};


    const district =
        properties.district;


    layer.on({

        mouseover:
            function () {

                layer.setStyle({

                    weight: 2,

                    color: "#222222"

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
// RAINFALL COLOUR
// ============================================================

function getRainfallColor(
    rainfall
) {

    if (
        rainfall === null ||
        rainfall === undefined ||
        rainfall === "" ||
        isNaN(
            Number(rainfall)
        )
    ) {

        return "#d9d9d9";
    }


    rainfall =
        Number(rainfall);


    if (rainfall <= 10) {

        return "#ffffcc";
    }


    if (rainfall <= 25) {

        return "#a1d76a";
    }


    if (rainfall <= 50) {

        return "#41ab5d";
    }


    if (rainfall <= 100) {

        return "#238443";
    }


    return "#005a32";
}


// ============================================================
// GET AGGREGATION LABEL
// ============================================================

function getAggregationLabel() {

    switch (
        currentAggregation
    ) {

        case "daily":

            return "Average Daily Rainfall";

        case "weekly":

            return "Weekly Rainfall";

        case "monthly":

            return "Monthly Rainfall";

        case "seasonal":

            return "Seasonal Rainfall";

        case "annual":

            return "Annual Rainfall";

        default:

            return "Rainfall";
    }
}


// ============================================================
// GET UNIT
// ============================================================

function getRainfallUnit() {

    if (
        currentAggregation ===
        "daily"
    ) {

        return "mm/day";
    }

    return "mm";
}


// ============================================================
// UPDATE LEGEND TITLE
// ============================================================

function updateLegendTitle() {

    if (!legendAggregationTitle) {
        return;
    }


    legendAggregationTitle.textContent =
        getAggregationLabel();
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
        rainfallData[
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
                ? getRainfallColor(
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


    const unit =
        getRainfallUnit();


    let displayValue;


    if (!hasData) {

        displayValue =
            "No data";

    }
    else {

        displayValue =
            `${numericValue.toFixed(2)} ${unit}`;

    }


    layer.bindTooltip(

        `<strong>${district}</strong>
        <br>
        ${label}:
        ${displayValue}`,

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


    console.log(
        "Updating map styles with:",
        rainfallData
    );


    districtLayer.eachLayer(
        layer => {

            const district =
                layer.feature &&
                layer.feature.properties
                    ? layer.feature.properties.district
                    : null;


            updateDistrictStyle(
                layer,
                district
            );

        }
    );
}


// ============================================================
// LOAD RAINFALL FROM API
// ============================================================
// ============================================================
// LOAD RAINFALL FROM API
// ============================================================

async function loadRainfall() {

    let url =
        `/api/rainfall-districts/?aggregation=${encodeURIComponent(
            currentAggregation
        )}`;


    // ========================================================
    // DAILY
    // ========================================================

    if (currentAggregation === "daily") {

        const start = startDate.value;
        const end = endDate.value;

        if (!start || !end) {

            console.warn("Daily dates missing");
            return;
        }

        if (start > end) {

            alert("From Date cannot be after To Date.");
            return;
        }

        url +=
            `&start_date=${encodeURIComponent(start)}` +
            `&end_date=${encodeURIComponent(end)}`;
    }


    // ========================================================
    // WEEKLY / MONTHLY / SEASONAL / ANNUAL
    // ========================================================

    else {

        const year = aggregationYear.value;
        const period = aggregationPeriod.value;

        if (!year || !period) {

            console.warn(
                "Year or period missing:",
                {
                    year: year,
                    period: period,
                    aggregation: currentAggregation
                }
            );

            return;
        }

        url +=
            `&year=${encodeURIComponent(year)}` +
            `&period=${encodeURIComponent(period)}`;
    }


    // ========================================================
    // DEBUG
    // ========================================================

    console.log("=================================");
    console.log("RAIN FALL REQUEST");
    console.log("Aggregation:", currentAggregation);
    console.log("Year:", aggregationYear.value);
    console.log("Period:", aggregationPeriod.value);
    console.log("URL:", url);
    console.log("=================================");


    try {

        const response = await fetch(url);


        // ====================================================
        // IMPORTANT:
        // Read response as TEXT first so we can see 400 error
        // ====================================================

        const responseText = await response.text();


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
                "Rainfall API returned an error:",
                response.status,
                responseText
            );

            return;
        }


        // ====================================================
        // PARSE JSON
        // ====================================================

        let result;

        try {

            result = JSON.parse(responseText);

        } catch (jsonError) {

            console.error(
                "API did not return valid JSON:",
                responseText
            );

            return;
        }


        console.log(
            "Rainfall result:",
            result
        );


        // ====================================================
        // CLEAR OLD DATA
        // ====================================================

        rainfallData = {};


        // ====================================================
        // STORE NEW DATA
        // ====================================================

        if (
            result.data &&
            Array.isArray(result.data)
        ) {

            result.data.forEach(item => {

                const district =
                    normalizeDistrict(
                        item.district
                    );

                const value =
                    item.value;


                rainfallData[district] =
                    value;

            });
        }


        console.log(
            "Updated rainfallData:",
            rainfallData
        );


        // ====================================================
        // UPDATE MAP
        // ====================================================

        if (districtLayer) {

            districtLayer.eachLayer(layer => {

                const properties =
                    layer.feature &&
                    layer.feature.properties
                        ? layer.feature.properties
                        : {};

                const district =
                    properties.district;


                updateDistrictStyle(
                    layer,
                    district
                );

            });

        }


        // ====================================================
        // UPDATE LEGEND TITLE
        // ====================================================

        updateLegendTitle();


    } catch (error) {

        console.error(
            "Rainfall fetch error:",
            error
        );

    }
}

// ============================================================
// UPDATE LEGEND TITLE
// ============================================================

function updateLegendTitle() {

    const title =
        document.getElementById(
            "legendAggregationTitle"
        );

    if (!title) {
        return;
    }


    switch (currentAggregation) {

        case "daily":

            title.textContent =
                "Average Daily Rainfall";

            break;


        case "weekly":

            title.textContent =
                "Weekly Rainfall";

            break;


        case "monthly":

            title.textContent =
                "Monthly Rainfall";

            break;


        case "seasonal":

            title.textContent =
                "Seasonal Rainfall";

            break;


        case "annual":

            title.textContent =
                "Annual Rainfall";

            break;


        default:

            title.textContent =
                "Rainfall";
    }
}

// ============================================================
// UPDATE LEGEND
// ============================================================

function updateRainfallLegend() {

    const title =
        document.getElementById("legendAggregationTitle");

    const label1 =
        document.getElementById("legendLabel1");

    const label2 =
        document.getElementById("legendLabel2");

    const label3 =
        document.getElementById("legendLabel3");

    const label4 =
        document.getElementById("legendLabel4");

    const label5 =
        document.getElementById("legendLabel5");

    const noData =
        document.getElementById("legendLabelNoData");


    if (!title) {
        return;
    }


    // ========================================================
    // DAILY
    // ========================================================

    if (currentAggregation === "daily") {

        title.textContent =
            "Average Daily Rainfall";

        label1.textContent =
            "0 – 10 mm";

        label2.textContent =
            "10 – 25 mm";

        label3.textContent =
            "25 – 50 mm";

        label4.textContent =
            "50 – 100 mm";

        label5.textContent =
            "> 100 mm";

        noData.textContent =
            "No data";

        return;
    }


    // ========================================================
    // WEEKLY
    // ========================================================

    if (currentAggregation === "weekly") {

        title.textContent =
            "Weekly Rainfall";

        label1.textContent =
            "0 – 10 mm";

        label2.textContent =
            "10 – 25 mm";

        label3.textContent =
            "25 – 50 mm";

        label4.textContent =
            "50 – 100 mm";

        label5.textContent =
            "> 100 mm";

        noData.textContent =
            "No data";

        return;
    }


    // ========================================================
    // MONTHLY
    // ========================================================

    if (currentAggregation === "monthly") {

        title.textContent =
            "Monthly Rainfall";

        label1.textContent =
            "0 – 10 mm";

        label2.textContent =
            "10 – 25 mm";

        label3.textContent =
            "25 – 50 mm";

        label4.textContent =
            "50 – 100 mm";

        label5.textContent =
            "> 100 mm";

        noData.textContent =
            "No data";

        return;
    }


    // ========================================================
    // SEASONAL
    // ========================================================

    if (currentAggregation === "seasonal") {

        title.textContent =
            "Seasonal Rainfall";

        label1.textContent =
            "0 – 10 mm";

        label2.textContent =
            "10 – 25 mm";

        label3.textContent =
            "25 – 50 mm";

        label4.textContent =
            "50 – 100 mm";

        label5.textContent =
            "> 100 mm";

        noData.textContent =
            "No data";

        return;
    }


    // ========================================================
    // ANNUAL
    // ========================================================

    if (currentAggregation === "annual") {

        title.textContent =
            "Annual Rainfall";

        label1.textContent =
            "0 – 10 mm";

        label2.textContent =
            "10 – 25 mm";

        label3.textContent =
            "25 – 50 mm";

        label4.textContent =
            "50 – 100 mm";

        label5.textContent =
            "> 100 mm";

        noData.textContent =
            "No data";

        return;
    }
}

// ============================================================
// SET AGGREGATION
// ============================================================

function setAggregation(
    aggregation
) {

    console.log(
        "================================="
    );

    console.log(
        "Changing aggregation:",
        aggregation
    );

    console.log(
        "================================="
    );

    
    currentAggregation = aggregation;

    updateRainfallLegend();
    // ========================================================
    // DAILY
    // ========================================================

    if (
        aggregation ===
        "daily"
    ) {

        dailyDateContainer.style.display =
            "flex";


        aggregationPeriodContainer.style.display =
            "none";


        if (!startDate.value) {

            startDate.value =
                "2023-01-01";
        }


        if (!endDate.value) {

            endDate.value =
                "2023-12-31";
        }


        updateLegendTitle();


        loadRainfall();


        return;
    }


    // ========================================================
    // OTHER AGGREGATIONS
    // ========================================================

    dailyDateContainer.style.display =
        "none";


    aggregationPeriodContainer.style.display =
        "flex";


    populateYears();


    populateAggregationPeriods(
        aggregation
    );


    updateLegendTitle();


    loadRainfall();
}


// ============================================================
// RADIO BUTTON EVENTS
// ============================================================

aggregationOptions.forEach(
    radio => {

        radio.addEventListener(
            "change",
            function () {

                console.log(
                    "Radio changed:",
                    this.value
                );


                if (
                    this.checked
                ) {

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

            console.log(
                "Year changed:",
                this.value
            );


            if (
                currentAggregation !==
                "daily"
            ) {

                populateAggregationPeriods(
                    currentAggregation
                );


                // After rebuilding the period
                // dropdown, load the first period

                loadRainfall();

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

            console.log(
                "Period changed:",
                this.value
            );


            console.log(
                "Current aggregation:",
                currentAggregation
            );


            loadRainfall();

        }
    );

}


// ============================================================
// DAILY START DATE CHANGE
// ============================================================

if (startDate) {

    startDate.addEventListener(
        "change",
        function () {

            console.log(
                "Start date changed:",
                this.value
            );


            if (
                currentAggregation ===
                "daily"
            ) {

                loadRainfall();

            }

        }
    );

}


// ============================================================
// DAILY END DATE CHANGE
// ============================================================

if (endDate) {

    endDate.addEventListener(
        "change",
        function () {

            console.log(
                "End date changed:",
                this.value
            );


            if (
                currentAggregation ===
                "daily"
            ) {

                loadRainfall();

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
        rainfallData[
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
            ? `${numericValue.toFixed(2)} ${getRainfallUnit()}`
            : "No data";


    const label =
        getAggregationLabel();


    layer.bindPopup(

        `<div class="rainfall-popup">

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
// DEFAULT DAILY DATE RANGE
// ============================================================

function setDefaultDates() {

    if (startDate) {

        startDate.value =
            "2023-01-01";

    }


    if (endDate) {

        endDate.value =
            "2023-12-31";

    }
}


// ============================================================
// INITIALIZE
// ============================================================

function initializeRainfall() {

    console.log(
        "================================="
    );

    console.log(
        "Initializing Rainfall Monitoring"
    );

    console.log(
        "================================="
    );


    // --------------------------------------------------------
    // Default dates
    // --------------------------------------------------------

    setDefaultDates();


    // --------------------------------------------------------
    // Years
    // --------------------------------------------------------

    populateYears();

    updateRainfallLegend();
    // --------------------------------------------------------
    // Set daily radio
    // --------------------------------------------------------

    aggregationOptions.forEach(
        radio => {

            radio.checked =
                radio.value ===
                "daily";

        }
    );


    // --------------------------------------------------------
    // Current aggregation
    // --------------------------------------------------------

    currentAggregation =
        "daily";


    // --------------------------------------------------------
    // Show daily controls
    // --------------------------------------------------------

    if (dailyDateContainer) {

        dailyDateContainer.style.display =
            "flex";

    }


    if (aggregationPeriodContainer) {

        aggregationPeriodContainer.style.display =
            "none";

    }


    // --------------------------------------------------------
    // Legend
    // --------------------------------------------------------

    updateLegendTitle();


    // --------------------------------------------------------
    // Load district boundaries
    // --------------------------------------------------------

    loadDistrictBoundaries();

}


// ============================================================
// START APPLICATION
// ============================================================

initializeRainfall();