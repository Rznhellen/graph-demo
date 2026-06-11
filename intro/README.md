# Knowledge Graphs — An Interactive Introduction

A scroll-driven 3D presentation that introduces knowledge graphs to a mixed
technical/non-technical audience. Built with Three.js (WebGL + bloom
post-processing) and GSAP ScrollTrigger — the entire story is scrubbed by the
scroll wheel, so you control the pacing while you talk.

## Running it

```bash
npm install
npm run dev      # presentation at http://localhost:5173
npm run build    # static build in dist/
```

## The story (scroll beats)

1. **Signal** — title card over a dim, drifting graph.
2. **Source text** — a "paper" about Ada Lovelace; concepts light up cyan,
   relationship phrases light up magenta, arcs connect them.
3. **Nodes & edges** — the highlighted words pull off the page and condense
   into glowing spheres (nodes) joined by sticks (edges), with succinct
   definitions of each.
4. **The graph** — camera pulls back; the four facts are revealed as one
   corner of a full 3D knowledge graph.
5. **Retrieval** — an LLM terminal types `searchNodes("Ada Lovelace")`;
   candidate nodes flash, ping rings lock onto the match, the camera dives in.
6. **Traversal** — `expandNeighborhood("#042", depth=2)` sends a highlight
   wave through neighboring nodes and edges while the camera orbits.
7. **Grounded** — the LLM composes its answer from the retrieved facts.

## Presenting tips

- Scroll slowly — every animation is tied to scroll position, and scrolling
  backwards rewinds everything (including the terminal typing).
- Mouse movement adds a subtle camera parallax; idle nodes bob on their own.
- `inspect.mjs` drives headless Chrome through each story beat and captures
  screenshots to `/tmp/shots` for visual regression checks:
  `node inspect.mjs "0,180,430,640,800,970"`.
