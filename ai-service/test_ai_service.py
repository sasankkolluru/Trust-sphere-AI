import unittest

from fastapi.testclient import TestClient

from app.main import app


FEATURES = {
    "domain_age_days": 30,
    "missing_contact_information": True,
    "suspicious_payment_request": True,
    "discount_percent": 80,
    "duplicate_review": False,
    "reviews_per_hour": 2,
    "suspicious_email": True,
    "inconsistent_business_information": False,
}


class AiServiceApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_and_model_metadata(self) -> None:
        health = self.client.get("/health")
        models = self.client.get("/models")

        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["models_ready"])
        self.assertEqual(models.status_code, 200)
        self.assertEqual(models.json()["selection"]["dataset_source"], "synthetic_demo_only")
        self.assertIn(models.json()["selection"]["selected_model"], {"random-forest", "xgboost"})
        self.assertIn(
            "isolation-forest",
            {model["name"] for model in models.json()["models"]},
        )

    def test_predictions_include_version_probability_and_explanations(self) -> None:
        risk = self.client.post("/predict/risk", json={"features": FEATURES})
        anomaly = self.client.post("/predict/anomaly", json={"features": FEATURES})

        self.assertEqual(risk.status_code, 200)
        self.assertIn(risk.json()["model"], {"random-forest", "xgboost"})
        self.assertGreaterEqual(risk.json()["confidence"], 0)
        self.assertLessEqual(risk.json()["confidence"], 1)
        self.assertTrue(risk.json()["explanation"])
        self.assertEqual(anomaly.status_code, 200)
        self.assertIn(anomaly.json()["prediction"], {"normal", "anomaly"})

    def test_validation_rejects_invalid_and_unknown_features(self) -> None:
        invalid = self.client.post(
            "/predict/risk",
            json={"features": {**FEATURES, "domain_age_days": -1}},
        )
        unknown = self.client.post(
            "/predict/risk",
            json={"features": {**FEATURES, "unexpected": True}},
        )

        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(unknown.status_code, 422)

    def test_unknown_model_version_is_explicitly_rejected(self) -> None:
        response = self.client.post(
            "/predict/risk",
            json={"features": FEATURES, "model_version": "missing-version"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported model version", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
