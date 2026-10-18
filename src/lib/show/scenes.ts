import type { ThemeId } from "./config";

/**
 * Décors statiques de la bibliothèque d'arrière-plans.
 *
 * Chaque décor est une valeur CSS `background` à plusieurs couches (la première est au-dessus) :
 * dégradés CSS et dessins SVG inline en data-URI, sans aucun fichier ni ressource externe.
 * Les dessins sont conçus pour la surface de référence 1920 × 1080 (le show est toujours rendu
 * à cette taille puis mis à l'échelle) et ne sont jamais animés : le navigateur les peint une
 * seule fois. Les zones du total, du titre et des dons restent calmes pour la lisibilité ;
 * les ornements vivent sur les bords et en bas de l'écran.
 */

const W = 1920;
const H = 1080;

/** Générateur pseudo-aléatoire déterministe : décor identique côté serveur et client. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const n = (v: number) => Math.round(v * 10) / 10;

function svg(body: string, viewBox = `0 0 ${W} ${H}`, ratio = "xMidYMid slice") {
  const markup = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' preserveAspectRatio='${ratio}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

/** Couche SVG couvrant toute la surface. */
const full = (body: string) => `${svg(body)} center / 100% 100% no-repeat`;
/** Couche SVG en motif répété (tuile de w × h px). */
const tile = (body: string, w: number, h: number) => `${svg(body, `0 0 ${w} ${h}`, "none")} 0 0 / ${w}px ${h}px repeat`;

function starField(seed: number, count: number, opts: { yMax: number; rMin: number; rMax: number; color?: string; oMin?: number; oMax?: number }) {
  const rand = rng(seed);
  const { yMax, rMin, rMax, color = "#ffffff", oMin = 0.25, oMax = 0.9 } = opts;
  let out = `<g fill='${color}'>`;
  for (let i = 0; i < count; i++) {
    const y = rand() ** 1.4 * yMax;
    out += `<circle cx='${n(rand() * W)}' cy='${n(y)}' r='${n(rMin + rand() * (rMax - rMin))}' opacity='${n(oMin + rand() * (oMax - oMin))}'/>`;
  }
  return out + "</g>";
}

/** Étoile à quatre branches centrée en (x, y). */
function sparkle(x: number, y: number, r: number) {
  const k = r * 0.22;
  return `M${n(x)} ${n(y - r)}L${n(x + k)} ${n(y - k)}L${n(x + r)} ${n(y)}L${n(x + k)} ${n(y + k)}L${n(x)} ${n(y + r)}L${n(x - k)} ${n(y + k)}L${n(x - r)} ${n(y)}L${n(x - k)} ${n(y - k)}Z`;
}

