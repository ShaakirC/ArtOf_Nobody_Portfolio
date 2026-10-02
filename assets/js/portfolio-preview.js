// The thumbnail that follows the cursor over the portfolio index (#pfPreview). Only for a mouse
// or trackpad (hover + fine pointer) without reduced motion; it's decorative throughout
// (aria-hidden, no pointer events).
//
// It sits above the hovered row (below it near the top of the screen), so it never covers that
// row's text, eases after the cursor in one requestAnimationFrame loop that stops once it's
// hidden, and leans a few degrees with the cursor's speed. Moving between rows crossfades two
// image layers; a row's thumb starts loading as soon as the pointer enters it. Keyboard focus
// on a row shows it beside the row instead.
//
// TODO: a later upgrade could draw the preview as a three.js plane with a ripple distortion.
// Not worth loading three.js on this page for it yet.

// Preview width in px; the height follows the image's aspect ratio.
var WIDTH = 280;
// Gap in px between the preview and the hovered row, and from the cursor sideways.
var ROW_GAP = 12;
var CURSOR_OFFSET = 24;
// Smallest distance in px kept from the screen edges, and from the top (the fixed header).
var EDGE = 12;
var TOP_CLEARANCE = 84;
// Share of the remaining distance covered each frame (higher follows more tightly).
var EASE = 0.18;
// Lean per px of movement per frame, and the most it leans, in degrees.
var TILT_PER_PX = 0.25;
var MAX_TILT = 4;
// The loop stops once the preview is this close to its target and hidden.
var SETTLE_PX = 0.3;

export function initPreview(list, lookup){
  var preview = document.getElementById('pfPreview');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!preview || !list) return;

  var layers = [document.createElement('img'), document.createElement('img')];
  layers.forEach(function(image){
    image.alt = '';
    image.decoding = 'async';
    preview.appendChild(image);
  });
  var front = 0;
  var shownSrc = '';
  var wantedSrc = '';
  var height = WIDTH * 9 / 16;

  var row = null;
  var rowRect = null;
  var mode = 'pointer';
  var pointerX = 0;
  var x = 0, y = 0, tilt = 0;
  var placed = false;
  var visible = false;
  var frameId = 0;

  function enabled(){
    return canHover.matches && !reducedMotion.matches;
  }

  function projectFor(target){
    var item = target && target.closest && target.closest('.pf-row');
    return item ? { item: item, project: lookup(item.dataset.project) } : null;
  }

  function setRow(item, project, how){
    var src = project && project.media && project.media.thumb;
    if (!src){
      hide();
      return;
    }
    row = item;
    rowRect = null;
    mode = how;
    show(src);
  }

  // Loads src into the back layer, then crossfades to it, so swaps never flash empty.
  function show(src){
    wantedSrc = src;
    if (!visible){
      visible = true;
      preview.classList.add('is-visible');
    }
    startLoop();
    if (src === shownSrc) return;
    var back = layers[1 - front];
    back.src = src;
    var ready = back.decode ? back.decode() : Promise.resolve();
    ready.catch(function(){}).then(function(){
      if (wantedSrc !== src || !back.naturalWidth) return;
      height = WIDTH * back.naturalHeight / back.naturalWidth;
      preview.style.height = height + 'px';
      back.classList.add('is-front');
      layers[front].classList.remove('is-front');
      front = 1 - front;
      shownSrc = src;
    });
  }

  function hide(){
    row = null;
    wantedSrc = '';
    if (!visible) return;
    visible = false;
    placed = false;
    preview.classList.remove('is-visible');
  }

  function target(){
    if (!row) return null;
    if (!rowRect) rowRect = row.getBoundingClientRect();
    var left = mode === 'focus' ? rowRect.left + rowRect.width * 0.55 : pointerX + CURSOR_OFFSET;
    left = Math.max(EDGE, Math.min(window.innerWidth - WIDTH - EDGE, left));
    var top = rowRect.top - height - ROW_GAP;
    if (top < TOP_CLEARANCE) top = rowRect.bottom + ROW_GAP;
    top = Math.max(EDGE, Math.min(window.innerHeight - height - EDGE, top));
    return { x: left, y: top };
  }

  function startLoop(){
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  function frame(){
    frameId = 0;
    var goal = target();
    if (goal){
      if (!placed){
        x = goal.x;
        y = goal.y;
        placed = true;
      }
      var dx = (goal.x - x) * EASE;
      x += dx;
      y += (goal.y - y) * EASE;
      var lean = Math.max(-MAX_TILT, Math.min(MAX_TILT, dx * TILT_PER_PX));
      tilt += (lean - tilt) * EASE;
      preview.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + tilt.toFixed(2) + 'deg)';
      var moving = Math.abs(goal.x - x) > SETTLE_PX || Math.abs(goal.y - y) > SETTLE_PX || Math.abs(tilt) > 0.02;
      // Keep running while visible and still moving; a pointer move restarts it.
      if (moving) frameId = requestAnimationFrame(frame);
    }
  }

  list.addEventListener('pointerover', function(event){
    if (event.pointerType !== 'mouse' || !enabled()) return;
    var hit = projectFor(event.target);
    if (!hit){ hide(); return; }
    if (hit.item !== row || mode !== 'pointer') setRow(hit.item, hit.project, 'pointer');
  });
  list.addEventListener('pointermove', function(event){
    if (event.pointerType !== 'mouse') return;
    pointerX = event.clientX;
    if (visible) startLoop();
  });
  list.addEventListener('pointerleave', hide);
  // Opening a project covers the list with the dialog.
  list.addEventListener('click', hide);

  list.addEventListener('focusin', function(event){
    if (!enabled() || !event.target.matches(':focus-visible')) return;
    var hit = projectFor(event.target);
    if (hit) setRow(hit.item, hit.project, 'focus');
  });
  list.addEventListener('focusout', function(){
    if (mode === 'focus') hide();
  });

  // Row positions change with the scroll; measure again on the next frame.
  window.addEventListener('scroll', function(){
    rowRect = null;
    if (visible) startLoop();
  }, { passive: true });
  window.addEventListener('resize', function(){ rowRect = null; });
}
