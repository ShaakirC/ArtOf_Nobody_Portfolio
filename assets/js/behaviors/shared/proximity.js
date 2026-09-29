// Tracks the mouse over a ModelStage and measures how close model points are to it.
// Behaviors feed it the stage pointer hooks, then ask for each point's influence.
//
// It also has a virtual pointer for input other than the mouse (the phone's motion sensors,
// see hero-motion.js): setVirtual(x, y, strength, threshold) places it in canvas px. Its
// influence is scaled by strength (0-1; 0 turns it off), and anything at or below threshold
// counts as none, so weak input only reaches points right under it. The mouse takes
// precedence whenever it's active.

var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createProximity(radius){
  var pointer = { x: 0, y: 0, active: false };
  var virtual = { x: 0, y: 0, strength: 0, threshold: 0 };
  // Scratch results for currentSource(), declared here so they exist before any call.
  var mouseSource = { x: 0, y: 0, scale: 1, threshold: 0 };
  var virtualSource = { x: 0, y: 0, scale: 0, threshold: 0 };
  var world = null;
  var screen = { x: 0, y: 0 };
  var projectedX = null;
  var projectedY = null;

  return {
    // Call from onStagePointerMove; returns whether the pointer counts (mouse only, motion allowed).
    move: function(stagePointer){
      pointer.x = stagePointer.x;
      pointer.y = stagePointer.y;
      pointer.active = stagePointer.event.pointerType === 'mouse' && !reducedMotion.matches;
      return pointer.active;
    },

    // Call from onStagePointerLeave.
    leave: function(){
      pointer.active = false;
    },

    isActive: function(){
      return pointer.active;
    },

    setVirtual: function(x, y, strength, threshold){
      virtual.x = x;
      virtual.y = y;
      virtual.strength = strength;
      virtual.threshold = threshold || 0;
    },

    // 0 at or beyond the radius, easing smoothly up to 1 at the pointer. localPoint is in
    // the space of object, whose matrixWorld must be current.
    influence: function(localPoint, object, stage){
      var source = currentSource();
      if (!source) return 0;
      world = world || new stage.THREE.Vector3();
      world.copy(localPoint).applyMatrix4(object.matrixWorld);
      stage.projectToCanvas(world, screen);
      return scaled(falloff(Math.hypot(screen.x - source.x, screen.y - source.y)), source);
    },

    // Like influence, but measured to the nearest edge of a shape instead of one point.
    // points is a flat [x, y, z, ...] array in object space; edges is a flat [a, b, ...]
    // array of point indices. Suits long or irregular pieces.
    influenceOfShape: function(points, edges, object, stage){
      var source = currentSource();
      if (!source) return 0;
      world = world || new stage.THREE.Vector3();
      var count = points.length / 3;
      if (!projectedX || projectedX.length < count){
        projectedX = new Float32Array(count);
        projectedY = new Float32Array(count);
      }
      for (var i = 0; i < count; i++){
        world.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]).applyMatrix4(object.matrixWorld);
        stage.projectToCanvas(world, screen);
        projectedX[i] = screen.x;
        projectedY[i] = screen.y;
      }
      var nearest = Infinity;
      for (var e = 0; e < edges.length; e += 2){
        nearest = Math.min(nearest, distanceToSegment(
          source.x, source.y,
          projectedX[edges[e]], projectedY[edges[e]],
          projectedX[edges[e + 1]], projectedY[edges[e + 1]]
        ));
      }
      return scaled(falloff(nearest), source);
    }
  };

  // The mouse when it's active, else the virtual pointer when it has any strength.
  function currentSource(){
    if (pointer.active){
      mouseSource.x = pointer.x;
      mouseSource.y = pointer.y;
      return mouseSource;
    }
    if (virtual.strength > 0){
      virtualSource.x = virtual.x;
      virtualSource.y = virtual.y;
      virtualSource.scale = virtual.strength;
      virtualSource.threshold = virtual.threshold;
      return virtualSource;
    }
    return null;
  }

  // The mouse passes straight through (scale 1, threshold 0), so desktop is unchanged.
  function scaled(amount, source){
    var value = amount * source.scale;
    return value > source.threshold ? (value - source.threshold) / (1 - source.threshold) : 0;
  }

  function falloff(distance){
    var amount = Math.max(0, 1 - distance / radius);
    return amount * amount * (3 - 2 * amount);
  }
}

function distanceToSegment(px, py, ax, ay, bx, by){
  var dx = bx - ax;
  var dy = by - ay;
  var lengthSquared = dx * dx + dy * dy;
  var t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
