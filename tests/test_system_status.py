import unittest
from unittest.mock import patch

from app.routers.system_status import build_service_status


class ServiceStatusTests(unittest.TestCase):
    def test_local_fallback_without_credentials(self):
        with (
            patch("app.routers.system_status.settings.embedding_model", "text-embedding-3-small"),
            patch("app.routers.system_status.settings.huawei_api_key", ""),
            patch("app.routers.system_status.settings.huawei_ak", ""),
            patch("app.routers.system_status.settings.huawei_sk", ""),
            patch("app.routers.system_status.settings.huawei_project_id", ""),
            patch("app.routers.system_status.settings.huawei_embedding_deployment_id", ""),
            patch("app.routers.system_status.settings.openai_api_key", ""),
        ):
            result = build_service_status()

        self.assertEqual(result["services"]["embedding"]["selected"], "chroma-local")
        self.assertTrue(result["services"]["embedding"]["configured"]["local"])

    def test_huawei_has_priority_when_fully_configured(self):
        with (
            patch("app.routers.system_status.settings.embedding_model", "remote"),
            patch("app.routers.system_status.settings.huawei_api_key", "configured"),
            patch("app.routers.system_status.settings.huawei_project_id", "configured"),
            patch("app.routers.system_status.settings.huawei_embedding_deployment_id", "configured"),
            patch("app.routers.system_status.settings.openai_api_key", "configured"),
        ):
            result = build_service_status()

        self.assertEqual(result["services"]["embedding"]["selected"], "huawei")

    def test_status_does_not_expose_secret_values(self):
        secret = "do-not-return-this-secret"
        with patch("app.routers.system_status.settings.spark_api_key", secret):
            result = build_service_status()

        self.assertNotIn(secret, repr(result))


if __name__ == "__main__":
    unittest.main()
