import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

// scroll distance multiplier — higher = more scrolling per section, slower pacing
const SCROLL_SCALE = 1.8;
const VH = (v) => (innerHeight * v * SCROLL_SCALE) / 100;
const TOTAL = 1100; // total scroll length in vh (pre-scale)

// section boundaries (vh of scroll)
const S = {
  hero:    [0, 120],
  paper:   [120, 310],
  extract: [310, 460],
  zoom:    [460, 580],
  search:  [580, 740],
  expand:  [740, 910],
  outro:   [910, 1020],
};

export async function buildScrollStory({ graph, rig, state, camera }) {
  document.getElementById('scroll-space').style.height = `${TOTAL * SCROLL_SCALE}vh`;
  await document.fonts.ready;

  const $ = (s) => document.querySelector(s);
  const hudSection = $('#hud-section');

  // snapshot final story-node positions before any fromTo immediate-renders mutate basePos
  const FINAL = {};
  ['ada', 'babbage', 'engine', 'london'].forEach((id) => (FINAL[id] = graph.byId[id].basePos.clone()));

  function section(name, opts = {}) {
    const [a, b] = S[name];
    return gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#scroll-space',
        start: () => `top+=${VH(a)} top`,
        end: () => `top+=${VH(b)} top`,
        scrub: 0.7,
        ...opts,
      },
    });
  }

  // overlay fade helpers — show at timeline start, hide at end
  const showIn = (tl, el, at = 0, dur = 0.06) =>
    tl.to(el, { autoAlpha: 1, duration: dur }, at);
  const hideOut = (tl, el, at = 0.94, dur = 0.06) =>
    tl.to(el, { autoAlpha: 0, duration: dur }, at);

  // ---------- HUD progress + section label ----------
  const SECTION_NAMES = [
    ['hero', '01 — SIGNAL'], ['paper', '02 — SOURCE TEXT'], ['extract', '03 — NODES & EDGES'],
    ['zoom', '04 — THE GRAPH'], ['search', '05 — RETRIEVAL'], ['expand', '06 — TRAVERSAL'],
    ['outro', '07 — GROUNDED'],
  ];
  ScrollTrigger.create({
    trigger: '#scroll-space', start: 'top top', end: 'bottom bottom',
    onUpdate(self) {
      $('#progress-fill').style.height = `${(self.progress * 100).toFixed(1)}%`;
      $('#hud-progress').textContent = `${Math.round(self.progress * 100)}%`;
      const vhPos = self.progress * TOTAL;
      const cur = SECTION_NAMES.findLast(([k]) => vhPos >= S[k][0]);
      if (cur && hudSection.textContent !== cur[1]) hudSection.textContent = cur[1];
    },
  });

  // ================= 1 · HERO =================
  {
    gsap.set('#s-hero', { autoAlpha: 1 });
    const tl = section('hero');
    tl.fromTo('#s-hero .hero-title', { y: 0 }, { y: -60, duration: 0.9 }, 0)
      .to('#s-hero', { autoAlpha: 0, duration: 0.25 }, 0.6)
      // drift through the dim graph while the title holds
      .fromTo(rig, { radius: 78, theta: 0.25 }, { radius: 64, theta: 0.5, duration: 1 }, 0)
      .to(state, { globalOpacity: 0.5, duration: 0.4 }, 0.6);
    gsap.set(state, { cloudOpacity: 0.16 });
  }

  // ================= 2 · PAPER =================
  {
    const tl = section('paper');
    const concepts = gsap.utils.toArray('#paper .c');
    const relations = gsap.utils.toArray('#paper .r');

    showIn(tl, '#s-paper', 0);
    tl.fromTo('.paper-tilt', { y: 80, rotateX: -6 }, { y: 0, rotateX: 0, duration: 0.25 }, 0);
    tl.fromTo('#paper-caption', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.15 }, 0.1);

    // light up concepts one by one, then relationship phrases
    concepts.forEach((el, i) =>
      tl.to(el, { opacity: 1, duration: 0.04, onStart: () => el.classList.add('lit'), onReverseComplete: () => el.classList.remove('lit') }, 0.3 + i * 0.08)
    );
    relations.forEach((el, i) =>
      tl.to(el, { opacity: 1, duration: 0.04, onStart: () => el.classList.add('lit'), onReverseComplete: () => el.classList.remove('lit') }, 0.62 + i * 0.06)
    );

    // arcs between the concept words, drawn on as you scroll
    const svg = $('#paper-arcs');
    const paperEl = $('#paper');
    const pairs = [['ada', 'babbage'], ['babbage', 'engine'], ['babbage', 'london']];
    const paths = pairs.map(([a, b]) => {
      const ra = paperEl.querySelector(`[data-node="${a}"]`).getBoundingClientRect();
      const rb = paperEl.querySelector(`[data-node="${b}"]`).getBoundingClientRect();
      const rp = paperEl.getBoundingClientRect();
      const ax = ra.left + ra.width / 2 - rp.left, ay = ra.top - rp.top - 2;
      const bx = rb.left + rb.width / 2 - rp.left, by = rb.top - rp.top - 2;
      const lift = 26 + Math.abs(ax - bx) * 0.08;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M ${ax} ${ay} Q ${(ax + bx) / 2} ${Math.min(ay, by) - lift} ${bx} ${by}`);
      svg.appendChild(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      return p;
    });
    paths.forEach((p, i) => tl.to(p, { strokeDashoffset: 0, duration: 0.1 }, 0.72 + i * 0.07));

    hideOut(tl, '#s-paper', 0.92, 0.08);
    tl.to('.paper-tilt', { scale: 0.92, rotateX: 14, duration: 0.08 }, 0.92);
    tl.to(state, { globalOpacity: 0.15, duration: 0.2 }, 0);
  }

  // ================= 3 · EXTRACTION =================
  {
    // camera pose the extraction lands on — used to unproject word positions
    const POSE = { radius: 15.5, theta: 0.12, phi: 1.4, tx: 0, ty: 0.6, tz: 0 };
    const startPos = computeWordWorldPositions(camera, POSE);

    const tl = section('extract');
    showIn(tl, '#s-extract', 0.05);

    tl.to(rig, { ...POSE, duration: 0.0001 }, 0); // snap rig (3D was faded out during paper)
    tl.to(state, { globalOpacity: 1, cloudOpacity: 0, duration: 0.1 }, 0);

    const ids = ['ada', 'babbage', 'engine', 'london'];
    ids.forEach((id, i) => {
      const n = graph.byId[id];
      const sp = startPos[id];
      const finalPos = FINAL[id];
      tl.fromTo(n.basePos, { x: sp.x, y: sp.y, z: sp.z },
        { x: finalPos.x, y: finalPos.y, z: finalPos.z, duration: 0.3, ease: 'power2.inOut' }, 0.05 + i * 0.05);
      tl.fromTo(n, { r: 0.45 }, { r: n.r, duration: 0.25 }, 0.05 + i * 0.05);
      tl.fromTo(n, { opacity: 0 }, { opacity: 1, duration: 0.07 }, 0.05 + i * 0.05);
      tl.to(n, { labelOpacity: 1, duration: 0.1 }, 0.3 + i * 0.05);
    });

    // node definition card appears as the spheres settle
    tl.fromTo('#def-node', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.1 }, 0.34);

    // edges draw in as glowing connections, with relationship labels
    graph.edges.filter((e) => e.story).forEach((e, i) => {
      tl.to(e, { grow: 1, opacity: 0.9, duration: 0.12, ease: 'power1.inOut' }, 0.52 + i * 0.08);
      tl.to(e, { labelOpacity: 1, duration: 0.08 }, 0.6 + i * 0.08);
    });
    tl.fromTo('#def-edge', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.1 }, 0.62);

    // gentle camera drift while it all assembles
    tl.to(rig, { theta: 0.45, phi: 1.25, duration: 0.95, ease: 'none' }, 0.05);
    hideOut(tl, '#s-extract', 0.93, 0.07);
  }

  // ================= 4 · ZOOM OUT =================
  {
    const tl = section('zoom');
    showIn(tl, '#s-zoom', 0.25);
    tl.to(rig, { radius: 58, theta: 1.1, phi: 1.05, ty: 0, duration: 1, ease: 'power1.inOut' }, 0);
    tl.to(state, { cloudOpacity: 1, duration: 0.6 }, 0.15);
    // story edge labels are unreadable from far away — fade them
    graph.edges.filter((e) => e.story).forEach((e) => tl.to(e, { labelOpacity: 0, duration: 0.2 }, 0.3));
    graph.nodes.filter((n) => n.story).forEach((n) => tl.to(n, { labelOpacity: 0.45, duration: 0.3 }, 0.4));
    hideOut(tl, '#s-zoom', 0.9, 0.1);
  }

  // ================= 5 · SEARCH (LLM tool call #1) =================
  const term = makeTerminal($('#term-text'));
  {
    const tl = section('search');
    showIn(tl, '#s-llm', 0);

    term.chunk(tl, 0.02, 0.3,
`$ user: "Who did Ada Lovelace work with — and on what?"

[llm] I can't answer from text alone. Query the graph.

> searchNodes("Ada Lovelace")
  scanning ${graph.nodes.length} nodes…`);

    // decoy candidates flash amber while "scanning"
    const decoys = [graph.clusters[2][3], graph.clusters[5][6], graph.clusters[3][2]];
    decoys.forEach((d, i) => {
      tl.to(d, { highlight: 0.8, duration: 0.05 }, 0.3 + i * 0.07);
      tl.to(d, { highlight: 0, duration: 0.08 }, 0.38 + i * 0.07);
    });

    term.chunk(tl, 0.55, 0.15,
`
  ✓ match: node #042 "Ada Lovelace" [Person] — score 0.98`);

    // lock onto Ada: ping rings, highlight, dim the rest, camera dives in
    const ada = graph.byId.ada;
    tl.to(ada, { highlight: 1, labelOpacity: 1, duration: 0.1 }, 0.6);
    tl.to(state, { pingOpacity: 1, duration: 0.05 }, 0.6);
    tl.fromTo(state, { ping: 0 }, { ping: 1, duration: 0.4 }, 0.6);
    tl.to(state, { focusDim: 0.85, duration: 0.25 }, 0.62);
    tl.to(rig, {
      radius: 22, theta: 0.7, phi: 1.3,
      tx: FINAL.ada.x, ty: FINAL.ada.y, tz: FINAL.ada.z,
      duration: 0.45, ease: 'power2.inOut',
    }, 0.55);
    tl.to(state, { pingOpacity: 0, duration: 0.1 }, 0.9);
  }

  // ================= 6 · EXPAND (LLM tool call #2) =================
  {
    const tl = section('expand');
    const { nodes: hood, edges: hoodE } = graph.neighborhood('ada', 2);

    term.chunk(tl, 0.0, 0.2,
`

> expandNeighborhood("#042", depth=2)`);

    // traversal wave: depth 1 lights, then depth 2
    const waveAt = { 1: 0.2, 2: 0.45 };
    hoodE.forEach(({ edge, d }, i) =>
      tl.to(edge, { highlight: 1, duration: 0.08 }, waveAt[d] + (i % 5) * 0.015));
    hood.filter(({ d }) => d > 0).forEach(({ node, d }, i) => {
      tl.to(node, { highlight: 0.6, duration: 0.08 }, waveAt[d] + 0.04 + (i % 5) * 0.015);
      if (node.story) tl.to(node, { labelOpacity: 1, duration: 0.08 }, waveAt[d] + 0.04);
    });
    graph.edges.filter((e) => e.story).forEach((e) =>
      tl.to(e, { labelOpacity: 1, duration: 0.1 }, 0.3));

    term.chunk(tl, 0.28, 0.35,
`
  ✓ ${hood.length} nodes · ${hoodE.length} edges retrieved
  · WORKED_WITH → "Charles Babbage" [Person]
  · DESIGNED    → "Analytical Engine" [Machine]
  · WORKED_IN   → "London" [Place]`);

    term.chunk(tl, 0.72, 0.25,
`

[llm] grounded answer:
"Ada Lovelace worked with Charles Babbage on the
 Analytical Engine — which he designed in London."`);

    // slow orbit around the lit-up neighborhood
    tl.to(rig, { theta: 1.9, radius: 44, phi: 1.15, tx: 0, ty: 0.5, tz: 0, duration: 1, ease: 'none' }, 0);
    hideOut(tl, '#s-llm', 0.94, 0.06);
  }

  // ================= 7 · OUTRO =================
  {
    const tl = section('outro', { end: () => `top+=${VH(S.outro[1])} bottom` });
    showIn(tl, '#s-outro', 0.25, 0.15);
    tl.to(state, { focusDim: 0, bloom: 0.65, duration: 0.5 }, 0);
    tl.to(rig, { radius: 72, theta: 2.9, phi: 1.2, tx: 0, ty: 0, tz: 0, duration: 1, ease: 'power1.inOut' }, 0);
    graph.nodes.filter((n) => n.story).forEach((n) => tl.to(n, { highlight: 0.15, labelOpacity: 0, duration: 0.4 }, 0));
    graph.edges.filter((e) => e.story).forEach((e) => tl.to(e, { labelOpacity: 0, duration: 0.25 }, 0));
    [...graph.neighborhood('ada', 2).edges].forEach(({ edge }) => tl.to(edge, { highlight: 0.15, duration: 0.4 }, 0));
    [...graph.neighborhood('ada', 2).nodes].filter(({ d }) => d > 0).forEach(({ node }) =>
      tl.to(node, { highlight: 0.15, duration: 0.4 }, 0));
  }
}

