"use client";
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BufferStats { current_size: number; max_size: number; total_pushed: number; total_drained: number; uncertainty_threshold: number; }
interface TrainerStatus { classifier_ready: boolean; total_trained: number; feature_dim: number | null; baseline_auc: number; current_auc: number; min_samples_needed: number; }
interface EvolutionSummary { total_cycles: number; promoted_models: number; rejected_models: number; total_attack_variants: number; latest_auc: number | null; }
interface LastCycleInfo { cycle_id?: number; variants_generated?: number; synthetic_samples?: number; new_model_auc?: number; promoted?: boolean; rejection_reason?: string; }
interface EngineStatus { engine_running: boolean; current_cycle: number; last_cycle_at: number; cycle_interval_sec: number; min_buffer_fill: number; last_cycle_info: LastCycleInfo; buffer: BufferStats; trainer: TrainerStatus; evolution_summary: EvolutionSummary; }
interface Variant { variant_name: string; attack_type: string; intensity: number; sample_count: number; avg_fake_score_before: number; avg_fake_score_after: number; }
interface Cycle { id: number; started_at: string; finished_at: string; attack_variants_generated: number; synthetic_samples_count: number; baseline_auc: number; new_model_auc: number; promoted: boolean; rejection_reason: string; variants: Variant[]; }

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  const r = 40, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x="50" y="54" textAnchor="middle" fill={color} fontSize="16" fontWeight="700">{pct}%</text>
      </svg>
      <span className="text-xs text-slate-500 font-medium">{label}</span>
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon: string; accent: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5 glass-panel-hover">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg`} style={{ background: accent + "22" }}>{icon}</div>
        <span className="text-xs text-slate-400 font-mono">{sub}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function AttackBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    frequency_blend: "#6366f1", alpha_blend: "#0ea5e9", gaussian_noise: "#f59e0b",
    color_shift: "#10b981", texture_patch: "#ef4444", sharpness_warp: "#8b5cf6",
    jpeg_recompression: "#f97316", temporal_blend: "#14b8a6",
  };
  const color = colors[type] || "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

