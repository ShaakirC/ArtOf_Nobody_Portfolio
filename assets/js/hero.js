// Hero backdrop: the logo model behind the hero text, tilting with the mouse, with
// scattered pieces on its surface that grow near the pointer.
// The logo is centered, then nudged down (and only if needed, shrunk) until it
// clears the text, so the heading never sits on top of it at any screen size.
import * as ModelStage from './model-stage.js';

var LOGO_SRC = 'assets/models/3D_Icon_Logo.glb';
// Pieces authored in the logo's coordinates; attached to the logo so they follow it.
var PIECES_SRC = 'assets/models/3D_Icon_Logo_Inst.glb';
// How the pieces react to the cursor: 'grow-near-pointer' scales static pieces up,
// 'animate-near-pointer' plays each piece's own animation forward and back,
// 'morph-near-pointer' plays each piece's shape keys down from last to first.
var PIECES_BEHAVIOR = 'morph-near-pointer';
// Resting pose in degrees, so the front face turns toward the top left of the screen
// (~28 degrees off the camera). Negative x tilts it up; positive z tilts it left.
var LOGO_REST_ROTATION = { x: -20, z: 20 };
// Share of the hero height the logo fills.
var LOGO_HEIGHT_SHARE = 0.6;
// Largest share of the hero width the logo may take; narrow screens shrink it to fit.
var LOGO_MAX_WIDTH_SHARE = 0.85;
// Minimum gap in px between the logo and any hero text.
var TEXT_CLEARANCE = 14;
// Minimum gap in px between the logo and the bottom of the hero.
var BOTTOM_CLEARANCE = 24;
// The logo never shrinks below this share of its full size.
var MIN_SCALE = 0.6;
// Search steps: px moved down per try, and scale removed per try.
var OFFSET_STEP = 4;
var SCALE_STEP = 0.02;
// Silhouette resolution across the logo's width.
var FOOTPRINT_WIDTH = 256;
// Distance in px between sampled points inside each text box.
var SAMPLE_STEP = 4;

// The canvas fills the hero, so its pixel density is capped below the default of 2 to keep
// tilting smooth on weaker GPUs; antialiasing hides the difference.
var MAX_PIXEL_RATIO = 1.5;

var AVOID_SELECTOR = '.hero-eyebrow, .hero h1, .hero-scroll-cue';

// Lights copied from the Blender sun lamps, in the logo's coordinates: the camera looks
// down from +Y, so -Y is behind the logo, -Z is its top and +Z its bottom. Each light aims
// at the logo's pivot and is attached to the logo, so it turns with it, both into its
// resting pose and as it tilts. Strength is Blender's sun strength: 1 lights a white
// surface to full white.
var LIGHTS = [
  { name: 'Front', position: [0, 2.991, 0], strength: 0.5 },
  { name: 'Rim_Top', position: [1.103, -0.844, -1.904], strength: 1 },
  { name: 'Rim_Bot', position: [-1.806, -1.049, 1.092], strength: 1 }
];
// three.js needs an intensity of PI to light a white surface to full white.
var STRENGTH_TO_INTENSITY = Math.PI;

// Lighting, per theme: the ambient intensity, plus a multiplier on each light's strength,
// by name. The rim comes from how the side walls are lit compared with the front face:
//   dark:  the rim lights make the walls brighter than the front (a light rim).
//   light: the rims are off and a low ambient leaves the walls in shadow, while the front
//          light lifts only the front face back up, so the walls read darker (a dark rim).
var LIGHTING = {
  dark: { ambient: 0.5, lights: { Front: .2, Rim_Top: 3, Rim_Bot: .5 } },
  light: { ambient: 0.4, lights: { Front: 1, Rim_Top: 0, Rim_Bot: 0 } }
};

var heroLights = null;

function addHeroLights(scene, THREE){
  heroLights = {
    ambient: new THREE.AmbientLight(0xffffff, 0),
    logo: LIGHTS.map(function(settings){
      var light = new THREE.DirectionalLight(0xffffff, 0);
      light.position.fromArray(settings.position);
      return light;
    })
  };
  scene.add(heroLights.ambient);
  applyThemeLighting();
}

// Parents the logo lights and their targets to the logo, with the targets on its pivot.
function attachLogoLights(root){
  heroLights.logo.forEach(function(light){ root.add(light, light.target); });
}

