// Secure API Proxy Configuration
// This replaces the old direct API calls with secure backend proxy
// API keys are stored server-side in Netlify environment variables

const PROXY_URL = '/.netlify/functions/tennis-api';
const SOFASCORE_ENDPOINT = 'https://api.sofascore.com/api/v1';

// Legacy config - REMOVE after migration complete
// const KEY = 'dbc967df17msh7bb8135c5d858c3p138f49jsn106697ef9b98'; // REVOKE THIS KEY!
// const BASE = 'https://tennis-api-atp-wta-itf.p.rapidapi.com';
// const HDR = { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'tennis-api-atp-wta-itf.p.rapidapi.com' };

// ═══ SECURE API PROXY HANDLER ═══════════════════════════════════════════════
async function apiFetch(path, params = {}, source = 'sofascore') {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: path,
        params: params,
        source: source, // 'sofascore' or 'rapidapi' (fallback)
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Proxy error: ${error.error || response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Proxy Error:', error);
    // Gracefully handle errors - show user-friendly message
    throw new Error(`Data fetch failed: ${error.message}`);
  }
}

// Transform SofaScore tournament to app format
function transformSofaScoreTournament(tournament) {
  if (!tournament) return null;
  return {
    id: tournament.id,
    name: tournament.name,
    rank: tournament.rank || 0,
    rankId: tournament.rank || 0,
    surface: tournament.surface?.name || 'Hard',
    court: tournament.court?.name || 'Unknown',
    country: tournament.country?.name || '',
    countryAcr: tournament.country?.alpha2 || '',
  };
}

// Transform SofaScore event (match) to app fixture format
function transformSofaScoreEvent(event) {
  if (!event) return null;
  
  return {
    id: event.id,
    player1: {
      id: event.homeTeam?.id,
      name: event.homeTeam?.name,
      rank: event.homeTeam?.ranking || 500,
      country: event.homeTeam?.country?.alpha2 || '',
      countryAcr: event.homeTeam?.country?.alpha2 || '',
      elo: event.homeTeam?.elo || 1600,
    },
    player2: {
      id: event.awayTeam?.id,
      name: event.awayTeam?.name,
      rank: event.awayTeam?.ranking || 500,
      country: event.awayTeam?.country?.alpha2 || '',
      countryAcr: event.awayTeam?.country?.alpha2 || '',
      elo: event.awayTeam?.elo || 1600,
    },
    tournament: transformSofaScoreTournament(event.tournament),
    startTime: event.startTimestamp,
    startDate: new Date(event.startTimestamp * 1000),
    status: event.status?.type || 'scheduled', // 'scheduled', 'live', 'finished'
    bestOf: event.bestOf || 3,
    hasOdds: event.hasOdds || false,
  };
}

function toList(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && Array.isArray(d.data)) return d.data;
  return [];
}

// Fetch tennis fixtures via SofaScore (primary) with RapidAPI fallback
async function fetchFixtures(tour, date) {
  try {
    // Try SofaScore first
    const path = tour === 'atp' ? '/tennis/tournaments/252/events' : '/tennis/tournaments/320/events';
    const res = await apiFetch(path, { 
      eventType: 'singles',
      limit: 100 
    }, 'sofascore');

    const items = toList(res);
    const fixtures = items.map(e => transformSofaScoreEvent(e)).filter(Boolean);

    if (!fixtures.length) {
      console.warn('No fixtures from SofaScore, trying RapidAPI fallback...');
      return fetchFixturesRapidAPI(tour, date);
    }

    return fixtures;
  } catch (err) {
    console.warn('SofaScore fetch failed:', err);
    // Fallback to RapidAPI
    return fetchFixturesRapidAPI(tour, date);
  }
}

// Fallback: Fetch from RapidAPI via proxy
async function fetchFixturesRapidAPI(tour, date) {
  try {
    const path = `/tennis/v2/${tour}/fixtures/${date}`;
    const res = await apiFetch(path, {
      include: 'round,tournament.court,tournament.rank',
      filter: 'PlayerGroup:singles',
      pageSize: 100,
      pageNo: 1,
    }, 'rapidapi');

    return toList(res);
  } catch (err) {
    console.error('RapidAPI fallback also failed:', err);
    return [];
  }
}

// Fetch rankings via SofaScore with fallback
async function fetchRankings(tour) {
  try {
    const tourId = tour === 'atp' ? 252 : 320; // ATP/WTA tour IDs
    const path = `/tennis/tournaments/${tourId}/rankings`;
    const res = await apiFetch(path, { limit: 200 }, 'sofascore');

    const items = toList(res);
    if (items.length > 0) return items;

    // Fallback to RapidAPI
    return apiFetch(
      `/tennis/v2/${tour}/ranking/singles`,
      { pageSize: 200 },
      'rapidapi'
    ).then(toList).catch(() => []);
  } catch (err) {
    console.warn('Rankings fetch failed:', err);
    return [];
  }
}

// Build ranking cache with error handling
async function buildRankCache(tour) {
  if (state.rankCache.size && state.rankCacheTour === tour) return;
  
  try {
    const rows = await fetchRankings(tour);
    state.rankCache.clear();

    rows.forEach((e) => {
      const p = e.player || e;
      const id = p.id;
      if (id) {
        state.rankCache.set(id, {
          rank: e.position || e.rank,
          pts: e.point || e.points,
          name: p.name,
          country: p.countryAcr || p.country,
        });
      }
    });

    state.rankCacheTour = tour;
  } catch (err) {
    console.error('Failed to build rank cache:', err);
  }
}

// Get player stats from cache or API
async function getPlayerStats(pid, tour) {
  const rc = state.rankCache;
  const re = rc.get(pid) || {};

  const def =
    tour === 'atp'
      ? { rank: 250, pts: 0, elo: 1600 }
      : { rank: 150, pts: 0, elo: 1500 };

  return {
    rank: re.rank ?? def.rank,
    pts: re.pts ?? def.pts,
    elo: calcElo(re.rank ?? def.rank, tour),
    name: re.name ?? 'Unknown Player',
  };
}

function calcElo(rank, tour) {
  // Simple Elo estimation from rank
  if (!rank || rank > 200) return tour === 'atp' ? 1550 : 1450;
  const factor = tour === 'atp' ? 12 : 10;
  return Math.max(1200, 2000 - rank * factor);
}

function clayBonus(country) {
  const clayCountries = {
    'ESP': 0.4, 'ARG': 0.35, 'ITA': 0.25, 'CHI': 0.2, 'FRA': 0.15, 'POR': 0.1,
  };
  return clayCountries[country] || 0;
}
