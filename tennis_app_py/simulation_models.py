"""
Tennis Match Simulation Models
================================
1. Monte Carlo   — point-by-point simulation
2. Logistic Regression — win probability from player features
3. Poisson Distribution — games/sets as count events
4. Analytical    — straight stat comparison
5. Super Combined — weighted ensemble

All models return a dict with win_prob (p1 wins), set_score, and stat predictions.
"""

import numpy as np
from scipy.stats import poisson, norm
from typing import Optional
import math


# ─── UTILITY ────────────────────────────────────────────────────────────────

def surface_adjusted_stat(player: dict, base_key: str, surface: str) -> float:
    """
    Adjust a player stat (e.g. win_on_first_serve) based on their surface affinity.
    Surface affinity is derived from points_ratio for that surface vs overall.
    """
    base_val = player["serve"].get(base_key, 0.65)
    surface_ratio = player["surface_points_ratio"].get(surface, 0.33)
    overall_surface_avg = 0.33
    adjustment = (surface_ratio - overall_surface_avg) * 0.1
    return max(0.35, min(0.95, base_val + adjustment))


def p_hold_service(player: dict, surface: str) -> float:
    """Probability of holding serve in a game (surface-adjusted)."""
    p1 = surface_adjusted_stat(player, "first_serve_pct", surface)
    pw1 = surface_adjusted_stat(player, "win_on_first_serve", surface)
    pw2 = surface_adjusted_stat(player, "win_on_second_serve", surface)
    
    # Probability of winning a point on serve (server perspective)
    p_win_serve_point = p1 * pw1 + (1 - p1) * pw2
    
    # Convert point win prob to game hold prob using Markov chain formula
    return game_win_prob(p_win_serve_point)


def game_win_prob(p: float) -> float:
    """
    Markov chain: probability of winning a game given point-win probability p.
    Includes deuce sequences.
    """
    if p >= 1.0: return 1.0
    if p <= 0.0: return 0.0
    
    # At deuce: P(win from deuce) = p²/(p² + (1-p)²)
    p_deuce_win = (p ** 2) / (p ** 2 + (1 - p) ** 2)
    
    # Non-deuce paths (score reaches 40-40 at some point is complex;
    # use the well-known closed form):
    q = 1 - p
    # P(win game) = sum of paths 4-0, 4-1, 4-2 + deuce scenarios
    p_win = (
        p**4
        + 4 * p**4 * q
        + 10 * p**4 * q**2
        + 20 * p**3 * q**3 * p_deuce_win
    )
    return min(0.99, max(0.01, p_win))


def set_win_prob(p_hold_server: float, p_hold_returner: float, best_of: int = 3) -> float:
    """
    Probability that the server's-perspective player wins a set.
    Uses a simplified Markov model at game level.
    Uses Monte Carlo for a close approximation.
    """
    # p_hold_server = P(current player wins when serving)
    # p_hold_returner = P(opponent holds their serve) i.e. current player BREAKS = 1 - p_hold_returner
    p_break = 1 - p_hold_returner
    
    # Games in set: alternating serve
    p_win_game_on_own_serve = p_hold_server
    p_win_game_on_opp_serve = p_break
    
    return _simulate_set_win_prob(p_win_game_on_own_serve, p_win_game_on_opp_serve)


def _simulate_set_win_prob(p_hold: float, p_break: float, n: int = 10000) -> float:
    """Monte Carlo set win probability."""
    wins = 0
    for _ in range(n):
        wins += int(_play_set(p_hold, p_break))
    return wins / n