/** Ligne de crête lissée (collines, montagnes) fermée jusqu'en bas de l'écran. */
function ridge(points: Array<[number, number]>) {
  let d = `M0 ${H}L${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    d += `C${n(mx)} ${n(y0)} ${n(mx)} ${n(y1)} ${n(x1)} ${n(y1)}`;
  }
  return d + `L${W} ${H}Z`;
}

/* ─── Gala Premium ─────────────────────────────────────────────────────── */

function galaScene() {
  const rand = rng(11);
  let rays = "";
  for (let i = 0; i < 26; i++) {
    const a = ((22 + (i / 25) * 136) * Math.PI) / 180;
    const x = 960 + Math.cos(a) * 2600;
    const y = -160 + Math.sin(a) * 2600;
    rays += `<line x1='960' y1='-160' x2='${n(x)}' y2='${n(y)}' stroke-width='${n(1 + rand() * 2.4)}' opacity='${n(0.35 + rand() * 0.65)}'/>`;
  }
  const art = `<defs><linearGradient id='r' gradientUnits='userSpaceOnUse' x1='0' y1='-160' x2='0' y2='900'><stop offset='0' stop-color='#f3cf86' stop-opacity='0.2'/><stop offset='1' stop-color='#f3cf86' stop-opacity='0'/></linearGradient></defs>
<g stroke='url(#r)'>${rays}</g>
${starField(12, 70, { yMax: H, rMin: 0.8, rMax: 2.2, color: "#f1d08a", oMin: 0.15, oMax: 0.55 })}
<path d='M0 1040 Q960 960 1920 1040' fill='none' stroke='#e4b65c' stroke-opacity='0.28' stroke-width='2'/>
<path d='M0 1056 Q960 984 1920 1056' fill='none' stroke='#e4b65c' stroke-opacity='0.14' stroke-width='1'/>`;
  return [
    "radial-gradient(130% 110% at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.6) 100%)",
    full(art),
    "radial-gradient(60% 55% at 50% -5%, rgba(228, 182, 92, 0.3), transparent 70%)",
    "radial-gradient(55% 60% at 0% 100%, rgba(140, 92, 24, 0.32), transparent 70%)",
    "radial-gradient(45% 50% at 100% 100%, rgba(228, 182, 92, 0.14), transparent 70%)",
    "linear-gradient(180deg, #0f0b07 0%, #07060a 60%, #050406 100%)",
  ];
}

/* ─── Rideau de velours ────────────────────────────────────────────────── */

function veloursScene() {
  const drape = "M0 0H480C452 250 340 470 268 600C318 760 352 920 384 1080H0Z";
  let swags = "M0 0H1920V34";
  let fringe = "M1920 34";
  const count = 12;
  for (let i = count - 1; i >= 0; i--) {
    const x0 = ((i + 1) * W) / count;
    const x1 = (i * W) / count;
    swags += `Q${n((x0 + x1) / 2)} 74 ${n(x1)} 34`;
    fringe += `Q${n((x0 + x1) / 2)} 74 ${n(x1)} 34`;
  }
  swags += "Z";
  const side = (mirror: boolean) => `<g${mirror ? " transform='translate(1920 0) scale(-1 1)'" : ""}>
<path d='${drape}' fill='url(#f)'/><path d='${drape}' fill='url(#d)'/></g>`;
  const art = `<defs>
<linearGradient id='f' gradientUnits='userSpaceOnUse' x1='0' y1='0' x2='96' y2='0' spreadMethod='reflect'><stop offset='0' stop-color='#21030b'/><stop offset='0.55' stop-color='#5c0c1f'/><stop offset='1' stop-color='#7a1529'/></linearGradient>
<linearGradient id='d' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#000' stop-opacity='0.15'/><stop offset='0.75' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='0.55'/></linearGradient>
<linearGradient id='v' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2b040d'/><stop offset='1' stop-color='#6e1226'/></linearGradient>
<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f8dc95'/><stop offset='1' stop-color='#a8762a'/></linearGradient>
<linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffe9c4' stop-opacity='0.12'/><stop offset='1' stop-color='#ffe9c4' stop-opacity='0.02'/></linearGradient>
<radialGradient id='s'><stop offset='0' stop-color='#ffe4b0' stop-opacity='0.4'/><stop offset='1' stop-color='#ffe4b0' stop-opacity='0'/></radialGradient>
<linearGradient id='p' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2a0d07'/><stop offset='1' stop-color='#0b0403'/></linearGradient>
</defs>
<path d='M820 40H1100L1560 980H360Z' fill='url(#c)'/>
<rect x='0' y='962' width='1920' height='118' fill='url(#p)'/>
<line x1='0' y1='962' x2='1920' y2='962' stroke='#d9a94f' stroke-opacity='0.45' stroke-width='3'/>
<ellipse cx='960' cy='990' rx='640' ry='92' fill='url(#s)'/>
${side(false)}${side(true)}
<path d='${swags}' fill='url(#v)'/>
<path d='${fringe}' fill='none' stroke='url(#g)' stroke-width='5'/>
<path d='${fringe}' fill='none' stroke='#e6bd6a' stroke-width='16' stroke-dasharray='2 7' transform='translate(0 9)' opacity='0.8'/>`;
  return [
    full(art),
    "radial-gradient(55% 65% at 50% 40%, #3d0814 0%, #1a050c 55%, #0d0206 100%)",
  ];
}

/* ─── Art déco ─────────────────────────────────────────────────────────── */

function artdecoScene() {
  const arcs = (cx: number, cy: number) =>
    [46, 34, 22, 10].map((r) => `<path d='M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}'/>`).join("");
  const scales = `<g fill='none' stroke='#d9b25f' stroke-width='1.6' stroke-opacity='0.16'>${arcs(48, 48)}${arcs(0, 96)}${arcs(96, 96)}<path d='M0 48H96' stroke-opacity='0.06'/></g>`;
  let burst = "";
  for (let i = 0; i < 18; i++) {
    const a0 = Math.PI + (i / 18) * Math.PI;
    const a1 = a0 + Math.PI / 36;
    burst += `<path d='M960 1080L${n(960 + Math.cos(a0) * 620)} ${n(1080 + Math.sin(a0) * 620)}L${n(960 + Math.cos(a1) * 620)} ${n(1080 + Math.sin(a1) * 620)}Z'/>`;
  }
  const corner = `<path d='M26 230V26H230M44 200V44H200M62 150V62H150' fill='none' stroke='#d9b25f' stroke-width='2'/>
<path d='M80 80m0 70a70 70 0 0 1 70-70M80 80m0 48a48 48 0 0 1 48-48M80 80m0 26a26 26 0 0 1 26-26' fill='none' stroke='#d9b25f' stroke-width='1.6' opacity='0.8'/>`;
  const art = `<rect x='26' y='26' width='1868' height='1028' fill='none' stroke='#d9b25f' stroke-width='3' stroke-opacity='0.8'/>
<rect x='40' y='40' width='1840' height='1000' fill='none' stroke='#d9b25f' stroke-width='1' stroke-opacity='0.5'/>
<g fill='#d9b25f' opacity='0.08'>${burst}</g>
<g fill='none' stroke='#d9b25f'><path d='M760 1080A200 200 0 0 1 1160 1080' stroke-width='2' stroke-opacity='0.5'/><path d='M720 1080A240 240 0 0 1 1200 1080' stroke-width='1' stroke-opacity='0.35'/></g>
<g>${corner}</g><g transform='translate(1920 0) scale(-1 1)'>${corner}</g>
<g transform='translate(0 1080) scale(1 -1)'>${corner}</g><g transform='translate(1920 1080) scale(-1 -1)'>${corner}</g>
<path d='M900 26L960 8L1020 26L960 44Z' fill='#d9b25f' opacity='0.9'/>`;
  return [
    full(art),
    "radial-gradient(58% 58% at 50% 40%, rgba(11, 15, 26, 0.9) 0%, rgba(11, 15, 26, 0.55) 60%, rgba(11, 15, 26, 0.1) 100%)",
    tile(scales, 96, 96),
    "radial-gradient(60% 50% at 50% 0%, rgba(217, 178, 95, 0.16), transparent 70%)",
    "linear-gradient(180deg, #0f1525 0%, #0a0e19 60%, #070a12 100%)",
  ];
}

/* ─── Marbre et or ─────────────────────────────────────────────────────── */

function marbreScene() {
  const rand = rng(37);
  const vein = (gold: boolean) => {
    let x = rand() * W * 0.6 - 200;
    let y = rand() * H;
    const angle = (rand() - 0.5) * 0.9 - 0.25;
    let d = `M${n(x)} ${n(y)}`;
    for (let i = 0; i < 9; i++) {
      const step = 160 + rand() * 120;
      const nx = x + Math.cos(angle) * step;
      const ny = y + Math.sin(angle) * step + (rand() - 0.5) * 140;
      d += `Q${n(x + (nx - x) / 2 + (rand() - 0.5) * 90)} ${n(y + (ny - y) / 2 + (rand() - 0.5) * 90)} ${n(nx)} ${n(ny)}`;
      x = nx;
      y = ny;
    }
    return gold
      ? `<path d='${d}' stroke='#c79a3e' stroke-width='${n(2 + rand() * 2)}' opacity='0.75'/><path d='${d}' stroke='#f3dc97' stroke-width='0.8' opacity='0.9'/>`
      : `<path d='${d}' stroke='#6f655a' stroke-width='${n(0.8 + rand() * 2.6)}' opacity='${n(0.1 + rand() * 0.14)}'/>`;
  };
  let veins = "";
  for (let i = 0; i < 12; i++) veins += vein(false);
  for (let i = 0; i < 3; i++) veins += vein(true);
  const clouds = [
    [380, 260, 520, 220],
    [1500, 820, 620, 260],
    [1260, 180, 420, 160],
    [300, 900, 460, 200],
  ]
    .map(([cx, cy, rx, ry]) => `<ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' fill='url(#m)'/>`)
    .join("");
  const art = `<defs><radialGradient id='m'><stop offset='0' stop-color='#8c8273' stop-opacity='0.12'/><stop offset='1' stop-color='#8c8273' stop-opacity='0'/></radialGradient></defs>
${clouds}<g fill='none' stroke-linecap='round'>${veins}</g>
<rect x='28' y='28' width='1864' height='1024' fill='none' stroke='#b98d34' stroke-width='3'/>
<rect x='42' y='42' width='1836' height='996' fill='none' stroke='#b98d34' stroke-width='1' opacity='0.7'/>`;
  return [full(art), "radial-gradient(85% 75% at 30% 20%, #fdfaf4 0%, #f2ece1 60%, #e6ddcf 100%)"];
}

/* ─── Nuit sur Jérusalem ───────────────────────────────────────────────── */

function jerusalemScene() {
  const rand = rng(53);
  // Remparts crénelés, tours, coupoles et cyprès de la vieille ville (silhouette générique).
  let wall = `M0 ${H}V944`;
  for (let x = 0; x < W; x += 36) wall += `H${x + 6}V930H${x + 24}V944`;
  wall += `H${W}V${H}Z`;
  const shapes: string[] = [wall];
  const towers: Array<[number, number, number]> = [
    [120, 80, 150],
    [430, 64, 110],
    [700, 90, 190],
    [1180, 70, 130],
    [1460, 96, 200],
    [1760, 72, 120],
  ];
  for (const [x, w, h] of towers) {
    let d = `M${x} 944V${944 - h}`;
    for (let i = 0; i < w; i += 16) d += `H${x + i + 5}V${930 - h}H${x + i + 12}V${944 - h}`;
    shapes.push(`${d}H${x + w}V944Z`);
  }
  const domes: Array<[number, number, number]> = [
    [300, 54, 900],
    [960, 120, 860],
    [1320, 46, 900],
    [1640, 60, 890],
  ];
  for (const [cx, r, base] of domes) {
    shapes.push(`M${cx - r} 944V${base}A${r} ${r * 0.95} 0 0 1 ${cx + r} ${base}V944Z`);
    shapes.push(`M${cx - 3} ${n(base - r * 0.95)}V${n(base - r * 0.95 - 26)}H${cx + 3}V${n(base - r * 0.95)}Z`);
  }
  shapes.push("M890 944V860H1030V944Z");
  for (let i = 0; i < 9; i++) {
    const x = 60 + rand() * 1800;
    const h = 70 + rand() * 60;
    shapes.push(`M${n(x)} 950C${n(x - 14)} ${n(950 - h * 0.6)} ${n(x - 4)} ${n(950 - h)} ${n(x)} ${n(950 - h)}C${n(x + 4)} ${n(950 - h)} ${n(x + 14)} ${n(950 - h * 0.6)} ${n(x)} 950Z`);
  }
  let windows = "";
  for (let i = 0; i < 26; i++) windows += `<rect x='${n(rand() * 1880)}' y='${n(960 + rand() * 90)}' width='5' height='9' rx='2'/>`;
  const city = shapes.join("");
  const art = `<defs>
<radialGradient id='h' cx='0.5' cy='1' r='0.75'><stop offset='0' stop-color='#f2c55c' stop-opacity='0.62'/><stop offset='0.45' stop-color='#d98f4a' stop-opacity='0.22'/><stop offset='1' stop-color='#d98f4a' stop-opacity='0'/></radialGradient>
<linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#141a3a'/><stop offset='1' stop-color='#05071a'/></linearGradient>
</defs>
${starField(54, 120, { yMax: 760, rMin: 0.6, rMax: 2.2, oMin: 0.25, oMax: 0.95 })}
<rect x='0' y='560' width='1920' height='520' fill='url(#h)'/>
<path d='${ridge([[0, 900], [320, 872], [700, 890], [1100, 864], [1500, 884], [1920, 868]])}' fill='#e9b95a' opacity='0.16'/>
<path d='${city}' fill='none' stroke='#f2c55c' stroke-width='5' stroke-linejoin='round' stroke-opacity='0.85'/>
<path d='${city}' fill='url(#c)'/>
<g fill='#ffd88a' opacity='0.7'>${windows}</g>`;
  return [full(art), "linear-gradient(180deg, #03061a 0%, #0a1438 42%, #1d2250 70%, #4a3450 86%, #2a1d2e 100%)"];
}

/* ─── Bleu royal ───────────────────────────────────────────────────────── */

function royalScene() {
  const hex = `<path d='M0 34.64L20 0H60L80 34.64L60 69.28H20ZM80 34.64H120' fill='none' stroke='#9fbcff' stroke-width='1.5' stroke-opacity='0.16'/>
<g fill='#f4c95d' fill-opacity='0.3'><circle cx='20' cy='0' r='2'/><circle cx='60' cy='69.28' r='2'/><circle cx='120' cy='34.64' r='2'/></g>`;
  const band = (y: number) => `<line x1='60' y1='${y}' x2='1860' y2='${y}' stroke='#f4c95d' stroke-width='2' stroke-opacity='0.55'/>
<line x1='60' y1='${y + 9}' x2='1860' y2='${y + 9}' stroke='#f4c95d' stroke-width='1' stroke-opacity='0.35'/>
<path d='M940 ${y + 4.5}L960 ${y - 10}L980 ${y + 4.5}L960 ${y + 19}Z' fill='#f4c95d' opacity='0.85'/>`;
  return [
    full(`${band(36)}${band(1034)}`),
    "radial-gradient(62% 60% at 50% 42%, rgba(11, 33, 106, 0.94) 0%, rgba(11, 33, 106, 0.55) 62%, rgba(11, 33, 106, 0) 92%)",
    tile(hex, 120, 69.28),
    "radial-gradient(60% 50% at 50% 0%, rgba(100, 150, 255, 0.35), transparent 70%)",
    "radial-gradient(120% 100% at 50% 30%, #14329c 0%, #0a1f66 55%, #050f3a 100%)",
  ];
}

/* ─── Émeraude ─────────────────────────────────────────────────────────── */

function emeraudeScene() {
  const flourish = `<path d='M32 260C32 130 130 32 260 32' fill='none' stroke='#e8c46a' stroke-width='2.4'/>
<path d='M58 220C58 128 128 58 220 58' fill='none' stroke='#e8c46a' stroke-width='1.2' opacity='0.7'/>
<path d='M96 96C130 60 186 70 196 112C204 148 160 160 146 132C136 112 158 100 168 112' fill='none' stroke='#e8c46a' stroke-width='1.8'/>
<path d='M300 32C318 22 336 22 354 32C336 42 318 42 300 32Z M32 300C22 318 22 336 32 354C42 336 42 318 32 300Z' fill='#e8c46a' opacity='0.8'/>`;
  const art = `<rect x='32' y='32' width='1856' height='1016' fill='none' stroke='#e8c46a' stroke-width='1.5' stroke-opacity='0.5'/>
<g>${flourish}</g><g transform='translate(1920 0) scale(-1 1)'>${flourish}</g>
<g transform='translate(0 1080) scale(1 -1)'>${flourish}</g><g transform='translate(1920 1080) scale(-1 -1)'>${flourish}</g>
<g fill='#ffffff' opacity='0.035'><path d='M0 1080L700 0H980L260 1080Z'/><path d='M1240 1080L1920 120V520L1600 1080Z'/></g>`;
  return [
    full(art),
    "linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0.05) 18%, transparent 32%, rgba(255, 255, 255, 0.035) 54%, transparent 66%, rgba(255, 255, 255, 0.05) 84%, transparent 96%)",
    "radial-gradient(70% 60% at 50% 0%, rgba(40, 190, 130, 0.32), transparent 70%)",
    "radial-gradient(60% 60% at 100% 100%, rgba(232, 196, 106, 0.12), transparent 70%)",
    "radial-gradient(130% 110% at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.45) 100%)",
    "linear-gradient(160deg, #05402f 0%, #032c21 50%, #021a14 100%)",
  ];
}

/* ─── Aurore boréale ───────────────────────────────────────────────────── */

function auroreScene() {
  let curtain = "";
  for (let i = 0; i < 120; i++) {
    const x = i * 16;
    const y = 120 + 80 * Math.sin(i / 17) + 36 * Math.sin(i / 6.3);
    const h = 260 + 150 * Math.sin(i / 11 + 1) ** 2;
    const side = Math.abs(x - 960) / 960;
    const o = (0.3 + 0.7 * side) * (0.55 + 0.45 * Math.sin(i / 3.7) ** 2);
    curtain += `<rect x='${x}' y='${n(y)}' width='17' height='${n(h)}' opacity='${n(o)}'/>`;
  }
  const rand = rng(71);
  const far: Array<[number, number]> = [];
  const near: Array<[number, number]> = [];
  for (let x = 0; x <= W; x += 160) {
    far.push([x, 860 - rand() * 120]);
    near.push([x, 950 - rand() * 80]);
  }
  const art = `<defs><linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b48cff' stop-opacity='0'/><stop offset='0.22' stop-color='#b48cff' stop-opacity='0.3'/><stop offset='0.5' stop-color='#6ff2c1' stop-opacity='0.55'/><stop offset='1' stop-color='#6ff2c1' stop-opacity='0'/></linearGradient></defs>
${starField(72, 90, { yMax: 820, rMin: 0.6, rMax: 1.9, oMin: 0.2, oMax: 0.8 })}
<g fill='url(#a)'>${curtain}</g>
<path d='${ridge(far)}' fill='#071a2c'/>
<path d='${ridge(near)}' fill='#020a14'/>`;
  return [
    full(art),
    "radial-gradient(80% 50% at 50% 100%, rgba(60, 200, 160, 0.16), transparent 70%)",
    "linear-gradient(180deg, #020814 0%, #04172a 55%, #0a2a3a 82%, #04121d 100%)",
  ];
}

/* ─── Féerie ───────────────────────────────────────────────────────────── */

function feerieScene() {
  const rand = rng(91);
  let sparkles = "";
  for (let i = 0; i < 14; i++) sparkles += `<path d='${sparkle(rand() * W, rand() ** 1.3 * 760, 6 + rand() * 12)}' opacity='${n(0.35 + rand() * 0.5)}'/>`;
  const cloud = (y: number, seed: number, color: string, o: number) => {
    const r = rng(seed);
    let c = "";
    for (let x = -80; x < W + 160; x += 120 + r() * 80) c += `<circle cx='${n(x)}' cy='${n(y + r() * 40)}' r='${n(90 + r() * 90)}'/>`;
    return `<g fill='${color}' opacity='${o}'>${c}</g>`;
  };
  const art = `${starField(92, 130, { yMax: 900, rMin: 0.7, rMax: 2.4, oMin: 0.3, oMax: 1 })}
<g fill='#ffe58a'>${sparkles}</g>
${cloud(1040, 93, "#7a3fd0", 0.28)}${cloud(1110, 94, "#2c1060", 0.9)}`;
  return [
    full(art),
    "radial-gradient(50% 40% at 78% 18%, rgba(255, 107, 208, 0.22), transparent 70%)",
    "radial-gradient(60% 50% at 18% 30%, rgba(120, 60, 220, 0.38), transparent 70%)",
    "linear-gradient(180deg, #0c0522 0%, #1d0b48 55%, #3a1474 100%)",
  ];
}

/* ─── Feux d'artifice ──────────────────────────────────────────────────── */

function feuxScene() {
  const rand = rng(131);
  const burst = (cx: number, cy: number, R: number, color: string, o: number) => {
    let rays = "";
    const count = 30;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.08;
      const r1 = R * (0.22 + rand() * 0.12);
      const r2 = R * (0.82 + rand() * 0.22);
      const x2 = cx + Math.cos(a) * r2;
      const y2 = cy + Math.sin(a) * r2;
      rays += `<line x1='${n(cx + Math.cos(a) * r1)}' y1='${n(cy + Math.sin(a) * r1)}' x2='${n(x2)}' y2='${n(y2)}'/><circle cx='${n(x2)}' cy='${n(y2)}' r='${n(2 + rand() * 2.5)}' stroke='none'/>`;
    }
    const glow = color.slice(1);
    return `<circle cx='${cx}' cy='${cy}' r='${n(R * 1.1)}' fill='url(#g${glow})' opacity='${n(o * 0.8)}'/>
<g stroke='${color}' fill='${color}' stroke-width='2.4' stroke-linecap='round' opacity='${o}'>${rays}</g>`;
  };
  const glows = ["#ffd166", "#ff7eb6", "#7fe3ff"]
    .map((c) => `<radialGradient id='g${c.slice(1)}'><stop offset='0' stop-color='${c}' stop-opacity='0.35'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`)
    .join("");
  const art = `<defs>${glows}</defs>
${starField(132, 80, { yMax: H, rMin: 0.6, rMax: 1.8, oMin: 0.2, oMax: 0.7 })}
${burst(220, 930, 200, "#ffd166", 0.75)}
${burst(600, 1020, 130, "#ff7eb6", 0.6)}
${burst(1640, 760, 260, "#7fe3ff", 0.55)}
${burst(1240, 930, 180, "#ffd166", 0.5)}
${burst(1890, 60, 130, "#ff7eb6", 0.3)}
${burst(520, 40, 90, "#7fe3ff", 0.22)}`;
  return [
    full(art),
    "radial-gradient(70% 50% at 50% 100%, rgba(255, 126, 182, 0.16), transparent 70%)",
    "linear-gradient(180deg, #070516 0%, #120b30 55%, #2a1450 100%)",
  ];
}

