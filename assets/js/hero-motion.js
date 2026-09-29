// Phone interactivity for the hero logo, driven by the motion sensors. Touch-first devices only;
// desktop keeps its mouse interaction untouched.
//
// It reuses the desktop systems rather than duplicating them:
//   - Rotation: how fast the phone turns (not which way it points) adds impulses to the same
//     tilt spring the mouse drives (addTiltImpulse in behaviors/tilt.js), so the logo springs
//     back to rest when the phone is held still.
//   - Pieces: a virtual cursor, pushed across the logo by the phone's movement and pulled back
//     to rest by a spring, feeds the same proximity test the mouse does (setVirtualPointer in
//     behaviors/morph-near-pointer.js). Its effect is scaled by an "activity" value that rises
//     with motion and decays when the phone is still, so the pieces only bloom while it moves.
//
// Input: devicemotion rotationRate (deg/s), or, if that's missing, frame-to-frame changes in
// deviceorientation beta/gamma. Some browsers gate the sensors behind requestPermission(). It's
// asked quietly on load first: browsers that don't need a gesture (Chrome) grant it straight
// away, and iOS refuses a request outside a tap without prompting, so only then is it asked
// again on the first tap on the hero, with a "Tap to interact" hint until then. Without sensors (or permission), and before any data
// arrives, the logo drifts gently instead, so it never looks frozen. Everything pauses while
// the hero is off screen or the tab is hidden, and nothing runs with reduced motion.
import { addTiltImpulse, setTiltOffset } from './behaviors/tilt.js';
import { setVirtualPointer } from './behaviors/morph-near-pointer.js';

// Tuning. The tilt spring itself (stiffness, damping, max angle) is shared with the mouse and
// lives at the top of behaviors/tilt.js.
var CONFIG = {
  // Tilt velocity (rad/s) added per degree the phone turns. Higher reacts more strongly.
  impulsePerDegree: 0.05,
  // Phone rotation speeds (deg/s) below this are ignored, so hand tremor doesn't jitter the logo.
  deadzone: 8,
  // Direction of the reaction, 1 or -1. With 1, turning the phone right acts like moving the
  // mouse right, and tipping its top away acts like moving the mouse up.
  yawSign: 1,
  pitchSign: 1,

  // Virtual cursor travel, in px per degree the phone turns.
  cursorPush: 6,
  // Furthest the virtual cursor can get from rest, as a share of the logo's on-screen half-width.
  cursorRange: 0.9,
  // Spring pulling the virtual cursor back to rest: stiffness (higher returns faster) and
  // damping (fraction of critical; just under 1 settles without overshooting).
  cursorStiffness: 10,
  cursorDamping: 0.9,

  // Rotation speed (deg/s) that counts as full activity; slower movement blooms fewer pieces.
  activityFullRate: 120,
  // Seconds for activity to fall to about a third once the phone is still.
  activityDecay: 0.5,
  // A piece blooms when its closeness to the virtual cursor (1 underneath, 0 at the edge of
  // reach) times activity passes this. Lower blooms more pieces; higher only those right
  // under the cursor during strong movement.
  bloomThreshold: 0.3,

  // Idle drift when there's no sensor input: degrees of turn each way, seconds per cycle
  // (pitch runs a little slower, so the two don't loop together), and frames per second.
  idleYaw: 5,
  idlePitch: 2.5,
  idlePeriod: 9,
  idleFps: 30,

  // Milliseconds to wait for sensor data before settling for the idle drift.
  sensorTimeout: 1500
};

var DEGREES = Math.PI / 180;

function applyDeadzone(rate){
  var size = Math.abs(rate) - CONFIG.deadzone;
  return size > 0 ? Math.sign(rate) * size : 0;
}

// Wraps an angle change into -180..180, so a jump across the ±180° seam reads as a small step.
function wrapDegrees(delta){
  return ((delta + 180) % 360 + 360) % 360 - 180;
}

