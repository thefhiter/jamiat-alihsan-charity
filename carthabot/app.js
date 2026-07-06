// CarthaBot 3D viewer — scene, differential-drive drawing simulation, UI
import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { buildCarthaBot, DIM } from './model.js';

/* ---------- scene ---------- */
const canvasHost = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151b);
scene.fog = new THREE.Fog(0x10151b, 900, 1800);

const camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
const CAM_HOME = new THREE.Vector3(260, 230, 340);
camera.position.copy(CAM_HOME);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 40, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 90;
controls.maxDistance = 1400;

scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x2a2f36, 0.85));
const sun = new THREE.DirectionalLight(0xfff2df, 1.6);
sun.position.set(220, 380, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -350; sun.shadow.camera.right = 350;
sun.shadow.camera.top = 350; sun.shadow.camera.bottom = -350;
sun.shadow.camera.far = 1200;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9fc2e8, 0.35);
fill.position.set(-260, 140, -200);
scene.add(fill);

// paper + grid
const paper = new THREE.Mesh(
  new THREE.CircleGeometry(420, 64),
  new THREE.MeshStandardMaterial({ color: 0xece7dc, roughness: 0.95 })
);
paper.rotation.x = -Math.PI / 2;
paper.receiveShadow = true;
scene.add(paper);
const grid = new THREE.PolarGridHelper(420, 12, 6, 64, 0xb9b2a4, 0xcfc9bb);
grid.position.y = 0.15;
grid.material.transparent = true; grid.material.opacity = 0.5;
scene.add(grid);

/* ---------- robot ---------- */
const bot = buildCarthaBot();
scene.add(bot.root);

/* ---------- ink trail ---------- */
const MAX_PTS = 30000;
const trailPos = new Float32Array(MAX_PTS * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
trailGeo.setDrawRange(0, 0);
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x1d3557 }));
trail.frustumCulled = false;
scene.add(trail);
let trailCount = 0;
let lastInk = null;
function ink(x, z) {
  if (trailCount >= MAX_PTS) return;
  if (lastInk && Math.hypot(x - lastInk.x, z - lastInk.z) < 0.8) return;
  trailPos[trailCount * 3] = x;
  trailPos[trailCount * 3 + 1] = 0.4;
  trailPos[trailCount * 3 + 2] = z;
  trailCount++;
  trailGeo.setDrawRange(0, trailCount);
  trailGeo.attributes.position.needsUpdate = true;
  lastInk = { x, z };
}
function clearTrail() { trailCount = 0; lastInk = null; trailGeo.setDrawRange(0, 0); }

/* ---------- differential-drive drawing simulation ---------- */
// The robot draws a 5-pointed star: turn-in-place at each vertex (pen at wheel-axis
// centre, so pivots don't smear the line), straight legs between vertices.
const SPEED = 90;          // mm/s straight-line speed
const TURN_RATE = 2.2;     // rad/s turn-in-place
const PEN_TIME = 0.45;     // s pen up/down travel

const star = [];
{
  const R = 200;
  for (let i = 0; i <= 5; i++) {
    const a = ((i * 2) % 5) * (Math.PI * 2 / 5) + Math.PI / 2;
    star.push({ x: R * Math.cos(a), z: R * Math.sin(a) });
  }
}
function buildActions() {
  const acts = [];
  let cur = { x: 0, z: 0 };
  const go = (p, penDown) => {
    acts.push({ type: 'turn', to: Math.atan2(p.x - cur.x, p.z - cur.z) });
    acts.push({ type: 'move', from: { ...cur }, to: { ...p }, penDown });
    cur = { ...p };
  };
  acts.push({ type: 'pen', down: false });
  go(star[0], false);
  acts.push({ type: 'pen', down: true });
  for (let i = 1; i <= 5; i++) go(star[i], true);
  acts.push({ type: 'pen', down: false });
  go({ x: 0, z: 0 }, false);
  acts.push({ type: 'wait', t: 2.0 });
  return acts;
}

const sim = {
  playing: false,
  actions: buildActions(),
  idx: 0,
  pose: { x: 0, z: 0, h: 0 },   // heading h: forward = (sin h, cos h)
  penDown: false,
  penT: 1,                      // 0 = down, 1 = up
  progress: 0,
};

function resetSim() {
  sim.idx = 0; sim.progress = 0;
  sim.pose = { x: 0, z: 0, h: 0 };
  sim.penDown = false; sim.penT = 1;
  bot.setPenLift(1);
  clearTrail();
  syncRobot();
}

function spinWheels(vL, vR, dt) {
  bot.wheels.L.rotation.x += (vL * dt) / DIM.wheelR;
  bot.wheels.R.rotation.x += (vR * dt) / DIM.wheelR;
}

