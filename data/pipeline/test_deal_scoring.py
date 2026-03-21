"""
Deal Scoring Model Tests
========================
Data quality checks and model validation for deal_scoring_model.py.
Run: pytest data/pipeline/test_deal_scoring.py -v
"""

import pandas as pd
import numpy as np
import json
import os
import sys
import pytest

# Add pipeline directory to path
sys.path.insert(0, os.path.dirname(__file__))
from deal_scoring_model import (
    generate_deal_data,
    engineer_features,
    train_model,
    score_pipeline,
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public")


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def raw_deals():
    """Generate deal data once for all tests."""
    np.random.seed(42)
    return generate_deal_data(n=800)


@pytest.fixture(scope="session")
def engineered(raw_deals):
    """Engineer features once for all tests."""
    return engineer_features(raw_deals)


@pytest.fixture(scope="session")
def trained(engineered):
    """Train model once for all tests."""
    df_encoded, feature_cols = engineered
    return train_model(df_encoded, feature_cols)


@pytest.fixture(scope="session")
def scored(trained):
    """Score open pipeline once for all tests."""
    model, metrics, feature_cols = trained
    return score_pipeline(model, feature_cols)


# ─── Data Generation Tests ────────────────────────────────────────────────────

class TestDataGeneration:
    """Verify generate_deal_data() produces valid training data."""

    def test_row_count(self, raw_deals):
        assert len(raw_deals) == 800, f"Expected 800 deals, got {len(raw_deals)}"

    def test_expected_columns(self, raw_deals):
        expected = [
            "deal_id", "rep", "specialty", "source", "practice_size", "acv",
            "days_in_current_stage", "total_days_in_pipeline", "num_activities",
            "days_since_last_activity", "has_champion", "competitor_mentioned",
            "legal_review_days", "won",
        ]
        for col in expected:
            assert col in raw_deals.columns, f"Missing column: {col}"

    def test_acv_within_bounds(self, raw_deals):
        assert raw_deals["acv"].min() >= 5000, "ACV below minimum bound of 5,000"
        assert raw_deals["acv"].max() <= 250000, "ACV above maximum bound of 250,000"

    def test_binary_fields(self, raw_deals):
        for col in ["has_champion", "competitor_mentioned", "won"]:
            values = set(raw_deals[col].unique())
            assert values <= {0, 1}, f"{col} has non-binary values: {values}"

    def test_no_nulls(self, raw_deals):
        nulls = raw_deals.isnull().sum().sum()
        assert nulls == 0, f"Found {nulls} null values in deal data"

    def test_win_rate_sanity(self, raw_deals):
        win_rate = raw_deals["won"].mean()
        assert 0.05 < win_rate < 0.50, (
            f"Win rate {win_rate:.1%} outside expected 5-50% range"
        )


# ─── Feature Engineering Tests ────────────────────────────────────────────────

class TestFeatureEngineering:
    """Verify engineer_features() creates correct derived features."""

    def test_derived_features_exist(self, engineered):
        df_encoded, _ = engineered
        for feat in [
            "activity_velocity", "stage_stall_flag", "engagement_recency_flag",
            "legal_stall_flag", "large_deal_flag", "rep_skill_index",
        ]:
            assert feat in df_encoded.columns, f"Missing derived feature: {feat}"

    def test_stage_stall_flag(self, engineered, raw_deals):
        df_encoded, _ = engineered
        expected = (raw_deals["days_in_current_stage"] > 20).astype(int)
        pd.testing.assert_series_equal(
            df_encoded["stage_stall_flag"].reset_index(drop=True),
            expected.reset_index(drop=True),
            check_names=False,
        )

    def test_engagement_recency_flag(self, engineered, raw_deals):
        df_encoded, _ = engineered
        expected = (raw_deals["days_since_last_activity"] > 14).astype(int)
        pd.testing.assert_series_equal(
            df_encoded["engagement_recency_flag"].reset_index(drop=True),
            expected.reset_index(drop=True),
            check_names=False,
        )

    def test_legal_stall_flag(self, engineered, raw_deals):
        df_encoded, _ = engineered
        expected = (raw_deals["legal_review_days"] > 10).astype(int)
        pd.testing.assert_series_equal(
            df_encoded["legal_stall_flag"].reset_index(drop=True),
            expected.reset_index(drop=True),
            check_names=False,
        )

    def test_large_deal_flag(self, engineered, raw_deals):
        df_encoded, _ = engineered
        expected = (raw_deals["acv"] > 100000).astype(int)
        pd.testing.assert_series_equal(
            df_encoded["large_deal_flag"].reset_index(drop=True),
            expected.reset_index(drop=True),
            check_names=False,
        )

    def test_rep_skill_index_range(self, engineered):
        df_encoded, _ = engineered
        assert df_encoded["rep_skill_index"].min() >= 0, "Rep skill index below 0"
        assert df_encoded["rep_skill_index"].max() <= 5, "Rep skill index above 5"
        assert df_encoded["rep_skill_index"].nunique() == 6, (
            "Expected 6 unique rep skill values (one per rep)"
        )


# ─── Model Training Tests ────────────────────────────────────────────────────

class TestModelTraining:
    """Verify train_model() produces a valid model and metrics."""

    def test_model_has_required_keys(self, trained):
        model, _, _ = trained
        for key in ["weights", "means", "stds"]:
            assert key in model, f"Model missing key: {key}"

    def test_metrics_has_required_keys(self, trained):
        _, metrics, _ = trained
        required = [
            "accuracy", "precision", "recall", "f1_score", "auc_roc",
            "optimal_threshold", "n_train", "n_test", "model_type",
            "confusion_matrix", "top_features",
        ]
        for key in required:
            assert key in metrics, f"Metrics missing key: {key}"

    def test_auc_above_random(self, trained):
        _, metrics, _ = trained
        assert metrics["auc_roc"] > 0.5, (
            f"AUC {metrics['auc_roc']} should be above 0.5 (random baseline)"
        )

    def test_metrics_in_valid_range(self, trained):
        _, metrics, _ = trained
        for key in ["accuracy", "precision", "recall", "f1_score", "auc_roc"]:
            assert 0 <= metrics[key] <= 1, f"{key}={metrics[key]} outside [0, 1]"

    def test_train_test_split(self, trained):
        _, metrics, _ = trained
        assert metrics["n_train"] == 640, f"Expected 640 train, got {metrics['n_train']}"
        assert metrics["n_test"] == 160, f"Expected 160 test, got {metrics['n_test']}"

    def test_confusion_matrix_sums_to_test_size(self, trained):
        _, metrics, _ = trained
        cm = metrics["confusion_matrix"]
        total = cm["tp"] + cm["fp"] + cm["fn"] + cm["tn"]
        assert total == metrics["n_test"], (
            f"Confusion matrix sums to {total}, expected {metrics['n_test']}"
        )


# ─── Scoring Tests ────────────────────────────────────────────────────────────

class TestScoring:
    """Verify score_pipeline() produces valid scored output."""

    def test_deal_count(self, scored):
        assert len(scored) == 45, f"Expected 45 scored deals, got {len(scored)}"

    def test_health_score_range(self, scored):
        assert scored["deal_health_score"].min() >= 0, "Health score below 0"
        assert scored["deal_health_score"].max() <= 100, "Health score above 100"

    def test_win_probability_range(self, scored):
        assert scored["win_probability"].min() >= 0, "Win probability below 0"
        assert scored["win_probability"].max() <= 100, "Win probability above 100"

    def test_all_risk_tiers_present(self, scored):
        expected = {"At Risk", "Needs Attention", "On Track", "Strong"}
        actual = set(scored["risk_tier"].unique())
        assert expected == actual, f"Missing tiers: {expected - actual}"

    def test_risk_tier_thresholds(self, scored):
        for _, row in scored.iterrows():
            score = row["deal_health_score"]
            tier = row["risk_tier"]
            if tier == "At Risk":
                assert score <= 30, f"At Risk deal has score {score} (expected ≤30)"
            elif tier == "Needs Attention":
                assert 30 < score <= 50, f"Needs Attention deal has score {score}"
            elif tier == "On Track":
                assert 50 < score <= 70, f"On Track deal has score {score}"
            elif tier == "Strong":
                assert score > 70, f"Strong deal has score {score} (expected >70)"

    def test_every_deal_has_recommendations(self, scored):
        for _, row in scored.iterrows():
            recs = row["recommendations"]
            assert len(recs) >= 1, f"Deal {row['deal_id']} has no recommendations"

    def test_recommendations_are_strings(self, scored):
        for _, row in scored.iterrows():
            for rec in row["recommendations"]:
                assert isinstance(rec, str) and len(rec) > 0, (
                    f"Deal {row['deal_id']} has invalid recommendation: {rec!r}"
                )


# ─── Recommendation Logic Tests ──────────────────────────────────────────────

class TestRecommendationLogic:
    """Verify prescriptive recommendations match their trigger conditions."""

    def test_stalled_deals_get_stall_rec(self, scored):
        stalled = scored[scored["days_in_current_stage"] > 20]
        if len(stalled) > 0:
            for _, row in stalled.iterrows():
                recs = " ".join(row["recommendations"])
                assert "stalled" in recs.lower() or "escalate" in recs.lower(), (
                    f"Stalled deal {row['deal_id']} missing stall recommendation"
                )

    def test_disengaged_deals_get_engagement_rec(self, scored):
        disengaged = scored[scored["days_since_last_activity"] > 14]
        if len(disengaged) > 0:
            for _, row in disengaged.iterrows():
                recs = " ".join(row["recommendations"])
                assert "activity" in recs.lower() or "touchpoint" in recs.lower(), (
                    f"Disengaged deal {row['deal_id']} missing engagement recommendation"
                )

    def test_no_champion_deals_get_champion_rec(self, scored):
        no_champ = scored[scored["has_champion"] == 0]
        if len(no_champ) > 0:
            for _, row in no_champ.iterrows():
                recs = " ".join(row["recommendations"])
                assert "champion" in recs.lower(), (
                    f"Deal {row['deal_id']} without champion missing champion recommendation"
                )

    def test_competitor_deals_get_competitive_rec(self, scored):
        competitor = scored[scored["competitor_mentioned"] == 1]
        if len(competitor) > 0:
            for _, row in competitor.iterrows():
                recs = " ".join(row["recommendations"])
                assert "competitor" in recs.lower() or "competitive" in recs.lower(), (
                    f"Deal {row['deal_id']} with competitor missing competitive recommendation"
                )

    def test_healthy_deals_get_maintain_rec(self, scored):
        """Deals with no risk flags should get 'maintain cadence' recommendation."""
        healthy = scored[
            (scored["days_in_current_stage"] <= 20) &
            (scored["days_since_last_activity"] <= 14) &
            (scored["has_champion"] == 1) &
            (scored["competitor_mentioned"] == 0) &
            (scored["legal_review_days"] <= 10) &
            ~((scored["acv"] > 100000) & (scored["deal_health_score"] < 50))
        ]
        if len(healthy) > 0:
            for _, row in healthy.iterrows():
                recs = " ".join(row["recommendations"])
                assert "maintain" in recs.lower() or "healthy" in recs.lower(), (
                    f"Healthy deal {row['deal_id']} missing maintain-cadence recommendation"
                )


# ─── Output File Tests ────────────────────────────────────────────────────────

class TestOutputFiles:
    """Verify output files on disk are valid."""

    def test_deal_scores_json_exists(self):
        path = os.path.join(PUBLIC_DIR, "deal_scores.json")
        assert os.path.exists(path), "public/deal_scores.json should exist"

    def test_deal_scores_json_valid(self):
        path = os.path.join(PUBLIC_DIR, "deal_scores.json")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, list), "deal_scores.json should be a list"
        assert len(data) == 45, f"Expected 45 deals, got {len(data)}"
        expected_keys = [
            "deal_id", "account_name", "rep", "specialty", "source",
            "practice_size", "stage", "acv", "deal_health_score",
            "win_probability", "risk_tier", "recommendations",
        ]
        for key in expected_keys:
            assert key in data[0], f"deal_scores.json record missing key: {key}"

    def test_model_metrics_json_exists(self):
        path = os.path.join(OUTPUT_DIR, "model_metrics.json")
        assert os.path.exists(path), "data/output/model_metrics.json should exist"

    def test_model_metrics_json_valid(self):
        path = os.path.join(OUTPUT_DIR, "model_metrics.json")
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, dict), "model_metrics.json should be a dict"
        required = [
            "accuracy", "precision", "recall", "f1_score", "auc_roc",
            "model_type", "confusion_matrix", "top_features",
            "pipeline", "features_used", "scoring_output",
        ]
        for field in required:
            assert field in data, f"model_metrics.json missing field: {field}"
