/*
  ModelStage: one WebGL canvas that shows any number of glTF models.

  Rendering is on demand. A frame is drawn only after something changes
  (requestRender) or while a behavior holds a continuous loop
  (startLoop/stopLoop). Nothing is drawn while the canvas is off screen or the
  tab is hidden. Three.js is imported lazily, so if the CDN fails only the
  models are missing and the rest of the page keeps working.

    import * as ModelStage from './model-stage.js';

    var stage = ModelStage.create(canvas, {
      viewSize: 4.2,          // world units visible vertically, or function(aspect){ return units; }
      pointerTarget: element, // where pointer events are read (defaults to the canvas);
                              // use a covering element when the canvas sits behind content
      lights: function(scene, THREE){}, // replaces the default ambient + key light
      maxPixelRatio: 2        // caps the device pixel ratio; lower it for large canvases
    });
    stage.load('assets/models/thing.glb', {
      behavior: 'spin',       // registered behavior name
      colorVar: '--model-color' // CSS custom property for the theme-aware color (the default);
                              // pass themed: false to keep the file's own materials
    }).then(function(entry){ ... });
    stage.setEntryVisible(entry, true);
    stage.setEntryProgress(entry, 0.5);   // scrub the model's animation, 0..1
    stage.setViewSize(value);             // reframe the camera, e.g. to fit a loaded model

  Behaviors add interactivity. Give each one its own file in js/behaviors/,
  import that file from js/behaviors/index.js, and register it by name. Every
  hook is optional:

    import { registerBehavior } from '../model-stage.js';

    registerBehavior('spin', {
      cursor: 'grab',                                  // cursor while hovering the model
      setup: function(entry, stage){},                 // once, after the model loads
      update: function(entry, dt, stage){},            // each frame while a loop is running
      onPointerEnter: function(entry, pointer, stage){},
      onPointerMove: function(entry, pointer, stage){},
      onPointerLeave: function(entry, pointer, stage){},
      onPointerDown: function(entry, pointer, stage){}, // captures the pointer until onPointerUp
      onPointerUp: function(entry, pointer, stage){},
      onStagePointerMove: function(entry, pointer, stage){},  // any pointer move over the target,
      onStagePointerLeave: function(entry, pointer, stage){}  // hit or not (e.g. proximity effects)
    });

  pointer is { event, intersection, x, y }: intersection is the Three.js raycast
  hit or null, and x/y are the pointer position in canvas pixels.
  stage.projectToCanvas(worldPoint, out) gives a 3D point's canvas pixel position.
  entry.state is scratch space for the behavior, and entry.data holds the
  options.data passed to load().

  A model loaded as its own entry can be attached to another with
  other.root.add(entry.root) to inherit that model's movement. Pointer hits on
  it count for the nearest interactive ancestor.
*/
var behaviors = {};
var threePromise = null;
var POINTER_HOOKS = ['onPointerEnter', 'onPointerMove', 'onPointerLeave', 'onPointerDown', 'onPointerUp'];

// Every stage shares a single Three.js download.
function loadThree(){
  if (!threePromise){
    threePromise = Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js')
    ]).then(function(modules){
      return { THREE: modules[0], loader: new modules[1].GLTFLoader() };
    });
  }
  return threePromise;
}

// Colors come from CSS custom properties, which the stylesheet redefines per theme.
function getThemeColor(colorVar){
  return getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
}

function addDefaultLights(scene, THREE){
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  var keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(1.76, 1.9, 1.5);
  var keyRotation = new THREE.Euler(THREE.MathUtils.degToRad(-50), 0, THREE.MathUtils.degToRad(-50));
  var keyDirection = new THREE.Vector3(0, 0, -1).applyEuler(keyRotation);
  keyLight.target.position.copy(keyLight.position).add(keyDirection);
  scene.add(keyLight);
  scene.add(keyLight.target);
}

