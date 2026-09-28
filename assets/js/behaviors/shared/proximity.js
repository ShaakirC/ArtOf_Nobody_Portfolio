// Tracks the mouse over a ModelStage and measures how close model points are to it.
// Behaviors feed it the stage pointer hooks, then ask for each point's influence.

var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createProximity(radius){
  var pointer = { x: 0, y: 0, active: false };
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

    // 0 at or beyond the radius, easing smoothly up to 1 at the pointer. localPoint is in
    // the space of object, whose matrixWorld must be current.
    influence: function(localPoint, object, stage){
      if (!pointer.active) return 0;
      world = world || new stage.THREE.Vector3();
      world.copy(localPoint).applyMatrix4(object.matrixWorld);
      stage.projectToCanvas(world, screen);
      return falloff(Math.hypot(screen.x - pointer.x, screen.y - pointer.y));
    },

    // Like influence, but measured to the nearest edge of a shape instead of one point.
    // points is a flat [x, y, z, ...] array in object space; edges is a flat [a, b, ...]
    // array of point indices. Suits long or irregular pieces.
    influenceOfShape: function(points, edges, object, stage){
      if (!pointer.active) return 0;
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
          pointer.x, pointer.y,
          projectedX[edges[e]], projectedY[edges[e]],
          projectedX[edges[e + 1]], projectedY[edges[e + 1]]
        ));
      }
      return falloff(nearest);
    }
  };

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
