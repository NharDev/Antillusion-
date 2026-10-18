# three.js essentials (3D on the web)
tags: three threejs 3d webgl scene camera mesh light gltf model shader orbit animation ثلاثي ابعاد مجسم مجسمات نموذج كاميرا اضاءه مشهد

No-build setup (pin the version; modules must be served over http):
```html
<script type="importmap">{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/" } }</script>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101418);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200); camera.position.set(4, 3, 6);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(5, 8, 3); sun.castShadow = true; scene.add(sun);
const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x4f8cff, roughness: .4 })); cube.castShadow = true; scene.add(cube);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x20262e })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.5; floor.receiveShadow = true; scene.add(floor);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), .05); cube.rotation.y += dt; controls.update(); renderer.render(scene, camera); });
</script>
```
Body CSS: `margin:0; overflow:hidden`. With a bundler: `npm i three` and the same imports.

Key facts: right-handed, +Y up, camera looks down −Z; angles in radians; colours are sRGB hex; `MeshBasicMaterial` ignores lights, `MeshStandardMaterial` needs them. Move with `position`, rotate with `rotation`/`quaternion`, group with `THREE.Group`. Always multiply motion by delta time.

Models: `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`) → `loader.load(url, (g) => scene.add(g.scene))`; animations via `AnimationMixer(g.scene).clipAction(g.animations[0]).play()` and `mixer.update(dt)`. Textures: `new THREE.TextureLoader().load(url)` then `tex.colorSpace = THREE.SRGBColorSpace`; pixel art needs `magFilter = NearestFilter`.

Interaction: `Raycaster.setFromCamera(pointerNDC, camera).intersectObjects(list)`; first-person: `PointerLockControls` or manual yaw/pitch with `camera.rotation.order = "YXZ"`.

Performance: many identical objects → `InstancedMesh` (`setMatrixAt`, `instanceMatrix.needsUpdate = true`); custom geometry → `BufferGeometry` with typed arrays and an index; merge static meshes; share materials; `dispose()` geometries, materials and textures you remove; limit shadow-casting lights to one with a tight shadow camera; fog hides the far plane cheaply.

Common failures: black screen = no light with a lit material, camera inside the object, or object outside near/far; blank canvas with "Failed to resolve module specifier" = missing importmap or opened from file://; stretched picture = aspect not updated on resize; washed-out textures = missing colorSpace.