function CycleCard({ cycle }: { cycle: Cycle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-panel rounded-xl overflow-hidden mb-3">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-sky-50/50 transition-colors">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cycle.promoted ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="text-sm font-semibold text-slate-700">Cycle #{cycle.id}</span>
        <span className="text-xs text-slate-400 font-mono">{cycle.started_at.replace("T", " ").replace("Z", "")}</span>
        <span className="ml-auto text-xs font-mono text-slate-500">AUC {cycle.new_model_auc.toFixed(4)}</span>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-3 my-3">
            <div className="text-center"><div className="text-lg font-bold text-sky-600">{cycle.attack_variants_generated}</div><div className="text-xs text-slate-500">Variants</div></div>
            <div className="text-center"><div className="text-lg font-bold text-violet-600">{cycle.synthetic_samples_count}</div><div className="text-xs text-slate-500">Synthetic samples</div></div>
            <div className="text-center"><div className={`text-lg font-bold ${cycle.promoted ? "text-emerald-600" : "text-red-500"}`}>{cycle.promoted ? "PROMOTED" : "REJECTED"}</div><div className="text-xs text-slate-500">Outcome</div></div>
          </div>
          {cycle.rejection_reason && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">⚠ {cycle.rejection_reason}</p>}
          {cycle.variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cycle.variants.map((v, i) => <AttackBadge key={i} type={v.attack_type} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CASdeDashboard() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [history, setHistory] = useState<Cycle[]>([]);
  const [attacks, setAttacks] = useState<{ attack_types: string[]; descriptions: Record<string, string> } | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "attacks">("overview");

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/casde/status`);
      if (r.ok) setStatus(await r.json());
    } catch { /* offline */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/casde/history?limit=30`);
      if (r.ok) setHistory(await r.json());
    } catch { /* offline */ }
  }, []);

  const fetchAttacks = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/casde/attacks`);
      if (r.ok) setAttacks(await r.json());
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    fetchStatus(); fetchHistory(); fetchAttacks();
    const iv = setInterval(() => { fetchStatus(); if (activeTab === "history") fetchHistory(); }, 10000);
    return () => clearInterval(iv);
  }, [fetchStatus, fetchHistory, fetchAttacks, activeTab]);

  const handleTrigger = async () => {
    setTriggering(true); setTriggerMsg("");
    try {
      const r = await fetch(`${API}/api/v1/casde/trigger`, { method: "POST" });
      const d = await r.json();
      setTriggerMsg(d.message || "Cycle triggered");
      setTimeout(() => { fetchStatus(); fetchHistory(); }, 2000);
    } catch { setTriggerMsg("Failed to reach engine"); }
    finally { setTriggering(false); }
  };

  const handleClearBuffer = async () => {
    await fetch(`${API}/api/v1/casde/buffer/clear`, { method: "POST" });
    fetchStatus();
  };

  const bufferPct = status ? status.buffer.current_size / Math.max(1, status.buffer.max_size) : 0;
  const bufferReady = status ? status.buffer.current_size >= status.min_buffer_fill : false;

  return (
    <div className="min-h-screen bg-grid-pattern">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white text-xl shadow-lg">🤖</div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">CASDE Engine</h1>
                <p className="text-xs text-slate-500">Continual Adversarial Self-Learning Detection</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${status.engine_running ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                <span className={`w-2 h-2 rounded-full ${status.engine_running ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                {status.engine_running ? "Engine Running" : "Engine Stopped"}
              </div>
            )}
            <button id="casde-trigger-btn" onClick={handleTrigger} disabled={triggering}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-sky-500 text-white shadow hover:shadow-violet-200 transition-all disabled:opacity-60 hover:scale-105 active:scale-100">
              {triggering ? "⏳ Triggering…" : "⚡ Trigger Cycle"}
            </button>
          </div>
        </div>

        {triggerMsg && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-sm font-medium flex items-center gap-2">
            <span>✓</span> {triggerMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {(["overview", "history", "attacks"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} id={`casde-tab-${t}`}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === t ? "bg-white text-sky-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "overview" ? "📊 Overview" : t === "history" ? "📜 Evolution Log" : "⚔️ Attacks"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon="🔄" label="Total Cycles" value={status?.evolution_summary.total_cycles ?? "—"} accent="#6366f1" />
              <StatCard icon="✅" label="Promoted Models" value={status?.evolution_summary.promoted_models ?? "—"} accent="#10b981" />
              <StatCard icon="⚔️" label="Attack Variants" value={status?.evolution_summary.total_attack_variants ?? "—"} accent="#f59e0b" />
              <StatCard icon="🧠" label="Samples Trained" value={status?.trainer.total_trained ?? "—"} accent="#0ea5e9" />
            </div>

            {/* Gauges row */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-bold text-slate-700 mb-5">Model Health Metrics</h2>
              <div className="flex flex-wrap justify-around gap-6">
                <Gauge value={status?.trainer.current_auc ?? 0} label="Current AUC" color="#6366f1" />
                <Gauge value={status?.trainer.baseline_auc ?? 0} label="Baseline AUC" color="#0ea5e9" />
                <Gauge value={bufferPct} label="Buffer Fill" color={bufferReady ? "#10b981" : "#f59e0b"} />
                <Gauge value={status?.trainer.classifier_ready ? 1 : 0} label="Head Active" color={status?.trainer.classifier_ready ? "#10b981" : "#94a3b8"} />
              </div>
            </div>

            {/* Buffer & Trainer panels */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Buffer */}
              <div className="glass-panel rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700">🗃️ Uncertainty Buffer</h3>
                  <button onClick={handleClearBuffer} id="casde-clear-buffer-btn"
                    className="text-xs text-red-500 hover:text-red-700 transition-colors font-medium">Clear</button>
                </div>
                {status && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{status.buffer.current_size} / {status.buffer.max_size} samples</span>
                        <span className={bufferReady ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                          {bufferReady ? "Ready for cycle" : `Need ${status.min_buffer_fill - status.buffer.current_size} more`}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, bufferPct * 100)}%`, background: bufferReady ? "#10b981" : "#f59e0b" }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-400">Total pushed</span><br /><span className="font-mono font-semibold text-slate-700">{status.buffer.total_pushed}</span></div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-400">Uncertainty threshold</span><br /><span className="font-mono font-semibold text-slate-700">{status.buffer.uncertainty_threshold}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Trainer */}
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4">🎓 Adaptive Head Trainer</h3>
                {status && (
                  <div className="space-y-2 text-xs">
                    {[
                      ["Status", status.trainer.classifier_ready ? "🟢 Active" : "🔴 Not trained"],
                      ["Samples trained", status.trainer.total_trained.toLocaleString()],
                      ["Feature dimensions", status.trainer.feature_dim ?? "—"],
                      ["AUC tolerance", `±${status.trainer.auc_tolerance}`],
                      ["Min samples needed", status.trainer.min_samples_needed],
                      ["Cycle interval", `${status.cycle_interval_sec}s`],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-mono font-semibold text-slate-700">{v as string}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Last cycle */}
            {status?.last_cycle_info?.cycle_id && (
              <div className="glass-panel rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-3">🔁 Last Cycle</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {[
                    ["Cycle ID", `#${status.last_cycle_info.cycle_id}`],
                    ["Variants", status.last_cycle_info.variants_generated],
                    ["Synthetic samples", status.last_cycle_info.synthetic_samples],
                    ["New AUC", status.last_cycle_info.new_model_auc?.toFixed(4)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="bg-slate-50 rounded-xl px-3 py-2">
                      <div className="text-slate-400">{k}</div>
                      <div className="font-mono font-bold text-slate-700 mt-0.5">{v as string}</div>
                    </div>
                  ))}
                </div>
                {status.last_cycle_info.promoted !== undefined && (
                  <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-semibold ${status.last_cycle_info.promoted ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {status.last_cycle_info.promoted ? "✅ Model promoted to production" : `❌ Rejected – ${status.last_cycle_info.rejection_reason}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ─────────────────────────────────── */}
        {activeTab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-700">Evolution Cycle Log ({history.length})</h2>
              <button onClick={fetchHistory} className="text-xs text-sky-600 hover:text-sky-700 font-medium transition-colors">↻ Refresh</button>
            </div>
            {history.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm">No evolution cycles yet. Trigger one above or wait for automatic scheduling.</p>
              </div>
            ) : (
              history.map(c => <CycleCard key={c.id} cycle={c} />)
            )}
          </div>
        )}

        {/* ── ATTACKS TAB ─────────────────────────────────── */}
        {activeTab === "attacks" && attacks && (
          <div className="grid md:grid-cols-2 gap-4">
            {attacks.attack_types.map(type => (
              <div key={type} className="glass-panel glass-panel-hover rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AttackBadge type={type} />
                </div>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">{attacks.descriptions[type]}</p>
                <div className="mt-3 flex gap-1 flex-wrap">
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map(i => (
                    <div key={i} className="px-2 py-0.5 rounded text-xs font-mono bg-slate-50 text-slate-500">
                      ×{i}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