/* ─── Coucher de soleil ────────────────────────────────────────────────── */

function sunsetScene() {
  const hill = (seed: number, left: number, right: number, amp: number) => {
    const r = rng(seed);
    const pts: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 240) pts.push([x, left + ((right - left) * x) / W + (r() - 0.5) * amp]);
    return ridge(pts);
  };
  const art = `<defs>
<radialGradient id='s'><stop offset='0' stop-color='#fff4c8'/><stop offset='0.6' stop-color='#ffc35a'/><stop offset='1' stop-color='#ff8a5b'/></radialGradient>
<radialGradient id='g'><stop offset='0' stop-color='#ffc06e' stop-opacity='0.45'/><stop offset='1' stop-color='#ffc06e' stop-opacity='0'/></radialGradient>
</defs>
<circle cx='1180' cy='930' r='560' fill='url(#g)'/>
<circle cx='1180' cy='930' r='210' fill='url(#s)'/>
<g fill='#ffb0b8' opacity='0.18'><ellipse cx='1500' cy='620' rx='360' ry='12'/><ellipse cx='1100' cy='700' rx='300' ry='10'/></g>
<path d='${hill(5, 760, 880, 60)}' fill='#8a2f6c' opacity='0.92'/>
<path d='${hill(6, 840, 950, 50)}' fill='#4f1552'/>
<path d='${hill(7, 930, 1010, 40)}' fill='#250a33'/>`;
  return [full(art), "linear-gradient(180deg, #160a33 0%, #3a1450 30%, #8a2a6a 56%, #e0566a 72%, #ff9a5a 84%, #ffc36b 100%)"];
}

