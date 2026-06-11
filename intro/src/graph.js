import * as THREE from 'three';

export const COLORS = {
  cyan: new THREE.Color('#D4845A'),
  magenta: new THREE.Color('#7B9DB8'),
  amber: new THREE.Color('#E8D4B0'),
  white: new THREE.Color('#FAF6F0'),
  base: new THREE.Color('#6B6257'),
};

const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
const connectionGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);

function makeLabelSprite(text, { color = '#EDE8E0', size = 46, glow = '#14120F' } = {}) {
  const pad = 24;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const font = `600 ${size}px "JetBrains Mono", monospace`;
  ctx.font = font;
  cv.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  cv.height = size + pad * 2;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  const s = 0.016;
  spr.scale.set(cv.width * s, cv.height * s, 1);
  spr.renderOrder = 10;
  return spr;
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Graph {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.nodes = [];
    this.edges = [];
    this.byId = {};
    this.rand = mulberry32(1337);

    this._buildStory();
    this._buildCloud();
    this._buildEdges();
    this._buildPulseRings(scene);
  }

  addNode({ id, pos, r = 0.55, color = COLORS.base, label = null, story = false }) {
    const mat = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.55),
      emissive: color.clone(),
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(r);
    const node = {
      id, mesh, mat,
      basePos: new THREE.Vector3(...pos),
      r, story,
      baseColor: color.clone(),
      highlight: 0,     // 0..1 — search/expand glow
      opacity: story ? 0 : 1, // story nodes appear via extraction
      bobPhase: this.rand() * Math.PI * 2,
      bobAmp: 0.12 + this.rand() * 0.18,
      labelSprite: null,
    };
    if (label) {
      node.labelSprite = makeLabelSprite(label);
      this.group.add(node.labelSprite);
    }
    mesh.position.copy(node.basePos);
    this.group.add(mesh);
    this.nodes.push(node);
    if (id) this.byId[id] = node;
    return node;
  }

  addEdge(a, b, { label = null, story = false } = {}) {
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.base.clone().multiplyScalar(0.8),
      transparent: true,
      opacity: story ? 0 : 0.32,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(connectionGeo, mat);
    this.group.add(mesh);
    const edge = {
      a, b, mesh, mat, story,
      highlight: 0,
      opacity: story ? 0 : 0.32,
      grow: story ? 0 : 1, // story edges draw in from node a
      labelSprite: null,
    };
    if (label) {
      edge.labelSprite = makeLabelSprite(label, { color: '#C9B99A', size: 34 });
      this.group.add(edge.labelSprite);
    }
    this.edges.push(edge);
    return edge;
  }

  _buildStory() {
    // the four concepts pulled from the paper — center of the universe
    this.addNode({ id: 'ada',     pos: [-7.0, 3.0, 0.6],  r: 0.8, color: COLORS.cyan, label: 'Ada Lovelace', story: true });
    this.addNode({ id: 'babbage', pos: [2.0, 4.6, -1.5],  r: 0.8, color: COLORS.cyan, label: 'Charles Babbage', story: true });
    this.addNode({ id: 'engine',  pos: [-2.2, -3.8, 2.0], r: 0.8, color: COLORS.cyan, label: 'Analytical Engine', story: true });
    this.addNode({ id: 'london',  pos: [7.4, -2.6, -0.6], r: 0.8, color: COLORS.cyan, label: 'London', story: true });

    this.addEdge(this.byId.ada, this.byId.babbage,    { label: 'WORKED_WITH', story: true });
    this.addEdge(this.byId.babbage, this.byId.engine, { label: 'DESIGNED', story: true });
    this.addEdge(this.byId.babbage, this.byId.london, { label: 'WORKED_IN', story: true });
  }

  _buildCloud() {
    const rnd = this.rand;
    const centers = [
      [0, 0, 0], [22, 9, -14], [-24, -6, -10], [14, -16, 12],
      [-12, 18, 14], [-20, 4, 22], [18, 14, 18], [4, -8, -26],
    ];
    this.clusters = centers.map(() => []);
    centers.forEach((c, ci) => {
      const count = ci === 0 ? 10 : 14 + Math.floor(rnd() * 6);
      for (let i = 0; i < count; i++) {
        // gaussian-ish offsets
        const g = () => (rnd() + rnd() + rnd() - 1.5) * 7.5;
        const node = this.addNode({
          id: null,
          pos: [c[0] + g(), c[1] + g(), c[2] + g()],
          r: 0.3 + rnd() * 0.4,
          color: rnd() < 0.16 ? COLORS.magenta : COLORS.base,
        });
        node.cloud = true;
        this.clusters[ci].push(node);
      }
    });
  }

  _buildEdges() {
    const rnd = this.rand;
    // intra-cluster: each node links to 1-2 nearest in its cluster
    this.clusters.forEach((cl) => {
      cl.forEach((n) => {
        const sorted = cl
          .filter((m) => m !== n)
          .sort((a, b) => a.basePos.distanceToSquared(n.basePos) - b.basePos.distanceToSquared(n.basePos));
        const k = 1 + (rnd() < 0.5 ? 1 : 0);
        for (let i = 0; i < k && i < sorted.length; i++) {
          if (!this.edges.some((e) => (e.a === n && e.b === sorted[i]) || (e.b === n && e.a === sorted[i]))) {
            this.addEdge(n, sorted[i]);
          }
        }
      });
    });
    // sparse inter-cluster links
    for (let i = 0; i < 14; i++) {
      const a = this.clusters[Math.floor(rnd() * this.clusters.length)];
      const b = this.clusters[Math.floor(rnd() * this.clusters.length)];
      if (a !== b) this.addEdge(a[Math.floor(rnd() * a.length)], b[Math.floor(rnd() * b.length)]);
    }
    // weave the story nodes into the central cluster so expandNeighborhood has depth
    const central = this.clusters[0];
    ['ada', 'babbage', 'engine', 'london'].forEach((id, i) => {
      const n = this.byId[id];
      const near = central
        .slice()
        .sort((a, b) => a.basePos.distanceToSquared(n.basePos) - b.basePos.distanceToSquared(n.basePos))
        .slice(0, 2 + (i % 2));
      near.forEach((m) => this.addEdge(n, m));
    });
  }

  _buildPulseRings(scene) {
    // expanding ping rings used by searchNodes()
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.96, 1.0, 48);
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.amber, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      this.group.add(mesh);
      this.rings.push({ mesh, mat });
    }
  }

  neighborhood(id, depth) {
    // returns [{node, d}], [{edge, d}] up to depth via BFS
    const start = this.byId[id];
    const nd = new Map([[start, 0]]);
    const ed = [];
    let frontier = [start];
    for (let d = 1; d <= depth; d++) {
      const next = [];
      for (const e of this.edges) {
        const ka = nd.has(e.a) && nd.get(e.a) === d - 1;
        const kb = nd.has(e.b) && nd.get(e.b) === d - 1;
        if (ka && !nd.has(e.b)) { nd.set(e.b, d); next.push(e.b); ed.push({ edge: e, d }); }
        else if (kb && !nd.has(e.a)) { nd.set(e.a, d); next.push(e.a); ed.push({ edge: e, d }); }
        else if ((ka || kb) && !ed.some((x) => x.edge === e)) ed.push({ edge: e, d });
      }
      frontier = next;
    }
    return { nodes: [...nd.entries()].map(([node, d]) => ({ node, d })), edges: ed };
  }

  /** apply animated state to three objects — called every frame */
  tick(t, state) {
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3();

    for (const n of this.nodes) {
      const bob = Math.sin(t * 0.7 + n.bobPhase) * n.bobAmp * state.idle;
      n.mesh.position.set(n.basePos.x, n.basePos.y + bob, n.basePos.z);
      const op = n.opacity * (n.cloud ? state.cloudOpacity : 1) * state.globalOpacity;
      const dimmed = state.focusDim * (1 - n.highlight);
      n.mat.opacity = op * (1 - dimmed * 0.82);
      n.mesh.visible = n.mat.opacity > 0.01;
      const pulse = n.highlight > 0 ? 1 + Math.sin(t * 5 + n.bobPhase) * 0.06 * n.highlight : 1;
      n.mesh.scale.setScalar(n.r * (1 + n.highlight * 0.55) * pulse);
      n.mat.emissiveIntensity = 0.4 + n.highlight * 1.05;
      n.mat.emissive.copy(n.baseColor).lerp(COLORS.amber, n.highlight * (n.story ? 0.45 : 0.85));
      if (n.labelSprite) {
        n.labelSprite.position.copy(n.mesh.position).add(new THREE.Vector3(0, n.r * 2.0 + 0.55, 0));
        n.labelSprite.material.opacity = n.labelOpacity ?? 0;
      }
    }

    for (const e of this.edges) {
      const pa = e.a.mesh.position, pb = e.b.mesh.position;
      dir.subVectors(pb, pa);
      const len = dir.length() * e.grow;
      mid.copy(pa).addScaledVector(dir, e.grow * 0.5);
      e.mesh.position.copy(mid);
      e.mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      const thick = 0.035 + e.highlight * 0.06 + (e.story ? 0.03 : 0);
      e.mesh.scale.set(thick, Math.max(len, 0.001), thick);
      const cloudE = !(e.a.story && e.b.story);
      const op = e.opacity * (cloudE ? state.cloudOpacity : 1) * state.globalOpacity;
      const dimmed = state.focusDim * (1 - e.highlight);
      e.mat.opacity = op * (1 - dimmed * 0.88);
      e.mesh.visible = e.mat.opacity > 0.01 && len > 0.01;
      e.mat.color.copy(COLORS.base).lerp(e.a.story && e.b.story ? COLORS.magenta : COLORS.amber, Math.max(e.highlight, e.a.story && e.b.story ? 0.75 : 0));
      if (e.labelSprite) {
        e.labelSprite.position.copy(pa).addScaledVector(dir.normalize().multiplyScalar(pa.distanceTo(pb)), 0.5).add(new THREE.Vector3(0, 0.5, 0));
        e.labelSprite.material.opacity = e.labelOpacity ?? 0;
      }
    }

    // search ping rings expanding around target
    if (state.pingTarget && state.ping > 0) {
      const c = this.byId[state.pingTarget].mesh.position;
      this.rings.forEach((r, i) => {
        const p = (state.ping * 1.6 + i * 0.33) % 1;
        r.mesh.position.copy(c);
        r.mesh.scale.setScalar(0.5 + p * 7);
        r.mesh.lookAt(state.cameraPos);
        r.mat.opacity = (1 - p) * 0.7 * state.pingOpacity;
      });
    } else {
      this.rings.forEach((r) => (r.mat.opacity = 0));
    }
  }
}
