// Pieces with their own animations: when the mouse comes near a piece its animation
// plays forward at normal speed, and once the mouse leaves it plays back in reverse
// from wherever it got to.
//
// Expects one animation clip per piece, which is what Blender exports when each object
// has its own action. A piece is the object its clip animates (the first one, if the
// clip drives several). Proximity is measured from the piece's resting position, so a
// piece that animates away from the cursor doesn't flicker back and forth.
import { registerBehavior } from '../model-stage.js';
import { createProximity } from './shared/proximity.js';

// Distance in canvas px within which a piece triggers.
var RADIUS = 90;
// Seconds a piece keeps playing forward after the cursor leaves, so a quick pass still shows.
var LINGER = 0.3;
// Playback speed multipliers for the forward and reverse directions.
var FORWARD_SPEED = 1;
var REVERSE_SPEED = 1;

registerBehavior('animate-near-pointer', {
  setup: function(entry, stage){
    var THREE = stage.THREE;
    var state = entry.state;
    state.proximity = createProximity(RADIUS);
    state.pieces = [];
    if (!entry.mixer) return;

    entry.root.updateMatrixWorld(true);
    entry.animations.forEach(function(clip){
      var track = clip.tracks[0];
      if (!track) return;
      var nodeName = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
      var anchor = entry.root.getObjectByName(nodeName);
      if (!anchor) return;
      var action = entry.mixer.clipAction(clip);
      action.time = 0;
      state.pieces.push({
        action: action,
        duration: clip.duration,
        rest: entry.root.worldToLocal(anchor.getWorldPosition(new THREE.Vector3())),
        lingering: 0
      });
    });
    entry.mixer.update(0);
  },

  onStagePointerMove: function(entry, pointer, stage){
    if (entry.state.proximity.move(pointer)) stage.startLoop(entry);
  },

  onStagePointerLeave: function(entry, pointer, stage){
    entry.state.proximity.leave();
    // Keep animating so pieces return to rest after the cursor leaves the hero.
    stage.startLoop(entry);
  },

  update: function(entry, dt, stage){
    var state = entry.state;
    if (!state.pieces.length) return stage.stopLoop(entry);
    var changing = false;
    var moved = false;
    entry.root.updateWorldMatrix(true, true);

    state.pieces.forEach(function(piece){
      if (state.proximity.influence(piece.rest, entry.root, stage) > 0) piece.lingering = LINGER;
      else piece.lingering = Math.max(0, piece.lingering - dt);

      var forward = piece.lingering > 0;
      var time = piece.action.time;
      var next = forward
        ? Math.min(piece.duration, time + dt * FORWARD_SPEED)
        : Math.max(0, time - dt * REVERSE_SPEED);
      if (next !== time){
        piece.action.time = next;
        moved = true;
      }
      // Still busy while playing, or while a linger countdown could flip the direction.
      if (forward ? next < piece.duration || piece.lingering < LINGER : next > 0) changing = true;
    });

    // Applies every action's current time without advancing it.
    if (moved) entry.mixer.update(0);
    if (!changing) stage.stopLoop(entry);
  }
});
