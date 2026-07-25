"""
casde_schemas.py – Pydantic models for all CASDE API responses.
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class AttackVariantSchema(BaseModel):
    id:                      int = 0
    variant_name:            str
    attack_type:             str
    intensity:               float
    sample_count:            int
    avg_fake_score_before:   float
    avg_fake_score_after:    float


class EvolutionCycleSchema(BaseModel):
    id:                          int
    started_at:                  str
    finished_at:                 str
    attack_variants_generated:   int
    synthetic_samples_count:     int
    baseline_auc:                float
    new_model_auc:               float
    promoted:                    bool
    rejection_reason:            str
    variants:                    List[AttackVariantSchema] = []


class EvolutionSummarySchema(BaseModel):
    total_cycles:           int
    promoted_models:        int
    rejected_models:        int
    total_attack_variants:  int
    latest_cycle_id:        Optional[int]
    latest_auc:             Optional[float]


class BufferStatsSchema(BaseModel):
    current_size:          int
    max_size:              int
    total_pushed:          int
    total_drained:         int
    uncertainty_threshold: float


class TrainerStatusSchema(BaseModel):
    classifier_ready:   bool
    total_trained:      int
    feature_dim:        Optional[int]
    baseline_auc:       float
    current_auc:        float
    min_samples_needed: int
    auc_tolerance:      float


class CASDeStatusSchema(BaseModel):
    engine_running:     bool
    current_cycle:      int
    last_cycle_at:      float
    last_cycle_info:    Dict[str, Any]
    cycle_interval_sec: int
    min_buffer_fill:    int
    buffer:             BufferStatsSchema
    trainer:            TrainerStatusSchema
    evolution_summary:  EvolutionSummarySchema


class TriggerResponseSchema(BaseModel):
    message:  str
    cycle:    int


class ModelVersionSchema(BaseModel):
    id:          int
    cycle_id:    int
    model_path:  str
    auc:         float
    promoted:    bool
    created_at:  str