/* ─── Nature ───────────────────────────────────────────────────────────── */

function natureScene() {
  const leaf = (L: number, w: number) => `M0 0C${n(L * 0.3)} ${-w} ${n(L * 0.7)} ${-w} ${L} 0C${n(L * 0.7)} ${w} ${n(L * 0.3)} ${w} 0 0Z`;
  const branch = (p0: [number, number], p1: [number, number], p2: [number, number], count: number, size: number) => {
    let out = `<path d='M${p0[0]} ${p0[1]}Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}' fill='none' stroke='#0e4a2a' stroke-width='5'/>`;
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const a = (Math.atan2(dy, dx) * 180) / Math.PI + (i % 2 ? -52 : 52);
      const L = size * (1 - t * 0.45);
      out += `<path d='${leaf(L, L * 0.28)}' transform='translate(${n(x)} ${n(y)}) rotate(${n(a)})' fill='url(#l)'/>`;
    }
    return out;
  };
  const art = `<defs><linearGradient id='l' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#0b3d22'/><stop offset='1' stop-color='#22743f'/></linearGradient>
<linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#eaffc2' stop-opacity='0.09'/><stop offset='1' stop-color='#eaffc2' stop-opacity='0'/></linearGradient></defs>
<g fill='url(#b)'><path d='M140 0H300L900 1080H560Z'/><path d='M420 0H500L1260 1080H1080Z'/></g>
<g opacity='0.85'>${branch([-40, 1120], [260, 900], [380, 640], 9, 150)}${branch([-60, 900], [120, 820], [200, 700], 5, 100)}</g>
<g opacity='0.7'>${branch([1980, -40], [1820, 220], [1880, 470], 8, 130)}</g>
<g opacity='0.6'>${branch([1980, 1120], [1700, 1010], [1560, 860], 6, 120)}</g>`;
  return [
    full(art),
    "radial-gradient(60% 60% at 20% 0%, rgba(166, 227, 95, 0.2), transparent 70%)",
    "radial-gradient(70% 60% at 100% 100%, rgba(21, 92, 52, 0.55), transparent 70%)",
    "linear-gradient(180deg, #06231a 0%, #03150d 100%)",
  ];
}

