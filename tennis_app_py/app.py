"""
Tennis Prediction Engine — REST API
====================================
Endpoints:
  GET  /health
  GET  /fixtures?tour=atp&date=YYYY-MM-DD
  GET  /rankings?tour=atp&page_size=50
  GET  /predict/<tour>/<p1_id>/<p2_id>?surface=Clay&best_of=3&sims=10000
  POST /predict/custom   body: {p1_id, p2_id, surface, best_of, tour, sims}
  GET  /predict/fixture/<tour>/<fixture_id>
  GET  /player/<tour>/<player_id>
  GET  /search?name=Djokovic&tour=atp
"""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request
from datetime import date, datetime
import traceback

from api_client import (
    get_today_fixtures, get_fixtures_by_date,
    get_player_by_rank_list, get_player_profile, search_players,
    get_player_list, get_rankings
)
from player_stats import get_player_stats, get_h2h_context
from simulation_models import run_all_models

app = Flask(__name__)

SURFACE_MAP = {1: "Hard", 2: "Clay", 3: "Grass", 4: "Indoor Hard"}


@app.route("/health")
def health():
    return jsonify({
        "status":  "ok",
        "service": "Tennis Prediction Engine v1.0",
        "time":    datetime.utcnow().isoformat() + "Z"
    })


# ─── FIXTURES ────────────────────────────────────────────────────────────────

@app.route("/fixtures")
def fixtures():
    tour     = request.args.get("tour", "atp").lower()
    req_date = request.args.get("date", str(date.today()))
    page_size = int(request.args.get("page_size", 50))
    try:
        today_str = str(date.today())
        if req_date == today_str:
            matches = get_today_fixtures(tour, page_size)
        else:
            matches = get_fixtures_by_date(req_date, tour, page_size)

        for m in matches:
            court_id = (m.get("tournament") or {}).get("courtId", 1)
            m["surface"] = SURFACE_MAP.get(court_id, "Hard")
            # Determine best_of from round/tournament rank
            rank_id = (m.get("tournament") or {}).get("rankId", 0)
            m["best_of"] = 5 if (rank_id == 1 and tour == "atp") else 3

        return jsonify({
            "tour":     tour,
            "date":     req_date,
            "count":    len(matches),
            "fixtures": matches
        })
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


# ─── RANKINGS ────────────────────────────────────────────────────────────────

@app.route("/rankings")
def rankings():
    tour      = request.args.get("tour", "atp").lower()
    page_size = int(request.args.get("page_size", 50))
    try:
        data = get_rankings(tour, page_size)
        # Flatten for easy consumption
        result = []
        for entry in data:
            p = entry.get("player", {})
            result.append({
                "rank":     entry.get("position"),
                "points":   entry.get("point"),
                "id":       p.get("id"),
                "name":     p.get("name"),
                "country":  p.get("countryAcr"),
                "progress": p.get("progress", 0),
            })
        return jsonify({"tour": tour, "count": len(result), "rankings": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── PREDICT by player IDs ───────────────────────────────────────────────────

@app.route("/predict/<tour>/<int:p1_id>/<int:p2_id>")
def predict(tour, p1_id, p2_id):
    surface = request.args.get("surface", "Hard")
    best_of = int(request.args.get("best_of", 3))
    n_sims  = int(request.args.get("sims", 10000))
    try:
        rank_cache = get_player_by_rank_list(tour, 300)
        p1 = get_player_stats(p1_id, tour, rank_cache)
        p2 = get_player_stats(p2_id, tour, rank_cache)
        h2h = get_h2h_context(p1_id, p2_id, tour)
        result = run_all_models(p1, p2, surface, best_of, h2h, n_sims)
        result["h2h_summary"] = h2h
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


# ─── PREDICT custom (POST) ───────────────────────────────────────────────────

@app.route("/predict/custom", methods=["POST"])
def predict_custom():
    body    = request.json or {}
    p1_id   = body.get("p1_id")
    p2_id   = body.get("p2_id")
    surface = body.get("surface", "Hard")
    best_of = int(body.get("best_of", 3))
    tour    = body.get("tour", "atp").lower()
    n_sims  = int(body.get("sims", 10000))
    if not p1_id or not p2_id:
        return jsonify({"error": "p1_id and p2_id are required"}), 400
    try:
        rank_cache = get_player_by_rank_list(tour, 300)
        p1  = get_player_stats(int(p1_id), tour, rank_cache)
        p2  = get_player_stats(int(p2_id), tour, rank_cache)
        h2h = get_h2h_context(int(p1_id), int(p2_id), tour)
        result = run_all_models(p1, p2, surface, best_of, h2h, n_sims)
        result["h2h_summary"] = h2h
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


# ─── PREDICT from fixture ID ─────────────────────────────────────────────────

@app.route("/predict/fixture/<tour>/<int:fixture_id>")
def predict_fixture(tour, fixture_id):
    try:
        matches = get_today_fixtures(tour, page_size=100)
        fixture = next((f for f in matches if f["id"] == fixture_id), None)
        if not fixture:
            return jsonify({"error": f"Fixture {fixture_id} not found in today's schedule"}), 404

        p1_id   = fixture["player1Id"]
        p2_id   = fixture["player2Id"]
        court_id = (fixture.get("tournament") or {}).get("courtId", 1)
        surface  = SURFACE_MAP.get(court_id, "Hard")
        rank_id  = (fixture.get("tournament") or {}).get("rankId", 0)
        best_of  = 5 if (rank_id == 1 and tour == "atp") else 3

        rank_cache = get_player_by_rank_list(tour, 300)
        p1  = get_player_stats(p1_id, tour, rank_cache)
        p2  = get_player_stats(p2_id, tour, rank_cache)
        h2h = get_h2h_context(p1_id, p2_id, tour)

        result = run_all_models(p1, p2, surface, best_of, h2h)
        result["fixture"]     = fixture
        result["h2h_summary"] = h2h
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


# ─── PLAYER details ──────────────────────────────────────────────────────────

@app.route("/player/<tour>/<int:player_id>")
def player(tour, player_id):
    try:
        rank_cache = get_player_by_rank_list(tour, 300)
        stats = get_player_stats(player_id, tour, rank_cache)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── SEARCH players ──────────────────────────────────────────────────────────

@app.route("/search")
def search():
    name = request.args.get("name", "")
    tour = request.args.get("tour", "atp").lower()
    if not name:
        return jsonify({"error": "name parameter required"}), 400
    try:
        results = search_players(name, tour)
        return jsonify({"query": name, "tour": tour, "results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── PLAYER LIST (paginated) ─────────────────────────────────────────────────

@app.route("/players")
def player_list():
    tour      = request.args.get("tour", "atp").lower()
    page_size = int(request.args.get("page_size", 50))
    page_no   = int(request.args.get("page", 1))
    try:
        data = get_player_list(tour, page_size, page_no)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"🎾 Tennis Prediction Engine running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
