// Global variables
const geoserverUrl = "http://localhost:8080/geoserver";
let source = null;
let target = null;
let sourceVertexId = null;
let targetVertexId = null;
let map = null;
let routeLayer = null;
let userLocationLayer = null; 
let target1=null;
let target2=null;
let target3=null;
let target4=null;
let targetVertexId1=null;
let targetVertexId2=null;
let targetVertexId3=null;
let targetVertexId4=null;
let destinationMarkers = [];
let destinationPopups = [];
let userLocationPopup;
let startPointLayer = null;
const EMISSION_FACTORS = {
    car: 223.6,
    bus: 515.2,
    ev: 0,
    bike: 26.6,
    walk: 0
};

const EMISSION_THRESHOLD = 113; // Indian CAFE standards (g/km)

// Initialize map view
const view = new ol.View({
    center: ol.proj.fromLonLat([72.61099623688162, 23.04280929707579]),
    zoom: 12
});

// Create base layer
const baseLayer = new ol.layer.Tile({
    source: new ol.source.OSM()
});

// Custom icon styles
const createIconStyle = (iconPath) => {
    return new ol.style.Style({
        image: new ol.style.Icon({
            src: iconPath,
            scale: 0.3
        })
    });
};

// Icon paths
const icons = {
    userLocation: 'icons/user_location.png',
    destination: 'icons/destination_marker.png', // Fixed: Added comma
    startPoint: 'icons/source_marker.png'
};

// Layer sources
const layerSources = {
    heritage: new ol.source.Vector(),
    museum: new ol.source.Vector(),
    temples: new ol.source.Vector(),
    parks: new ol.source.Vector(),
    publicStructure: new ol.source.Vector(),
    food: new ol.source.Vector(),
    hotel: new ol.source.Vector()
};

// Vector layers
const vectorLayers = {
    heritage: new ol.layer.Vector({
        source: layerSources.heritage,
    }),
    museum: new ol.layer.Vector({
        source: layerSources.museum,
    }),
    temples: new ol.layer.Vector({
        source: layerSources.temples,
    }),
    parks: new ol.layer.Vector({
        source: layerSources.parks,
    }),
    publicStructure: new ol.layer.Vector({
        source: layerSources.publicStructure,
    }),
    food: new ol.layer.Vector({
        source: layerSources.food,
    }),
    hotel: new ol.layer.Vector({
        source: layerSources.hotel,
    })
};

// Initialize map
function initializeMap() {
    map = new ol.Map({
        target: 'map',
        view: view,
        layers: [baseLayer]
    });

    // Create route layer
    routeLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#ff0000',
                width: 3
            })
        })
    });
    map.addLayer(routeLayer);

    // Add click event listener to the map
    map.on('singleclick', function (evt) {
        const coordinates = ol.proj.toLonLat(evt.coordinate);
        source = coordinates; // Update source with clicked coordinates
        document.getElementById('xCoordinate').value = coordinates[0].toFixed(6);
        document.getElementById('yCoordinate').value = coordinates[1].toFixed(6);
        
        // Get nearest vertex for the source location
        getNearestVertex(coordinates[1], coordinates[0], function(vertexId) {
            sourceVertexId = vertexId;
            console.log('Source vertex ID updated:', sourceVertexId);
        });

        // Add a marker at the clicked location
        addStartPointMarker(evt.coordinate);
    });
}

// Function to add a start point marker
function addStartPointMarker(coordinates) {
    // Clear existing start point marker if any
    if (startPointLayer) {
        map.removeLayer(startPointLayer);
    }

    // Remove user location marker and popup if present
    if (userLocationLayer) {
        map.removeLayer(userLocationLayer);
        userLocationLayer = null;
    }
    if (userLocationPopup) {
        map.removeOverlay(userLocationPopup);
        userLocationPopup = null;
    }

    // Uncheck the "Use My Current Location" checkbox
    document.getElementById('useCurrentLocation').checked = false;

    // Create marker feature
    const markerFeature = new ol.Feature({
        geometry: new ol.geom.Point(coordinates)
    });

    // Define marker style
    const markerStyle = new ol.style.Style({
        image: new ol.style.Icon({
            src: icons.startPoint, // Path to your start point icon
            scale: 0.1 // Adjust scale as needed
        })
    });

    // Create marker source and layer
    const markerSource = new ol.source.Vector({
        features: [markerFeature]
    });

    startPointLayer = new ol.layer.Vector({
        source: markerSource,
        style: markerStyle
    });

    // Add marker layer to the map
    map.addLayer(startPointLayer);
}
// Add feature to appropriate layer
function addFeatureToLayer(feature) {
    // Access coordinates from properties
    const coords = ol.proj.fromLonLat([
        parseFloat(feature.properties.longitude),
        parseFloat(feature.properties.latitude)
    ]);
    
    const vectorFeature = new ol.Feature({
        geometry: new ol.geom.Point(coords),
        properties: feature.properties
    });

    const layerMapping = {
        'Heritage_Gems': 'heritage',
        'museum': 'museum',
        'Temples and Religious Sites': 'temples',
        'Parks': 'parks',
        'Public_Structure': 'publicStructure',
        'food': 'food',
        'hotel': 'hotel'
    };

    const layerKey = layerMapping[feature.properties.layer];
    if (layerKey && layerSources[layerKey]) {
        layerSources[layerKey].addFeature(vectorFeature);
        console.log(`Added feature to ${layerKey} layer:`, feature.properties);
    } else {
        console.warn('Unknown layer type:', feature.properties.layer);
    }
}

