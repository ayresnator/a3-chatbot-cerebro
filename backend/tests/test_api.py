import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from dataclasses import replace
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import config
from app.config import Settings
from app.main import app
from app.models import QuizItem
from app import providers

CONFIG = Settings(provider="gemini", model="gemini-2.5-flash",
                  api_key="fake-test-key", allowed_origins=[])

def gemini_reply(text):
    return io.StringIO(json.dumps(
        {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": text}]}}]}))

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

    @patch("app.providers.urlopen", side_effect=ConnectionResetError("reset"))
    def test_dropped_connection_is_a_network_error(self, _):
        # Antes escapava como HTTP 500 em texto puro e a tela culpava o backend.
        with patch.object(providers, "settings", CONFIG):
            with self.assertRaises(HTTPException) as ctx:
                providers.ai({}, "JSON")
        self.assertEqual(ctx.exception.detail["code"], "AI_NETWORK_ERROR")

    @patch("app.providers.time.sleep")
    @patch("app.providers.urlopen")
    def test_overloaded_provider_is_retried(self, mock_open, mock_sleep):
        busy = HTTPError("https://example.invalid", 503, "busy", {},
                         io.BytesIO(b'{"error":{"status":"UNAVAILABLE"}}'))
        answer = MagicMock()
        answer.__enter__.return_value = gemini_reply('{"answer":"ok"}')
        mock_open.side_effect = [busy, answer]
        with patch.object(providers, "settings", CONFIG):
            self.assertEqual(providers.ai({}, "JSON"), {"answer": "ok"})
        self.assertEqual(mock_open.call_count, 2)
        mock_sleep.assert_called_once()

    @patch("app.providers.urlopen")
    def test_schema_is_sent_to_gemini(self, mock_open):
        mock_open.return_value.__enter__.return_value = gemini_reply('{"answer":"ok"}')
        with patch.object(providers, "settings", CONFIG):
            providers.ai({}, "JSON", {"type": "object"})
        body = json.loads(mock_open.call_args.args[0].data)
        self.assertEqual(body["generationConfig"]["responseJsonSchema"], {"type": "object"})

    @patch("app.providers.urlopen")
    def test_broken_json_is_retried_once(self, mock_open):
        # Sem esquema o modelo às vezes devolve JSON quebrado; a segunda chamada costuma vir certa.
        broken = '{"answer": "sem fechar'
        mock_open.return_value.__enter__.side_effect = [gemini_reply(broken), gemini_reply('{"answer":"ok"}')]
        with patch.object(providers, "settings", CONFIG):
            self.assertEqual(providers.ai({}, "JSON"), {"answer": "ok"})
        self.assertEqual(mock_open.call_count, 2)
        mock_open.return_value.__enter__.side_effect = [gemini_reply(broken), gemini_reply(broken)]
        with patch.object(providers, "settings", CONFIG):
            with self.assertRaises(HTTPException) as ctx:
                providers.ai({}, "JSON")
        self.assertEqual(ctx.exception.detail["code"], "AI_INVALID_JSON")
        self.assertEqual(mock_open.call_count, 4)

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


class QuizItemTests(unittest.TestCase):
    def item(self, **fields):
        return QuizItem.model_validate({"question": "q", "explanation": "e", **fields})

    def test_index_as_text_is_accepted(self):
        # O Gemini já devolveu "1" em vez de 1 e o material inteiro era recusado.
        self.assertEqual(self.item(type="multiple", options=["a", "b", "c"], answer="1").answer, 1)

    def test_true_false_is_not_read_as_an_index(self):
        # True virava 1 ("Falso"): a resposta certa ficava invertida sem erro nenhum.
        options = ["Verdadeiro", "Falso"]
        self.assertEqual(self.item(type="boolean", options=options, answer=True).answer, 0)
        self.assertEqual(self.item(type="boolean", options=options, answer=False).answer, 1)
        for ambiguous in ({"type": "boolean", "options": ["Falso", "Verdadeiro"]},
                          {"type": "multiple", "options": ["a", "b", "c"]}):
            with self.assertRaises(ValueError):
                self.item(answer=True, **ambiguous)

    def test_numeric_short_answer_becomes_text(self):
        self.assertEqual(self.item(type="short", answer=42).answer, "42")
        self.assertEqual(self.item(type="short", answer=4.0).answer, "4")


class ConfigTests(unittest.TestCase):
    def test_template_placeholder_is_not_a_key(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini", "GEMINI_API_KEY": "sua_chave_aqui"}):
            self.assertEqual(config.load_settings().api_key, "")


class ApiTests(unittest.TestCase):
    MATERIAL = {
        "title": "Fotossíntese",
        "summary": [{"concept": "Luz", "text": "A planta usa luz."}],
        "flashcards": [{"question": "O que absorve a luz?", "answer": "Clorofila"}],
        "quiz": [{"type": "multiple", "question": "Onde ocorre?", "options": ["Raiz", "Cloroplasto", "Flor"],
                  "answer": "1", "explanation": "No cloroplasto.", "steps": []}],
    }
    REQUEST = {"content": "Fotossíntese", "area": "Escolar", "level": "Básico"}

    def setUp(self):
        self.client = TestClient(app)

    @patch("app.main.ai", return_value=MATERIAL)
    def test_generate_returns_validated_material(self, mock_ai):
        response = self.client.post("/api/generate", json=self.REQUEST)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["quiz"][0]["answer"], 1)
        # O esquema vai junto para o provedor só gerar o formato aceito.
        self.assertIn("quiz", mock_ai.call_args.args[2]["properties"])
        mock_ai.assert_called_once()

    def test_generate_retries_when_accents_are_missing(self):
        # O modelo às vezes devolve "Fotossintese", "funcao": uma segunda chamada costuma vir certa.
        plain = {**self.MATERIAL, "title": "Fotossintese"}
        with patch("app.main.ai", side_effect=[plain, self.MATERIAL]) as mock_ai:
            response = self.client.post("/api/generate", json=self.REQUEST)
        self.assertEqual(response.json()["title"], "Fotossíntese")
        self.assertEqual(mock_ai.call_count, 2)

    @patch("app.main.ai", return_value={**MATERIAL, "quiz": []})
    def test_generate_rejects_incomplete_material(self, _):
        with self.assertLogs("cerebro.api", level="WARNING"):
            response = self.client.post("/api/generate", json=self.REQUEST)
        self.assertEqual(response.status_code, 502)

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
        # Confere o valor da chave, não só o nome do campo: sob outro nome ela passava despercebida.
        with patch("app.main.settings", CONFIG):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(CONFIG.api_key, response.text)

if __name__ == "__main__":
    unittest.main()
