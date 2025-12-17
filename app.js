

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
let mainLight = null; // Store main light reference for camera-following
let originalLightDirection = new BABYLON.Vector3(1.4, -1.0, 1.40); // Store original light direction
let hasAutoPlayed = false; // Track if first auto-animation has run

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

    // Add lighting for proper model illumination (must be before createVideoBackground)
    setupLighting();

    // Create Babylon video background plane that always stays behind the model
    createVideoBackground();

    // Setup Bloom Effect
    setupBloomEffect();

    // Load 3D model
    loadModel();

    // Setup play/pause button
    setupControls();
    
    // Setup light direction sliders (commented out for now)
    // setupLightControls();
    
    // Setup mesh click detection
    setupMeshClickDetection();

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

    // Distance from camera - closer to model but still behind it
    // Reduced from 50 to 15 to bring video closer without model going inside
    const distance = 15;
    
    // Store distance globally to set camera zoom limit
    window.videoPlaneDistance = distance;
    
    // Set camera zoom out limit to prevent zooming beyond video plane distance
    // upperRadiusLimit prevents zooming out (increasing radius) beyond this point
    camera.upperRadiusLimit = distance;

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
    
    // Use rendering groups to control render order:
    // 0 = video plane (background)
    // 1 = shadow plane (shadows on ground)
    // 2 = model (foreground, renders on top of shadows)
    videoPlane.renderingGroupId = 0;
    shadowPlane.renderingGroupId = 1;
    
    // Enable depth testing on shadow material to respect z-ordering
    shadowMat.disableDepthWrite = false;
    shadowPlane.enableDepthSort = true;
    
    // Note: In Babylon.js, setting receiveShadows = true is sufficient
    // The shadow generator automatically handles meshes with receiveShadows enabled
    // No need to explicitly add shadow receivers

    // Fixed Y position for the shadow plane
    const fixedYPosition = 0; // Set this to whatever Y position you want shadows to appear at

    // Keep both planes fixed relative to camera
    scene.onBeforeRenderObservable.add(() => {
        if (videoPlane && shadowPlane && camera) {
            const cameraDirection = camera.getForwardRay().direction;

            // For video plane: follow camera normally
            const basePos = camera.position.add(cameraDirection.scale(distance));

            // Background video plane position
            videoPlane.position = basePos;
            videoPlane.lookAt(videoPlane.position.add(cameraDirection));
            videoPlane.scaling = new BABYLON.Vector3(1, 1, 1);

            // For shadow plane: position at same location as video plane but with fixed Y
            // Create a modified camera direction with Y fixed
            const fixedCameraDirection = new BABYLON.Vector3(
                cameraDirection.x,
                0, // Keep Y at 0 to prevent vertical movement
                cameraDirection.z
            ).normalize();

            // Position shadow plane slightly further back than video plane to ensure it's behind model
            // This prevents shadows from appearing over the model
            const shadowBasePos = camera.position.add(fixedCameraDirection.scale(distance + 0.5));
            // Apply fixed Y position for ground-level shadows
            shadowBasePos.y = fixedYPosition;
            
            // Shadow plane positioned slightly behind video plane
            shadowPlane.position = shadowBasePos;

            // Make shadow plane look in the same direction (but with fixed Y)
            const shadowLookDirection = new BABYLON.Vector3(
                cameraDirection.x,
                0, // Keep looking horizontally
                cameraDirection.z
            ).normalize();
            shadowPlane.lookAt(shadowPlane.position.add(shadowLookDirection));

            shadowPlane.scaling = new BABYLON.Vector3(1, 1, 1);
        }

        // Update main light direction to follow camera orientation (keep shadows fixed)
        if (mainLight && camera) {
            // Get camera's world matrix which transforms from camera space to world space
            const worldMatrix = camera.getWorldMatrix();
            
            // Transform the original light direction by the camera's world matrix
            // Vector3.TransformNormal automatically ignores translation, so we can use the full matrix
            // This keeps the light direction relative to the camera view
            const transformedDirection = BABYLON.Vector3.TransformNormal(
                originalLightDirection,
                worldMatrix
            );
            
            // Update the light direction
            mainLight.direction = transformedDirection;
        }
    });

    console.log('Babylon video background plane created with fixed Y shadow plane');
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
    mainLight = new BABYLON.DirectionalLight(
        "mainLight",
        originalLightDirection.clone(), // Natural sun direction (will be updated to follow camera)
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
    
    // Configure shadow map to cover a large area (for shadows on video background)
    // This ensures shadows are cast properly on the shadow plane
    const shadowMapSize = 2048;
    mainLight.shadowMinZ = 1;
    mainLight.shadowMaxZ = 200; // Large enough to cover the scene and video background

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
        "model5.compressed.glb",
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
            // Set model to rendering group 2 so it renders on top of shadow plane (group 1)
            mesh.renderingGroupId = 2;
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
                        // Set child meshes to rendering group 2 so they render on top of shadow plane
                        child.renderingGroupId = 2;
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
        const scaleFactor = 1.5; // Increase size by 50%
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
        
        // Setup automatic first-time animation when model becomes visible
        setupAutoPlayOnVisibility();
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
function moveModelDownAndAnimateReverse() {
    if (model && originalYPosition !== null) {
        const startY = model.position.y;
        const targetY = originalYPosition;
        const duration = 2000; // 2 seconds
        const fps = 30;
        const endFrame = duration / 1000 * fps;

        // ----- Position Animation -----
        const positionAnimation = new BABYLON.Animation(
            "moveDownAnimation",
            "position.y",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const positionKeys = [
            { frame: 0, value: startY },
            { frame: endFrame, value: targetY }
        ];
        positionAnimation.setKeys(positionKeys);

        // ----- Scale Animation -----
        if (originalScaleFactor !== null) {
            const startScale = model.scaling.x; // assuming uniform scaling
            const scaleAnimation = new BABYLON.Animation(
                "scaleDownAnimation",
                "scaling",
                fps,
                BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );

            const scaleKeys = [
                { frame: 0, value: new BABYLON.Vector3(startScale, startScale, startScale) },
                { frame: endFrame, value: new BABYLON.Vector3(originalScaleFactor, originalScaleFactor, originalScaleFactor) }
            ];

            scaleAnimation.setKeys(scaleKeys);

            // Add easing
            const easingFunction = new BABYLON.CubicEase();
            easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
            positionAnimation.setEasingFunction(easingFunction);
            scaleAnimation.setEasingFunction(easingFunction);

            // Add both animations to model
            model.animations = [positionAnimation, scaleAnimation];
        } else {
            // Only position animation
            model.animations = [positionAnimation];
        }

        // Start animation
        scene.beginAnimation(model, 0, endFrame, false, 1.0);
    }

    // Reverse animation groups (skeleton/GLB animations)
    if (window.animationGroups && window.animationGroups.length > 0) {
        window.animationGroups.forEach((animGroup) => {
            animGroup.goToFrame(animGroup.to - animGroup.from);
            animGroup.speedRatio = -1.0;
            animGroup.play(false);

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


// Setup automatic first-time animation when model becomes visible on screen
function setupAutoPlayOnVisibility() {
    if (hasAutoPlayed) return; // Already played, don't set up again
    
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    // Function to trigger the animation
    const triggerAutoPlay = () => {
        if (hasAutoPlayed) return; // Already played
        hasAutoPlayed = true; // Mark as played
        
        // Small delay to ensure everything is ready, then play animation
        setTimeout(() => {
            if (window.animationGroups && window.animationGroups.length > 0 && !isAnimating) {
                console.log('Model visible - auto-playing animation for the first time');
                isAnimating = true;
                moveModelUpAndAnimate();
                isAnimationForward = false; // Next time will be reverse
            }
        }, 500); // 500ms delay to ensure smooth start
    };
    
    // Check if canvas is already visible (likely on page load)
    const rect = canvas.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0 && 
                      rect.left < window.innerWidth && rect.right > 0;
    
    if (isVisible) {
        // Canvas is already visible, trigger immediately
        triggerAutoPlay();
    } else {
        // Use Intersection Observer to detect when canvas becomes visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // If canvas is visible and we haven't auto-played yet
                if (entry.isIntersecting && !hasAutoPlayed) {
                    observer.disconnect(); // Stop observing
                    triggerAutoPlay();
                }
            });
        }, {
            threshold: 0.1 // Trigger when at least 10% of canvas is visible
        });
        
        // Start observing the canvas
        observer.observe(canvas);
        console.log('Auto-play on visibility observer set up');
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

// Setup light direction controls
function setupLightControls() {
    const lightXSlider = document.getElementById('light-x');
    const lightYSlider = document.getElementById('light-y');
    const lightZSlider = document.getElementById('light-z');
    const lightXValue = document.getElementById('light-x-value');
    const lightYValue = document.getElementById('light-y-value');
    const lightZValue = document.getElementById('light-z-value');

    // Function to update light direction
    const updateLightDirection = () => {
        if (!mainLight) return;

        // Get current slider values
        const x = parseFloat(lightXSlider.value);
        const y = parseFloat(lightYSlider.value);
        const z = parseFloat(lightZSlider.value);

        // Update the original light direction
        originalLightDirection.x = x;
        originalLightDirection.y = y;
        originalLightDirection.z = z;

        // Update display values
        lightXValue.textContent = x.toFixed(2);
        lightYValue.textContent = y.toFixed(2);
        lightZValue.textContent = z.toFixed(2);

        // If camera exists, transform the direction by camera's world matrix
        if (camera) {
            const worldMatrix = camera.getWorldMatrix();
            const transformedDirection = BABYLON.Vector3.TransformNormal(
                originalLightDirection,
                worldMatrix
            );
            mainLight.direction = transformedDirection;
        } else {
            // If camera not ready yet, just set the direction directly
            mainLight.direction = originalLightDirection.clone();
        }
    };

    // Add event listeners for all sliders
    lightXSlider.addEventListener('input', updateLightDirection);
    lightYSlider.addEventListener('input', updateLightDirection);
    lightZSlider.addEventListener('input', updateLightDirection);

    console.log('Light direction controls initialized');
}

// Setup mesh click detection with raycasting
function setupMeshClickDetection() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    // Mesh data mapping is loaded from meshDataMap.js
    // The meshDataMap variable is available globally
    
    // Function to get mesh data based on name
    const getMeshData = (meshName) => {
        // Check exact match first
        if (meshDataMap[meshName]) {
            return meshDataMap[meshName];
        }
        
        // Check for partial matches (case-insensitive)
        const lowerMeshName = meshName.toLowerCase();
        for (const [key, value] of Object.entries(meshDataMap)) {
            if (lowerMeshName.includes(key.toLowerCase())) {
                return value;
            }
        }
        
        // Return generic data if no match found
        return {
            type: 'Unknown',
            description: 'No specific data available for this mesh',
            features: []
        };
    };
    
    // Get popover element
    const popover = document.getElementById('mesh-popover');
    const popoverType = document.getElementById('popover-type');
    const popoverDescription = document.getElementById('popover-description');
    
    if (!popover || !popoverType || !popoverDescription) {
        console.warn('Popover elements not found');
        return;
    }
    
    // Add hover event listener to show popover
    canvas.addEventListener('pointermove', (event) => {
        if (!scene || !camera) return;
        
        // Get the picking ray from the camera
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        
        // Check if we hit a mesh
        if (pickResult.hit && pickResult.pickedMesh) {
            const mesh = pickResult.pickedMesh;
            
            // Exclude video background and shadow planes
            if (mesh.name === 'videoBackgroundPlane' || mesh.name === 'videoShadowPlane') {
                popover.style.display = 'none';
                return;
            }
            
            // Get mesh data
            const meshData = getMeshData(mesh.name);
            
            // Only show popover for known meshes (not "Unknown")
            if (meshData.type !== 'Unknown') {
                // Update popover content
                popoverType.textContent = meshData.type;
                popoverDescription.textContent = meshData.description;
                
                // Position popover near cursor
                const offsetX = 15; // Offset from cursor
                const offsetY = 15;
                popover.style.left = (event.clientX + offsetX) + 'px';
                popover.style.top = (event.clientY + offsetY) + 'px';
                popover.style.display = 'block';
            } else {
                popover.style.display = 'none';
            }
        } else {
            // No mesh hit, hide popover
            popover.style.display = 'none';
        }
    });
    
    // Hide popover when mouse leaves canvas
    canvas.addEventListener('pointerleave', () => {
        popover.style.display = 'none';
    });
    
    // Add click event listener
    canvas.addEventListener('click', (event) => {
        if (!scene || !camera) return;
        
        // Get the picking ray from the camera
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        
        // Check if we hit a mesh
        if (pickResult.hit && pickResult.pickedMesh) {
            const mesh = pickResult.pickedMesh;
            
            // Exclude video background and shadow planes
            if (mesh.name === 'videoBackgroundPlane' || mesh.name === 'videoShadowPlane') {
                return;
            }
            
            // Get mesh data
            const meshData = getMeshData(mesh.name);
            
            // Console log the mesh information
            console.log('='.repeat(50));
            console.log('MESH CLICKED:');
            console.log('='.repeat(50));
            console.log('Mesh Name:', mesh.name);
            console.log('Mesh Type:', meshData.type);
            console.log('Description:', meshData.description);
            console.log('Features:', meshData.features);
            console.log('Position:', {
                x: mesh.position.x.toFixed(2),
                y: mesh.position.y.toFixed(2),
                z: mesh.position.z.toFixed(2)
            });
            console.log('Material:', mesh.material ? mesh.material.name : 'No material');
            console.log('='.repeat(50));
            
            // Optional: Visual feedback - briefly highlight only the clicked mesh
            // Clone the material to avoid affecting other meshes sharing the same material
            if (mesh.material && mesh.material.emissiveColor) {
                // Store the original material
                const originalMaterial = mesh.material;
                
                // Clone the material for this mesh only
                const highlightMaterial = originalMaterial.clone(originalMaterial.name + '_highlight');
                highlightMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
                
                // Apply the highlight material temporarily
                mesh.material = highlightMaterial;
                
                // Restore original material after 200ms
                setTimeout(() => {
                    mesh.material = originalMaterial;
                    highlightMaterial.dispose(); // Clean up cloned material
                }, 200);
            }
        }
    });
    
    console.log('Mesh click detection enabled');
}

// Initialize background video (CSS video)
// NOTE: now using Babylon video plane instead of HTML/CSS video, so this is no longer needed.

// Initialize when page loads
window.addEventListener('load', () => {
    init();
});

