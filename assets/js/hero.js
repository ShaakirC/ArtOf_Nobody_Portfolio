// Hero backdrop: the logo model behind the hero text, tilting with the mouse, with
// scattered pieces on its surface that grow near the pointer.
// The logo is centered, then nudged down (and only if needed, shrunk) until it
// clears the text, so the heading never sits on top of it at any screen size.
// Touch-first phones have no pointer to follow, so there it loops on its own like the about
// logo instead: it sways to its mirrored angle and back, its lights lead the turn, and the
// pieces grow in a random order (the 'sway' and 'grow-cycle' behaviors).
import * as ModelStage from './model-stage.js';
import { createLogoLights } from './logo-lights.js';

var LOGO_SRC = 'assets/models/3D_Icon_Logo.glb';
// Low-poly stand-in for pointer hits, in the logo's coordinates: every mouse move over the
// hero raycasts about 200 triangles instead of the logo's 12k. It's hidden; three.js
// raycasts hidden meshes.
var HIT_SRC = 'assets/models/3D_Icon_Logo_LP.glb';
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
// Scale removed per try when the logo has to shrink.
var SCALE_STEP = 0.02;
// Silhouette resolution across the logo's width.
var FOOTPRINT_WIDTH = 256;
// Distance in px between sampled points inside each text box.
var SAMPLE_STEP = 4;

// The canvas fills the hero, so its pixel density is capped below the default of 2 to keep
// tilting smooth on weaker GPUs; antialiasing hides the difference.
var MAX_PIXEL_RATIO = 1.5;

// Phones: seconds for one full swing there and back, and degrees the lights turn further at
// the mirrored end. Both match about.js.
var SWAY_PERIOD = 8;
var LIGHT_LEAD = -20;
// Poses sampled across the swing to find the space it sweeps.
var SWING_SAMPLES = 8;

var AVOID_SELECTOR = '.hero-eyebrow, .hero h1, .hero-scroll-cue';

