"""
Manages Anthropic beta Skills (skills-2025-10-02).

Uploads SKILL.md files to the Anthropic API once, caches the resulting skill_ids
locally so they survive restarts. Skills are used by the policy engine to keep
classifier and evaluator prompts server-side — reducing per-call token usage
and drift.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from anthropic import AsyncAnthropic

_SKILLS_DIR = Path(__file__).parent.parent / "skills"
_CACHE_FILE = _SKILLS_DIR / "skill_ids.json"

_SKILL_TITLES = {
    # policy_classifier removed — domain is declared at component registration,
    # not inferred per-request from content.
    "policy_screener":  "Policy Rule Screener",   # Layer 2: relevance pre-filter
    "policy_evaluator": "Policy Rule Evaluator",  # Layer 3: compliance evaluation
}


class SkillManager:
    def __init__(self) -> None:
        self._ids: dict[str, str] = {}
        self._initialized = False

    async def initialize(self) -> None:
        if self._initialized:
            return

        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            print("[SKILL-MANAGER] No API key — skills disabled, policy engine will use fallback evaluation")
            self._initialized = True
            return

        self._load_cache()
        client = AsyncAnthropic(api_key=api_key)

        for name, title in _SKILL_TITLES.items():
            if name not in self._ids:
                sid = await self._upload(client, name, title)
                if sid:
                    self._ids[name] = sid

        self._save_cache()
        self._initialized = True
        print(f"[SKILL-MANAGER] Ready — active skills: {list(self._ids.keys())}")

    def _load_cache(self) -> None:
        if _CACHE_FILE.exists():
            try:
                self._ids = json.loads(_CACHE_FILE.read_text())
                print(f"[SKILL-MANAGER] Loaded cached skill IDs: {self._ids}")
            except Exception as e:
                print(f"[SKILL-MANAGER] Cache read error: {e}")

    def _save_cache(self) -> None:
        try:
            _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            _CACHE_FILE.write_text(json.dumps(self._ids, indent=2))
        except Exception as e:
            print(f"[SKILL-MANAGER] Cache write error: {e}")

    async def _upload(self, client: AsyncAnthropic, name: str, title: str) -> Optional[str]:
        md_path = _SKILLS_DIR / name / "SKILL.md"
        if not md_path.exists():
            print(f"[SKILL-MANAGER] SKILL.md not found: {md_path}")
            return None
        try:
            content = md_path.read_bytes()
            result = await client.beta.skills.create(
                display_title=title,
                files=[("SKILL.md", content, "text/markdown")],
                betas=["skills-2025-10-02"],
            )
            print(f"[SKILL-MANAGER] Uploaded '{name}' → {result.skill_id}")
            return result.skill_id
        except Exception as e:
            print(f"[SKILL-MANAGER] Upload failed for '{name}': {e}")
            return None

    def get(self, name: str) -> Optional[str]:
        """Return the skill_id for the given skill name, or None if unavailable."""
        return self._ids.get(name)

    @property
    def available(self) -> bool:
        return bool(self._ids)

    def invalidate(self, name: str) -> None:
        """Remove a cached skill_id (use when a skill needs re-upload after SKILL.md changes)."""
        if name in self._ids:
            del self._ids[name]
            self._save_cache()
            print(f"[SKILL-MANAGER] Invalidated cached ID for '{name}'")


skill_manager = SkillManager()
