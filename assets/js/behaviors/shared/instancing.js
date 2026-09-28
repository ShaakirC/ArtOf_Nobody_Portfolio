// Merges meshes that share a geometry and material into InstancedMeshes, so hundreds
// of identical static pieces draw in one call. Suits pieces that only move, rotate or
// scale; pieces with their own animations need to stay separate objects.

// Returns one record per original mesh: { mesh, index, position, quaternion, scale },
// with its transform relative to root.
export function instanceMeshes(root, THREE){
  root.updateMatrixWorld(true);
  var rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  var groups = new Map();
  root.traverse(function(object){
    if (!object.isMesh || Array.isArray(object.material)) return;
    var key = object.geometry.uuid + '/' + object.material.uuid;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(object);
  });

  var pieces = [];
  groups.forEach(function(meshes){
    var instanced = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Pieces change size, so a precomputed bounding volume would go stale; skip culling and pointer hits.
    instanced.frustumCulled = false;
    instanced.raycast = function(){};
    meshes.forEach(function(mesh, index){
      var piece = {
        mesh: instanced,
        index: index,
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        scale: new THREE.Vector3()
      };
      new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld)
        .decompose(piece.position, piece.quaternion, piece.scale);
      pieces.push(piece);
      mesh.parent.remove(mesh);
    });
    root.add(instanced);
  });
  return pieces;
}

// Writes a piece's transform with its scale multiplied by factor; set
// piece.mesh.instanceMatrix.needsUpdate afterwards.
export function writeInstance(piece, factor, THREE){
  var scratch = writeInstance.scratch || (writeInstance.scratch = { matrix: new THREE.Matrix4(), scale: new THREE.Vector3() });
  scratch.scale.copy(piece.scale).multiplyScalar(factor);
  scratch.matrix.compose(piece.position, piece.quaternion, scratch.scale);
  piece.mesh.setMatrixAt(piece.index, scratch.matrix);
}
