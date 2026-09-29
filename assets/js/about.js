// About section: a model beside the text, in the column the service icons use. For now it's
// the hero logo with its pieces, lit by the same rig and coloured the same way in both themes;
// it may be swapped for its own asset. They're the same files the hero loads, so they come
// from the browser cache.
//
// It loops on its own: the logo sways between the hero's resting angle (pointing up and left)
// and its mirror (up and right), and the pieces grow, hold and recede in a random order (the
// 'sway' and 'grow-cycle' behaviors). Like every stage, it only animates while on screen.
import * as ModelStage from './model-stage.js';
import { createLogoLights } from './logo-lights.js';

var LOGO_SRC = 'assets/models/3D_Icon_Logo.glb';
var PIECES_SRC = 'assets/models/3D_Icon_Logo_Inst.glb';
// Resting angle in degrees, matching LOGO_REST_ROTATION in hero.js: one end of the sway.
var REST_ROTATION = { x: -20, z: 20 };
// Seconds for one full swing there and back.
var SWAY_PERIOD = 8;
// The lights turn with the logo, and further toward its left as it swings to its mirrored
// angle (up and right) to light that side: degrees of extra turn at the far end, none at rest.
var LIGHT_LEAD = -20;
// Gentle up-and-down drift: how far either side of centre, as a share of the model's height,
// and seconds per cycle (deliberately not the sway's, so the two don't loop in lockstep).
var BOB_AMOUNT = 0.0;
var BOB_PERIOD = 5;
// Empty space around the model, as a share of its size.
var FRAME_MARGIN = 0.1;

// options.modelsAfter: a promise to wait for before loading (the hero logo).
export function initAbout(options){
  options = options || {};
  var canvas = document.getElementById('aboutModel');
  if (!canvas) return;
  var lights = createLogoLights();
  var stage = ModelStage.create(canvas, { lights: lights.addTo });
  lights.watchTheme(stage);
  stage.ready.catch(function(error){
    console.error('Unable to start the about model stage:', error);
  });

  var ready = Promise.resolve(options.modelsAfter);
  var logoLoaded = ready.then(function(){
    return stage.load(LOGO_SRC, { behavior: 'sway', data: { rest: REST_ROTATION, period: SWAY_PERIOD } });
  });
  var piecesLoaded = ready.then(function(){
    return stage.load(PIECES_SRC, { behavior: 'grow-cycle', colorVar: '--hero-pieces-color' });
  });

  logoLoaded.then(function(entry){
    var THREE = stage.THREE;
    // At the resting end of the swing it's lit exactly like the hero.
    entry.data.follower = { object: lights.attach(entry.root), degrees: LIGHT_LEAD };
    // Frame the whole swing, so neither end clips. The camera looks down the Y axis, so on
    // screen the width is X and the height is Z. The swing is symmetric left to right, so the
    // pivot stays centered horizontally; vertically, the extent is centered.
    var rotation = entry.root.rotation.clone();
    var swing = new THREE.Box3();
    var pose = new THREE.Box3();
    for (var step = 0; step <= 8; step++){
      var z = THREE.MathUtils.degToRad(REST_ROTATION.z) * Math.cos(Math.PI * step / 8);
      entry.root.rotation.set(THREE.MathUtils.degToRad(REST_ROTATION.x), 0, z);
      entry.root.updateMatrixWorld(true);
      swing.union(pose.setFromObject(entry.root));
    }
    entry.root.rotation.copy(rotation);
    var halfWidth = Math.max(-swing.min.x, swing.max.x);
    var height = swing.max.z - swing.min.z;
    var bobHeight = height * BOB_AMOUNT;
    entry.root.position.set(0, 0, -(swing.min.z + swing.max.z) / 2);
    entry.data.bob = { height: bobHeight, period: BOB_PERIOD };
    // Leave room for the bob above and below.
    stage.setViewSize(function(aspect){
      return Math.max(height + 2 * bobHeight, 2 * halfWidth / aspect) * (1 + FRAME_MARGIN);
    });
    stage.setEntryVisible(entry, true);
  }).catch(function(error){
    console.error('Unable to load model ' + LOGO_SRC + ':', error);
  });

  Promise.all([logoLoaded, piecesLoaded]).then(function(entries){
    // Attached to the logo, so the pieces sway with it.
    entries[0].root.add(entries[1].root);
    stage.setEntryVisible(entries[1], true);
  }).catch(function(error){
    console.error('Unable to load model ' + PIECES_SRC + ':', error);
  });
}
