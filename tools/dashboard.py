"""CardRush Scrape Dashboard — Streamlit viewer for wholesale data."""

import json
import glob
import os
import pandas as pd
import streamlit as st

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cardrush")
WHOLESALE_DIR = os.path.join(DATA_DIR, "wholesale")
RAW_DIR = os.path.join(DATA_DIR, "raw")


@st.cache_data
def load_wholesale(path: str) -> pd.DataFrame:
    with open(path) as f:
        cards = json.load(f)

    rows = []
    for c in cards:
        image_url = c.get("imageUrl") or ""
        rows.append(
            {
                "Image": image_url,
                "SKU": c["sku"],
                "Card #": c["cardNumber"],
                "Name": c["name"],
                "Rarity": c.get("rarity") or "—",
                "Type": "Parallel" if c["isParallel"] else "Standard",
                "JPY (税込)": c["cardrushJpy"],
                "GBP Ex-VAT": c["pricing"]["priceExVat"],
                "GBP Inc-VAT": c["pricing"]["priceExVat"] * 1.2,
                "Base GBP": c["pricing"]["baseGbp"],
                "Landed": c["pricing"]["landedCost"],
                "Margin": c["pricing"]["margin"],
                "Stock": c.get("stock", -1),
                "URL": c.get("cardrushUrl") or "",
            }
        )
    return pd.DataFrame(rows)


@st.cache_data
def load_raw(path: str) -> pd.DataFrame:
    with open(path) as f:
        products = json.load(f)

    rows = []
    for p in products:
        rows.append(
            {
                "Card #": p.get("cardNumber") or "—",
                "Name": p["name"],
                "JPY": p["priceJpy"],
                "Rarity": p.get("rarity") or "—",
                "Stock": p.get("stock", -1),
                "Condition": p.get("condition") or "—",
                "Parallel": p["isParallel"],
            }
        )
    return pd.DataFrame(rows)


def find_files(directory: str) -> list[str]:
    pattern = os.path.join(directory, "*.json")
    files = sorted(glob.glob(pattern), reverse=True)
    return files


def file_label(path: str) -> str:
    return os.path.basename(path).replace(".json", "")


# ── Page config ──────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="CardRush Scrape Dashboard",
    page_icon="🃏",
    layout="wide",
)

st.title("CardRush Scrape Dashboard")

# ── File picker ──────────────────────────────────────────────────────────────

wholesale_files = find_files(WHOLESALE_DIR)
raw_files = find_files(RAW_DIR)

if not wholesale_files:
    st.warning("No wholesale data found. Run the scraper first:\n\n`pnpm scrape:cardrush OP01 --dry-run`")
    st.stop()

selected = st.selectbox(
    "Select scrape",
    wholesale_files,
    format_func=file_label,
)

df = load_wholesale(selected)

# ── KPI row ──────────────────────────────────────────────────────────────────

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Total Cards", len(df))
col2.metric("Standard", len(df[df["Type"] == "Standard"]))
col3.metric("Parallel", len(df[df["Type"] == "Parallel"]))
col4.metric("JPY Range", f"¥{df['JPY (税込)'].min():,} – ¥{df['JPY (税込)'].max():,}")
col5.metric("GBP Range", f"£{df['GBP Ex-VAT'].min():.2f} – £{df['GBP Ex-VAT'].max():.2f}")

# ── Filters ──────────────────────────────────────────────────────────────────

st.subheader("Filters")
fcol1, fcol2, fcol3 = st.columns(3)

with fcol1:
    type_filter = st.multiselect("Type", ["Standard", "Parallel"], default=["Standard", "Parallel"])

with fcol2:
    rarities = sorted(df["Rarity"].unique())
    rarity_filter = st.multiselect("Rarity", rarities, default=rarities)

with fcol3:
    price_range = st.slider(
        "JPY Price Range",
        min_value=int(df["JPY (税込)"].min()),
        max_value=int(df["JPY (税込)"].max()),
        value=(int(df["JPY (税込)"].min()), int(df["JPY (税込)"].max())),
    )

filtered = df[
    (df["Type"].isin(type_filter))
    & (df["Rarity"].isin(rarity_filter))
    & (df["JPY (税込)"] >= price_range[0])
    & (df["JPY (税込)"] <= price_range[1])
]

st.caption(f"Showing {len(filtered)} of {len(df)} cards")

# ── Main table ───────────────────────────────────────────────────────────────

st.subheader("Wholesale Cards")

st.dataframe(
    filtered.style.format(
        {
            "JPY (税込)": "¥{:,.0f}",
            "GBP Ex-VAT": "£{:.2f}",
            "GBP Inc-VAT": "£{:.2f}",
            "Base GBP": "£{:.2f}",
            "Landed": "£{:.2f}",
            "Margin": "£{:.2f}",
        }
    ),
    use_container_width=True,
    height=600,
    column_config={
        "Image": st.column_config.ImageColumn("Image", width="small"),
        "URL": st.column_config.LinkColumn("CardRush Link", display_text="View"),
    },
)

# ── Price distribution ───────────────────────────────────────────────────────

st.subheader("Price Distribution")

chart_col1, chart_col2 = st.columns(2)

with chart_col1:
    st.bar_chart(
        filtered.groupby("Rarity")["GBP Ex-VAT"].mean().sort_values(ascending=False),
        x_label="Rarity",
        y_label="Avg GBP Ex-VAT",
    )

with chart_col2:
    st.bar_chart(
        filtered.groupby("Type")["GBP Ex-VAT"].sum(),
        x_label="Type",
        y_label="Total GBP Ex-VAT",
    )

# ── Raw data tab ─────────────────────────────────────────────────────────────

st.divider()
st.subheader("Raw Scrape Data")

# Match raw file to wholesale file
base = os.path.basename(selected)
raw_path = os.path.join(RAW_DIR, base)

if os.path.exists(raw_path):
    raw_df = load_raw(raw_path)

    rcol1, rcol2, rcol3 = st.columns(3)
    rcol1.metric("Raw Listings", len(raw_df))
    rcol2.metric("With Card #", len(raw_df[raw_df["Card #"] != "—"]))
    rcol3.metric("Filtered Out", len(raw_df) - len(df))

    with st.expander(f"Raw products ({len(raw_df)} listings)", expanded=False):
        st.dataframe(raw_df, use_container_width=True, height=400)
else:
    st.info("No matching raw data file found.")
