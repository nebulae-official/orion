"""Shared cost tracking utilities for Orion services.

Provides a ``CostResult`` dataclass that services embed in event payloads
so that the Pulse CostTracker can record provider costs consistently.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

# ---------------------------------------------------------------------------
# Rate table — cost per unit for known provider/model combos.
# Rates are approximate USD values used when the provider doesn't return
# an explicit cost.  Keys are ``(provider, model)`` tuples; a ``("provider", "*")``
# entry acts as fallback for that provider.
# ---------------------------------------------------------------------------

_RATE_TABLE: dict[tuple[str, str], float] = {
    # OpenAI — per token (blended input/output average)
    ("openai", "gpt-4o"): 0.000005,
    ("openai", "gpt-4o-mini"): 0.0000003,
    ("openai", "*"): 0.00003,
    # Anthropic — per token
    ("anthropic", "claude-sonnet-4-20250514"): 0.000009,
    ("anthropic", "claude-haiku-4-5-20251001"): 0.000002,
    ("anthropic", "*"): 0.00001,
    # Fal.ai — per image
    ("fal_ai", "fal-ai/flux/schnell"): 0.003,
    ("fal_ai", "*"): 0.02,
    # ElevenLabs — per character
    ("elevenlabs", "*"): 0.000015,
    # ComfyUI — local, zero external cost
    ("comfyui", "*"): 0.0,
    # Fish Speech — local, zero external cost
    ("fish_speech", "*"): 0.0,
    # Ollama — local, zero external cost
    ("ollama", "*"): 0.0,
}


def _lookup_rate(provider: str, model: str) -> float:
    """Return the per-unit rate for a provider/model pair."""
    key = (provider.lower(), model.lower()) if model else (provider.lower(), "*")
    rate = _RATE_TABLE.get(key)
    if rate is not None:
        return rate
    # Fallback to wildcard for the provider
    return _RATE_TABLE.get((provider.lower(), "*"), 0.0)


@dataclass(frozen=True, slots=True)
class CostResult:
    """Immutable cost record that services attach to event payloads.

    Attributes:
        provider: Provider name (e.g. ``"openai"``, ``"fal_ai"``).
        model: Model identifier (e.g. ``"gpt-4o"``).
        input_tokens: Number of input tokens (LLM) or input units.
        output_tokens: Number of output tokens (LLM) or output units.
        estimated_cost_usd: Pre-calculated cost in USD.
        currency: ISO currency code (default ``"USD"``).
        category: Cost category matching Pulse's ``CostCategory`` enum.
    """

    provider: str
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0
    currency: str = "USD"
    category: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict suitable for event payloads."""
        return asdict(self)

    @classmethod
    def estimate(
        cls,
        *,
        provider: str,
        model: str = "",
        input_tokens: int = 0,
        output_tokens: int = 0,
        category: str = "",
    ) -> CostResult:
        """Build a ``CostResult`` by looking up rates from the internal table.

        The estimated cost is ``(input_tokens + output_tokens) * rate``.
        """
        rate = _lookup_rate(provider, model)
        total_tokens = input_tokens + output_tokens
        estimated = round(total_tokens * rate, 8)
        return cls(
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated,
            currency="USD",
            category=category,
        )

    @classmethod
    def fixed(
        cls,
        *,
        provider: str,
        model: str = "",
        units: int = 1,
        category: str = "",
    ) -> CostResult:
        """Build a ``CostResult`` for fixed-price operations (e.g. per-image).

        Uses the rate table with *units* as the multiplier.
        """
        rate = _lookup_rate(provider, model)
        estimated = round(units * rate, 8)
        return cls(
            provider=provider,
            model=model,
            input_tokens=units,
            output_tokens=0,
            estimated_cost_usd=estimated,
            currency="USD",
            category=category,
        )
