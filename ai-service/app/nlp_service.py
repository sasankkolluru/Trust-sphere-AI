from __future__ import annotations

import hashlib
import re
from collections import Counter
from functools import lru_cache
from typing import Any

import numpy as np

try:
    import spacy
except ImportError:  # pragma: no cover - dependency is declared but optional at runtime
    spacy = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None

try:
    from transformers import pipeline
except ImportError:  # pragma: no cover
    pipeline = None

NLP_VERSION = "demo-2026.10"
SUSPICIOUS_PATTERNS = {
    "upfront_payment": r"\b(pay|send|transfer|wire)\b.{0,35}\b(fee|deposit|money|payment)\b",
    "guaranteed_returns": r"\b(guaranteed?|risk[- ]?free|double your money|100%\s*profit)\b",
    "urgency_or_threat": r"\b(act now|urgent|immediately|last chance|account will be closed)\b",
    "credential_request": r"\b(password|one[- ]?time code|otp|login details|bank details)\b",
    "unrealistic_job_offer": r"\b(work from home|no experience)\b.{0,45}\b(\$|usd|dollars)\s?\d{3,}",
}
POSITIVE_WORDS = {"excellent", "great", "good", "helpful", "reliable", "professional", "love"}
NEGATIVE_WORDS = {"bad", "fraud", "scam", "terrible", "poor", "fake", "disappointed", "awful"}
STOPWORDS = {
    "about", "after", "again", "also", "been", "being", "from", "have", "into",
    "that", "their", "there", "these", "this", "they", "with", "your", "will",
    "would", "could", "should", "were", "what", "when", "where", "which",
}


def _tokens(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z0-9'-]{2,}", text.lower())


@lru_cache(maxsize=1)
def _sentiment_model() -> Any:
    if pipeline is None:
        return None
    try:
        return pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            local_files_only=True,
        )
    except Exception:
        return None


@lru_cache(maxsize=1)
def _embedding_model() -> Any:
    if SentenceTransformer is None:
        return None
    try:
        return SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _spacy_model() -> Any:
    if spacy is None:
        return None
    try:
        return spacy.load("en_core_web_sm")
    except Exception:
        return spacy.blank("en")


def _fallback_embedding(text: str, dimensions: int = 128) -> list[float]:
    vector = np.zeros(dimensions, dtype=np.float32)
    for token in _tokens(text):
        digest = hashlib.sha256(token.encode()).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        vector[index] += 1.0 if digest[4] % 2 else -1.0
    norm = np.linalg.norm(vector)
    return (vector / norm if norm else vector).round(6).tolist()


def _embedding(text: str) -> tuple[list[float], str]:
    model = _embedding_model()
    if model is not None:
        try:
            vector = model.encode(text, normalize_embeddings=True).tolist()
            return [round(float(value), 6) for value in vector], "sentence-transformers"
        except Exception:
            pass
    return _fallback_embedding(text), "deterministic-hash-fallback"


def _cosine(left: list[float], right: list[float]) -> float:
    a, b = np.asarray(left, dtype=float), np.asarray(right, dtype=float)
    if a.shape != b.shape or not np.linalg.norm(a) or not np.linalg.norm(b):
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def _sentiment(text: str) -> dict[str, Any]:
    model = _sentiment_model()
    if model is not None:
        try:
            result = model(text[:512])[0]
            return {
                "label": result["label"].lower(),
                "confidence": round(float(result["score"]), 4),
                "method": "transformers",
            }
        except Exception:
            pass
    words = set(_tokens(text))
    positive, negative = len(words & POSITIVE_WORDS), len(words & NEGATIVE_WORDS)
    if positive == negative:
        label, confidence = "neutral", 0.5
    elif positive > negative:
        label, confidence = "positive", min(0.99, 0.55 + positive * 0.08)
    else:
        label, confidence = "negative", min(0.99, 0.55 + negative * 0.08)
    return {"label": label, "confidence": round(confidence, 4), "method": "deterministic-lexicon"}


