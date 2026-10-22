import * as THREE from 'three';

// Original, small paper model shared by the tree ornament and the reading stage.
export function createEnvelopeModel() {
  const group = new THREE.Group(); group.name = 'love-envelope';
  const paper = new THREE.MeshStandardMaterial({ color: '#f7ead5', roughness: .97, side: THREE.DoubleSide, emissive: '#f7ead5', emissiveIntensity: .15 });
  const folded = paper.clone(); folded.color.set('#efddc4');
  const edge = new THREE.LineBasicMaterial({ color: '#c9ad91' });
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.3, .075), paper); back.position.z = -.07; group.add(back);
  function panel(points, material, parent = group) {
    const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material); mesh.position.z = .055; parent.add(mesh);
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y, .003))), edge); mesh.add(outline);
    return mesh;
  }
  panel([[-1.8, 1.15], [.1, -.12], [-1.8, -1.15]], folded);
  panel([[1.8, 1.15], [1.8, -1.15], [-.1, -.12]], folded);
  panel([[-1.8, -1.15], [1.8, -1.15], [0, .25]], paper).position.z = .065;
  const flap = new THREE.Group(); flap.name = 'envelope-flap'; flap.position.set(0, 1.15, .075); group.add(flap);
  panel([[-1.8, 0], [0, -1.3], [1.8, 0]], paper, flap).position.z = 0;
  const wax = new THREE.MeshStandardMaterial({ color: '#b86e83', roughness: .65, metalness: .03, emissive: '#b86e83', emissiveIntensity: .12 });
  const seal = new THREE.Group(); seal.name = 'envelope-wax-seal'; seal.position.set(0, -.15, .11); group.add(seal);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(.23, .245, .055, 24), wax); disk.rotation.x = Math.PI / 2; seal.add(disk);
  const heart = new THREE.Shape(); heart.moveTo(0, -.1); heart.bezierCurveTo(-.3, .08, -.12, .28, 0, .12); heart.bezierCurveTo(.12, .28, .3, .08, 0, -.1);
  const stamp = new THREE.Mesh(new THREE.ShapeGeometry(heart), new THREE.MeshBasicMaterial({ color: '#e8bac1', side: THREE.DoubleSide })); stamp.position.set(0, -.035, .035); seal.add(stamp);
  return { group, flap, seal };
}

export function disposeEnvelopeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      materials.add(material); if (material.map) textures.add(material.map);
    }
  });
  textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
}
