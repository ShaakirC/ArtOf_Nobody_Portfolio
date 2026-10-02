// Red/cyan split effect on [data-split] headings that reacts to pointer speed.
// The same red/cyan copies also carry the services step transition (see .panel in the stylesheet),
// so the service headings are split and measured up front. Every other heading (the hero's
// included) stays plain text until a mouse first moves: rebuilding the hero heading at load
// made it the page's largest paint, so that paint waited on three.js and the other modules.
// Touch screens never get the pointer effect, so there they're never split.
export function initSplitText(){
  // Effect tuning: radius in px; maximum red/cyan offset in px.
  var SPLIT_RADIUS = 120; // Distance from the pointer where the effect fades out.
  var MAX_SPLIT_PX = 5; // Largest offset from the original letter.
  var DECAY_RATE = 0.055; // Fraction of the remaining split removed per frame.
  var SPEED_SENSITIVITY = 4; // Pointer speed in px/ms needed for a strong split.

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var states = Array.prototype.map.call(document.querySelectorAll('[data-split]'), function(heading){
    var text = heading.textContent;
    heading.setAttribute('aria-label', text);
    // bounds: the heading's viewport rect, cached until the next scroll or resize.
    // Letter x/y are relative to it, so scrolling doesn't invalidate them.
    return { element:heading, panel:heading.closest('.panel'), text:text, letters:[], positionsValid:false, bounds:null };
  });
  if (!states.length) return;

  var activeLetters = new Set();
  var mouseSeen = false;
  var frameId = 0;
  var measureFrameId = 0;

  function buildLetters(state){
    var fragment = document.createDocumentFragment();
    var tokens = state.text.split(/(\s+)/);
    state.letters = [];

    tokens.forEach(function(token){
      if (!token) return;
      if (/^\s+$/.test(token)){
        fragment.appendChild(document.createTextNode(token));
        return;
      }

      var word = document.createElement('span');
      word.className = 'split-word';
      word.setAttribute('aria-hidden', 'true');
      var original = document.createElement('span');
      original.className = 'split-base';
      var textNode = document.createTextNode(token);
      original.appendChild(textNode);
      word.appendChild(original);
      var offset = 0;
      Array.from(token).forEach(function(character){
        var letter = document.createElement('span');
        letter.className = 'split-letter';
        letter.dataset.letter = character;
        letter.setAttribute('aria-hidden', 'true');
        word.appendChild(letter);
        state.letters.push({ element:letter, word:word, textNode:textNode, offset:offset, x:0, y:0, split:0 });
        offset += character.length;
      });
      fragment.appendChild(word);
    });

    state.element.replaceChildren(fragment);
    state.positionsValid = false;
    scheduleMeasure();
  }

  function clearLetters(state){
    state.letters.forEach(function(letter){ activeLetters.delete(letter); });
    state.element.textContent = state.text;
    state.letters = [];
    state.positionsValid = false;
  }

  function invalidatePositions(){
    states.forEach(function(state){
      state.positionsValid = false;
      state.bounds = null;
    });
    scheduleMeasure();
  }

  // Places each letter's copies over its glyph, and keeps its center relative to the heading
  // for pointer distances. Layout-only, so it holds until a resize or font load.
  function measureLetters(state){
    if (!state.letters.length) return;
    var bounds = state.element.getBoundingClientRect();
    var wordBounds = new Map();
    var range = document.createRange();
    var measuredLetters = state.letters.map(function(letter){
      var word = wordBounds.get(letter.word);
      if (!word){
        word = letter.word.getBoundingClientRect();
        wordBounds.set(letter.word, word);
      }
      range.setStart(letter.textNode, letter.offset);
      range.setEnd(letter.textNode, letter.offset + letter.element.dataset.letter.length);
      var rect = range.getBoundingClientRect();
      return { letter:letter, left:rect.left - word.left,
        x:rect.left + rect.width / 2 - bounds.left, y:rect.top + rect.height / 2 - bounds.top };
    });
    // Reads first, then writes, so measuring every heading costs one layout.
    measuredLetters.forEach(function(position){
      position.letter.x = position.x;
      position.letter.y = position.y;
      position.letter.element.style.left = position.left + 'px';
      position.letter.element.style.top = '0px';
    });
    state.positionsValid = true;
  }

  function scheduleMeasure(){
    if (measureFrameId) return;
    measureFrameId = window.requestAnimationFrame(function(){
      measureFrameId = 0;
      states.forEach(function(state){
        if (!state.positionsValid) measureLetters(state);
      });
    });
  }

  function invalidateBounds(){
    states.forEach(function(state){ state.bounds = null; });
  }

  // The red/cyan copies only exist while a letter is split (.is-split in the stylesheet),
  // so resting letters cost no blended layers.
  function setSplit(letter, split){
    var offset = split.toFixed(2) + 'px';
    letter.element.style.setProperty('--split-red-x', '-' + offset);
    letter.element.style.setProperty('--split-cyan-x', offset);
    letter.element.style.setProperty('--split-opacity', Math.min(1, split / MAX_SPLIT_PX).toFixed(3));
    letter.element.classList.toggle('is-split', split > 0);
  }

  function scheduleFrame(){
    if (!frameId) frameId = window.requestAnimationFrame(decayFrame);
  }

  function decayFrame(){
    frameId = 0;
    activeLetters.forEach(function(letter){
      letter.split *= 1 - DECAY_RATE;
      if (letter.split < 0.025){
        letter.split = 0;
        activeLetters.delete(letter);
      }
      setSplit(letter, letter.split);
    });
    if (activeLetters.size) scheduleFrame();
  }

  function smoothFalloff(distance){
    var amount = Math.max(0, 1 - distance / SPLIT_RADIUS);
    return amount * amount * (3 - 2 * amount);
  }

  function onPointerMove(event){
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    if (!mouseSeen){
      mouseSeen = true;
      applyMotionPreference();
    }
    var now = performance.now();
    var elapsed = Math.max(1, now - (onPointerMove.lastTime || now));
    var distanceMoved = onPointerMove.lastX === undefined ? 0 : Math.hypot(event.clientX - onPointerMove.lastX, event.clientY - onPointerMove.lastY);
    var speedFactor = Math.min(1, distanceMoved / elapsed * SPEED_SENSITIVITY);
    onPointerMove.lastX = event.clientX;
    onPointerMove.lastY = event.clientY;
    onPointerMove.lastTime = now;
    if (!speedFactor) return;

    states.forEach(function(state){
      // Only the service shown right now reacts (services.js marks it .is-active).
      if (state.panel && !state.panel.classList.contains('is-active')) return;
      if (!state.bounds) state.bounds = state.element.getBoundingClientRect();
      var bounds = state.bounds;
      if (event.clientX < bounds.left - SPLIT_RADIUS || event.clientX > bounds.right + SPLIT_RADIUS ||
          event.clientY < bounds.top - SPLIT_RADIUS || event.clientY > bounds.bottom + SPLIT_RADIUS) return;

      if (!state.positionsValid) measureLetters(state);

      state.letters.forEach(function(letter){
        var distance = Math.hypot(event.clientX - bounds.left - letter.x, event.clientY - bounds.top - letter.y);
        var split = MAX_SPLIT_PX * speedFactor * smoothFalloff(distance);
        if (split > letter.split){
          letter.split = split;
          activeLetters.add(letter);
          setSplit(letter, split);
        }
      });
    });
    if (activeLetters.size) scheduleFrame();
  }

  function applyMotionPreference(){
    states.forEach(function(state){
      if (reducedMotion.matches){
        clearLetters(state);
      } else if (!state.letters.length && (state.panel || mouseSeen)){
        buildLetters(state);
      }
    });
    if (reducedMotion.matches && frameId){
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  applyMotionPreference();
  reducedMotion.addEventListener('change', applyMotionPreference);
  document.addEventListener('pointermove', onPointerMove, { passive:true });
  window.addEventListener('resize', invalidatePositions, { passive:true });
  window.addEventListener('scroll', invalidateBounds, { passive:true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidatePositions);
}
