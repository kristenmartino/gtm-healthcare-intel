"""Execute the UI's SQL against small fixtures using DuckDB compatibility macros.
This verifies calculation behavior, not Snowflake or dbt deployment readiness.
"""
import json
import subprocess
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]

@pytest.fixture(scope="module")
def queries():
    output = subprocess.check_output(["node", "--input-type=module", "-e", "import { METRICS } from './lib/metric-definitions.mjs'; console.log(JSON.stringify(METRICS));"], cwd=ROOT, text=True)
    return {m["name"]: m["sql"].replace("CURRENT_DATE", "DATE '2025-04-07'") for m in json.loads(output)}

@pytest.fixture
def db():
    con = duckdb.connect()
    con.execute("CREATE SCHEMA salesforce; CREATE SCHEMA billing")
    con.execute("""CREATE MACRO DATEADD(part, n, d) AS
        CASE part WHEN 'quarter' THEN d + n * INTERVAL '3 months'
                  WHEN 'month' THEN d + n * INTERVAL '1 month'
                  WHEN 'year' THEN d + n * INTERVAL '1 year' END""")
    con.execute("CREATE MACRO DATEDIFF(part, a, b) AS DATE_DIFF(part, a, b)")
    con.execute("""CREATE TABLE salesforce.account(account_id VARCHAR PRIMARY KEY, specialty_segment VARCHAR, cohort_quarter DATE, account_type VARCHAR);
    INSERT INTO salesforce.account VALUES ('a', 'Dermatology', '2024-01-01', 'Customer');
    CREATE TABLE salesforce.opportunity(opportunity_id VARCHAR PRIMARY KEY, account_id VARCHAR, owner_name VARCHAR, lead_source VARCHAR, stage_name VARCHAR, acv DOUBLE, is_closed BOOLEAN, is_won BOOLEAN, is_deleted BOOLEAN, created_date DATE, close_date DATE);
    CREATE TABLE salesforce.lead(lead_id VARCHAR, converted_opportunity_id VARCHAR, lead_source VARCHAR, created_date DATE, utm_campaign__c VARCHAR, utm_medium__c VARCHAR, is_converted BOOLEAN);
    CREATE TABLE billing.invoice(account_id VARCHAR, invoice_date DATE, recognized_revenue DOUBLE, invoice_status VARCHAR);""")
    yield con
    con.close()

def opp(db, identifier, stage="Qualified", amount=10000, closed=False, won=False, deleted=False, created="2024-12-01", close="2025-02-01"):
    db.execute("INSERT INTO salesforce.opportunity VALUES (?, 'a', 'Chen', 'Inbound', ?, ?, ?, ?, ?, ?, ?)", [identifier, stage, amount, closed, won, deleted, created, close])

def records(db, sql):
    cursor = db.execute(sql)
    keys = [c[0] for c in cursor.description]
    return [dict(zip(keys, row)) for row in cursor.fetchall()]

def test_repeated_stages_do_not_multiply_pipeline_and_exclusions_hold(db, queries):
    opp(db, 'one', amount=10000)
    opp(db, 'two', amount=20000)
    opp(db, 'deleted', amount=90000, deleted=True)
    opp(db, 'trial', amount=4999)
    opp(db, 'prospecting', stage='Prospecting')
    opp(db, 'won', stage='Closed Won', closed=True, won=True)
    result = records(db, queries['Qualified Pipeline'])
    assert len(result) == 1
    assert result[0]['deal_count'] == 2
    assert result[0]['pipeline_acv'] == 30000
    assert result[0]['median_deal_size'] == 15000

def test_closed_win_rate_uses_complete_quarters_and_excludes_open(db, queries):
    opp(db, 'q4-win', 'Closed Won', closed=True, won=True, close='2024-12-10')
    opp(db, 'q1-win', 'Closed Won', closed=True, won=True)
    opp(db, 'q1-loss', 'Closed Lost', closed=True)
    opp(db, 'open')
    opp(db, 'deleted-win', 'Closed Won', closed=True, won=True, deleted=True)
    opp(db, 'future-win', 'Closed Won', closed=True, won=True, close='2025-04-02')
    rows = records(db, queries['Win Rate by Segment'])
    assert len(rows) == 2
    assert rows[0]['win_rate_pct'] == 100
    assert rows[1]['total_closed'] == 2
    assert rows[1]['win_rate_pct'] == 50
    assert rows[1]['win_rate_change_pp'] == -50

