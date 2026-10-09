from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

MODEL_VERSION = "demo-2026.10"
FEATURE_NAMES = (
    "domain_age_days",
    "missing_contact_information",
    "suspicious_payment_request",
    "discount_percent",
    "duplicate_review",
    "reviews_per_hour",
    "suspicious_email",
    "inconsistent_business_information",
)


def _synthetic_dataset() -> tuple[np.ndarray, np.ndarray]:
    """Create a clearly labeled, deterministic demo dataset; not production evidence."""
    rng = np.random.default_rng(202610)
    rows = 800
    features = np.column_stack(
        [
            rng.integers(1, 2_000, rows),
            rng.integers(0, 2, rows),
            rng.integers(0, 2, rows),
            rng.uniform(0, 100, rows),
            rng.integers(0, 2, rows),
            rng.uniform(0, 40, rows),
            rng.integers(0, 2, rows),
            rng.integers(0, 2, rows),
        ]
    ).astype(float)
    score = (
        (features[:, 0] < 90) * 1.3
        + features[:, 1] * 0.7
        + features[:, 2] * 1.7
        + (features[:, 3] >= 70) * 1.0
        + features[:, 4] * 1.0
        + (features[:, 5] >= 20) * 1.1
        + features[:, 6] * 1.1
        + features[:, 7] * 1.2
    )
    labels = (score >= 2.2).astype(int)
    return features, labels


def _metrics(model: Any, x_test: np.ndarray, y_test: np.ndarray) -> dict[str, Any]:
    predictions = model.predict(x_test).astype(int)
    probabilities = model.predict_proba(x_test)[:, 1]
    return {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
    }


@dataclass
class RegisteredModel:
    name: str
    version: str
    task: str
    model: Any
    scaler: StandardScaler
    metrics: dict[str, Any]
    metadata: dict[str, Any]


def _build_registry() -> dict[str, RegisteredModel]:
    x, y = _synthetic_dataset()
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=202610, stratify=y
    )
    registry: dict[str, RegisteredModel] = {}

    candidates = {
        "random-forest": RandomForestClassifier(
            n_estimators=120, max_depth=8, random_state=202610, n_jobs=1
        ),
        "xgboost": XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=202610,
            n_jobs=1,
            eval_metric="logloss",
        ),
    }
    for name, model in candidates.items():
        scaler = StandardScaler()
        scaled_train = scaler.fit_transform(x_train)
        scaled_test = scaler.transform(x_test)
        model.fit(scaled_train, y_train)
        metrics = _metrics(model, scaled_test, y_test)
        registry[name] = RegisteredModel(
            name=name,
            version=MODEL_VERSION,
            task="risk_classification",
            model=model,
            scaler=scaler,
            metrics=metrics,
            metadata={
                "name": name,
                "version": MODEL_VERSION,
                "task": "risk_classification",
                "feature_names": list(FEATURE_NAMES),
                "dataset_source": "synthetic_demo_only",
                "evaluation_status": "not_production_evidence",
                "metrics": metrics,
            },
        )
    return registry


MODEL_REGISTRY = _build_registry()
BEST_RISK_MODEL = max(
    MODEL_REGISTRY.values(),
    key=lambda item: (item.metrics["f1"], item.metrics["roc_auc"], item.metrics["recall"]),
)

_anomaly_scaler = StandardScaler()
_anomaly_model = IsolationForest(
    n_estimators=120, contamination=0.08, random_state=202610, n_jobs=1
)
_demo_features, _ = _synthetic_dataset()
_anomaly_model.fit(_anomaly_scaler.fit_transform(_demo_features))
ANOMALY_METADATA = {
    "name": "isolation-forest",
    "version": MODEL_VERSION,
    "task": "anomaly_detection",
    "feature_names": list(FEATURE_NAMES),
    "dataset_source": "synthetic_demo_only",
    "evaluation_status": "unsupervised; no accuracy claim",
}


def _vectorize(features: dict[str, Any]) -> np.ndarray:
    missing = set(FEATURE_NAMES) - features.keys()
    if missing:
        raise ValueError(f"Missing required features: {', '.join(sorted(missing))}")
    return np.array([[float(features[name]) for name in FEATURE_NAMES]], dtype=float)


def _explanations(model: RegisteredModel, vector: np.ndarray) -> list[dict[str, Any]]:
    importances = getattr(model.model, "feature_importances_", np.zeros(len(FEATURE_NAMES)))
    ranked = np.argsort(importances)[::-1][:3]
    return [
        {
            "feature": FEATURE_NAMES[index],
            "importance": round(float(importances[index]), 4),
            "value": float(vector[0, index]),
        }
        for index in ranked
        if importances[index] > 0
    ]


def predict_risk(features: dict[str, Any], requested_version: str | None = None) -> dict[str, Any]:
    if requested_version and requested_version != MODEL_VERSION:
        raise ValueError(f"Unsupported model version: {requested_version}")
    selected = BEST_RISK_MODEL
    vector = _vectorize(features)
    scaled = selected.scaler.transform(vector)
    probability = float(selected.model.predict_proba(scaled)[0, 1])
    prediction = int(probability >= 0.5)
    return {
        "model": selected.name,
        "model_version": selected.version,
        "prediction": prediction,
        "label": "high_risk" if prediction else "low_risk",
        "probability": round(probability, 4),
        "confidence": round(max(probability, 1 - probability), 4),
        "explanation": _explanations(selected, vector),
        "metadata": selected.metadata,
    }


def predict_anomaly(features: dict[str, Any], requested_version: str | None = None) -> dict[str, Any]:
    if requested_version and requested_version != MODEL_VERSION:
        raise ValueError(f"Unsupported model version: {requested_version}")
    vector = _vectorize(features)
    scaled = _anomaly_scaler.transform(vector)
    raw_prediction = int(_anomaly_model.predict(scaled)[0])
    decision = float(_anomaly_model.decision_function(scaled)[0])
    confidence = float(1 / (1 + np.exp(-abs(decision) * 4)))
    return {
        "model": "isolation-forest",
        "model_version": MODEL_VERSION,
        "prediction": "anomaly" if raw_prediction == -1 else "normal",
        "is_anomaly": raw_prediction == -1,
        "confidence": round(confidence, 4),
        "decision_score": round(decision, 4),
        "metadata": {
            **ANOMALY_METADATA,
        },
    }
