"""Tests for orion_common.cost — CostResult dataclass and rate lookup."""

from __future__ import annotations

import pytest
from orion_common.cost import CostResult, _lookup_rate


class TestCostResultDefaults:
    """test_cost_result_defaults — basic construction with defaults."""

    def test_only_provider_required(self) -> None:
        result = CostResult(provider="openai")
        assert result.provider == "openai"
        assert result.model == ""
        assert result.input_tokens == 0
        assert result.output_tokens == 0
        assert result.estimated_cost_usd == 0.0
        assert result.currency == "USD"
        assert result.category == ""


class TestCostResultIsFrozen:
    """test_cost_result_is_frozen — verify immutability."""

    def test_cannot_set_attribute(self) -> None:
        result = CostResult(provider="openai")
        with pytest.raises(AttributeError):
            result.provider = "anthropic"  # type: ignore[misc]

    def test_cannot_set_cost(self) -> None:
        result = CostResult(provider="openai")
        with pytest.raises(AttributeError):
            result.estimated_cost_usd = 999.0  # type: ignore[misc]


class TestToDictRoundTrip:
    """test_to_dict_round_trip — serialization works."""

    def test_to_dict_returns_all_fields(self) -> None:
        result = CostResult(
            provider="openai",
            model="gpt-4o",
            input_tokens=100,
            output_tokens=50,
            estimated_cost_usd=0.00075,
            currency="USD",
            category="llm",
        )
        d = result.to_dict()
        assert d == {
            "provider": "openai",
            "model": "gpt-4o",
            "input_tokens": 100,
            "output_tokens": 50,
            "estimated_cost_usd": 0.00075,
            "currency": "USD",
            "category": "llm",
        }

    def test_round_trip_via_constructor(self) -> None:
        original = CostResult(
            provider="anthropic", model="claude-sonnet-4-20250514", category="llm"
        )
        rebuilt = CostResult(**original.to_dict())
        assert rebuilt == original


class TestEstimateOpenaiGpt4o:
    """test_estimate_openai_gpt4o — known rate lookup with tokens."""

    def test_estimate_cost(self) -> None:
        result = CostResult.estimate(
            provider="openai",
            model="gpt-4o",
            input_tokens=1000,
            output_tokens=500,
        )
        # rate = 0.000005 per token, 1500 tokens total
        expected = round(1500 * 0.000005, 8)
        assert result.estimated_cost_usd == expected
        assert result.provider == "openai"
        assert result.model == "gpt-4o"
        assert result.input_tokens == 1000
        assert result.output_tokens == 500


class TestEstimateAnthropicClaude:
    """test_estimate_anthropic_claude — known rate lookup."""

    def test_claude_sonnet(self) -> None:
        result = CostResult.estimate(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            input_tokens=2000,
            output_tokens=1000,
        )
        expected = round(3000 * 0.000009, 8)
        assert result.estimated_cost_usd == expected

    def test_claude_haiku(self) -> None:
        result = CostResult.estimate(
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            input_tokens=500,
            output_tokens=200,
        )
        expected = round(700 * 0.000002, 8)
        assert result.estimated_cost_usd == expected


class TestEstimateUnknownModelUsesWildcard:
    """test_estimate_unknown_model_uses_wildcard — fallback to provider wildcard."""

    def test_openai_unknown_model(self) -> None:
        result = CostResult.estimate(
            provider="openai",
            model="gpt-5-turbo",
            input_tokens=100,
            output_tokens=100,
        )
        # Falls back to ("openai", "*") = 0.00003
        expected = round(200 * 0.00003, 8)
        assert result.estimated_cost_usd == expected

    def test_anthropic_unknown_model(self) -> None:
        result = CostResult.estimate(
            provider="anthropic",
            model="claude-opus-next",
            input_tokens=100,
            output_tokens=0,
        )
        # Falls back to ("anthropic", "*") = 0.00001
        expected = round(100 * 0.00001, 8)
        assert result.estimated_cost_usd == expected