def _play_set(p_hold: float, p_break: float) -> bool:
    """Simulate a single set. Returns True if player wins."""
    g1, g2 = 0, 0
    serve = True  # True = p1 serves
    
    while True:
        if serve:
            # p1 serves
            if np.random.random() < p_hold:
                g1 += 1
            else:
                g2 += 1
        else:
            # p2 serves → p1 wins with p_break
            if np.random.random() < p_break:
                g1 += 1
            else:
                g2 += 1
        serve = not serve
        
        # Check set win
        if g1 >= 6 and g1 - g2 >= 2:
            return True
        if g2 >= 6 and g2 - g1 >= 2:
            return False
        # Tiebreak at 6-6
        if g1 == 6 and g2 == 6:
            # 50/50 tiebreak adjusted by hold differential
            p_tb = (p_hold + (1 - p_break)) / 2
            return np.random.random() < p_tb


# ─── MODEL 1: MONTE CARLO ──────────────────────────────────────────────────

def monte_carlo_simulation(p1: dict, p2: dict, surface: str, best_of: int = 3,
                           n_sims: int = 10000) -> dict:
    """
    Point-by-point Monte Carlo simulation.
    Returns win probability, expected set distribution, aces, breaks.
    """
    p1_hold = p_hold_service(p1, surface)
    p2_hold = p_hold_service(p2, surface)
    
    p1_serve_win_pt = _serve_point_win(p1, surface)
    p2_serve_win_pt = _serve_point_win(p2, surface)
    
    p1_wins = 0
    total_sets = []
    total_games = []
    total_breaks = []
    
    max_sets = best_of
    sets_to_win = (max_sets + 1) // 2
    
    for _ in range(n_sims):
        p1_sets = 0
        p2_sets = 0
        match_games = 0
        match_breaks = 0
        
        first_server = np.random.choice([1, 2])  # random first server
        
        while p1_sets < sets_to_win and p2_sets < sets_to_win:
            g1, g2 = 0, 0
            serve = first_server
            set_breaks = 0
            
            while True:
                if serve == 1:
                    win = np.random.random() < p1_hold
                    if win:
                        g1 += 1
                    else:
                        g2 += 1
                        set_breaks += 1
                else:
                    win = np.random.random() < p2_hold
                    if win:
                        g2 += 1
                    else:
                        g1 += 1
                        set_breaks += 1
                serve = 2 if serve == 1 else 1
                
                if g1 >= 6 and g1 - g2 >= 2:
                    p1_sets += 1
                    match_games += g1 + g2
                    match_breaks += set_breaks
                    first_server = serve
                    break
                if g2 >= 6 and g2 - g1 >= 2:
                    p2_sets += 1
                    match_games += g1 + g2
                    match_breaks += set_breaks
                    first_server = serve
                    break
                if g1 == 6 and g2 == 6:
                    p_tb = (p1_serve_win_pt + (1 - p2_serve_win_pt)) / 2
                    if np.random.random() < p_tb:
                        p1_sets += 1
                    else:
                        p2_sets += 1
                    match_games += 13
                    match_breaks += set_breaks
                    first_server = serve
                    break
        
        if p1_sets > p2_sets:
            p1_wins += 1
        total_sets.append(p1_sets + p2_sets)
        total_games.append(match_games)
        total_breaks.append(match_breaks)
    
    win_prob = p1_wins / n_sims
    avg_sets = float(np.mean(total_sets))
    avg_games = float(np.mean(total_games))
    avg_breaks = float(np.mean(total_breaks))
    
    # Estimate aces per match
    avg_aces_p1 = p1["aces_per_game"] * avg_games / 2
    avg_aces_p2 = p2["aces_per_game"] * avg_games / 2
    
    # Most common set score
    from collections import Counter
    set_counts = Counter(total_sets)
    most_common_sets = set_counts.most_common(1)[0][0]
    
    # Infer set score
    if win_prob > 0.5:
        winner_sets = sets_to_win
        loser_sets = round(avg_sets - sets_to_win)
    else:
        loser_sets = sets_to_win
        winner_sets = round(avg_sets - sets_to_win)
    
    predicted_set_score = f"{min(winner_sets, sets_to_win)}-{max(0, loser_sets)}"
    
    return {
        "model": "Monte Carlo",
        "p1_win_prob": round(win_prob, 4),
        "p2_win_prob": round(1 - win_prob, 4),
        "predicted_set_score": predicted_set_score,
        "avg_total_sets": round(avg_sets, 1),
        "avg_total_games": round(avg_games, 1),
        "avg_total_breaks": round(avg_breaks, 1),
        "est_aces_p1": round(avg_aces_p1, 1),
        "est_aces_p2": round(avg_aces_p2, 1),
        "simulations": n_sims,
    }