// Returns a promise that settles once the logo has loaded or failed.
export function initHero(){
  var hero = document.querySelector('.hero');
  var canvas = document.getElementById('heroModel');
  var looping = window.matchMedia('(pointer: coarse)').matches;
  // The canvas sits behind the text, so pointer events are read from the whole hero.
  var lights = createLogoLights();
  var stage = ModelStage.create(canvas, {
    pointerTarget: looping ? null : hero,
    lights: lights.addTo,
    maxPixelRatio: MAX_PIXEL_RATIO
  });
  lights.watchTheme(stage);

  stage.ready.catch(function(error){
    console.error('Unable to start the hero model stage:', error);
  });
  var logoLoaded = looping
    ? stage.load(LOGO_SRC, { behavior: 'sway', data: { rest: LOGO_REST_ROTATION, period: SWAY_PERIOD } })
    : stage.load(LOGO_SRC, { behavior: 'tilt', data: { restRotation: LOGO_REST_ROTATION } });
  var piecesLoaded = stage.load(PIECES_SRC, {
    behavior: looping ? 'grow-cycle' : PIECES_BEHAVIOR,
    colorVar: '--hero-pieces-color'
  });

  logoLoaded.then(function(entry){
    var THREE = stage.THREE;
    var rig = lights.attach(entry.root);
    // The turns the logo takes about the screen's vertical axis: just its rest, or on phones
    // samples across the whole swing, so the fit keeps every pose clear of the text.
    var restZ = entry.root.rotation.z;
    var turns = [restZ];
    if (looping){
      entry.data.follower = { object: rig, degrees: LIGHT_LEAD };
      for (var step = 1; step <= SWING_SAMPLES; step++){
        turns.push(restZ * Math.cos(Math.PI * step / SWING_SAMPLES));
      }
    }
    var box = new THREE.Box3();
    var pose = new THREE.Box3();
    turns.forEach(function(turn){
      entry.root.rotation.z = turn;
      entry.root.updateMatrixWorld(true);
      box.union(pose.setFromObject(entry.root));
    });
    entry.root.rotation.z = restZ;
    entry.root.updateMatrixWorld(true);
    var size = box.getSize(new THREE.Vector3());
    // The camera looks down the Y axis, so on screen the width is X and the height is Z.
    var viewSize = function(aspect){
      return Math.max(size.z / LOGO_HEIGHT_SHARE, size.x / (LOGO_MAX_WIDTH_SHARE * aspect));
    };
    stage.setViewSize(viewSize);
    var footprint = captureFootprint(stage, entry, box, size, turns);
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

  // Phones never raycast the logo, so they skip the hit mesh.
  if (!looping){
    var hitLoaded = stage.ready.then(function(){ return stage.loader.loadAsync(HIT_SRC); });
    Promise.all([logoLoaded, hitLoaded]).then(function(results){
      useHitProxy(results[0].root, results[1].scene);
    }, function(error){
      // The logo keeps answering raycasts itself.
      console.error('Unable to load hit mesh ' + HIT_SRC + ':', error);
    });
  }

  Promise.all([logoLoaded, piecesLoaded]).then(function(entries){
    entries[0].root.add(entries[1].root);
    stage.setEntryVisible(entries[1], true);
  }, function(error){
    console.error('Unable to load model ' + PIECES_SRC + ':', error);
  });

  return logoLoaded.catch(function(){});
}

// Hands the logo's pointer hits to the hidden proxy. Attached models (the pieces) keep their own.
function useHitProxy(root, proxy){
  (function stopRaycasts(object){
    if (object.isMesh) object.raycast = function(){};
    object.children.forEach(function(child){
      if (!child.userData.modelEntry) stopRaycasts(child);
    });
  })(root);
  proxy.visible = false;
  root.add(proxy);
}

// Renders the logo straight down into a small offscreen image at each of `turns` (z
// rotations in radians) and keeps which pixels any of them covers, so overlap checks are
// simple lookups.
function captureFootprint(stage, entry, box, size, turns){
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
  var restZ = entry.root.rotation.z;
  entry.root.visible = true;
  var pixels = new Uint8Array(width * height * 4);
  var covered = new Uint8Array(width * height);
  stage.renderer.setRenderTarget(target);
  turns.forEach(function(turn){
    entry.root.rotation.z = turn;
    stage.renderer.clear();
    stage.renderer.render(stage.scene, camera);
    stage.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    // WebGL rows start at the bottom; store rows top-down to match the screen.
    for (var row = 0; row < height; row++){
      for (var column = 0; column < width; column++){
        if (pixels[((height - 1 - row) * width + column) * 4 + 3] > 0) covered[row * width + column] = 1;
      }
    }
  });
  stage.renderer.setRenderTarget(null);
  target.dispose();
  entry.root.rotation.z = restZ;
  entry.root.visible = wasVisible;
  return { width: width, height: height, covered: covered, runs: columnRuns(covered, width, height) };
}

// For each column, the covered rows as flat [firstRow, lastRow, ...] runs, top-down.
function columnRuns(covered, width, height){
  var runs = [];
  for (var column = 0; column < width; column++){
    var columnRuns = [];
    var start = -1;
    for (var row = 0; row <= height; row++){
      var isCovered = row < height && covered[row * width + column];
      if (isCovered && start < 0) start = row;
      if (!isCovered && start >= 0){
        columnRuns.push(start, row - 1);
        start = -1;
      }
    }
    runs.push(columnRuns);
  }
  return runs;
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

// Text sample points in canvas px, as a flat [x, y, ...] array.
function sampleRects(rects){
  var samples = [];
  rects.forEach(function(rect){
    for (var y = rect.top; y <= rect.bottom; y += SAMPLE_STEP){
      for (var x = rect.left; x <= rect.right; x += SAMPLE_STEP) samples.push(x, y);
    }
  });
  return samples;
}

function fitLogo(stage, entry, canvas, footprint, box, size, viewSize){
  var canvasRect = canvas.getBoundingClientRect();
  var width = canvasRect.width;
  var height = canvasRect.height;
  if (!width || !height) return;
  var unitsPerPx = viewSize(width / height) / height;
  var samples = sampleRects(getAvoidRects(canvasRect));
  var boxCenterZ = (box.min.z + box.max.z) / 2;
  var rowDepth = size.z / footprint.height;

  // Moving the logo down only slides each text point up through the logo's column under it,
  // so every point hits the logo over a few offset ranges, one per covered run of rows in
  // that column. Returns the smallest offset (0 to maxOffset) with the fewest points on the
  // logo, as { offset, hits }; hits is 0 when the text clears the logo.
  function leastOverlap(scale, maxOffset){
    var starts = [];
    var ends = [];
    var shift = boxCenterZ * (1 - scale);
    for (var i = 0; i < samples.length; i += 2){
      var modelX = (samples[i] - width / 2) * unitsPerPx / scale;
      var column = Math.floor((modelX - box.min.x) / size.x * footprint.width);
      if (column < 0 || column >= footprint.width) continue;
      var runs = footprint.runs[column];
      var depth = (samples[i + 1] - height / 2) * unitsPerPx - shift;
      for (var r = 0; r < runs.length; r += 2){
        // The point is on this run for offsets in (from, to].
        var from = (depth - (box.min.z + (runs[r + 1] + 1) * rowDepth) * scale) / unitsPerPx;
        var to = (depth - (box.min.z + runs[r] * rowDepth) * scale) / unitsPerPx;
        if (to < 0 || from > maxOffset) continue;
        starts.push(from);
        ends.push(to);
      }
    }
    starts = Float64Array.from(starts).sort();
    ends = Float64Array.from(ends).sort();

    // The count only drops just after a range ends, so those are the offsets worth testing.
    // TEXT_CLEARANCE already keeps a gap, so a hair past the end is enough.
    var best = { offset: 0, hits: Infinity };
    var started = 0;
    var ended = 0;
    for (var e = -1; e < ends.length; e++){
      var offset = e < 0 ? 0 : ends[e] + 1e-6;
      if (offset > maxOffset) break;
      while (started < starts.length && starts[started] < offset) started++;
      while (ended < ends.length && ends[ended] < offset) ended++;
      var hits = started - ended;
      if (hits < best.hits) best = { offset: offset, hits: hits };
      if (!hits) break;
    }
    return best;
  }

  var best = { scale: 1, offset: 0, hits: Infinity };
  for (var scale = 1; scale >= MIN_SCALE - 1e-6; scale -= SCALE_STEP){
    var halfHeightPx = size.z * scale / unitsPerPx / 2;
    var maxOffset = Math.max(0, height - BOTTOM_CLEARANCE - (height / 2 + halfHeightPx));
    var result = leastOverlap(scale, maxOffset);
    if (result.hits < best.hits) best = { scale: scale, offset: result.offset, hits: result.hits };
    if (!result.hits) break;
  }

  entry.root.scale.setScalar(best.scale);
  // Keep the box center on the rotation pivot so the logo stays centered as it scales.
  entry.root.position.set(0, 0, best.offset * unitsPerPx + boxCenterZ * (1 - best.scale));
  stage.requestRender();
}
