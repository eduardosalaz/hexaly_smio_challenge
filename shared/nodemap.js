/* Shared: routing nodemap SVG generator — v2.
   Fills its container completely. Deterministic by seed. */
(function () {
  function seeded(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  function nodemap(opts) {
    const o = Object.assign({
      width: 1200,
      height: 520,
      nodes: 180,
      depots: 6,
      seed: 7,
      edgeColor: 'rgba(20,30,60,0.22)',
      nodeColor: 'rgba(20,30,60,0.55)',
      depotColor: '#E8793F',
      paper: '#FDFBF7',
      showRoutes: true
    }, opts || {});
    const rnd = seeded(o.seed);
    const W = o.width, H = o.height;

    const clusters = [];
    for (let i = 0; i < o.depots; i++) {
      clusters.push({
        x: 80 + rnd() * (W - 160),
        y: 60 + rnd() * (H - 120),
        r: 60 + rnd() * 110
      });
    }
    const customers = [];
    for (let i = 0; i < o.nodes; i++) {
      const c = clusters[Math.floor(rnd() * clusters.length)];
      const a = rnd() * Math.PI * 2;
      const r = c.r * Math.pow(rnd(), 0.7);
      customers.push({
        x: c.x + Math.cos(a) * r,
        y: c.y + Math.sin(a) * r,
        cluster: clusters.indexOf(c)
      });
    }
    const depots = clusters.map(c => ({ x: c.x, y: c.y }));

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" style="display:block;">`;

    svg += `<defs><pattern id="grid-${o.seed}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="rgba(20,30,60,0.05)" stroke-width="1"/>
    </pattern></defs>`;
    svg += `<rect width="${W}" height="${H}" fill="url(#grid-${o.seed})"/>`;

    if (o.showRoutes) {
      const routeSize = o.routeSize || 7;
      const byDepot = depots.map(() => []);
      for (const c of customers) byDepot[c.cluster].push(c);

      for (let di = 0; di < depots.length; di++) {
        const d = depots[di];
        const cs = byDepot[di];
        if (!cs.length) continue;

        // Angular sweep: sort customers by angle from depot, then split into contiguous route segments
        for (const c of cs) c._a = Math.atan2(c.y - d.y, c.x - d.x);
        cs.sort((a, b) => a._a - b._a);

        const nRoutes = Math.max(1, Math.ceil(cs.length / routeSize));
        const per = Math.ceil(cs.length / nRoutes);

        for (let r = 0; r < nRoutes; r++) {
          const seg = cs.slice(r * per, (r + 1) * per);
          if (!seg.length) continue;

          // Nearest-neighbor tour starting from depot within this angular wedge
          const remaining = seg.slice();
          let cx = d.x, cy = d.y;
          let pts = `${d.x.toFixed(1)},${d.y.toFixed(1)}`;
          while (remaining.length) {
            let bi = 0, bd = Infinity;
            for (let i = 0; i < remaining.length; i++) {
              const dx = remaining[i].x - cx, dy = remaining[i].y - cy;
              const dd = dx * dx + dy * dy;
              if (dd < bd) { bd = dd; bi = i; }
            }
            const next = remaining.splice(bi, 1)[0];
            pts += ` ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
            cx = next.x; cy = next.y;
          }
          pts += ` ${d.x.toFixed(1)},${d.y.toFixed(1)}`;
          svg += `<polyline points="${pts}" fill="none" stroke="${o.edgeColor}" stroke-width="0.75" stroke-linejoin="round" stroke-linecap="round"/>`;
        }
      }
    }

    for (const cust of customers) {
      svg += `<circle cx="${cust.x.toFixed(1)}" cy="${cust.y.toFixed(1)}" r="1.8" fill="${o.nodeColor}"/>`;
    }

    for (const d of depots) {
      svg += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="9" fill="${o.paper}" stroke="${o.depotColor}" stroke-width="2.2"/>`;
      svg += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="3" fill="${o.depotColor}"/>`;
    }

    svg += `</svg>`;
    return svg;
  }

  function mountAll() {
    document.querySelectorAll('[data-nodemap]').forEach(function (el, i) {
      if (el.dataset.mounted === '1') return;
      const opts = {};
      for (const k of ['seed', 'nodes', 'depots']) {
        if (el.dataset[k]) opts[k] = parseFloat(el.dataset[k]);
      }
      if (el.dataset.routes === 'false') opts.showRoutes = false;
      if (el.dataset.paper) opts.paper = el.dataset.paper;
      if (el.dataset.edge) opts.edgeColor = el.dataset.edge;
      if (el.dataset.node) opts.nodeColor = el.dataset.node;
      if (el.dataset.depot) opts.depotColor = el.dataset.depot;
      el.innerHTML = nodemap(Object.assign({ seed: i + 1 }, opts));
      el.dataset.mounted = '1';
    });
  }

  window.NodeMap = { render: nodemap, mountAll: mountAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();
