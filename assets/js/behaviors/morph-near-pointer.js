// Pieces driven by their shape keys (morph targets). At rest every key sits at 1.
// When the mouse comes near a piece, its 0-1 value runs up to 1 and the piece grows:
// the keys go down to 0 one after another, starting with the last key and finishing
// with the first. Receding runs them back up in reverse. Every piece takes the same
// time however many keys it has; a piece with 4 keys spends a quarter of it on each.
//
// Once triggered, a piece always grows all the way, even if the cursor has already
// gone. It stays grown while the cursor is near, and recedes once the cursor has been
// away for HOLD_TIME. A cursor near a piece at rest or receding grows it again from
// wherever it is.
//
// Proximity is measured to the nearest edge of the piece's fully grown shape (all keys
// at 0), so the cursor triggers a piece anywhere along the path it will grow into,
// not just at its starting point. That outline never changes, so there's no flicker.
import { registerBehavior } from '../model-stage.js';
import { createProximity } from './shared/proximity.js';
import { applyWeights } from './shared/shape-keys.js';

// Distance in canvas px from a piece's grown outline within which it triggers.
var RADIUS = 110;
// Seconds to grow through all keys; the same for every piece.
var GROW_TIME = 0.8;
// Receding runs at this fraction of the growth speed (0.65 = 35% slower, about 1.23s).
var RECEDE_SPEED = 0.65;
var RECEDE_TIME = GROW_TIME / RECEDE_SPEED;
// Seconds a fully grown piece waits after the cursor has left before receding.
var HOLD_TIME = 1;

// The piece's fully grown shape (every key at 0, i.e. the base mesh), as a flat
// [x, y, z, ...] array in mesh space.
function grownPoints(geometry){
  var base = geometry.attributes.position;
  var points = new Float32Array(base.count * 3);
  for (var i = 0; i < base.count; i++){
    points[i * 3] = base.getX(i);
    points[i * 3 + 1] = base.getY(i);
    points[i * 3 + 2] = base.getZ(i);
  }
  return points;
}

// Unique triangle edges as a flat [a, b, ...] array of vertex indices.
function triangleEdges(geometry){
  var index = geometry.index;
  var count = index ? index.count : geometry.attributes.position.count;
  var seen = new Set();
  var edges = [];
  for (var i = 0; i + 2 < count; i += 3){
    var corners = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    for (var side = 0; side < 3; side++){
      var a = corners[side];
      var b = corners[(side + 1) % 3];
      var key = a < b ? a + '/' + b : b + '/' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(a, b);
    }
  }
  return edges;
}

// Drives the pieces from a virtual pointer (canvas px) as well as the mouse, e.g. the phone's
// motion sensors (hero-motion.js). strength (0-1) scales its proximity; 0 turns it off, and
// grown pieces then hold and recede as they do when the mouse leaves. A piece only grows when
// its scaled proximity is above threshold (0-1).
export function setVirtualPointer(entry, x, y, strength, threshold, stage){
  if (!entry.state.proximity) return;
  entry.state.proximity.setVirtual(x, y, strength, threshold);
  stage.startLoop(entry);
}

registerBehavior('morph-near-pointer', {
  setup: function(entry){
    var state = entry.state;
    state.proximity = createProximity(RADIUS);
    state.pieces = [];
    // Any exported shape key animation is replaced by the pointer-driven weights.
    if (entry.mixer) entry.mixer.stopAllAction();

    entry.root.traverse(function(object){
      if (!object.isMesh || !object.morphTargetInfluences || !object.morphTargetInfluences.length) return;
      var piece = {
        mesh: object,
        count: object.morphTargetInfluences.length,
        points: grownPoints(object.geometry),
        edges: triangleEdges(object.geometry),
        value: 0,
        phase: 'rest', // rest -> growing -> holding -> receding -> rest
        holdLeft: 0
      };
      applyWeights(piece);
      state.pieces.push(piece);
    });
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
    var changing = false;
    // Pieces move with their parent (tilt, fit), so their screen positions are rechecked every frame.
    entry.root.updateWorldMatrix(true, true);

    state.pieces.forEach(function(piece){
      var near = state.proximity.influenceOfShape(piece.points, piece.edges, piece.mesh, stage) > 0;
      if (near && (piece.phase === 'rest' || piece.phase === 'receding')) piece.phase = 'growing';

      var previous = piece.value;
      if (piece.phase === 'growing'){
        piece.value = Math.min(1, piece.value + dt / GROW_TIME);
        if (piece.value === 1){
          piece.phase = 'holding';
          piece.holdLeft = HOLD_TIME;
        }
      } else if (piece.phase === 'holding'){
        // The wait only counts down while the cursor is away.
        piece.holdLeft = near ? HOLD_TIME : piece.holdLeft - dt;
        if (piece.holdLeft <= 0) piece.phase = 'receding';
      } else if (piece.phase === 'receding'){
        piece.value = Math.max(0, piece.value - dt / RECEDE_TIME);
        if (piece.value === 0) piece.phase = 'rest';
      }

      if (piece.value !== previous) applyWeights(piece);
      // A piece held under a still cursor needs no frames; the next pointer move restarts the loop.
      if (piece.phase === 'growing' || piece.phase === 'receding' || (piece.phase === 'holding' && !near)){
        changing = true;
      }
    });

    if (!changing) stage.stopLoop(entry);
  }
});
