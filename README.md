# 🎾 Tennis Predict

Elite ATP/WTA tennis prediction engine with a 7-module analysis system. Live, client-side web app — no backend required.

## 🚀 Live App

**[Open Tennis Predict →](https://64brsfrzg2-tech.github.io/tennis-predict)**

## 🧠 Prediction Engine

Four-model ensemble weighted into a **Super Combined** score:

| Model | Weight | Description |
|---|---|---|
| Monte Carlo | 30% | 10,000 simulation runs per match |
| Logistic Regression | 25% | Rank, Elo, surface, H2H, weather |
| Poisson | 25% | Game-level scoring probability |
| Analytical | 20% | Serve/return efficiency + clay culture |

## 📋 7-Module Elite Analysis

Each prediction includes a full intelligence breakdown:

1. **🏥 Physical Condition** — Readiness score (1-10), fatigue risk, injury history, match load
2. **🎾 Surface Performance** — Hold %, break %, last 10 W-L, tiebreak record, surface score
3. **🧠 Tactical Matchup** — Disruption patterns, rally length, return vs serve, net play
4. **🧬 Momentum & Mental** — Confidence, clutch rating, tiebreak trends
5. **⚠️ Upset Risk** — Hidden indicator score (0-100) with flagged alerts
6. **📊 Predictive Simulation** — Win probability, expected set score, break projections
7. **💰 Betting Intelligence** — Live angles, trigger/action pairs, failure scenarios

### Detectors
- 💔 **Fragile Favorite** — form doesn't match reputation
- ⚡ **Dangerous Underdog** — disruptive style creates genuine upset risk
- 🚨 **Surface Fraud** — inflated surface record from weak events
- 💀 **Fatigue Collapse** — physically taxed from recent match load

## 🔧 Features

- ✅ Real-time ATP & WTA fixtures (±7 days)
- ✅ Automatic **Bo3 / Bo5** detection (Grand Slams always Bo5)
- ✅ Live weather integration (Open-Meteo API)
- ✅ Clay culture modifiers (Spanish/Argentine/Italian players)
- ✅ Surface-adjusted Elo ratings
- ✅ Head-to-head records
- ✅ Custom matchup picker (any two players by ID)
- ✅ ATP/WTA rankings explorer
- ✅ 100% client-side — no server, no CORS issues

## 📡 Data Sources

- **Tennis API** (via RapidAPI) — fixtures, players, H2H, rankings
- **Open-Meteo** — real-time weather at tournament location

## 🏗️ Tech

Single-file HTML/CSS/JS — deploy anywhere, run from file:// locally, or host on GitHub Pages.
