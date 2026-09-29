// Shape-key pieces that grow on their own, one after another in a random order: each grows
// fully, holds, then recedes, the same growth as the hero's hover (see shared/shape-keys.js).
// A new piece starts every START_INTERVAL, so a few are moving at any moment; once every
// piece has had a turn, the order is shuffled again. Reduced motion leaves them at rest.
import { registerBehavior } from '../model-stage.js';
import { applyWeights, collectPieces } from './shared/shape-keys.js';

// Seconds to grow fully, and to recede (matching morph-near-pointer's timing).
var GROW_TIME = 0.8;
var RECEDE_TIME = 0.8 / 0.65;
// Seconds a fully grown piece holds before receding.
var HOLD_TIME = 1;
// Seconds between one piece starting and the next.
var START_INTERVAL = 0.6;

var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function shuffle(items){
  for (var i = items.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

registerBehavior('grow-cycle', {
  setup: function(entry, stage){
    var state = entry.state;
    // Any exported shape key animation is replaced by this cycle.
    if (entry.mixer) entry.mixer.stopAllAction();
    state.pieces = collectPieces(entry.root);
    state.pieces.forEach(function(piece){
      piece.phase = 'rest'; // rest -> growing -> holding -> receding -> rest
      piece.holdLeft = 0;
    });
    state.queue = [];
    state.untilNext = 0;
    if (state.pieces.length && !reducedMotion.matches) stage.startLoop(entry);
  },

  update: function(entry, dt){
    var state = entry.state;

    state.untilNext -= dt;
    if (state.untilNext <= 0){
      state.untilNext += START_INTERVAL;
      if (!state.queue.length) state.queue = shuffle(state.pieces.slice());
      var next = state.queue.shift();
      // A piece still busy from its last turn waits for the next round.
      if (next.phase === 'rest') next.phase = 'growing';
    }

    state.pieces.forEach(function(piece){
      var previous = piece.value;
      if (piece.phase === 'growing'){
        piece.value = Math.min(1, piece.value + dt / GROW_TIME);
        if (piece.value === 1){
          piece.phase = 'holding';
          piece.holdLeft = HOLD_TIME;
        }
      } else if (piece.phase === 'holding'){
        piece.holdLeft -= dt;
        if (piece.holdLeft <= 0) piece.phase = 'receding';
      } else if (piece.phase === 'receding'){
        piece.value = Math.max(0, piece.value - dt / RECEDE_TIME);
        if (piece.value === 0) piece.phase = 'rest';
      }
      if (piece.value !== previous) applyWeights(piece);
    });
  }
});