/** unproject the highlighted DOM words into world space at a given camera pose */
function computeWordWorldPositions(realCamera, pose) {
  const cam = realCamera.clone();
  const phi = pose.phi, theta = pose.theta;
  cam.position.set(
    pose.tx + pose.radius * Math.sin(phi) * Math.sin(theta),
    pose.ty + pose.radius * Math.cos(phi),
    pose.tz + pose.radius * Math.sin(phi) * Math.cos(theta)
  );
  cam.lookAt(pose.tx, pose.ty, pose.tz);
  cam.updateMatrixWorld(true);

  const out = {};
  document.querySelectorAll('#paper .c').forEach((el) => {
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector3(
      ((r.left + r.width / 2) / innerWidth) * 2 - 1,
      -(((r.top + r.height / 2) / innerHeight) * 2 - 1),
      0.5
    );
    ndc.unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    out[el.dataset.node] = cam.position.clone().addScaledVector(dir, pose.radius * 0.85);
  });
  return out;
}

/** scroll-scrubbed terminal typing — scrubbing backwards un-types, which is a feature */
function makeTerminal(el) {
  const chunks = [];
  const render = () => {
    const text = chunks.map((c) => c.text.slice(0, Math.round(c.shown))).join('');
    el.innerHTML = text
      .replace(/(searchNodes|expandNeighborhood)/g, '<span class="tk-fn">$1</span>')
      .replace(/(✓[^\n]*)/g, '<span style="color:#8aa9bf">$1</span>')
      .replace(/(\$ user:[^\n]*)/g, '<span style="color:#d4a27f">$1</span>');
  };
  return {
    chunk(tl, at, dur, text) {
      const c = { text, shown: 0 };
      chunks.push(c);
      tl.to(c, { shown: text.length, duration: dur, ease: 'none', onUpdate: render }, at);
    },
  };
}
