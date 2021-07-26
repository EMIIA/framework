mapboxgl.accessToken = 'pk.eyJ1IjoiZW1paWFhaSIsImEiOiJja21icnU4bHkyNGRwMnFrbjVvNXdtdGJ0In0.TcfxV21Ov7zOgvWvgPxzlA';
    var map = new mapboxgl.Map({
        style: 'mapbox://styles/emiiaai/ckofqwhvv1ujy17p27p0a6cr8',
        center: [37.6097, 55.7701],
        zoom: 9.25,
        pitch: 40,
        bearing: 0,
        container: 'map',
        antialias: true
    });

    map.on('load', function () {
        // Insert the layer beneath any symbol layer.
        var layers = map.getStyle().layers;
        var labelLayerId;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                labelLayerId = layers[i].id;
                break;
            }
        }

        // The 'building' layer in the Mapbox Streets
        // vector tileset contains building height data
        // from OpenStreetMap.
        map.addLayer(
            {
                'id': 'add-3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#d4d4d4',

                    // Use an 'interpolate' expression to
                    // add a smooth transition effect to
                    // the buildings as the user zooms in.
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.5
                }
            },

            labelLayerId
        );
    });
