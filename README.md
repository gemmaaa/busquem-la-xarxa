# Busquem la Xarxa

A PWA to find which libraries in the Barcelona province are open at a
given date and time, filtering out holidays and vacation closures.

## Data source and license

Data from the Diputacio de Barcelona open data portal:
https://dadesobertes.diba.cat/datasets/biblioteques-municipals

Licensed under CC BY 4.0. The "last updated" date from the source is
stored in `raw/last_download.json` and displayed in the app footer.

## Build

1. Set `CSV_URL` in `build/preprocess.py` to the CSV download URL
   (find it on the dataset page under the CSV resource).
2. Run `python build/preprocess.py`
3. This creates:
   - `raw/export.csv`
   - `raw/last_download.json`
   - `docs/data/libraries.json`
4. Commit all three.

Subsequent runs will skip the download if the source hasn't changed.
Use `--force` to re-download anyway.

## Deploy

GitHub Pages -> Settings -> Pages -> Source: `main` branch, `/docs` folder.
