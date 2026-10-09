import unittest

from fastapi.testclient import TestClient

from app.main import app


class NLPExamplesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def analyze(self, text: str, references: list[str] | None = None) -> dict:
        response = self.client.post(
            "/nlp/analyze",
            json={"text": text, "reference_texts": references or []},
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_fake_job_posting(self) -> None:
        result = self.analyze(
            "Work from home, no experience needed. Earn $5000 today, pay a deposit now."
        )
        self.assertTrue(result["suspicious_phrases"])
        self.assertEqual(result["text_classification"]["label"], "suspicious")
        self.assertEqual(result["text_risk_indicators"]["level"], "high")

    def test_suspicious_review(self) -> None:
        result = self.analyze(
            "This is a fake scam review. Act now and send payment immediately."
        )
        self.assertEqual(result["sentiment"]["label"], "negative")
        self.assertTrue(result["text_risk_indicators"]["indicators"])

    def test_legitimate_business_description(self) -> None:
        result = self.analyze(
            "Acme Services provides reliable professional support to local businesses."
        )
        self.assertEqual(result["sentiment"]["label"], "positive")
        self.assertEqual(result["text_risk_indicators"]["level"], "low")
        self.assertTrue(result["claims"])

    def test_suspicious_financial_message_and_near_duplicate(self) -> None:
        text = "Urgent: transfer money immediately for guaranteed risk-free returns."
        result = self.analyze(text, [text])
        self.assertTrue(result["duplicate"])
        self.assertGreaterEqual(result["similarity_score"], 0.92)
        self.assertTrue(result["entities"] == [] or isinstance(result["entities"], list))

    def test_empty_text_is_rejected(self) -> None:
        response = self.client.post("/nlp/analyze", json={"text": ""})
        self.assertEqual(response.status_code, 422)
