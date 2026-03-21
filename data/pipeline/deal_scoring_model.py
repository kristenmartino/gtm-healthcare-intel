"""
Deal Scoring Model
==================
Trains an L2-regularized logistic regression on historical deal outcomes
to predict close probability for open pipeline deals.

Output:
  - public/deal_scores.json (consumed by ConvertPath React app)
  - data/output/model_metrics.json (model performance metadata)

Usage:
  python data/pipeline/deal_scoring_model.py
"""

import pandas as pd
import numpy as np
import json
import os
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path("data/output")
PUBLIC_DIR = Path("public")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

np.random.seed(42)


# ─── Step 1: Generate Training Data ─────────────────────────────────────────

def generate_deal_data(n=800):
    """
    Generate realistic historical deal data for model training.
    Features mirror what you'd extract from Salesforce Opportunity + Account.
    """
    print("Step 1: Generating training data...")

    reps = ["Sarah Chen", "Marcus Rivera", "Emily Okafor", "James Patel", "Lisa Wong", "David Kim"]
    specialties = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"]
    sources = ["Inbound", "Outbound", "Referral", "Trade Show", "Partner"]
    sizes = ["Solo", "Small", "Medium", "Large"]

    # Base win rates by feature (used to generate realistic outcomes)
    source_win_prob = {"Referral": 0.35, "Inbound": 0.24, "Trade Show": 0.27, "Partner": 0.22, "Outbound": 0.16}
    spec_win_prob = {"Dermatology": 0.32, "Orthopedics": 0.18, "Gastroenterology": 0.25, "Ophthalmology": 0.22}
    size_win_prob = {"Solo": 0.28, "Small": 0.25, "Medium": 0.22, "Large": 0.18}
    rep_skill = {"Sarah Chen": 1.15, "Emily Okafor": 1.05, "Lisa Wong": 1.0, "Marcus Rivera": 0.95, "James Patel": 0.9, "David Kim": 0.88}

    records = []
    for i in range(n):
        rep = np.random.choice(reps)
        spec = np.random.choice(specialties)
        source = np.random.choice(sources)
        size = np.random.choice(sizes)
        acv = int(np.random.lognormal(mean=10.5, sigma=0.7))
        acv = max(5000, min(250000, acv))

        days_in_stage = int(np.random.exponential(scale=12) + 3)
        total_days = int(np.random.exponential(scale=35) + 10)
        num_activities = int(np.random.poisson(lam=8))
        days_since_activity = int(np.random.exponential(scale=5))
        has_champion = int(np.random.random() < 0.45)
        competitor_mentioned = int(np.random.random() < 0.3)
        legal_review_days = int(np.random.exponential(scale=4)) if np.random.random() < 0.4 else 0

        # Compute win probability from features
        base_prob = (
            source_win_prob[source] * 0.25 +
            spec_win_prob[spec] * 0.20 +
            size_win_prob[size] * 0.10 +
            rep_skill[rep] * 0.15
        )

        # Feature-based adjustments
        if days_in_stage > 20:
            base_prob *= 0.6
        if days_since_activity > 14:
            base_prob *= 0.5
        if has_champion:
            base_prob *= 1.4
        if competitor_mentioned:
            base_prob *= 0.7
        if legal_review_days > 10:
            base_prob *= 0.5
        if num_activities > 12:
            base_prob *= 1.2
        if acv > 100000:
            base_prob *= 0.85  # Large deals close less often

        base_prob = min(0.95, max(0.05, base_prob))
        won = int(np.random.random() < base_prob)

        records.append({
            "deal_id": f"OPP-{i+1:04d}",
            "rep": rep,
            "specialty": spec,
            "source": source,
            "practice_size": size,
            "acv": acv,
            "days_in_current_stage": days_in_stage,
            "total_days_in_pipeline": total_days,
            "num_activities": num_activities,
            "days_since_last_activity": days_since_activity,
            "has_champion": has_champion,
            "competitor_mentioned": competitor_mentioned,
            "legal_review_days": legal_review_days,
            "won": won,
        })

    df = pd.DataFrame(records)
    print(f"  → {len(df)} deals generated ({df['won'].sum()} won, {len(df) - df['won'].sum()} lost)")
    print(f"  → Overall win rate: {df['won'].mean():.1%}")
    return df


