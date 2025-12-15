# 3D House Panorama Viewer

A Three.js project that displays a 3D house model on a panoramic image with animated clouds in the sky.

## Features

- **Panoramic Background**: Displays a panoramic image as the scene background
- **3D Model**: Loads and displays a GLB model with Draco compression support
- **Animated Clouds**: Video texture for moving clouds in the sky area
- **Animation Controls**: Play/Pause button to control Blender animations
- **Baked Lighting**: Supports baked lighting from Blender models

## Requirements

- Node.js (for running the server)
- Google Chrome browser

## Setup and Running

### Option 1: Using Node.js Server (Recommended)

1. Make sure Node.js is installed on your system
2. Open a terminal in this folder
3. Run the server:
   ```bash
   node server.js
   ```
   Or double-click `start-server.bat` on Windows

4. The server will automatically open Chrome at `http://localhost:8080`

### Option 2: Using Python Server (Alternative)

If you have Python installed, you can use:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Files

- `index.html` - Main HTML file
- `app.js` - Three.js application logic
- `styles.css` - Styling
- `server.js` - Node.js HTTP server
- `start-server.bat` - Windows batch file to start the server
- `package.json` - Node.js package configuration

## Controls

- **Mouse Drag**: Rotate the camera view
- **Mouse Wheel**: Zoom in/out
- **Play/Pause Button**: Control the 3D model animations

## Model Positioning

The model is positioned at the origin (0, 0, 0). You may need to adjust the position in `app.js` based on your specific model and panoramic image alignment.

## Notes

- The clouds video plays automatically in a loop
- The 3D model animations start automatically when loaded
- Draco compression is used for efficient model loading
- The panoramic image is used as both background and environment reflection

