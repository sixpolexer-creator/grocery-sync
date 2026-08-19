"""
Maps il_supermarket_scarper's DumpFolderNames values (the actual
scraper/dumps/<X> folder name on disk, e.g. "RamiLevy" — NOT the
ScraperFactory enum name, e.g. "RAMI_LEVY") to the Hebrew chain-name strings
grocery-sync stores in market_prices.market_name.

The actual map lives in scraper/chain-name-map.json — shared with
scripts/sync_scraped_prices.js so there's one source of truth. This module
just loads it for anything on the Python side that needs it (currently
nothing does at scrape time; kept for parity / future use, e.g. if the
parse step ever moves into Python instead of scripts/sync_scraped_prices.js).
"""
import json
import os

_MAP_PATH = os.path.join(os.path.dirname(__file__), "chain-name-map.json")

with open(_MAP_PATH, encoding="utf-8") as f:
    _raw = json.load(f)
CHAIN_NAME_MAP = {k: v for k, v in _raw.items() if not k.startswith("_")}


def market_name_for(dump_folder_name: str) -> str:
    """Hebrew market_name for a DumpFolderNames value (dump folder name);
    falls back to the raw folder name (spaced out) if a chain is added
    upstream before this map is updated, so the sync never silently drops a
    chain's data."""
    return CHAIN_NAME_MAP.get(dump_folder_name, dump_folder_name)