def _serve_point_win(player: dict, surface: str) -> float:
    p1 = surface_adjusted_stat(player, "first_serve_pct", surface)
    pw1 = surface_adjusted_stat(player, "win_on_first_serve", surface)
    pw2 = surface_adjusted_stat(player, "win_on_second_serve", surface)
    return p1 * pw1 + (1 - p1) * pw2


# ─── MODEL 2: LOGISTIC REGRESSION ─────────────────────────────────────────

def logistic_regression_model(p1: dict, p2: dict, surface: str,
                               h2h: dict = None, best_of: int = 3) -> dict:
    """
    Logistic regression style model using player feature differences.
    Features: Elo diff, surface win rate diff, ranking diff, serve stats diff,
              H2H (low weight), surface points ratio diff.
    """
    # Feature engineering
    elo_diff = (p1["elo"] - p2["elo"]) / 400  # normalize
    
    # Surface win rate
    p1_swr = p1["surface_win_rates"].get(surface) or p1["overall_win_rate"]
    p2_swr = p2["surface_win_rates"].get(surface) or p2["overall_win_rate"]
    surface_wr_diff = p1_swr - p2_swr
    
    # Serve stats
    p1_serve = _serve_point_win(p1, surface)
    p2_serve = _serve_point_win(p2, surface)
    serve_diff = p1_serve - p2_serve
    
    # Break point conversion
    p1_bp = p1["return"]["bp_convert_pct"]
    p2_bp = p2["return"]["bp_convert_pct"]
    bp_diff = p1_bp - p2_bp
    
    # Surface affinity
    p1_surface_affinity = p1["surface_points_ratio"].get(surface, 0.33)
    p2_surface_affinity = p2["surface_points_ratio"].get(surface, 0.33)
    affinity_diff = p1_surface_affinity - p2_surface_affinity
    
    # H2H term (low weight = 7%)
    h2h_term = 0.0
    if h2h and h2h.get("available") and h2h.get("total_matches", 0) >= 3:
        h2h_term = (h2h["p1_h2h_win_rate"] - 0.5) * 0.07
    
    # Logistic regression weights (calibrated for tennis)
    weights = {
        "elo": 1.5,
        "surface_wr": 0.8,
        "serve": 1.2,
        "bp": 0.6,
        "affinity": 0.4,
    }
    
    log_odds = (
        weights["elo"] * elo_diff +
        weights["surface_wr"] * surface_wr_diff +
        weights["serve"] * serve_diff +
        weights["bp"] * bp_diff +
        weights["affinity"] * affinity_diff +
        h2h_term
    )
    
    win_prob = 1 / (1 + math.exp(-log_odds))
    
    # Game/set predictions from win prob
    avg_games, avg_sets, avg_breaks = _estimate_match_stats(win_prob, best_of)
    
    return {
        "model": "Logistic Regression",
        "p1_win_prob": round(win_prob, 4),
        "p2_win_prob": round(1 - win_prob, 4),
        "predicted_set_score": _predict_set_score(win_prob, best_of),
        "avg_total_games": round(avg_games, 1),
        "avg_total_sets": round(avg_sets, 1),
        "avg_total_breaks": round(avg_breaks, 1),
        "feature_contributions": {
            "elo": round(weights["elo"] * elo_diff, 4),
            "surface_win_rate": round(weights["surface_wr"] * surface_wr_diff, 4),
            "serve_strength": round(weights["serve"] * serve_diff, 4),
            "break_points": round(weights["bp"] * bp_diff, 4),
            "surface_affinity": round(weights["affinity"] * affinity_diff, 4),
            "h2h": round(h2h_term, 4),
        }
    }


