import io
import json
import unittest
from unittest.mock import patch
from dataclasses import replace
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app import providers

CONFIG = Settings(provider="gemini", model="gemini-2.5-flash",
                  api_key="fake-test-key", allowed_origins=[])

class ProviderTests(unittest.TestCase):
    @patch("app.providers.urlopen")
    def test_gemini_native_auth_and_output(self, mock_open):
        payload = {"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"thought": True, "text": "ignore"}, {"text": '{"answer":"ok"}'}]
        }}]}
        mock_open.return_value.__enter__.return_value = io.StringIO(json.dumps(payload))
        with patch.object(providers, "settings", CONFIG):
            self.assertEqual(providers.ai({"question": "oi"}, "JSON"), {"answer": "ok"})
        request = mock_open.call_args.args[0]
        self.assertIn("/models/gemini-2.5-flash:generateContent", request.full_url)
        self.assertEqual(request.get_header("X-goog-api-key"), "fake-test-key")
        self.assertIsNone(request.get_header("Authorization"))
        self.assertNotIn("fake-test-key", request.full_url)
        body = json.loads(request.data)
        self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")

    @patch("app.providers.urlopen")
    def test_auth_and_quota_errors_are_actionable(self, mock_open):
        for status, expected in [(403, "AI_AUTH_ERROR"), (429, "AI_QUOTA_EXCEEDED"),
                                 (404, "AI_MODEL_NOT_FOUND")]:
            error = HTTPError("https://example.invalid", status, "error", {},
                              io.BytesIO(b'{"error":{"status":"PERMISSION_DENIED"}}'))
            mock_open.side_effect = error
            with patch.object(providers, "settings", CONFIG):
                with self.assertRaises(HTTPException) as ctx:
                    providers.ai({}, "JSON")
            self.assertEqual(ctx.exception.detail["code"], expected)
            self.assertNotIn("fake-test-key", str(ctx.exception.detail))

    @patch("app.providers.urlopen", side_effect=URLError("offline"))
    def test_network_failure(self, _):
        with patch.object(providers, "settings", CONFIG):
            with self.assertRaises(HTTPException) as ctx:
                providers.ai({}, "JSON")
        self.assertEqual(ctx.exception.detail["code"], "AI_NETWORK_ERROR")

    def test_invalid_json_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            providers.decode_output('["not an object"]')
        self.assertEqual(ctx.exception.detail["code"], "AI_INVALID_JSON")


class ModelDiscoveryTests(unittest.TestCase):
    def setUp(self):
        providers.resolve_gemini_model.cache_clear()

    def tearDown(self):
        providers.resolve_gemini_model.cache_clear()

    @patch("app.providers.list_gemini_models")
    def test_auto_selects_stable_flash_from_catalog(self, mock_list):
        mock_list.return_value = [
            "gemini-2.5-flash", "gemini-3.1-flash-lite",
            "gemini-4.0-pro", "gemini-9.0-flash-preview",
        ]
        with patch.object(providers, "settings", replace(CONFIG, model="auto")):
            self.assertEqual(providers.resolve_gemini_model(), "gemini-3.1-flash-lite")
            self.assertEqual(providers.resolve_gemini_model(), "gemini-3.1-flash-lite")
        mock_list.assert_called_once()

    @patch("app.providers.request_json")
    def test_paginated_catalog_excludes_image_and_embedding(self, mock_request):
        mock_request.side_effect = [
            {"models": [{"name": "models/gemini-3.1-flash", "supportedGenerationMethods": ["generateContent"]}],
             "nextPageToken": "next-page"},
            {"models": [
                {"name": "models/gemini-3.1-flash-image", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-embedding", "supportedGenerationMethods": ["embedContent"]},
            ]},
        ]
        with patch.object(providers, "settings", CONFIG):
            self.assertEqual(providers.list_gemini_models(), ["gemini-3.1-flash"])
        self.assertIn("pageToken=next-page", mock_request.call_args.args[0].full_url)

    @patch("app.providers.list_gemini_models", return_value=[])
    def test_auto_reports_empty_catalog(self, _):
        with patch.object(providers, "settings", replace(CONFIG, model="auto")):
            with self.assertRaises(HTTPException) as ctx:
                providers.resolve_gemini_model()
        self.assertEqual(ctx.exception.detail["code"], "AI_NO_COMPATIBLE_MODEL")


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("app.main.ai", return_value={"answer": "Olá!"})
    def test_chat_contract(self, mock_ai):
        response = self.client.post("/api/chat", json={
            "question": "O que é fotossíntese?", "content": "",
            "area": "Escolar", "level": "Básico",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"answer": "Olá!"})

    def test_empty_question_rejected(self):
        response = self.client.post("/api/chat", json={
            "question": "", "area": "Escolar", "level": "Básico",
        })
        self.assertEqual(response.status_code, 422)

    def test_health_never_returns_key(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("api_key", response.json())

if __name__ == "__main__":
    unittest.main()
