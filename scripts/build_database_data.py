"""Build the small JSON files used by the Database page charts.

Reads the Peat Inventory outputs (carbon_stock_pedon.csv, master_horizon_table.csv)
and writes compact, public-safe JSON to public/data/database/.

Usage:
    python scripts/build_database_data.py "<path to peat_inventory>/02_outputs"
"""
import json
import sys
from pathlib import Path

import pandas as pd

src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("02_outputs")
out = Path(__file__).resolve().parents[1] / "public" / "data" / "database"
out.mkdir(parents=True, exist_ok=True)


def dump(name, obj):
    p = out / name
    p.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    print(f"{name}: {p.stat().st_size / 1024:.0f} KB")


def r(series, n=2):
    return [None if pd.isna(v) else round(float(v), n) for v in series]


# ---------------------------------------------------------------- pedons
ped = pd.read_csv(src / "carbon_stock_pedon.csv", low_memory=False)


def tier(rf):
    if pd.isna(rf):
        return None
    return 1 if rf == 0 else 2 if rf <= 50 else 3


ped["tier"] = ped["soc_rf_pct"].apply(tier)
dump(
    "pedons.json",
    {
        "n": len(ped),
        "id": ped["DNR Peat Inventory ID #"].astype(str).tolist(),
        "county": ped["County Name"].fillna("").tolist(),
        "depth": r(ped["max_peat_depth_cm"], 0),
        "full": r(ped["C_stock_full_kgm2"], 1),
        "m1": r(ped["C_stock_1m_kgm2"], 1),
        "tier": [None if pd.isna(v) else int(v) for v in ped["tier"]],
        "critB": [bool(v) for v in ped["criteria_B"]],
        "critA": [bool(v) for v in ped["criteria_A"]],
    },
)

# --------------------------------------------------------------- horizons
m = pd.read_csv(src / "master_horizon_table.csv", low_memory=False)
n_hor = len(m)
n_ped = m["DNR Peat Inventory ID #"].nunique()

soc_meas = m["SOC_gap_method"].eq("measured")
bd_meas = m["BD_gap_method"].eq("measured")
availability = {
    "horizons": n_hor,
    "pedons": int(n_ped),
    "soc_measured": int(soc_meas.sum()),
    "bd_measured": int(bd_meas.sum()),
    "both_measured": int((soc_meas & bd_meas).sum()),
}
availability["neither"] = int(n_hor - (soc_meas | bd_meas).sum())

gap = {}
for label, col in (("SOC", "SOC_gap_method"), ("BD", "BD_gap_method")):
    vc = m[col].value_counts()
    gap[label] = {k: int(vc.get(k, 0)) for k in ("measured", "ash_regression", "rf", "missing")}

tiers = {
    "all": ped["tier"].value_counts().sort_index().astype(int).to_dict(),
    "critB": ped.loc[ped["criteria_B"], "tier"].value_counts().sort_index().astype(int).to_dict(),
}
tiers = {k: {str(a): b for a, b in v.items()} for k, v in tiers.items()}

# ash vs measured BD / measured SOC (the lab pairs the ash regressions are fit on)
has_ash = m["Ash_pct"].notna() & m["Ash_source"].ne("none")
bd_pairs = m[bd_meas & has_ash]
soc_pairs = m[soc_meas & has_ash]

# measured lab values by humification / classification
meas = m[["Classification", "VonPost", "SOC_pct_measured", "BD_gcc", "Ash_pct"]].copy()
meas.loc[~bd_meas, "BD_gcc"] = float("nan")
meas.loc[~has_ash, "Ash_pct"] = float("nan")
meas["vp"] = meas["VonPost"].apply(lambda v: None if pd.isna(v) else int(v // 1))
CLASSES = ["Fibric", "Hemic", "Sapric", "Limnic"]
lab = {"class": {}, "vonpost": {}}
for key, col in (("soc", "SOC_pct_measured"), ("bd", "BD_gcc"), ("ash", "Ash_pct")):
    lab["class"][key] = {c: r(meas.loc[meas["Classification"] == c, col].dropna(), 2) for c in CLASSES}
    lab["vonpost"][key] = {
        f"H{h}": r(meas.loc[meas["vp"] == h, col].dropna(), 2) for h in range(1, 11)
    }

dump(
    "horizons.json",
    {
        "availability": availability,
        "gap": gap,
        "tiers": tiers,
        "bd_ash": {"ash": r(bd_pairs["Ash_pct"], 1), "bd": r(bd_pairs["BD_gcc"], 3)},
        "soc_ash": {"ash": r(soc_pairs["Ash_pct"], 1), "soc": r(soc_pairs["SOC_pct_measured"], 2)},
        "lab": lab,
    },
)
print(json.dumps({"availability": availability, "gap": gap, "tiers": tiers}, indent=1))