def test_sales_cycle_reports_won_distribution_and_filters_invalid_rows(db, queries):
    for i, close in enumerate(['2025-01-11', '2025-01-21', '2025-01-31']):
        opp(db, str(i), 'Closed Won', closed=True, won=True, created='2025-01-01', close=close)
    opp(db, 'same-day', 'Closed Won', closed=True, won=True, created='2025-01-01', close='2025-01-01')
    opp(db, 'lost', 'Closed Lost', closed=True, created='2025-01-01', close='2025-01-05')
    row = records(db, queries['Sales Cycle Velocity'])[0]
    assert row['deal_count'] == 3
    assert row['median_cycle_days'] == 20
    assert row['mean_cycle_days'] == 20

def test_first_touch_ties_and_closed_denominator(db, queries):
    for identifier, stage, closed, won in [('win','Closed Won',True,True), ('loss','Closed Lost',True,False), ('open','Qualified',False,False)]:
        opp(db, identifier, stage, closed=closed, won=won)
        db.execute("INSERT INTO salesforce.lead VALUES (?, ?, 'Inbound', '2024-11-01', 'original', 'web', TRUE)", [identifier+'-a', identifier])
    db.execute("INSERT INTO salesforce.lead VALUES ('win-z', 'win', 'Paid Search', '2024-11-01', 'tie', 'paid', TRUE)")
    row = records(db, queries['Marketing Attribution — Pipeline Sourced'])[0]
    assert row['original_source'] == 'Inbound'
    assert row['opps_created'] == 3
    assert row['pipeline_generated'] == 30000
    assert row['source_win_rate'] == 50
    assert row['revenue_generated'] == 10000

def test_nrr_retains_churn_and_excludes_new_customers(db, queries):
    # A expands 100→120; B churns 100→0 and no longer has Customer status;
    # C contracts 100→80; D is a new customer with 200 revenue.
    db.execute("""INSERT INTO salesforce.account VALUES
      ('b','Dermatology','2024-01-01','Former Customer'),
      ('c','Dermatology','2024-01-01','Customer'),
      ('d','Dermatology','2025-01-01','Customer');
      INSERT INTO billing.invoice VALUES
      ('a','2024-12-01',100,'Paid'), ('a','2025-02-01',120,'Paid'),
      ('b','2024-12-01',100,'Paid'),
      ('c','2024-12-01',100,'Paid'), ('c','2025-02-01',80,'Paid'),
      ('d','2025-02-01',200,'Paid');""")
    rows = records(db, queries['Net Revenue Retention (NRR)'])
    assert len(rows) == 1
    row = rows[0]
    assert str(row['revenue_quarter']).startswith('2025-01-01')
    assert row['prior_period_revenue'] == 300
    assert row['current_period_revenue'] == 200
    assert row['churned_revenue'] == 100
    assert row['expansion_revenue'] == 20
    assert row['contraction_revenue'] == 20
    assert row['nrr_pct'] == 66.7

def test_open_only_source_has_no_win_rate(db, queries):
    opp(db, 'open')
    db.execute("INSERT INTO salesforce.lead VALUES ('l','open','Inbound','2024-11-01','c','web',TRUE)")
    assert records(db, queries['Marketing Attribution — Pipeline Sourced'])[0]['source_win_rate'] is None

def test_nrr_all_churned_cohort_has_zero_current_revenue(db, queries):
    db.execute("INSERT INTO billing.invoice VALUES ('a','2024-12-01',100,'Paid')")
    row = records(db, queries['Net Revenue Retention (NRR)'])[0]
    assert row['current_period_revenue'] == 0
    assert row['nrr_pct'] == 0
    assert row['churned_revenue'] == 100
