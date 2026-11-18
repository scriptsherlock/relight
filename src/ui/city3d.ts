// The open-world hub in 3D (three.js). Same rules as the flat map in
// cityWorld.ts (movement, collisions, gates), drawn as a living neon city:
// lit windows, billboards, people, talking locals, cars, drones and steam.
// Loaded on demand so the title screen stays fast.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CityWorld, ROADS, WORLD, rng, zoneOf, type Building, type GateId, type GateInfo } from './cityWorld';

const ADS: Record<GateId, string[]> = {
  docks: ['KILO COURIERS', 'FRESH BYTES DAILY', 'DOCK 9 CRANES'],
  loops: ['LOOP LINE: REPEAT YOURSELF!', 'DÉJÀ VU CAFÉ', 'AGAIN & AGAIN BAKERY'],
  spires: ['IF RAIN: UMBRELLA', 'SIGNAL STRONG', 'WHILE YOU WAIT: TEA'],
  arcade: ['INSERT COIN', 'HIGH SCORE: YOU?', 'GAME ON'],
  foundry: ['DEF YOUR FUTURE()', 'MADE TO ORDER', 'NEW COMMANDS DAILY'],
  workshop: ['BUILD YOUR OWN', 'MAKE. TEST. SHARE.'],
};

/** What the local by each gate says: while locked, open, and fully lit. */
const TALK: Record<GateId, [string, string, string]> = {
  docks: ['The cranes stopped when the lights went out.', 'The cranes stopped when the lights went out. Can Kilo help?', 'Ships are coming in again. Nice work, Patcher!'],
  loops: ['Loop Line? Same dark street, over and over…', 'Everything here happens again and again. Spot the pattern!', 'Round and round, and all lit up. Lovely.'],
  spires: ['The Spires’ signal is scrambled. Nobody can see a thing.', 'Up here you can’t see the whole map. Look before you move!', 'Signal’s crystal clear now. Thanks, Patcher.'],
  arcade: ['INSERT COIN… oh. It’s all switched off.', 'Psst. Want to make your own game instead of playing one?', 'Your game’s got a queue round the block!'],
  foundry: ['The Foundry made every command in the city. Now it’s cold.', 'Teach Kilo a new command, and it never forgets it.', 'The furnaces are roaring. Every light in Nova Grid is on!'],
  workshop: ['Build a level, prove it can be beaten, then share the link.', 'Build a level, prove it can be beaten, then share the link.', 'Build a level, prove it can be beaten, then share the link.'],
};

const JACKETS = ['#FF5FD2', '#3FE3D1', '#FFBC3D', '#9BFF5A', '#5AA9FF', '#C9B6FF', '#FF8A5B', '#F4F8FF'];

const DISPLAY = '"Saira Stencil One", system-ui, sans-serif';
const BODY = '"Atkinson Hyperlegible", system-ui, sans-serif';

function canvasTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => {
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    paint(ctx);
    t.needsUpdate = true;
  };
  redraw();
  return { texture: t, redraw };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

interface Person {
  road: number;
  side: number;
  t: number;
  speed: number;
  need: number;
  phase: number;
}

interface Car {
  group: THREE.Group;
  lane: { x0: number; y0: number; x1: number; y1: number };
  t: number;
  speed: number;
}

interface GateView {
  info: GateInfo;
  group: THREE.Group;
  plaza: THREE.MeshBasicMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  portalMat: THREE.MeshBasicMaterial;
  core: THREE.MeshBasicMaterial;
  arc: THREE.Mesh | null;
  beacon: THREE.Mesh;
  label: { texture: THREE.CanvasTexture; redraw: () => void };
  labelSprite: THREE.Sprite;
  glitch: THREE.Mesh[];
  pick: THREE.Object3D[];
  talker: THREE.Group;
  speech: THREE.Sprite;
  speechTex: { texture: THREE.CanvasTexture; redraw: () => void };
  line: string;
}

interface BuildingView {
  b: Building;
  height: number;
  side: THREE.MeshLambertMaterial;
  roof: THREE.MeshLambertMaterial;
  fade: number;
}