class TestEstimateUnknownProviderReturnsZero:
    """test_estimate_unknown_provider_returns_zero — completely unknown provider."""

    def test_unknown_provider(self) -> None:
        result = CostResult.estimate(
            provider="totally_unknown",
            model="some-model",
            input_tokens=5000,
            output_tokens=5000,
        )
        assert result.estimated_cost_usd == 0.0

    def test_unknown_provider_no_model(self) -> None:
        result = CostResult.estimate(provider="mystery_provider")
        assert result.estimated_cost_usd == 0.0


class TestFixedFalAiImage:
    """test_fixed_fal_ai_image — fixed-price operations."""

    def test_single_image(self) -> None:
        result = CostResult.fixed(
            provider="fal_ai",
            model="fal-ai/flux/schnell",
            units=1,
            category="image",
        )
        assert result.estimated_cost_usd == 0.003
        assert result.input_tokens == 1  # units stored as input_tokens
        assert result.output_tokens == 0

    def test_multiple_images(self) -> None:
        result = CostResult.fixed(
            provider="fal_ai",
            model="fal-ai/flux/schnell",
            units=4,
            category="image",
        )
        expected = round(4 * 0.003, 8)
        assert result.estimated_cost_usd == expected

    def test_fal_ai_wildcard(self) -> None:
        result = CostResult.fixed(
            provider="fal_ai",
            model="fal-ai/some-new-model",
            units=1,
        )
        # Falls back to ("fal_ai", "*") = 0.02
        assert result.estimated_cost_usd == 0.02


class TestFixedLocalProviderZeroCost:
    """test_fixed_local_provider_zero_cost — comfyui/ollama return $0."""

    @pytest.mark.parametrize("provider", ["comfyui", "ollama", "fish_speech"])
    def test_local_providers_are_free(self, provider: str) -> None:
        result = CostResult.fixed(provider=provider, model="any-model", units=10)
        assert result.estimated_cost_usd == 0.0

    @pytest.mark.parametrize("provider", ["comfyui", "ollama", "fish_speech"])
    def test_local_providers_estimate_free(self, provider: str) -> None:
        result = CostResult.estimate(
            provider=provider,
            model="any-model",
            input_tokens=10000,
            output_tokens=10000,
        )
        assert result.estimated_cost_usd == 0.0


class TestEstimateCategoryPreserved:
    """test_estimate_category_preserved — category field is set."""

    def test_estimate_preserves_category(self) -> None:
        result = CostResult.estimate(
            provider="openai",
            model="gpt-4o",
            input_tokens=100,
            category="llm",
        )
        assert result.category == "llm"

    def test_fixed_preserves_category(self) -> None:
        result = CostResult.fixed(
            provider="fal_ai",
            model="fal-ai/flux/schnell",
            category="image",
        )
        assert result.category == "image"

    def test_category_in_to_dict(self) -> None:
        result = CostResult.estimate(
            provider="elevenlabs",
            input_tokens=500,
            category="tts",
        )
        assert result.to_dict()["category"] == "tts"


class TestLookupRateCaseInsensitive:
    """test_lookup_rate_case_insensitive — provider/model case doesn't matter."""

    def test_provider_uppercase(self) -> None:
        assert _lookup_rate("OPENAI", "gpt-4o") == 0.000005

    def test_model_uppercase(self) -> None:
        assert _lookup_rate("openai", "GPT-4O") == 0.000005

    def test_mixed_case(self) -> None:
        assert _lookup_rate("Anthropic", "Claude-Sonnet-4-20250514") == 0.000009

    def test_wildcard_fallback_case_insensitive(self) -> None:
        assert _lookup_rate("ELEVENLABS", "anything") == 0.000015

    def test_unknown_provider_case_insensitive(self) -> None:
        assert _lookup_rate("UNKNOWN", "whatever") == 0.0