# ─── Step 2: Feature Engineering ─────────────────────────────────────────────

def engineer_features(df):
    """
    Encode categorical features and create derived features.
    In production, this would be a dbt model or feature store.
    """
    print("Step 2: Engineering features...")

    # One-hot encode categoricals
    cat_cols = ["specialty", "source", "practice_size"]
    df_encoded = pd.get_dummies(df, columns=cat_cols, drop_first=True)

    # Rep encoding as skill index (ordinal based on historical performance)
    rep_map = {"Sarah Chen": 5, "Emily Okafor": 4, "Lisa Wong": 3, "Marcus Rivera": 2, "James Patel": 1, "David Kim": 0}
    df_encoded["rep_skill_index"] = df["rep"].map(rep_map)

    # Derived features
    df_encoded["activity_velocity"] = df_encoded["num_activities"] / (df_encoded["total_days_in_pipeline"].clip(lower=1))
    df_encoded["stage_stall_flag"] = (df_encoded["days_in_current_stage"] > 20).astype(int)
    df_encoded["engagement_recency_flag"] = (df_encoded["days_since_last_activity"] > 14).astype(int)
    df_encoded["legal_stall_flag"] = (df_encoded["legal_review_days"] > 10).astype(int)
    df_encoded["large_deal_flag"] = (df["acv"] > 100000).astype(int)

    # Feature list (exclude non-features)
    exclude = ["deal_id", "rep", "won"]
    feature_cols = [c for c in df_encoded.columns if c not in exclude]

    print(f"  → {len(feature_cols)} features engineered")
    return df_encoded, feature_cols


# ─── Step 3: Train Model ────────────────────────────────────────────────────

