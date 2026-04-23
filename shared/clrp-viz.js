/* Shared: small CLRP instance visualizer.
   Deterministic 30-client, 5-depot demo (3 opened). Renders SVG + stats row. */
(function () {
  function seeded(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  function buildSolution(seed) {
    const rnd = seeded(seed);
    const W = 1000, H = 560;

    // Three client clusters of 10 each — one per open depot.
    const clusters = [
      { cx: 210, cy: 200, r: 85, n: 10 },
      { cx: 790, cy: 210, r: 80, n: 10 },
      { cx: 500, cy: 440, r: 95, n: 10 },
    ];
    const clients = [];
    let cid = 0;
    for (const cl of clusters) {
      for (let j = 0; j < cl.n; j++) {
        const a = rnd() * Math.PI * 2;
        const r = cl.r * Math.pow(rnd(), 0.7);
        clients.push({
          id: cid++,
          x: cl.cx + Math.cos(a) * r,
          y: cl.cy + Math.sin(a) * r,
          demand: 8 + Math.floor(rnd() * 8), // 8..15
        });
      }
    }

    // Five depot candidates. Three near cluster centers (opened);
    // two off-cluster (kept closed by the solution).
    const depots = [
      { id: 0, label: 'D1', x: 175, y: 155, capacity: 150, maxV: 3, open: true  },
      { id: 1, label: 'D2', x: 490, y: 110, capacity: 150, maxV: 3, open: false },
      { id: 2, label: 'D3', x: 830, y: 165, capacity: 150, maxV: 3, open: true  },
      { id: 3, label: 'D4', x: 500, y: 480, capacity: 150, maxV: 3, open: true  },
      { id: 4, label: 'D5', x: 160, y: 460, capacity: 130, maxV: 2, open: false },
    ];

    const openDepots = depots.filter(d => d.open);
    openDepots.forEach(d => { d.clients = []; d.load = 0; });

    // Assign each client to the nearest open depot with remaining capacity.
    for (const c of clients) {
      const sorted = openDepots.slice().sort((a, b) => {
        const da = (a.x - c.x) * (a.x - c.x) + (a.y - c.y) * (a.y - c.y);
        const db = (b.x - c.x) * (b.x - c.x) + (b.y - c.y) * (b.y - c.y);
        return da - db;
      });
      for (const d of sorted) {
        if (d.load + c.demand <= d.capacity) {
          d.clients.push(c);
          d.load += c.demand;
          c.depotId = d.id;
          break;
        }
      }
    }

    // Per depot: angular sweep, then nearest-neighbor order within each route.
    const vehCap = 65;
    for (const d of openDepots) {
      const pts = d.clients.slice();
      for (const p of pts) p._a = Math.atan2(p.y - d.y, p.x - d.x);
      pts.sort((a, b) => a._a - b._a);

      const routes = [];
      let cur = [], load = 0;
      for (const p of pts) {
        if (load + p.demand > vehCap && cur.length) {
          routes.push(cur);
          cur = []; load = 0;
        }
        cur.push(p); load += p.demand;
      }
      if (cur.length) routes.push(cur);

      d.routes = routes.map(route => {
        const rem = route.slice();
        const ord = [];
        let cx = d.x, cy = d.y;
        while (rem.length) {
          let bi = 0, bd = Infinity;
          for (let i = 0; i < rem.length; i++) {
            const dx = rem[i].x - cx, dy = rem[i].y - cy;
            const dd = dx * dx + dy * dy;
            if (dd < bd) { bd = dd; bi = i; }
          }
          const n = rem.splice(bi, 1)[0];
          ord.push(n);
          cx = n.x; cy = n.y;
        }
        return ord;
      });
    }

    return { W, H, depots, clients, openDepots, vehCap };
  }

  function renderSVG(sol, opts) {
    const { W, H, depots, clients, openDepots } = sol;
    const paper = opts.paper || '#FDFBF7';
    const ink = '#1A1E3C';
    const muted = 'rgba(26,30,60,0.38)';
    const palette = ['#E8793F', '#2B7A78', '#3A6EA5'];
    const softPalette = ['#FBE4D4', '#D6ECEA', '#DCE7F3'];

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="display:block;">`;

    svg += `<defs><pattern id="clrpGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="rgba(26,30,60,0.07)" stroke-width="1"/>
    </pattern></defs>`;
    svg += `<rect width="${W}" height="${H}" fill="url(#clrpGrid)"/>`;

    // Routes first (beneath points).
    openDepots.forEach((d, di) => {
      const col = palette[di];
      d.routes.forEach(route => {
        let pts = `${d.x.toFixed(1)},${d.y.toFixed(1)}`;
        route.forEach(p => { pts += ` ${p.x.toFixed(1)},${p.y.toFixed(1)}`; });
        pts += ` ${d.x.toFixed(1)},${d.y.toFixed(1)}`;
        svg += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
      });
    });

    // Clients.
    clients.forEach(c => {
      const di = openDepots.findIndex(d => d.id === c.depotId);
      const col = di >= 0 ? palette[di] : muted;
      const fill = di >= 0 ? softPalette[di] : paper;
      svg += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.6" fill="${fill}" stroke="${col}" stroke-width="1.6"/>`;
    });

    // Depots on top.
    depots.forEach(d => {
      if (d.open) {
        const idx = openDepots.indexOf(d);
        const col = palette[idx];
        svg += `<rect x="${(d.x - 13).toFixed(1)}" y="${(d.y - 13).toFixed(1)}" width="26" height="26" rx="2" fill="${col}" stroke="${ink}" stroke-width="1.6"/>`;
        svg += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="4.5" fill="${paper}"/>`;
        svg += `<text x="${(d.x + 20).toFixed(1)}" y="${(d.y - 14).toFixed(1)}" fill="${ink}" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="13" font-weight="600" letter-spacing="0.04em">${d.label}</text>`;
      } else {
        svg += `<rect x="${(d.x - 13).toFixed(1)}" y="${(d.y - 13).toFixed(1)}" width="26" height="26" rx="2" fill="${paper}" stroke="${muted}" stroke-width="1.5" stroke-dasharray="4,3"/>`;
        svg += `<line x1="${(d.x - 8).toFixed(1)}" y1="${(d.y - 8).toFixed(1)}" x2="${(d.x + 8).toFixed(1)}" y2="${(d.y + 8).toFixed(1)}" stroke="${muted}" stroke-width="1.4"/>`;
        svg += `<line x1="${(d.x + 8).toFixed(1)}" y1="${(d.y - 8).toFixed(1)}" x2="${(d.x - 8).toFixed(1)}" y2="${(d.y + 8).toFixed(1)}" stroke="${muted}" stroke-width="1.4"/>`;
        svg += `<text x="${(d.x + 20).toFixed(1)}" y="${(d.y - 14).toFixed(1)}" fill="${muted}" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="13" font-weight="600" letter-spacing="0.04em">${d.label}</text>`;
      }
    });

    svg += `</svg>`;
    return svg;
  }

  function renderStats(sol, lang) {
    const { openDepots } = sol;
    const palette = ['#E8793F', '#2B7A78', '#3A6EA5'];
    const t = lang === 'es'
      ? { clients: 'clientes', routes: 'rutas', load: 'carga', travel: 'Recorrido' }
      : { clients: 'clients', routes: 'routes', load: 'load', travel: 'Travel' };

    let totalDist = 0;
    openDepots.forEach(d => {
      d.routes.forEach(route => {
        const seq = [d, ...route, d];
        for (let i = 1; i < seq.length; i++) {
          const dx = seq[i].x - seq[i - 1].x;
          const dy = seq[i].y - seq[i - 1].y;
          totalDist += Math.sqrt(dx * dx + dy * dy);
        }
      });
    });

    let out = `<div class="clrp-stats">`;
    openDepots.forEach((d, i) => {
      out += `<div class="clrp-depot-pill" style="--dot:${palette[i]}">` +
        `<span class="clrp-pill-dot"></span>` +
        `<span class="clrp-pill-lbl">${d.label}</span>` +
        `<span class="clrp-pill-kv">${d.clients.length} ${t.clients} · ${d.routes.length} ${t.routes} · ${t.load} ${d.load}/${d.capacity}</span>` +
        `</div>`;
    });
    out += `<div class="clrp-stats-summary">${t.travel} ≈ ${totalDist.toFixed(0)}</div>`;
    out += `</div>`;
    return out;
  }

  function mountAll() {
    document.querySelectorAll('[data-clrp-viz]').forEach(el => {
      if (el.dataset.mounted === '1') return;
      const seed = el.dataset.seed ? parseInt(el.dataset.seed, 10) : 17;
      const lang = el.dataset.lang || 'en';
      const sol = buildSolution(seed);
      const svg = renderSVG(sol, {});
      const stats = renderStats(sol, lang);
      el.innerHTML = `<div class="clrp-svg">${svg}</div>${stats}`;
      el.dataset.mounted = '1';
    });
  }

  window.CLRPViz = { buildSolution: buildSolution, mountAll: mountAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();