/* ─── Moderne ──────────────────────────────────────────────────────────── */

function moderneScene() {
  const dots = `<circle cx='2' cy='2' r='2' fill='#1f5fe0' fill-opacity='0.13'/>`;
  const art = `<defs><radialGradient id='o'><stop offset='0' stop-color='#57a2ff' stop-opacity='0.3'/><stop offset='1' stop-color='#57a2ff' stop-opacity='0'/></radialGradient></defs>
<circle cx='1740' cy='110' r='460' fill='url(#o)'/>
<circle cx='160' cy='1010' r='560' fill='#1f5fe0' fill-opacity='0.06'/>
<g fill='none' stroke='#1f5fe0'><circle cx='1740' cy='110' r='300' stroke-opacity='0.12' stroke-width='2'/><circle cx='1740' cy='110' r='390' stroke-opacity='0.07' stroke-width='2'/>
<circle cx='160' cy='1010' r='360' stroke-opacity='0.12' stroke-width='2'/><circle cx='160' cy='1010' r='450' stroke-opacity='0.06' stroke-width='2'/></g>
<path d='M0 820L1920 300V380L0 900Z' fill='#ffffff' opacity='0.35'/>`;
  return [
    full(art),
    // Voile qui limite la grille de points au bas de l'écran (le haut reste net pour le total).
    "linear-gradient(180deg, #f1f6ff 0%, rgba(238, 244, 255, 0.94) 50%, rgba(232, 240, 255, 0.35) 100%)",
    tile(dots, 36, 36),
    "linear-gradient(160deg, #f7faff 0%, #e8f0ff 55%, #d4e3ff 100%)",
  ];
}