// Update loadWFSData function to properly handle the response
function loadWFSData() {
    const url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:ahm_point&outputformat=application/json`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (!data.features || !Array.isArray(data.features)) {
                console.error('Invalid WFS response format:', data);
                return;
            }
            
            // Clear existing features from all layers
            Object.values(layerSources).forEach(source => source.clear());
            
            // Add new features
            data.features.forEach(feature => {
                if (feature.properties) {
                    addFeatureToLayer(feature);
                } else {
                    console.warn('Feature missing properties:', feature);
                }
            });

            // Store the data for dropdown population
            sitesData = data.features;
            populateEndPointDropdown();
            
            console.log('Total features loaded:', data.features.length);
        })
        .catch(error => {
            console.error('Error fetching WFS data:', error);
            alert('Failed to load map locations. Please try refreshing the page.');
        });
}

// Populate end point dropdown
let sitesData = []; // Define a new variable to hold WFS data

// Modified populateEndPointDropdown function
function populateEndPointDropdown() {
    // Create container div for better organization
    const destinationGroup = document.getElementById('destinationLabelGroup');
    destinationGroup.innerHTML = '';
    
    // Create and style category container
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'category-container';
    categoryContainer.style.marginBottom = '15px';
    
    // Create category label and dropdown
    const categoryLabel = document.createElement('label');
    categoryLabel.htmlFor = 'categorySelect';
    categoryLabel.textContent = 'Select category:';
    categoryLabel.style.display = 'block';
    categoryLabel.style.marginBottom = '5px';
    
    const categorySelect = document.createElement('select');
    categorySelect.id = 'categorySelect';
    categorySelect.className = 'category-select';
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    
    // Add categories
    const categories = [
        { value: 'Heritage_Gems', label: 'Heritage Sites' },
        { value: 'museum', label: 'Museums' },
        { value: 'Temples and Religious Sites', label: 'Temples' },
        { value: 'Parks', label: 'Parks' },
        { value: 'Public_Structure', label: 'Public Structures' },
        { value: 'food', label: 'Food Places' },
        { value: 'hotel', label: 'Hotels' }
    ];
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.value;
        option.textContent = category.label;
        categorySelect.appendChild(option);
    });
    
    // Create location container
    const locationContainer = document.createElement('div');
    locationContainer.className = 'location-container';
    locationContainer.style.marginTop = '15px';
    
    // Create location label and dropdown
    const locationLabel = document.createElement('label');
    locationLabel.htmlFor = 'endPoint';
    locationLabel.textContent = 'Select location:';
    locationLabel.style.display = 'block';
    locationLabel.style.marginBottom = '5px';
    
    const endPointSelect = document.createElement('select');
    endPointSelect.id = 'endPoint';
    endPointSelect.innerHTML = '<option value="">Select a location</option>';
    
    // Assemble the components
    categoryContainer.appendChild(categoryLabel);
    categoryContainer.appendChild(categorySelect);
    locationContainer.appendChild(locationLabel);
    locationContainer.appendChild(endPointSelect);
    
    destinationGroup.appendChild(categoryContainer);
    destinationGroup.appendChild(locationContainer);
    
    // Add change event listeners
    categorySelect.addEventListener('change', function() {
        // Clear existing route when category changes
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        // Clear route information
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) routeInfo.innerHTML = '';
        
        updateLocationDropdown(this.value);
    });
    
    endPointSelect.addEventListener('change', function() {
        // Clear existing route when location changes
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        // Clear route information
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) routeInfo.innerHTML = '';
        
        handleEndPointSelection(this.value, 'endPoint');
        
        if (this.value) {
            const selectedSite = JSON.parse(this.value);
            target = [selectedSite.longitude, selectedSite.latitude];
            
            getNearestVertex(selectedSite.latitude, selectedSite.longitude, function(vertexId) {
                targetVertexId = vertexId;
                console.log('Target vertex ID updated:', targetVertexId);
            });
        } else {
            target = null;
            targetVertexId = null;
        }
    });
}

// Function to update location dropdown based on selected category
function updateLocationDropdown(selectedCategory) {
    const endPointSelect = document.getElementById('endPoint');
    endPointSelect.innerHTML = '<option value="">Select a location</option>';
    
    if (!selectedCategory) return;
    
    // Filter sites by selected category
    const filteredSites = sitesData.filter(site => 
        site.properties.layer === selectedCategory
    );
    
    // Sort sites alphabetically
    filteredSites.sort((a, b) => 
        a.properties.site_name.localeCompare(b.properties.site_name)
    );
    
    // Add filtered sites to location dropdown
    filteredSites.forEach(site => {
        const option = document.createElement('option');
        option.value = JSON.stringify({
            name: site.properties.site_name,
            longitude: site.properties.longitude,
            latitude: site.properties.latitude
        });
        option.textContent = site.properties.site_name;
        endPointSelect.appendChild(option);
    });
}

// Modified addDestinationDropdowns function for multiple destinations
function addDestinationDropdowns() {
    const dropdownContainer = document.getElementById('multipleDestinationDropdowns');
    dropdownContainer.innerHTML = ''; // Clear existing dropdowns
    
    // Create 4 sets of category + location dropdowns
    for (let i = 1; i <= 4; i++) {
        const dropdownSet = document.createElement('div');
        dropdownSet.className = 'dropdown-set';
        
        // Create category dropdown
        const categorySelect = document.createElement('select');
        categorySelect.id = `category${i}`;
        categorySelect.innerHTML = `<option value="">Select category ${i}</option>`;
        
        // Add categories
        const categories = [
            { value: 'Heritage_Gems', label: 'Heritage Sites' },
            { value: 'museum', label: 'Museums' },
            { value: 'Temples and Religious Sites', label: 'Temples' },
            { value: 'Parks', label: 'Parks' },
            { value: 'Public_Structure', label: 'Public Structures' },
            { value: 'food', label: 'Food Places' },
            { value: 'hotel', label: 'Hotels' }
        ];
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.value;
            option.textContent = category.label;
            categorySelect.appendChild(option);
        });
        
        // Create location dropdown
        const locationSelect = document.createElement('select');
        locationSelect.id = `destination${i}`;
        locationSelect.innerHTML = `<option value="">Select location ${i}</option>`;
        
        // Add event listeners
        categorySelect.addEventListener('change', function() {
            updateMultipleLocationDropdown(i, this.value);
        });
        
        locationSelect.addEventListener('change', function() {
            handleMultipleDestinationSelection(this.value, i - 1);
        });
        
        // Add dropdowns to container
        dropdownSet.appendChild(categorySelect);
        dropdownSet.appendChild(locationSelect);
        dropdownContainer.appendChild(dropdownSet);
    }
}

function addDestinationDropdowns() {
    const dropdownContainer = document.getElementById('multipleDestinationDropdowns');
    dropdownContainer.innerHTML = ''; // Clear existing dropdowns
    
    // Add CSS to container
    dropdownContainer.style.display = 'flex';
    dropdownContainer.style.flexDirection = 'column';
    dropdownContainer.style.gap = '10px';
    
    // Create 4 sets of category + location dropdowns
    for (let i = 1; i <= 4; i++) {
        const dropdownSet = document.createElement('div');
        dropdownSet.className = 'dropdown-set';
        dropdownSet.style.display = 'flex';
        dropdownSet.style.alignItems = 'center';
        dropdownSet.style.gap = '10px';
        
        // Create category dropdown
        const categorySelect = document.createElement('select');
        categorySelect.id = `category${i}`;
        categorySelect.style.width = '130px'; // Make category dropdown smaller
        categorySelect.style.padding = '4px';
        categorySelect.innerHTML = `<option value="">Category ${i}</option>`;
        
        // Add categories
        const categories = [
            { value: 'Heritage_Gems', label: 'Heritage Sites' },
            { value: 'museum', label: 'Museums' },
            { value: 'Temples and Religious Sites', label: 'Temples' },
            { value: 'Parks', label: 'Parks' },
            { value: 'Public_Structure', label: 'Public Structures' },
            { value: 'food', label: 'Food Places' },
            { value: 'hotel', label: 'Hotels' }
        ];
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.value;
            option.textContent = category.label;
            categorySelect.appendChild(option);
        });
        
        // Create location dropdown
        const locationSelect = document.createElement('select');
        locationSelect.id = `destination${i}`;
        locationSelect.style.width = '200px'; // Keep location dropdown wider
        locationSelect.style.padding = '4px';
        locationSelect.innerHTML = `<option value="">Select location ${i}</option>`;
        
        // Add event listeners
        categorySelect.addEventListener('change', function() {
            updateMultipleLocationDropdown(i, this.value);
        });
        
        locationSelect.addEventListener('change', function() {
            handleMultipleDestinationSelection(this.value, i - 1);
        });
        
        // Add dropdowns to container
        dropdownSet.appendChild(categorySelect);
        dropdownSet.appendChild(locationSelect);
        dropdownContainer.appendChild(dropdownSet);
    }
}

// Update the updateMultipleLocationDropdown function to match the new styling
function updateMultipleLocationDropdown(index, selectedCategory) {
    const locationSelect = document.getElementById(`destination${index}`);
    locationSelect.innerHTML = `<option value="">Select location ${index}</option>`;
    
    if (!selectedCategory) return;
    
    // Filter and sort sites
    const filteredSites = sitesData
        .filter(site => site.properties.layer === selectedCategory)
        .sort((a, b) => a.properties.site_name.localeCompare(b.properties.site_name));
    
    // Add filtered sites to dropdown
    filteredSites.forEach(site => {
        const option = document.createElement('option');
        option.value = JSON.stringify({
            name: site.properties.site_name,
            longitude: site.properties.longitude,
            latitude: site.properties.latitude
        });
        option.textContent = site.properties.site_name;
        locationSelect.appendChild(option);
    });
}

function removeDestinationDropdowns() {
    const dropdownContainer = document.getElementById('multipleDestinationDropdowns');
    const dropdowns = dropdownContainer.querySelectorAll('select');
    
    dropdowns.forEach(dropdown => {
        dropdown.selectedIndex = 0;
    });
    
    target1 = target2 = target3 = target4 = null;
    targetVertexId1 = targetVertexId2 = targetVertexId3 = targetVertexId4 = null;
}

// Get user location
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lonLat = ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]);
            console.log("User location retrieved:", lonLat);
            if (document.getElementById('useCurrentLocation').checked) {
                // Remove start point marker if present
                if (startPointLayer) {
                    map.removeLayer(startPointLayer);
                    startPointLayer = null;
                }

                source = lonLat;
                addUserLocationMarker(lonLat);
                document.getElementById('xCoordinate').value = position.coords.longitude.toFixed(6);
                document.getElementById('yCoordinate').value = position.coords.latitude.toFixed(6);
                
                // Get nearest vertex for the user's location
                getNearestVertex(position.coords.latitude, position.coords.longitude, function(vertexId) {
                    sourceVertexId = vertexId;
                    console.log('Source vertex ID updated from user location:', sourceVertexId);
                });
            } else {
                // Remove user location marker and popup
                if (userLocationLayer) {
                    console.log("Removing user location marker");
                    map.removeLayer(userLocationLayer);
                    userLocationLayer = null;
                }
                if (userLocationPopup) {
                    console.log("Removing user location popup");
                    map.removeOverlay(userLocationPopup);
                    userLocationPopup = null;
                }
                document.getElementById('xCoordinate').value = '';
                document.getElementById('yCoordinate').value = '';
            }
        });
    }
}
// Add user location marker
function addUserLocationMarker(coordinates) {
    // Create popup overlay
    const popupElement = document.createElement('div');
    popupElement.className = 'ol-popup';
    popupElement.innerHTML = 'Your Current Location';
    
    userLocationPopup = new ol.Overlay({ // Assign to the global variable
        element: popupElement,
        positioning: 'bottom-center',
        offset: [0, -10],
        stopEvent: false
    });
    
    // Add popup to map
    map.addOverlay(userLocationPopup);
    userLocationPopup.setPosition(coordinates);

    const userLocationFeature = new ol.Feature({
        geometry: new ol.geom.Point(coordinates)
    });

    const userLocationStyle = new ol.style.Style({
        image: new ol.style.Icon({
            src: icons.userLocation,
            scale: 0.2
        })
    });

    const userLocationSource = new ol.source.Vector({
        features: [userLocationFeature]
    });

    userLocationLayer = new ol.layer.Vector({
        source: userLocationSource,
        style: userLocationStyle
    });

    console.log("Adding user location marker");
    map.addLayer(userLocationLayer);
}


function clearDestinationMarkers() {
    // Remove markers
    destinationMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    destinationMarkers = [];

    // Remove popups
    destinationPopups.forEach(popup => {
        map.removeOverlay(popup);
    });
    destinationPopups = [];
    
    // Clear single destination marker if present
    if (target) {
        target = null; // Ensure target is cleared
        targetVertexId = null; // Ensure targetVertexId is cleared
    }
}

// Function to add a destination marker with popup
function addDestinationMarker(coordinates, iconPath, siteName) {
    // Create popup
    const popupElement = document.createElement('div');
    popupElement.className = 'ol-popup';
    popupElement.innerHTML = siteName;
    
    const popup = new ol.Overlay({
        element: popupElement,
        positioning: 'bottom-center',
        offset: [0, -10],
        stopEvent: false
    });
    
    // Add popup to map
    map.addOverlay(popup);
    popup.setPosition(coordinates);
    destinationPopups.push(popup);

    // Create marker
    const markerFeature = new ol.Feature({
        geometry: new ol.geom.Point(coordinates)
    });

    const markerStyle = new ol.style.Style({
        image: new ol.style.Icon({
            src: iconPath,
            scale: 0.1
        })
    });

    const markerSource = new ol.source.Vector({
        features: [markerFeature]
    });

    const markerLayer = new ol.layer.Vector({
        source: markerSource,
        style: markerStyle
    });

    map.addLayer(markerLayer);
    destinationMarkers.push(markerLayer);
}

// Modify the endPoint dropdown change handler
function handleEndPointSelection(selectedValue, dropdownId) {
    // Clear existing markers and reset state
    clearDestinationMarkers();
    
    if (selectedValue) {
        const selectedSite = JSON.parse(selectedValue);
        const coordinates = ol.proj.fromLonLat([
            parseFloat(selectedSite.longitude),
            parseFloat(selectedSite.latitude)
        ]);
        
        // Update target and targetVertexId with the new site's information
        target = selectedSite; // Update target
        targetVertexId = selectedSite.id; // Update targetVertexId
        
        // Add marker for single destination routes
        addDestinationMarker(coordinates, icons.destination, selectedSite.name);
    }
}
document.getElementById('endPoint').addEventListener('change', function(event) {
    const selectedValue = event.target.value;
    handleEndPointSelection(selectedValue, 'endPoint');
});

// Modify multiple destination dropdowns change handler
function handleMultipleDestinationSelection(selectedValue, index) {
    if (selectedValue) {
        const selectedSite = JSON.parse(selectedValue);
        
        // Fix: Update the switch statement to use correct indices (0-3 instead of 0-4)
        switch(index) {
            case 0:
                target1 = [selectedSite.longitude, selectedSite.latitude];
                getNearestVertex(selectedSite.latitude, selectedSite.longitude, function(vertexId) {
                    targetVertexId1 = vertexId;
                    console.log('Target vertex ID 1 updated:', vertexId);
                });
                break;
            case 1:  // Changed from 2 to 1
                target2 = [selectedSite.longitude, selectedSite.latitude];
                getNearestVertex(selectedSite.latitude, selectedSite.longitude, function(vertexId) {
                    targetVertexId2 = vertexId;
                    console.log('Target vertex ID 2 updated:', vertexId);
                });
                break;
            case 2:  // Changed from 3 to 2
                target3 = [selectedSite.longitude, selectedSite.latitude];
                getNearestVertex(selectedSite.latitude, selectedSite.longitude, function(vertexId) {
                    targetVertexId3 = vertexId;
                    console.log('Target vertex ID 3 updated:', vertexId);
                });
                break;
            case 3:  // Changed from 4 to 3
                target4 = [selectedSite.longitude, selectedSite.latitude];
                getNearestVertex(selectedSite.latitude, selectedSite.longitude, function(vertexId) {
                    targetVertexId4 = vertexId;
                    console.log('Target vertex ID 4 updated:', vertexId);
                });
                break;
        }
    }

    // Update markers for all selected destinations
    updateAllDestinationMarkers();
}

// Add a function to check if all vertex IDs are ready
function areAllVertexIdsReady() {
    console.log('Checking vertex IDs:', {
        targetVertexId1,
        targetVertexId2,
        targetVertexId3,
        targetVertexId4
    });
    return targetVertexId1 && targetVertexId2 && targetVertexId3 && targetVertexId4;
}


// Add new function to update all destination markers
function updateAllDestinationMarkers() {
    // Clear existing markers first
    clearDestinationMarkers();
    
    // Get all destination dropdowns
    const dropdowns = document.querySelectorAll('#multipleDestinationDropdowns select');
    let stopNumber = 1;
    
    dropdowns.forEach((dropdown, idx) => {
        if (idx % 2 !== 0) { // Only process location dropdowns (odd indices)
            if (dropdown.value) {
                const site = JSON.parse(dropdown.value);
                const coordinates = ol.proj.fromLonLat([
                    parseFloat(site.longitude),
                    parseFloat(site.latitude)
                ]);
                
                // Add marker with stop number
                addDestinationMarker(coordinates, icons.destination, site.name);
                addDestinationMarker(coordinates, icons.destination, site.name);

                stopNumber++;
            }
        }
    });
}
// Get nearest vertex
function getNearestVertex(lat, lon, callback) {
    const url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:nearest_vertex_amc&outputformat=application/json&viewparams=x:${lon};y:${lat};`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.features && data.features.length > 0) {
                const vertexId = data.features[0].properties.id;
                console.log(`Nearest vertex found: ${vertexId} for coordinates: ${lat}, ${lon}`);
                callback(vertexId);
            } else {
                console.error("No nearest vertex found.");
                alert("Could not find a nearest vertex. Please try a different location.");
            }
        })
        .catch(error => {
            console.error("Error fetching nearest vertex: ", error);
            alert("Error finding nearest vertex. Please try again.");
        });
}

