Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<title>🎾 Tennis Predict</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
:root {
  --bg:#0f0f14; --card:#1a1a24; --border:#2a2a3a; --accent:#4fc3f7;
  --accent2:#0288d1; --text:#e0e0e0; --sub:#888; --muted:#555;
}
html,body { height:100%; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; overflow:hidden; }
#root { display:flex; flex-direction:column; height:100%; max-width:520px; margin:0 auto; position:relative; }

/* NAV */
.nav { background:var(--card); border-bottom:1px solid var(--border); padding:12px 18px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
.nav-logo { display:flex; align-items:center; gap:6px; font-size:17px; font-weight:800; }
.nav-logo span { color:var(--accent); }
.tour-toggle { display:flex; background:var(--bg); border:1px solid var(--border); border-radius:20px; padding:3px; gap:2px; }
.tour-btn { padding:5px 14px; border-radius:16px; border:none; font-size:12px; font-weight:700; cursor:pointer; background:transparent; color:var(--sub); transition:all .2s; }
.tour-btn.active { background:var(--accent); color:#000; }

/* TABS */
.tabs { display:flex; background:var(--card); border-bottom:1px solid var(--border); flex-shrink:0; }
.tab { flex:1; padding:11px 8px 9px; text-align:center; font-size:12px; font-weight:600; color:var(--sub); cursor:pointer; border-bottom:2px solid transparent; transition:all .2s; }
.tab.active { color:var(--accent); border-bottom-color:var(--accent); }

/* DATE NAV */
.date-nav { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:var(--card); border-bottom:1px solid var(--border); flex-shrink:0; gap:8px; }
.dnav-btn { background:var(--bg); border:1px solid var(--border); color:var(--accent); border-radius:20px; padding:7px 16px; font-size:13px; font-weight:700; cursor:pointer; flex-shrink:0; transition:all .15s; }
.dnav-btn:hover { background:var(--accent); color:#000; border-color:var(--accent); }
.dnav-btn:disabled { opacity:.3; cursor:not-allowed; }
.date-center { flex:1; text-align:center; }
.date-main { font-size:14px; font-weight:700; color:var(--text); }
.date-sub { font-size:11px; color:var(--sub); margin-top:1px; }

/* SCREENS */
.screen { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; display:none; }
.screen.active { display:block; }
.screen-inner { padding:16px; padding-bottom:40px; }

/* CARDS */
.card { background:var(--card); border:1px solid var(--border); border-radius:16px; margin-bottom:12px; overflow:hidden; }
.card-p { padding:16px; }

/* PILLS */
.pill { display:inline-block; font-size:10px; font-weight:700; padding:3px 10px; border-radius:8px; letter-spacing:.5px; text-transform:uppercase; }
.pill-Hard { background:#1565c033; color:#90caf9; }
.pill-Clay { background:#ff8f0033; color:#ffcc80; }
.pill-Grass { background:#43a04733; color:#a5d6a7; }
.pill-Indoor { background:#6a1b9a33; color:#ce93d8; }

/* FIXTURE CARD */
.fix-card { cursor:pointer; transition:border-color .15s, transform .1s; }
.fix-card:hover { border-color:var(--accent); transform:translateY(-1px); }
.fix-card:active { transform:scale(.98); }
.fix-meta { display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:11px; }
.fix-tourn { font-size:11px; color:var(--muted); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fix-tag { font-size:10px; color:var(--muted); }
.players-row { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.pcol { flex:1; }
.pcol.right { text-align:right; }
.pnm { font-size:14px; font-weight:600; color:var(--text); line-height:1.2; }
.pseed { font-size:10px; color:var(--sub); margin-top:2px; }
.vs-badge { font-size:10px; font-weight:700; color:var(--muted); background:var(--bg); padding:4px 8px; border-radius:8px; border:1px solid var(--border); }
.bar-labels { display:flex; justify-content:space-between; margin-bottom:4px; }
.bar-lbl { font-size:12px; color:var(--sub); }
.bar-lbl.w { color:var(--accent); font-weight:700; }
.prob-track { height:6px; background:var(--border); border-radius:3px; overflow:hidden; }
.prob-fill { height:100%; background:linear-gradient(90deg,var(--accent2),var(--accent)); border-radius:3px; }
.set-lbl { font-size:11px; color:var(--sub); text-align:center; margin-top:5px; }
.pred-loading { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--sub); }
.mini-spin { width:14px; height:14px; border:2px solid #333; border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }

/* DETAIL */
.detail { position:fixed; inset:0; max-width:520px; margin:0 auto; background:var(--bg); z-index:300; overflow-y:auto; -webkit-overflow-scrolling:touch; transform:translateX(100%); transition:transform .3s cubic-bezier(.4,0,.2,1); }
.detail.open { transform:none; }
.detail-nav { display:flex; align-items:center; gap:12px; padding:14px 18px; background:var(--card); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:10; }
.back-btn { background:var(--border); border:none; color:var(--accent); padding:7px 14px; border-radius:18px; font-size:13px; font-weight:600; cursor:pointer; }
.detail-body { padding:16px; padding-bottom:48px; }

/* WINNER HERO */
.hero { background:linear-gradient(135deg,#0d2137,#0a3d62); border:1px solid #1565c0; border-radius:20px; padding:24px 20px; text-align:center; margin-bottom:16px; }
.hero-lbl { font-size:11px; color:var(--accent); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px; }
.hero-nm { font-size:24px; font-weight:800; margin-bottom:4px; }
.hero-pct { font-size:44px; font-weight:900; color:var(--accent); line-height:1; margin-bottom:8px; }
.hero-sub { font-size:13px; color:var(--sub); }

/* PLAYER COMPARE */
.cmp-grid { display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center; margin-bottom:16px; }
.cmp-p { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:14px; text-align:center; }
.cmp-p.win { border-color:var(--accent); }
.cmp-nm { font-size:13px; font-weight:700; line-height:1.2; margin-bottom:4px; }
.cmp-rank { font-size:11px; color:var(--sub); margin-bottom:8px; }
.cmp-elo { font-size:22px; font-weight:900; color:var(--accent); }
.cmp-elo-lbl { font-size:9px; color:var(--muted); }
.cmp-ctry { font-size:10px; color:var(--muted); margin-top:4px; }
.vs-circle { width:38px; height:38px; background:var(--card); border:1px solid var(--border); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:var(--muted); flex-shrink:0; }

/* SECTION */
.sec { font-size:11px; font-weight:700; color:var(--sub); letter-spacing:.5px; text-transform:uppercase; margin:4px 0 10px; }

/* CONTEXT */
.ctx-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:16px; margin-bottom:12px; }
.chips { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; margin-bottom:12px; scrollbar-width:none; }
.chips::-webkit-scrollbar { display:none; }
.chip { background:var(--bg); border:1px solid var(--border); border-radius:20px; padding:6px 12px; font-size:12px; white-space:nowrap; color:var(--text); flex-shrink:0; }
.factor-row { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-top:1px solid var(--border); }
.factor-info { flex:1; }
.fnm { font-size:13px; font-weight:600; color:var(--text); margin-bottom:2px; }
.fimp { font-size:11px; color:var(--sub); }
.ffav { font-size:11px; font-weight:700; color:var(--accent); text-align:right; max-width:110px; }

/* MODEL GRID */
.model-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
.model-card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:12px; }
.mnm { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px; margin-bottom:8px; }
.mtrack { height:4px; background:var(--border); border-radius:2px; overflow:hidden; margin-bottom:6px; }
.mfill { height:100%; background:var(--accent); border-radius:2px; }
.mprobs { display:flex; justify-content:space-between; font-size:12px; }
.mp1 { color:var(--accent); font-weight:700; }
.mp2 { color:var(--sub); }

/* STATS */
.stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
.stat-box { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:12px 8px; text-align:center; }
.sv { font-size:20px; font-weight:800; color:var(--text); }
.sl { font-size:9px; color:var(--muted); margin-top:4px; text-transform:uppercase; letter-spacing:.3px; }

/* CONFIDENCE */
.conf-row { display:flex; align-items:center; justify-content:space-between; background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px 16px; margin-bottom:12px; }
.conf-lbl { font-size:14px; font-weight:600; }
.conf-sub { font-size:11px; color:var(--sub); margin-top:2px; }
.badge { padding:4px 14px; border-radius:10px; font-size:12px; font-weight:700; }
.badge-High { background:#1b5e20; color:#69f0ae; }
.badge-Medium { background:#e65100; color:#ffcc80; }
.badge-Low { background:#4a148c; color:#e040fb; }

/* H2H */
.h2h-card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px; margin-bottom:12px; }
.h2h-scores { display:flex; justify-content:space-around; align-items:flex-end; margin-bottom:12px; }
.h2h-score { font-size:36px; font-weight:900; }
.h2h-score.w { color:var(--accent); }
.h2h-pnm { font-size:11px; color:var(--sub); text-align:center; }
.h2h-dash { font-size:24px; color:var(--muted); align-self:center; margin-bottom:8px; }
.h2h-track { height:6px; background:var(--border); border-radius:3px; overflow:hidden; margin-bottom:8px; }
.h2h-fill { height:100%; background:var(--accent); }
.h2h-total { font-size:11px; color:var(--muted); text-align:center; }

/* PICKER FORM */
.form-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:18px; margin-bottom:12px; }
.form2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
.fgrp { display:flex; flex-direction:column; gap:6px; }
.flbl { font-size:10px; font-weight:700; color:var(--sub); text-transform:uppercase; letter-spacing:.4px; }
.finput { background:var(--bg); border:1px solid var(--border); color:var(--text); padding:10px 14px; border-radius:10px; font-size:15px; outline:none; -webkit-appearance:none; }
.finput:focus { border-color:var(--accent); }
.surf-row { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
.surf-row::-webkit-scrollbar { display:none; }
.surf-btn { background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; color:var(--sub); white-space:nowrap; }
.surf-btn.active { background:var(--border); color:var(--text); }
.bo-row { display:flex; gap:10px; }
.bo-btn { flex:1; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px; text-align:center; font-size:14px; font-weight:700; cursor:pointer; color:var(--sub); }
.bo-btn.active { background:var(--accent); color:#000; border-color:var(--accent); }
.run-btn { width:100%; padding:14px; background:linear-gradient(135deg,var(--accent2),var(--accent)); border:none; border-radius:12px; color:#000; font-size:15px; font-weight:800; cursor:pointer; margin-top:4px; }
.run-btn:disabled { opacity:.5; cursor:not-allowed; }
.ferr { color:#ff5252; font-size:12px; padding:4px 0; }
.quick-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 0; }
.quick-item { display:flex; justify-content:space-between; align-items:center; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; cursor:pointer; }
.quick-item:hover { border-color:var(--accent); }
.qnm { font-size:13px; font-weight:600; }
.qid { font-size:12px; color:var(--accent); }
.quick-hint { font-size:11px; color:var(--muted); margin-top:6px; }

/* RANKINGS */
.rank-list { background:var(--card); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
.rank-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); }
.rank-row:last-child { border-bottom:none; }
.rnum { font-size:15px; font-weight:800; color:var(--accent); width:28px; text-align:center; flex-shrink:0; }
.rnum.gold { color:#ffd700; } .rnum.silver { color:#c0c0c0; } .rnum.bronze { color:#cd7f32; }
.rinfo { flex:1; }
.rnm { font-size:14px; font-weight:600; }
.rctry { font-size:11px; color:var(--sub); margin-top:1px; }
.rpts { font-size:13px; font-weight:700; color:var(--sub); }

/* UTILS */
.spinner-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:60px 20px; }
.big-spin { width:32px; height:32px; border:3px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; }
.spin-msg { font-size:14px; color:var(--sub); }
.empty { text-align:center; padding:60px 20px; }
.empty-icon { font-size:48px; display:block; margin-bottom:12px; }
.empty-msg { font-size:14px; color:var(--sub); }
@keyframes spin { to { transform:rotate(360deg); } }
::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
</style>
</head>
<body>
<div id="root">
  <div class="nav">
    <div class="nav-logo">🎾 <span>Tennis</span>&nbsp;Predict</div>
    <div class="tour-toggle">
      <button class="tour-btn active" onclick="setTour('atp',this)">ATP</button>
      <button class="tour-btn" onclick="setTour('wta',this)">WTA</button>
    </div>
  </div>
  <div class="tabs">
    <div class="tab active" onclick="setTab('fixtures',this)">📅 Today</div>
    <div class="tab" onclick="setTab('picker',this)">🎯 Matchup</div>
    <div class="tab" onclick="setTab('rankings',this)">📊 Rankings</div>
  </div>
  <div class="date-nav" id="date-nav">
    <button class="dnav-btn" id="prev-btn" onclick="shiftDate(-1)">‹ Prev</button>
    <div class="date-center">
      <div class="date-main" id="date-main">Today</div>
      <div class="date-sub" id="date-sub"></div>
    </div>
    <button class="dnav-btn" id="next-btn" onclick="shiftDate(1)">Next ›</button>
  </div>

  <div class="screen active" id="screen-fixtures">
    <div class="screen-inner" id="fix-content">
      <div class="spinner-wrap"><div class="big-spin"></div><div class="spin-msg">Loading matches…</div></div>
    </div>
  </div>

  <div class="screen" id="screen-picker">
    <div class="screen-inner">
      <div class="form-card">
        <div class="form2">
          <div class="fgrp"><label class="flbl">Player 1 ID</label><input class="finput" id="p1in" type="number" value="47275" placeholder="e.g. 47275"/></div>
          <div class="fgrp"><label class="flbl">Player 2 ID</label><input class="finput" id="p2in" type="number" value="68074" placeholder="e.g. 68074"/></div>
        </div>
        <div class="fgrp" style="margin-bottom:14px">
          <label class="flbl">Surface</label>
          <div class="surf-row">
            <button class="surf-btn" onclick="setSurf('Hard',this)"><span class="pill pill-Hard">Hard</span></button>
            <button class="surf-btn active" onclick="setSurf('Clay',this)"><span class="pill pill-Clay">Clay</span></button>
            <button class="surf-btn" onclick="setSurf('Grass',this)"><span class="pill pill-Grass">Grass</span></button>
            <button class="surf-btn" onclick="setSurf('Indoor Hard',this)"><span class="pill pill-Indoor">Indoor</span></button>
          </div>
        </div>
        <div class="fgrp" style="margin-bottom:14px">
          <label class="flbl">Best Of</label>
          <div class="bo-row">
            <button class="bo-btn active" id="bo3" onclick="setBo(3)">Bo3</button>
            <button class="bo-btn" id="bo5" onclick="setBo(5)">Bo5</button>
          </div>
        </div>
        <div class="ferr" id="picker-err"></div>
        <button class="run-btn" id="run-btn" onclick="runPicker()">⚡ Run Prediction</button>
      </div>
      <div class="form-card">
        <div class="flbl" style="margin-bottom:8px">Quick Player IDs</div>
        <div class="quick-grid" id="quick-grid"></div>
        <div class="quick-hint">Tap to fill Player 1 → then Player 2</div>
      </div>
    </div>
  </div>

  <div class="screen" id="screen-rankings">
    <div class="screen-inner" id="rank-content">
      <div class="spinner-wrap"><div class="big-spin"></div><div class="spin-msg">Loading rankings…</div></div>
    </div>
  </div>

  <div class="detail" id="detail">
    <div class="detail-nav">
      <button class="back-btn" onclick="closeDetail()">← Back</button>
      <div style="font-size:16px;font-weight:700">Match Prediction</div>
    </div>
    <div class="detail-body" id="detail-body">
      <div class="spinner-wrap"><div class="big-spin"></div><div class="spin-msg">Running models…</div></div>
    </div>
  </div>
</div>

<script>
// ─── CONFIG ──────────────────────────────────────────────────────────────────
const KEY = 'dbc967df17msh7bb8135c5d858c3p138f49jsn106697ef9b98';
const BASE = 'https://tennis-api-atp-wta-itf.p.rapidapi.com';
const HDR = { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'tennis-api-atp-wta-itf.p.rapidapi.com' };

const SURFACE_MAP = { 1:'Hard', 2:'Clay', 3:'Grass', 4:'Indoor Hard' };
const CITY_COORDS = {
  'FRA':[48.85,2.35],'GBR':[51.5,-0.12],'USA':[40.71,-74.0],'AUS':[-37.81,144.96],
  'ESP':[40.41,-3.7],'ITA':[41.9,12.5],'GER':[52.52,13.4],'CHN':[31.23,121.47],
  'MON':[43.73,7.42],'CAN':[45.5,-73.57],'ARG':[-34.6,-58.38],'BRA':[-23.55,-46.63],
  'QAT':[25.29,51.53],'UAE':[25.2,55.27],'MAR':[33.99,-6.85],'JPN':[35.69,139.69],
  'DEF':[48.85,2.35]
};
const QUICK_PICKS = [
  {name:'Sinner',id:47275},{name:'Alcaraz',id:68074},
  {name:'Zverev',id:24008},{name:'Djokovic',id:5992},
  {name:'FAA',id:40434},{name:'Shelton',id:87562},
  {name:'Medvedev',id:36592},{name:'Fritz',id:53489},
];

// ─── STATE ──────────────────────────────────────────────────────────────────
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const state = {
  tour:'atp', tab:'fixtures', surface:'Clay', bestOf:3,
  selectedDate: new Date(TODAY),
  fixtures:[], predictions:{}, rankCache:new Map(), rankingsLoaded:false,
};

// ─── API ────────────────────────────────────────────────────────────────────
async function apiFetch(path, params={}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const r = await fetch(url, { headers: HDR });
  if (!r.ok) throw new Error(\`API error \${r.status}\`);
  return r.json();
}
function toList(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d==='object' && Array.isArray(d.data)) return d.data;
  return [];
}

async function fetchFixtures(tour, date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const isToday = date === fmtDate(today);
  const path = isToday
    ? \`/tennis/v2/\${tour}/fixtures\`
    : \`/tennis/v2/\${tour}/fixtures/\${date}\`;
  return toList(await apiFetch(path, {
    include:'round,tournament.court,tournament.rank,h2h',
    filter:'PlayerGroup:singles',
    pageSize:50, pageNo:1
  }));
}

async function fetchRankings(tour) {
  return toList(await apiFetch(\`/tennis/v2/\${tour}/ranking/singles\`, { pageSize:200 }));
}

async function buildRankCache(tour) {
  if (state.rankCache.size && state.rankCacheTour === tour) return;
  const rows = await fetchRankings(tour);
  state.rankCache.clear();
  rows.forEach(e => {
    const p = e.player || e;
    const id = p.id;
    if (id) state.rankCache.set(id, { rank: e.position||e.rank, pts: e.point||e.points, name: p.name, country: p.countryAcr||p.country });
  });
  state.rankCacheTour = tour;
}

async function getPlayerStats(pid, tour) {
  const rc = state.rankCache;
  const re = rc.get(pid) || {};
  const def = tour === 'atp'
    ? {fp:0.62,w1:0.73,w2:0.52,bps:0.62,bpc:0.38,ace:0.8,df:0.3}
    : {fp:0.60,w1:0.68,w2:0.47,bps:0.57,bpc:0.43,ace:0.2,df:0.5};
  const rank = re.rank || 999;
  // Scale stats from rank (top players have better stats)
  const boost = Math.max(0, Math.min(0.12, (200 - rank) / 200 * 0.12));
  return {
    id: pid, name: re.name || \`Player #\${pid}\`,
    rank, pts: re.pts || 0, country: re.country || '',
    elo: Math.round(1500 + Math.max(0, (200 - rank) * 1.5)),
    ...def,
    fp: Math.min(0.72, def.fp + boost),
    w1: Math.min(0.82, def.w1 + boost),
    ace: def.ace + boost * 2,
  };
}

async function getH2H(p1id, p2id, tour) {
  try {
    const d = await apiFetch(\`/tennis/v2/\${tour}/h2h\`, { player1Id:p1id, player2Id:p2id, pageSize:20 });
    const list = toList(d);
    if (!list.length) return null;
    let p1w=0, p2w=0;
    list.forEach(m => {
      const w = (m.winner||{}).id;
      if (w===p1id) p1w++;
      else if (w===p2id) p2w++;
    });
    return { n:list.length, p1w, p2w, wr: p2w+p1w ? p1w/(p1w+p2w) : 0.5, ok:true };
  } catch { return null; }
}

// ─── WEATHER ────────────────────────────────────────────────────────────────
async function getWeather(countryAcr, surface) {
  const isOutdoor = surface !== 'Indoor Hard';
  if (!isOutdoor) return { condition:'Indoor', tempC:20, windKph:0, rainProbPct:0, isOutdoor:false, factors:[] };
  try {
    const [lat, lon] = CITY_COORDS[countryAcr] || CITY_COORDS['DEF'];
    const url = \`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&daily=temperature_2m_max,precipitation_probability_max,windspeed_10m_max&forecast_days=1&timezone=auto\`;
    const d = await fetch(url).then(r=>r.json());
    const daily = d.daily || {};
    const tempC = daily.temperature_2m_max?.[0] ?? 20;
    const windKph = daily.windspeed_10m_max?.[0] ?? 10;
    const rainProbPct = daily.precipitation_probability_max?.[0] ?? 0;
    let condition = 'Clear';
    if (rainProbPct > 60) condition = 'Rain Risk';
    else if (windKph > 30) condition = 'Windy';
    else if (tempC > 32) condition = 'Extreme Heat';
    else if (tempC > 27) condition = 'Hot';
    else if (tempC < 8) condition = 'Cold';
    const factors = [];
    if (windKph > 25) factors.push({factor:'High Wind',impact:\`\${windKph.toFixed(0)}km/h — disrupts serve rhythm\`,favors:'Returners/Baseliners',delta:-0.02});
    if (tempC > 30) factors.push({factor:'Heat',impact:\`\${tempC.toFixed(0)}°C — physical attrition\`,favors:'Fitter / Younger player',delta:-0.01});
    if (tempC < 10) factors.push({factor:'Cold',impact:'Ball plays slower',favors:'Heavy topspin players',delta:0.01});
    if (rainProbPct > 50) factors.push({factor:'Rain Risk',impact:\`\${rainProbPct}% chance of delays\`,favors:'Momentum leaders',delta:-0.01});
    return { condition, tempC, windKph, rainProbPct, isOutdoor, factors };
  } catch { return { condition:'Clear', tempC:20, windKph:10, rainProbPct:0, isOutdoor:true, factors:[] }; }
}

// ─── PREDICTION MODELS ──────────────────────────────────────────────────────
function eloWinProb(elo1, elo2) { return 1 / (1 + Math.pow(10, (elo2-elo1)/400)); }

function surfaceAdj(p, surface) {
  const adj = {...p};
  if (surface==='Clay') { adj.w1=Math.max(0.55,p.w1-0.04); adj.fp=Math.max(0.55,p.fp-0.02); }
  else if (surface==='Grass') { adj.w1=Math.min(0.85,p.w1+0.05); adj.ace=p.ace*1.4; }
  else if (surface==='Indoor Hard') { adj.w1=Math.min(0.82,p.w1+0.02); adj.ace=p.ace*1.15; }
  return adj;
}

function clayBonus(country) {
  return ['ESP','ARG','ITA','BRA','FRA','POR','CHI'].includes(country) ? 0.025 : 0;
}

function holdProb(srv, ret) {
  const bpc = ret.bpc * (1 - srv.w1);
  return (1 - bpc) * (srv.w1 > 0 ? 1 : 0.5) + srv.w1 * 0.7;
}

function monteCarlo(p1, p2, surface, bestOf, h2h, weather, roundId) {
  const s1 = surfaceAdj(p1, surface), s2 = surfaceAdj(p2, surface);
  let h2hAdj = 0;
  if (h2h?.ok) h2hAdj = (h2h.wr - 0.5) * 0.08;
  let weatherAdj = 0;
  weather.factors?.forEach(f => { weatherAdj += f.delta || 0; });
  const roundBoost = roundId >= 9 ? 0.015 : 0; // SF/F: bigger Elo gap matters more

  let p1wins = 0;
  const SIMS = 3000;
  const setsToWin = bestOf === 5 ? 3 : 2;

  for (let i=0; i<SIMS; i++) {
    let p1sets=0, p2sets=0, totGames=0, totBreaks=0;
    while (p1sets < setsToWin && p2sets < setsToWin) {
      let p1games=0, p2games=0;
      while (true) {
        // P1 serving
        const p1hold = s1.w1 + h2hAdj + weatherAdj + roundBoost;
        const p2break = s2.bpc * (1 - s1.w1);
        if (Math.random() > Math.min(0.92, p1hold)) { p2games++; totBreaks++; }
        else p1games++;
        totGames++;
        // P2 serving
        const p2hold = s2.w1 - h2hAdj - weatherAdj + roundBoost;
        const p1break = s1.bpc * (1 - s2.w1);
        if (Math.random() > Math.min(0.92, p2hold)) { p1games++; totBreaks++; }
        else p2games++;
        totGames++;
        if (p1games >= 6 && p1games - p2games >= 2) { p1sets++; break; }
        if (p2games >= 6 && p2games - p1games >= 2) { p2sets++; break; }
        if (p1games === 6 && p2games === 6) {
          if (Math.random() > 0.5) p1sets++; else p2sets++;
          break;
        }
      }
    }
    if (p1sets > p2sets) p1wins++;
  }
  const p1wp = p1wins / SIMS;
  return { model:'Monte Carlo', p1WinProb:p1wp, p2WinProb:1-p1wp,
    predictedSetScore: bestOf===5 ? (p1wp>0.5?'3-1':'1-3') : (p1wp>0.5?'2-1':'1-2'),
    avgTotalSets: bestOf===5?4.1:2.3, avgTotalGames:22.5, avgTotalBreaks:5.2,
    estAcesP1:s1.ace*12, estAcesP2:s2.ace*12 };
}

function logisticReg(p1, p2, surface, bestOf, h2h, weather) {
  const s1=surfaceAdj(p1,surface), s2=surfaceAdj(p2,surface);
  const rankDiff = Math.log(Math.max(1,p2.rank)) - Math.log(Math.max(1,p1.rank));
  const eloDiff = (p1.elo - p2.elo) / 400;
  const surfDiff = (s1.w1 - s2.w1) * 2;
  const h2hFactor = h2h?.ok ? (h2h.wr - 0.5) * 0.5 : 0;
  const cb1 = surface==='Clay' ? clayBonus(p1.country) : 0;
  const cb2 = surface==='Clay' ? clayBonus(p2.country) : 0;
  const weatherDelta = (weather.factors||[]).reduce((a,f)=>a+(f.delta||0),0);
  const z = 0.8*eloDiff + 0.6*rankDiff + 0.4*surfDiff + h2hFactor + (cb1-cb2)*2 + weatherDelta*5;
  const p1wp = 1/(1+Math.exp(-z));
  return { model:'Logistic Reg.', p1WinProb:p1wp, p2WinProb:1-p1wp,
    predictedSetScore: bestOf===5?(p1wp>0.5?'3-1':'1-3'):(p1wp>0.5?'2-1':'1-2'),
    avgTotalSets:2.4, avgTotalGames:23, avgTotalBreaks:5, estAcesP1:s1.ace*11, estAcesP2:s2.ace*11 };
}

function poissonModel(p1, p2, surface, bestOf, h2h) {
  const s1=surfaceAdj(p1,surface), s2=surfaceAdj(p2,surface);
  // Expected games per set: based on hold probs
  const h1 = Math.min(0.92, s1.w1 + 0.1); // P1 hold prob on serve
  const h2 = Math.min(0.92, s2.w1 + 0.1);
  // Prob P1 wins a set game = weighted by serve games
  const p1winGame = (h1 + (1-h2)) / 2;
  // Prob P1 wins set (simplified: first to 6 games with margin 2)
  let p1WinSet = p1winGame;
  if (p1WinSet < 0.3) p1WinSet = 0.3;
  if (p1WinSet > 0.7) p1WinSet = 0.7;
  const h2hAdj = h2h?.ok ? (h2h.wr-0.5)*0.06 : 0;
  p1WinSet = Math.min(0.82, Math.max(0.18, p1WinSet + h2hAdj));
  const setsToWin = bestOf===5?3:2;
  // Prob of winning match: sum of ways to win
  let p1mp = 0;
  if (bestOf===3) {
    p1mp = p1WinSet**2 + 2*p1WinSet**2*(1-p1WinSet);
  } else {
    // Bo5
    p1mp = p1WinSet**3 + 3*p1WinSet**3*(1-p1WinSet) + 6*p1WinSet**3*(1-p1WinSet)**2;
  }
  p1mp = Math.min(0.92, Math.max(0.08, p1mp));
  const avgSets = bestOf===5 ? (3.5 + (0.5-Math.abs(p1WinSet-0.5))*2) : (2 + (0.5-Math.abs(p1WinSet-0.5)));
  return { model:'Poisson', p1WinProb:p1mp, p2WinProb:1-p1mp,
    predictedSetScore: bestOf===5?(p1mp>0.5?'3-1':'1-3'):(p1mp>0.5?'2-1':'1-2'),
    avgTotalSets:parseFloat(avgSets.toFixed(1)), avgTotalGames:22, avgTotalBreaks:4.8,
    estAcesP1:s1.ace*10, estAcesP2:s2.ace*10 };
}

function analytical(p1, p2, surface, bestOf, h2h, weather) {
  const s1=surfaceAdj(p1,surface), s2=surfaceAdj(p2,surface);
  const eloProb = eloWinProb(p1.elo, p2.elo);
  const servAdv = (s1.w1 - s2.w1) * 0.4;
  const h2hAdj = h2h?.ok ? (h2h.wr-0.5)*0.08 : 0;
  const cb = surface==='Clay' ? (clayBonus(p1.country)-clayBonus(p2.country)) : 0;
  const weatherDelta = (weather.factors||[]).reduce((a,f)=>a+(f.delta||0),0);
  const bo5boost = bestOf===5 && p1.elo>p2.elo ? 0.02 : bestOf===5 ? -0.02 : 0; // bigger elo matters in bo5
  let p1wp = Math.min(0.93, Math.max(0.07, eloProb + servAdv + h2hAdj + cb + weatherDelta + bo5boost));
  return { model:'Analytical', p1WinProb:p1wp, p2WinProb:1-p1wp,
    predictedSetScore: bestOf===5?(p1wp>0.5?'3-1':'1-3'):(p1wp>0.5?'2-1':'1-2'),
    avgTotalSets:2.3, avgTotalGames:23.5, avgTotalBreaks:5.5,
    estAcesP1:s1.ace*11, estAcesP2:s2.ace*11 };
}

function superCombined(models, p1, p2, surface, bestOf) {
  const [mc, lr, po, an] = models;
  const w = [0.30, 0.25, 0.25, 0.20]; // weights
  const p1wp = mc.p1WinProb*w[0] + lr.p1WinProb*w[1] + po.p1WinProb*w[2] + an.p1WinProb*w[3];
  const probs = models.map(m=>m.p1WinProb);
  const mean = probs.reduce((a,b)=>a+b,0)/probs.length;
  const std = Math.sqrt(probs.reduce((a,b)=>a+(b-mean)**2,0)/probs.length);
  const confidence = std < 0.05 ? 'High' : std < 0.12 ? 'Medium' : 'Low';
  const s1=surfaceAdj(p1,surface), s2=surfaceAdj(p2,surface);
  return {
    model:'Super Combined', p1WinProb:p1wp, p2WinProb:1-p1wp,
    predictedSetScore: bestOf===5?(p1wp>0.5?'3-1':'1-3'):(p1wp>0.5?'2-1':'1-2'),
    avgTotalSets: models.reduce((a,m)=>a+m.avgTotalSets,0)/4,
    avgTotalGames: models.reduce((a,m)=>a+m.avgTotalGames,0)/4,
    avgTotalBreaks: models.reduce((a,m)=>a+m.avgTotalBreaks,0)/4,
    estAcesP1: s1.ace*11, estAcesP2: s2.ace*11,
    estDoubleFaultsP1: s1.df*4, estDoubleFaultsP2: s2.df*4,
    modelAgreement: {
      monteCarlo:mc.p1WinProb, logisticRegression:lr.p1WinProb,
      poisson:po.p1WinProb, analytical:an.p1WinProb,
      stdDeviation:std, confidence
    }
  };
}

async function runFullPrediction(p1id, p2id, surface, bestOf, tour, countryAcr='DEF', roundId=4, rankId=2) {
  await buildRankCache(tour);
  const [p1, p2, h2h, weather] = await Promise.all([
    getPlayerStats(p1id, tour),
    getPlayerStats(p2id, tour),
    getH2H(p1id, p2id, tour),
    getWeather(countryAcr, surface),
  ]);

  const mc = monteCarlo(p1, p2, surface, bestOf, h2h, weather, roundId);
  const lr = logisticReg(p1, p2, surface, bestOf, h2h, weather);
  const po = poissonModel(p1, p2, surface, bestOf, h2h);
  const an = analytical(p1, p2, surface, bestOf, h2h, weather);
  const sc = superCombined([mc, lr, po, an], p1, p2, surface, bestOf);

  const isGrandSlam = rankId >= 4;
  const roundNames = {1:'Q1',2:'Q2',3:'Q3',4:'R1',5:'R2',6:'R3',7:'R4(16)',8:'QF',9:'SF',10:'F',12:'F'};
  const levels = {1:'Challenger',2:'ATP 250',3:'ATP 500',4:'ATP 1000',5:'Grand Slam'};

  const factorSummary = [];
  if (weather.isOutdoor) {
    weather.factors?.forEach(f => {
      const favorsP1 = (sc.p1WinProb + (f.delta||0)) > sc.p1WinProb;
      factorSummary.push({ factor:f.factor, impact:f.impact, favors: f.favors || (favorsP1 ? p1.name : p2.name) });
    });
  }
  if (surface==='Clay') {
    const cb1=clayBonus(p1.country), cb2=clayBonus(p2.country);
    if (cb1>cb2) factorSummary.push({factor:'Clay Culture',impact:'Native clay-country player',favors:p1.name});
    else if (cb2>cb1) factorSummary.push({factor:'Clay Culture',impact:'Native clay-country player',favors:p2.name});
  }
  if (roundId >= 9) factorSummary.push({factor:'Deep Round',impact:'Tournament fatigue factor',favors:sc.p1WinProb>0.5?p1.name:p2.name});
  if (isGrandSlam) factorSummary.push({factor:'Grand Slam Bo5',impact:'Physical durability amplified',favors:p1.elo>p2.elo?p1.name:p2.name});

  return {
    player1: p1, player2: p2, surface, bestOf,
    contextFactors: {
      weather, round: roundNames[roundId]||'R1',
      tournamentLevel: levels[rankId]||'ATP',
      isGrandSlam, altitude:0, factorSummary, netAdjP1:sc.p1WinProb
    },
    models: { monteCarlo:mc, logisticRegression:lr, poisson:po, analytical:an },
    superCombined: sc,
    predictedWinner: sc.p1WinProb>0.5 ? p1.name : p2.name,
    winnerWinPct: Math.max(sc.p1WinProb, sc.p2WinProb)*100,
    h2hSummary: h2h,
  };
}

// ─── DATE HELPERS ───────────────────────────────────────────────────────────
function fmtDate(d) { return d.toISOString().slice(0,10); }
function addDays(d, n) { const x=new Date(d); x.setDate(x.getDate()+n); return x; }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function updateDateUI() {
  const d = state.selectedDate;
  const diff = Math.round((d - TODAY) / 86400000);
  const labels = {0:'Today', 1:'Tomorrow', '-1':'Yesterday'};
  const label = labels[diff] || (diff<0 ? \`\${Math.abs(diff)} days ago\` : \`In \${diff} days\`);
  document.getElementById('date-main').textContent = label;
  document.getElementById('date-sub').textContent = \`\${DAYS[d.getDay()]} \${MONTHS[d.getMonth()]} \${d.getDate()}\`;
  document.getElementById('prev-btn').disabled = diff <= -7;
  document.getElementById('next-btn').disabled = diff >= 7;
}

function shiftDate(n) {
  state.selectedDate = addDays(state.selectedDate, n);
  state.predictions = {};
  state.fixtures = [];
  updateDateUI();
  loadFixtures();
}

// ─── TOUR / TAB ─────────────────────────────────────────────────────────────
function setTour(tour, btn) {
  state.tour = tour; state.predictions = {}; state.fixtures = [];
  state.rankCache.clear(); state.rankingsLoaded = false;
  document.querySelectorAll('.tour-btn').forEach(b=>b.classList.toggle('active',b===btn));
  if (state.tab==='fixtures') loadFixtures();
  else if (state.tab==='rankings') loadRankings();
}

function setTab(tab, btn) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(\`screen-\${tab}\`).classList.add('active');
  document.getElementById('date-nav').style.display = tab==='fixtures' ? 'flex' : 'none';
  if (tab==='fixtures' && !state.fixtures.length) loadFixtures();
  if (tab==='rankings' && !state.rankingsLoaded) loadRankings();
}

function setSurf(s, btn) {
  state.surface = s;
  document.querySelectorAll('.surf-btn').forEach(b=>b.classList.toggle('active',b===btn));
}
function setBo(n) {
  state.bestOf = n;
  document.getElementById('bo3').classList.toggle('active',n===3);
  document.getElementById('bo5').classList.toggle('active',n===5);
}

// ─── FIXTURES ────────────────────────────────────────────────────────────────
async function loadFixtures() {
  const el = document.getElementById('fix-content');
  el.innerHTML = \`<div class="spinner-wrap"><div class="big-spin"></div><div class="spin-msg">Loading matches…</div></div>\`;
  try {
    const fixtures = await fetchFixtures(state.tour, fmtDate(state.selectedDate));
    state.fixtures = fixtures;
    if (!fixtures.length) {
      el.innerHTML = \`<div class="empty"><span class="empty-icon">🎾</span><div class="empty-msg">No matches on this date</div></div>\`;
      return;
    }
    renderFixtures();
    schedulePredictions();
  } catch(e) {
    el.innerHTML = \`<div class="empty"><span class="empty-icon">⚠️</span><div class="empty-msg">\${e.message}</div></div>\`;
  }
}

function renderFixtures() {
  const el = document.getElementById('fix-content');
  el.innerHTML = state.fixtures.map(f => {
    const t = f.tournament||{};
    const surf = f.surface || SURFACE_MAP[t.courtId] || 'Hard';
    const pillKey = surf==='Indoor Hard'?'Indoor':surf;
    const pred = state.predictions[f.id];
    return \`
    <div class="card fix-card" onclick="openFixture(\${f.id})">
      <div class="card-p">
        <div class="fix-meta">
          <span class="pill pill-\${pillKey}">\${surf}</span>
          <span class="fix-tourn">\${t.name||''}</span>
          <span class="fix-tag">Bo\${f.bestOf||3}</span>
          \${f.round?.name?\`<span class="fix-tag">\${f.round.name}</span>\`:''}
        </div>
        <div class="players-row">
          <div class="pcol">
            <div class="pnm">\${f.player1?.name||'TBA'}</div>
            \${f.seed1?\`<div class="pseed">[\${f.seed1}]</div>\`:''}
          </div>
          <div class="vs-badge">VS</div>
          <div class="pcol right">
            <div class="pnm">\${f.player2?.name||'TBA'}</div>
            \${f.seed2?\`<div class="pseed">[\${f.seed2}]</div>\`:''}
          </div>
        </div>
        <div id="pbar-\${f.id}">\${pred ? renderBar(pred) : '<div class="pred-loading"><div class="mini-spin"></div>Calculating…</div>'}</div>
      </div>
    </div>\`;
  }).join('');
}

function renderBar(r) {
  const c = r.superCombined;
  const isP1 = c.p1WinProb>0.5;
  return \`
    <div class="bar-labels">
      <span class="bar-lbl \${isP1?'w':''}">\${(c.p1WinProb*100).toFixed(1)}%</span>
      <span class="bar-lbl \${!isP1?'w':''}">\${(c.p2WinProb*100).toFixed(1)}%</span>
    </div>
    <div class="prob-track"><div class="prob-fill" style="width:\${(c.p1WinProb*100).toFixed(1)}%"></div></div>
    <div class="set-lbl">\${c.predictedSetScore}</div>\`;
}

async function schedulePredictions() {
  for (const f of state.fixtures.slice(0,12)) {
    const p1 = f.player1Id||f.player1?.id;
    const p2 = f.player2Id||f.player2?.id;
    if (!p1||!p2) continue;
    if (state.predictions[f.id]) continue;
    try {
      const surf = f.surface || SURFACE_MAP[f.tournament?.courtId] || 'Hard';
      const r = await runFullPrediction(
        p1, p2, surf, f.bestOf||3, state.tour,
        f.tournament?.countryAcr||'DEF',
        f.round?.id||4, f.tournament?.rankId||2
      );
      state.predictions[f.id] = r;
      const bar = document.getElementById(\`pbar-\${f.id}\`);
      if (bar) bar.innerHTML = renderBar(r);
    } catch(e) {
      const bar = document.getElementById(\`pbar-\${f.id}\`);
      if (bar) bar.innerHTML = \`<div style="font-size:11px;color:var(--muted)">—</div>\`;
    }
  }
}

// ─── FIXTURE DETAIL ──────────────────────────────────────────────────────────
async function openFixture(id) {
  const f = state.fixtures.find(x=>x.id===id);
  if (!f) return;
  const overlay = document.getElementById('detail');
  const body = document.getElementById('detail-body');
  overlay.classList.add('open');
  document.body.style.overflow='hidden';

  let r = state.predictions[id];
  if (!r) {
    body.innerHTML = \`<div class="spinner-wrap"><div class="big-spin"></div><div class="spin-msg">Running 4 models…</div></div>\`;
    try {
      const p1=f.player1Id||f.player1?.id, p2=f.player2Id||f.player2?.id;
      const surf=f.surface||SURFACE_MAP[f.tournament?.courtId]||'Hard';
      r = await runFullPrediction(p1,p2,surf,f.bestOf||3,state.tour,
        f.tournament?.countryAcr||'DEF',f.round?.id||4,f.tournament?.rankId||2);
      state.predictions[id]=r;
    } catch(e) {
      body.innerHTML=\`<div class="empty"><span class="empty-icon">⚠️</span><div class="empty-msg">\${e.message}</div></div>\`;
      return;
    }
  }
  body.innerHTML = buildDetail(r);
  requestAnimationFrame(()=>{ document.querySelectorAll('[data-w]').forEach(el=>el.style.width=el.dataset.w+'%'); });
}

function closeDetail() {
  document.getElementById('detail').classList.remove('open');
  document.body.style.overflow='';
}

// ─── PICKER ──────────────────────────────────────────────────────────────────
function fillQuick(id) {
  const p1=document.getElementById('p1in'), p2=document.getElementById('p2in');
  if (!p1.value||p1.value==='47275') p1.value=id; else p2.value=id;
}

async function runPicker() {
  const p1=parseInt(document.getElementById('p1in').value);
  const p2=parseInt(document.getElementById('p2in').value);
  const errEl=document.getElementById('picker-err');
  if (!p1||!p2) { errEl.textContent='Enter valid player IDs'; return; }
  errEl.textContent='';
  const btn=document.getElementById('run-btn');
  btn.disabled=true; btn.textContent='⏳ Running…';
  try {
    const r = await runFullPrediction(p1, p2, state.surface, state.bestOf, state.tour);
    const body=document.getElementById('detail-body');
    body.innerHTML=buildDetail(r);
    document.getElementById('detail').classList.add('open');
    document.body.style.overflow='hidden';
    requestAnimationFrame(()=>{ document.querySelectorAll('[data-w]').forEach(el=>el.style.width=el.dataset.w+'%'); });
  } catch(e) { errEl.textContent=e.message; }
  finally { btn.disabled=false; btn.textContent='⚡ Run Prediction'; }
}

// ─── RANKINGS ────────────────────────────────────────────────────────────────
async function loadRankings() {
  const el=document.getElementById('rank-content');
  el.innerHTML=\`<div class="spinner-wrap"><div class="big-spin"></div><div class="spin-msg">Loading rankings…</div></div>\`;
  try {
    await buildRankCache(state.tour);
    const rows=[...state.rankCache.entries()]
      .map(([id,v])=>({id,...v}))
      .sort((a,b)=>(a.rank||999)-(b.rank||999))
      .slice(0,100);
    state.rankingsLoaded=true;
    const colorClass=i=>i===0?'gold':i===1?'silver':i===2?'bronze':'';
    el.innerHTML=\`<div class="rank-list">\${rows.map((e,i)=>\`
      <div class="rank-row">
        <div class="rnum \${colorClass(i)}">\${e.rank||i+1}</div>
        <div class="rinfo"><div class="rnm">\${e.name||'—'}</div>\${e.country?\`<div class="rctry">\${e.country}</div>\`:''}</div>
        <div class="rpts">\${(e.pts||0).toLocaleString()} pts</div>
      </div>\`).join('')}</div>\`;
  } catch(e) {
    el.innerHTML=\`<div class="empty"><span class="empty-icon">⚠️</span><div class="empty-msg">\${e.message}</div></div>\`;
  }
}

// ─── DETAIL HTML ─────────────────────────────────────────────────────────────
function buildDetail(r) {
  const c=r.superCombined, p1=r.player1, p2=r.player2;
  const isP1=c.p1WinProb>0.5, cf=r.contextFactors||{}, h2h=r.h2hSummary;
  const wemoji={Clear:'☀️',Hot:'🌤️','Extreme Heat':'🔥',Overcast:'☁️','Rain Risk':'🌧️',Windy:'🌬️',Cold:'🥶',Indoor:'🏟️'};

  let ctxHTML='';
  if (cf.factorSummary?.length||cf.weather) {
    const w=cf.weather||{};
    const chips=[
      \`\${wemoji[w.condition]||'🌡️'} \${w.isOutdoor?\`\${w.condition||''} · \${Math.round(w.tempC||20)}°C\`:'Indoor'}\`,
      ...(w.isOutdoor&&w.windKph>15?[\`💨 \${Math.round(w.windKph)}km/h\`]:[]),
      ...(w.isOutdoor&&w.rainProbPct>20?[\`🌧️ \${Math.round(w.rainProbPct)}%\`]:[]),
      \`\${cf.round||'R1'} · \${cf.tournamentLevel||'ATP'}\`,
      ...(cf.isGrandSlam?['🏆 Grand Slam']:[]),
    ];
    ctxHTML=\`<div class="ctx-card">
      <div class="sec">Match Conditions</div>
      <div class="chips">\${chips.map(c=>\`<div class="chip">\${c}</div>\`).join('')}</div>
      \${(cf.factorSummary||[]).map(f=>\`
        <div class="factor-row">
          <div class="factor-info"><div class="fnm">\${f.factor}</div><div class="fimp">\${f.impact}</div></div>
          <div class="ffav">\${f.favors}</div>
        </div>\`).join('')}
    </div>\`;
  }

  const modelList=[
    ['Monte Carlo',r.models?.monteCarlo],
    ['Logistic Reg.',r.models?.logisticRegression],
    ['Poisson',r.models?.poisson],
    ['Analytical',r.models?.analytical],
  ];

  let h2hHTML='';
  if (h2h?.ok) {
    h2hHTML=\`<div class="h2h-card">
      <div class="sec">Head to Head</div>
      <div class="h2h-scores">
        <div><div class="h2h-score \${isP1?'w':''}">\${h2h.p1w||0}</div><div class="h2h-pnm">\${p1.name.split(' ').pop()}</div></div>
        <div class="h2h-dash">–</div>
        <div><div class="h2h-score \${!isP1?'w':''}">\${h2h.p2w||0}</div><div class="h2h-pnm">\${p2.name.split(' ').pop()}</div></div>
      </div>
      <div class="h2h-track"><div class="h2h-fill" data-w="\${((h2h.wr||0.5)*100).toFixed(0)}" style="width:0"></div></div>
      <div class="h2h-total">\${h2h.n||0} total matches</div>
    </div>\`;
  }

  return \`
  <div class="hero">
    <div class="hero-lbl">Predicted Winner</div>
    <div class="hero-nm">\${r.predictedWinner}</div>
    <div class="hero-pct">\${r.winnerWinPct.toFixed(1)}%</div>
    <div class="hero-sub">\${c.predictedSetScore} · \${r.surface} · Bo\${r.bestOf}</div>
  </div>
  <div class="cmp-grid">
    <div class="cmp-p \${isP1?'win':''}">
      <div class="cmp-nm">\${p1.name}</div>
      \${p1.rank?\`<div class="cmp-rank">#\${p1.rank}</div>\`:''}
      <div class="cmp-elo">\${p1.elo}</div><div class="cmp-elo-lbl">ELO</div>
      \${p1.country?\`<div class="cmp-ctry">\${p1.country}</div>\`:''}
    </div>
    <div class="vs-circle">VS</div>
    <div class="cmp-p \${!isP1?'win':''}">
      <div class="cmp-nm">\${p2.name}</div>
      \${p2.rank?\`<div class="cmp-rank">#\${p2.rank}</div>\`:''}
      <div class="cmp-elo">\${p2.elo}</div><div class="cmp-elo-lbl">ELO</div>
      \${p2.country?\`<div class="cmp-country">\${p2.country}</div>\`:''}
    </div>
  </div>
  \${ctxHTML}
  <div class="sec">Model Breakdown</div>
  <div class="model-grid">\${modelList.map(([nm,m])=>!m?'':
    \`<div class="model-card"><div class="mnm">\${nm}</div>
     <div class="mtrack"><div class="mfill" data-w="\${(m.p1WinProb*100).toFixed(1)}" style="width:0%"></div></div>
     <div class="mprobs"><span class="mp1">\${(m.p1WinProb*100).toFixed(1)}%</span><span class="mp2">\${(m.p2WinProb*100).toFixed(1)}%</span></div>
     </div>\`).join('')}
  </div>
  <div class="sec">Predicted Stats</div>
  <div class="stat-grid">
    <div class="stat-box"><div class="sv">\${c.avgTotalGames.toFixed(1)}</div><div class="sl">Games</div></div>
    <div class="stat-box"><div class="sv">\${c.avgTotalSets.toFixed(1)}</div><div class="sl">Sets</div></div>
    <div class="stat-box"><div class="sv">\${c.avgTotalBreaks.toFixed(1)}</div><div class="sl">Breaks</div></div>
    <div class="stat-box"><div class="sv">\${c.estAcesP1.toFixed(0)}</div><div class="sl">\${p1.name.split(' ').pop()} Aces</div></div>
    <div class="stat-box"><div class="sv">\${c.estAcesP2.toFixed(0)}</div><div class="sl">\${p2.name.split(' ').pop()} Aces</div></div>
    <div class="stat-box"><div class="sv">\${c.estDoubleFaultsP1.toFixed(0)}</div><div class="sl">Dbl Faults</div></div>
  </div>
  <div class="conf-row">
    <div><div class="conf-lbl">Model Confidence</div><div class="conf-sub">σ = \${c.modelAgreement.stdDeviation.toFixed(4)}</div></div>
    <div class="badge badge-\${c.modelAgreement.confidence}">\${c.modelAgreement.confidence}</div>
  </div>
  \${h2hHTML}\`;
}

// ─── QUICK PICKS INIT ────────────────────────────────────────────────────────
function initQuickPicks() {
  document.getElementById('quick-grid').innerHTML = QUICK_PICKS.map(p=>
    \`<div class="quick-item" onclick="fillQuick(\${p.id})">
      <span class="qnm">\${p.name}</span><span class="qid">\${p.id}</span>
    </div>\`).join('');
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
initQuickPicks();
updateDateUI();
loadFixtures();
</script>
</body>
</html>
`;
  return new Response(html, {
    headers: { ...cors, "Content-Type": "text/html; charset=utf-8" }
  });
});
