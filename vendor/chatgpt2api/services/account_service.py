from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Condition, Lock
from typing import Any
from datetime import datetime

from services.config import config
from services.log_service import (
    LOG_TYPE_ACCOUNT,
    log_service,
)
from services.storage.base import StorageBackend
from utils.helper import anonymize_token


class AccountService:
    """账号池服务，使用 token -> account 的 dict 保存账号。"""

    def __init__(self, storage_backend: StorageBackend):
        self.storage = storage_backend
        self._lock = Lock()
        self._image_slot_condition = Condition(self._lock)
        self._index = 0
        self._accounts = self._load_accounts()
        self._image_inflight: dict[str, int] = {}

    def _load_accounts(self) -> dict[str, dict]:
        accounts = self.storage.load_accounts()
        return {
            normalized["access_token"]: normalized
            for item in accounts
            if (normalized := self._normalize_account(item)) is not None
        }

    def _save_accounts(self) -> None:
        self.storage.save_accounts(list(self._accounts.values()))

    @staticmethod
    def _is_image_account_available(account: dict) -> bool:
        if not isinstance(account, dict):
            return False
        if account.get("status") in {"禁用", "限流", "异常"}:
            return False
        if bool(account.get("image_quota_unknown")):
            return True
        return int(account.get("quota") or 0) > 0

    def _normalize_account(self, item: dict) -> dict | None:
        if not isinstance(item, dict):
            return None
        access_token = item.get("access_token") or ""
        if not access_token:
            return None
        normalized = dict(item)
        normalized["access_token"] = access_token
        normalized["type"] = normalized.get("type") or "free"
        normalized["status"] = normalized.get("status") or "正常"
        normalized["quota"] = max(0, int(normalized.get("quota") if normalized.get("quota") is not None else 0))
        normalized["image_quota_unknown"] = bool(normalized.get("image_quota_unknown"))
        normalized["email"] = normalized.get("email") or None
        normalized["user_id"] = normalized.get("user_id") or None
        limits_progress = normalized.get("limits_progress")
        normalized["limits_progress"] = limits_progress if isinstance(limits_progress, list) else []
        normalized["default_model_slug"] = normalized.get("default_model_slug") or None
        normalized["restore_at"] = normalized.get("restore_at") or None
        normalized["success"] = int(normalized.get("success") or 0)
        normalized["fail"] = int(normalized.get("fail") or 0)
        normalized["last_used_at"] = normalized.get("last_used_at")
        session_token = normalized.get("session_token")
        normalized["session_token"] = str(session_token).strip() if isinstance(session_token, str) and session_token.strip() else None
        normalized["session_renewed_at"] = normalized.get("session_renewed_at") or None
        normalized["last_renewal_error"] = normalized.get("last_renewal_error") or None
        return normalized

    def list_tokens(self) -> list[str]:
        with self._lock:
            return list(self._accounts)

    def _list_ready_candidate_tokens(self, excluded_tokens: set[str] | None = None) -> list[str]:
        excluded = set(excluded_tokens or set())
        return [
            token
            for item in self._accounts.values()
            if self._is_image_account_available(item)
               and (token := item.get("access_token") or "")
               and token not in excluded
        ]

    def _list_available_candidate_tokens(self, excluded_tokens: set[str] | None = None) -> list[str]:
        max_concurrency = max(1, int(config.image_account_concurrency or 1))
        return [
            token
            for token in self._list_ready_candidate_tokens(excluded_tokens)
            if int(self._image_inflight.get(token, 0)) < max_concurrency
        ]

    def _acquire_next_candidate_token(self, excluded_tokens: set[str] | None = None) -> str:
        with self._image_slot_condition:
            while True:
                if not self._list_ready_candidate_tokens(excluded_tokens):
                    raise RuntimeError("no available image quota")
                tokens = self._list_available_candidate_tokens(excluded_tokens)
                if tokens:
                    access_token = tokens[self._index % len(tokens)]
                    self._index += 1
                    self._image_inflight[access_token] = int(self._image_inflight.get(access_token, 0)) + 1
                    return access_token
                self._image_slot_condition.wait(timeout=1.0)

    def release_image_slot(self, access_token: str) -> None:
        if not access_token:
            return
        with self._image_slot_condition:
            current_inflight = int(self._image_inflight.get(access_token, 0))
            if current_inflight <= 1:
                self._image_inflight.pop(access_token, None)
            else:
                self._image_inflight[access_token] = current_inflight - 1
            self._image_slot_condition.notify_all()

    def get_available_access_token(self) -> str:
        attempted_tokens: set[str] = set()
        while True:
            access_token = self._acquire_next_candidate_token(excluded_tokens=attempted_tokens)
            attempted_tokens.add(access_token)
            try:
                account = self.fetch_remote_info(access_token, "get_available_access_token")
            except Exception:
                self.release_image_slot(access_token)
                continue
            current_token = str((account or {}).get("access_token") or access_token)
            if current_token != access_token:
                # 续期路径触发了 rekey：旧 token 已经从 inflight 里搬到新 token，
                # 把新 token 也加入 attempted 防止本轮再次命中
                attempted_tokens.add(current_token)
            if self._is_image_account_available(account or {}):
                return current_token
            self.release_image_slot(current_token)

    def get_text_access_token(self, excluded_tokens: set[str] | None = None) -> str:
        excluded = set(excluded_tokens or set())
        with self._lock:
            candidates = [
                token
                for account in self._accounts.values()
                if account.get("status") not in {"禁用", "异常"}
                   and (token := account.get("access_token") or "")
                   and token not in excluded
            ]
            if not candidates:
                return ""
            access_token = candidates[self._index % len(candidates)]
            self._index += 1
            return access_token

    def mark_text_used(self, access_token: str) -> None:
        if not access_token:
            return
        with self._lock:
            current = self._accounts.get(access_token)
            if current is None:
                return
            next_item = dict(current)
            next_item["last_used_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            account = self._normalize_account(next_item)
            if account is None:
                return
            self._accounts[access_token] = account
            self._save_accounts()

    def remove_invalid_token(self, access_token: str, event: str) -> bool:
        if not config.auto_remove_invalid_accounts:
            self.update_account(access_token, {"status": "异常", "quota": 0})
            return False
        removed = bool(self.delete_accounts([access_token])["removed"])
        if removed:
            log_service.add(LOG_TYPE_ACCOUNT, "自动移除异常账号",
                            {"source": event, "token": anonymize_token(access_token)})
        elif access_token:
            self.update_account(access_token, {"status": "异常", "quota": 0})
        return removed

    def get_account(self, access_token: str) -> dict | None:
        if not access_token:
            return None
        with self._lock:
            account = self._accounts.get(access_token)
            return dict(account) if account else None

    def list_accounts(self) -> list[dict]:
        with self._lock:
            return [dict(item) for item in self._accounts.values()]

    def list_limited_tokens(self) -> list[str]:
        with self._lock:
            return [
                token
                for item in self._accounts.values()
                if item.get("status") == "限流"
                   and (token := item.get("access_token") or "")
            ]

    def add_accounts(self, tokens: list[str]) -> dict:
        entries = [{"access_token": token} for token in tokens if token]
        return self.add_account_entries(entries)

    def add_account_entries(self, entries: list[dict[str, Any]]) -> dict:
        """像 add_accounts 但额外接受 session_token 等字段，按 access_token 去重。"""
        deduped: dict[str, dict[str, Any]] = {}
        for raw in entries:
            if not isinstance(raw, dict):
                continue
            access_token = str(raw.get("access_token") or "").strip()
            if not access_token:
                continue
            normalized_entry: dict[str, Any] = {"access_token": access_token}
            session_token = raw.get("session_token")
            if isinstance(session_token, str) and session_token.strip():
                normalized_entry["session_token"] = session_token.strip()
            deduped[access_token] = normalized_entry

        if not deduped:
            return {"added": 0, "skipped": 0, "items": self.list_accounts()}

        with self._lock:
            added = 0
            skipped = 0
            for access_token, entry in deduped.items():
                current = self._accounts.get(access_token)
                if current is None:
                    added += 1
                    current = {}
                else:
                    skipped += 1
                merged: dict[str, Any] = {
                    **current,
                    "access_token": access_token,
                    "type": str(current.get("type") or "free"),
                }
                if "session_token" in entry:
                    # 新提供的 session_token 覆盖旧值；显式传空串可清除
                    merged["session_token"] = entry["session_token"]
                    merged["last_renewal_error"] = None
                account = self._normalize_account(merged)
                if account is not None:
                    self._accounts[access_token] = account
            self._save_accounts()
            items = [dict(item) for item in self._accounts.values()]
            log_service.add(LOG_TYPE_ACCOUNT, f"新增 {added} 个账号，跳过 {skipped} 个",
                            {"added": added, "skipped": skipped})
        return {"added": added, "skipped": skipped, "items": items}

    def delete_accounts(self, tokens: list[str]) -> dict:
        target_set = set(token for token in tokens if token)
        if not target_set:
            return {"removed": 0, "items": self.list_accounts()}
        with self._lock:
            removed = sum(self._accounts.pop(token, None) is not None for token in target_set)
            for token in target_set:
                self._image_inflight.pop(token, None)
            if removed:
                if self._accounts:
                    self._index %= len(self._accounts)
                else:
                    self._index = 0
                self._save_accounts()
                log_service.add(LOG_TYPE_ACCOUNT, f"删除 {removed} 个账号", {"removed": removed})
            items = [dict(item) for item in self._accounts.values()]
        return {"removed": removed, "items": items}

    def update_account(self, access_token: str, updates: dict) -> dict | None:
        if not access_token:
            return None
        with self._lock:
            current = self._accounts.get(access_token)
            if current is None:
                return None
            account = self._normalize_account({**current, **updates, "access_token": access_token})
            if account is None:
                return None
            if account.get("status") == "限流" and config.auto_remove_rate_limited_accounts:
                self._accounts.pop(access_token, None)
                self._save_accounts()
                log_service.add(LOG_TYPE_ACCOUNT, "自动移除限流账号", {"token": anonymize_token(access_token)})
                return None
            self._accounts[access_token] = account
            self._save_accounts()
            log_service.add(LOG_TYPE_ACCOUNT, "更新账号",
                            {"token": anonymize_token(access_token), "status": account.get("status")})
            return dict(account)
        return None

    def mark_image_result(self, access_token: str, success: bool) -> dict | None:
        if not access_token:
            return None
        self.release_image_slot(access_token)
        with self._lock:
            current = self._accounts.get(access_token)
            if current is None:
                return None
            next_item = dict(current)
            next_item["last_used_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            image_quota_unknown = bool(next_item.get("image_quota_unknown"))
            if success:
                next_item["success"] = int(next_item.get("success") or 0) + 1
                if not image_quota_unknown:
                    next_item["quota"] = max(0, int(next_item.get("quota") or 0) - 1)
                if not image_quota_unknown and next_item["quota"] == 0:
                    next_item["status"] = "限流"
                    next_item["restore_at"] = next_item.get("restore_at") or None
                elif next_item.get("status") == "限流":
                    next_item["status"] = "正常"
            else:
                next_item["fail"] = int(next_item.get("fail") or 0) + 1
            account = self._normalize_account(next_item)
            if account is None:
                return None
            if account.get("status") == "限流" and config.auto_remove_rate_limited_accounts:
                self._accounts.pop(access_token, None)
                self._save_accounts()
                log_service.add(LOG_TYPE_ACCOUNT, "自动移除限流账号", {"token": anonymize_token(access_token)})
                return None
            self._accounts[access_token] = account
            self._save_accounts()
            return dict(account)
        return None

    def _rekey_account(self, old_token: str, new_token: str) -> bool:
        """把账号字典从 old_token 的 key 迁到 new_token，包含 _image_inflight。

        必须在已经持有 self._lock 的情况下调用，因为本类用的是非可重入 Lock。
        """
        if not old_token or not new_token or old_token == new_token:
            return False
        existing = self._accounts.pop(old_token, None)
        if existing is None:
            return False
        renewed = dict(existing)
        renewed["access_token"] = new_token
        normalized = self._normalize_account(renewed)
        if normalized is None:
            self._accounts[old_token] = existing
            return False
        self._accounts[new_token] = normalized
        inflight = self._image_inflight.pop(old_token, None)
        if inflight is not None:
            self._image_inflight[new_token] = inflight
        return True

    def _try_renew_via_session(self, access_token: str, event: str) -> str:
        """用账号绑定的 session_token 续期一个新 access_token。

        返回新的 access_token；若该账号没绑 session_token、续期失败或返回空，
        都返回空字符串（调用方应回退到 remove_invalid_token 旧逻辑）。
        失败原因会写到账号的 last_renewal_error 字段，方便管理员排查。
        """
        if not access_token:
            return ""
        with self._lock:
            account = self._accounts.get(access_token)
            session_token = str((account or {}).get("session_token") or "").strip() if account else ""
        if not session_token:
            return ""

        new_token = ""
        error_message = ""
        try:
            from services.openai_backend_api import OpenAIBackendAPI
            new_token = OpenAIBackendAPI.fetch_session_access_token(session_token) or ""
        except Exception as exc:
            error_message = str(exc) or exc.__class__.__name__

        if not new_token:
            log_payload: dict[str, Any] = {
                "source": event,
                "token": anonymize_token(access_token),
            }
            if error_message:
                log_payload["error"] = error_message
            log_service.add(LOG_TYPE_ACCOUNT, "session 续期失败", log_payload)
            with self._lock:
                current = self._accounts.get(access_token)
                if current is not None:
                    updated = self._normalize_account({
                        **current,
                        "last_renewal_error": error_message or "session expired",
                    })
                    if updated is not None:
                        self._accounts[access_token] = updated
                        self._save_accounts()
            return ""

        renewed_at_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            existing = self._accounts.get(access_token)
            if existing is None:
                return ""
            if new_token != access_token and new_token in self._accounts:
                # 罕见但要兜底：服务端直接给了一个池子里已有的 AT，不能 rekey 覆盖
                log_service.add(
                    LOG_TYPE_ACCOUNT,
                    "session 续期返回了已存在的 token",
                    {"source": event, "old": anonymize_token(access_token), "new": anonymize_token(new_token)},
                )
                return ""
            patched = dict(existing)
            patched["session_renewed_at"] = renewed_at_iso
            patched["last_renewal_error"] = None
            patched["status"] = "正常"
            self._accounts[access_token] = patched
            if new_token != access_token:
                rekeyed = self._rekey_account(access_token, new_token)
                if not rekeyed:
                    return ""
            self._save_accounts()
        log_service.add(
            LOG_TYPE_ACCOUNT,
            "session 续期成功",
            {
                "source": event,
                "old": anonymize_token(access_token),
                "new": anonymize_token(new_token),
            },
        )
        return new_token

    def fetch_remote_info(self, access_token: str, event: str = "fetch_remote_info") -> dict[str, Any] | None:
        if not access_token:
            raise ValueError("access_token is required")

        from services.openai_backend_api import InvalidAccessTokenError, OpenAIBackendAPI

        try:
            result = OpenAIBackendAPI(access_token).get_user_info()
            return self.update_account(access_token, result)
        except InvalidAccessTokenError:
            new_token = self._try_renew_via_session(access_token, event)
            if not new_token:
                self.remove_invalid_token(access_token, event)
                raise
            try:
                result = OpenAIBackendAPI(new_token).get_user_info()
            except InvalidAccessTokenError:
                # 续期出来的 token 立刻又被 401，直接移除新 token 对应的账号
                self.remove_invalid_token(new_token, event)
                raise
            except Exception:
                # 网络/CF 异常等：保留账号让下次再试
                raise
            return self.update_account(new_token, result)

    def refresh_accounts(self, access_tokens: list[str]) -> dict[str, Any]:
        access_tokens = list(dict.fromkeys(token for token in access_tokens if token))
        if not access_tokens:
            return {"refreshed": 0, "errors": [], "items": self.list_accounts()}

        refreshed = 0
        errors = []
        max_workers = min(10, len(access_tokens))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.fetch_remote_info, token, "refresh_accounts"): token
                for token in access_tokens
            }
            for future in as_completed(futures):
                try:
                    account = future.result()
                except Exception as exc:
                    errors.append({"token": anonymize_token(futures[future]), "error": str(exc)})
                    continue
                if account is not None:
                    refreshed += 1

        return {
            "refreshed": refreshed,
            "errors": errors,
            "items": self.list_accounts(),
        }


account_service = AccountService(config.get_storage_backend())
