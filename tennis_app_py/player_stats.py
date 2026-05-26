"""
Player Stats Aggregator
Pulls and normalizes player data for simulation models.
Computes Elo ratings, surface-adjusted win rates, and serve/return metrics.
"""
import math
from typing import Optional
from api_client import (
    get_player_profile, get_player_match_stats,
    get_player_surface_summary, get_player_perf_breakdown,
    get_h2h_info, get_h2h_stats, get_player_by_rank_list
)

# Surface court IDs in the API
SURFACE_MAP = {1: "Hard", 2: "Clay", 3: "Grass", 4: "Indoor Hard"}

# ATP averages used as fallback when API data is null
ATP_DEFAULTS = {
    "first_serve_pct": 0.62,
    "win_on_first_serve": 0.73,
    "win_on_second_serve": 0.52,
    "break_point_save_pct": 0.62,
    "break_point_convert_pct": 0.38,
    "aces_per_game": 0.8,
    "double_faults_per_game": 0.3,
}
WTA_DEFAULTS = {
    "first_serve_pct": 0.60,
    "win_on_first_serve": 0.68,
    "win_on_second_serve": 0.47,
    "break_point_save_pct": 0.57,
    "break_point_convert_pct": 0.43,
    "aces_per_game": 0.2,
    "double_faults_per_game": 0.5,
}

# Surface ace/DF multipliers
SURFACE_ACE_MULT = {"Hard": 1.0, "Clay": 0.75, "Grass": 1.35, "Indoor Hard": 0.95}
SURFACE_DF_MULT  = {"Hard": 1.0, "Clay": 0.9,  "Grass": 1.1,  "Indoor Hard": 1.0}


def compute_elo_from_ranking_points(ranking_points: Optional[int],
                                     rank: Optional[int]) -> float:
    """
    Map full 52-week ATP/WTA ranking points to Elo scale (1200–2500).
    14700 pts (world #1) ≈ 2450 Elo.
    500 pts (rank ~60)   ≈ 1700 Elo.
    """
    if ranking_points and ranking_points > 0:
        return 1200 + min(1250, math.log1p(ranking_points) * 115)
    if rank and rank > 0:
        return max(1200, 2450 - rank * 5)
    return 1350  # unranked / low level default


def surface_win_rate_from_points(ranking_points: int,
                                  hard_pts: Optional[int],
                                  clay_pts: Optional[int],
                                  grass_pts: Optional[int],
                                  ihard_pts: Optional[int],
                                  surface: str) -> float:
    """
    Derive approximate surface win rate from how a player's points
    distribute across surfaces vs tour average share.
    Tour avg shares (ATP): Hard ~55%, Clay ~30%, Grass ~10%, Indoor ~5%
    """
    tour_avg = {"Hard": 0.55, "Clay": 0.30, "Grass": 0.10, "Indoor Hard": 0.05}
    surface_pts_map = {
        "Hard": (hard_pts or 0),
        "Clay": (clay_pts or 0),
        "Grass": (grass_pts or 0),
        "Indoor Hard": (ihard_pts or 0),
    }
    total_surface_pts = sum(surface_pts_map.values())
    if total_surface_pts == 0 or not ranking_points:
        return 0.50  # neutral
    
    player_share = surface_pts_map.get(surface, 0) / max(1, total_surface_pts)
    avg_share = tour_avg.get(surface, 0.33)
    
    # Relative strength: player_share / avg_share centered at 0.5
    relative = player_share / max(0.01, avg_share)
    # Map 0–2+ relative to 0.25–0.80 win rate
    win_rate = 0.35 + min(0.45, (relative - 0.5) * 0.35 + 0.15)
    return round(max(0.25, min(0.82, win_rate)), 4)


def compute_surface_win_rate_from_history(surface_summary: list,
                                           surface_id: int,
                                           years: int = 3) -> Optional[float]:
    """Compute win rate on surface from historical match data (last N years)."""
    wins, losses = 0, 0
    all_years = sorted({s["year"] for s in surface_summary}, reverse=True)
    recent = set(all_years[:years])
    for yr in surface_summary:
        if yr["year"] not in recent:
            continue
        for surf in yr.get("surfaces", []):
            if surf["courtId"] == surface_id:
                wins   += surf.get("courtWins", 0) or 0
                losses += surf.get("courtLosses", 0) or 0
    total = wins + losses
    return (wins / total) if total > 0 else None