export class CityWorld3D extends CityWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 10, 5000);
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private snapped = false;
  private kilo = new THREE.Group();
  private kiloYaw = 0;
  private bviews: BuildingView[] = [];
  private gviews: GateView[] = [];
  private people: Person[] = [];
  private bodies!: THREE.InstancedMesh;
  private heads!: THREE.InstancedMesh;
  private cars: Car[] = [];
  private drones: THREE.Mesh[] = [];
  private steam: THREE.Sprite[] = [];
  private sparkMesh!: THREE.InstancedMesh;
  private sparkState: { road: number; t: number; speed: number; off: number }[] = [];
  private ads: { mat: THREE.MeshBasicMaterial; zone: GateId; seed: number }[] = [];
  private water!: THREE.MeshBasicMaterial;
  private textRedraws: (() => void)[] = [];
  private sig = '';
  private last = 0;
  private frameTimes: number[] = [];
  private quality = 1;
  private glitchTick = 0;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Object3D();
  private miniCtx: CanvasRenderingContext2D | null;
  /** For tests: smoothed frames per second and current render scale. */
  stats = { fps: 0, quality: 1, drawCalls: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    private mini: HTMLCanvasElement | null,
  ) {
    super(canvas, false);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#070a11');
    this.miniCtx = mini?.getContext('2d') ?? null;
    this.scene.fog = new THREE.Fog('#070a11', 1100, 2600);
    this.build();
    // Text is drawn onto canvases; redraw once the display fonts have loaded.
    void document.fonts?.ready.then(() => {
      this.textRedraws.forEach((f) => f());
      this.sig = '';
    });
  }

  // ------------------------------------------------------------ building

  private build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#c4c9ff', '#14161f', 1.0));
    const moon = new THREE.DirectionalLight('#ffffff', 0.85);
    moon.position.set(-600, 1200, 900);
    s.add(moon);

    // Ground with a faint grid, wider than the city so its edge sits in fog.
    const grid = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#0a0e18';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(90, 120, 190, 0.16)';
      ctx.strokeRect(0.5, 0.5, 127, 127);
    });
    grid.texture.wrapS = grid.texture.wrapT = THREE.RepeatWrapping;
    grid.texture.repeat.set((WORLD.w + 2000) / 60, (WORLD.h + 2000) / 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.w + 2000, WORLD.h + 2000), new THREE.MeshLambertMaterial({ map: grid.texture }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(WORLD.w / 2, 0, WORLD.h / 2);
    s.add(ground);

    // Water along the Docks.
    this.water = new THREE.MeshBasicMaterial({ color: '#06131c' });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1140, 400), this.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(570, 0.4, 1380 + 200);
    s.add(water);

    // Roads, kerbs and dashed centre lines.
    const dash = canvasTexture(64, 8, (ctx) => {
      ctx.fillStyle = 'rgba(190, 200, 220, 0.5)';
      ctx.fillRect(0, 2, 34, 4);
    });
    dash.texture.wrapS = THREE.RepeatWrapping;
    const roadMat = new THREE.MeshLambertMaterial({ color: '#111725' });
    const kerbMat = new THREE.MeshLambertMaterial({ color: '#1d2536' });
    for (const r of ROADS) {
      const horiz = r.w > r.h;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(r.x + r.w / 2, 0.5, r.y + r.h / 2);
      s.add(road);
      const len = horiz ? r.w : r.h;
      const t = dash.texture.clone();
      t.repeat.set(len / 64, 1);
      t.needsUpdate = true;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      line.rotation.x = -Math.PI / 2;
      if (!horiz) line.rotation.z = Math.PI / 2;
      line.position.set(r.x + r.w / 2, 0.8, r.y + r.h / 2);
      s.add(line);
      for (const side of [-1, 1]) {
        const kerb = new THREE.Mesh(new THREE.BoxGeometry(horiz ? r.w : 9, 2, horiz ? 9 : r.h), kerbMat);
        kerb.position.set(horiz ? r.x + r.w / 2 : r.x + r.w / 2 + side * (r.w / 2 + 4.5), 1, horiz ? r.y + r.h / 2 + side * (r.h / 2 + 4.5) : r.y + r.h / 2);
        s.add(kerb);
      }
    }

    this.buildBuildings();
    this.buildGates();
    this.buildKilo();
    this.buildPeople();
    this.buildCars();
    this.buildDrones();
    this.buildSteam();
    this.buildSparks();
  }

  private windowTexture(seed: number) {
    const r = rng(seed);
    const { texture } = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const v = r();
          if (v < 0.42) continue;
          ctx.fillStyle = v > 0.92 ? '#ffffff' : `rgba(255,255,255,${0.45 + v * 0.4})`;
          ctx.fillRect(x * 16 + 4, y * 16 + 5, 9, 7);
        }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  }

  private buildBuildings() {
    const windows = [11, 23, 37].map((n) => this.windowTexture(n));
    const adPicks: Building[] = [];
    for (const b of this.buildings) {
      const r = rng(b.seed);
      const height =
        b.zone === 'spires' ? 150 + r() * 190 : b.zone === 'workshop' ? 40 + r() * 50 : b.zone === 'foundry' ? 80 + r() * 90 : 55 + r() * 125;
      const geo = new THREE.BoxGeometry(b.w, height, b.h);
      // Scale window UVs to each face's real size so windows stay square.
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const faces = [b.h, b.h, b.w, b.w, b.w, b.w];
      const ou = r();
      for (let f = 0; f < 6; f++)
        for (let k = 0; k < 4; k++) {
          const i = f * 4 + k;
          uv.setXY(i, uv.getX(i) * (faces[f] / 40) + ou, uv.getY(i) * (height / 30));
        }
      const side = new THREE.MeshLambertMaterial({ color: '#1a2133', emissiveMap: windows[b.seed % 3], emissive: '#000000', transparent: true });
      const roof = new THREE.MeshLambertMaterial({ color: '#121826', emissive: '#000000', transparent: true });
      const mesh = new THREE.Mesh(geo, [side, side, roof, roof, side, side]);
      mesh.position.set(b.x + b.w / 2, height / 2, b.y + b.h / 2);
      this.scene.add(mesh);
      this.bviews.push({ b, height, side, roof, fade: 1 });
      if (b.seed % 4 === 0 && b.w > 80) adPicks.push(b);
    }
    // Billboards on the roofs, facing the camera.
    const count: Record<string, number> = {};
    for (const b of adPicks) {
      const list = ADS[b.zone];
      const n = (count[b.zone] = (count[b.zone] ?? 0) + 1);
      const text = list[(n - 1) % list.length];
      const color = this.gateColor(b.zone);
      const tex = canvasTexture(512, 192, (ctx) => {
        ctx.fillStyle = '#0b0f1c';
        ctx.fillRect(0, 0, 512, 192);
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 492, 172);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let size = 70;
        ctx.font = `400 ${size}px ${DISPLAY}`;
        while (ctx.measureText(text).width > 450 && size > 26) ctx.font = `400 ${(size -= 4)}px ${DISPLAY}`;
        ctx.fillText(text, 256, 100);
      });
      this.textRedraws.push(tex.redraw);
      const view = this.bviews.find((v) => v.b === b)!;
      const w = Math.min(b.w - 6, 130);
      const mat = new THREE.MeshBasicMaterial({ map: tex.texture, color: '#30364a', toneMapped: false });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), mat);
      board.position.set(b.x + b.w / 2, view.height + w * 0.19 + 6, b.y + b.h - 6);
      this.scene.add(board);
      this.ads.push({ mat, zone: b.zone, seed: b.seed });
    }
  }

  private gateColor(id: GateId) {
    return { docks: '#3FE3D1', loops: '#FF5FD2', spires: '#FFBC3D', arcade: '#9BFF5A', foundry: '#5AA9FF', workshop: '#C9B6FF' }[id];
  }

  private buildGates() {
    const ringGeo = new THREE.RingGeometry(116, 122, 72);
    const glitchGeo = new THREE.BoxGeometry(40, 3, 3);
    const glitchMat = new THREE.MeshBasicMaterial({ color: '#FF3B6B', transparent: true, opacity: 0.7, toneMapped: false });
    for (const id of ['docks', 'loops', 'spires', 'arcade', 'foundry', 'workshop'] as GateId[]) {
      const info: GateInfo = { id, name: '', color: this.gateColor(id), x: 0, y: 0, lit: 0, locked: false, beacon: false };
      const group = new THREE.Group();
      const plaza = new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.08, depthWrite: false });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(120, 56), plaza);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.9;
      const ringMat = new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.55, depthWrite: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 1;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(30, 38, 10, 32), new THREE.MeshLambertMaterial({ color: '#1a2133' }));
      pedestal.position.y = 5;
      const portalMat = new THREE.MeshBasicMaterial({ color: info.color, toneMapped: false });
      const portal = new THREE.Mesh(new THREE.TorusGeometry(44, 5, 14, 64), portalMat);
      portal.position.y = 62;
      const core = new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
      const coreMesh = new THREE.Mesh(new THREE.CircleGeometry(38, 48), core);
      coreMesh.position.y = 62;
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(16, 16, 900, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      beacon.position.y = 450;
      const label = canvasTexture(512, 176, (ctx) => this.paintLabel(ctx, info));
      this.textRedraws.push(label.redraw);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: label.texture, depthTest: false, fog: false, toneMapped: false }));
      sprite.scale.set(210, 72, 1);
      sprite.position.y = 150;
      sprite.renderOrder = 5;
      const glitch: THREE.Mesh[] = [];
      for (let i = 0; i < 14; i++) {
        const g = new THREE.Mesh(glitchGeo, glitchMat);
        g.visible = false;
        glitch.push(g);
        group.add(g);
      }
      // A local who talks when Kilo comes close.
      const talker = this.makePerson(JACKETS[(id.length * 3) % JACKETS.length], 1.6);
      talker.position.set(118, 0, 96);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(5), new THREE.MeshBasicMaterial({ color: info.color, toneMapped: false }));
      marker.position.y = 52;
      marker.name = 'marker';
      talker.add(marker);
      const speechTex = canvasTexture(512, 200, () => undefined);
      const speech = new THREE.Sprite(new THREE.SpriteMaterial({ map: speechTex.texture, depthTest: false, fog: false, toneMapped: false }));
      speech.scale.set(200, 78, 1);
      speech.position.set(118, 120, 96);
      speech.renderOrder = 6;
      speech.visible = false;
      group.add(disc, ring, pedestal, portal, coreMesh, beacon, sprite, talker, speech);
      this.scene.add(group);
      this.gviews.push({
        info, group, plaza, ring, ringMat, portalMat, core, arc: null, beacon, label, labelSprite: sprite, glitch, pick: [disc, pedestal, portal, coreMesh], talker, speech, speechTex, line: '',
      });
    }
  }

  private paintLabel(ctx: CanvasRenderingContext2D, g: GateInfo) {
    const col = g.locked ? '#7a8399' : g.color;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(7, 10, 17, 0.72)';
    ctx.beginPath();
    ctx.roundRect(36, 18, 440, 140, 24);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = `400 50px ${DISPLAY}`;
    ctx.fillStyle = g.locked ? '#9aa3b8' : '#ffffff';
    ctx.fillText(g.name.toUpperCase(), 256, 86, 410);
    ctx.font = `700 30px "IBM Plex Mono", monospace`;
    ctx.fillStyle = col;
    ctx.fillText(g.locked ? 'LOCKED' : g.id === 'workshop' ? 'BUILD YOUR OWN' : `${Math.round(g.lit * 100)}% POWER`, 256, 134);
  }

  private paintSpeech(ctx: CanvasRenderingContext2D, text: string, color: string) {
    ctx.clearRect(0, 0, 512, 200);
    ctx.font = `700 30px ${BODY}`;
    const lines = wrap(ctx, text, 440).slice(0, 3);
    const h = 40 + lines.length * 38;
    ctx.fillStyle = '#f4f8ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(12, 8, 488, h, 22);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(240, 8 + h);
    ctx.lineTo(256, 8 + h + 22);
    ctx.lineTo(276, 8 + h);
    ctx.fill();
    ctx.fillStyle = '#0c1220';
    ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, 256, 52 + i * 38));
  }

  private makePerson(jacket: string, scale = 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(4, 10, 4, 10), new THREE.MeshLambertMaterial({ color: jacket }));
    body.position.y = 10;
    const head = new THREE.Mesh(new THREE.SphereGeometry(4.2, 14, 10), new THREE.MeshLambertMaterial({ color: '#f1d3b8' }));
    head.position.y = 22;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 1.6), new THREE.MeshBasicMaterial({ color: jacket, toneMapped: false }));
    visor.position.set(0, 22.6, 3.8);
    g.add(body, head, visor);
    g.scale.setScalar(scale);
    return g;
  }

  private buildKilo() {
    const k = this.kilo;
    const body = new THREE.Mesh(new RoundedBoxGeometry(30, 30, 30, 4, 8), new THREE.MeshLambertMaterial({ color: '#f4f8ff', emissive: '#6a7894' }));
    const visor = new THREE.Mesh(new RoundedBoxGeometry(24, 12, 4, 2, 3), new THREE.MeshBasicMaterial({ color: '#0c1220' }));
    visor.position.set(0, 2, 14);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#3FE3D1', toneMapped: false });
    for (const x of [-5, 5]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), eyeMat);
      eye.scale.set(0.9, 1.25, 0.5);
      eye.position.set(x, 2, 16.2);
      k.add(eye);
    }
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 9, 6), new THREE.MeshLambertMaterial({ color: '#a9bad1' }));
    stalk.position.set(3, 19, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), eyeMat);
    tip.position.set(3, 24, 0);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(17, 24), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.5, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -21;
    const cone = new THREE.Mesh(
      new THREE.CircleGeometry(150, 24, -Math.PI / 2 - 0.45, 0.9),
      new THREE.MeshBasicMaterial({ color: '#3FE3D1', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.y = -20.5;
    k.add(body, visor, stalk, tip, shadow, cone);
    this.scene.add(k);
  }

  private buildPeople() {
    const r = rng(99);
    const n = 110;
    for (let i = 0; i < n; i++) this.people.push({ road: Math.floor(r() * ROADS.length), side: r() < 0.5 ? -1 : 1, t: r(), speed: (14 + r() * 22) * (r() < 0.5 ? -1 : 1), need: r() * 0.95, phase: r() * 10 });
    this.bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(3.6, 9, 3, 8), new THREE.MeshBasicMaterial(), n);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(3.8, 10, 8), new THREE.MeshLambertMaterial({ color: '#f1d3b8' }), n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) this.bodies.setColorAt(i, c.set(JACKETS[i % JACKETS.length]));
    this.scene.add(this.bodies, this.heads);
  }

  private buildCars() {
    const r = rng(5);
    const lanes: Car['lane'][] = [];
    for (const rd of ROADS) {
      const horiz = rd.w > rd.h;
      const off = rd.h > 80 || rd.w > 80 ? 22 : 12;
      if (horiz) {
        const y = rd.y + rd.h / 2;
        lanes.push({ x0: rd.x, y0: y + off, x1: rd.x + rd.w, y1: y + off }, { x0: rd.x + rd.w, y0: y - off, x1: rd.x, y1: y - off });
      } else {
        const x = rd.x + rd.w / 2;
        lanes.push({ x0: x - off, y0: rd.y, x1: x - off, y1: rd.y + rd.h }, { x0: x + off, y0: rd.y + rd.h, x1: x + off, y1: rd.y });
      }
    }
    const head = new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false });
    const tail = new THREE.MeshBasicMaterial({ color: '#ff3b5c', toneMapped: false });
    const cabin = new THREE.MeshLambertMaterial({ color: '#33405c' });
    const colours = ['#3FE3D1', '#FF5FD2', '#FFBC3D', '#e8eef8', '#5AA9FF', '#9BFF5A'];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(14, 8, 28, 2, 2.5), new THREE.MeshLambertMaterial({ color: colours[i % colours.length] }));
      body.position.y = 6;
      const top = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 13), cabin);
      top.position.set(0, 12, -1);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(11, 2, 1), head);
      hl.position.set(0, 7, 14.2);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(11, 2, 1), tail);
      tl.position.set(0, 7, -14.2);
      g.add(body, top, hl, tl);
      this.scene.add(g);
      this.cars.push({ group: g, lane: lanes[i % lanes.length], t: r(), speed: 70 + r() * 60 });
    }
  }

  private buildDrones() {
    const mat = new THREE.MeshBasicMaterial({ color: '#FFBC3D', toneMapped: false });
    for (let i = 0; i < 7; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 10), mat);
      this.scene.add(d);
      this.drones.push(d);
    }
  }

  private buildSteam() {
    const puff = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(220,230,255,0.85)');
      g.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    const stacks = [
      [-150, -115],
      [150, -115],
      [-150, 60],
    ];
    const gate = { x: 1200, y: 170 };
    const stackMat = new THREE.MeshLambertMaterial({ color: '#2a3247' });
    stacks.forEach(([dx, dy], si) => {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 70, 14), stackMat);
      stack.position.set(gate.x + dx, 35, gate.y + dy);
      this.scene.add(stack);
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff.texture, transparent: true, depthWrite: false, opacity: 0.5 }));
        sp.userData = { x: gate.x + dx, z: gate.y + dy, t: (i / 6 + si * 0.13) % 1 };
        this.scene.add(sp);
        this.steam.push(sp);
      }
    });
  }

  private buildSparks() {
    const r = rng(7);
    const n = 60;
    for (let i = 0; i < n; i++) this.sparkState.push({ road: Math.floor(r() * ROADS.length), t: r(), speed: 0.02 + r() * 0.05, off: r() });
    this.sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    this.scene.add(this.sparkMesh);
  }

  // ------------------------------------------------------------ running

  override resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(dpr * this.quality);
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(1, rect.height);
    this.camera.updateProjectionMatrix();
    if (this.mini) {
      const mr = this.mini.getBoundingClientRect();
      const md = Math.min(window.devicePixelRatio || 1, 2);
      this.mini.width = Math.round(mr.width * md);
      this.mini.height = Math.round(mr.height * md);
      this.miniCtx?.setTransform(md, 0, 0, md, 0, 0);
    }
  }

  override click(sx: number, sy: number) {
    const ndc = new THREE.Vector2((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const gv of this.gviews) {
      if (this.raycaster.intersectObjects(gv.pick, false).length) {
        this.clickWorld(gv.info.x, gv.info.y);
        return;
      }
    }
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.ground, hit)) this.clickWorld(hit.x, hit.z, 130);
  }

  /** Apply gate state (lit, locked, beacon) to everything that depends on it. */
  private applyGates() {
    for (const gv of this.gviews) {
      const g = this.gates.find((q) => q.id === gv.info.id);
      if (!g) {
        gv.group.visible = false;
        continue;
      }
      gv.group.visible = true;
      Object.assign(gv.info, g);
      gv.group.position.set(g.x, 0, g.y);
      const col = g.locked ? '#4a5266' : g.color;
      gv.plaza.color.set(col);
      gv.ringMat.color.set(col);
      gv.portalMat.color.set(col);
      gv.core.color.set(col);
      gv.beacon.visible = g.beacon;
      if (gv.arc) {
        gv.group.remove(gv.arc);
        gv.arc.geometry.dispose();
        gv.arc = null;
      }
      if (g.lit > 0) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(56, 2.6, 8, 72, Math.PI * 2 * g.lit), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
        arc.position.y = 62;
        arc.rotation.z = Math.PI / 2;
        arc.scale.x = -1;
        gv.group.add(arc);
        gv.arc = arc;
      }
      gv.label.redraw();
      gv.talker.visible = true;
      gv.line = TALK[g.id][g.locked ? 0 : g.lit >= 1 ? 2 : 1];
      gv.speechTex.redraw = () => this.paintSpeech((gv.speechTex.texture.image as HTMLCanvasElement).getContext('2d')!, gv.line, col);
      gv.speechTex.redraw();
      gv.speechTex.texture.needsUpdate = true;
    }
    for (const v of this.bviews) {
      const g = this.gate(v.b.zone);
      const lit = !!g && !g.locked && g.lit > 0;
      v.side.emissive.set(lit ? g!.color : '#FF3B6B');
      v.side.emissiveIntensity = lit ? 0.35 + g!.lit * 0.65 : 0.08;
      v.roof.emissive.set(lit ? g!.color : '#000000');
      v.roof.emissiveIntensity = lit ? 0.04 : 0;
    }
    for (const a of this.ads) {
      const g = this.gate(a.zone);
      a.mat.color.set(g && !g.locked && g.lit > 0 ? '#ffffff' : '#3a2433');
    }
  }

  override draw(now: number) {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    const sig = this.gates.map((g) => `${g.id}${g.lit}${g.locked}${g.beacon}${g.x}`).join('|');
    if (sig !== this.sig) {
      this.sig = sig;
      this.applyGates();
    }
    const bot = this.bot;
    const zoneLit = (x: number, y: number) => {
      const g = this.gate(zoneOf(x, y));
      return g && !g.locked ? g.lit : -1;
    };

    // Kilo
    const moving = Math.hypot(bot.vx, bot.vy) > 20;
    const yaw = Math.atan2(Math.cos(bot.dir), Math.sin(bot.dir));
    let dy = yaw - this.kiloYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.kiloYaw += dy * Math.min(1, dt * 12);
    this.kilo.rotation.y = this.kiloYaw;
    this.kilo.position.set(bot.x, 22 + Math.sin(now / 250) * 2, bot.y);
    this.kilo.rotation.z = moving ? Math.sin(now / 90) * 0.03 : 0;

    // Camera: tilted, following Kilo; further back on tall or narrow screens.
    const aspect = this.W / Math.max(1, this.H);
    const dist = aspect < 1 ? 1.45 : aspect < 1.4 ? 1.15 : 1;
    const want = new THREE.Vector3(bot.x, 600 * dist, bot.y + 430 * dist);
    const look = new THREE.Vector3(bot.x, 0, bot.y - 30);
    const k = this.snapped ? 1 - Math.exp(-dt * 5) : 1;
    this.snapped = true;
    this.camPos.lerp(want, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Buildings: fade the ones between the camera and Kilo; glitch-flicker dark districts.
    const flick = Math.sin(now / 70) > 0.75 ? 0.25 : 0.06;
    for (const v of this.bviews) {
      const { b } = v;
      const south = b.y - bot.y;
      const block = south > -30 && south < v.height / 1.4 + 40 && bot.x > b.x - 70 && bot.x < b.x + b.w + 70;
      v.fade += ((block ? 0.18 : 1) - v.fade) * Math.min(1, dt * 8);
      v.side.opacity = v.roof.opacity = v.fade;
      v.side.depthWrite = v.roof.depthWrite = v.fade > 0.95;
      const g = this.gate(b.zone);
      if (g && (g.locked || g.lit === 0)) v.side.emissiveIntensity = (b.seed % 7 === 0 ? flick : 0.06);
    }

    // Gates
    for (const gv of this.gviews) {
      const g = gv.info;
      gv.ring.rotation.z = now / 4000;
      gv.core.opacity = 0.2 + 0.1 * Math.sin(now / 400);
      (gv.beacon.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.1 * Math.sin(now / 300);
      const marker = gv.talker.getObjectByName('marker');
      if (marker) {
        marker.rotation.y = now / 500;
        marker.position.y = 52 + Math.sin(now / 300) * 2;
      }
      // Fade the gate's name when Kilo is just behind it, so it never hides Kilo.
      const behind = bot.y < g.y + 20 && bot.y > g.y - 330 && Math.abs(bot.x - g.x) < 170;
      const lm = gv.labelSprite.material;
      lm.opacity += ((behind ? 0.25 : 1) - lm.opacity) * Math.min(1, dt * 8);
      const near = Math.hypot(bot.x - (g.x + 118), bot.y - (g.y + 96)) < 140;
      gv.speech.visible = near;
      gv.talker.rotation.y = Math.atan2(bot.x - (g.x + 118), bot.y - (g.y + 96));
      const glitching = g.locked;
      if (now - this.glitchTick > 120) {
        for (const m of gv.glitch) {
          m.visible = glitching && Math.random() < 0.7;
          if (m.visible) {
            m.position.set((Math.random() - 0.5) * 520, 6 + Math.random() * 160, (Math.random() - 0.5) * 380);
            m.scale.x = 0.4 + Math.random() * 2.2;
          }
        }
      }
    }
    if (now - this.glitchTick > 120) this.glitchTick = now;

    // People on the pavements: more of them where the lights are back on.
    const m = this.tmp;
    this.people.forEach((p, i) => {
      const r = ROADS[p.road];
      const horiz = r.w > r.h;
      const len = horiz ? r.w : r.h;
      p.t = (p.t + (p.speed * dt) / len + 1) % 1;
      const x = horiz ? r.x + p.t * r.w : r.x + r.w / 2 + p.side * (r.w / 2 + 5);
      const y = horiz ? r.y + r.h / 2 + p.side * (r.h / 2 + 5) : r.y + p.t * r.h;
      const lit = zoneLit(x, y);
      const show = lit >= 0 && lit + 0.05 >= p.need && Math.hypot(x - bot.x, y - bot.y) > 26;
      const bob = Math.abs(Math.sin(now / 160 + p.phase)) * 1.6;
      m.position.set(x, show ? 9 + bob : -100, y);
      m.rotation.set(0, horiz ? (p.speed > 0 ? Math.PI / 2 : -Math.PI / 2) : p.speed > 0 ? 0 : Math.PI, 0);
      m.scale.setScalar(show ? 1 : 0.001);
      m.updateMatrix();
      this.bodies.setMatrixAt(i, m.matrix);
      m.position.y = show ? 20 + bob : -100;
      m.updateMatrix();
      this.heads.setMatrixAt(i, m.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;

    // Cars stop for Kilo.
    for (const c of this.cars) {
      const { x0, y0, x1, y1 } = c.lane;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const x = x0 + (x1 - x0) * c.t;
      const y = y0 + (y1 - y0) * c.t;
      const ahead = ((bot.x - x) * (x1 - x0) + (bot.y - y) * (y1 - y0)) / len;
      const sideways = Math.abs(((bot.x - x) * (y1 - y0) - (bot.y - y) * (x1 - x0)) / len);
      const stop = ahead > 0 && ahead < 70 && sideways < 30;
      if (!stop) c.t = (c.t + (c.speed * dt) / len) % 1;
      c.group.position.set(x, 0, y);
      c.group.rotation.y = Math.atan2(x1 - x0, y1 - y0);
    }

    // Drones over the Spires, steam from the Foundry.
    const spires = this.gate('spires');
    this.drones.forEach((d, i) => {
      const a = now / (3000 + i * 400) + i;
      d.visible = !!spires && !spires.locked;
      d.position.set(1850 + Math.cos(a) * (140 + i * 25), 230 + Math.sin(now / 700 + i) * 12, 360 + Math.sin(a) * (100 + i * 18));
      (d.material as THREE.MeshBasicMaterial).color.set(Math.sin(now / 200 + i) > 0.6 ? '#ffffff' : '#FFBC3D');
    });
    const foundry = this.gate('foundry');
    for (const sp of this.steam) {
      const u = sp.userData as { x: number; z: number; t: number };
      u.t = (u.t + dt * 0.25) % 1;
      sp.visible = !!foundry && !foundry.locked && foundry.lit > 0;
      sp.position.set(u.x + Math.sin(u.t * 6) * 8, 72 + u.t * 120, u.z);
      sp.scale.setScalar(18 + u.t * 50);
      (sp.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - u.t);
    }

    // Billboards in dark districts stutter, like a bad signal.
    for (const a of this.ads) {
      const g = this.gate(a.zone);
      if (g && !g.locked && g.lit > 0) continue;
      a.mat.color.set(Math.sin(now / 55 + a.seed) > 0.93 ? '#ff3b6b' : '#3a2433');
    }

    // Data sparks along the roads, in the colour of lit districts.
    const col = new THREE.Color();
    this.sparkState.forEach((s, i) => {
      s.t = (s.t + s.speed * dt) % 1;
      const r = ROADS[s.road];
      const horiz = r.w > r.h;
      const x = horiz ? r.x + s.t * r.w : r.x + r.w * (0.25 + s.off * 0.5);
      const y = horiz ? r.y + r.h * (0.25 + s.off * 0.5) : r.y + s.t * r.h;
      const g = this.gate(zoneOf(x, y));
      const on = !!g && !g.locked && g.lit > 0;
      m.position.set(x, on ? 2 : -50, y);
      m.rotation.set(0, 0, 0);
      m.scale.set(horiz ? 14 : 3, 1.5, horiz ? 3 : 14);
      m.updateMatrix();
      this.sparkMesh.setMatrixAt(i, m.matrix);
      this.sparkMesh.setColorAt(i, col.set(g?.color ?? '#ffffff'));
    });
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;

    // The Docks water shimmers once the Docks have power.
    const docks = this.gate('docks');
    this.water.color.set(docks && docks.lit > 0 ? (Math.sin(now / 600) > 0 ? '#08202b' : '#0a2631') : '#06131c');

    this.renderer.render(this.scene, this.camera);
    this.stats.drawCalls = this.renderer.info.render.calls;
    this.drawMini();
    this.watchSpeed(dt);
  }

  private drawMini() {
    const ctx = this.miniCtx;
    if (!ctx || !this.mini) return;
    const r = this.mini.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    this.drawMinimap(ctx, 6, 6, r.width - 12);
  }

  /** Lower the resolution if frames are slow, so school laptops stay smooth. */
  private watchSpeed(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    this.stats.fps = Math.round(1 / avg);
    if (avg > 1 / 28 && this.quality > 0.55) {
      this.quality = Math.max(0.55, this.quality - 0.15);
      this.stats.quality = this.quality;
      this.resize();
    }
  }

  override dispose() {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mt of mats) {
        (mt as THREE.MeshBasicMaterial).map?.dispose();
        (mt as THREE.MeshLambertMaterial).emissiveMap?.dispose?.();
        mt.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Can this device draw the 3D city? */
export function webglOK(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