function applyThemeLighting(){
  if (!heroLights) return;
  var settings = LIGHTING[document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'];
  heroLights.ambient.intensity = settings.ambient;
  heroLights.logo.forEach(function(light, index){
    var multiplier = settings.lights[LIGHTS[index].name];
    light.intensity = LIGHTS[index].strength * STRENGTH_TO_INTENSITY * (multiplier === undefined ? 1 : multiplier);
  });
}

export function initHero(){
  var hero = document.querySelector('.hero');
  var canvas = document.getElementById('heroModel');
  // The canvas sits behind the text, so pointer events are read from the whole hero.
  var stage = ModelStage.create(canvas, { pointerTarget: hero, lights: addHeroLights, maxPixelRatio: MAX_PIXEL_RATIO });
  new MutationObserver(function(){
    applyThemeLighting();
    stage.requestRender();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  stage.ready.catch(function(error){
    console.error('Unable to start the hero model stage:', error);
  });
  var logoLoaded = stage.load(LOGO_SRC, { behavior: 'tilt', data: { restRotation: LOGO_REST_ROTATION } });
  var piecesLoaded = stage.load(PIECES_SRC, { behavior: PIECES_BEHAVIOR, colorVar: '--hero-pieces-color' });

  logoLoaded.then(function(entry){
    var THREE = stage.THREE;
    if (heroLights) attachLogoLights(entry.root);
    var box = new THREE.Box3().setFromObject(entry.root);
    var size = box.getSize(new THREE.Vector3());
    // The camera looks down the Y axis, so on screen the width is X and the height is Z.
    var viewSize = function(aspect){
      return Math.max(size.z / LOGO_HEIGHT_SHARE, size.x / (LOGO_MAX_WIDTH_SHARE * aspect));
    };
    stage.setViewSize(viewSize);
    var footprint = captureFootprint(stage, entry, box, size);
    var fitFrame = 0;

    function fit(){
      fitFrame = 0;
      fitLogo(stage, entry, canvas, footprint, box, size, viewSize);
    }
    function requestFit(){
      if (!fitFrame) fitFrame = window.requestAnimationFrame(fit);
    }

    fit();
    stage.setEntryVisible(entry, true);
    new ResizeObserver(requestFit).observe(hero);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestFit);
  }, function(error){
    console.error('Unable to load model ' + LOGO_SRC + ':', error);
  });

  Promise.all([logoLoaded, piecesLoaded]).then(function(entries){
    entries[0].root.add(entries[1].root);
    stage.setEntryVisible(entries[1], true);
  }, function(error){
    console.error('Unable to load model ' + PIECES_SRC + ':', error);
  });
}

// Renders the resting logo straight down into a small offscreen image and keeps
// which pixels it covers, so overlap checks are simple lookups.
function captureFootprint(stage, entry, box, size){
  var THREE = stage.THREE;
  var width = FOOTPRINT_WIDTH;
  var height = Math.max(1, Math.round(width * size.z / size.x));
  var target = new THREE.WebGLRenderTarget(width, height);
  // Camera-local up is world -Z, so the frustum's top is the box's smallest Z.
  var camera = new THREE.OrthographicCamera(box.min.x, box.max.x, -box.min.z, -box.max.z, 0.01, 100);
  camera.position.set(0, 50, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  var wasVisible = entry.root.visible;
  entry.root.visible = true;
  stage.renderer.setRenderTarget(target);
  stage.renderer.clear();
  stage.renderer.render(stage.scene, camera);
  var pixels = new Uint8Array(width * height * 4);
  stage.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  stage.renderer.setRenderTarget(null);
  target.dispose();
  entry.root.visible = wasVisible;

  // WebGL rows start at the bottom; store rows top-down to match the screen.
  var covered = new Uint8Array(width * height);
  for (var row = 0; row < height; row++){
    for (var column = 0; column < width; column++){
      covered[row * width + column] = pixels[((height - 1 - row) * width + column) * 4 + 3] > 0 ? 1 : 0;
    }
  }
  return { width: width, height: height, covered: covered };
}

function getAvoidRects(canvasRect){
  return Array.prototype.map.call(document.querySelectorAll(AVOID_SELECTOR), function(element){
    // Measure the text itself rather than its full-width block.
    var range = document.createRange();
    range.selectNodeContents(element);
    var rect = range.getBoundingClientRect();
    return {
      left: rect.left - canvasRect.left - TEXT_CLEARANCE,
      top: rect.top - canvasRect.top - TEXT_CLEARANCE,
      right: rect.right - canvasRect.left + TEXT_CLEARANCE,
      bottom: rect.bottom - canvasRect.top + TEXT_CLEARANCE
    };
  });
}

function fitLogo(stage, entry, canvas, footprint, box, size, viewSize){
  var canvasRect = canvas.getBoundingClientRect();
  var width = canvasRect.width;
  var height = canvasRect.height;
  if (!width || !height) return;
  var unitsPerPx = viewSize(width / height) / height;
  var rects = getAvoidRects(canvasRect);
  var boxCenterZ = (box.min.z + box.max.z) / 2;

  // Counts sampled text points that land on the logo at a given scale and downward offset.
  function overlap(scale, offsetPx){
    var hits = 0;
    rects.forEach(function(rect){
      for (var y = rect.top; y <= rect.bottom; y += SAMPLE_STEP){
        for (var x = rect.left; x <= rect.right; x += SAMPLE_STEP){
          var modelX = (x - width / 2) * unitsPerPx / scale;
          var modelZ = ((y - height / 2 - offsetPx) * unitsPerPx - boxCenterZ * (1 - scale)) / scale;
          var column = Math.floor((modelX - box.min.x) / size.x * footprint.width);
          var row = Math.floor((modelZ - box.min.z) / size.z * footprint.height);
          if (column < 0 || row < 0 || column >= footprint.width || row >= footprint.height) continue;
          hits += footprint.covered[row * footprint.width + column];
        }
      }
    });
    return hits;
  }

  var best = { scale: 1, offset: 0, hits: Infinity };
  search:
  for (var scale = 1; scale >= MIN_SCALE - 1e-6; scale -= SCALE_STEP){
    var halfHeightPx = size.z * scale / unitsPerPx / 2;
    var maxOffset = Math.max(0, height - BOTTOM_CLEARANCE - (height / 2 + halfHeightPx));
    for (var offset = 0; offset <= maxOffset; offset += OFFSET_STEP){
      var hits = overlap(scale, offset);
      if (hits < best.hits) best = { scale: scale, offset: offset, hits: hits };
      if (!hits) break search;
    }
  }

  entry.root.scale.setScalar(best.scale);
  // Keep the box center on the rotation pivot so the logo stays centered as it scales.
  entry.root.position.set(0, 0, best.offset * unitsPerPx + boxCenterZ * (1 - best.scale));
  stage.requestRender();
}
