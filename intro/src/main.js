import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './style.css';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Graph } from './graph.js';
import { buildScrollStory } from './scroll.js';

const canvas = document.querySelector('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04050d');
scene.fog = new THREE.FogExp2('#04050d', 0.0085);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

scene.add(new THREE.AmbientLight('#5b7ba6', 0.7));
const key = new THREE.PointLight('#7dd3fc', 900, 0, 1.8);
key.position.set(18, 24, 20);
scene.add(key);
const rim = new THREE.PointLight('#e879f9', 500, 0, 1.8);
rim.position.set(-22, -14, -18);
scene.add(rim);

// ---- starfield particles (slow ambient drift) ----
const starGeo = new THREE.BufferGeometry();
{
  const N = 900;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 240;
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: '#3c5a82', size: 0.35, transparent: true, opacity: 0.8, depthWrite: false })
);
scene.add(stars);

const graph = new Graph(scene);

// ---- post: bloom for the neon look ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.45, 0.22);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- camera rig: spherical orbit + animated state, all GSAP-scrubbed ----
export const rig = {
  radius: 70, theta: 0.4, phi: 1.25,
  tx: 0, ty: 0, tz: 0,
  fov: 55,
};
export const state = {
  idle: 1,            // idle bob amplitude multiplier
  globalOpacity: 1,   // whole graph fade
  cloudOpacity: 0.16, // background cloud (dim in hero, full after zoom-out)
  focusDim: 0,        // 1 = dim everything not highlighted
  ping: 0,            // searchNodes ping ring progress
  pingOpacity: 0,
  pingTarget: 'ada',
  bloom: 0.7,
  cameraPos: camera.position,
};

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth - 0.5) * 2;
  mouse.y = (e.clientY / innerHeight - 0.5) * 2;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();

  // smooth mouse parallax
  mouse.sx += (mouse.x - mouse.sx) * 0.04;
  mouse.sy += (mouse.y - mouse.sy) * 0.04;

  const theta = rig.theta + mouse.sx * 0.06 + Math.sin(t * 0.05) * 0.02;
  const phi = THREE.MathUtils.clamp(rig.phi + mouse.sy * 0.05, 0.15, Math.PI - 0.15);
  camera.position.set(
    rig.tx + rig.radius * Math.sin(phi) * Math.sin(theta),
    rig.ty + rig.radius * Math.cos(phi),
    rig.tz + rig.radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(rig.tx, rig.ty, rig.tz);
  if (camera.fov !== rig.fov) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }

  stars.rotation.y = t * 0.008;
  bloom.strength = state.bloom;
  graph.tick(t, state);
  composer.render();
  requestAnimationFrame(frame);
}

// hand camera + state + graph to the scroll choreography
buildScrollStory({ graph, rig, state, camera });
frame();
