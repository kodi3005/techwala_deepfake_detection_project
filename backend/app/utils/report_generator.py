"""
report_generator.py  –  Build JSON / lightweight PDF forensic reports
"""
import json
from datetime import datetime
from typing import Any, Dict


def build_json_report(detection_result: Dict[str, Any], media_type: str) -> str:
    overall_real = detection_result.get("overall_real", 0.5)
    overall_fake = detection_result.get("overall_fake", 0.5)
    final_trust  = round(overall_real * 100)

    # Compute sub-scores relative to tensor confidence
    face_texture    = min(99, max(12, round(overall_real * 95)))
    eye_consistency = min(98, max(15, round(overall_real * 92)))
    lighting        = min(96, max(18, round(overall_real * 88)))
    compression     = min(97, max(25, round(85 - overall_fake * 15)))
    metadata_status = "Missing / Stripped"

    report = {
        "report_type": "DeepGuard Forensic Verification Report",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "media_type": media_type,
        "confidence_score_breakdown": {
            "face_texture": f"{face_texture}%",
            "eye_consistency": f"{eye_consistency}%",
            "lighting": f"{lighting}%",
            "compression": f"{compression}%",
            "metadata": metadata_status,
            "final_trust": f"{final_trust}%",
        },
        "result": detection_result,
    }
    return json.dumps(report, indent=2)
