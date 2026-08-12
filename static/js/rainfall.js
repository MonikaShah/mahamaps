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
                label: "Winter (Jan–Feb)"
            
            },
            {
                value: "pre-monsoon",
                label: "Pre-monsoon (Mar–May)"
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

// ============================================================
// RAINFALL COLOUR — DEPENDS ON AGGREGATION
// ============================================================

function getRainfallColor(rainfall) {

    if (
        rainfall === null ||
        rainfall === undefined ||
        rainfall === "" ||
        isNaN(Number(rainfall))
    ) {
        return "#d9d9d9";
    }

    rainfall = Number(rainfall);


    // ========================================================
    // DAILY
    // ========================================================

    if (currentAggregation === "daily") {

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


    // ========================================================
    // WEEKLY
    // ========================================================

    if (currentAggregation === "weekly") {

        if (rainfall <= 50) {
            return "#ffffcc";
        }

        if (rainfall <= 100) {
            return "#a1d76a";
        }

        if (rainfall <= 200) {
            return "#41ab5d";
        }

        if (rainfall <= 500) {
            return "#238443";
        }

        return "#005a32";
    }


    // ========================================================
    // MONTHLY
    // ========================================================

    if (currentAggregation === "monthly") {

        if (rainfall <= 100) {
            return "#ffffcc";
        }

        if (rainfall <= 250) {
            return "#a1d76a";
        }

        if (rainfall <= 500) {
            return "#41ab5d";
        }

        if (rainfall <= 1000) {
            return "#238443";
        }

        return "#005a32";
    }


    // ========================================================
    // SEASONAL
    // ========================================================

    if (currentAggregation === "seasonal") {

        if (rainfall <= 250) {
            return "#ffffcc";
        }

        if (rainfall <= 500) {
            return "#a1d76a";
        }

        if (rainfall <= 1000) {
            return "#41ab5d";
        }

        if (rainfall <= 1500) {
            return "#238443";
        }

        return "#005a32";
    }


    // ========================================================
    // ANNUAL
    // ========================================================

    if (currentAggregation === "annual") {

        if (rainfall <= 500) {
            return "#ffffcc";
        }

        if (rainfall <= 1000) {
            return "#a1d76a";
        }

        if (rainfall <= 2000) {
            return "#41ab5d";
        }

        if (rainfall <= 5000) {
            return "#238443";
        }

        return "#005a32";
    }


    // Fallback
    return "#d9d9d9";
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


    } catch (error) {// ============================================================
        // LOAD RAINFALL FROM API
        // ============================================================
        
        async function loadRainfall() {
        
            const year =
                parseInt(aggregationYear.value);
        
            let start = null;
            let end = null;
        
        
            // ========================================================
            // DAILY
            // ========================================================
        
            if (currentAggregation === "daily") {
        
                start = startDate.value;
                end = endDate.value;
        
                if (!start || !end) {
        
                    console.warn(
                        "Daily dates missing"
                    );
        
                    return;
                }
        
            }
        
        
            // ========================================================
            // WEEKLY
            // ========================================================
        
            else if (currentAggregation === "weekly") {
        
                const week =
                    parseInt(
                        aggregationPeriod.value
                    );
        
                if (!year || !week) {
        
                    console.warn(
                        "Year or week missing"
                    );
        
                    return;
                }
        
        
                const dates =
                    getWeekDates(
                        year,
                        week
                    );
        
                start = dates.start;
                end = dates.end;
        
            }
        
        
            // ========================================================
            // MONTHLY
            // ========================================================
        
            else if (currentAggregation === "monthly") {
        
                const month =
                    parseInt(
                        aggregationPeriod.value
                    );
        
                if (!year || !month) {
        
                    console.warn(
                        "Year or month missing"
                    );
        
                    return;
                }
        
        
                // First day of month
        
                const firstDay =
                    new Date(
                        year,
                        month - 1,
                        1
                    );
        
        
                // Last day of month
        
                const lastDay =
                    new Date(
                        year,
                        month,
                        0
                    );
        
        
                start =
                    formatDate(
                        firstDay
                    );
        
                end =
                    formatDate(
                        lastDay
                    );
        
            }
        
        
            // ========================================================
            // SEASONAL
            // ========================================================
        
            else if (currentAggregation === "seasonal") {
        
                const season =
                    aggregationPeriod.value;
        
        
                if (!year || !season) {
        
                    console.warn(
                        "Year or season missing"
                    );
        
                    return;
                }
        
        
                // ----------------------------------------------------
                // WINTER
                // January - February
                // ----------------------------------------------------
        
                if (season === "winter") {
        
                    start =
                        `${year}-01-01`;
        
                    end =
                        `${year}-02-28`;
        
        
                    // Leap year
        
                    if (
                        year % 4 === 0 &&
                        (
                            year % 100 !== 0 ||
                            year % 400 === 0
                        )
                    ) {
        
                        end =
                            `${year}-02-29`;
                    }
        
                }
        
        
                // ----------------------------------------------------
                // PRE-MONSOON
                // March - May
                // ----------------------------------------------------
        
                else if (
                    season === "pre-monsoon"
                ) {
        
                    start =
                        `${year}-03-01`;
        
                    end =
                        `${year}-05-31`;
        
                }
        
        
                // ----------------------------------------------------
                // MONSOON
                // June - September
                // ----------------------------------------------------
        
                else if (
                    season === "monsoon"
                ) {
        
                    start =
                        `${year}-06-01`;
        
                    end =
                        `${year}-09-30`;
        
                }
        
        
                // ----------------------------------------------------
                // POST-MONSOON
                // October - December
                // ----------------------------------------------------
        
                else if (
                    season === "post-monsoon"
                ) {
        
                    start =
                        `${year}-10-01`;
        
                    end =
                        `${year}-12-31`;
        
                }
        
            }
        
        
            // ========================================================
            // ANNUAL
            // ========================================================
        
            else if (currentAggregation === "annual") {
        
                if (!year) {
        
                    console.warn(
                        "Year missing"
                    );
        
                    return;
                }
        
        
                start =
                    `${year}-01-01`;
        
                end =
                    `${year}-12-31`;
        
            }
        
        
            // ========================================================
            // VALIDATE DATE RANGE
            // ========================================================
        
            if (!start || !end) {
        
                console.warn(
                    "Could not determine rainfall date range:",
                    {
                        aggregation:
                            currentAggregation,
        
                        year:
                            year,
        
                        period:
                            aggregationPeriod.value,
        
                        start:
                            start,
        
                        end:
                            end
                    }
                );
        
                return;
            }
        
        
            if (start > end) {
        
                console.error(
                    "Invalid rainfall date range:",
                    start,
                    end
                );
        
                return;
            }
        
        
            // ========================================================
            // BUILD API URL
            // ========================================================
        
            const url =
                `/api/rainfall-districts/` +
                `?aggregation=${encodeURIComponent(
                    currentAggregation
                )}` +
                `&start_date=${encodeURIComponent(
                    start
                )}` +
                `&end_date=${encodeURIComponent(
                    end
                )}`;
        
        
            // ========================================================
            // DEBUG
            // ========================================================
        
            console.log(
                "================================="
            );
        
            console.log(
                "RAINFALL REQUEST"
            );
        
            console.log(
                "Aggregation:",
                currentAggregation
            );
        
            console.log(
                "Year:",
                year
            );
        
            console.log(
                "Period:",
                aggregationPeriod.value
            );
        
            console.log(
                "Start date:",
                start
            );
        
            console.log(
                "End date:",
                end
            );
        
            console.log(
                "URL:",
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
        
        
                // ====================================================
                // HANDLE ERROR
                // ====================================================
        
                if (!response.ok) {
        
                    console.error(
                        "Rainfall API error:",
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
        
        
                            rainfallData[
                                district
                            ] = value;
        
                        }
                    );
        
                }
        
        
                console.log(
                    "Updated rainfallData:",
                    rainfallData
                );
        
        
                // ====================================================
                // UPDATE MAP
                // ====================================================
        
                updateMapStyles();
        
        
                // ====================================================
                // UPDATE LEGEND
                // ====================================================
        
                updateRainfallLegend();
        
        
            }
            catch (error) {
        
                console.error(
                    "Rainfall fetch error:",
                    error
                );
        
            }
        
        }

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
            "0 – 50 mm";

        label2.textContent =
            "50 – 100 mm";

        label3.textContent =
            "100 – 200 mm";

        label4.textContent =
            "200 – 500 mm";

        label5.textContent =
            "> 500 mm";

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
            "0 – 100 mm";

        label2.textContent =
            "100 – 250 mm";

        label3.textContent =
            "250 – 500 mm";

        label4.textContent =
            "500 – 1000 mm";

        label5.textContent =
            "> 1000 mm";

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
            "0 – 250 mm";

        label2.textContent =
            "250 – 500 mm";

        label3.textContent =
            "500 – 1000 mm";

        label4.textContent =
            "1000 – 1500 mm";

        label5.textContent =
            "> 1500 mm";

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
            "0 – 500 mm";

        label2.textContent =
            "500 – 1000 mm";

        label3.textContent =
            "1000 – 2000 mm";

        label4.textContent =
            "2000 – 5000 mm";

        label5.textContent =
            "> 5000 mm";

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

updateRainfallLegend();
initializeRainfall();
