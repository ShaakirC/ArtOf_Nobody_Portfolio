// Interactive crosshair grid drawn behind the page.
export function initGrid(){
  // Grid spacing in CSS pixels between viewport-fixed intersections.
  var GRID_SIZE = 80;
  // Resting arm length in CSS pixels; each cross is twice this wide.
  var REST_ARM = 5;
  // Stroke width in CSS pixels.
  var LINE_WIDTH = 1;
  // Resting cross opacity.
  var REST_ALPHA = 0.20;
  // Opacity of fully extended arms.
  var ACTIVE_ALPHA = 0.14;
  // Pointer influence radius in CSS pixels.
  var POINTER_RADIUS = 120;
  // Fraction of active growth removed per animation frame.
  var DECAY_RATE = 0.09;
  // Minimum growth response for a slow pointer movement.
  var SPEED_FLOOR = 0.35;
  // Pointer speed in px/ms that reaches full speed strength.
  var SPEED_SENSITIVITY = 4;

  var canvas = document.getElementById('grid-canvas');
  var context = canvas.getContext('2d');
  var restingCanvas = document.createElement('canvas');
  var restingContext = restingCanvas.getContext('2d');
  var hero = document.querySelector('.hero');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var pixelRatio = 1;
  var viewportWidth = 0;
  var viewportHeight = 0;
  var columns = 0;
  var rows = 0;
  var growth = new Float32Array(0);
  var activeIntersections = new Set();
  // Intersections whose cross changed since the last frame; only their cells are repainted.
  var dirtyIntersections = new Set();
  var gridColor = '255,255,255';
  var heroBottom = 0;
  var frameId = 0;
  var resizeFrameId = 0;
  var lastPointer = { x:0, y:0, active:false };
  var previousPointerMove = null;

  function refreshGridColor(){
    gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-rgb').trim() || '255,255,255';
  }

  function updateHeroBottom(){
    // Pages without a hero (the portfolio) react everywhere.
    heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
  }

  function alignToDevicePixel(value){
    var deviceLineWidth = Math.round(LINE_WIDTH * pixelRatio);
    return (Math.round(value * pixelRatio - deviceLineWidth / 2) + deviceLineWidth / 2) / pixelRatio;
  }

  function appendCross(path, x, y, arm){
    x = alignToDevicePixel(x);
    y = alignToDevicePixel(y);
    var halfWidth = Math.round(LINE_WIDTH * pixelRatio) / pixelRatio / 2;
    var left = x - arm;
    var right = x + arm;
    var top = y - arm;
    var bottom = y + arm;
    var horizontalTop = y - halfWidth;
    var horizontalBottom = y + halfWidth;
    var verticalLeft = x - halfWidth;
    var verticalRight = x + halfWidth;
    path.moveTo(left, horizontalTop);
    path.lineTo(verticalLeft, horizontalTop);
    path.lineTo(verticalLeft, top);
    path.lineTo(verticalRight, top);
    path.lineTo(verticalRight, horizontalTop);
    path.lineTo(right, horizontalTop);
    path.lineTo(right, horizontalBottom);
    path.lineTo(verticalRight, horizontalBottom);
    path.lineTo(verticalRight, bottom);
    path.lineTo(verticalLeft, bottom);
    path.lineTo(verticalLeft, horizontalBottom);
    path.lineTo(left, horizontalBottom);
    path.closePath();
  }

  function rebuildRestingGrid(){
    restingCanvas.width = canvas.width;
    restingCanvas.height = canvas.height;
    restingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    restingContext.clearRect(0, 0, viewportWidth, viewportHeight);
    var restingPath = new Path2D();
    for (var row = 0; row < rows; row++){
      for (var column = 0; column < columns; column++){
        appendCross(restingPath, column * GRID_SIZE, row * GRID_SIZE, REST_ARM);
      }
    }
    restingContext.fillStyle = 'rgba(' + gridColor + ',' + REST_ALPHA + ')';
    restingContext.fill(restingPath);
  }

  // Repaints the whole canvas: after a resize, a theme change or a motion preference change.
  function drawGrid(){
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(restingCanvas, 0, 0);
    activeIntersections.forEach(repaintCell);
    dirtyIntersections.clear();
  }

  function drawDirtyCells(){
    dirtyIntersections.forEach(repaintCell);
    dirtyIntersections.clear();
  }

  function fillCross(index, arm, alpha){
    var row = Math.floor(index / columns);
    var column = index - row * columns;
    context.beginPath();
    appendCross(context, column * GRID_SIZE, row * GRID_SIZE, arm);
    context.fillStyle = 'rgba(' + gridColor + ',' + alpha + ')';
    context.fill();
  }

  function fillActiveCross(index){
    var value = growth[index];
    if (!(value > 0)) return;
    var progress = 1 - Math.pow(1 - value, 3);
    fillCross(index, REST_ARM + progress * (GRID_SIZE / 2 - REST_ARM), REST_ALPHA + (ACTIVE_ALPHA - REST_ALPHA) * value);
  }

  // Repaints the cell around one intersection: the square its arms can reach, plus a pixel so
  // stroke edges are covered. Neighbouring arms reach at most the cell edge, so only this
  // cross and the tips of its four neighbours can land inside it.
  function repaintCell(index){
    var row = Math.floor(index / columns);
    var column = index - row * columns;
    var reach = GRID_SIZE / 2 + 1;
    // Device pixels, so the resting grid is copied back 1:1 without resampling.
    var left = Math.max(0, Math.floor((column * GRID_SIZE - reach) * pixelRatio));
    var top = Math.max(0, Math.floor((row * GRID_SIZE - reach) * pixelRatio));
    var right = Math.min(canvas.width, Math.ceil((column * GRID_SIZE + reach) * pixelRatio));
    var bottom = Math.min(canvas.height, Math.ceil((row * GRID_SIZE + reach) * pixelRatio));
    if (right <= left || bottom <= top) return;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.beginPath();
    context.rect(left, top, right - left, bottom - top);
    context.clip();
    context.clearRect(left, top, right - left, bottom - top);
    context.drawImage(restingCanvas, left, top, right - left, bottom - top, left, top, right - left, bottom - top);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (growth[index] > 0){
      // An active cross replaces its resting one.
      context.globalCompositeOperation = 'destination-out';
      fillCross(index, REST_ARM, 1);
      context.globalCompositeOperation = 'source-over';
      fillActiveCross(index);
    }
    if (column > 0) fillActiveCross(index - 1);
    if (column < columns - 1) fillActiveCross(index + 1);
    if (row > 0) fillActiveCross(index - columns);
    if (row < rows - 1) fillActiveCross(index + columns);
    context.restore();
  }

  function stopAnimation(){
    if (frameId){
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function getHoldTarget(index){
    if (!lastPointer.active) return null;
    var row = Math.floor(index / columns);
    var column = index - row * columns;
    var distance = Math.hypot(lastPointer.x - column * GRID_SIZE, lastPointer.y - row * GRID_SIZE);
    if (distance > POINTER_RADIUS) return null;
    var normalizedDistance = distance / POINTER_RADIUS;
    var smooth = normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance);
    return 1 - smooth;
  }

  function animate(){
    frameId = 0;
    var changing = false;
    activeIntersections.forEach(function(index){
      var value = growth[index];
      var target = getHoldTarget(index);
      if (target !== null){
        if (value < target){
          var nextValue = value + (target - value) * DECAY_RATE;
          if (target - nextValue < 0.01) nextValue = target;
          if (nextValue !== value){
            growth[index] = nextValue;
            dirtyIntersections.add(index);
          }
          if (nextValue < target) changing = true;
        }
      } else if (value > 0){
        var decayedValue = value * (1 - DECAY_RATE);
        if (decayedValue < 0.01) decayedValue = 0;
        if (decayedValue !== value){
          growth[index] = decayedValue;
          dirtyIntersections.add(index);
        }
        if (decayedValue > 0){
          changing = true;
        } else {
          activeIntersections.delete(index);
        }
      }
    });
    drawDirtyCells();
    if (changing) scheduleFrame();
  }

  // All drawing happens in animate, once per frame; it stops when nothing is changing.
  function scheduleFrame(){
    if (!frameId && !reducedMotion.matches && activeIntersections.size){
      frameId = window.requestAnimationFrame(animate);
    }
  }

  function setPointerInactive(){
    if (!lastPointer.active) return;
    lastPointer.active = false;
    scheduleFrame();
  }

  function resizeCanvas(){
    stopAnimation();
    viewportWidth = canvas.clientWidth;
    viewportHeight = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewportWidth * pixelRatio);
    canvas.height = Math.round(viewportHeight * pixelRatio);
    columns = Math.ceil(viewportWidth / GRID_SIZE) + 1;
    rows = Math.ceil(viewportHeight / GRID_SIZE) + 1;
    growth = new Float32Array(columns * rows);
    activeIntersections.clear();
    dirtyIntersections.clear();
    updateHeroBottom();
    if (lastPointer.y < heroBottom) lastPointer.active = false;
    rebuildRestingGrid();
    drawGrid();
  }

  function requestResize(){
    if (resizeFrameId) return;
    resizeFrameId = window.requestAnimationFrame(function(){
      resizeFrameId = 0;
      resizeCanvas();
    });
  }

  function onPointerMove(event){
    var now = performance.now();
    var speedFactor = 0;
    if (event.pointerType === 'mouse' && previousPointerMove){
      var elapsed = Math.max(1, now - previousPointerMove.time);
      var distance = Math.hypot(event.clientX - previousPointerMove.x, event.clientY - previousPointerMove.y);
      speedFactor = Math.min(1, distance / elapsed * SPEED_SENSITIVITY);
    }
    previousPointerMove = event.pointerType === 'mouse' ? { x:event.clientX, y:event.clientY, time:now } : null;
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    lastPointer.active = event.pointerType === 'mouse' && !reducedMotion.matches && event.clientY >= heroBottom;
    if (!lastPointer.active){
      scheduleFrame();
      return;
    }

    var strength = SPEED_FLOOR + (1 - SPEED_FLOOR) * speedFactor;
    var minColumn = Math.max(0, Math.ceil((event.clientX - POINTER_RADIUS) / GRID_SIZE));
    var maxColumn = Math.min(columns - 1, Math.floor((event.clientX + POINTER_RADIUS) / GRID_SIZE));
    var minRow = Math.max(0, Math.ceil((event.clientY - POINTER_RADIUS) / GRID_SIZE));
    var maxRow = Math.min(rows - 1, Math.floor((event.clientY + POINTER_RADIUS) / GRID_SIZE));

    for (var row = minRow; row <= maxRow; row++){
      for (var column = minColumn; column <= maxColumn; column++){
        var x = column * GRID_SIZE;
        var y = row * GRID_SIZE;
        var distanceToIntersection = Math.hypot(event.clientX - x, event.clientY - y);
        if (distanceToIntersection > POINTER_RADIUS) continue;
        var normalizedDistance = distanceToIntersection / POINTER_RADIUS;
        var smooth = normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance);
        var index = row * columns + column;
        var nextGrowth = Math.max(growth[index], strength * (1 - smooth));
        if (nextGrowth !== growth[index]){
          growth[index] = nextGrowth;
          dirtyIntersections.add(index);
        }
        activeIntersections.add(index);
      }
    }

    scheduleFrame();
  }

  function onScroll(){
    updateHeroBottom();
    if (lastPointer.active && lastPointer.y < heroBottom) setPointerInactive();
  }

  function onMotionPreferenceChange(){
    stopAnimation();
    activeIntersections.clear();
    dirtyIntersections.clear();
    growth.fill(0);
    rebuildRestingGrid();
    drawGrid();
  }

  refreshGridColor();
  resizeCanvas();
  // A GPU reset can wipe 2D canvases too; the browser restores them blank, so redraw.
  function onContextRestored(){
    rebuildRestingGrid();
    drawGrid();
  }
  canvas.addEventListener('contextrestored', onContextRestored);
  restingCanvas.addEventListener('contextrestored', onContextRestored);
  document.addEventListener('pointermove', onPointerMove, { passive:true });
  document.addEventListener('pointerleave', setPointerInactive, { passive:true });
  window.addEventListener('blur', setPointerInactive);
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', requestResize, { passive:true });
  reducedMotion.addEventListener('change', onMotionPreferenceChange);
  new MutationObserver(function(){
    refreshGridColor();
    rebuildRestingGrid();
    drawGrid();
  }).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
}
