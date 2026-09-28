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
    heroBottom = hero.getBoundingClientRect().bottom;
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

  function drawGrid(){
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.drawImage(restingCanvas, 0, 0, viewportWidth, viewportHeight);
    activeIntersections.forEach(function(index){
      var value = growth[index];
      var row = Math.floor(index / columns);
      var column = index - row * columns;
      var progress = 1 - Math.pow(1 - value, 3);
      var arm = REST_ARM + progress * (GRID_SIZE / 2 - REST_ARM);
      var alpha = REST_ALPHA + (ACTIVE_ALPHA - REST_ALPHA) * value;
      var restPath = new Path2D();
      appendCross(restPath, column * GRID_SIZE, row * GRID_SIZE, REST_ARM);
      context.save();
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = 'rgba(0,0,0,1)';
      context.fill(restPath);
      context.restore();
      var activePath = new Path2D();
      appendCross(activePath, column * GRID_SIZE, row * GRID_SIZE, arm);
      context.fillStyle = 'rgba(' + gridColor + ',' + alpha + ')';
      context.fill(activePath);
    });
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

  function hasChangingIntersections(){
    var changing = false;
    activeIntersections.forEach(function(index){
      if (changing) return;
      var target = getHoldTarget(index);
      if (target !== null ? growth[index] < target : growth[index] > 0){
        changing = true;
      }
    });
    return changing;
  }

  function animate(){
    frameId = 0;
    var changed = false;
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
            changed = true;
          }
          if (nextValue < target) changing = true;
        }
      } else if (value > 0){
        var decayedValue = value * (1 - DECAY_RATE);
        if (decayedValue < 0.01) decayedValue = 0;
        if (decayedValue !== value){
          growth[index] = decayedValue;
          changed = true;
        }
        if (decayedValue > 0){
          changing = true;
        } else {
          activeIntersections.delete(index);
        }
      }
    });
    if (changed) drawGrid();
    if (changing) frameId = window.requestAnimationFrame(animate);
  }

  function startAnimation(){
    if (!frameId && !reducedMotion.matches && hasChangingIntersections()){
      frameId = window.requestAnimationFrame(animate);
    }
  }

  function restartAnimation(){
    stopAnimation();
    startAnimation();
  }

  function setPointerInactive(){
    if (!lastPointer.active) return;
    lastPointer.active = false;
    restartAnimation();
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
      restartAnimation();
      return;
    }

    var strength = SPEED_FLOOR + (1 - SPEED_FLOOR) * speedFactor;
    var minColumn = Math.max(0, Math.ceil((event.clientX - POINTER_RADIUS) / GRID_SIZE));
    var maxColumn = Math.min(columns - 1, Math.floor((event.clientX + POINTER_RADIUS) / GRID_SIZE));
    var minRow = Math.max(0, Math.ceil((event.clientY - POINTER_RADIUS) / GRID_SIZE));
    var maxRow = Math.min(rows - 1, Math.floor((event.clientY + POINTER_RADIUS) / GRID_SIZE));
    var pointerChanged = false;

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
          pointerChanged = true;
        }
        activeIntersections.add(index);
      }
    }

    if (pointerChanged) drawGrid();
    restartAnimation();
  }

  function onScroll(){
    updateHeroBottom();
    if (lastPointer.active && lastPointer.y < heroBottom) setPointerInactive();
  }

  function onMotionPreferenceChange(){
    stopAnimation();
    activeIntersections.clear();
    growth.fill(0);
    rebuildRestingGrid();
    drawGrid();
  }

  refreshGridColor();
  resizeCanvas();
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