def _entities(text: str) -> list[dict[str, Any]]:
    doc = _spacy_model()
    if doc is not None:
        parsed = doc(text)
        if parsed.ents:
            return [
                {"text": entity.text, "label": entity.label_, "confidence": 0.8}
                for entity in parsed.ents
            ]
    patterns = [
        ("EMAIL", r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
        ("MONEY", r"(?i)(?:[$€£]\s?\d+(?:[,.]\d+)*|\b\d+(?:[,.]\d+)?\s?(?:usd|eur|gbp)\b)"),
        ("URL", r"https?://[^\s]+"),
        ("PHONE", r"\+?\d[\d ()-]{7,}\d"),
    ]
    results = []
    for label, pattern in patterns:
        results.extend(
            {"text": match.group(0), "label": label, "confidence": 0.95}
            for match in re.finditer(pattern, text)
        )
    return results


def _keywords(text: str, limit: int = 8) -> list[dict[str, Any]]:
    counts = Counter(
        token for token in _tokens(text)
        if token not in STOPWORDS and not token.isdigit()
    )
    total = max(1, sum(counts.values()))
    return [
        {"keyword": token, "score": round(count / total, 4), "confidence": 0.75}
        for token, count in counts.most_common(limit)
    ]


def analyze_text(text: str, reference_texts: list[str] | None = None) -> dict[str, Any]:
    if not text.strip():
        raise ValueError("text must not be empty")
    sentiment = _sentiment(text)
    entities = _entities(text)
    keywords = _keywords(text)
    matches = [
        {
            "indicator": name,
            "phrase": match.group(0),
            "confidence": 0.9,
        }
        for name, pattern in SUSPICIOUS_PATTERNS.items()
        if (match := re.search(pattern, text, flags=re.IGNORECASE))
    ]
    embedding, embedding_method = _embedding(text)
    similarities = [
        _cosine(embedding, _embedding(reference)[0])
        for reference in (reference_texts or [])
    ]
    similarity = max(similarities, default=0.0)
    classification = (
        "suspicious"
        if matches
        else "negative"
        if sentiment["label"] == "negative"
        else "legitimate"
    )
    high_signal_indicators = {
        "upfront_payment",
        "guaranteed_returns",
        "credential_request",
        "unrealistic_job_offer",
    }
    risk_score = min(
        1.0,
        sum(
            0.6 if item["indicator"] in high_signal_indicators else 0.25
            for item in matches
        )
        + (0.2 if sentiment["label"] == "negative" else 0),
    )
    return {
        "text_classification": {
            "label": classification,
            "confidence": round(
                min(0.99, 0.65 + 0.08 * len(matches))
                if matches
                else sentiment["confidence"],
                4,
            ),
            "method": "deterministic-risk-rules-and-sentiment",
        },
        "sentiment": sentiment,
        "entities": entities,
        "keywords": keywords,
        "suspicious_phrases": matches,
        "embedding": embedding,
        "similarity_score": round(similarity, 4),
        "duplicate": similarity >= 0.92,
        "text_risk_indicators": {
            "score": round(risk_score, 4),
            "level": "high" if risk_score >= 0.6 else "medium" if risk_score >= 0.3 else "low",
            "indicators": [item["indicator"] for item in matches],
            "confidence": round(min(0.99, 0.6 + len(matches) * 0.1), 4),
        },
        "claims": [
            {"text": sentence.strip(), "confidence": 0.65}
            for sentence in re.split(r"(?<=[.!?])\s+", text)
            if re.search(r"\b(is|are|has|have|offers?|provides?|guarantees?)\b", sentence, re.I)
        ],
        "metadata": {
            "version": NLP_VERSION,
            "embedding_method": embedding_method,
            "classification_method": sentiment["method"],
            "entity_method": "spacy" if spacy is not None else "regex-fallback",
            "llm_used": False,
        },
    }
