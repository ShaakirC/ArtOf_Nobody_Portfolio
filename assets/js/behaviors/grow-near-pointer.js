// Scattered static pieces that start hidden (scale 0), grow to full size near the mouse,
// and shrink back gradually once it moves away. Identical pieces are instanced, so
// hundreds of them cost one draw call.
import { registerBehavior } from '../model-stage.js';
import { createProximity } from './shared/proximity.js';
import { instanceMeshes, writeInstance } from './shared/instancing.js';
import { stepPull } from './shared/pull.js';

// Distance in canvas px within which pieces react; they reach full size at the pointer.
var RADIUS = 110;
// growRate: how quickly size catches up, per second (higher is snappier).
// fadeTime: seconds for the pull to fall to about a third after the pointer leaves.
var PULL = { growRate: 12, fadeTime: 0.55 };

registerBehavior('grow-near-pointer', {
  setup: function(entry, stage){
    var state = entry.state;
    state.proximity = createProximity(RADIUS);
    state.pieces = instanceMeshes(entry.root, stage.THREE);
    state.pieces.forEach(function(piece){
      piece.value = 0;
      piece.pull = 0;
      writeInstance(piece, 0, stage.THREE);
      piece.mesh.instanceMatrix.needsUpdate = true;
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
    var touched = new Set();
    // Pieces move with their parent (tilt, fit), so their screen positions are rechecked every frame.
    entry.root.updateWorldMatrix(true, true);

    state.pieces.forEach(function(piece){
      var target = state.proximity.influence(piece.position, entry.root, stage);
      var step = stepPull(piece, target, dt, PULL);
      if (step.busy) changing = true;
      if (!step.changed) return;
      writeInstance(piece, piece.value, stage.THREE);
      touched.add(piece.mesh);
    });

    touched.forEach(function(mesh){ mesh.instanceMatrix.needsUpdate = true; });
    // Settled, whether fully hidden or held steady under a still pointer.
    if (!changing) stage.stopLoop(entry);
  }
});
