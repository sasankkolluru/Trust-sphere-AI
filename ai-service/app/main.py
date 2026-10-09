from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .model_service import (
    BEST_RISK_MODEL,
    ANOMALY_METADATA,
    MODEL_REGISTRY,
    predict_anomaly,
    predict_risk,
)
from .nlp_service import analyze_text

app = FastAPI(title="TrustSphere AI Service", version="0.2.0")


class RiskFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain_age_days: float = Field(ge=0)
    missing_contact_information: bool
    suspicious_payment_request: bool
    discount_percent: float = Field(ge=0, le=100)
    duplicate_review: bool
    reviews_per_hour: float = Field(ge=0)
    suspicious_email: bool
    inconsistent_business_information: bool


class RiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    features: RiskFeatures
    model_version: str | None = None


class AnomalyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    features: RiskFeatures
    model_version: str | None = None


class NLPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=20_000)
    reference_texts: list[str] = Field(default_factory=list, max_length=20)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "service": "trustsphere-ai",
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "models_ready": bool(MODEL_REGISTRY),
        "evaluation_disclaimer": "Metrics are synthetic-demo only until a real labeled dataset is supplied.",
    }


@app.get("/models")
@app.get("/internal/v1/models")
def models() -> dict[str, Any]:
    return {
        "models": [model.metadata for model in MODEL_REGISTRY.values()] + [ANOMALY_METADATA],
        "selection": {
            "selected_model": BEST_RISK_MODEL.name,
            "selection_metric": "f1, then roc_auc, then recall",
            "dataset_source": "synthetic_demo_only",
            "evaluation_status": "not_production_evidence",
        },
    }


@app.post("/predict/risk")
def risk_prediction(request: RiskRequest) -> dict[str, Any]:
    try:
        return predict_risk(request.features.model_dump(), request.model_version)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/predict/anomaly")
def anomaly_prediction(request: AnomalyRequest) -> dict[str, Any]:
    try:
        return predict_anomaly(request.features.model_dump(), request.model_version)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/nlp/analyze")
def nlp_analysis(request: NLPRequest) -> dict[str, Any]:
    try:
        return analyze_text(request.text, request.reference_texts)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
