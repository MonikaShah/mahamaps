// =============================================
// Common Location Filter
// =============================================

const districtSelect =
    document.getElementById("districtSelect");

const talukaSelect =
    document.getElementById("talukaSelect");

const villageSelect =
    document.getElementById("villageSelect");


// =============================================
// Boundary Layers
// =============================================

let selectedDistrictLayer = null;

let selectedTalukaLayer = null;


// =============================================
// Prevent Map Click During Programmatic Selection
// =============================================

let locationSelectionInProgress = false;


// =============================================
// Styles
// =============================================

const districtHighlightStyle = {

    color: "#004466",

    weight: 4,

    opacity: 1,

    fillColor: "#66b3cc",

    fillOpacity: 0.15
};


const districtContextStyle = {

    color: "#004466",

    weight: 2,

    opacity: 0.8,

    fillColor: "#66b3cc",

    fillOpacity: 0.05
};


const talukaHighlightStyle = {

    color: "#0077b6",

    weight: 4,

    opacity: 1,

    fillColor: "#90caf9",

    fillOpacity: 0.20
};


// =============================================
// Title Case
// =============================================

function toTitleCase(str){

    return str
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

}


// =============================================
// Reset Select
// =============================================

function resetSelect(select, text){

    select.innerHTML =
        `<option value="">${text}</option>`;

}


// =============================================
// Clear District Boundary
// =============================================

function clearDistrictHighlight(){

    if(
        selectedDistrictLayer &&
        typeof rainfallMap !== "undefined" &&
        rainfallMap
    ){

        rainfallMap.removeLayer(
            selectedDistrictLayer
        );

    }

    selectedDistrictLayer = null;
}


// =============================================
// Clear Taluka Boundary
// =============================================

function clearTalukaHighlight(){

    if(
        selectedTalukaLayer &&
        typeof rainfallMap !== "undefined" &&
        rainfallMap
    ){

        rainfallMap.removeLayer(
            selectedTalukaLayer
        );

    }

    selectedTalukaLayer = null;
}


// =============================================
// Highlight District
// =============================================

async function highlightDistrict(
    district,
    zoom = true
){

    if(
        !district ||
        typeof rainfallMap === "undefined" ||
        !rainfallMap
    ){

        return;
    }

    clearDistrictHighlight();

    try{

        console.log(
            "Loading district boundary:",
            district
        );

        const response = await fetch(
            `/api/district-boundary/?district=${encodeURIComponent(district)}`
        );

        if(!response.ok){

            console.error(
                "District boundary HTTP error:",
                response.status
            );

            return;
        }

        const data =
            await response.json();

        if(
            !data ||
            !data.geometry
        ){

            console.error(
                "Invalid district boundary:",
                data
            );

            return;
        }

        selectedDistrictLayer =
            L.geoJSON(
                data,
                {
                    style:
                        districtHighlightStyle,

                    interactive: false
                }
            ).addTo(
                rainfallMap
            );


        if(zoom){

            const bounds =
                selectedDistrictLayer.getBounds();

            if(bounds.isValid()){

                rainfallMap.fitBounds(
                    bounds,
                    {
                        padding: [
                            30,
                            30
                        ],

                        animate: false
                    }
                );

            }

        }

    }
    catch(error){

        console.error(
            "District boundary error:",
            error
        );

    }

}


// =============================================
// Highlight Taluka
// =============================================

async function highlightTaluka(
    district,
    tehsil,
    zoom = true
){

    if(
        !district ||
        !tehsil ||
        typeof rainfallMap === "undefined" ||
        !rainfallMap
    ){

        return;
    }

    clearTalukaHighlight();

    try{

        console.log(
            "Loading taluka boundary:",
            district,
            tehsil
        );

        const response = await fetch(
            `/api/taluka-boundary/?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`
        );

        if(!response.ok){

            console.error(
                "Taluka boundary HTTP error:",
                response.status
            );

            return;
        }

        const data =
            await response.json();

        if(
            !data ||
            !data.geometry
        ){

            console.error(
                "Invalid taluka boundary:",
                data
            );

            return;
        }

        selectedTalukaLayer =
            L.geoJSON(
                data,
                {
                    style:
                        talukaHighlightStyle,

                    interactive: false
                }
            ).addTo(
                rainfallMap
            );


        if(zoom){

            const bounds =
                selectedTalukaLayer.getBounds();

            if(bounds.isValid()){

                rainfallMap.fitBounds(
                    bounds,
                    {
                        padding: [
                            30,
                            30
                        ],

                        animate: false
                    }
                );

            }

        }

    }
    catch(error){

        console.error(
            "Taluka boundary error:",
            error
        );

    }

}


