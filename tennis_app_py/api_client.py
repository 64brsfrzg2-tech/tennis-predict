"""
Tennis API Client — wraps tennis-api-atp-wta-itf.p.rapidapi.com
"""
import os
import requests
from functools import lru_cache
from typing import Optional

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")
BASE_URL = "https://tennis-api-atp-wta-itf.p.rapidapi.com"
HEADERS = {
    "X-RapidAPI-Key": RAPIDAPI_KEY,
    "X-RapidAPI-Host": "tennis-api-atp-wta-itf.p.rapidapi.com"
}


def _get(path: str, params: dict = None) -> dict:
    url = f"{BASE_URL}{path}"
    r = requests.get(url, headers=HEADERS, params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def get_today_fixtures(tour: str = "atp", page_size: int = 50) -> list:
    """Get today's upcoming singles fixtures."""
    data = _get(f"/tennis/v2/{tour}/fixtures", {
        "include": "round,tournament.court,tournament.rank,h2h",
        "filter": "PlayerGroup:singles",
        "pageSize": page_size,
        "pageNo": 1
    })
    return data.get("data", data) if isinstance(data, dict) else data


def get_fixtures_by_date(date: str, tour: str = "atp", page_size: int = 50) -> list:
    """Get fixtures for a specific date (YYYY-MM-DD)."""
    data = _get(f"/tennis/v2/{tour}/fixtures/{date}", {
        "include": "round,tournament.court,tournament.rank,h2h",
        "filter": "PlayerGroup:singles",
        "pageSize": page_size,
        "pageNo": 1
    })
    return data.get("data", data) if isinstance(data, dict) else data


def get_player_profile(player_id: int, tour: str = "atp") -> dict:
    """Get full player profile. Returns the inner 'data' dict."""
    result = _get(f"/tennis/v2/{tour}/player/profile/{player_id}", {
        "include": "form,ranking,country"
    })
    return result.get("data", result) if isinstance(result, dict) and "data" in result else result


def get_player_match_stats(player_id: int, tour: str = "atp") -> dict:
    """Get aggregated match stats (serve %, aces, break points)."""
    data = _get(f"/tennis/v2/{tour}/player/match-stats/{player_id}")
    return data.get("data", data)


def get_player_surface_summary(player_id: int, tour: str = "atp") -> list:
    """Get win/loss records by surface per year."""
    data = _get(f"/tennis/v2/{tour}/player/surface-summary/{player_id}")
    return data.get("data", data) if isinstance(data, dict) else data


def get_player_perf_breakdown(player_id: int, tour: str = "atp") -> dict:
    """Get performance breakdown by year, round, court, rank."""
    data = _get(f"/tennis/v2/{tour}/player/perf-breakdown/{player_id}")
    return data.get("data", data) if isinstance(data, dict) else data


def get_h2h_info(p1_id: int, p2_id: int, tour: str = "atp") -> dict:
    """Get H2H win/loss summary."""
    return _get(f"/tennis/v2/{tour}/h2h/info/{p1_id}/{p2_id}")


def get_h2h_stats(p1_id: int, p2_id: int, tour: str = "atp") -> dict:
    """Get aggregated H2H stats."""
    data = _get(f"/tennis/v2/{tour}/h2h/stats/{p1_id}/{p2_id}")
    return data.get("data", data)


def get_h2h_matches(p1_id: int, p2_id: int, tour: str = "atp", page_size: int = 20) -> list:
    """Get last N H2H matches with scores."""
    data = _get(f"/tennis/v2/{tour}/h2h/matches/{p1_id}/{p2_id}", {
        "include": "round,tournament.court,tournament.rank",
        "pageSize": page_size
    })
    return data.get("data", data) if isinstance(data, dict) else data


def get_rankings(tour: str = "atp", page_size: int = 200) -> list:
    """Get current world singles rankings. Returns list of {position, point, player{...}}."""
    data = _get(f"/tennis/v2/{tour}/ranking/singles", {"pageSize": page_size})
    return data.get("data", data) if isinstance(data, dict) else data


def get_player_by_rank_list(tour: str = "atp", page_size: int = 200) -> dict:
    """
    Returns a dict keyed by player_id → ranking entry (position, points, surface points).
    Uses the ranking/singles endpoint which has accurate point data.
    """
    rankings = get_rankings(tour, page_size)
    result = {}
    for entry in rankings:
        player = entry.get("player", {})
        pid = player.get("id")
        if pid:
            result[pid] = {
                "rank": entry.get("position"),
                "ranking_points": entry.get("point"),   # full 52-week points
                "race_points": player.get("points"),    # race/YTD points
                "name": player.get("name"),
                "countryAcr": player.get("countryAcr"),
            }
    return result


def search_players(query: str, tour: str = "atp") -> list:
    """Search for players by name using full player list + text filter."""
    # Use miscellaneous search endpoint
    try:
        data = _get(f"/tennis/v2/{tour}/player", {
            "filter": f"PlayerName:{query}",
            "pageSize": 20
        })
        return data.get("data", data) if isinstance(data, dict) else data
    except Exception:
        return []


def get_player_list(tour: str = "atp", page_size: int = 50, page_no: int = 1) -> dict:
    """Get paginated player list."""
    data = _get(f"/tennis/v2/{tour}/player", {
        "filter": "PlayerGroup:singles",
        "pageSize": page_size,
        "pageNo": page_no,
        "include": "country"
    })
    return data if isinstance(data, dict) else {"data": data}