function screenAngle(){
  if (window.screen && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  return typeof window.orientation === 'number' ? window.orientation : 0;
}

// options: { stage, hero, logo } (the logo's ModelStage entry). Returns { setPieces(entry) }
// for the pieces once they've loaded, or null when this doesn't apply (not a touch-first device,
// or reduced motion).
export function initHeroMotion(options){
  if (!window.matchMedia('(pointer: coarse)').matches) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  var stage = options.stage;
  var hero = options.hero;
  var logo = options.logo;
  var pieces = null;
  var THREE = stage.THREE;

  var gated = typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function';
  // 'pending' while it's being worked out or waiting for a tap; 'granted'; or 'denied'.
  var permission = gated ? 'pending' : 'granted';
  // Which sensor drives the effect: null until data arrives, then 'motion' or 'orientation'.
  var source = null;
  var sawOrientation = false;
  var motionTimedOut = false;
  var listening = false;
  var sensorTimer = 0;
  var lastMotionTime = 0;
  var lastOrientation = null;

  var onScreen = false;
  var pageVisible = document.visibilityState === 'visible';
  var frameId = 0;
  var lastFrameTime = 0;
  var idleTime = 0;
  var idleCarry = 0;
  var idleApplied = false;

  // Virtual cursor offset from rest, in canvas px, and its velocity.
  var cursor = { x: 0, y: 0, vx: 0, vy: 0 };
  var activity = 0;

  // The logo's half-width in its own units, for scaling the cursor range to its screen size.
  var logoBox = new THREE.Box3().setFromObject(logo.root);
  var logoHalfWidth = (logoBox.max.x - logoBox.min.x) / 2 / (logo.root.scale.x || 1);
  var center = new THREE.Vector3();
  var edge = new THREE.Vector3();
  var restPoint = { x: 0, y: 0 };
  var edgePoint = { x: 0, y: 0 };

  var hint = null;
  if (gated){
    DeviceMotionEvent.requestPermission().then(function(result){
      permission = result === 'granted' ? 'granted' : 'denied';
      updateActivity();
    }, function(){
      // Needs a gesture (iOS): ask again on the first tap.
      showHint();
      // A tap, not a scroll, fires click; nothing is prevented, so scrolling is untouched.
      hero.addEventListener('click', requestPermission, { passive: true });
    });
  }

  function showHint(){
    hint = document.createElement('p');
    hint.className = 'hero-motion-hint';
    hint.textContent = 'Tap to interact';
    hint.setAttribute('aria-hidden', 'true');
    hero.appendChild(hint);
    placeHint();
    startFrames();
  }

  // ---------- permission (iOS) ----------
  function requestPermission(){
    if (permission !== 'pending') return;
    hero.removeEventListener('click', requestPermission);
    // Both requests must start inside the tap, so neither waits for the other.
    var requests = [DeviceMotionEvent.requestPermission()];
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      requests.push(DeviceOrientationEvent.requestPermission().catch(function(){ return 'denied'; }));
    }
    Promise.all(requests).then(function(results){
      permission = results[0] === 'granted' ? 'granted' : 'denied';
    }, function(){
      permission = 'denied';
    }).then(function(){
      hideHint();
      updateActivity();
    });
  }

  function hideHint(){
    if (hint) hint.classList.add('is-hidden');
  }

  // ---------- sensors ----------
  function listen(){
    if (listening || permission !== 'granted') return;
    listening = true;
    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientation', onOrientation);
    if (!source){
      // Prefer rotationRate; fall back to orientation only if it never arrives.
      sensorTimer = setTimeout(function(){
        motionTimedOut = true;
        if (!source && sawOrientation) source = 'orientation';
      }, CONFIG.sensorTimeout);
    }
  }

  function unlisten(){
    if (!listening) return;
    listening = false;
    clearTimeout(sensorTimer);
    window.removeEventListener('devicemotion', onMotion);
    window.removeEventListener('deviceorientation', onOrientation);
    lastMotionTime = 0;
    lastOrientation = null;
  }

  function onMotion(event){
    var rate = event.rotationRate;
    if (!rate || rate.beta == null || rate.gamma == null) return;
    if (source !== 'motion'){
      source = 'motion';
      window.removeEventListener('deviceorientation', onOrientation);
    }
    var dt = lastMotionTime ? (event.timeStamp - lastMotionTime) / 1000 : (event.interval || 16) / 1000;
    lastMotionTime = event.timeStamp;
    // rotationRate.beta turns about the device's x axis (across the screen), gamma about its
    // y axis (along the screen), both in deg/s.
    handleRates(rate.beta, rate.gamma, Math.min(0.1, Math.max(0.001, dt)));
  }

  function onOrientation(event){
    if (event.beta == null || event.gamma == null) return;
    sawOrientation = true;
    if (!source && motionTimedOut) source = 'orientation';
    var previous = lastOrientation;
    lastOrientation = { beta: event.beta, gamma: event.gamma, time: event.timeStamp };
    if (source !== 'orientation' || !previous) return;
    var dt = Math.min(0.1, Math.max(0.001, (event.timeStamp - previous.time) / 1000));
    var dBeta = wrapDegrees(event.beta - previous.beta);
    var dGamma = event.gamma - previous.gamma;
    // Gamma (±90°) flips sign when beta passes ±90°; treat that jump as no movement.
    if (Math.abs(dGamma) > 90) dGamma = 0;
    handleRates(dBeta / dt, dGamma / dt, dt);
  }

  // rx, ry: rotation rates in deg/s about the device's own x and y axes (portrait-natural).
  function handleRates(rx, ry, dt){
    // Map into screen axes for the current screen orientation: rotation about the screen's
    // horizontal axis (tipping) and about its vertical axis (turning).
    var angle = screenAngle() * DEGREES;
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    var aboutHorizontal = applyDeadzone(rx * cos - ry * sin);
    var aboutVertical = applyDeadzone(rx * sin + ry * cos);
    if (!aboutHorizontal && !aboutVertical) return;

    // Turning right is a negative rotation about the screen's up axis; it should act like
    // moving the mouse right. Tipping the top away is negative about the right axis; like
    // moving the mouse up.
    var yawDegrees = CONFIG.yawSign * -aboutVertical * dt;
    var pitchDegrees = CONFIG.pitchSign * aboutHorizontal * dt;

    if (idleApplied){
      setTiltOffset(logo, 0, 0, stage);
      idleApplied = false;
    }
    addTiltImpulse(logo, yawDegrees * CONFIG.impulsePerDegree, pitchDegrees * CONFIG.impulsePerDegree, stage);

    cursor.x += yawDegrees * CONFIG.cursorPush;
    cursor.y += pitchDegrees * CONFIG.cursorPush;
    var speed = Math.hypot(aboutHorizontal, aboutVertical);
    activity = Math.max(activity, Math.min(1, speed / CONFIG.activityFullRate));
    startFrames();
  }

  // ---------- per-frame effect ----------
  function startFrames(){
    if (!frameId && onScreen && pageVisible) frameId = window.requestAnimationFrame(frame);
  }

  function stopFrames(){
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrameTime = 0;
  }

  function frame(time){
    frameId = 0;
    var dt = lastFrameTime ? Math.min(0.1, (time - lastFrameTime) / 1000) : 0;
    lastFrameTime = time;
    var keepGoing = false;

    if (source){
      // Sensors took over from the idle drift: drop its last offset.
      if (idleApplied){
        setTiltOffset(logo, 0, 0, stage);
        idleApplied = false;
      }
      keepGoing = stepCursor(dt);
    } else {
      stepIdle(dt);
      keepGoing = true;
    }
    if (hint && !hint.classList.contains('is-hidden')) placeHint();

    if (keepGoing) startFrames();
    else lastFrameTime = 0;
  }

  // Projects the logo's pivot, and a point a half-width to its side, into canvas px.
  function projectLogo(){
    logo.root.updateWorldMatrix(true, false);
    logo.root.getWorldPosition(center);
    edge.copy(center);
    edge.x += logoHalfWidth * logo.root.scale.x;
    stage.projectToCanvas(center, restPoint);
    stage.projectToCanvas(edge, edgePoint);
    return Math.abs(edgePoint.x - restPoint.x);
  }

  // Returns whether anything is still moving.
  function stepCursor(dt){
    var damping = 2 * Math.sqrt(CONFIG.cursorStiffness) * CONFIG.cursorDamping;
    ['x', 'y'].forEach(function(axis){
      var velocity = axis === 'x' ? 'vx' : 'vy';
      cursor[velocity] += (-CONFIG.cursorStiffness * cursor[axis] - damping * cursor[velocity]) * dt;
      cursor[axis] += cursor[velocity] * dt;
    });
    activity *= Math.exp(-dt / CONFIG.activityDecay);
    if (activity < 0.01) activity = 0;

    var halfWidth = projectLogo();
    var range = CONFIG.cursorRange * halfWidth;
    var distance = Math.hypot(cursor.x, cursor.y);
    if (distance > range && distance > 0){
      cursor.x *= range / distance;
      cursor.y *= range / distance;
    }
    if (pieces) setVirtualPointer(pieces, restPoint.x + cursor.x, restPoint.y + cursor.y, activity, CONFIG.bloomThreshold, stage);

    var settled = activity === 0 && distance < 0.5 && Math.hypot(cursor.vx, cursor.vy) < 1;
    if (settled){
      cursor.x = cursor.y = cursor.vx = cursor.vy = 0;
    }
    return !settled;
  }

  function stepIdle(dt){
    idleTime += dt;
    idleCarry += dt;
    if (idleCarry < 1 / CONFIG.idleFps) return;
    idleCarry = 0;
    var phase = 2 * Math.PI * idleTime / CONFIG.idlePeriod;
    setTiltOffset(logo,
      CONFIG.idleYaw * DEGREES * Math.sin(phase),
      CONFIG.idlePitch * DEGREES * Math.sin(phase / 1.3),
      stage);
    idleApplied = true;
  }

  function placeHint(){
    projectLogo();
    hint.style.left = restPoint.x + 'px';
    hint.style.top = restPoint.y + 'px';
  }

  // ---------- pausing ----------
  function updateActivity(){
    if (onScreen && pageVisible){
      listen();
      startFrames();
    } else {
      unlisten();
      stopFrames();
    }
  }

  new IntersectionObserver(function(records){
    onScreen = records[records.length - 1].isIntersecting;
    updateActivity();
  }).observe(hero);
  document.addEventListener('visibilitychange', function(){
    pageVisible = document.visibilityState === 'visible';
    updateActivity();
  });

  return {
    setPieces: function(entry){ pieces = entry; }
  };
}