// =============================================
// Load Districts
// =============================================

function loadDistricts(){

    fetch("/api/districts/")

    .then(r => r.json())

    .then(districts => {

        resetSelect(
            districtSelect,
            "Select District"
        );

        const districtRename = {

            "AHAMADNAGAR":
                "Aliyanagar",

            "AURANGABAD":
                "Chhatrapati Sambhajinagar",

            "OSMANABAD":
                "Dharashiv"

        };


        const list =
            districts.map(d => {

                let display =
                    districtRename[
                        d.toUpperCase()
                    ] || d;


                display =
                    toTitleCase(display);


                return {

                    value: d,

                    display: display

                };

            });


        list.sort(
            (a, b) =>
                a.display.localeCompare(
                    b.display
                )
        );


        list.forEach(item => {

            districtSelect.innerHTML +=

                `<option value="${item.value}">
                    ${item.display}
                </option>`;

        });

    })

    .catch(error => {

        console.error(
            "Error loading districts:",
            error
        );

    });

}


// =============================================
// District Changed
// =============================================

districtSelect.addEventListener(
    "change",
    async function(){

        const district =
            this.value;


        // -----------------------------------------
        // Clear lower selections
        // -----------------------------------------

        resetSelect(
            talukaSelect,
            "Select Taluka"
        );

        resetSelect(
            villageSelect,
            "Select Village"
        );


        // -----------------------------------------
        // Clear old boundaries
        // -----------------------------------------

        clearDistrictHighlight();

        clearTalukaHighlight();


        if(!district){

            return;
        }


        // -----------------------------------------
        // Highlight District
        // -----------------------------------------

        await highlightDistrict(
            district,
            true
        );


        // -----------------------------------------
        // Load Talukas
        // -----------------------------------------

        try{

            const response =
                await fetch(
                    `/api/talukas/?district=${encodeURIComponent(district)}`
                );


            if(!response.ok){

                console.error(
                    "Taluka list HTTP error:",
                    response.status
                );

                return;
            }


            const talukas =
                await response.json();


            talukas.forEach(t => {

                talukaSelect.innerHTML +=

                    `<option value="${t}">
                        ${t}
                    </option>`;

            });

        }
        catch(error){

            console.error(
                "Error loading talukas:",
                error
            );

        }

    }
);


// =============================================
// Taluka Changed
// =============================================

talukaSelect.addEventListener(
    "change",
    async function(){

        const district =
            districtSelect.value;

        const tehsil =
            this.value;


        // -----------------------------------------
        // Clear village
        // -----------------------------------------

        resetSelect(
            villageSelect,
            "Select Village"
        );


        // -----------------------------------------
        // Clear previous taluka
        // -----------------------------------------

        clearTalukaHighlight();


        if(
            !district ||
            !tehsil
        ){

            return;
        }


        // -----------------------------------------
        // Highlight Taluka
        // -----------------------------------------

        await highlightTaluka(
            district,
            tehsil,
            true
        );


        // -----------------------------------------
        // Load Villages
        // -----------------------------------------

        try{

            const response =
                await fetch(
                    `/api/villages/?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`
                );


            if(!response.ok){

                console.error(
                    "Village list HTTP error:",
                    response.status
                );

                return;
            }


            const villages =
                await response.json();


            villages.forEach(v => {

                villageSelect.innerHTML +=

                    `<option value="${v}">
                        ${v}
                    </option>`;

            });

        }
        catch(error){

            console.error(
                "Error loading villages:",
                error
            );

        }

    }
);


// =============================================
// Village Changed
// =============================================

villageSelect.addEventListener(
    "change",
    function(){

        const district =
            districtSelect.value;

        const tehsil =
            talukaSelect.value;

        const village =
            this.value;


        if(
            !district ||
            !tehsil ||
            !village
        ){

            return;
        }


        selectVillageFromLocation(
            district,
            tehsil,
            village
        );

    }
);


// =============================================
// Select Village
//
// Used by BOTH:
//
// 1. Village dropdown
// 2. Map click
//
// This is the central village-selection function.
// =============================================