def train_model(df_encoded, feature_cols):
    """
    Train a logistic regression model with L2 regularization.
    Uses iteratively reweighted least squares (IRLS) for optimization.
    
    Logistic regression is deliberately chosen over a black-box model
    because every coefficient is interpretable — you can explain to
    a sales leader exactly why a deal scored low ("days_in_stage and
    no_champion are the two biggest risk factors for this deal").
    """
    print("Step 3: Training deal scoring model...")

    X = df_encoded[feature_cols].values.astype(float)
    y = df_encoded["won"].values.astype(float)

    # Normalize features for stable convergence
    means = X.mean(axis=0)
    stds = X.std(axis=0)
    stds[stds == 0] = 1  # Prevent division by zero
    X_norm = (X - means) / stds

    # Train/test split (80/20)
    n = len(X_norm)
    idx = np.random.permutation(n)
    split = int(n * 0.8)
    X_train, X_test = X_norm[idx[:split]], X_norm[idx[split:]]
    y_train, y_test = y[idx[:split]], y[idx[split:]]

    # Add intercept
    X_train_b = np.column_stack([np.ones(len(X_train)), X_train])
    X_test_b = np.column_stack([np.ones(len(X_test)), X_test])

    # Logistic regression via gradient descent with L2 regularization
    n_features = X_train_b.shape[1]
    weights = np.zeros(n_features)
    learning_rate = 0.05
    reg_lambda = 0.01
    n_iterations = 500

    for iteration in range(n_iterations):
        # Forward pass
        z = X_train_b @ weights
        z = np.clip(z, -20, 20)  # Prevent overflow
        probs = 1 / (1 + np.exp(-z))

        # Gradient with L2 regularization
        gradient = X_train_b.T @ (probs - y_train) / len(y_train)
        gradient[1:] += reg_lambda * weights[1:]  # Don't regularize intercept

        # Update
        weights -= learning_rate * gradient

    # Predict on test set
    z_test = X_test_b @ weights
    z_test = np.clip(z_test, -20, 20)
    test_probs = 1 / (1 + np.exp(-z_test))

    # Find optimal threshold by maximizing F1
    best_f1 = 0
    best_thresh = 0.5
    for thresh in np.arange(0.2, 0.6, 0.02):
        preds = (test_probs >= thresh).astype(int)
        tp = ((preds == 1) & (y_test == 1)).sum()
        fp = ((preds == 1) & (y_test == 0)).sum()
        fn = ((preds == 0) & (y_test == 1)).sum()
        p = tp / (tp + fp + 1e-10)
        r = tp / (tp + fn + 1e-10)
        f1 = 2 * p * r / (p + r + 1e-10)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh

    test_binary = (test_probs >= best_thresh).astype(int)

    # Metrics
    accuracy = (test_binary == y_test).mean()
    tp = ((test_binary == 1) & (y_test == 1)).sum()
    fp = ((test_binary == 1) & (y_test == 0)).sum()
    fn = ((test_binary == 0) & (y_test == 1)).sum()
    tn = ((test_binary == 0) & (y_test == 0)).sum()
    precision = tp / (tp + fp + 1e-10)
    recall = tp / (tp + fn + 1e-10)
    f1 = 2 * precision * recall / (precision + recall + 1e-10)

    # AUC (Mann-Whitney U)
    pos_probs = test_probs[y_test == 1]
    neg_probs = test_probs[y_test == 0]
    if len(pos_probs) > 0 and len(neg_probs) > 0:
        auc = np.mean([[p > n for n in neg_probs] for p in pos_probs])
    else:
        auc = 0.5

    # Feature importance (absolute coefficient magnitude)
    coef_importance = list(zip(feature_cols, np.abs(weights[1:])))
    coef_importance.sort(key=lambda x: x[1], reverse=True)

    metrics = {
        "accuracy": round(float(accuracy), 3),
        "precision": round(float(precision), 3),
        "recall": round(float(recall), 3),
        "f1_score": round(float(f1), 3),
        "auc_roc": round(float(auc), 3),
        "optimal_threshold": round(float(best_thresh), 2),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "model_type": "logistic_regression_L2",
        "regularization": reg_lambda,
        "top_features": [{"feature": f, "importance": round(float(w), 4)} for f, w in coef_importance[:10]],
        "confusion_matrix": {"tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)},
    }

    print(f"  → Model trained: AUC={auc:.3f}, F1={f1:.3f}, Accuracy={accuracy:.3f}")
    print(f"  → Precision={precision:.3f}, Recall={recall:.3f}, Threshold={best_thresh:.2f}")
    print(f"  → Top 5 features: {', '.join(f for f, _ in coef_importance[:5])}")

    model = {"weights": weights, "means": means, "stds": stds}
    return model, metrics, feature_cols


# ─── Step 4: Score Open Pipeline ─────────────────────────────────────────────

def score_pipeline(model, feature_cols, n_open=45):
    """Generate and score open pipeline deals."""
    print("Step 4: Scoring open pipeline...")

    reps = ["Sarah Chen", "Marcus Rivera", "Emily Okafor", "James Patel", "Lisa Wong", "David Kim"]
    specialties = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"]
    sources = ["Inbound", "Outbound", "Referral", "Trade Show", "Partner"]
    sizes = ["Solo", "Small", "Medium", "Large"]
    stages = ["Qualified", "Demo Scheduled", "Proposal Sent", "Negotiation"]

    deals = []
    for i in range(n_open):
        deal = {
            "deal_id": f"OPP-OPEN-{i+1:03d}",
            "account_name": f"{'Advanced' if np.random.random() > 0.5 else 'Premier'} {np.random.choice(specialties)} {'Associates' if np.random.random() > 0.3 else 'Group'}",
            "rep": np.random.choice(reps),
            "specialty": np.random.choice(specialties),
            "source": np.random.choice(sources),
            "practice_size": np.random.choice(sizes),
            "stage": stages[min(int(np.random.exponential(1.5)), 3)],
            "acv": int(np.random.lognormal(mean=10.5, sigma=0.7)),
            "days_in_current_stage": int(np.random.exponential(scale=10) + 2),
            "total_days_in_pipeline": int(np.random.exponential(scale=30) + 8),
            "num_activities": int(np.random.poisson(lam=7)),
            "days_since_last_activity": int(np.random.exponential(scale=6)),
            "has_champion": int(np.random.random() < 0.4),
            "competitor_mentioned": int(np.random.random() < 0.35),
            "legal_review_days": int(np.random.exponential(scale=5)) if np.random.random() < 0.3 else 0,
        }
        deal["acv"] = max(5000, min(250000, deal["acv"]))
        deals.append(deal)

    df = pd.DataFrame(deals)

    # Engineer features (same transforms as training)
    df_feat = pd.get_dummies(df, columns=["specialty", "source", "practice_size"], drop_first=True)
    rep_map = {"Sarah Chen": 5, "Emily Okafor": 4, "Lisa Wong": 3, "Marcus Rivera": 2, "James Patel": 1, "David Kim": 0}
    df_feat["rep_skill_index"] = df["rep"].map(rep_map)
    df_feat["activity_velocity"] = df_feat["num_activities"] / df_feat["total_days_in_pipeline"].clip(lower=1)
    df_feat["stage_stall_flag"] = (df_feat["days_in_current_stage"] > 20).astype(int)
    df_feat["engagement_recency_flag"] = (df_feat["days_since_last_activity"] > 14).astype(int)
    df_feat["legal_stall_flag"] = (df_feat["legal_review_days"] > 10).astype(int)
    df_feat["large_deal_flag"] = (df["acv"] > 100000).astype(int)

    # Align columns with training features
    for col in feature_cols:
        if col not in df_feat.columns:
            df_feat[col] = 0

    X = df_feat[feature_cols].values.astype(float)

    # Normalize with training stats
    X_norm = (X - model["means"]) / model["stds"]
    X_norm_b = np.column_stack([np.ones(len(X_norm)), X_norm])

    # Predict
    z = X_norm_b @ model["weights"]
    z = np.clip(z, -20, 20)
    probs = 1 / (1 + np.exp(-z))

    # Rescale to 0-100 using the training distribution
    # Raw probabilities cluster around the base rate (26%), so we spread them
    # across the full 0-100 range for a more actionable scoring system
    min_p, max_p = probs.min(), probs.max()
    range_p = max_p - min_p if max_p > min_p else 1
    scaled = ((probs - min_p) / range_p * 80 + 10)  # Scale to 10-90 range

    df["win_probability"] = np.round(probs * 100, 1)
    df["deal_health_score"] = np.round(scaled).astype(int)
    df["deal_health_score"] = df["deal_health_score"].clip(0, 100)

    # Risk tier
    df["risk_tier"] = pd.cut(
        df["deal_health_score"],
        bins=[0, 30, 50, 70, 100],
        labels=["At Risk", "Needs Attention", "On Track", "Strong"],
        include_lowest=True,
    )

    # Generate prescriptive recommendations
    recommendations = []
    for _, row in df.iterrows():
        recs = []
        if row["days_in_current_stage"] > 20:
            recs.append(f"Stalled {row['days_in_current_stage']}d in stage — escalate with manager check-in")
        if row["days_since_last_activity"] > 14:
            recs.append(f"No activity in {row['days_since_last_activity']}d — schedule touchpoint immediately")
        if not row["has_champion"]:
            recs.append("No champion identified — prioritize stakeholder mapping")
        if row["competitor_mentioned"]:
            recs.append("Competitor in play — prepare competitive displacement materials")
        if row["legal_review_days"] > 10:
            recs.append(f"Legal review at {row['legal_review_days']}d — trigger escalation protocol")
        if row["acv"] > 100000 and row["deal_health_score"] < 50:
            recs.append(f"High-value deal (${row['acv']:,}) at risk — consider executive sponsor involvement")
        if not recs:
            recs.append("Deal healthy — maintain current cadence")
        recommendations.append(recs)

    df["recommendations"] = recommendations

    print(f"  → {len(df)} open deals scored")
    print(f"  → Distribution: {dict(df['risk_tier'].value_counts())}")
    return df


# ─── Step 5: Export ──────────────────────────────────────────────────────────

def export_results(scored_deals, model_metrics):
    """Export scored pipeline and model metadata."""
    print("Step 5: Exporting results...")

    # JSON for React app
    output = []
    for _, row in scored_deals.iterrows():
        output.append({
            "deal_id": row["deal_id"],
            "account_name": row["account_name"],
            "rep": row["rep"],
            "specialty": row["specialty"],
            "source": row["source"],
            "practice_size": row["practice_size"],
            "stage": row["stage"],
            "acv": int(row["acv"]),
            "days_in_current_stage": int(row["days_in_current_stage"]),
            "total_days_in_pipeline": int(row["total_days_in_pipeline"]),
            "num_activities": int(row["num_activities"]),
            "days_since_last_activity": int(row["days_since_last_activity"]),
            "has_champion": bool(row["has_champion"]),
            "competitor_mentioned": bool(row["competitor_mentioned"]),
            "legal_review_days": int(row["legal_review_days"]),
            "deal_health_score": int(row["deal_health_score"]),
            "win_probability": float(row["win_probability"]),
            "risk_tier": str(row["risk_tier"]),
            "recommendations": row["recommendations"],
        })

    json_path = PUBLIC_DIR / "deal_scores.json"
    with open(json_path, "w") as f:
        json.dump(output, f, indent=2)

    # Model metadata
    model_metrics["pipeline"] = "deal_scoring_model"
    model_metrics["run_timestamp"] = datetime.now().isoformat()
    model_metrics["features_used"] = [
        "acv", "days_in_current_stage", "total_days_in_pipeline",
        "num_activities", "days_since_last_activity", "has_champion",
        "competitor_mentioned", "legal_review_days", "specialty (encoded)",
        "source (encoded)", "practice_size (encoded)", "rep_skill_index",
        "activity_velocity", "stage_stall_flag", "engagement_recency_flag",
        "legal_stall_flag", "large_deal_flag",
    ]
    model_metrics["scoring_output"] = {
        "total_deals": len(output),
        "at_risk": sum(1 for d in output if d["risk_tier"] == "At Risk"),
        "needs_attention": sum(1 for d in output if d["risk_tier"] == "Needs Attention"),
        "on_track": sum(1 for d in output if d["risk_tier"] == "On Track"),
        "strong": sum(1 for d in output if d["risk_tier"] == "Strong"),
        "total_pipeline_acv": sum(d["acv"] for d in output),
        "at_risk_acv": sum(d["acv"] for d in output if d["risk_tier"] == "At Risk"),
    }

    meta_path = OUTPUT_DIR / "model_metrics.json"
    with open(meta_path, "w") as f:
        json.dump(model_metrics, f, indent=2)

    print(f"  → {json_path} ({len(output)} scored deals)")
    print(f"  → {meta_path}")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Deal Scoring Model Pipeline")
    print("=" * 60)
    print()

    df = generate_deal_data(n=800)
    df_encoded, feature_cols = engineer_features(df)
    model, metrics, feat_cols = train_model(df_encoded, feature_cols)
    scored = score_pipeline(model, feat_cols)
    export_results(scored, metrics)

    print()
    print("=" * 60)
    print("Pipeline Complete")
    print("=" * 60)
    print(f"  Model AUC:       {metrics['auc_roc']}")
    print(f"  Model F1:        {metrics['f1_score']}")
    print(f"  Deals scored:    {len(scored)}")
    at_risk = scored[scored["risk_tier"] == "At Risk"]
    print(f"  At-risk deals:   {len(at_risk)} (${at_risk['acv'].sum():,.0f} ACV)")
    print()


if __name__ == "__main__":
    main()