// Calculate route based on selected route type
function calculateRoute() {
    // Clear previous route information
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    if (!sourceVertexId) {
        alert('Please select or click a starting point on the map');
        return;
    }

    
    const routeType = document.querySelector('input[name="routeType"]:checked');
    
    if (!routeType) {
        alert('Please select a route type');
        return;
    }
    
    const selectedRouteType = routeType.value.trim(); // Ensure no extra spaces


    
    // Clear emissions information if route type is not carbon
    const routeInfo = document.getElementById('routeInfo');
    if (routeInfo && selectedRouteType !== 'carbon') {
        routeInfo.innerHTML = ''; // Clear previous route information
    }


    switch(selectedRouteType) {


        case 'shortest':
            calculateShortestRoute(); // Calculate shortest route
            const endpointCoordinates = ol.proj.fromLonLat([target[0], target[1]]);
            addMarker(endpointCoordinates, icons.destination); // Add destination marker

            break;
        case 'plannedMultiple':
            calculatePlannedMultipleRoute(); // Calculate planned multiple destination route

            break;
        case 'carbon':
            calculateCarbonEmissionRoute();
            break;
        case 'plannedMultiple':
            calculatePlannedMultipleRoute();
            break;
        default:
            alert('Please select a valid route type');
    }
}

// Calculate shortest route
function calculateShortestRoute() {
    console.log('Calculating shortest route with:', {
        sourceVertexId: sourceVertexId,
        targetVertexId: targetVertexId
    });

    const url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:shortest_path_amc&outputformat=application/json&viewparams=source:${sourceVertexId};target:${targetVertexId};`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.features && data.features.length > 0) {
                const routeSource = new ol.source.Vector();
                let totalDistance = 0;
                
                data.features.forEach(feature => {
                    if (feature.geometry && feature.geometry.type === "GeometryCollection") {
                        feature.geometry.geometries.forEach(geom => {
                            if (geom.type === "LineString" || geom.type === "MultiLineString") {
                                const lines = geom.type === "LineString" ? [geom.coordinates] : geom.coordinates;
                                
                                lines.forEach(line => {
                                    const convertedCoords = line.map(coord => 
                                        ol.proj.fromLonLat([coord[0], coord[1]])
                                    );
                                    
                                    const lineFeature = new ol.Feature({
                                        geometry: new ol.geom.LineString(convertedCoords)
                                    });
                                    
                                    routeSource.addFeature(lineFeature);
                                    totalDistance += calculateRouteDistance(convertedCoords);
                                });
                            }
                        });
                    }
                });

                // Display route and distance information
                routeLayer = new ol.layer.Vector({
                    source: routeSource,
                    style: new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: 'blue',
                            width: 4
                        })
                    })
                });

                map.addLayer(routeLayer);
                displayRouteDistance(totalDistance);

                // Fit map to route extent
                const routeExtent = routeSource.getExtent();
                map.getView().fit(routeExtent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000,
                    maxZoom: 12
                });
            } else {
                console.log('No features found in response:', data);
                alert('No route found between these points. Please try different locations.');
            }
        })
        .catch(error => {
            console.error("Error calculating route: ", error);
            alert("Error calculating route. Please try again.");
        });
}


// Calculate carbon emission route

// Distance thresholds (in km) for scoring
const DISTANCE_THRESHOLDS = {
    short: 5,
    medium: 15
};

/**
 * Calculates emission efficiency ratio compared to threshold
 */
function calculateEmissionRatio(emissionsPerKm) {
    if (emissionsPerKm === 0) return 0;
    return emissionsPerKm / EMISSION_THRESHOLD;
}

/**
 * Calculates combined efficiency score
 */
function calculateEfficiencyScore(distance, emissionsPerKm) {
    const emissionRatio = calculateEmissionRatio(emissionsPerKm);
    
    // Distance scoring (0-50)
    let distanceScore;
    if (distance <= DISTANCE_THRESHOLDS.short) {
        distanceScore = (distance / DISTANCE_THRESHOLDS.short) * 20;
    } else if (distance <= DISTANCE_THRESHOLDS.medium) {
        distanceScore = 20 + ((distance - DISTANCE_THRESHOLDS.short) / 
            (DISTANCE_THRESHOLDS.medium - DISTANCE_THRESHOLDS.short)) * 15;
    } else {
        distanceScore = 35 + Math.min(((distance - DISTANCE_THRESHOLDS.medium) / 15) * 15, 15);
    }

    // Emission scoring (0-50)
    let emissionScore;
    if (emissionRatio <= 1) {
        emissionScore = emissionRatio * 25;
    } else {
        emissionScore = 25 + Math.min((emissionRatio - 1) * 25, 25);
    }

    return distanceScore + emissionScore;
}

/**
 * Get route analysis including color and efficiency metrics
 */
function getRouteAnalysis(vehicleType, distance) {
    // Zero-emission vehicles are always green
    if (vehicleType === 'walk' || vehicleType === 'ev') {
        return {
            color: '#4CAF50',
            emissionRatio: 0,
            efficiencyScore: 0,
            category: 'Zero Emission'
        };
    }

    const emissionsPerKm = EMISSION_FACTORS[vehicleType];
    const emissionRatio = calculateEmissionRatio(emissionsPerKm);
    const efficiencyScore = calculateEfficiencyScore(distance, emissionsPerKm);

    // Determine color and category based on combined score
    let color, category;
    if (efficiencyScore <= 33) {
        color = '#4CAF50';
        category = 'Efficient Route';
    } else if (efficiencyScore <= 66) {
        color = '#FFC107';
        category = 'Moderate Impact';
    } else {
        color = '#FF5252';
        category = 'High Impact';
    }

    return {
        color,
        emissionRatio,
        efficiencyScore,
        category
    };
}

/**
 * Calculate emissions saved compared to higher emission vehicles
 */
function calculateEmissionsSaved(distance, selectedMode) {
    const selectedEmissions = EMISSION_FACTORS[selectedMode] * distance;
    const carEmissions = EMISSION_FACTORS.car * distance;
    const busEmissions = EMISSION_FACTORS.bus * distance;
    
    return {
        savedVsCar: Math.max(0, carEmissions - selectedEmissions),
        savedVsBus: Math.max(0, busEmissions - selectedEmissions)
    };
}

/**
 * Generate HTML for emissions saved based on transport mode
 */
function getEmissionsSavedHTML(emissionsSaved, transportMode) {
    // For low-emission modes (bike, walk, ev), show both comparisons
    if (['bike', 'walk', 'ev'].includes(transportMode)) {
        return `
            <p>CO₂ Emissions Saved:</p>
            <ul>
                <li>vs Car: ${emissionsSaved.savedVsCar.toFixed(2)} g</li>
                <li>vs Bus: ${emissionsSaved.savedVsBus.toFixed(2)} g</li>
            </ul>`;
    }
    
    // For car, only show comparison with bus
    if (transportMode === 'car' && emissionsSaved.savedVsBus > 0) {
        return `
            <p>CO₂ Emissions Saved:</p>
            <ul>
                <li>vs Bus: ${emissionsSaved.savedVsBus.toFixed(2)} g</li>
            </ul>`;
    }
    
    // For bus, only show comparison with car
    if (transportMode === 'bus' && emissionsSaved.savedVsCar > 0) {
        return `
            <p>CO₂ Emissions Saved:</p>
            <ul>
                <li>vs Car: ${emissionsSaved.savedVsCar.toFixed(2)} g</li>
            </ul>`;
    }
    
    // If no emissions were saved, return empty string
    return '';
}

/**
 * Calculate route distance from coordinates
 */
function calculateRouteDistance(coordinates) {
    let distance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const start = ol.proj.transform(coordinates[i], 'EPSG:3857', 'EPSG:4326');
        const end = ol.proj.transform(coordinates[i + 1], 'EPSG:3857', 'EPSG:4326');
        distance += getDistanceFromLatLonInKm(start[1], start[0], end[1], end[0]);
    }
    return distance;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}


// Add this function near the other distance calculation functions
function displayRouteDistance(distance) {
    let routeInfo = document.getElementById('routeInfo');
    if (!routeInfo) {
        routeInfo = document.createElement('div');
        routeInfo.id = 'routeInfo';
        routeInfo.className = 'route-info';
        document.querySelector('.panel-content').appendChild(routeInfo);
    }

    routeInfo.innerHTML = `
        <h4>Route Information</h4>
        <p>Total Distance: ${distance.toFixed(2)} km</p>
    `;
}
/**
 * Main function to calculate carbon emission route
 */
function calculateCarbonEmissionRoute() {
    const transportMode = document.querySelector('input[name="transportationMode"]:checked');
    
    if (!transportMode) {
        alert('Please select a transportation mode');
        return;
    }

    const url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:shortest_path_amc&outputformat=application/json&viewparams=source:${sourceVertexId};target:${targetVertexId};`;

    fetchAndDisplayCarbonRoute(url, transportMode.value);
}

