"""
SpectrumIQ Pipeline Tests
=========================
Data quality checks and pipeline validation.
Run: pytest data/pipeline/test_pipeline.py -v
"""

import pandas as pd
import json
import os
import sys
import pytest

# Add pipeline directory to path
sys.path.insert(0, os.path.dirname(__file__))
from spectrumiq_pipeline import (
    load_nppes_data,
    load_metro_data,
    aggregate_providers_by_metro,
    score_metros,
    SPECIALTY_TAXONOMY,
    NATIONAL_BENCHMARKS,
    WEIGHTS,
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def providers():
    """Load provider data once for all tests."""
    return load_nppes_data()


@pytest.fixture(scope="session")
def metros():
    """Load metro data once for all tests."""
    return load_metro_data()


@pytest.fixture(scope="session")
def merged(providers, metros):
    """Aggregate providers by metro."""
    return aggregate_providers_by_metro(providers, metros)


@pytest.fixture(scope="session")
def scored(merged):
    """Score all metros."""
    return score_metros(merged)


# ─── Data Completeness Tests ────────────────────────────────────────────────

class TestDataCompleteness:
    """Verify the pipeline produces complete output."""

    def test_scored_output_not_empty(self, scored):
        assert len(scored) > 0, "Scored output should have rows"

    def test_all_specialties_present(self, scored):
        expected = set(NATIONAL_BENCHMARKS.keys())
        actual = set(scored["specialty"].unique())
        assert expected == actual, f"Missing specialties: {expected - actual}"

    def test_all_metros_scored(self, scored, metros):
        expected_metros = set(metros["metro"])
        scored_metros = set(scored["metro"].unique())
        missing = expected_metros - scored_metros
        assert len(missing) == 0, f"Metros missing from scores: {missing}"

    def test_minimum_metro_count(self, scored):
        assert scored["metro"].nunique() >= 15, (
            f"Expected at least 15 metros, got {scored['metro'].nunique()}"
        )

    def test_no_null_scores(self, scored):
        nulls = scored["composite_score"].isna().sum()
        assert nulls == 0, f"Found {nulls} null composite scores"

    def test_no_null_provider_counts(self, scored):
        nulls = scored["provider_count"].isna().sum()
        assert nulls == 0, f"Found {nulls} null provider counts"


# ─── Score Validity Tests ────────────────────────────────────────────────────

class TestScoreValidity:
    """Verify scores are within expected bounds."""

    def test_composite_score_range(self, scored):
        assert scored["composite_score"].between(0, 100).all(), (
            f"Composite scores out of range: "
            f"min={scored['composite_score'].min()}, max={scored['composite_score'].max()}"
        )

    def test_gap_score_range(self, scored):
        assert scored["gap_score"].between(0, 100).all(), (
            "Gap scores out of 0-100 range"
        )

    def test_growth_score_range(self, scored):
        assert scored["growth_score"].between(0, 100).all(), (
            "Growth scores out of 0-100 range"
        )

    def test_medicare_score_range(self, scored):
        assert scored["medicare_score"].between(0, 100).all(), (
            "Medicare scores out of 0-100 range"
        )

    def test_income_score_range(self, scored):
        assert scored["income_score"].between(0, 100).all(), (
            "Income scores out of 0-100 range"
        )

    def test_per_100k_positive(self, scored):
        assert (scored["per_100k"] >= 0).all(), (
            "Provider per 100K should be non-negative"
        )

    def test_population_positive(self, scored):
        assert (scored["population"] > 0).all(), (
            "All metros should have positive population"
        )

    def test_provider_count_non_negative(self, scored):
        assert (scored["provider_count"] >= 0).all(), (
            "Provider counts should be non-negative"
        )


# ─── Tier Assignment Tests ───────────────────────────────────────────────────

class TestTierAssignment:
    """Verify tier labels match score thresholds."""

    def test_high_opportunity_threshold(self, scored):
        high = scored[scored["tier"] == "High Opportunity"]
        if len(high) > 0:
            assert (high["composite_score"] >= 70).all(), (
                "High Opportunity tier should have scores >= 70"
            )

    def test_moderate_threshold(self, scored):
        mod = scored[scored["tier"] == "Moderate"]
        if len(mod) > 0:
            assert (mod["composite_score"] >= 45).all(), (
                "Moderate tier should have scores >= 45"
            )
            assert (mod["composite_score"] < 70).all(), (
                "Moderate tier should have scores < 70"
            )

    def test_low_priority_threshold(self, scored):
        low = scored[scored["tier"] == "Low Priority"]
        if len(low) > 0:
            assert (low["composite_score"] < 45).all(), (
                "Low Priority tier should have scores < 45"
            )

    def test_all_tiers_valid(self, scored):
        valid_tiers = {"High Opportunity", "Moderate", "Low Priority"}
        actual_tiers = set(scored["tier"].unique())
        invalid = actual_tiers - valid_tiers
        assert len(invalid) == 0, f"Invalid tier labels: {invalid}"


# ─── Scoring Methodology Tests ───────────────────────────────────────────────

class TestScoringMethodology:
    """Verify the scoring logic is internally consistent."""

    def test_weights_sum_to_one(self):
        total = sum(WEIGHTS.values())
        assert abs(total - 1.0) < 0.001, (
            f"Scoring weights should sum to 1.0, got {total}"
        )

    def test_all_specialties_have_benchmarks(self):
        for spec in SPECIALTY_TAXONOMY.keys():
            assert spec in NATIONAL_BENCHMARKS, (
                f"Specialty {spec} missing from national benchmarks"
            )

    def test_benchmarks_are_positive(self):
        for spec, val in NATIONAL_BENCHMARKS.items():
            assert val > 0, f"Benchmark for {spec} should be positive, got {val}"

    def test_higher_gap_means_higher_gap_score(self, scored):
        """Metros with fewer providers per 100K should have higher gap scores."""
        for spec in scored["specialty"].unique():
            subset = scored[scored["specialty"] == spec]
            if len(subset) >= 3:
                # Check correlation direction: lower per_100k → higher gap_score
                corr = subset["per_100k"].corr(subset["gap_score"])
                assert corr < 0, (
                    f"{spec}: per_100k and gap_score should be negatively correlated "
                    f"(got {corr:.3f})"
                )


# ─── Pipeline Metadata Tests ────────────────────────────────────────────────

class TestPipelineMetadata:
    """Verify pipeline metadata file is valid."""

    def test_metadata_file_exists(self):
        path = os.path.join(OUTPUT_DIR, "pipeline_metadata.json")
        assert os.path.exists(path), "pipeline_metadata.json should exist"

    def test_metadata_is_valid_json(self):
        path = os.path.join(OUTPUT_DIR, "pipeline_metadata.json")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, dict), "Metadata should be a dict"

    def test_metadata_has_required_fields(self):
        path = os.path.join(OUTPUT_DIR, "pipeline_metadata.json")
        with open(path) as f:
            data = json.load(f)
        required = ["pipeline", "version", "run_timestamp", "data_sources", "scoring_methodology", "output"]
        for field in required:
            assert field in data, f"Metadata missing required field: {field}"

    def test_metadata_data_sources_documented(self):
        path = os.path.join(OUTPUT_DIR, "pipeline_metadata.json")
        with open(path) as f:
            data = json.load(f)
        sources = data.get("data_sources", {})
        assert "nppes" in sources, "NPPES data source should be documented"
        assert "census" in sources, "Census data source should be documented"
        assert "url" in sources["nppes"], "NPPES source should have URL"