# ─── MODEL 3: POISSON DISTRIBUTION ────────────────────────────────────────

def poisson_model(p1: dict, p2: dict, surface: str, best_of: int = 3) -> dict:
    """
    Poisson model: treat games won per set as Poisson-distributed count events.
    Lambda = expected games won per set, derived from serve/return strengths.
    """
    p1_serve = _serve_point_win(p1, surface)
    p2_serve = _serve_point_win(p2, surface)
    
    # Expected games won per set for each player
    # In a 6-game set, lambda ≈ 6 * (serve_strength_relative)
    total_serve = p1_serve + p2_serve
    p1_game_share = p1_serve / total_serve
    
    # Average set has ~9.5 total games
    avg_total_games_per_set = 9.5
    lambda_p1 = p1_game_share * avg_total_games_per_set
    lambda_p2 = (1 - p1_game_share) * avg_total_games_per_set
    
    # Surface adjustment: grass → more aces → faster sets → fewer games
    surface_factor = {"Hard": 1.0, "Clay": 1.08, "Grass": 0.90, "Indoor Hard": 0.95}
    sf = surface_factor.get(surface, 1.0)
    lambda_p1 *= sf
    lambda_p2 *= sf
    
    # Simulate P(p1 wins set) using Poisson
    p1_wins_set = _poisson_set_win_prob(lambda_p1, lambda_p2)
    
    # Match win probability (best of 3 or 5)
    sets_to_win = (best_of + 1) // 2
    match_win_prob = _match_win_from_set_prob(p1_wins_set, sets_to_win)
    
    # Expected match stats
    avg_sets = _expected_sets(p1_wins_set, sets_to_win)
    avg_games_per_set = lambda_p1 + lambda_p2
    avg_total_games = avg_sets * avg_games_per_set
    
    # Break point frequency: proportional to serve weakness
    p1_hold = p_hold_service(p1, surface)
    p2_hold = p_hold_service(p2, surface)
    avg_breaks_per_set = ((1 - p1_hold) + (1 - p2_hold)) * avg_games_per_set / 2
    avg_total_breaks = avg_breaks_per_set * avg_sets
    
    # Aces: Poisson-distributed per game
    p1_ace_lambda = p1["aces_per_game"]
    p2_ace_lambda = p2["aces_per_game"]
    total_games_each = avg_total_games / 2
    
    # Boost for grass
    if surface == "Grass":
        p1_ace_lambda *= 1.3
        p2_ace_lambda *= 1.3
    elif surface == "Clay":
        p1_ace_lambda *= 0.8
        p2_ace_lambda *= 0.8
    
    est_aces_p1 = p1_ace_lambda * total_games_each
    est_aces_p2 = p2_ace_lambda * total_games_each
    
    return {
        "model": "Poisson Distribution",
        "p1_win_prob": round(match_win_prob, 4),
        "p2_win_prob": round(1 - match_win_prob, 4),
        "predicted_set_score": _predict_set_score(match_win_prob, best_of),
        "avg_total_sets": round(avg_sets, 1),
        "avg_total_games": round(avg_total_games, 1),
        "avg_total_breaks": round(avg_total_breaks, 1),
        "est_aces_p1": round(est_aces_p1, 1),
        "est_aces_p2": round(est_aces_p2, 1),
        "lambda_p1_games": round(lambda_p1, 2),
        "lambda_p2_games": round(lambda_p2, 2),
    }


def _poisson_set_win_prob(lambda1: float, lambda2: float, max_games: int = 20) -> float:
    """P(team1 wins set) using Poisson game distributions."""
    wins = 0
    total = 0
    for g1 in range(max_games + 1):
        for g2 in range(max_games + 1):
            p = poisson.pmf(g1, lambda1) * poisson.pmf(g2, lambda2)
            if g1 > g2:
                wins += p
            total += p
    return wins / max(total, 0.0001)