/**
 * Fetch and display the carbon emission route
 */
function fetchAndDisplayCarbonRoute(url, transportMode) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                const routeSource = new ol.source.Vector();
                let totalDistance = 0;
                
                data.features.forEach(feature => {
                    if (feature.geometry.type === "GeometryCollection") {
                        feature.geometry.geometries.forEach(geom => {
                            if (geom.type === "LineString" || geom.type === "MultiLineString") {
                                const lines = geom.type === "LineString" ? [geom.coordinates] : geom.coordinates;
                                
                                lines.forEach(line => {
                                    const convertedCoords = line.map(coord => 
                                        ol.proj.fromLonLat([coord[0], coord[1]])
                                    );
                                    
                                    const lineFeature = new ol.Feature({
                                        geometry: new ol.geom.LineString(convertedCoords)
                                    });
                                    
                                    routeSource.addFeature(lineFeature);
                                    totalDistance += calculateRouteDistance(convertedCoords);
                                });
                            }
                        });
                    }
                });

                // Get route analysis and emissions data
                const analysis = getRouteAnalysis(transportMode, totalDistance);
                const emissionsSaved = calculateEmissionsSaved(totalDistance, transportMode);
                const emissions = EMISSION_FACTORS[transportMode] * totalDistance;

                // Create route layer with calculated color
                routeLayer = new ol.layer.Vector({
                    source: routeSource,
                    style: new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: analysis.color,
                            width: 4,
                            opacity: 0.8
                        })
                    })
                });

                map.addLayer(routeLayer);

                // Update route information panel
                let routeInfo = document.getElementById('routeInfo');
                if (!routeInfo) {
                    routeInfo = document.createElement('div');
                    routeInfo.id = 'routeInfo';
                    routeInfo.className = 'route-info';
                    document.querySelector('.panel-content').appendChild(routeInfo);
                }

                routeInfo.innerHTML = `
                    <h4>Route Information</h4>
                    <p>Total Distance: ${totalDistance.toFixed(2)} km</p>
                    <p>Route Category: ${analysis.category}</p>
                    ${analysis.emissionRatio === 0 
                        ? '<p>Zero-emission transport mode</p>'
                        : `
                            <p>CO₂ Emissions: ${emissions.toFixed(2)} g</p>
                            <p>Emissions per km: ${EMISSION_FACTORS[transportMode].toFixed(1)} g/km</p>
                            <p>Emission Ratio to Threshold: ${analysis.emissionRatio.toFixed(2)}x</p>
                            <p>Route Efficiency Score: ${(100 - analysis.efficiencyScore).toFixed(1)}/100</p>
                        `}
                    ${getEmissionsSavedHTML(emissionsSaved, transportMode)}
                `;

                // Fit map to route extent
                const routeExtent = routeSource.getExtent();
                map.getView().fit(routeExtent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000,
                    maxZoom: 12
                });
            } else {
                alert('No route found between these points. Please try different locations.');
            }
        })
        .catch(error => {
            console.error("Error calculating route: ", error);
            alert("Error calculating route. Please try again.");
        });
}
// Calculate planned multiple destination route
function calculatePlannedMultipleRoute() {
    if (!sourceVertexId) {
        alert('Please select a starting point');
        return;
    }

    // Check all dropdowns are selected
    const dropdowns = document.querySelectorAll('#multipleDestinationDropdowns select');
    let allSelected = true;
    dropdowns.forEach((dropdown, index) => {
        if (index % 2 !== 0 && !dropdown.value) { // Only check location dropdowns
            allSelected = false;
        }
    });

    if (!allSelected) {
        alert('Please select all destinations for the planned route');
        return;
    }

    // Check if all vertex IDs are ready
    if (!areAllVertexIdsReady()) {
        // Add a retry mechanism
        let retryCount = 0;
        const maxRetries = 3;
        
        const retryInterval = setInterval(() => {
            retryCount++;
            if (areAllVertexIdsReady()) {
                clearInterval(retryInterval);
                proceedWithRouteCalculation();
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                alert('Unable to get all vertex IDs. Please try selecting the destinations again.');
            }
        }, 1000); // Check every second
    } else {
        proceedWithRouteCalculation();
    }
}

