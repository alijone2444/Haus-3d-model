// Babylon.js Scene setup
let scene, engine, camera, model = null;
let animationGroups = [];
let isPlaying = false;
let shadowGenerator = null;
let sunMesh = null;
let sunLight = null;
let originalYPosition = null; // Store original Y position
let isAnimationForward = true; // Track animation direction
let isAnimating = false; // Track if animation is currently playing
let originalScaleFactor = null

// Background video now rendered inside Babylon scene instead of HTML

// Initialize the scene
function init() {
    // Get canvas element
    const canvas = document.getElementById('canvas');

    // Create Babylon.js engine
    engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true
    });

    // Create scene
    scene = new BABYLON.Scene(engine);

    // Set scene properties - transparent background for CSS video
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

    // Create default ArcRotateCamera
    camera = new BABYLON.ArcRotateCamera(
        "camera",
        0, // alpha (horizontal rotation) - default
        Math.PI / 2, // beta (vertical rotation) - default
        10, // radius (distance from target) - default
        BABYLON.Vector3.Zero(), // target - default (origin)
        scene
    );

    // Enable camera controls
    camera.attachControl(canvas, true);

    // Create Babylon video background plane that always stays behind the model
    createVideoBackground();

    // Add lighting for proper model illumination
    setupLighting();

    // Setup Bloom Effect
    setupBloomEffect();

    // Load 3D model
    loadModel();

    // Setup play/pause button
    setupControls();

    // Handle window resize
    window.addEventListener('resize', () => {
        engine.resize();
    });

    // Start render loop
    engine.runRenderLoop(() => {
        scene.render();
    });
}

// Create a fullscreen video plane that follows the camera (Babylon-based background video)
function createVideoBackground() {
    // Create the video texture
    const videoTexture = new BABYLON.VideoTexture(
        "videoTexture",
        ["loopVideo.mp4"],
        scene,
        true,
        true,
        BABYLON.VideoTexture.TRILINEAR_SAMPLINGMODE,
        {
            autoPlay: true,
            loop: true,
            muted: true
        }
    );

    // Fix upside-down video
    videoTexture.vScale = -1; // flip vertically

    // Get camera field of view in radians
    const fovRad = camera.fov;

    // Distance from camera - large enough to cover entire view
    const distance = 50;

    // Calculate plane dimensions to exactly fill camera view
    const height = 2 * Math.tan(fovRad / 2) * distance; // based on FOV
    const aspectRatio = engine.getAspectRatio(camera);
    const width = height * aspectRatio; // based on aspect ratio

    // Create a fullscreen plane for the video background
    const videoPlane = BABYLON.MeshBuilder.CreatePlane("videoBackgroundPlane", {
        width: width,
        height: height
    }, scene);

    // Explicitly set scale
    videoPlane.scaling = new BABYLON.Vector3(1, 1, 1);

    // Set material - disable all reflection and lighting effects
    const material = new BABYLON.StandardMaterial("videoBackgroundMaterial", scene);
    material.diffuseTexture = videoTexture;
    material.disableLighting = true;
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    material.emissiveColor = new BABYLON.Color3(1, 1, 1);
    material.emissiveTexture = videoTexture;
    material.reflectionTexture = null;
    material.reflectionFresnelParameters = null;
    material.ambientColor = new BABYLON.Color3(0, 0, 0);
    material.alpha = 1.0;
    material.backFaceCulling = false;
    material.useReflectionFresnelFromSpecular = false;
    material.useReflectionOverAlpha = false;
    material.useSpecularOverAlpha = false;

    videoPlane.material = material;

    // Video plane itself does NOT receive or cast shadows
    videoPlane.receiveShadows = false;
    if (shadowGenerator) {
        shadowGenerator.removeShadowCaster(videoPlane);
    }

    // Make sure the plane doesn't interfere with picking / serialization
    videoPlane.isPickable = false;
    videoPlane.doNotSerialize = true;

    // SECOND PLANE: shadow catcher sitting on top of the video
    const shadowPlane = BABYLON.MeshBuilder.CreatePlane("videoShadowPlane", {
        width: width,
        height: height
    }, scene);

    shadowPlane.scaling = new BABYLON.Vector3(1, 1, 1);

    const shadowMat = new BABYLON.ShadowOnlyMaterial("videoShadowMaterial", scene);
    shadowMat.alpha = 0.7; // how strong the shadow appears over the video
    shadowPlane.material = shadowMat;

    // This plane receives shadows from the house/model
    shadowPlane.receiveShadows = true;
    shadowPlane.isPickable = false;
    shadowPlane.doNotSerialize = true;

    // Keep both planes fixed relative to camera
    scene.onBeforeRenderObservable.add(() => {
        if (videoPlane && shadowPlane && camera) {
            const cameraDirection = camera.getForwardRay().direction;
            const basePos = camera.position.add(cameraDirection.scale(distance));

            // Background video plane position
            videoPlane.position = basePos;
            videoPlane.lookAt(videoPlane.position.add(cameraDirection));
            videoPlane.scaling = new BABYLON.Vector3(1, 1, 1);

            // Shadow plane slightly closer to camera so its shadow is visible over the video
            shadowPlane.position = basePos.add(cameraDirection.scale(-0.01));
            shadowPlane.lookAt(shadowPlane.position.add(cameraDirection));
            shadowPlane.scaling = new BABYLON.Vector3(1, 1, 1);
        }
    });

    console.log('Babylon video background plane created');
}