function syncRobot() {
  bot.root.position.set(sim.pose.x, 0, sim.pose.z);
  bot.root.rotation.y = sim.pose.h;
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function stepSim(dt) {
  if (sim.idx >= sim.actions.length) { resetSim(); return; }
  const a = sim.actions[sim.idx];
  if (a.type === 'pen') {
    const dir = a.down ? -1 : 1;
    sim.penT = THREE.MathUtils.clamp(sim.penT + dir * dt / PEN_TIME, 0, 1);
    bot.setPenLift(sim.penT);
    if (sim.penT === (a.down ? 0 : 1)) { sim.penDown = a.down; sim.idx++; }
  } else if (a.type === 'turn') {
    const d = angDiff(a.to, sim.pose.h);
    const step = Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt);
    sim.pose.h += step;
    const w = step / dt || 0;
    spinWheels(w * DIM.track / 2, -w * DIM.track / 2, dt);
    if (Math.abs(angDiff(a.to, sim.pose.h)) < 0.005) { sim.pose.h = a.to; sim.idx++; }
  } else if (a.type === 'move') {
    const dx = a.to.x - a.from.x, dz = a.to.z - a.from.z;
    const len = Math.hypot(dx, dz);
    sim.progress += SPEED * dt;
    const t = Math.min(sim.progress / len, 1);
    sim.pose.x = a.from.x + dx * t;
    sim.pose.z = a.from.z + dz * t;
    spinWheels(SPEED, SPEED, dt);
    if (sim.penDown) ink(sim.pose.x, sim.pose.z);
    if (t >= 1) { sim.progress = 0; sim.idx++; }
  } else if (a.type === 'wait') {
    sim.progress += dt;
    if (sim.progress >= a.t) { sim.progress = 0; sim.idx++; }
  }
  syncRobot();
}

/* ---------- parts list + selection ---------- */
const partList = document.getElementById('part-list');
const infoTitle = document.getElementById('info-title');
const infoBody = document.getElementById('info-body');
let selectedId = null;
const highlight = new Map(); // mesh -> original emissive

function clearHighlight() {
  for (const [mesh, em] of highlight) mesh.material.emissive.setHex(em);
  highlight.clear();
}
function selectPart(id) {
  clearHighlight();
  document.querySelectorAll('#part-list li').forEach(li => li.classList.toggle('active', li.dataset.id === id));
  selectedId = id;
  const part = bot.parts.find(p => p.id === id);
  if (!part) { infoTitle.textContent = ''; infoBody.textContent = 'انقر على أي مكوّن في القائمة أو في المشهد لعرض تفاصيله.'; return; }
  infoTitle.textContent = `${part.nameAr} — ${part.nameEn}`;
  infoBody.textContent = part.descAr;
  part.object.traverse(o => {
    if (o.isMesh && !highlight.has(o)) {
      if (!o.material.emissive) return;
      o.material = o.material.clone();
      highlight.set(o, o.material.emissive.getHex());
      o.material.emissive.setHex(0x22d3ee);
      o.material.emissiveIntensity = 0.35;
    }
  });
}
for (const p of bot.parts) {
  const li = document.createElement('li');
  li.dataset.id = p.id;
  li.innerHTML = `<span>${p.nameAr}</span><small>${p.nameEn}</small>`;
  li.addEventListener('click', () => selectPart(selectedId === p.id ? null : p.id));
  partList.appendChild(li);
}

const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(bot.root, true);
  const hit = hits.find(h => h.object.userData.partId);
  if (hit) selectPart(hit.object.userData.partId);
});

/* ---------- toolbar ---------- */
const playBtn = document.getElementById('btn-play');
playBtn.addEventListener('click', () => {
  sim.playing = !sim.playing;
  playBtn.textContent = sim.playing ? '⏸ إيقاف الرسم' : '▶ تشغيل الرسم';
  playBtn.classList.toggle('primary', !sim.playing);
});
document.getElementById('btn-reset-draw').addEventListener('click', () => { resetSim(); });

const shellModes = ['ghost', 'solid', 'hidden'];
const shellLabels = { ghost: 'الغطاء: شفاف', solid: 'الغطاء: مصمت', hidden: 'الغطاء: مخفي' };
let shellIdx = 0;
const shellBtn = document.getElementById('btn-shell');
shellBtn.addEventListener('click', () => {
  shellIdx = (shellIdx + 1) % shellModes.length;
  bot.setShellMode(shellModes[shellIdx]);
  shellBtn.textContent = shellLabels[shellModes[shellIdx]];
});
bot.setShellMode('ghost');

const rotBtn = document.getElementById('btn-rotate');
rotBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 1.2;
  rotBtn.classList.toggle('on', controls.autoRotate);
});

document.getElementById('btn-camera').addEventListener('click', () => {
  camera.position.copy(CAM_HOME);
  controls.target.set(0, 40, 0);
});

const explode = document.getElementById('explode');
explode.addEventListener('input', () => {
  const k = explode.value / 100;
  bot.setExplode(k);
  if (k > 0.02 && sim.playing) playBtn.click(); // pause drawing while exploded
});

/* ---------- resize + loop ---------- */
function resize() {
  const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvasHost);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (sim.playing && explode.value < 2) stepSim(dt);
  controls.update();
  renderer.render(scene, camera);
});

selectPart(null);
resetSim();
