"""
evolution_log.py – SQLite ledger for all CASDE retraining cycles and attack variants.

Every time the adversarial engine fires, a cycle is recorded:
  • Which attack variants were generated
  • How many synthetic samples each variant produced
  • Before/after detection accuracy
  • Whether the new model was promoted or rejected

This log drives the frontend Evolution Timeline.
"""
import sqlite3
import threading
import time
import logging
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("uvicorn.error")

BASE_DIR  = Path(__file__).resolve().parent.parent.parent.parent   # c:/df
DB_PATH   = Path(os.getenv("CASDE_DB_PATH", str(BASE_DIR / "backend" / "casde_evolution.db")))


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class AttackVariantRecord:
    variant_name:          str
    attack_type:           str
    intensity:             float
    sample_count:          int
    avg_fake_score_before: float
    avg_fake_score_after:  float
    cycle_id:              int = 0
    id:                    int = 0


@dataclass
class EvolutionCycleRecord:
    started_at:                  str
    finished_at:                 str
    attack_variants_generated:   int
    synthetic_samples_count:     int
    baseline_auc:                float
    new_model_auc:               float
    promoted:                    bool
    rejection_reason:            str = ""
    id:                          int = 0
    variants:                    List[AttackVariantRecord] = field(default_factory=list)


# ── Database layer ────────────────────────────────────────────────────────────

class EvolutionLog:
    _instance: "EvolutionLog | None" = None
    _lock_singleton = threading.Lock()

    def __init__(self, db_path: Path = DB_PATH):
        self._db_path = db_path
        self._local   = threading.local()   # per-thread connections
        self._init_schema()
        logger.info(f"📖 EvolutionLog initialised  db={self._db_path}")

    # ── Singleton ─────────────────────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> "EvolutionLog":
        with cls._lock_singleton:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ── Connection management ─────────────────────────────────────────────

    def _conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(
                str(self._db_path),
                check_same_thread=False,
                timeout=10,
            )
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    # ── Schema ────────────────────────────────────────────────────────────

    def _init_schema(self):
        conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS evolution_cycles (
                id                          INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at                  TEXT NOT NULL,
                finished_at                 TEXT NOT NULL,
                attack_variants_generated   INTEGER NOT NULL DEFAULT 0,
                synthetic_samples_count     INTEGER NOT NULL DEFAULT 0,
                baseline_auc                REAL NOT NULL DEFAULT 0.0,
                new_model_auc               REAL NOT NULL DEFAULT 0.0,
                promoted                    INTEGER NOT NULL DEFAULT 0,
                rejection_reason            TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS attack_variants (
                id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id                INTEGER NOT NULL REFERENCES evolution_cycles(id),
                variant_name            TEXT NOT NULL,
                attack_type             TEXT NOT NULL,
                intensity               REAL NOT NULL DEFAULT 0.5,
                sample_count            INTEGER NOT NULL DEFAULT 0,
                avg_fake_score_before   REAL NOT NULL DEFAULT 0.0,
                avg_fake_score_after    REAL NOT NULL DEFAULT 0.0
            );

            CREATE TABLE IF NOT EXISTS model_versions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id        INTEGER NOT NULL REFERENCES evolution_cycles(id),
                model_path      TEXT NOT NULL,
                auc             REAL NOT NULL DEFAULT 0.0,
                promoted        INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT NOT NULL
            );
        """)
        conn.commit()
        conn.close()

    # ── Write API ─────────────────────────────────────────────────────────

    def record_cycle(self, cycle: EvolutionCycleRecord) -> int:
        """Insert a completed cycle and its variants. Returns the cycle id."""
        c = self._conn()
        cur = c.execute(
            """INSERT INTO evolution_cycles
               (started_at, finished_at, attack_variants_generated,
                synthetic_samples_count, baseline_auc, new_model_auc,
                promoted, rejection_reason)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                cycle.started_at,
                cycle.finished_at,
                cycle.attack_variants_generated,
                cycle.synthetic_samples_count,
                cycle.baseline_auc,
                cycle.new_model_auc,
                int(cycle.promoted),
                cycle.rejection_reason,
            ),
        )
        cycle_id = cur.lastrowid
        for v in cycle.variants:
            c.execute(
                """INSERT INTO attack_variants
                   (cycle_id, variant_name, attack_type, intensity,
                    sample_count, avg_fake_score_before, avg_fake_score_after)
                   VALUES (?,?,?,?,?,?,?)""",
                (
                    cycle_id,
                    v.variant_name,
                    v.attack_type,
                    v.intensity,
                    v.sample_count,
                    v.avg_fake_score_before,
                    v.avg_fake_score_after,
                ),
            )
        c.commit()
        logger.info(f"📝 Evolution cycle #{cycle_id} recorded  promoted={cycle.promoted}")
        return cycle_id

    def record_model_version(self, cycle_id: int, model_path: str, auc: float, promoted: bool):
        c = self._conn()
        c.execute(
            """INSERT INTO model_versions (cycle_id, model_path, auc, promoted, created_at)
               VALUES (?,?,?,?,?)""",
            (cycle_id, model_path, auc, int(promoted), time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        )
        c.commit()

    # ── Read API ──────────────────────────────────────────────────────────

    def get_recent_cycles(self, limit: int = 20) -> List[Dict[str, Any]]:
        rows = self._conn().execute(
            "SELECT * FROM evolution_cycles ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["promoted"] = bool(d["promoted"])
            variants = self._conn().execute(
                "SELECT * FROM attack_variants WHERE cycle_id=?", (d["id"],)
            ).fetchall()
            d["variants"] = [dict(v) for v in variants]
            result.append(d)
        return result

    def get_cycle(self, cycle_id: int) -> Optional[Dict[str, Any]]:
        row = self._conn().execute(
            "SELECT * FROM evolution_cycles WHERE id=?", (cycle_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["promoted"] = bool(d["promoted"])
        variants = self._conn().execute(
            "SELECT * FROM attack_variants WHERE cycle_id=?", (cycle_id,)
        ).fetchall()
        d["variants"] = [dict(v) for v in variants]
        return d

    def get_model_versions(self, limit: int = 20) -> List[Dict[str, Any]]:
        rows = self._conn().execute(
            "SELECT * FROM model_versions ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_summary(self) -> Dict[str, Any]:
        conn = self._conn()
        total_cycles = conn.execute("SELECT COUNT(*) FROM evolution_cycles").fetchone()[0]
        promoted     = conn.execute("SELECT COUNT(*) FROM evolution_cycles WHERE promoted=1").fetchone()[0]
        total_attacks= conn.execute("SELECT COUNT(*) FROM attack_variants").fetchone()[0]
        latest       = conn.execute(
            "SELECT * FROM evolution_cycles ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return {
            "total_cycles":          total_cycles,
            "promoted_models":       promoted,
            "rejected_models":       total_cycles - promoted,
            "total_attack_variants": total_attacks,
            "latest_cycle_id":       dict(latest)["id"] if latest else None,
            "latest_auc":            dict(latest)["new_model_auc"] if latest else None,
        }


def get_evolution_log() -> EvolutionLog:
    return EvolutionLog.get_instance()