/* ─── Minimaliste ──────────────────────────────────────────────────────── */

function minimalScene() {
  const art = `<g fill='none'><circle cx='1760' cy='1080' r='560' stroke='#141414' stroke-opacity='0.07' stroke-width='2'/>
<circle cx='1760' cy='1080' r='430' stroke='#141414' stroke-opacity='0.05' stroke-width='2'/>
<circle cx='1760' cy='1080' r='560' stroke='#e0482d' stroke-width='6' stroke-dasharray='220 3300' stroke-dashoffset='-1880' stroke-linecap='round'/></g>
<rect x='61' y='1010' width='120' height='4' fill='#e0482d'/>`;
  return [full(art), "linear-gradient(180deg, #f7f4ee 0%, #efe9df 100%)"];
}

const BUILDERS: Record<ThemeId, () => string[]> = {
  gala: galaScene,
  velours: veloursScene,
  artdeco: artdecoScene,
  marbre: marbreScene,
  jerusalem: jerusalemScene,
  royal: royalScene,
  emeraude: emeraudeScene,
  aurore: auroreScene,
  feerie: feerieScene,
  feux: feuxScene,
  sunset: sunsetScene,
  nature: natureScene,
  moderne: moderneScene,
  minimal: minimalScene,
};

const cache = new Map<ThemeId, string>();

/** Valeur CSS `background` du décor d'un arrière-plan (calculée une seule fois). */
export function sceneBackground(id: ThemeId): string {
  let value = cache.get(id);
  if (!value) {
    value = (BUILDERS[id] ?? BUILDERS.gala)().join(", ");
    cache.set(id, value);
  }
  return value;
}