def _match_win_from_set_prob(p_set: float, sets_to_win: int) -> float:
    """Match win probability from set win probability (Markov)."""
    if sets_to_win == 2:  # Best of 3
        return p_set**2 + 2 * p_set**2 * (1 - p_set)
    else:  # Best of 5
        q = 1 - p_set
        return (p_set**3 + 3 * p_set**3 * q + 6 * p_set**3 * q**2)


def _expected_sets(p_set: float, sets_to_win: int) -> float:
    """Expected number of sets in match."""
    q = 1 - p_set
    if sets_to_win == 2:
        return 2 * (p_set**2 + q**2) + 3 * (2 * p_set * q)
    else:
        # Best of 5: rough approximation
        return 3 + 2 * (1 - abs(p_set - 0.5) * 2)


# ─── MODEL 4: ANALYTICAL ──────────────────────────────────────────────────

def analytical_model(p1: dict, p2: dict, surface: str, h2h: dict = None,
                     best_of: int = 3) -> dict:
    """
    Pure analytical model based on direct stat comparisons.
    Computes a composite score for each player and converts to probability.
    """
    
    def surface_wr(player: dict) -> float:
        wr = player["surface_win_rates"].get(surface)
        return wr if wr is not None else player["overall_win_rate"]
    
    # Component scores (0–1 scale, higher = better)
    def score_pair(v1, v2):
        total = v1 + v2
        if total == 0:
            return 0.5, 0.5
        return v1 / total, v2 / total
    
    # Elo
    elo_s1, elo_s2 = score_pair(p1["elo"], p2["elo"])
    
    # Surface win rate
    swr_s1, swr_s2 = score_pair(surface_wr(p1), surface_wr(p2))
    
    # Serve strength
    srv1 = _serve_point_win(p1, surface)
    srv2 = _serve_point_win(p2, surface)
    srv_s1, srv_s2 = score_pair(srv1, srv2)
    
    # Break point conversion (return game)
    bp1 = p1["return"]["bp_convert_pct"]
    bp2 = p2["return"]["bp_convert_pct"]
    bp_s1, bp_s2 = score_pair(bp1, bp2)
    
    # Surface affinity (points on surface vs total)
    aff1 = p1["surface_points_ratio"].get(surface, 0.33)
    aff2 = p2["surface_points_ratio"].get(surface, 0.33)
    aff_s1, aff_s2 = score_pair(aff1, aff2)
    
    # Ranking (inverse — lower rank = better)
    r1 = 1 / max(1, p1.get("rank") or 200)
    r2 = 1 / max(1, p2.get("rank") or 200)
    rank_s1, rank_s2 = score_pair(r1, r2)
    
    # H2H component (very low weight 8%)
    h2h_s1 = 0.5
    if h2h and h2h.get("available") and h2h.get("total_matches", 0) >= 3:
        h2h_s1 = h2h["p1_h2h_win_rate"]
    h2h_s2 = 1 - h2h_s1
    
    # Weighted composite
    weights = {
        "elo": 0.25,
        "surface_wr": 0.20,
        "serve": 0.18,
        "bp": 0.12,
        "affinity": 0.12,
        "rank": 0.05,
        "h2h": 0.08,
    }
    
    composite_p1 = (
        weights["elo"] * elo_s1 +
        weights["surface_wr"] * swr_s1 +
        weights["serve"] * srv_s1 +
        weights["bp"] * bp_s1 +
        weights["affinity"] * aff_s1 +
        weights["rank"] * rank_s1 +
        weights["h2h"] * h2h_s1
    )
    composite_p2 = 1 - composite_p1
    
    # Normalize to probability
    win_prob = composite_p1
    
    avg_games, avg_sets, avg_breaks = _estimate_match_stats(win_prob, best_of)
    
    p1_hold = p_hold_service(p1, surface)
    p2_hold = p_hold_service(p2, surface)
    
    est_aces_p1 = p1["aces_per_game"] * avg_games / 2
    est_aces_p2 = p2["aces_per_game"] * avg_games / 2
    
    return {
        "model": "Analytical",
        "p1_win_prob": round(win_prob, 4),
        "p2_win_prob": round(1 - win_prob, 4),
        "predicted_set_score": _predict_set_score(win_prob, best_of),
        "avg_total_games": round(avg_games, 1),
        "avg_total_sets": round(avg_sets, 1),
        "avg_total_breaks": round(avg_breaks, 1),
        "est_aces_p1": round(est_aces_p1, 1),
        "est_aces_p2": round(est_aces_p2, 1),
        "component_scores": {
            "elo": round(elo_s1, 4),
            "surface_win_rate": round(swr_s1, 4),
            "serve": round(srv_s1, 4),
            "break_points": round(bp_s1, 4),
            "surface_affinity": round(aff_s1, 4),
            "ranking": round(rank_s1, 4),
            "h2h": round(h2h_s1, 4),
        }
    }