async function selectVillageFromLocation(
    district,
    tehsil,
    village
){

    if(
        !district ||
        !tehsil ||
        !village
    ){

        return;
    }


    console.log(
        "Selecting village:",
        {
            district: district,
            tehsil: tehsil,
            village: village
        }
    );


    // -----------------------------------------
    // Prevent map click feedback loop
    // -----------------------------------------

    locationSelectionInProgress = true;


    try{

        // -------------------------------------
        // Set District
        // -------------------------------------

        districtSelect.value =
            district;


        // -------------------------------------
        // Reload Talukas
        // -------------------------------------

        resetSelect(
            talukaSelect,
            "Select Taluka"
        );

        resetSelect(
            villageSelect,
            "Select Village"
        );


        const talukaResponse =
            await fetch(
                `/api/talukas/?district=${encodeURIComponent(district)}`
            );


        if(!talukaResponse.ok){

            console.error(
                "Could not load talukas:",
                talukaResponse.status
            );

            return;
        }


        const talukas =
            await talukaResponse.json();


        talukas.forEach(t => {

            talukaSelect.innerHTML +=

                `<option value="${t}">
                    ${t}
                </option>`;

        });


        // -------------------------------------
        // Select Taluka
        // -------------------------------------

        talukaSelect.value =
            tehsil;


        // -------------------------------------
        // Load Villages
        // -------------------------------------

        const villageResponse =
            await fetch(
                `/api/villages/?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}`
            );


        if(!villageResponse.ok){

            console.error(
                "Could not load villages:",
                villageResponse.status
            );

            return;
        }


        const villages =
            await villageResponse.json();


        villages.forEach(v => {

            villageSelect.innerHTML +=

                `<option value="${v}">
                    ${v}
                </option>`;

        });


        // -------------------------------------
        // Select Village
        // -------------------------------------

        villageSelect.value =
            village;


        // -------------------------------------
        // Highlight District
        // -------------------------------------

        await highlightDistrict(
            district,
            false
        );


        // -------------------------------------
        // Highlight Taluka
        // -------------------------------------

        await highlightTaluka(
            district,
            tehsil,
            false
        );


        // -------------------------------------
        // Get Existing Village Boundary
        //
        // This preserves your existing
        // village/rainfall logic.
        // -------------------------------------

        const boundaryResponse =
            await fetch(
                `/api/village-boundary/?district=${encodeURIComponent(district)}&tehsil=${encodeURIComponent(tehsil)}&village=${encodeURIComponent(village)}`
            );


        if(!boundaryResponse.ok){

            console.error(
                "Village boundary HTTP error:",
                boundaryResponse.status
            );

            return;
        }


        const data =
            await boundaryResponse.json();


        // -------------------------------------
        // Existing rainfall function
        // -------------------------------------

        if(
            typeof onVillageSelected ===
            "function"
        ){

            await onVillageSelected(
                data
            );

        }

    }
    catch(error){

        console.error(
            "Error selecting village:",
            error
        );

    }
    finally{

        locationSelectionInProgress = false;

    }

}


// =============================================
// MAP CLICK → VILLAGE → DROPDOWNS
// =============================================

function initializeLocationMapClick(){

    if(
        typeof rainfallMap === "undefined" ||
        !rainfallMap
    ){

        console.warn(
            "rainfallMap is not ready yet."
        );

        return false;
    }


    // -----------------------------------------
    // Avoid registering twice
    // -----------------------------------------

    if(
        rainfallMap._locationFilterClickHandler
    ){

        return true;
    }


    const handler =
        async function(e){

            // ---------------------------------
            // Ignore click generated while
            // programmatically selecting
            // a location.
            // ---------------------------------

            if(
                locationSelectionInProgress
            ){

                return;
            }


            const latitude =
                e.latlng.lat;

            const longitude =
                e.latlng.lng;


            console.log(
                "Map clicked:",
                {
                    latitude:
                        latitude,

                    longitude:
                        longitude
                }
            );


            try{

                const response =
                    await fetch(
                        `/api/village-at-point/?lon=${encodeURIComponent(longitude)}&lat=${encodeURIComponent(latitude)}`
                    );


                if(!response.ok){

                    console.error(
                        "Village-at-point HTTP error:",
                        response.status
                    );

                    return;
                }


                const data =
                    await response.json();


                if(
                    !data.found
                ){

                    console.log(
                        "No village at clicked location."
                    );

                    return;
                }


                console.log(
                    "Village identified from map:",
                    data
                );


                await selectVillageFromLocation(

                    data.district,

                    data.tehsil,

                    data.village

                );

            }
            catch(error){

                console.error(
                    "Map village selection error:",
                    error
                );

            }

        };


    rainfallMap.on(
        "click",
        handler
    );


    rainfallMap._locationFilterClickHandler =
        handler;


    console.log(
        "Map location click handler initialized."
    );


    return true;

}


// =============================================
// Wait for Rainfall Map
//
// rainfall_nc.js is loaded AFTER this file,
// so rainfallMap may not exist immediately.
// =============================================

function waitForLocationMap(){

    if(
        initializeLocationMapClick()
    ){

        return;
    }


    setTimeout(
        waitForLocationMap,
        300
    );

}


// =============================================
// Initialize
// =============================================

loadDistricts();

waitForLocationMap();