function hasPointerHooks(behavior){
  return POINTER_HOOKS.some(function(name){ return typeof behavior[name] === 'function'; });
}

// Hits resolve to the nearest interactive entry, so attached models count as their parent.
function findEntry(object){
  while (object){
    var entry = object.userData.modelEntry;
    if (entry && entry.interactive) return entry;
    object = object.parent;
  }
  return null;
}

function isShown(object){
  while (object){
    if (!object.visible) return false;
    object = object.parent;
  }
  return true;
}

export function create(canvas, options){
  options = options || {};
  var viewSize = options.viewSize || 4.2;
  var pointerTarget = options.pointerTarget || canvas;
  var addLights = options.lights || addDefaultLights;
  var maxPixelRatio = options.maxPixelRatio || 2;
  var themedMaterials = [];
  var loopOwners = new Set();
  var dirty = true;
  var frameId = 0;
  var lastFrameTime = 0;
  var onScreen = false;
  var pageVisible = document.visibilityState === 'visible';
  var raycaster = null;
  var pointerCoords = null;
  var projected = null;
  // Canvas size in CSS px, kept by resize so per-vertex projection never reads layout.
  var canvasWidth = 0;
  var canvasHeight = 0;
  var hoveredEntry = null;
  var capturedEntry = null;

  var stage = {
    canvas: canvas,
    entries: [],
    THREE: null,
    scene: null,
    camera: null,
    renderer: null,
    ready: null,
    load: load,
    requestRender: requestRender,
    startLoop: startLoop,
    stopLoop: stopLoop,
    setEntryVisible: setEntryVisible,
    setEntryProgress: setEntryProgress,
    setViewSize: setViewSize,
    projectToCanvas: projectToCanvas
  };

  // ---------- frame scheduling ----------
  function canDraw(){
    return !!stage.renderer && onScreen && pageVisible;
  }

  function scheduleFrame(){
    if (!frameId && canDraw() && (dirty || loopOwners.size)){
      frameId = window.requestAnimationFrame(frame);
    }
  }

  function pause(){
    if (frameId){
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    lastFrameTime = 0;
  }

  function frame(time){
    frameId = 0;
    dirty = false;
    if (loopOwners.size){
      var dt = lastFrameTime ? Math.min(0.1, (time - lastFrameTime) / 1000) : 0;
      lastFrameTime = time;
      stage.entries.forEach(function(entry){
        if (entry.root.visible && entry.behavior.update) entry.behavior.update(entry, dt, stage);
      });
    } else {
      lastFrameTime = 0;
    }
    stage.renderer.render(stage.scene, stage.camera);
    scheduleFrame();
  }

  function requestRender(){
    dirty = true;
    scheduleFrame();
  }

  // Owners are any value (a string, an entry) so separate interactions can overlap.
  function startLoop(owner){
    loopOwners.add(owner);
    scheduleFrame();
  }

  function stopLoop(owner){
    loopOwners.delete(owner);
  }

  function updateActivity(){
    if (canDraw()) scheduleFrame();
    else pause();
  }

  // ---------- sizing & theme ----------
  function resize(){
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    if (!width || !height) return;
    canvasWidth = width;
    canvasHeight = height;
    stage.renderer.setSize(width, height, false);
    var aspect = width / height;
    var size = typeof viewSize === 'function' ? viewSize(aspect) : viewSize;
    stage.camera.left = -size * aspect / 2;
    stage.camera.right = size * aspect / 2;
    stage.camera.top = size / 2;
    stage.camera.bottom = -size / 2;
    stage.camera.updateProjectionMatrix();
    requestRender();
  }

  function setViewSize(value){
    viewSize = value;
    if (stage.renderer) resize();
  }

  function refreshThemedMaterials(){
    themedMaterials.forEach(function(themed){ themed.material.color.set(getThemeColor(themed.colorVar)); });
    requestRender();
  }

  function applyThemedMaterials(root, colorVar){
    var THREE = stage.THREE;
    // Meshes that shared a material keep sharing one, so they can still be batched.
    var replacements = new Map();
    root.traverse(function(object){
      if (!object.isMesh) return;
      var hasMaterialArray = Array.isArray(object.material);
      var materials = hasMaterialArray ? object.material : [object.material];
      var lambertMaterials = materials.map(function(material){
        if (replacements.has(material)) return replacements.get(material);
        var lambertMaterial = new THREE.MeshLambertMaterial({
          color: getThemeColor(colorVar),
          map: material.map || null,
          vertexColors: material.vertexColors,
          transparent: material.transparent,
          opacity: material.opacity,
          side: material.side
        });
        themedMaterials.push({ material: lambertMaterial, colorVar: colorVar });
        replacements.set(material, lambertMaterial);
        return lambertMaterial;
      });
      object.material = hasMaterialArray ? lambertMaterials : lambertMaterials[0];
    });
  }

  // ---------- entries ----------
  function load(src, loadOptions){
    loadOptions = loadOptions || {};
    return stage.ready.then(function(){
      return stage.loader.loadAsync(src);
    }).then(function(gltf){
      var behavior = {};
      if (loadOptions.behavior){
        behavior = behaviors[loadOptions.behavior];
        if (!behavior){
          console.warn('Unknown model behavior "' + loadOptions.behavior + '" for ' + src);
          behavior = {};
        }
      }
      var duration = gltf.animations.reduce(function(maxDuration, clip){
        return Math.max(maxDuration, clip.duration);
      }, 0);
      var entry = {
        src: src,
        root: gltf.scene,
        animations: gltf.animations,
        mixer: duration ? new stage.THREE.AnimationMixer(gltf.scene) : null,
        duration: duration,
        progress: -1,
        behavior: behavior,
        interactive: hasPointerHooks(behavior),
        data: loadOptions.data || {},
        state: {}
      };
      if (entry.mixer){
        gltf.animations.forEach(function(clip){ entry.mixer.clipAction(clip).play(); });
      }
      if (loadOptions.themed !== false) applyThemedMaterials(entry.root, loadOptions.colorVar || '--model-color');
      entry.root.visible = false;
      entry.root.userData.modelEntry = entry;
      stage.scene.add(entry.root);
      stage.entries.push(entry);
      if (behavior.setup) behavior.setup(entry, stage);
      requestRender();
      return entry;
    });
  }

  function setEntryVisible(entry, visible){
    if (entry.root.visible === visible) return;
    entry.root.visible = visible;
    if (!visible) releaseEntry(entry);
    requestRender();
  }

  function setEntryProgress(entry, progress){
    progress = Math.max(0, Math.min(1, progress));
    if (!entry.mixer || entry.progress === progress) return;
    entry.progress = progress;
    entry.mixer.setTime(progress * entry.duration);
    requestRender();
  }

  // ---------- pointer interaction ----------
  function callHook(entry, name, event, intersection){
    var hook = entry && entry.behavior[name];
    if (!hook) return;
    var pointer = { event: event, intersection: intersection || null, x: NaN, y: NaN };
    if (event){
      var rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    }
    hook(entry, pointer, stage);
  }

  function notifyStagePointer(name, event){
    stage.entries.forEach(function(entry){
      if (entry.behavior[name] && isShown(entry.root)) callHook(entry, name, event, null);
    });
  }

  function projectToCanvas(point, out){
    projected.copy(point).project(stage.camera);
    out = out || {};
    out.x = (projected.x + 1) / 2 * canvasWidth;
    out.y = (1 - projected.y) / 2 * canvasHeight;
    return out;
  }

  function hitTest(event){
    var roots = [];
    stage.entries.forEach(function(entry){
      if (entry.interactive && entry.root.visible) roots.push(entry.root);
    });
    if (!roots.length) return null;
    var rect = canvas.getBoundingClientRect();
    pointerCoords.set(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerCoords, stage.camera);
    var hits = raycaster.intersectObjects(roots, true);
    return hits.length ? { entry: findEntry(hits[0].object), intersection: hits[0] } : null;
  }

  function setHovered(entry, event, hit){
    if (entry === hoveredEntry) return;
    callHook(hoveredEntry, 'onPointerLeave', event, null);
    hoveredEntry = entry;
    callHook(entry, 'onPointerEnter', event, hit && hit.intersection);
    pointerTarget.style.cursor = entry && entry.behavior.cursor ? entry.behavior.cursor : '';
  }

  // Ends hover and capture when an entry is hidden mid-interaction.
  function releaseEntry(entry){
    if (capturedEntry === entry){
      callHook(entry, 'onPointerUp', null, null);
      capturedEntry = null;
    }
    if (hoveredEntry === entry) setHovered(null, null, null);
  }

  function onPointerMove(event){
    if (!stage.renderer) return;
    notifyStagePointer('onStagePointerMove', event);
    var hit = hitTest(event);
    if (capturedEntry){
      callHook(capturedEntry, 'onPointerMove', event, hit && hit.entry === capturedEntry ? hit.intersection : null);
      return;
    }
    setHovered(hit ? hit.entry : null, event, hit);
    if (hit) callHook(hit.entry, 'onPointerMove', event, hit.intersection);
  }

  function onPointerDown(event){
    if (!stage.renderer) return;
    var hit = hitTest(event);
    if (!hit || !hit.entry.behavior.onPointerDown) return;
    capturedEntry = hit.entry;
    pointerTarget.setPointerCapture(event.pointerId);
    callHook(capturedEntry, 'onPointerDown', event, hit.intersection);
  }

  function onPointerUp(event){
    if (!capturedEntry) return;
    var entry = capturedEntry;
    capturedEntry = null;
    if (pointerTarget.hasPointerCapture(event.pointerId)) pointerTarget.releasePointerCapture(event.pointerId);
    callHook(entry, 'onPointerUp', event, null);
  }

  function onPointerLeave(event){
    notifyStagePointer('onStagePointerLeave', event);
    if (!capturedEntry) setHovered(null, event, null);
  }

  // ---------- setup ----------
  stage.ready = loadThree().then(function(three){
    var THREE = three.THREE;
    stage.THREE = THREE;
    stage.loader = three.loader;
    stage.scene = new THREE.Scene();
    stage.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    stage.camera.position.set(0, 5, 0);
    stage.camera.up.set(0, 0, -1);
    stage.camera.lookAt(0, 0, 0);
    stage.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    stage.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // If the GPU resets (a driver timeout, or another app like Blender saturating it), the
    // browser drops the WebGL context and later hands it back empty. Three.js rebuilds its
    // state on restore, but frames here are drawn on demand, so ask for one straight away.
    canvas.addEventListener('webglcontextrestored', requestRender);
    addLights(stage.scene, THREE);
    raycaster = new THREE.Raycaster();
    pointerCoords = new THREE.Vector2();
    projected = new THREE.Vector3();

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(function(records){
      onScreen = records[records.length - 1].isIntersecting;
      updateActivity();
    }).observe(canvas);
    document.addEventListener('visibilitychange', function(){
      pageVisible = document.visibilityState === 'visible';
      updateActivity();
    });
    new MutationObserver(refreshThemedMaterials)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    pointerTarget.addEventListener('pointermove', onPointerMove);
    pointerTarget.addEventListener('pointerdown', onPointerDown);
    pointerTarget.addEventListener('pointerup', onPointerUp);
    pointerTarget.addEventListener('pointercancel', onPointerUp);
    pointerTarget.addEventListener('pointerleave', onPointerLeave);

    resize();
    return stage;
  });

  return stage;
}

export function registerBehavior(name, behavior){
  behaviors[name] = behavior;
}
