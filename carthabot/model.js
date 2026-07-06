// CarthaBot — procedural 3D model (units: millimetres)
// Built from «CarthaBot Drive-System Upgrade — Technical Diagnostic» (recommended Encoder-DC build):
// 2× N20 gear motors w/ quadrature encoders, onboard RP2040 + DRV8833, 6V boost rail,
// smoothing caps (1000µF + 2×100µF), SG90 pen-lift servo, single 18650 cell, centre turtle-pen.
import * as THREE from 'three';

export const DIM = {
  chassisR: 60,
  chassisY0: 29,      // plate bottom
  chassisY1: 33,      // plate top
  wheelR: 22.5,
  tireW: 7,
  wheelX: 51,
  track: 102,
  shellR: 62,
};

const M = {
  plate:   new THREE.MeshStandardMaterial({ color: 0x37424e, roughness: 0.55, metalness: 0.25 }),
  shell:   new THREE.MeshStandardMaterial({ color: 0xa4373a, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  tire:    new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.9 }),
  hub:     new THREE.MeshStandardMaterial({ color: 0xe3b23c, roughness: 0.5, metalness: 0.3 }),
  steel:   new THREE.MeshStandardMaterial({ color: 0xb8bfc6, roughness: 0.3, metalness: 0.85 }),
  motorCan:new THREE.MeshStandardMaterial({ color: 0x8f979e, roughness: 0.35, metalness: 0.8 }),
  pcb:     new THREE.MeshStandardMaterial({ color: 0x14683c, roughness: 0.6 }),
  pcbBlue: new THREE.MeshStandardMaterial({ color: 0x1d4f8f, roughness: 0.6 }),
  chip:    new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0x2563a8, roughness: 0.65 }),
  white:   new THREE.MeshStandardMaterial({ color: 0xf1f2ef, roughness: 0.6 }),
  pen:     new THREE.MeshStandardMaterial({ color: 0xd96a29, roughness: 0.5 }),
  penCap:  new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.5 }),
  cell:    new THREE.MeshStandardMaterial({ color: 0x2e8b74, roughness: 0.45, metalness: 0.3 }),
  holder:  new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.8 }),
  capBig:  new THREE.MeshStandardMaterial({ color: 0x264653, roughness: 0.5 }),
  brass:   new THREE.MeshStandardMaterial({ color: 0xc9a15a, roughness: 0.4, metalness: 0.7 }),
  ball:    new THREE.MeshStandardMaterial({ color: 0xd7dde2, roughness: 0.15, metalness: 0.9 }),
  wireR:   new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 }),
  wireK:   new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.7 }),
  wireY:   new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.7 }),
};

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function cylY(r, h, mat, seg = 24) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); }
function cylX(r, h, mat, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, h, seg); g.rotateZ(Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

// Build the full robot. Returns { root, parts, wheels, setExplode, setPenLift, setShellMode }
export function buildCarthaBot() {
  const root = new THREE.Group();
  root.name = 'CarthaBot';
  const parts = [];

  function register(group, meta, explodeDir) {
    group.userData.basePos = group.position.clone();
    group.userData.explodeDir = new THREE.Vector3(...explodeDir);
    group.userData.partId = meta.id;
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.partId = meta.id; } });
    parts.push({ ...meta, object: group });
    root.add(group);
    return group;
  }

  /* ---------- chassis plate (disc with wheel slots + centre pen hole) ---------- */
  {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, DIM.chassisR, 0, Math.PI * 2, false);
    const penHole = new THREE.Path(); penHole.absarc(0, 0, 7, 0, Math.PI * 2, true); shape.holes.push(penHole);
    for (const s of [1, -1]) {
      const slot = new THREE.Path();
      const x0 = s * 44, x1 = s * 58, z0 = -11, z1 = 11;
      slot.moveTo(Math.min(x0, x1), z0); slot.lineTo(Math.max(x0, x1), z0);
      slot.lineTo(Math.max(x0, x1), z1); slot.lineTo(Math.min(x0, x1), z1); slot.closePath();
      shape.holes.push(slot);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: DIM.chassisY1 - DIM.chassisY0, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // extrude along +Y
    const plate = new THREE.Mesh(geo, M.plate);
    plate.position.y = DIM.chassisY1;
    const g = new THREE.Group(); g.add(plate);
    register(g, {
      id: 'chassis', nameAr: 'قاعدة الهيكل', nameEn: 'Chassis plate',
      descAr: 'القاعدة الدائرية للروبوت مع فتحتي العجلات وفتحة القلم المركزية. تُعاد استخدام حوامل المحركات الحالية كما هي.',
    }, [0, 0, 0]);
  }

  /* ---------- wheels + N20 encoder motors ---------- */
  const wheels = {};
  for (const s of [1, -1]) {
    const side = s === 1 ? 'R' : 'L';
    // wheel
    const wg = new THREE.Group();
    const tire = cylX(DIM.wheelR, DIM.tireW, M.tire, 36);
    const hub = cylX(DIM.wheelR - 6, DIM.tireW + 1.5, M.hub, 24);
    const spokes = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const sp = box(DIM.tireW + 2, 3, DIM.wheelR * 1.35, M.hub);
      sp.rotation.x = i * Math.PI / 2.5;
      spokes.add(sp);
    }
    wg.add(tire, hub, spokes);
    wg.position.set(s * DIM.wheelX, DIM.wheelR, 0);
    wheels[side] = wg;
    register(wg, {
      id: 'wheel' + side, nameAr: side === 'R' ? 'العجلة اليمنى' : 'العجلة اليسرى', nameEn: (side === 'R' ? 'Right' : 'Left') + ' drive wheel',
      descAr: 'عجلة القيادة — تُعاد استخدام العجلات الحالية على عمود محرك N20. نصف القطر 22.5مم، عرض المداس 7مم.',
    }, [s * 55, 0, 0]);

    // motor: gearbox + can + encoder PCB + magnetic disc + shaft
    const mg = new THREE.Group();
    const gearbox = box(10, 12, 12, M.steel); gearbox.position.x = s * 39;
    const can = cylX(6, 16, M.motorCan); can.position.x = s * 26;
    const encPcb = box(1.6, 14, 14, M.pcb); encPcb.position.x = s * 17.2;
    const disc = cylX(5, 2, M.chip); disc.position.x = s * 15.5;
    const shaft = cylX(1.5, 8, M.steel, 12); shaft.position.x = s * 47.5;
    mg.add(gearbox, can, encPcb, disc, shaft);
    mg.position.y = DIM.wheelR;
    register(mg, {
      id: 'motor' + side, nameAr: `محرك N20 مع مشفّر (${side === 'R' ? 'يمين' : 'يسار'})`, nameEn: 'N20 gear motor + encoder',
      descAr: 'محرك N20 مسنّن 6V مع مشفّر رباعي (quadrature) مدمج — قلب الترقية. يعمل بحلقة PID مغلقة عبر DRV8833، الوزن ~12غ فقط، ~12$.',
    }, [s * 26, 0, 0]);
  }

  /* ---------- main board: RP2040 + DRV8833 ---------- */
  {
    const g = new THREE.Group();
    const pcb = box(55, 1.6, 40, M.pcb); pcb.position.set(0, 41.8, 32);
    const rp2040 = box(7, 1, 7, M.chip); rp2040.position.set(-8, 43.1, 30);
    const drv = box(4, 1, 4, M.chip); drv.position.set(10, 43.1, 26);
    const usb = box(9, 3.2, 7.5, M.steel); usb.position.set(0, 44.2, 49);
    const hdr1 = box(45, 5, 2.5, M.chip); hdr1.position.set(0, 45, 15);
    const hdr2 = box(45, 5, 2.5, M.chip); hdr2.position.set(0, 45, 44);
    const xtal = box(3, 1, 2, M.steel); xtal.position.set(-1, 43, 34);
    g.add(pcb, rp2040, drv, usb, hdr1, hdr2, xtal);
    for (const [sx, sz] of [[-24, 15], [24, 15], [-24, 49], [24, 49]]) {
      const st = cylY(1.7, 8, M.brass, 10); st.position.set(sx, 37, sz); g.add(st);
    }
    register(g, {
      id: 'board', nameAr: 'اللوحة الرئيسية RP2040 + DRV8833', nameEn: 'Main board (RP2040 + DRV8833)',
      descAr: 'متحكم RP2040 يقرأ المشفّرين عبر PIO (4 منافذ GPIO) دون إشغال المعالج، ومشغّل المحركات DRV8833 يُعاد استخدامه كما هو عبر موصلي MOT1/MOT2.',
    }, [0, 55, 12]);
  }

  /* ---------- boost converter ---------- */
  {
    const g = new THREE.Group();
    const pcb = box(22, 1.6, 17, M.pcbBlue); pcb.position.set(-30, 33.8, -8);
    const ind = box(7, 4.5, 7, M.chip); ind.position.set(-33, 36.8, -10);
    const pot = box(4.5, 4, 4.5, M.pcbBlue); pot.position.set(-25, 36.5, -3);
    const potScrew = cylY(1.5, 1.2, M.brass, 10); potScrew.position.set(-25, 38.8, -3);
    g.add(pcb, ind, pot, potScrew);
    register(g, {
      id: 'boost', nameAr: 'محوّل رفع الجهد 6V', nameEn: 'Boost converter VBat→6V',
      descAr: 'محوّل رفع من جهد البطارية إلى 6V (تيار ≥2A) لتغذية سكة المحركات وسيرفو القلم. ~2$.',
    }, [-30, 42, -6]);
  }

  /* ---------- smoothing capacitors ---------- */
  {
    const g = new THREE.Group();
    const c1 = cylY(5, 16, M.capBig); c1.position.set(30, 41, -8);
    const c1top = cylY(5.02, 0.8, M.steel); c1top.position.set(30, 49.1, -8);
    const c2 = cylY(3, 11, M.capBig); c2.position.set(22, 38.5, -12);
    const c3 = cylY(3, 11, M.capBig); c3.position.set(22, 38.5, -3);
    g.add(c1, c1top, c2, c3);
    register(g, {
      id: 'caps', nameAr: 'مكثفات التنعيم', nameEn: 'Smoothing capacitors',
      descAr: 'مكثف 1000µF + مكثفان 100µF لتنعيم سكة تغذية المحركات ومنع هبوط الجهد عند الانطلاق.',
    }, [28, 40, -8]);
  }

  /* ---------- 18650 battery + holder ---------- */
  {
    const g = new THREE.Group();
    const holder = box(72, 14, 21, M.holder); holder.position.set(0, 39, -40);
    const inner = box(66, 14, 17, M.plate); inner.position.set(0, 41.2, -40);
    const cell = cylX(9.3, 65, M.cell, 28); cell.position.set(0, 42.5, -40);
    const tip = cylX(4.5, 2, M.steel, 16); tip.position.set(33.5, 42.5, -40);
    g.add(holder, inner, cell, tip);
    register(g, {
      id: 'battery', nameAr: 'بطارية 18650', nameEn: '18650 Li-ion cell',
      descAr: 'خلية ليثيوم 18650 واحدة — نظام الطاقة الحالي يكفي تماماً لخيار المحركات المشفّرة ويُعاد استخدامه بلا تغيير.',
    }, [0, 34, -42]);
  }

  /* ---------- pen-lift servo (SG90) ---------- */
  const servo = { horn: null };
  {
    const g = new THREE.Group();
    const body = box(12.5, 23, 23, M.plastic); body.position.set(0, 44.5, -22);
    const tab1 = box(12.5, 2.5, 4.5, M.plastic); tab1.position.set(0, 52, -36.5);
    const tab2 = box(12.5, 2.5, 4.5, M.plastic); tab2.position.set(0, 52, -7.5);
    const hubBase = cylY(5.8, 4, M.plastic, 20); hubBase.position.set(0, 58, -16);
    const hub = cylY(2.3, 3.5, M.white, 14); hub.position.set(0, 61, -16);
    // horn pivots at the hub, arm reaches the pen collar toward +Z
    const horn = new THREE.Group();
    horn.position.set(0, 61.5, -16);
    const arm = box(4, 1.8, 17, M.white); arm.position.set(0, 0, 8.5);
    const pin = cylY(1, 5, M.white, 10); pin.position.set(0, -2, 16);
    horn.add(arm, pin);
    servo.horn = horn;
    g.add(body, tab1, tab2, hubBase, hub, horn);
    register(g, {
      id: 'servo', nameAr: 'سيرفو رفع القلم SG90', nameEn: 'Pen-lift servo (SG90)',
      descAr: 'سيرفو صغير لحركة رفع/خفض القلم — المهمة الوحيدة المناسبة فعلاً لسيرفو 180°. يمكن إعادة استخدام MG995 بدلاً منه. يتغذى من سكة 6V.',
    }, [0, 46, -34]);
  }

  /* ---------- centre pen mechanism ---------- */
  const penLift = { group: null };
  {
    const g = new THREE.Group();
    // static: holder tube + guide posts
    const tube = cylY(6.5, 18, M.penCap, 20); tube.position.set(0, 42, 0);
    const guide1 = cylY(1.5, 45, M.steel, 10); guide1.position.set(11, 55, 0);
    const guide2 = cylY(1.5, 45, M.steel, 10); guide2.position.set(-11, 55, 0);
    g.add(tube, guide1, guide2);
    // moving: pen + slider collar (animated by setPenLift)
    const mv = new THREE.Group();
    const pen = cylY(4, 88, M.pen, 20); pen.position.set(0, 50, 0);
    const tipCone = new THREE.Mesh(new THREE.ConeGeometry(4, 6, 20), M.penCap);
    tipCone.rotation.x = Math.PI; tipCone.position.set(0, 3, 0);
    const cap = cylY(4.3, 6, M.penCap, 20); cap.position.set(0, 91, 0);
    const collar = box(28, 7, 9, M.penCap); collar.position.set(0, 62, 0);
    const collarRing = cylY(5.4, 7.5, M.penCap, 16); collarRing.position.set(0, 62, 0);
    mv.add(pen, tipCone, cap, collar, collarRing);
    mv.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    penLift.group = mv;
    g.add(mv);
    register(g, {
      id: 'pen', nameAr: 'آلية القلم المركزية', nameEn: 'Centre turtle-pen mechanism',
      descAr: 'القلم في مركز محور العجلتين تماماً، فيدور الروبوت حول نقطة الرسم نفسها دون تشويه الخط. ينزلق على عمودين مصقولين ويرفعه ذراع السيرفو.',
    }, [0, 72, 22]);
  }

  /* ---------- caster balls (front + rear) ---------- */
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    const z = s * 46;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(5, 7.5, 17, 20), M.holder);
    housing.position.set(0, 20.5, z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 16), M.ball);
    ball.position.set(0, 6, z);
    g.add(housing, ball);
    register(g, {
      id: 'caster' + (s === 1 ? 'F' : 'B'), nameAr: s === 1 ? 'كرة التوازن الأمامية' : 'كرة التوازن الخلفية', nameEn: (s === 1 ? 'Front' : 'Rear') + ' caster ball',
      descAr: 'كرة توازن حرة الدوران تحمل الهيكل مع العجلتين وتحافظ على استواء القلم مع سطح الرسم.',
    }, [0, -26, s * 22]);
  }

  /* ---------- top shell (turtle dome) ---------- */
  const shellRef = {};
  {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(DIM.shellR, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.shell);
    dome.scale.y = 0.85;
    dome.position.y = DIM.chassisY1;
    dome.castShadow = false;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(DIM.shellR, 1.8, 10, 48), M.hub);
    rim.rotation.x = Math.PI / 2; rim.position.y = DIM.chassisY1;
    g.add(dome, rim);
    shellRef.dome = dome;
    register(g, {
      id: 'shell', nameAr: 'الغطاء العلوي (درع السلحفاة)', nameEn: 'Top shell dome',
      descAr: 'درع علوي بلون قرطاجي يحمي الإلكترونيات، مع حافة ذهبية. اضغط زر «الغطاء» للتبديل بين شفاف / مصمت / مخفي.',
    }, [0, 95, 0]);
  }

  /* ---------- wiring (not a listed part; fades out on explode) ---------- */
  const wires = new THREE.Group();
  function wire(pts, mat) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    const m = mat.clone(); m.transparent = true;
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.8, 6), m);
    mesh.castShadow = false;
    wires.add(mesh);
  }
  wire([[18, 42.5, -34], [24, 40, -18], [24, 41, 12]], M.wireR);            // battery → board
  wire([[14, 42.5, -34], [20, 38, -16], [20, 41, 12]], M.wireK);
  wire([[46, 26, 6], [34, 34, 10], [24, 41, 14]], M.wireY);                 // R encoder → board
  wire([[-46, 26, 6], [-34, 34, 10], [-24, 41, 14]], M.wireY);              // L encoder → board
  wire([[-5, 50, -22], [-12, 44, -4], [-14, 41, 12]], M.wireR);             // servo → board
  root.add(wires);

  /* ---------- control API ---------- */
  function setExplode(k) {
    for (const p of parts) {
      const u = p.object.userData;
      p.object.position.copy(u.basePos).addScaledVector(u.explodeDir, k);
    }
    wires.children.forEach(w => { w.material.opacity = Math.max(0, 1 - k * 3); w.visible = w.material.opacity > 0.02; });
  }

  // t: 0 = pen down (tip on paper), 1 = pen up (+9 mm)
  function setPenLift(t) {
    penLift.group.position.y = 9 * t;
    servo.horn.rotation.x = -0.5 * t;
  }

  function setShellMode(mode) { // 'ghost' | 'solid' | 'hidden'
    if (mode === 'hidden') { shellRef.dome.parent.visible = false; return; }
    shellRef.dome.parent.visible = true;
    shellRef.dome.material.opacity = mode === 'solid' ? 1 : 0.35;
    shellRef.dome.material.transparent = mode !== 'solid';
    shellRef.dome.material.needsUpdate = true;
  }

  setPenLift(1);
  return { root, parts, wheels, setExplode, setPenLift, setShellMode };
}
