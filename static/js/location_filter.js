// =============================================
// Common Location Filter
// =============================================

const districtSelect = document.getElementById("districtSelect");
const talukaSelect = document.getElementById("talukaSelect");
const villageSelect = document.getElementById("villageSelect");

function toTitleCase(str){

    return str
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());

}

function resetSelect(select, text){

    select.innerHTML =
        `<option value="">${text}</option>`;

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

            "AHAMADNAGAR":"Aliyanagar",

            "AURANGABAD":"Chhatrapati Sambhajinagar",

            "OSMANABAD":"Dharashiv"

        };

        const list = districts.map(d => {

            let display =
                districtRename[d.toUpperCase()] || d;

            display = toTitleCase(display);

            return {

                value:d,

                display:display

            };

        });

        list.sort((a,b)=>
            a.display.localeCompare(b.display)
        );

        list.forEach(item=>{

            districtSelect.innerHTML +=

            `<option value="${item.value}">
                ${item.display}
            </option>`;

        });

    });

}

// =============================================
// District Changed
// =============================================

districtSelect.addEventListener("change", function(){

    resetSelect(
        talukaSelect,
        "Select Taluka"
    );

    resetSelect(
        villageSelect,
        "Select Village"
    );

    if(!this.value)
        return;

    fetch(`/api/talukas/?district=${encodeURIComponent(this.value)}`)

    .then(r=>r.json())

    .then(talukas=>{

        talukas.forEach(t=>{

            talukaSelect.innerHTML +=

            `<option value="${t}">${t}</option>`;

        });

    });

});

// =============================================
// Taluka Changed
// =============================================

talukaSelect.addEventListener("change", function(){

    resetSelect(
        villageSelect,
        "Select Village"
    );

    if(!districtSelect.value || !this.value)
        return;

    fetch(`/api/villages/?district=${encodeURIComponent(districtSelect.value)}&tehsil=${encodeURIComponent(this.value)}`)

    .then(r=>r.json())

    .then(villages=>{

        villages.forEach(v=>{

            villageSelect.innerHTML +=

            `<option value="${v}">
                ${v}
            </option>`;

        });

    });

});

// =============================================
// Village Changed
// =============================================

villageSelect.addEventListener("change", function(){

    if(!districtSelect.value ||
       !talukaSelect.value ||
       !this.value)
        return;

    fetch(`/api/village-boundary/?district=${encodeURIComponent(districtSelect.value)}&tehsil=${encodeURIComponent(talukaSelect.value)}&village=${encodeURIComponent(this.value)}`)

    .then(r=>r.json())

    .then(data=>{

        if(typeof onVillageSelected==="function"){

            onVillageSelected(data);

        }

    });

});

// =============================================
// Initialize
// =============================================

loadDistricts();