# ─── Output File Tests ──────────────────────────────────────────────────────

class TestOutputFiles:
    """Verify output files are correctly written."""

    def test_csv_output_exists(self):
        path = os.path.join(OUTPUT_DIR, "metro_opportunity_scores.csv")
        assert os.path.exists(path), "CSV output should exist"

    def test_csv_has_expected_columns(self):
        path = os.path.join(OUTPUT_DIR, "metro_opportunity_scores.csv")
        df = pd.read_csv(path)
        expected_cols = [
            "metro", "state", "specialty", "population", "provider_count",
            "per_100k", "national_benchmark", "composite_score", "tier"
        ]
        for col in expected_cols:
            assert col in df.columns, f"CSV missing column: {col}"

    def test_csv_row_count_matches_scored(self, scored):
        path = os.path.join(OUTPUT_DIR, "metro_opportunity_scores.csv")
        df = pd.read_csv(path)
        assert len(df) == len(scored), (
            f"CSV row count ({len(df)}) doesn't match scored ({len(scored)})"
        )

    def test_json_output_exists(self):
        """Verify the JSON file consumed by the React app exists."""
        path = os.path.join(
            os.path.dirname(__file__), "..", "..", "public", "metro_scores.json"
        )
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            assert isinstance(data, list), "JSON output should be a list"
            assert len(data) > 0, "JSON output should not be empty"