def compute_overall_win_rate(perf_breakdown: dict, years: int = 3) -> float:
    """Overall win rate from perf breakdown (last N years)."""
    wins, losses = 0, 0
    recent = sorted(perf_breakdown.keys(), reverse=True)[:years]
    for yr in recent:
        lvl = perf_breakdown[yr].get("level", {}).get("total", {})
        wins   += lvl.get("aw", 0) or 0
        losses += lvl.get("al", 0) or 0
    total = wins + losses
    return (wins / total) if total > 0 else 0.50


def get_player_stats(player_id: int, tour: str = "atp",
                     rank_cache: dict = None) -> dict:
    """
    Aggregate all stats for a player into a normalized dict for simulation.
    rank_cache: optional pre-fetched rankings dict {player_id: {...}} to avoid
                re-fetching rankings for every player in batch mode.
    """
    defaults = ATP_DEFAULTS if tour == "atp" else WTA_DEFAULTS

    # --- Fetch data ---
    profile        = get_player_profile(player_id, tour)
    match_stats    = get_player_match_stats(player_id, tour)
    surface_hist   = get_player_surface_summary(player_id, tour)
    perf_breakdown = get_player_perf_breakdown(player_id, tour)

    # --- Rankings: use cache or fetch ---
    if rank_cache and player_id in rank_cache:
        rk = rank_cache[player_id]
        rank          = rk["rank"]
        ranking_pts   = rk["ranking_points"]
        player_name   = rk.get("name") or profile.get("name", f"Player {player_id}")
    else:
        # Fall back to fetching full ranking list (slower but always works)
        try:
            rk_list  = get_player_by_rank_list(tour, page_size=300)
            rk       = rk_list.get(player_id, {})
            rank     = rk.get("rank") or profile.get("currentRank")
            ranking_pts = rk.get("ranking_points") or profile.get("points")
        except Exception:
            rank        = profile.get("currentRank")
            ranking_pts = profile.get("points")
        player_name = profile.get("name", f"Player {player_id}")

    # --- Elo ---
    elo = compute_elo_from_ranking_points(ranking_pts, rank)

    # --- Surface points from profile (for surface affinity) ---
    hard_pts  = profile.get("hardPoints")  or 0
    clay_pts  = profile.get("clayPoints")  or 0
    grass_pts = profile.get("grassPoints") or 0
    ihard_pts = profile.get("ihardPoints") or 0
    total_surf_pts = hard_pts + clay_pts + grass_pts + ihard_pts

    surface_points_ratio = {}
    if total_surf_pts > 0:
        surface_points_ratio = {
            "Hard":        hard_pts  / total_surf_pts,
            "Clay":        clay_pts  / total_surf_pts,
            "Grass":       grass_pts / total_surf_pts,
            "Indoor Hard": ihard_pts / total_surf_pts,
        }
    else:
        # Use ranking_points-based surface affinity if profile missing
        surface_points_ratio = {s: 0.25 for s in ["Hard", "Clay", "Grass", "Indoor Hard"]}

    # --- Surface win rates (prefer historical match data, fall back to pts) ---
    surface_win_rates = {}
    for court_id, court_name in SURFACE_MAP.items():
        hist_wr = compute_surface_win_rate_from_history(surface_hist, court_id)
        if hist_wr is not None:
            surface_win_rates[court_name] = hist_wr
        else:
            # Fall back to points-based estimate
            surface_win_rates[court_name] = surface_win_rate_from_points(
                ranking_pts, hard_pts, clay_pts, grass_pts, ihard_pts, court_name
            )

    # --- Overall win rate ---
    overall_wr = compute_overall_win_rate(perf_breakdown) if perf_breakdown else 0.50

    # --- Serve / return stats ---
    svc    = match_stats.get("serviceStats", {})   if isinstance(match_stats, dict) else {}
    bp_svc = match_stats.get("breakPointsServeStats", {}) if isinstance(match_stats, dict) else {}
    bp_rtn = match_stats.get("breakPointsRtnStats", {})   if isinstance(match_stats, dict) else {}

    def safe_ratio(num, den, default):
        try:
            if num and den and float(den) > 0:
                return float(num) / float(den)
        except (TypeError, ValueError):
            pass
        return default

    first_serve_pct = safe_ratio(
        svc.get("firstServeGm"), svc.get("firstServeOfGm"), defaults["first_serve_pct"])
    win_1st  = safe_ratio(
        svc.get("winningOnFirstServeGm"), svc.get("winningOnFirstServeOfGm"), defaults["win_on_first_serve"])
    win_2nd  = safe_ratio(
        svc.get("winningOnSecondServeGm"), svc.get("winningOnSecondServeOfGm"), defaults["win_on_second_serve"])
    bp_save  = safe_ratio(
        bp_svc.get("breakPointSavedGm"), bp_svc.get("breakPointFacedGm"), defaults["break_point_save_pct"])
    bp_conv  = safe_ratio(
        bp_rtn.get("breakPointWonGm"), bp_rtn.get("breakPointChanceGm"), defaults["break_point_convert_pct"])

    # Scale serve strength by Elo (top players serve better)
    # Elo 2400+ → +3% on first serve win; Elo 1400 → no adjustment
    elo_serve_boost = max(0, (elo - 1800) / 600) * 0.04
    win_1st  = min(0.88, win_1st  + elo_serve_boost)
    win_2nd  = min(0.72, win_2nd  + elo_serve_boost * 0.5)
    bp_save  = min(0.80, bp_save  + elo_serve_boost * 0.5)
    bp_conv  = min(0.60, bp_conv  + elo_serve_boost * 0.5)

    # Ace & DF rates (use Elo as proxy; top players ace more)
    elo_ace_factor  = 0.7 + (elo - 1350) / (2450 - 1350) * 0.8
    aces_per_game   = defaults["aces_per_game"]  * elo_ace_factor
    df_per_game     = defaults["double_faults_per_game"]

    return {
        "id":              player_id,
        "name":            player_name,
        "rank":            rank,
        "ranking_points":  ranking_pts,
        "elo":             elo,
        "overall_win_rate": overall_wr,
        "surface_win_rates": surface_win_rates,
        "surface_points_ratio": surface_points_ratio,
        "serve": {
            "first_serve_pct":     first_serve_pct,
            "win_on_first_serve":  win_1st,
            "win_on_second_serve": win_2nd,
            "bp_save_pct":         bp_save,
        },
        "return": {
            "bp_convert_pct": bp_conv,
        },
        "aces_per_game":         aces_per_game,
        "double_faults_per_game": df_per_game,
        "profile":               profile,
    }


def get_h2h_context(p1_id: int, p2_id: int, tour: str = "atp") -> dict:
    """H2H context for use in models (low weight ~7-8%)."""
    try:
        info  = get_h2h_info(p1_id, p2_id, tour)
        stats = get_h2h_stats(p1_id, p2_id, tour)
    except Exception:
        return {"p1_h2h_win_rate": 0.5, "total_matches": 0, "available": False}

    p1_wins = info.get("player1AllWins", 0) or 0
    p2_wins = info.get("player2AllWins", 0) or 0
    total   = p1_wins + p2_wins

    if total == 0:
        return {"p1_h2h_win_rate": 0.5, "total_matches": 0, "available": False}

    p1_stats = stats.get("player1Stats", {}) if isinstance(stats, dict) else {}
    p2_stats = stats.get("player2Stats", {}) if isinstance(stats, dict) else {}

    return {
        "p1_h2h_win_rate": p1_wins / total,
        "total_matches":   total,
        "p1_wins":         p1_wins,
        "p2_wins":         p2_wins,
        "available":       True,
        "p1_stats":        p1_stats,
        "p2_stats":        p2_stats,
    }
