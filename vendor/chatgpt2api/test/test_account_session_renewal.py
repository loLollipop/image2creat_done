"""Unit tests for sessionToken auto-renewal in AccountService / OpenAIBackendAPI."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("CHATGPT2API_AUTH_KEY", "test-auth")

from services.account_service import AccountService
from services.openai_backend_api import InvalidAccessTokenError
from services.storage.json_storage import JSONStorageBackend


def _make_service(tmp: str) -> AccountService:
    storage = JSONStorageBackend(Path(tmp) / "accounts.json")
    return AccountService(storage)


class AddAccountEntriesTests(unittest.TestCase):
    def test_entries_preserve_session_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            result = service.add_account_entries([
                {"access_token": "at-1", "session_token": "  cookie-1  "},
                {"access_token": "at-2"},  # no session token
            ])
            self.assertEqual(result["added"], 2)
            account_one = service.get_account("at-1")
            account_two = service.get_account("at-2")
            self.assertIsNotNone(account_one)
            self.assertIsNotNone(account_two)
            assert account_one is not None and account_two is not None
            self.assertEqual(account_one["session_token"], "cookie-1")
            self.assertIsNone(account_two["session_token"])

    def test_existing_account_session_token_can_be_set_later(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_accounts(["at-only"])
            self.assertIsNone((service.get_account("at-only") or {}).get("session_token"))
            service.add_account_entries([{"access_token": "at-only", "session_token": "later-cookie"}])
            self.assertEqual((service.get_account("at-only") or {}).get("session_token"), "later-cookie")

    def test_legacy_add_accounts_still_works(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            result = service.add_accounts(["legacy-1", "legacy-2"])
            self.assertEqual(result["added"], 2)
            for token in ("legacy-1", "legacy-2"):
                account = service.get_account(token)
                self.assertIsNotNone(account)
                assert account is not None
                self.assertIsNone(account["session_token"])


class TryRenewViaSessionTests(unittest.TestCase):
    def test_returns_empty_when_no_session_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_accounts(["bare-token"])
            self.assertEqual(service._try_renew_via_session("bare-token", "test"), "")

    def test_returns_empty_when_unknown_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            self.assertEqual(service._try_renew_via_session("missing", "test"), "")

    def test_renewal_rekeys_account_and_marks_status_normal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_account_entries([{"access_token": "old-at", "session_token": "cookie-1"}])
            service.update_account("old-at", {"status": "异常"})

            with patch(
                "services.openai_backend_api.OpenAIBackendAPI.fetch_session_access_token",
                return_value="new-at",
            ) as mocked:
                result = service._try_renew_via_session("old-at", "test")

            mocked.assert_called_once_with("cookie-1")
            self.assertEqual(result, "new-at")
            self.assertIsNone(service.get_account("old-at"))
            renewed = service.get_account("new-at")
            self.assertIsNotNone(renewed)
            assert renewed is not None
            self.assertEqual(renewed["access_token"], "new-at")
            self.assertEqual(renewed["session_token"], "cookie-1")
            self.assertEqual(renewed["status"], "正常")
            self.assertIsNotNone(renewed["session_renewed_at"])
            self.assertIsNone(renewed["last_renewal_error"])

    def test_renewal_returning_same_token_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_account_entries([{"access_token": "stable-at", "session_token": "cookie"}])
            with patch(
                "services.openai_backend_api.OpenAIBackendAPI.fetch_session_access_token",
                return_value="stable-at",
            ):
                result = service._try_renew_via_session("stable-at", "test")
            self.assertEqual(result, "stable-at")
            account = service.get_account("stable-at")
            self.assertIsNotNone(account)
            assert account is not None
            self.assertIsNotNone(account["session_renewed_at"])

    def test_renewal_failure_records_error_and_keeps_account(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_account_entries([{"access_token": "old-at", "session_token": "cookie"}])

            with patch(
                "services.openai_backend_api.OpenAIBackendAPI.fetch_session_access_token",
                side_effect=RuntimeError("HTTP 403 Cloudflare"),
            ):
                result = service._try_renew_via_session("old-at", "test")
            self.assertEqual(result, "")
            account = service.get_account("old-at")
            self.assertIsNotNone(account)
            assert account is not None
            self.assertEqual(account["last_renewal_error"], "HTTP 403 Cloudflare")
            self.assertEqual(account["session_token"], "cookie")

    def test_renewal_returning_existing_pool_token_is_aborted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_account_entries([
                {"access_token": "old-at", "session_token": "cookie"},
                {"access_token": "other-at"},
            ])
            with patch(
                "services.openai_backend_api.OpenAIBackendAPI.fetch_session_access_token",
                return_value="other-at",
            ):
                result = service._try_renew_via_session("old-at", "test")
            self.assertEqual(result, "")
            self.assertIsNotNone(service.get_account("old-at"))
            self.assertIsNotNone(service.get_account("other-at"))


class FetchRemoteInfoRenewalFallbackTests(unittest.TestCase):
    def test_fetch_remote_info_renews_on_invalid_token_then_succeeds(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_account_entries([{"access_token": "old-at", "session_token": "cookie"}])

            user_info_responses = {
                "old-at": InvalidAccessTokenError("/backend-api/me failed: HTTP 401"),
                "new-at": {
                    "email": "u@example.com",
                    "user_id": "u-1",
                    "type": "free",
                    "quota": 5,
                    "image_quota_unknown": False,
                    "limits_progress": [],
                    "default_model_slug": None,
                    "restore_at": None,
                    "status": "正常",
                },
            }

            class FakeAPI:
                def __init__(self, access_token: str = "") -> None:
                    self.access_token = access_token

                def get_user_info(self):
                    value = user_info_responses.get(self.access_token)
                    if isinstance(value, Exception):
                        raise value
                    if value is None:
                        raise RuntimeError(f"unexpected token {self.access_token!r}")
                    return value

                @staticmethod
                def fetch_session_access_token(session_token: str) -> str:
                    assert session_token == "cookie"
                    return "new-at"

            with patch("services.openai_backend_api.OpenAIBackendAPI", FakeAPI):
                result = service.fetch_remote_info("old-at", "test")

            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual(result["access_token"], "new-at")
            self.assertEqual(result["email"], "u@example.com")
            self.assertEqual(result["status"], "正常")
            self.assertIsNone(service.get_account("old-at"))
            self.assertIsNotNone(service.get_account("new-at"))

    def test_fetch_remote_info_falls_back_to_remove_when_no_session_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_accounts(["bare-at"])

            class FakeAPI:
                def __init__(self, access_token: str = "") -> None:
                    self.access_token = access_token

                def get_user_info(self):
                    raise InvalidAccessTokenError("/backend-api/me failed: HTTP 401")

                @staticmethod
                def fetch_session_access_token(session_token: str) -> str:
                    raise AssertionError("should not be called when session_token missing")

            with patch("services.openai_backend_api.OpenAIBackendAPI", FakeAPI):
                with self.assertRaises(InvalidAccessTokenError):
                    service.fetch_remote_info("bare-at", "test")

            # auto_remove_invalid_accounts is on by default → account is gone
            self.assertIsNone(service.get_account("bare-at"))

    def test_fetch_remote_info_renews_but_new_token_is_also_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            service = _make_service(tmp)
            service.add_account_entries([{"access_token": "old-at", "session_token": "cookie"}])

            class FakeAPI:
                def __init__(self, access_token: str = "") -> None:
                    self.access_token = access_token

                def get_user_info(self):
                    raise InvalidAccessTokenError("/backend-api/me failed: HTTP 401")

                @staticmethod
                def fetch_session_access_token(session_token: str) -> str:
                    return "new-at"

            with patch("services.openai_backend_api.OpenAIBackendAPI", FakeAPI):
                with self.assertRaises(InvalidAccessTokenError):
                    service.fetch_remote_info("old-at", "test")

            # Renewal succeeded the rekey but second user-info call also 401'd → new key removed
            self.assertIsNone(service.get_account("old-at"))
            self.assertIsNone(service.get_account("new-at"))


if __name__ == "__main__":
    unittest.main()