// Setup realistic lighting like Babylon.js model viewer (Image Based Lighting)
function setupLighting() {
    // Create environment texture for Image Based Lighting (IBL)
    // This provides realistic reflections and lighting like model viewer
    try {
        // Load HDRI environment texture for realistic IBL
        // Using Babylon.js default environment
        const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
            "https://assets.babylonjs.com/environments/environmentSpecular.env",
            scene
        );
        scene.environmentTexture = hdrTexture;
        scene.environmentIntensity = 1.0;

        console.log('HDRI environment texture loaded for IBL');
    } catch (error) {
        console.warn('Could not load HDRI environment, using procedural fallback:', error);
        // Fallback: Create procedural environment
        scene.environmentIntensity = 0.8;
        // Create a simple gradient environment
        const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
            null,
            scene
        );
        if (envTexture) {
            scene.environmentTexture = envTexture;
        }
    }

    // Set up realistic lighting setup similar to model viewer
    // Primary directional light (main sun/key light) - 3-point lighting setup
    const mainLight = new BABYLON.DirectionalLight(
        "mainLight",
        new BABYLON.Vector3(-2.0, -0.70, 1.80), // Natural sun direction
        scene
    );
    mainLight.intensity = 1.2; // Moderate intensity for realistic look
    mainLight.diffuse = new BABYLON.Color3(1, 0.95, 0.9); // Warm sunlight
    mainLight.specular = new BABYLON.Color3(1, 0.95, 0.9);

    // Fill light from opposite side (softer, cooler) - 3-point lighting
    const fillLight = new BABYLON.DirectionalLight(
        "fillLight",
        new BABYLON.Vector3(0.3, -0.5, 0.2), // Softer fill direction
        scene
    );
    fillLight.intensity = 0.3; // Much softer than main light
    fillLight.diffuse = new BABYLON.Color3(0.7, 0.8, 1.0); // Cool fill light
    fillLight.specular = new BABYLON.Color3(0.7, 0.8, 1.0);

    // Rim/back light for edge definition
    const rimLight = new BABYLON.DirectionalLight(
        "rimLight",
        new BABYLON.Vector3(0.2, 0.3, 1), // Behind the model
        scene
    );
    rimLight.intensity = 0.2; // Very subtle rim light
    rimLight.diffuse = new BABYLON.Color3(0.8, 0.85, 1.0);

    // Ambient/hemispheric light for base illumination
    const ambientLight = new BABYLON.HemisphericLight(
        "ambientLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    ambientLight.intensity = 0.5; // Subtle ambient
    ambientLight.diffuse = new BABYLON.Color3(0.6, 0.7, 0.8); // Slightly cool ambient
    ambientLight.groundColor = new BABYLON.Color3(0.3, 0.3, 0.35); // Ground reflection

    // Enable shadows on main light only (for performance)
    mainLight.shadowEnabled = true;
    shadowGenerator = new BABYLON.ShadowGenerator(2048, mainLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.setDarkness(0.15); // Lighter, softer shadows for realistic look

    console.log('Realistic IBL lighting setup complete (model viewer style)');
}

// Setup Bloom Effect for the model
function setupBloomEffect() {
    try {
        // Create Default Rendering Pipeline with HDR support for bloom
        const pipeline = new BABYLON.DefaultRenderingPipeline(
            "defaultPipeline",
            true, // Enable HDR
            scene,
            [camera]
        );

        // Enable and configure Bloom Effect
        pipeline.bloomEnabled = true;
        pipeline.bloomWeight = 0.4; // Intensity of the bloom effect (0-1)
        pipeline.bloomThreshold = 0.8; // Brightness threshold for bloom (0-1)
        pipeline.bloomKernel = 64; // Size of the bloom kernel (higher = more spread)
        pipeline.bloomScale = 0.5; // Scale of the bloom effect

        // Store pipeline reference for potential adjustments
        window.bloomPipeline = pipeline;

        console.log('Bloom Effect setup complete');
    } catch (error) {
        console.warn('Bloom Effect not available:', error.message);
        // Fallback: Try using GlowLayer for model glow
        try {
            const glowLayer = new BABYLON.GlowLayer("glow", scene);
            glowLayer.intensity = 0.5;
            window.glowLayer = glowLayer;
            console.log('Using GlowLayer as fallback');
        } catch (glowError) {
            console.error('Could not setup bloom or glow effect:', glowError);
        }
    }
}

// Background video removed - using CSS video background instead

// Load 3D model with GLB/GLTF support
function loadModel() {
    // Use Append to properly load animations - ImportMesh might not load all animations
    BABYLON.SceneLoader.Append(
        "",
        "model5.glb",
        scene,
        () => {
            // Get all meshes from the scene, but EXCLUDE the video background & shadow planes
            const meshes = scene.meshes.filter(m =>
                m instanceof BABYLON.Mesh &&
                m.name !== "videoBackgroundPlane" &&
                m.name !== "videoShadowPlane"
            );
            const skeletons = scene.skeletons;
            const animationGroups = scene.animationGroups;

            // Process the loaded data
            processLoadedModel(meshes, skeletons, animationGroups);
        },
        (progress) => {
            if (progress.lengthComputable) {
                const percent = (progress.loaded / progress.total) * 100;
                console.log('Loading progress: ' + percent.toFixed(2) + '%');
            }
        },
        (error) => {
            console.error('Error loading model:', error);
        }
    );
}

// Process loaded model
function processLoadedModel(meshes, skeletons, animationGroups) {
    console.log('Model loaded successfully');
    console.log(`Found ${meshes.length} mesh(es), ${skeletons ? skeletons.length : 0} skeleton(s), ${animationGroups ? animationGroups.length : 0} animation group(s)`);

    // Store animation groups - Ensure animations are stopped and only play on button click
    if (animationGroups && animationGroups.length > 0) {
        window.animationGroups = animationGroups;
        animationGroups.forEach((animGroup) => {
            animGroup.stop(); // Stop all animations
            animGroup.speedRatio = 0; // Set speed to 0 (paused)
        });
        console.log(`Loaded ${animationGroups.length} animation group(s). Ready to play.`);
    } else {
        // Try to get animations from skeletons if animationGroups is empty
        if (skeletons && skeletons.length > 0) {
            console.log(`Found ${skeletons.length} skeleton(s), checking for animations...`);
            skeletons.forEach((skeleton) => {
                const animRanges = skeleton.getAnimationRanges();
                if (animRanges.length > 0) {
                    console.log(`Found ${animRanges.length} animation range(s) in skeleton "${skeleton.name}"`);
                }
            });
        }
        console.log('No animation groups found in model');
    }

    // Find root mesh (mesh without parent)
    let rootMesh = null;
    meshes.forEach((mesh) => {
        if (mesh instanceof BABYLON.Mesh) {
            // Enable shadows
            console.log('mesh', mesh)
            mesh.receiveShadows = true;
            if (shadowGenerator) {
                shadowGenerator.addShadowCaster(mesh, true);
            }

            // Enhance materials for realistic IBL lighting (model viewer style)
            if (mesh.material) {
                if (mesh.material instanceof BABYLON.StandardMaterial) {
                    // Use environment texture for reflections (IBL)
                    if (scene.environmentTexture) {
                        mesh.material.reflectionTexture = scene.environmentTexture;
                        mesh.material.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                        mesh.material.reflectionFresnelParameters.bias = 0.1;
                    }
                    // Enhance specular for realistic reflections
                    if (mesh.material.specularColor) {
                        mesh.material.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
                    }
                    // Subtle emissive for bloom
                    if (!mesh.material.emissiveColor) {
                        mesh.material.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);
                    }
                } else if (mesh.material instanceof BABYLON.PBRMaterial) {
                    // PBR materials automatically use environment texture
                    // Just enhance the settings for realistic look
                    mesh.material.environmentIntensity = 1.0;
                    mesh.material.metallicFactor = 0.1; // Slight metallic for reflections
                    mesh.material.roughness = 0.3; // Moderate roughness
                }
            }

            // Process child meshes
            mesh.getChildMeshes().forEach((child) => {
                if (child instanceof BABYLON.Mesh) {
                    child.receiveShadows = true;
                    if (shadowGenerator) {
                        shadowGenerator.addShadowCaster(child, true);
                    }

                    // Enhance child materials for realistic IBL
                    if (child.material) {
                        if (child.material instanceof BABYLON.StandardMaterial) {
                            if (scene.environmentTexture) {
                                child.material.reflectionTexture = scene.environmentTexture;
                                child.material.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                                child.material.reflectionFresnelParameters.bias = 0.1;
                            }
                            if (child.material.specularColor) {
                                child.material.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
                            }
                            if (!child.material.emissiveColor) {
                                child.material.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);
                            }
                        } else if (child.material instanceof BABYLON.PBRMaterial) {
                            child.material.environmentIntensity = 1.0;
                            child.material.metallicFactor = 0.1;
                            child.material.roughness = 0.3;
                        }
                    }
                }
            });

            console.log('Mesh loaded:', mesh.name);

            // Find root mesh (no parent or parent is not a mesh)
            if (!rootMesh && (!mesh.parent || !(mesh.parent instanceof BABYLON.Mesh))) {
                rootMesh = mesh;
            }
        }
    });

    // If no root found, use first mesh
    if (!rootMesh && meshes.length > 0) {
        rootMesh = meshes[0];
    }

    // Calculate bounding box for the entire model and position on ground
    console.log('rootMesh###########################', rootMesh)
    if (rootMesh) {
        console.log('inside###########################')
        // Create a temporary bounding box from all meshes
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        console.log('inside###########################2')

        meshes.forEach((mesh) => {
            if (mesh instanceof BABYLON.Mesh) {
                const boundingInfo = mesh.getBoundingInfo();
                const meshMin = boundingInfo.boundingBox.minimumWorld;
                const meshMax = boundingInfo.boundingBox.maximumWorld;
                console.log('inside###########################3')

                min = BABYLON.Vector3.Minimize(min, meshMin);
                max = BABYLON.Vector3.Maximize(max, meshMax);
            }
        });

        console.log('inside###########################4')
        const center = BABYLON.Vector3.Center(min, max);
        console.log('inside###########################5', center);

        // Calculate size (not needed for positioning, but useful for debugging)
        const size = max.subtract(min);
        console.log('inside###########################6', size);

        // Increase scale of the house
        const scaleFactor = 1.35; // Increase size by 50%
        rootMesh.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
        console.log('Model scaled by:', scaleFactor);
        // ADD THIS LINE

        // Position the model below ground surface
        rootMesh.position.y = -center.y - 1.5; // Move down by 1.0 units
        rootMesh.position.x = -center.x - 0; // Move closer to camera/screen (more negative = closer)

        console.log('Model positioned at Y:', rootMesh.position.y, rootMesh.position.x);

        // Store original Y position for reverse animation
        originalYPosition = rootMesh.position.y;

        // No custom rotation - use default rotation from Blender
        model = rootMesh;
    }
}

