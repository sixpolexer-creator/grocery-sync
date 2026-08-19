"""
Downloads today's price feeds for all (or a chosen subset of) Israeli
supermarket chains via il_supermarket_scarper, writing raw XML files to disk.

This script only downloads — it does not parse or touch Supabase. See
scripts/sync_scraped_prices.js for the parse + upsert step that reads its
output. Run both in sequence (the GitHub Actions workflow does this):

    python scraper/run_scrape.py
    node scripts/sync_scraped_prices.js

Env vars (all optional):
  ENABLED_SCRAPERS   comma-separated ScraperFactory names to restrict to,
                      e.g. "SHUFERSAL,RAMI_LEVY". Default: all chains.
  STORAGE_PATH        where raw files land. Default: scraper/dumps
  LIMIT               cap on files per chain (useful for local testing)
  NUMBER_OF_PROCESSES parallel scraper processes. Default: library default.
"""
import os

from il_supermarket_scarper import ScarpingTask, ScraperFactory

DEFAULT_STORAGE_PATH = os.path.join(os.path.dirname(__file__), "dumps")


def _load_kwargs():
    kwargs = {}

    enabled = os.getenv("ENABLED_SCRAPERS")
    if enabled:
        names = [s.strip() for s in enabled.split(",") if s.strip()]
        invalid = [n for n in names if n not in ScraperFactory.all_scrapers_name()]
        if invalid:
            raise ValueError(f"ENABLED_SCRAPERS contains unknown chains: {invalid}")
        kwargs["enabled_scrapers"] = names

    processes = os.getenv("NUMBER_OF_PROCESSES")
    if processes:
        kwargs["multiprocessing"] = int(processes)

    kwargs["output_configuration"] = {
        "output_mode": "disk",
        "base_storage_path": os.getenv("STORAGE_PATH", DEFAULT_STORAGE_PATH),
    }
    kwargs["status_configuration"] = {
        "database_type": "json",
        "base_path": os.path.join(
            os.getenv("STORAGE_PATH", DEFAULT_STORAGE_PATH), "status"
        ),
    }
    return kwargs


def _load_runtime_kwargs():
    kwargs = {"single_pass": True}  # one download pass, then exit — fits a CI job
    limit = os.getenv("LIMIT")
    if limit:
        kwargs["limit"] = int(limit)
    return kwargs


if __name__ == "__main__":
    task = ScarpingTask(**_load_kwargs())
    task.start(**_load_runtime_kwargs())
    task.join()
