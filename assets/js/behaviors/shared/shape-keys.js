// Pieces driven by their shape keys (morph targets), as authored for the hero logo: at rest
// every key sits at 1, and a piece grows by running its keys down to 0 one after another,
// starting with the last key and finishing with the first. A piece's progress is one 0-1
// value (0 at rest, 1 fully grown); every piece takes the same time however many keys it has.

// Weight for key `index` of `count` at overall progress `value`: the last key runs
// first over the opening 1/count of the range, the first key runs last.
export function keyWeight(value, index, count){
  var progress = value * count - (count - 1 - index);
  return 1 - Math.max(0, Math.min(1, progress));
}

// Writes piece.value into piece.mesh's shape key weights.
export function applyWeights(piece){
  var influences = piece.mesh.morphTargetInfluences;
  for (var index = 0; index < piece.count; index++){
    influences[index] = keyWeight(piece.value, index, piece.count);
  }
}

// Every mesh under root that has shape keys, as { mesh, count, value: 0 } at rest.
export function collectPieces(root){
  var pieces = [];
  root.traverse(function(object){
    if (!object.isMesh || !object.morphTargetInfluences || !object.morphTargetInfluences.length) return;
    var piece = { mesh: object, count: object.morphTargetInfluences.length, value: 0 };
    applyWeights(piece);
    pieces.push(piece);
  });
  return pieces;
}
