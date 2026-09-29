// Tilts a model in the direction the mouse moves across it, then springs back to rest.
// Faster movement tilts further, but the angle eases toward MAX_TILT and never reaches it.
// An optional resting pose, in degrees, can be passed as data: { restRotation: { x, z } }.
import { registerBehavior } from '../model-stage.js';

// Largest tilt in radians; the tilt approaches this asymptotically.
var MAX_TILT = 28 * Math.PI / 180;
// Angular velocity (rad/s) added per pixel of mouse movement over the model.
var IMPULSE = 0.016;
// Share of the impulse a very slow movement still gets; the rest scales with speed.
var SPEED_FLOOR = 0.3;
// Mouse speed in px/ms that receives the full impulse.
var FULL_SPEED = 2.5;
// Spring pulling the tilt back to rest; higher returns faster.
var STIFFNESS = 14;
// Fraction of critical damping; just under 1 settles without a visible wobble.
var DAMPING_RATIO = 0.85;
// Internal angle limit as a multiple of MAX_TILT, so big flicks don't linger at the cap.
var RAW_LIMIT = 1.6;
// Fixed physics step in seconds, for identical behavior at any frame rate.
var STEP = 1 / 240;
// Below these values (radians, rad/s) the model is treated as at rest.
var REST_ANGLE = 0.0005;
var REST_VELOCITY = 0.002;

var DAMPING = 2 * Math.sqrt(STIFFNESS) * DAMPING_RATIO;
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function softLimit(angle){
  return MAX_TILT * Math.tanh(angle / MAX_TILT);
}

function stepAxis(axis, dt){
  axis.velocity += (-STIFFNESS * axis.angle - DAMPING * axis.velocity) * dt;
  axis.angle += axis.velocity * dt;
  var limit = RAW_LIMIT * MAX_TILT;
  if (axis.angle > limit){ axis.angle = limit; axis.velocity = Math.min(0, axis.velocity); }
  if (axis.angle < -limit){ axis.angle = -limit; axis.velocity = Math.max(0, axis.velocity); }
}

function isResting(axis){
  return Math.abs(axis.angle) < REST_ANGLE && Math.abs(axis.velocity) < REST_VELOCITY;
}

function applyRotation(entry){
  var state = entry.state;
  // The camera looks down -Y with screen-up along -Z, so screen X maps to world X and
  // screen Y to world Z. Signs make the surface facing the viewer follow the mouse.
  // The offsets are an optional extra turn on top (see setTiltOffset); 0 unless set.
  entry.root.rotation.z = state.baseZ - softLimit(state.yaw.angle) - state.offsetYaw;
  entry.root.rotation.x = state.baseX + softLimit(state.pitch.angle) + state.offsetPitch;
}

// Adds angular velocity (rad/s) to the tilt, then lets the spring settle it back to rest.
// Positive yaw turns the front face toward the right, positive pitch toward the bottom, the
// same as moving the mouse right or down. Used for the mouse here, and for the phone's motion
// sensors by hero-motion.js.
export function addTiltImpulse(entry, yaw, pitch, stage){
  entry.state.yaw.velocity += yaw;
  entry.state.pitch.velocity += pitch;
  stage.startLoop(entry);
}

// Sets an extra turn in radians (same directions as addTiltImpulse) on top of the tilt, e.g.
// a gentle idle drift on phones when there's no sensor input.
export function setTiltOffset(entry, yaw, pitch, stage){
  entry.state.offsetYaw = yaw;
  entry.state.offsetPitch = pitch;
  applyRotation(entry);
  stage.requestRender();
}

registerBehavior('tilt', {
  setup: function(entry){
    var rest = entry.data.restRotation;
    if (rest){
      entry.root.rotation.x = (rest.x || 0) * Math.PI / 180;
      entry.root.rotation.z = (rest.z || 0) * Math.PI / 180;
    }
    entry.state.yaw = { angle: 0, velocity: 0 };
    entry.state.pitch = { angle: 0, velocity: 0 };
    entry.state.baseX = entry.root.rotation.x;
    entry.state.baseZ = entry.root.rotation.z;
    entry.state.lastMoveTime = 0;
    entry.state.carry = 0;
    entry.state.offsetYaw = 0;
    entry.state.offsetPitch = 0;
  },

  onPointerMove: function(entry, pointer, stage){
    var event = pointer.event;
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    var dx = event.movementX || 0;
    var dy = event.movementY || 0;
    var elapsed = event.timeStamp - entry.state.lastMoveTime;
    entry.state.lastMoveTime = event.timeStamp;
    if (!dx && !dy) return;
    if (!(elapsed > 0) || elapsed > 100) elapsed = 16;
    var speed = Math.hypot(dx, dy) / elapsed;
    var strength = IMPULSE * (SPEED_FLOOR + (1 - SPEED_FLOOR) * Math.min(1, speed / FULL_SPEED));
    addTiltImpulse(entry, dx * strength, dy * strength, stage);
  },

  update: function(entry, dt, stage){
    var state = entry.state;
    state.carry += dt;
    while (state.carry >= STEP){
      stepAxis(state.yaw, STEP);
      stepAxis(state.pitch, STEP);
      state.carry -= STEP;
    }
    if (isResting(state.yaw) && isResting(state.pitch)){
      state.yaw.angle = state.yaw.velocity = 0;
      state.pitch.angle = state.pitch.velocity = 0;
      state.carry = 0;
      stage.stopLoop(entry);
    }
    applyRotation(entry);
  }
});