# ─── MODEL 5: SUPER COMBINED ENSEMBLE ─────────────────────────────────────

def super_combined_model(mc: dict, lr: dict, poiss: dict, analytical: dict,
                          p1: dict, p2: dict, surface: str, best_of: int = 3) -> dict:
    """
    Weighted ensemble of all 4 models.
    Monte Carlo: 35% | Logistic: 25% | Poisson: 20% | Analytical: 20%
    """
    weights = {
        "mc": 0.35,
        "lr": 0.25,
        "poisson": 0.20,
        "analytical": 0.20,
    }
    
    win_prob = (
        weights["mc"] * mc["p1_win_prob"] +
        weights["lr"] * lr["p1_win_prob"] +
        weights["poisson"] * poiss["p1_win_prob"] +
        weights["analytical"] * analytical["p1_win_prob"]
    )
    
    # Average the stat predictions
    avg_sets = (
        weights["mc"] * mc["avg_total_sets"] +
        weights["lr"] * lr["avg_total_sets"] +
        weights["poisson"] * poiss["avg_total_sets"] +
        weights["analytical"] * analytical["avg_total_sets"]
    )
    avg_games = (
        weights["mc"] * mc["avg_total_games"] +
        weights["lr"] * lr["avg_total_games"] +
        weights["poisson"] * poiss["avg_total_games"] +
        weights["analytical"] * analytical["avg_total_games"]
    )
    avg_breaks = (
        weights["mc"] * mc["avg_total_breaks"] +
        weights["lr"] * lr["avg_total_breaks"] +
        weights["poisson"] * poiss["avg_total_breaks"] +
        weights["analytical"] * analytical["avg_total_breaks"]
    )
    
    est_aces_p1 = (
        weights["mc"] * mc.get("est_aces_p1", p1["aces_per_game"] * avg_games / 2) +
        weights["poisson"] * poiss.get("est_aces_p1", p1["aces_per_game"] * avg_games / 2) +
        weights["analytical"] * analytical.get("est_aces_p1", p1["aces_per_game"] * avg_games / 2) +
        weights["lr"] * (p1["aces_per_game"] * avg_games / 2)
    )
    est_aces_p2 = (
        weights["mc"] * mc.get("est_aces_p2", p2["aces_per_game"] * avg_games / 2) +
        weights["poisson"] * poiss.get("est_aces_p2", p2["aces_per_game"] * avg_games / 2) +
        weights["analytical"] * analytical.get("est_aces_p2", p2["aces_per_game"] * avg_games / 2) +
        weights["lr"] * (p2["aces_per_game"] * avg_games / 2)
    )
    
    # Double faults estimate
    est_df_p1 = p1["double_faults_per_game"] * avg_games / 2
    est_df_p2 = p2["double_faults_per_game"] * avg_games / 2
    
    # Confidence based on model agreement
    probs = [mc["p1_win_prob"], lr["p1_win_prob"], poiss["p1_win_prob"], analytical["p1_win_prob"]]
    std_dev = float(np.std(probs))
    confidence = "High" if std_dev < 0.05 else "Medium" if std_dev < 0.10 else "Low"
    
    return {
        "model": "Super Combined",
        "p1_win_prob": round(win_prob, 4),
        "p2_win_prob": round(1 - win_prob, 4),
        "predicted_set_score": _predict_set_score(win_prob, best_of),
        "avg_total_sets": round(avg_sets, 1),
        "avg_total_games": round(avg_games, 1),
        "avg_total_breaks": round(avg_breaks, 1),
        "est_aces_p1": round(est_aces_p1, 1),
        "est_aces_p2": round(est_aces_p2, 1),
        "est_double_faults_p1": round(est_df_p1, 1),
        "est_double_faults_p2": round(est_df_p2, 1),
        "model_agreement": {
            "monte_carlo": round(mc["p1_win_prob"], 4),
            "logistic_regression": round(lr["p1_win_prob"], 4),
            "poisson": round(poiss["p1_win_prob"], 4),
            "analytical": round(analytical["p1_win_prob"], 4),
            "std_deviation": round(std_dev, 4),
            "confidence": confidence,
        },
        "weights_used": weights,
    }


# ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────

def _predict_set_score(win_prob: float, best_of: int) -> str:
    """Predict most likely set score given win probability."""
    sets_to_win = (best_of + 1) // 2
    
    if win_prob >= 0.80:
        return f"{sets_to_win}-0"
    elif win_prob >= 0.60:
        return f"{sets_to_win}-1"
    elif win_prob >= 0.50:
        return f"{sets_to_win}-1" if best_of == 3 else f"{sets_to_win}-2"
    elif win_prob >= 0.40:
        loser_sets = sets_to_win
        winner_sets = sets_to_win - 1
        return f"{winner_sets}-{loser_sets}"
    elif win_prob >= 0.25:
        return f"1-{sets_to_win}"
    else:
        return f"0-{sets_to_win}"


def _estimate_match_stats(win_prob: float, best_of: int) -> tuple:
    """Estimate avg total games, sets, breaks from win probability."""
    sets_to_win = (best_of + 1) // 2
    
    # More competitive = more sets
    competitiveness = 1 - abs(win_prob - 0.5) * 2
    avg_sets = sets_to_win + competitiveness * (sets_to_win - 1)
    avg_games_per_set = 9.0 + competitiveness * 1.5
    avg_total_games = avg_sets * avg_games_per_set
    avg_breaks = avg_sets * (0.8 + competitiveness * 0.6)
    
    return avg_total_games, avg_sets, avg_breaks


# ─── MAIN RUN FUNCTION ─────────────────────────────────────────────────────

def run_all_models(p1: dict, p2: dict, surface: str, best_of: int = 3,
                   h2h: dict = None, n_sims: int = 10000) -> dict:
    """Run all 5 models and return full prediction package."""
    mc = monte_carlo_simulation(p1, p2, surface, best_of, n_sims)
    lr = logistic_regression_model(p1, p2, surface, h2h, best_of)
    poiss = poisson_model(p1, p2, surface, best_of)
    anlyt = analytical_model(p1, p2, surface, h2h, best_of)
    combined = super_combined_model(mc, lr, poiss, anlyt, p1, p2, surface, best_of)
    
    return {
        "player1": {"id": p1["id"], "name": p1["name"], "rank": p1.get("rank"), "elo": round(p1["elo"], 0)},
        "player2": {"id": p2["id"], "name": p2["name"], "rank": p2.get("rank"), "elo": round(p2["elo"], 0)},
        "surface": surface,
        "best_of": best_of,
        "models": {
            "monte_carlo": mc,
            "logistic_regression": lr,
            "poisson": poiss,
            "analytical": anlyt,
        },
        "super_combined": combined,
        "predicted_winner": p1["name"] if combined["p1_win_prob"] > 0.5 else p2["name"],
        "winner_win_pct": round(max(combined["p1_win_prob"], combined["p2_win_prob"]) * 100, 1),
    }
