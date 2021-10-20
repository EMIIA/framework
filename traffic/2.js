mapboxgl.accessToken = 'pk.eyJ1IjoiZGFuc3dpY2siLCJhIjoiY2l1dTUzcmgxMDJ0djJ0b2VhY2sxNXBiMyJ9.25Qs4HNEkHubd4_Awbd8Og';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/light-v9', //stylesheet location
    center: [-122.3096,37.7894], // starting position
    zoom: 11 // starting zoom
});



map.on('load', function(){

    map.addSource('trafficSource', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-traffic-v1'
    });

    
    var buttonEl = document.getElementById('trafficButton');
    buttonEl.addEventListener('click', function(e){
        addTraffic();
    });

});

function addTraffic(){
    var firstPOILabel = map.getStyle().layers.filter(function(obj){ 
        return obj["source-layer"] == "poi_label";
    });

    for(var i = 0; i < trafficLayers.length; i++) {
        map.addLayer(trafficLayers[i], firstPOILabel[0].id);
    }
}
