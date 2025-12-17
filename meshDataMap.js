// Mesh Data Mapping for 3D House Model
// This file contains all the metadata for clickable meshes in the scene

const meshDataMap = {

    // ===== CONSERVATORY =====

    'Cube.011': {
        type: 'Conservatory',
        description: 'A glazed conservatory extension attached to the house, designed to provide additional living space with abundant natural light.',
        features: [
            'Glass walls and roof',
            'Natural daylight',
            'Garden-facing views',
            'Additional living or seating area'
        ],
        link: 'https://example.com/conservatory' // Replace with your actual URL
    },
    'Door.003_primitive0': {
        type: 'Conservatory Door',
        description: 'Access door leading into the conservatory.',
        features: [
            'Interior-exterior transition',
            'Glass panel design',
            'Easy access to conservatory'
        ],
        link: 'https://example.com/conservatory-door' // Replace with your actual URL
    },
    'Cube.007': {
        type: 'Conservatory',
        description: 'A glazed conservatory extension attached to the house, designed to provide additional living space with abundant natural light.',
        features: [
            'Glass walls and roof',
            'Natural daylight',
            'Garden-facing views',
            'Additional living or seating area'
        ]
    },

    // ===== MAIN ENTRANCE =====

    'Door': {
        type: 'Front Entrance Door',
        description: 'Primary entrance door located at the front of the house.',
        features: [
            'Main entry point',
            'Security locking system',
            'Weather protection',
            'Durable construction'
        ],
        link: 'https://example.com/front-door' // Replace with your actual URL
    },
    'Door.002_primitive0': {
        type: 'Front Entrance Door',
        description: 'Primary entrance door located at the front of the house.',
        features: [
            'Main entry point',
            'Security locking system',
            'Weather protection',
            'Durable construction'
        ],
        link: 'https://example.com/front-door' // Replace with your actual URL
    },
    'Stairs.001': {
        type: 'Entrance Steps',
        description: 'Front steps providing access from ground level to the main entrance door.',
        features: [
            'Elevated entry access',
            'Non-slip surface',
            'Structural support'
        ]
    },
    'Cube.005': {
        type: 'Entrance Railing / Grill',
        description: 'Protective metal grill installed beside the entrance steps for safety and support.',
        features: [
            'Safety barrier',
            'Structural support',
            'Metal construction'
        ]
    },

    // ===== WINDOWS (FRONT) =====

    'Window.003': {
        type: 'Multi-panel Window',
        description: 'Window with multiple glass panels providing enhanced natural light and ventilation.',
        features: [
            'Multiple glass panes',
            'Natural light',
            'Ventilation',
            'Enhanced visibility'
        ],
        link: 'https://example.com/multi-panel-window' // Replace with your actual URL
    },
    'Window.005': {
        type: 'Single Window',
        description: 'Single panel window providing natural light and ventilation.',
        features: [
            'Natural light',
            'Single pane',
            'Ventilation'
        ],
        link: 'https://example.com/single-window' // Replace with your actual URL
    },
    'Window.006': {
        type: 'Window Glass',
        description: 'Glass panel for window providing transparency and light.',
        features: [
            'Transparent glass',
            'Natural light',
            'Weather protection'
        ],
        link: 'https://example.com/window-glass' // Replace with your actual URL
    },
    'Window': {
        type: 'Front Window (Ground Floor – Left)',
        description: 'Ground-floor front-facing window located on the right side of the house.',
        features: [
            'Natural light',
            'Exterior visibility',
            'Ventilation'
        ]
    },
    'Window.001': {
        type: 'Front Window (First Floor – Left)',
        description: 'Upper-floor front-facing window on the right side of the house.',
        features: [
            'Natural light',
            'Elevated exterior view',
            'Ventilation'
        ]
    },
    'Window.002': {
        type: 'Front Window (First Floor – Right)',
        description: 'Upper-floor front-facing window located on the left side of the house.',
        features: [
            'Natural light',
            'Cross ventilation',
            'Exterior visibility'
        ]
    },
    'Window.004': {
        type: 'Front Window (Ground Floor – Right)',
        description: 'Ground-floor front-facing window on the left side of the house.',
        features: [
            'Natural light',
            'Ventilation',
            'Exterior view'
        ]
    },

    // ===== WINDOWS (BACK) =====

    'Window.L': {
        type: 'Rear Window',
        description: 'Rear-facing window providing light and ventilation to the back of the house.',
        features: [
            'Natural light',
            'Ventilation',
            'Backyard view'
        ]
    },
    'Window.L.001': {
        type: 'Rear Window',
        description: 'Additional rear-facing window for interior illumination.',
        features: [
            'Natural light',
            'Ventilation'
        ]
    },
    'Window.L.002': {
        type: 'Rear Window',
        description: 'Rear window designed for airflow and daylight.',
        features: [
            'Natural light',
            'Ventilation'
        ]
    },
    'Window.L.003': {
        type: 'Rear Window',
        description: 'Rear-facing window contributing to interior comfort.',
        features: [
            'Natural light',
            'Ventilation'
        ]
    },

    // ===== WALLS & STRUCTURE =====

    'Cube': {
        type: 'Brick Exterior Wall',
        description: 'Primary exterior wall constructed with orange brick masonry.',
        features: [
            'Load-bearing structure',
            'Thermal insulation',
            'Durable brick finish'
        ]
    },

    // ===== ROOF & MATERIALS =====

    'Cube.003': {
        type: 'Main Roof',
        description: 'Primary pitched roof structure covering the house.',
        features: [
            'Weather protection',
            'Rainwater runoff',
            'Thermal insulation'
        ]
    },
    'Cube.004': {
        type: 'Rear Roof Section',
        description: 'Roof section covering the rear portion of the house.',
        features: [
            'Weather resistance',
            'Structural coverage'
        ]
    },
    'Cube.002': {
        type: 'Canopy Roof / Window Overhang',
        description: 'Small roof structure installed beneath upper windows for protection and aesthetics.',
        features: [
            'Rain protection',
            'Architectural detailing',
            'Shade provision'
        ]
    },

    // ===== DRAINAGE =====

    'Cube.008': {
        type: 'Rainwater Downpipe',
        description: 'Vertical drainage pipe designed to channel rainwater from the roof to ground level.',
        features: [
            'Rainwater management',
            'Prevents water accumulation',
            'Roof drainage system'
        ]
    },
    'Cube.010': {
        type: 'Rainwater Downpipe',
        description: 'Vertical drainage pipe designed to channel rainwater from the roof to ground level.',
        features: [
            'Rainwater management',
            'Prevents water accumulation',
            'Roof drainage system'
        ]
    }

};

