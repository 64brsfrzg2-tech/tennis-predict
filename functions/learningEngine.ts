import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json();
    const { action } = body;

    // ── 1. LOG PREDICTION ──────────────────────────────────────────────────
    if (action === "log_prediction") {
      const {
        fixture_id, match_date, tour, surface, best_of,
        tournament_name, round_name,
        p1_id, p1_name, p2_id, p2_name,
        predicted_winner_id, predicted_winner_name,
        predicted_win_pct, predicted_set_score,
        model_mc, model_lr, model_po, model_an,
        upset_risk_score, fatigue_risk_p1, fatigue_risk_p2,
        surface_score_p1, surface_score_p2,
        tactical_score, tactical_edge,
        fragile_favorite, dangerous_underdog, surface_fraud, fatigue_collapse
      } = body;

      // Avoid duplicate logs for same fixture
      const existing = await db.PredictionLog.filter({ fixture_id: String(fixture_id) });
      if (existing?.length > 0) {
        return Response.json({ ok: true, status: "already_logged", id: existing[0].id }, { headers: cors });
      }

      const record = await db.PredictionLog.create({
        fixture_id: String(fixture_id), match_date, tour, surface, best_of,
        tournament_name, round_name,
        p1_id: String(p1_id), p1_name, p2_id: String(p2_id), p2_name,
        predicted_winner_id: String(predicted_winner_id), predicted_winner_name,
        predicted_win_pct, predicted_set_score,
        model_mc, model_lr, model_po, model_an,
        upset_risk_score, fatigue_risk_p1, fatigue_risk_p2,
        surface_score_p1, surface_score_p2,
        tactical_score, tactical_edge,
        fragile_favorite: !!fragile_favorite,
        dangerous_underdog: !!dangerous_underdog,
        surface_fraud: !!surface_fraud,
        fatigue_collapse: !!fatigue_collapse,
        outcome_logged: false,
      });

      return Response.json({ ok: true, status: "logged", id: record.id }, { headers: cors });
    }

    // ── 2. LOG OUTCOME + LEARN ─────────────────────────────────────────────
    if (action === "log_outcome") {
      const { fixture_id, actual_winner_id, actual_winner_name, actual_set_score } = body;

      const logs = await db.PredictionLog.filter({ fixture_id: String(fixture_id) });
      if (!logs?.length) {
        return Response.json({ ok: false, error: "No prediction logged for this fixture" }, { headers: cors });
      }

      const log = logs[0];
      const correct = String(actual_winner_id) === String(log.predicted_winner_id);

      // ── Failure / Success analysis ──────────────────────────────────────
      const failureReasons: string[] = [];
      const successReasons: string[] = [];

      if (!correct) {
        if (log.upset_risk_score >= 35) failureReasons.push(`Upset risk flagged at ${log.upset_risk_score}/100 but underweighted`);
        if (log.fatigue_collapse) failureReasons.push(`Fatigue collapse fired — fatigue penalty needs strengthening`);
        if (log.fragile_favorite) failureReasons.push(`Fragile favorite flagged — needs stronger probability downgrade`);
        if (log.dangerous_underdog) failureReasons.push(`Dangerous underdog flagged — disruptive style underweighted`);
        if (log.surface_fraud) failureReasons.push(`Surface fraud flagged — surface score penalty insufficient`);
        if ((log.tactical_score ?? 0) < -1) failureReasons.push(`Strong tactical edge for underdog (${log.tactical_edge}) — tactical multiplier should increase`);
        if (failureReasons.length === 0) failureReasons.push(`No strong flags — likely genuine variance or outlier performance`);
      } else {
        if (log.upset_risk_score < 20) successReasons.push(`Low upset risk correctly identified stable favorite`);
        if (log.surface_score_p1 > log.surface_score_p2 && log.predicted_winner_id === log.p1_id) successReasons.push(`Surface score advantage correctly favored winner`);
        if (!log.fragile_favorite && !log.dangerous_underdog) successReasons.push(`Clean matchup with no disruptive flags — model performed as expected`);
        if ((log.tactical_score ?? 0) > 0.8 && log.predicted_winner_id === log.p1_id) successReasons.push(`Tactical edge for P1 correctly reinforced prediction`);
      }

      const failure_analysis = !correct
        ? "❌ WRONG: " + failureReasons.join(" | ")
        : "✅ CORRECT: " + successReasons.join(" | ");

      // ── Recalculate weights from all completed logs ─────────────────────
      const allLogs = await db.PredictionLog.filter({ outcome_logged: true });
      const completedLogs = [...(allLogs || []), { ...log, correct }];
      const n = completedLogs.length;

      const modelAcc = { mc: 0, lr: 0, po: 0, an: 0 };
      let totalCorrect = 0;
      let upsetFlagRight = 0, upsetFlagWrong = 0;
      let fatigueFlagRight = 0, tacticalRight = 0;

      completedLogs.forEach((l: any) => {
        const isCor = l.id === log.id ? correct : l.correct;
        const predP1 = l.predicted_winner_id === l.p1_id;
        if (isCor) totalCorrect++;
        if ((l.model_mc > 0.5) === predP1 && isCor) modelAcc.mc++;
        if ((l.model_lr > 0.5) === predP1 && isCor) modelAcc.lr++;
        if ((l.model_po > 0.5) === predP1 && isCor) modelAcc.po++;
        if ((l.model_an > 0.5) === predP1 && isCor) modelAcc.an++;
        if (l.upset_risk_score >= 35 && !isCor) upsetFlagRight++;
        if (l.upset_risk_score >= 35 && isCor) upsetFlagWrong++;
        if (l.fatigue_collapse && !isCor) fatigueFlagRight++;
        const tac = l.tactical_score ?? 0;
        if ((tac > 0.8 && predP1 && isCor) || (tac < -0.8 && !predP1 && isCor)) tacticalRight++;
      });

      const total = modelAcc.mc + modelAcc.lr + modelAcc.po + modelAcc.an || 1;
      const rawMC = Math.max(0.10, Math.min(0.50, modelAcc.mc / total));
      const rawLR = Math.max(0.10, Math.min(0.50, modelAcc.lr / total));
      const rawPO = Math.max(0.10, Math.min(0.50, modelAcc.po / total));
      const rawAN = Math.max(0.10, Math.min(0.50, modelAcc.an / total));
      const wSum = rawMC + rawLR + rawPO + rawAN;
      const w_mc = rawMC / wSum, w_lr = rawLR / wSum, w_po = rawPO / wSum, w_an = rawAN / wSum;

      const upsetPrec = (upsetFlagRight + upsetFlagWrong) > 0 ? upsetFlagRight / (upsetFlagRight + upsetFlagWrong) : 0.5;
      const fatigue_multiplier = Math.max(0.5, Math.min(2.0, 1.0 + (fatigueFlagRight / Math.max(1, n)) * 3));
      const tactical_multiplier = Math.max(0.5, Math.min(2.0, 1.0 + (tacticalRight / Math.max(1, n)) * 2));
      const upset_risk_threshold = upsetPrec > 0.6 ? 30 : upsetPrec > 0.4 ? 35 : 40;
      const accuracy_pct = (totalCorrect / n) * 100;

      const learnedAdjustments = [
        `Weights: MC=${(w_mc*100).toFixed(0)}% LR=${(w_lr*100).toFixed(0)}% PO=${(w_po*100).toFixed(0)}% AN=${(w_an*100).toFixed(0)}%`,
        `Fatigue mult: ${fatigue_multiplier.toFixed(2)}x | Tactical mult: ${tactical_multiplier.toFixed(2)}x`,
        `Upset threshold: ${upset_risk_threshold} | Accuracy: ${accuracy_pct.toFixed(1)}% (${totalCorrect}/${n})`,
      ].join(" | ");

      // Update ModelWeights record
      const weights = await db.ModelWeights.list();
      const weightRecord = weights?.[0];
      const weightData = {
        version: (weightRecord?.version || 1) + 1,
        w_mc, w_lr, w_po, w_an,
        fatigue_multiplier, surface_score_multiplier: 1.0,
        tactical_multiplier, clay_bonus_multiplier: 1.0,
        upset_risk_threshold, total_predictions: n,
        correct_predictions: totalCorrect, accuracy_pct,
        last_updated: new Date().toISOString().slice(0, 10),
        notes: learnedAdjustments,
      };

      if (weightRecord?.id) {
        await db.ModelWeights.update(weightRecord.id, weightData);
      } else {
        await db.ModelWeights.create(weightData);
      }

      await db.PredictionLog.update(log.id, {
        actual_winner_id: String(actual_winner_id),
        actual_winner_name, actual_set_score: actual_set_score || "",
        correct, outcome_logged: true, failure_analysis,
        learned_adjustments: learnedAdjustments,
      });

      return Response.json({
        ok: true, correct, failure_analysis, learned_adjustments: learnedAdjustments,
        updated_weights: { w_mc, w_lr, w_po, w_an, fatigue_multiplier, tactical_multiplier, upset_risk_threshold },
        accuracy: { total: n, correct: totalCorrect, pct: accuracy_pct.toFixed(1) },
      }, { headers: cors });
    }

    // ── 3. GET WEIGHTS ─────────────────────────────────────────────────────
    if (action === "get_weights") {
      const weights = await db.ModelWeights.list();
      const w = weights?.[0] || {
        w_mc: 0.30, w_lr: 0.25, w_po: 0.25, w_an: 0.20,
        fatigue_multiplier: 1.0, tactical_multiplier: 1.0,
        upset_risk_threshold: 35, total_predictions: 0,
        correct_predictions: 0, accuracy_pct: 0,
      };
      return Response.json({ ok: true, weights: w }, { headers: cors });
    }

    // ── 4. GET HISTORY ─────────────────────────────────────────────────────
    if (action === "get_history") {
      const all = await db.PredictionLog.list();
      const completed = (all || []).filter((l: any) => l.outcome_logged);
      const correct = completed.filter((l: any) => l.correct);
      const pending = (all || []).filter((l: any) => !l.outcome_logged);

      const bysurf: Record<string, { n: number; c: number }> = {};
      completed.forEach((l: any) => {
        const s = l.surface || "Unknown";
        if (!bysurf[s]) bysurf[s] = { n: 0, c: 0 };
        bysurf[s].n++;
        if (l.correct) bysurf[s].c++;
      });

      const flagHits: Record<string, number> = { fragile_favorite: 0, dangerous_underdog: 0, fatigue_collapse: 0, surface_fraud: 0 };
      completed.filter((l: any) => !l.correct).forEach((l: any) => {
        if (l.fragile_favorite) flagHits.fragile_favorite++;
        if (l.dangerous_underdog) flagHits.dangerous_underdog++;
        if (l.fatigue_collapse) flagHits.fatigue_collapse++;
        if (l.surface_fraud) flagHits.surface_fraud++;
      });

      return Response.json({
        ok: true,
        total: (all || []).length, pending: pending.length,
        completed: completed.length, correct: correct.length,
        accuracy_pct: completed.length > 0 ? (correct.length / completed.length * 100).toFixed(1) : "0.0",
        by_surface: bysurf, failure_flags: flagHits,
        recent: completed.slice(-20).reverse().map((l: any) => ({
          date: l.match_date?.slice(0, 10),
          match: `${l.p1_name} vs ${l.p2_name}`,
          surface: l.surface, predicted: l.predicted_winner_name,
          actual: l.actual_winner_name, correct: l.correct,
          confidence: l.predicted_win_pct?.toFixed(1),
          upset_risk: l.upset_risk_score,
          flags: [
            l.fragile_favorite ? "💔 Fragile" : "",
            l.dangerous_underdog ? "⚡ Underdog" : "",
            l.fatigue_collapse ? "💀 Fatigue" : "",
            l.surface_fraud ? "🚨 SurfaceFraud" : "",
          ].filter(Boolean).join(", "),
          analysis: l.failure_analysis,
        })),
      }, { headers: cors });
    }

    // ── 5. GET PENDING OUTCOMES ────────────────────────────────────────────
    if (action === "get_pending") {
      const all = await db.PredictionLog.filter({ outcome_logged: false });
      return Response.json({
        ok: true,
        pending: (all || []).map((l: any) => ({
          id: l.id, fixture_id: l.fixture_id,
          date: l.match_date?.slice(0, 10),
          match: `${l.p1_name} vs ${l.p2_name}`,
          surface: l.surface, tournament: l.tournament_name,
          predicted: l.predicted_winner_name, predicted_pct: l.predicted_win_pct,
          p1_id: l.p1_id, p1_name: l.p1_name, p2_id: l.p2_id, p2_name: l.p2_name,
        })),
      }, { headers: cors });
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400, headers: cors });

  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
});
