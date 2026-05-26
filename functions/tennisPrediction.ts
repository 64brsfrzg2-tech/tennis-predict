// ╔══════════════════════════════════════════════════════════════════╗
// ║  Tennis Prediction Engine v2.0 — with Contextual Factors       ║
// ║  Routes: health | fixtures | rankings | predict |               ║
// ║          predictFixture | player | search                       ║
// ╚══════════════════════════════════════════════════════════════════╝

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") || "";
const BASE_URL = "https://tennis-api-atp-wta-itf.p.rapidapi.com";
const API_HDR = { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": "tennis-api-atp-wta-itf.p.rapidapi.com" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,GET,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };

const SURFACE_MAP: Record<number, string> = { 1:"Hard", 2:"Clay", 3:"Grass", 4:"Indoor Hard" };
const ATP_DEF = { fp:0.62, w1:0.73, w2:0.52, bps:0.62, bpc:0.38, ace:0.8, df:0.3 };
const WTA_DEF = { fp:0.60, w1:0.68, w2:0.47, bps:0.57, bpc:0.43, ace:0.2, df:0.5 };

// Tournament city → approx lat/lon for weather lookup
const CITY_COORDS: Record<string, [number,number]> = {
  "FRA": [48.85, 2.35],   // Paris
  "GBR": [51.5, -0.12],   // London (Wimbledon)
  "USA": [40.71, -74.0],  // New York (USO)
  "AUS": [-37.81, 144.96],// Melbourne (AO)
  "ESP": [40.41, -3.7],   // Madrid/Barcelona
  "ITA": [41.9, 12.5],    // Rome
  "GER": [52.52, 13.4],   // Germany
  "CHN": [31.23, 121.47], // Shanghai
  "MON": [43.73, 7.42],   // Monte Carlo
  "CAN": [45.5, -73.57],  // Montreal/Toronto
  "ARG": [-34.6, -58.38], // Buenos Aires
  "BRA": [-23.55, -46.63],// Sao Paulo
  "MEX": [19.43, -99.13], // Acapulco
  "IND": [28.67, 77.22],  // Delhi
  "MDA": [47.0, 28.9],    // Chisinau
  "SUI": [47.37, 8.54],   // Basel/Zurich
  "AUT": [48.2, 16.37],   // Vienna
  "NED": [52.37, 4.9],    // Rotterdam/Amsterdam
  "BEL": [50.85, 4.35],   // Brussels
  "SWE": [59.33, 18.07],  // Stockholm
  "POL": [52.23, 21.01],  // Warsaw
  "HUN": [47.5, 19.05],   // Budapest
  "CRO": [45.81, 15.98],  // Zagreb
  "ROU": [44.43, 26.1],   // Bucharest
  "QAT": [25.29, 51.53],  // Doha
  "UAE": [25.2, 55.27],   // Dubai
  "MAR": [33.99, -6.85],  // Rabat/Casablanca
  "SAF": [-26.2, 28.04],  // Johannesburg
  "CHI": [-33.45, -70.67],// Santiago
  "JPN": [35.69, 139.69], // Tokyo
  "SGP": [1.35, 103.82],  // Singapore
  "NZL": [-36.86, 174.77],// Auckland
  "POR": [38.72, -9.14],  // Lisbon/Estoril
  "DEF": [48.85, 2.35],   // Default: Paris
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, params: Record<string,string|number> = {}): Promise<unknown> {
  const url = new URL(BASE_URL + path);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const r = await fetch(url.toString(), { headers: API_HDR });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}
function ud(d: unknown): Record<string,unknown> {
  if (d && typeof d === "object" && "data" in (d as Record<string,unknown>)) return (d as Record<string,unknown>).data as Record<string,unknown>;
  return d as Record<string,unknown>;
}
function toList(d: unknown): unknown[] {
  const u = ud(d); return Array.isArray(u) ? u : (Array.isArray(d) ? d as unknown[] : []);
}

async function fetchRankings(tour: string, n = 300): Promise<unknown[]> {
  return toList(await apiFetch(`/tennis/v2/${tour}/ranking/singles`, { pageSize: n }));
}
async function buildCache(tour: string): Promise<Map<number, Record<string,unknown>>> {
  const map = new Map<number, Record<string,unknown>>();
  for (const e of (await fetchRankings(tour)) as Record<string,unknown>[]) {
    const p = e.player as Record<string,unknown>;
    if (p?.id) map.set(p.id as number, { rank: e.position, pts: e.point, name: p.name });
  }
  return map;
}
async function fetchFixtures(tour: string, date: string, ps = 50): Promise<unknown[]> {
  const today = new Date().toISOString().slice(0, 10);
  const path = date === today ? `/tennis/v2/${tour}/fixtures` : `/tennis/v2/${tour}/fixtures/${date}`;
  return toList(await apiFetch(path, { include:"round,tournament.court,tournament.rank,h2h", filter:"PlayerGroup:singles", pageSize:ps, pageNo:1 }));
}

// ─── WEATHER via Open-Meteo (free, no key) ────────────────────────────────────

interface WeatherCtx {
  tempC: number;
  windKph: number;
  rainProbPct: number;
  condition: string;
  isOutdoor: boolean;
  adjustments: { factor: string; effect: string; delta: number }[];
}

async function getWeather(countryAcr: string, surface: string): Promise<WeatherCtx> {
  const isOutdoor = surface !== "Indoor Hard";
  const neutral: WeatherCtx = {
    tempC: 20, windKph: 10, rainProbPct: 0, condition: "Unknown",
    isOutdoor, adjustments: []
  };
  if (!isOutdoor) {
    neutral.condition = "Indoor (N/A)";
    return neutral;
  }
  try {
    const [lat, lon] = CITY_COORDS[countryAcr] || CITY_COORDS["DEF"];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,precipitation_probability_max,windspeed_10m_max` +
      `&hourly=temperature_2m,windspeed_10m,precipitation_probability` +
      `&forecast_days=1&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return neutral;
    const data = await res.json() as Record<string,unknown>;
    const daily = data.daily as Record<string,number[]> || {};
    const tempC = daily.temperature_2m_max?.[0] ?? 20;
    const windKph = daily.windspeed_10m_max?.[0] ?? 10;
    const rainProbPct = daily.precipitation_probability_max?.[0] ?? 0;

    let condition = "Clear";
    if (rainProbPct > 60) condition = "Rain Risk";
    else if (rainProbPct > 30) condition = "Overcast";
    else if (windKph > 30) condition = "Windy";
    else if (tempC > 32) condition = "Extreme Heat";
    else if (tempC > 28) condition = "Hot";
    else if (tempC < 8) condition = "Cold";

    const adjustments: { factor: string; effect: string; delta: number }[] = [];

    // Wind: hurts big servers more, helps returners
    if (windKph > 25) {
      const delta = -((windKph - 25) * 0.003); // reduces serve win prob
      adjustments.push({ factor: "High Wind", effect: `${windKph.toFixed(0)}km/h — disrupts serve rhythm`, delta });
    }
    // Heat: hurts baseline grinders on clay, bigger impact on slower players
    if (tempC > 30) {
      const delta = -((tempC - 30) * 0.004);
      adjustments.push({ factor: "Heat", effect: `${tempC.toFixed(0)}°C — increases fatigue mid-match`, delta });
    }
    // Cold: slows ball, benefits slower hitters
    if (tempC < 10) {
      adjustments.push({ factor: "Cold", effect: `${tempC.toFixed(0)}°C — ball plays slower`, delta: 0.01 });
    }
    // Rain probability (wet conditions)
    if (rainProbPct > 50) {
      adjustments.push({ factor: "Rain Risk", effect: `${rainProbPct}% chance — possible delays/interruptions`, delta: -0.01 });
    }

    return { tempC, windKph, rainProbPct, condition, isOutdoor, adjustments };
  } catch (_e) {
    return neutral;
  }
}

// ─── FATIGUE via recent match history ────────────────────────────────────────

interface FatigueCtx {
  p1Sets: number;      // sets played yesterday/recently
  p2Sets: number;
  p1SetsToday: number; // sets played already today (earlier round)
  p2SetsToday: number;
  p1RecentMatches: number; // matches in last 7 days
  p2RecentMatches: number;
  adjustments: { factor: string; effect: string; playerName: string; delta: number }[];
}

async function getFatigue(
  p1Id: number, p2Id: number, tour: string,
  p1Name: string, p2Name: string,
  roundId: number
): Promise<FatigueCtx> {
  const ctx: FatigueCtx = {
    p1Sets:0, p2Sets:0, p1SetsToday:0, p2SetsToday:0,
    p1RecentMatches:0, p2RecentMatches:0, adjustments:[]
  };
  try {
    // Get recent H2H-style results — we use perf breakdown to infer recent match load
    // Use the fixture round to estimate tournament fatigue
    // roundId: 1=Q1, 2=Q2, 3=Q3, 4=R1, 5=R2, 6=R3, 7=R4, 8=QF, 9=SF, 10=F, 12=F(GS)
    const roundFatigueMap: Record<number, number> = {
      4:0, 5:1, 6:2, 7:3, 8:3, 9:4, 10:4, 12:4
    };
    const matchesPlayedEst = roundFatigueMap[roundId] || 0;

    // Rough: each match = ~2 sets avg Bo3, ~3.5 sets Bo5
    // Use this as a fatigue proxy
    if (matchesPlayedEst >= 3) {
      ctx.adjustments.push({
        factor: "Tournament Fatigue",
        effect: `${matchesPlayedEst} matches deep — late-round accumulation`,
        playerName: "Both",
        delta: -0.01 * matchesPlayedEst
      });
    }

    // Fetch both players' recent match history to count sets
    const [h1, h2] = await Promise.all([
      apiFetch(`/tennis/v2/${tour}/player/match-stats/${p1Id}`).then(d=>ud(d)).catch(()=>({})),
      apiFetch(`/tennis/v2/${tour}/player/match-stats/${p2Id}`).then(d=>ud(d)).catch(()=>({})),
    ]);

    // Use sets played in last matches as fatigue indicator
    // Approximate from average sets in tournament context
    const p1SetsPerMatch = +(((h1 as Record<string,unknown>).avgSetsPlayed as number) || 0);
    const p2SetsPerMatch = +(((h2 as Record<string,unknown>).avgSetsPlayed as number) || 0);

    // Round = deep means more sets played to get here
    const deepRoundFatigue = matchesPlayedEst >= 3;
    if (deepRoundFatigue) {
      // Players reaching semis/finals have played ~10+ sets already this week
      ctx.p1Sets = Math.round(matchesPlayedEst * (p1SetsPerMatch || 2.2));
      ctx.p2Sets = Math.round(matchesPlayedEst * (p2SetsPerMatch || 2.2));
    }
  } catch (_e) { /**/ }
  return ctx;
}

// ─── CONTEXTUAL FACTORS (combined) ───────────────────────────────────────────

interface ContextFactors {
  weather: WeatherCtx;
  fatigue: FatigueCtx;
  roundName: string;
  tournamentLevel: string;
  isGrandSlam: boolean;
  isIndoor: boolean;
  altitude: number;      // metres (high altitude = faster ball, more aces)
  // Per-player adjusted serve/hold probabilities
  p1ServeAdj: number;   // additive adjustment to serve point win prob
  p2ServeAdj: number;
  p1WinAdj: number;     // final additive adj to overall win prob
  p2WinAdj: number;
  factorSummary: { factor: string; impact: string; favors: string }[];
}

// High-altitude venues
const HIGH_ALTITUDE_COUNTRIES: Record<string, number> = {
  MEX: 2250, // Acapulco (actually sea level) — Mexico City would be 2240
  BOL: 3640, // Bolivia
  COL: 2600, // Bogota
  CHI: 520,  // Santiago — moderate
  ARG: 0,
  PER: 150,
};

async function buildContextFactors(
  p1: P, p2: P,
  surface: string,
  countryAcr: string,
  roundId: number,
  rankId: number,
  tour: string
): Promise<ContextFactors> {
  const isIndoor = surface === "Indoor Hard";

  // Round names
  const ROUND_NAMES: Record<number,string> = {
    1:"Qualifying R1",2:"Qualifying R2",3:"Qualifying R3",
    4:"First Round",5:"Second Round",6:"Third Round",7:"Fourth Round",
    8:"Quarterfinal",9:"Semifinal",10:"Final",11:"Round Robin",12:"Final"
  };
  const roundName = ROUND_NAMES[roundId] || `Round ${roundId}`;

  // Tournament level (rankId from API)
  // 1=Challenger/ITF, 2=250, 3=Masters/1000, 4=Grand Slam
  const LEVEL_MAP: Record<number,string> = { 1:"Challenger", 2:"ATP 250/500", 3:"Masters 1000", 4:"Grand Slam" };
  const tournamentLevel = LEVEL_MAP[rankId] || "Unknown";
  const isGrandSlam = rankId === 4;

  // Altitude
  const altitude = HIGH_ALTITUDE_COUNTRIES[countryAcr] || 0;

  // Fetch weather
  const weather = await getWeather(countryAcr, surface);

  // Fetch fatigue
  const fatigue = await getFatigue(
    p1.id as number, p2.id as number, tour,
    p1.name as string, p2.name as string, roundId
  );

  // ── Compute per-player adjustments ───────────────────────────────────────

  let p1ServeAdj = 0, p2ServeAdj = 0;
  let p1WinAdj = 0, p2WinAdj = 0;
  const factorSummary: { factor: string; impact: string; favors: string }[] = [];

  // 1. Wind — hurts higher-ranked serve-dominant players more
  if (!isIndoor && weather.windKph > 20) {
    const windPenalty = Math.min(0.04, (weather.windKph - 20) * 0.002);
    // Slightly more impact on bigger server (higher elo = bigger serve)
    const p1Elo = p1.elo as number, p2Elo = p2.elo as number;
    const biggerServer = p1Elo > p2Elo ? "p1" : "p2";
    if (biggerServer === "p1") { p1ServeAdj -= windPenalty; p2ServeAdj -= windPenalty * 0.7; }
    else { p1ServeAdj -= windPenalty * 0.7; p2ServeAdj -= windPenalty; }
    factorSummary.push({
      factor: `💨 Wind (${weather.windKph.toFixed(0)} km/h)`,
      impact: "Disrupts serve, more breaks expected",
      favors: "Returners / Grinders"
    });
  }

  // 2. Extreme heat — benefits fitter/younger players
  if (!isIndoor && weather.tempC > 30) {
    const heatPenalty = Math.min(0.05, (weather.tempC - 30) * 0.005);
    // Younger players (lower rank proxy for newer generation) handle heat better
    const p1Age = estimateAge(p1);
    const p2Age = estimateAge(p2);
    if (p1Age > p2Age + 3) { p1WinAdj -= heatPenalty; p2WinAdj += heatPenalty * 0.5; }
    else if (p2Age > p1Age + 3) { p2WinAdj -= heatPenalty; p1WinAdj += heatPenalty * 0.5; }
    else { p1WinAdj -= heatPenalty * 0.5; p2WinAdj -= heatPenalty * 0.5; }
    factorSummary.push({
      factor: `🌡️ Heat (${weather.tempC.toFixed(0)}°C)`,
      impact: "Increases fatigue, longer rallies even more brutal",
      favors: p1Age <= p2Age ? p1.name as string : p2.name as string
    });
  }

  // 3. Cold — slows ball on clay/grass, helps baseline players
  if (!isIndoor && weather.tempC < 12) {
    p1ServeAdj -= 0.01; p2ServeAdj -= 0.01; // slower ball = harder to ace
    factorSummary.push({
      factor: `🥶 Cold (${weather.tempC.toFixed(0)}°C)`,
      impact: "Ball plays heavy/slow, serve less effective",
      favors: "Baseline players"
    });
  }

  // 4. High altitude — faster ball, more aces, harder to return
  if (altitude > 1000) {
    const altBoost = Math.min(0.025, altitude / 100000);
    p1ServeAdj += altBoost; p2ServeAdj += altBoost;
    factorSummary.push({
      factor: `⛰️ High Altitude (${altitude}m)`,
      impact: "Ball travels faster, aces and winners more frequent",
      favors: "Big servers"
    });
  }

  // 5. Grand Slam best-of-5 fatigue advantage — fitter/stronger baseline players
  if (isGrandSlam) {
    const p1Elo = p1.elo as number, p2Elo = p2.elo as number;
    const eloGap = Math.abs(p1Elo - p2Elo);
    if (eloGap > 80) {
      // In GS, fitness matters more — amplifies elo gap slightly
      const gsBoost = 0.01;
      if (p1Elo > p2Elo) p1WinAdj += gsBoost; else p2WinAdj += gsBoost;
      factorSummary.push({
        factor: "🏆 Grand Slam (Bo5)",
        impact: "Physical fitness compounds over 5 sets",
        favors: p1Elo > p2Elo ? p1.name as string : p2.name as string
      });
    }
  }

  // 6. Deep round fatigue (SF/F)
  if (roundId >= 9) {
    // Both tired, but better player handles it
    const p1Elo = p1.elo as number, p2Elo = p2.elo as number;
    const fatigueDelta = roundId === 10 || roundId === 12 ? 0.015 : 0.008;
    if (p1Elo > p2Elo) p1WinAdj += fatigueDelta;
    else p2WinAdj += fatigueDelta;
    factorSummary.push({
      factor: `😮‍💨 ${roundName}`,
      impact: "Late round — champion mentality & fitness matters more",
      favors: p1Elo > p2Elo ? p1.name as string : p2.name as string
    });
  }

  // 7. Surface-country mismatch (extreme climate player vs surface)
  // e.g., clay court in cold/wet = benefits northern European players
  if (surface === "Clay" && !isIndoor) {
    const p1Country = (p1.country as string) || "";
    const p2Country = (p2.country as string) || "";
    const clayCulturedCountries = ["ESP","ARG","BRA","COL","FRA","ITA","CHI","POR"];
    const p1ClayCulture = clayCulturedCountries.includes(p1Country);
    const p2ClayCulture = clayCulturedCountries.includes(p2Country);
    if (p1ClayCulture && !p2ClayCulture) {
      p1WinAdj += 0.012;
      factorSummary.push({ factor: "🌍 Clay Culture", impact: "Grew up on clay — natural advantage", favors: p1.name as string });
    } else if (p2ClayCulture && !p1ClayCulture) {
      p2WinAdj += 0.012;
      factorSummary.push({ factor: "🌍 Clay Culture", impact: "Grew up on clay — natural advantage", favors: p2.name as string });
    }
  }

  // 8. Night match factor (if timeGame indicates evening)
  // We infer from tournament type — US Open night sessions are famous
  // No time data in API, so we note it as a manual override option

  // 9. Rain delay / interruption (clay becomes slower when wet, grass faster)
  if (!isIndoor && weather.rainProbPct > 50) {
    if (surface === "Clay") {
      p1ServeAdj -= 0.005; p2ServeAdj -= 0.005;
      factorSummary.push({
        factor: "🌧️ Wet Clay",
        impact: "Heavy clay after rain — extreme baseline grinding",
        favors: "Physical baseliners"
      });
    } else if (surface === "Grass") {
      factorSummary.push({
        factor: "🌧️ Wet Grass",
        impact: "Slippery grass — unpredictable bounces",
        favors: "Adaptive players"
      });
    }
  }

  return {
    weather, fatigue, roundName, tournamentLevel, isGrandSlam, isIndoor, altitude,
    p1ServeAdj, p2ServeAdj, p1WinAdj, p2WinAdj, factorSummary
  };
}

// Rough age estimate from career length / ranking points (proxy)
function estimateAge(p: P): number {
  const rank = (p.rank as number) || 100;
  const pts = (p.pts as number) || 500;
  // Higher points + lower rank = usually veteran (but not always)
  // This is a rough proxy — we don't have DOB in the stats object
  // Top 10 vets tend to have huge pts, new stars also have huge pts
  // Use elo as stability proxy: very high elo = established player
  const elo = (p.elo as number) || 1500;
  if (elo > 2200) return 26; // established elite
  if (elo > 2000) return 24;
  if (elo > 1800) return 23;
  return 22;
}

// ─── Player stats ─────────────────────────────────────────────────────────────

function elo(pts: number|null, rank: number|null): number {
  if (pts && pts > 0) return 1200 + Math.min(1250, Math.log1p(pts) * 115);
  if (rank && rank > 0) return Math.max(1200, 2450 - rank * 5);
  return 1350;
}
function swr(hist: unknown[], sid: number, yrs = 3): number|null {
  const allY = [...new Set((hist as Record<string,unknown>[]).map(e => e.year as number))].sort((a,b)=>b-a);
  const recent = new Set(allY.slice(0, yrs));
  let w = 0, l = 0;
  for (const yr of hist as Record<string,unknown>[]) {
    if (!recent.has(yr.year as number)) continue;
    for (const s of (yr.surfaces as Record<string,unknown>[]) || []) {
      if (s.courtId === sid) { w += (s.courtWins as number)||0; l += (s.courtLosses as number)||0; }
    }
  }
  return (w+l)>0 ? w/(w+l) : null;
}
function swrPts(hard:number,clay:number,grass:number,ihard:number,surf:string): number {
  const avg: Record<string,number> = { Hard:0.55, Clay:0.30, Grass:0.10, "Indoor Hard":0.05 };
  const pts: Record<string,number> = { Hard:hard, Clay:clay, Grass:grass, "Indoor Hard":ihard };
  const tot = hard+clay+grass+ihard;
  if (tot===0) return 0.50;
  const rel = (pts[surf]||0)/tot / Math.max(0.01, avg[surf]||0.33);
  return Math.max(0.25, Math.min(0.82, 0.35+(rel-0.5)*0.35+0.15));
}
function owr(perf: Record<string,unknown>, yrs=3): number {
  const ks = Object.keys(perf).sort().reverse().slice(0, yrs);
  let w=0,l=0;
  for (const k of ks) {
    const t = (((perf[k] as Record<string,unknown>)?.level as Record<string,unknown>)?.total as Record<string,number>)||{};
    w+=t.aw||0; l+=t.al||0;
  }
  return (w+l)>0 ? w/(w+l) : 0.50;
}
function sd(n:number|undefined, d:number|undefined, def:number): number {
  return (n && d && d > 0) ? n/d : def;
}

async function playerStats(id: number, tour: string, cache: Map<number,Record<string,unknown>>): Promise<Record<string,unknown>> {
  const defs = tour === "atp" ? ATP_DEF : WTA_DEF;
  const [prof, ms, hist, perf] = await Promise.all([
    apiFetch(`/tennis/v2/${tour}/player/profile/${id}`, { include:"form,ranking,country" }).then(d=>ud(d)),
    apiFetch(`/tennis/v2/${tour}/player/match-stats/${id}`).then(d=>ud(d)||{}),
    apiFetch(`/tennis/v2/${tour}/player/surface-summary/${id}`).then(d=>toList(d)),
    apiFetch(`/tennis/v2/${tour}/player/perf-breakdown/${id}`).then(d=>ud(d)),
  ]);
  const rk = cache.get(id) || {};
  const rank = (rk.rank as number)||(prof.currentRank as number)||null;
  const pts  = (rk.pts as number)||(prof.points as number)||null;
  const name = (rk.name as string)||(prof.name as string)||`P${id}`;
  const country = (prof.countryAcr as string) || "";
  const elv  = elo(pts, rank);
  const hard=(prof.hardPoints as number)||0, clay=(prof.clayPoints as number)||0;
  const grass=(prof.grassPoints as number)||0, ihard=(prof.ihardPoints as number)||0;
  const stot=hard+clay+grass+ihard;
  const sratio = stot>0
    ? {Hard:hard/stot,Clay:clay/stot,Grass:grass/stot,"Indoor Hard":ihard/stot}
    : {Hard:0.25,Clay:0.25,Grass:0.25,"Indoor Hard":0.25};
  const surfWr: Record<string,number> = {};
  for (const [cid, cn] of [[1,"Hard"],[2,"Clay"],[3,"Grass"],[4,"Indoor Hard"]] as [number,string][]) {
    const h = swr(hist, cid);
    surfWr[cn] = h !== null ? h : swrPts(hard,clay,grass,ihard,cn);
  }
  const svc=(ms.serviceStats as Record<string,number>)||{};
  const bpS=(ms.breakPointsServeStats as Record<string,number>)||{};
  const bpR=(ms.breakPointsRtnStats as Record<string,number>)||{};
  const boost=Math.max(0,(elv-1800)/600)*0.04;
  return {
    id, name, rank, pts, elo:elv, owr:owr(perf), country,
    surfWr, sratio,
    serve:{ fp:sd(svc.firstServeGm,svc.firstServeOfGm,defs.fp),
      w1:Math.min(0.88,sd(svc.winningOnFirstServeGm,svc.winningOnFirstServeOfGm,defs.w1)+boost),
      w2:Math.min(0.72,sd(svc.winningOnSecondServeGm,svc.winningOnSecondServeOfGm,defs.w2)+boost*0.5),
      bps:Math.min(0.80,sd(bpS.breakPointSavedGm,bpS.breakPointFacedGm,defs.bps)+boost*0.5) },
    ret:{bpc:Math.min(0.60,sd(bpR.breakPointWonGm,bpR.breakPointChanceGm,defs.bpc)+boost*0.5)},
    ace:defs.ace*(0.7+((elv-1350)/(2450-1350))*0.8), df:defs.df,
  };
}

async function h2hCtx(p1:number,p2:number,tour:string): Promise<Record<string,unknown>> {
  try {
    const [info,stats]=await Promise.all([apiFetch(`/tennis/v2/${tour}/h2h/info/${p1}/${p2}`),apiFetch(`/tennis/v2/${tour}/h2h/stats/${p1}/${p2}`).then(d=>ud(d))]);
    const i=info as Record<string,unknown>;
    const p1w=(i.player1AllWins as number)||0, p2w=(i.player2AllWins as number)||0, tot=p1w+p2w;
    if(tot===0) return {wr:0.5,n:0,ok:false};
    const s=stats as Record<string,unknown>;
    return {wr:p1w/tot,n:tot,p1w,p2w,ok:true,p1s:s.player1Stats||{},p2s:s.player2Stats||{}};
  } catch (_e) { return {wr:0.5,n:0,ok:false}; }
}

// ─── Simulation models ────────────────────────────────────────────────────────

type P = Record<string,unknown>;

function spv(p:P, surf:string, serveAdj=0): number {
  const r=(p.sratio as Record<string,number>)[surf]||0.25, adj=(r-0.25)*0.1+serveAdj;
  const s=p.serve as Record<string,number>;
  const fp=Math.max(0.35,Math.min(0.95,s.fp+adj));
  const w1=Math.max(0.35,Math.min(0.95,s.w1+adj));
  const w2=Math.max(0.35,Math.min(0.95,s.w2+adj*0.5));
  return fp*w1+(1-fp)*w2;
}
function gprob(p:number): number {
  if(p>=1)return 1;if(p<=0)return 0;const q=1-p,pd=(p*p)/(p*p+q*q);
  return Math.min(0.99,Math.max(0.01,p**4+4*p**4*q+10*p**4*q**2+20*p**3*q**3*pd));
}
function hold(p:P,s:string,adj=0): number { return gprob(spv(p,s,adj)); }
function ppf(k:number,lam:number): number {
  if(lam<=0)return k===0?1:0;let lp=-lam+k*Math.log(lam);for(let i=1;i<=k;i++)lp-=Math.log(i);return Math.exp(lp);
}
function mwfs(ps:number,stw:number): number { const q=1-ps;return stw===2?ps**2+2*ps**2*q:ps**3+3*ps**3*q+6*ps**3*q**2; }
function exsets(ps:number,stw:number): number { const q=1-ps;return stw===2?2*(ps**2+q**2)+3*(2*ps*q):3+2*(1-Math.abs(ps-0.5)*2); }
function ssc(wp:number,bo:number): string {
  const s=Math.ceil(bo/2);if(wp>=0.80)return`${s}-0`;if(wp>=0.60)return`${s}-1`;
  if(wp>=0.50)return bo===3?`${s}-1`:`${s}-2`;if(wp>=0.40)return`${s-1}-${s}`;if(wp>=0.25)return`1-${s}`;return`0-${s}`;
}
function estst(wp:number,bo:number): [number,number,number] {
  const stw=Math.ceil(bo/2),c=1-Math.abs(wp-0.5)*2,sets=stw+c*(stw-1);return[sets*(9+c*1.5),sets,sets*(0.8+c*0.6)];
}

function mcModel(p1:P,p2:P,surf:string,bo:number,ctx:ContextFactors,n=10000): Record<string,unknown> {
  const h1=hold(p1,surf,ctx.p1ServeAdj), h2=hold(p2,surf,ctx.p2ServeAdj), stw=Math.ceil(bo/2);
  let wins=0;const sets:number[]=[],games:number[]=[],brks:number[]=[];
  for(let i=0;i<n;i++){
    let s1=0,s2=0,mg=0,mb=0,srv=Math.random()<0.5?1:2;
    while(s1<stw&&s2<stw){
      let g1=0,g2=0,sb=0;
      for(;;){
        if(srv===1){if(Math.random()<h1)g1++;else{g2++;sb++;}}else{if(Math.random()<h2)g2++;else{g1++;sb++;}}
        srv=srv===1?2:1;
        if(g1>=6&&g1-g2>=2){s1++;mg+=g1+g2;mb+=sb;break;}
        if(g2>=6&&g2-g1>=2){s2++;mg+=g1+g2;mb+=sb;break;}
        if(g1===6&&g2===6){const pt=(spv(p1,surf,ctx.p1ServeAdj)+(1-spv(p2,surf,ctx.p2ServeAdj)))/2;if(Math.random()<pt)s1++;else s2++;mg+=13;mb+=sb;break;}
      }
    }
    if(s1>s2)wins++;sets.push(s1+s2);games.push(mg);brks.push(mb);
  }
  const wp=Math.max(0.01,Math.min(0.99,(wins/n)+ctx.p1WinAdj-ctx.p2WinAdj));
  const ag=games.reduce((a,b)=>a+b,0)/n,as=sets.reduce((a,b)=>a+b,0)/n,ab=brks.reduce((a,b)=>a+b,0)/n;
  return{model:"Monte Carlo",p1WinProb:+wp.toFixed(4),p2WinProb:+(1-wp).toFixed(4),predictedSetScore:ssc(wp,bo),
    avgTotalSets:+as.toFixed(1),avgTotalGames:+ag.toFixed(1),avgTotalBreaks:+ab.toFixed(1),
    estAcesP1:+((p1.ace as number)*ag/2).toFixed(1),estAcesP2:+((p2.ace as number)*ag/2).toFixed(1)};
}

function lrModel(p1:P,p2:P,surf:string,h2h:Record<string,unknown>,bo:number,ctx:ContextFactors): Record<string,unknown> {
  const ed=((p1.elo as number)-(p2.elo as number))/400;
  const sw1=(p1.surfWr as Record<string,number>)[surf]??(p1.owr as number),sw2=(p2.surfWr as Record<string,number>)[surf]??(p2.owr as number);
  const sv1=spv(p1,surf,ctx.p1ServeAdj),sv2=spv(p2,surf,ctx.p2ServeAdj);
  const b1=(p1.ret as Record<string,number>).bpc,b2=(p2.ret as Record<string,number>).bpc;
  const a1=(p1.sratio as Record<string,number>)[surf]||0.25,a2=(p2.sratio as Record<string,number>)[surf]||0.25;
  const ht=(h2h.ok&&(h2h.n as number)>=3)?((h2h.wr as number)-0.5)*0.07:0;
  const ctxTerm = ctx.p1WinAdj - ctx.p2WinAdj;
  const wp=Math.max(0.01,Math.min(0.99,1/(1+Math.exp(-(1.5*ed+0.8*(sw1-sw2)+1.2*(sv1-sv2)+0.6*(b1-b2)+0.4*(a1-a2)+ht)))+ctxTerm));
  const[ag,as,ab]=estst(wp,bo);
  return{model:"Logistic Regression",p1WinProb:+wp.toFixed(4),p2WinProb:+(1-wp).toFixed(4),predictedSetScore:ssc(wp,bo),
    avgTotalGames:+ag.toFixed(1),avgTotalSets:+as.toFixed(1),avgTotalBreaks:+ab.toFixed(1)};
}

function poiModel(p1:P,p2:P,surf:string,bo:number,ctx:ContextFactors): Record<string,unknown> {
  const sv1=spv(p1,surf,ctx.p1ServeAdj),sv2=spv(p2,surf,ctx.p2ServeAdj),tot=sv1+sv2;
  const sf:Record<string,number>={Hard:1,Clay:1.08,Grass:0.9,"Indoor Hard":0.95};
  const l1=sv1/tot*9.5*(sf[surf]||1),l2=sv2/tot*9.5*(sf[surf]||1);
  let ps=0,tt=0;
  for(let g1=0;g1<=15;g1++)for(let g2=0;g2<=15;g2++){const pr=ppf(g1,l1)*ppf(g2,l2);if(g1>g2)ps+=pr;tt+=pr;}
  ps/=Math.max(tt,1e-9);
  const stw=Math.ceil(bo/2);
  const wp=Math.max(0.01,Math.min(0.99,mwfs(ps,stw)+ctx.p1WinAdj-ctx.p2WinAdj));
  const as=exsets(ps,stw),ag=as*(l1+l2),h1=hold(p1,surf,ctx.p1ServeAdj),h2=hold(p2,surf,ctx.p2ServeAdj);
  const ab=as*((1-h1)+(1-h2))*(l1+l2)/2,am:Record<string,number>={Hard:1,Clay:0.75,Grass:1.35,"Indoor Hard":0.95};
  return{model:"Poisson Distribution",p1WinProb:+wp.toFixed(4),p2WinProb:+(1-wp).toFixed(4),predictedSetScore:ssc(wp,bo),
    avgTotalSets:+as.toFixed(1),avgTotalGames:+ag.toFixed(1),avgTotalBreaks:+ab.toFixed(1),
    estAcesP1:+((p1.ace as number)*(am[surf]||1)*ag/2).toFixed(1),estAcesP2:+((p2.ace as number)*(am[surf]||1)*ag/2).toFixed(1)};
}

function anModel(p1:P,p2:P,surf:string,h2h:Record<string,unknown>,bo:number,ctx:ContextFactors): Record<string,unknown> {
  function sp(a:number,b:number){return(a+b)>0?a/(a+b):0.5;}
  const sw1=(p1.surfWr as Record<string,number>)[surf]??(p1.owr as number),sw2=(p2.surfWr as Record<string,number>)[surf]??(p2.owr as number);
  const sv1=spv(p1,surf,ctx.p1ServeAdj),sv2=spv(p2,surf,ctx.p2ServeAdj);
  const b1=(p1.ret as Record<string,number>).bpc,b2=(p2.ret as Record<string,number>).bpc;
  const a1=(p1.sratio as Record<string,number>)[surf]||0.25,a2=(p2.sratio as Record<string,number>)[surf]||0.25;
  const r1=1/Math.max(1,(p1.rank as number)||200),r2=1/Math.max(1,(p2.rank as number)||200);
  const hh=(h2h.ok&&(h2h.n as number)>=3)?(h2h.wr as number):0.5;
  const base=0.25*sp(p1.elo as number,p2.elo as number)+0.20*sp(sw1,sw2)+0.18*sp(sv1,sv2)+0.12*sp(b1,b2)+0.12*sp(a1,a2)+0.05*sp(r1,r2)+0.08*hh;
  const wp=Math.max(0.01,Math.min(0.99,base+ctx.p1WinAdj-ctx.p2WinAdj));
  const[ag,as,ab]=estst(wp,bo);
  return{model:"Analytical",p1WinProb:+wp.toFixed(4),p2WinProb:+(1-wp).toFixed(4),predictedSetScore:ssc(wp,bo),
    avgTotalGames:+ag.toFixed(1),avgTotalSets:+as.toFixed(1),avgTotalBreaks:+ab.toFixed(1),
    estAcesP1:+((p1.ace as number)*ag/2).toFixed(1),estAcesP2:+((p2.ace as number)*ag/2).toFixed(1)};
}

function ensembleModel(r1:Record<string,unknown>,r2:Record<string,unknown>,r3:Record<string,unknown>,r4:Record<string,unknown>,p1:P,p2:P,bo:number): Record<string,unknown> {
  const w={m:0.35,l:0.25,p:0.20,a:0.20};
  const wp=Math.max(0.01,Math.min(0.99,w.m*(r1.p1WinProb as number)+w.l*(r2.p1WinProb as number)+w.p*(r3.p1WinProb as number)+w.a*(r4.p1WinProb as number)));
  const avg=(k:string)=>w.m*((r1[k]||0)as number)+w.l*((r2[k]||0)as number)+w.p*((r3[k]||0)as number)+w.a*((r4[k]||0)as number);
  const ag=avg("avgTotalGames"),as=avg("avgTotalSets"),ab=avg("avgTotalBreaks");
  const a1=avg("estAcesP1")||((p1.ace as number)*ag/2),a2=avg("estAcesP2")||((p2.ace as number)*ag/2);
  const ps=[r1.p1WinProb,r2.p1WinProb,r3.p1WinProb,r4.p1WinProb] as number[];
  const mu=ps.reduce((a,b)=>a+b,0)/4,std=Math.sqrt(ps.reduce((a,b)=>a+(b-mu)**2,0)/4);
  return{model:"Super Combined",p1WinProb:+wp.toFixed(4),p2WinProb:+(1-wp).toFixed(4),predictedSetScore:ssc(wp,bo),
    avgTotalSets:+as.toFixed(1),avgTotalGames:+ag.toFixed(1),avgTotalBreaks:+ab.toFixed(1),
    estAcesP1:+a1.toFixed(1),estAcesP2:+a2.toFixed(1),
    estDoubleFaultsP1:+((p1.df as number)*ag/2).toFixed(1),estDoubleFaultsP2:+((p2.df as number)*ag/2).toFixed(1),
    modelAgreement:{monteCarlo:r1.p1WinProb,logisticRegression:r2.p1WinProb,poisson:r3.p1WinProb,analytical:r4.p1WinProb,
      stdDeviation:+std.toFixed(4),confidence:std<0.05?"High":std<0.10?"Medium":"Low"},weightsUsed:w};
}

function runPredict(
  p1:P, p2:P, surf:string, bo:number,
  h2h:Record<string,unknown>, ctx:ContextFactors, n=10000
): Record<string,unknown> {
  const r1=mcModel(p1,p2,surf,bo,ctx,n);
  const r2=lrModel(p1,p2,surf,h2h,bo,ctx);
  const r3=poiModel(p1,p2,surf,bo,ctx);
  const r4=anModel(p1,p2,surf,h2h,bo,ctx);
  const comb=ensembleModel(r1,r2,r3,r4,p1,p2,bo);
  return{
    player1:{id:p1.id,name:p1.name,rank:p1.rank,elo:Math.round(p1.elo as number),country:p1.country},
    player2:{id:p2.id,name:p2.name,rank:p2.rank,elo:Math.round(p2.elo as number),country:p2.country},
    surface:surf,bestOf:bo,
    contextFactors:{
      weather:{
        condition:ctx.weather.condition,
        tempC:ctx.weather.tempC,
        windKph:ctx.weather.windKph,
        rainProbPct:ctx.weather.rainProbPct,
        isOutdoor:ctx.weather.isOutdoor,
      },
      round:ctx.roundName,
      tournamentLevel:ctx.tournamentLevel,
      isGrandSlam:ctx.isGrandSlam,
      altitude:ctx.altitude,
      factorSummary:ctx.factorSummary,
      netAdjP1:+(ctx.p1WinAdj-ctx.p2WinAdj).toFixed(4),
    },
    models:{monteCarlo:r1,logisticRegression:r2,poisson:r3,analytical:r4},
    superCombined:comb,
    predictedWinner:(comb.p1WinProb as number)>0.5?p1.name:p2.name,
    winnerWinPct:+(Math.max(comb.p1WinProb as number,comb.p2WinProb as number)*100).toFixed(1),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:CORS});
  try{
    let body:Record<string,unknown>={};
    if(req.method==="POST"){try{body=await req.json();}catch(_e){/**/}}
    else{const u=new URL(req.url);u.searchParams.forEach((v,k)=>{body[k]=v;});}
    const route=(body.route as string)||"health";

    if(route==="health") return Response.json({status:"ok",service:"Tennis Prediction Engine v2.0 — with Contextual Factors"},{headers:CORS});

    if(route==="fixtures"){
      const tour=((body.tour as string)||"atp").toLowerCase(),date=(body.date as string)||new Date().toISOString().slice(0,10);
      const matches=await fetchFixtures(tour,date,Number(body.pageSize)||50);
      const out=matches.map(m=>{const f=m as Record<string,unknown>;const t=(f.tournament as Record<string,unknown>)||{};
        return{...f,surface:SURFACE_MAP[t.courtId as number]||"Hard",bestOf:(t.rankId as number)===1&&tour==="atp"?5:3};});
      return Response.json({tour,date,count:out.length,fixtures:out},{headers:CORS});
    }

    if(route==="rankings"){
      const tour=((body.tour as string)||"atp").toLowerCase();
      const data=await fetchRankings(tour,Number(body.pageSize)||50);
      const out=data.map(e=>{const en=e as Record<string,unknown>;const p=en.player as Record<string,unknown>;
        return{rank:en.position,points:en.point,id:p.id,name:p.name,country:p.countryAcr};});
      return Response.json({tour,count:out.length,rankings:out},{headers:CORS});
    }

    if(route==="predict"||route==="predictCustom"){
      const tour=((body.tour as string)||"atp").toLowerCase();
      const p1Id=Number(body.p1Id||body.p1_id),p2Id=Number(body.p2Id||body.p2_id);
      if(!p1Id||!p2Id)throw new Error("p1Id and p2Id required");
      const surf=(body.surface as string)||"Hard",bo=Number(body.bestOf||body.best_of||3),n=Number(body.sims||10000);
      const countryAcr=(body.countryAcr as string)||"DEF";
      const roundId=Number(body.roundId||4),rankId=Number(body.rankId||2);
      const rc=await buildCache(tour);
      const[p1,p2,h2h]=await Promise.all([playerStats(p1Id,tour,rc),playerStats(p2Id,tour,rc),h2hCtx(p1Id,p2Id,tour)]);
      const ctx=await buildContextFactors(p1,p2,surf,countryAcr,roundId,rankId,tour);
      const result=runPredict(p1,p2,surf,bo,h2h,ctx,n);
      (result as Record<string,unknown>).h2hSummary=h2h;
      return Response.json(result,{headers:CORS});
    }

    if(route==="predictFixture"){
      const tour=((body.tour as string)||"atp").toLowerCase(),fid=Number(body.fixtureId||body.fixture_id);
      const matches=await fetchFixtures(tour,new Date().toISOString().slice(0,10),100);
      const fx=(matches as Record<string,unknown>[]).find(f=>f.id===fid);
      if(!fx)throw new Error(`Fixture ${fid} not found`);
      const t=(fx.tournament as Record<string,unknown>)||{};
      const surf=SURFACE_MAP[t.courtId as number]||"Hard",bo=(t.rankId as number)===1&&tour==="atp"?5:3;
      const countryAcr=(t.countryAcr as string)||"DEF";
      const roundId=(fx.roundId as number)||4,rankId=(t.rankId as number)||2;
      const rc=await buildCache(tour);
      const[p1,p2,h2h]=await Promise.all([playerStats(fx.player1Id as number,tour,rc),playerStats(fx.player2Id as number,tour,rc),h2hCtx(fx.player1Id as number,fx.player2Id as number,tour)]);
      const ctx=await buildContextFactors(p1,p2,surf,countryAcr,roundId,rankId,tour);
      const result=runPredict(p1,p2,surf,bo,h2h,ctx);
      (result as Record<string,unknown>).fixture=fx;(result as Record<string,unknown>).h2hSummary=h2h;
      return Response.json(result,{headers:CORS});
    }

    if(route==="player"){
      const tour=((body.tour as string)||"atp").toLowerCase(),pid=Number(body.playerId||body.player_id);
      const rc=await buildCache(tour);
      return Response.json(await playerStats(pid,tour,rc),{headers:CORS});
    }

    if(route==="search"){
      const tour=((body.tour as string)||"atp").toLowerCase(),name=body.name as string||"";
      if(!name)throw new Error("name required");
      const res=await apiFetch(`/tennis/v2/${tour}/player`,{filter:`PlayerName:${name}`,pageSize:20});
      return Response.json({query:name,tour,results:toList(res)},{headers:CORS});
    }

    return Response.json({error:`Unknown route: ${route}`},{status:400,headers:CORS});
  }catch(err){
    return Response.json({error:err instanceof Error?err.message:String(err)},{status:500,headers:CORS});
  }
});
