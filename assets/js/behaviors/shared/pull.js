// Smoothed 0-1 response to proximity: the pull jumps up to the current target and
// fades down from it after the pointer leaves, and value eases toward the pull.
// Behaviors map value to whatever they animate (scale, shape keys, ...).

// Below this, a pull or value counts as zero / settled.
var REST = 0.002;

// settings: { growRate: per second, fadeTime: seconds }. Returns { changed, busy }:
// changed when piece.value moved this step, busy while it is still moving or fading.
export function stepPull(piece, target, dt, settings){
  var fade = Math.exp(-dt / settings.fadeTime);
  var catchUp = 1 - Math.exp(-dt * settings.growRate);
  piece.pull = Math.max(target, (piece.pull || 0) * fade);
  if (piece.pull < REST) piece.pull = 0;
  var previous = piece.value || 0;
  var value = previous + (piece.pull - previous) * catchUp;
  if (Math.abs(value - piece.pull) < REST) value = piece.pull;
  piece.value = value;
  return { changed: value !== previous, busy: piece.pull !== target || value !== piece.pull };
}