// Separate the route calculation logic
function proceedWithRouteCalculation() {
    const url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=routing:multiple_shortest_path&outputformat=application/json&viewparams=source:${sourceVertexId};target1:${targetVertexId1};target2:${targetVertexId2};target3:${targetVertexId3};target4:${targetVertexId4};`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.features && data.features.length > 0) {
                displayRoute(data);
                updateAllDestinationMarkers();
            } else {
                console.log('No features found in response:', data);
                alert('No route found between these points. Please try different locations.');
            }
        })
        .catch(error => {
            console.error("Error calculating route: ", error);
            alert("Error calculating route. Please try again.");
        });
}

function calculateDistance(coordinates) {
    let totalDistance = 0;
    
    // Helper function to calculate distance between two points using the Haversine formula
    function getHaversineDistance(coord1, coord2) {
        const R = 6371; // Earth's radius in kilometers
        const lat1 = coord1[1] * Math.PI / 180;
        const lat2 = coord2[1] * Math.PI / 180;
        const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
        const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(lat1) * Math.cos(lat2) *
                 Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Calculate distance for MultiLineString
    function calculateMultiLineDistance(multiLineCoords) {
        let distance = 0;
        multiLineCoords.forEach(lineString => {
            for(let i = 0; i < lineString.length - 1; i++) {
                distance += getHaversineDistance(lineString[i], lineString[i + 1]);
            }
        });
        return distance;
    }

    return calculateMultiLineDistance(coordinates);
}

function displayRoute(routeData) {
    const routeSource = new ol.source.Vector();
    let hasValidGeometry = false;
    let totalDistance = 0;
    
    if (routeData.features && routeData.features.length > 0) {
        routeData.features.forEach(feature => {
            // Handle direct MultiLineString geometry
            if (feature.geometry && feature.geometry.type === "MultiLineString") {
                try {
                    const multiLineCoords = feature.geometry.coordinates;
                    totalDistance += calculateDistance(multiLineCoords);
                    
                    const projectedCoords = multiLineCoords.map(lineString => 
                        lineString.map(coord => ol.proj.fromLonLat([coord[0], coord[1]])
                    ));
                    
                    const multiLineFeature = new ol.Feature({
                        geometry: new ol.geom.MultiLineString(projectedCoords)
                    });
                    
                    routeSource.addFeature(multiLineFeature);
                    hasValidGeometry = true;
                } catch (error) {
                    console.error('Error processing MultiLineString:', error);
                }
            }
            // Handle GeometryCollection containing MultiLineStrings
            else if (feature.geometry && feature.geometry.type === "GeometryCollection") {
                feature.geometry.geometries.forEach(geom => {
                    if (!geom) {
                        console.warn('Empty geometry found in collection');
                        return;
                    }

                    try {
                        if (geom.type === "MultiLineString" && geom.coordinates && geom.coordinates.length > 0) {
                            totalDistance += calculateDistance(geom.coordinates);
                            
                            const projectedCoords = geom.coordinates.map(lineString => 
                                lineString.map(coord => {
                                    if (Array.isArray(coord) && coord.length >= 2) {
                                        return ol.proj.fromLonLat([coord[0], coord[1]]);
                                    }
                                    console.warn('Invalid coordinate:', coord);
                                    return null;
                                }).filter(coord => coord !== null)
                            ).filter(lineString => lineString.length > 0);

                            if (projectedCoords.length > 0) {
                                const multiLineFeature = new ol.Feature({
                                    geometry: new ol.geom.MultiLineString(projectedCoords)
                                });
                                routeSource.addFeature(multiLineFeature);
                                hasValidGeometry = true;
                            }
                        }
                        // Handle LineString within GeometryCollection
                        else if (geom.type === "LineString" && geom.coordinates && geom.coordinates.length > 0) {
                            totalDistance += calculateDistance([geom.coordinates]);
                            
                            const projectedCoords = geom.coordinates.map(coord => {
                                if (Array.isArray(coord) && coord.length >= 2) {
                                    return ol.proj.fromLonLat([coord[0], coord[1]]);
                                }
                                console.warn('Invalid coordinate:', coord);
                                return null;
                            }).filter(coord => coord !== null);
                            
                            if (projectedCoords.length > 0) {
                                const lineFeature = new ol.Feature({
                                    geometry: new ol.geom.LineString(projectedCoords)
                                });
                                routeSource.addFeature(lineFeature);
                                hasValidGeometry = true;
                            }
                        }
                    } catch (error) {
                        console.error('Error processing geometry:', error);
                    }
                });
            }
        });

        if (hasValidGeometry) {
            // Create a div to display the distance if it doesn't exist
            let distanceDiv = document.getElementById('route-distance');
            if (!distanceDiv) {
                distanceDiv = document.createElement('div');
                distanceDiv.id = 'route-distance';
                distanceDiv.style.position = 'relative'; // Changed to relative for better visibility in the side panel
                distanceDiv.style.backgroundColor = 'white';
                distanceDiv.style.padding = '10px';
                distanceDiv.style.borderRadius = '5px';
                distanceDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                document.querySelector('.panel-content').appendChild(distanceDiv); // Append to the side panel
            }

            
            // Display the total distance
            displayRouteDistance(totalDistance); // Call the function to display distance


            routeLayer = new ol.layer.Vector({
                source: routeSource,
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'blue',
                        width: 4,
                        opacity: 0.8
                    })
                })
            });

            map.addLayer(routeLayer);

            const routeExtent = routeSource.getExtent();
            if (routeExtent && !isNaN(routeExtent[0]) && 
                routeExtent[0] !== Infinity && routeExtent[0] !== -Infinity) {
                map.getView().fit(routeExtent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000,
                    maxZoom: 12
                });
            } else {
                console.warn('Invalid extent calculated:', routeExtent);
            }
        } else {
            console.warn('No valid geometries found in route data');
            alert('No valid route could be displayed. Please try different locations.');
        }
    }
}

// Panel functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadWFSData();

    getUserLocation();
    document.getElementById('xCoordinate').value = '';
    document.getElementById('yCoordinate').value = '';

    const sidePanel = document.getElementById('sidePanel');
    const togglePanel = document.getElementById('togglePanel');
    const closeBtn = document.querySelector('.close-btn');
    const routeButton = document.getElementById('routeButton');

    function showPanel() {
        sidePanel.classList.add('active');
        togglePanel.innerHTML = '&#x25C0;';
    }

    function hidePanel() {
        sidePanel.classList.remove('active');
        togglePanel.innerHTML = '&#x25B6;';
    }

    togglePanel.addEventListener('click', () => {
        sidePanel.classList.contains('active') ? hidePanel() : showPanel();
    });
    closeBtn.addEventListener('click', hidePanel);
    
    // Updated route button click handler
    routeButton.addEventListener('click', calculateRoute);
});

// Add this in the DOMContentLoaded event listener after initializing other components
document.querySelectorAll('input[name="routeType"]').forEach(radio => {
    radio.addEventListener('change', () => {
        // Clear existing route visualization
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        
        // Clear route information display
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) routeInfo.innerHTML = '';
        
        // Clear destination markers and popups
        clearDestinationMarkers();
        
        // Clear endPoint dropdown selection only when switching to carbon emission route
        if (radio.value === 'carbon' || radio.value === 'shortest') {
            const categorySelect = document.getElementById('categorySelect');
            const endPointSelect = document.getElementById('endPoint');
            
            if (categorySelect) {
                categorySelect.selectedIndex = 0;
            }
            if (endPointSelect) {
                endPointSelect.selectedIndex = 0;
            }
        }
        
        // Reset multiple destination UI if switching away from planned route
        if (radio.value !== 'plannedMultiple') {
            removeDestinationDropdowns();
        }
    });
});