// Function to move model up and start animation (forward)
// Function to move model up and start animation (forward)
function moveModelUpAndAnimate() {
    if (model) {
        // Store current scale for reference
        const currentScale = model.scaling.x;
        const targetScale = 1.0; // Scale to 1 as requested

        const startY = model.position.y;
        const targetY = -1;
        const duration = 2000; // 2 seconds for smooth movement
        const fps = 30;
        const endFrame = duration / 1000 * fps;

        // Create animation for position.y
        const positionAnimation = new BABYLON.Animation(
            "moveUpAnimation",
            "position.y",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Create animation for scaling
        const scaleAnimation = new BABYLON.Animation(
            "scaleUpAnimation",
            "scaling",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Create keyframes for position
        const positionKeys = [
            { frame: 0, value: startY },
            { frame: endFrame, value: targetY }
        ];

        // Create keyframes for scaling (all axes simultaneously)
        const scaleKeys = [
            { frame: 0, value: new BABYLON.Vector3(currentScale, currentScale, currentScale) },
            { frame: endFrame, value: new BABYLON.Vector3(targetScale, targetScale, targetScale) }
        ];

        positionAnimation.setKeys(positionKeys);
        scaleAnimation.setKeys(scaleKeys);

        // Add easing for smooth movement
        const easingFunction = new BABYLON.CubicEase();
        easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        positionAnimation.setEasingFunction(easingFunction);
        scaleAnimation.setEasingFunction(easingFunction);

        // Add both animations to model
        model.animations = [];
        model.animations.push(positionAnimation);
        model.animations.push(scaleAnimation);

        // Start both animations
        scene.beginAnimation(model, 0, endFrame, false, 1.0);

        // Store original scale for reverse animation
        if (!originalScaleFactor) {
            originalScaleFactor = currentScale;
        }
    }

    // Start animation groups forward
    if (window.animationGroups && window.animationGroups.length > 0) {
        window.animationGroups.forEach((animGroup) => {
            // Reset to beginning of animation
            animGroup.goToFrame(0);
            animGroup.speedRatio = 1.0; // Play at normal speed
            animGroup.play(false); // Don't loop - play once

            // Listen for animation end
            animGroup.onAnimationEndObservable.addOnce(() => {
                isAnimating = false;
                const playPauseBtn = document.getElementById('play-pause-btn');
                if (playPauseBtn) {
                    playPauseBtn.disabled = false;
                    playPauseBtn.textContent = '▶ Play';
                }
            });
        });
    }
}
// Function to move model down and play animation in reverse
// Function to move model down and play animation in reverse
function moveModelDownAndAnimateReverse() {
    if (model && originalYPosition !== null && originalScaleFactor !== null) {
        const startY = model.position.y;
        const targetY = originalYPosition;
        const currentScale = model.scaling.x;
        const targetScale = originalScaleFactor; // Restore original scale
        const duration = 2000; // 2 seconds for smooth movement
        const fps = 30;
        const endFrame = duration / 1000 * fps;

        // Create animation for position.y
        const positionAnimation = new BABYLON.Animation(
            "moveDownAnimation",
            "position.y",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Create animation for scaling
        const scaleAnimation = new BABYLON.Animation(
            "scaleDownAnimation",
            "scaling",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Create keyframes for position
        const positionKeys = [
            { frame: 0, value: startY },
            { frame: endFrame, value: targetY }
        ];

        // Create keyframes for scaling
        const scaleKeys = [
            { frame: 0, value: new BABYLON.Vector3(currentScale, currentScale, currentScale) },
            { frame: endFrame, value: new BABYLON.Vector3(targetScale, targetScale, targetScale) }
        ];

        positionAnimation.setKeys(positionKeys);
        scaleAnimation.setKeys(scaleKeys);

        // Add easing for smooth movement
        const easingFunction = new BABYLON.CubicEase();
        easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        positionAnimation.setEasingFunction(easingFunction);
        scaleAnimation.setEasingFunction(easingFunction);

        // Add both animations to model
        model.animations = [];
        model.animations.push(positionAnimation);
        model.animations.push(scaleAnimation);

        // Start both animations
        scene.beginAnimation(model, 0, endFrame, false, 1.0);
    }

    // Start animation groups in reverse
    if (window.animationGroups && window.animationGroups.length > 0) {
        window.animationGroups.forEach((animGroup) => {
            // Reset to end of animation before playing in reverse
            animGroup.goToFrame(animGroup.to - animGroup.from);
            animGroup.speedRatio = -1.0; // Play in reverse
            animGroup.play(false); // Don't loop - play once

            // Listen for animation end
            animGroup.onAnimationEndObservable.addOnce(() => {
                isAnimating = false;
                const playPauseBtn = document.getElementById('play-pause-btn');
                if (playPauseBtn) {
                    playPauseBtn.disabled = false;
                    playPauseBtn.textContent = '▶ Play';
                }
            });
        });
    }
}

// Setup play/pause controls
function setupControls() {
    const playPauseBtn = document.getElementById('play-pause-btn');

    // Set initial button state
    playPauseBtn.textContent = '▶ Play';
    playPauseBtn.disabled = false;

    playPauseBtn.addEventListener('click', () => {
        // Don't do anything if animation is currently playing
        if (isAnimating) {
            return;
        }

        if (window.animationGroups && window.animationGroups.length > 0) {
            // Disable button during animation
            playPauseBtn.disabled = true;
            isAnimating = true;

            if (isAnimationForward) {
                // Play forward animation
                moveModelUpAndAnimate();
                isAnimationForward = false; // Next time will be reverse
            } else {
                // Play reverse animation
                moveModelDownAndAnimateReverse();
                isAnimationForward = true; // Next time will be forward
            }
        } else {
            // If no animations yet, just toggle button state
            console.log('No animations available yet');
        }
    });
}

// Initialize background video (CSS video)
// NOTE: now using Babylon video plane instead of HTML/CSS video, so this is no longer needed.

// Initialize when page loads
window.addEventListener('load', () => {
    init();
});

