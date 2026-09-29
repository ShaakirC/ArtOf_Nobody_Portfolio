// A slow, continuous back-and-forth turn about the screen's vertical axis. The model swings
// between its resting pose and that pose mirrored left to right, easing at both ends (a
// cosine), and starts at rest. Children, such as attached pieces, turn with it.
//
// Pass data: { rest: { x, z } (degrees; the resting rotation), period: seconds per full
// back-and-forth }. The camera looks down -Y with screen-up along -Z, so the screen's vertical
// axis is world Z: mirroring the pose left to right flips the sign of its z rotation.
// Reduced motion keeps the model at rest.
//
// Optional data.follower: { object, degrees } turns an object attached to the model (such as
// its light rig) further about the same axis, by nothing at the resting pose up to `degrees`
// at the mirrored one, in step with the sway. Positive degrees turn it toward the model's left.
// It's read every frame, so it can be set after the model has loaded.
//
// Optional data.bob: { height, period } adds a gentle up-and-down drift on screen: `height` is
// how far it moves either side of where it sits, in world units, and `period` the seconds per
// cycle. It's applied as an offset, so it works on top of wherever the model is positioned.
import { registerBehavior } from '../model-stage.js';

var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function degrees(value){
  return (value || 0) * Math.PI / 180;
}

function applyPose(entry){
  var state = entry.state;
  var turn = reducedMotion.matches ? 1 : Math.cos(2 * Math.PI * state.time / state.period);
  entry.root.rotation.x = degrees(state.rest.x);
  entry.root.rotation.z = degrees(state.rest.z) * turn;
  var follower = entry.data.follower;
  if (follower) follower.object.rotation.z = degrees(follower.degrees) * (1 - turn) / 2;

  // Screen-up is world -Z. Swap the last offset for the new one, keeping the base position.
  var bob = entry.data.bob;
  var offset = bob && !reducedMotion.matches
    ? -bob.height * Math.sin(2 * Math.PI * state.time / bob.period)
    : 0;
  entry.root.position.z += offset - state.bobOffset;
  state.bobOffset = offset;
}

registerBehavior('sway', {
  setup: function(entry, stage){
    var data = entry.data;
    entry.state.rest = data.rest || { x: 0, z: 0 };
    entry.state.period = data.period || 8;
    entry.state.time = 0;
    entry.state.bobOffset = 0;
    applyPose(entry);
    if (!reducedMotion.matches) stage.startLoop(entry);
  },

  update: function(entry, dt){
    entry.state.time += dt;
    applyPose(entry);
  }
});
