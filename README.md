# Busquem la Xarxa
 
A PWA to find which libraries in the Barcelona Xarxa de Biblioteques are open at a given
date and time, filtering out holidays and vacation closures.
 
## Data source
 
Raw export from https://bibliotecavirtual.diba.cat/ca/busca-una-biblioteca using the provided API data: https://dadesobertes.diba.cat/datasets/biblioteques-municipals
 
## Build
 
1. Run `python build/preprocess.py`
2. This writes `docs/data/libraries.json`
3. Commit both the raw CSV and the generated JSON
 
## Deploy
 
GitHub Pages → Settings → Pages → Source: `main` branch, `/docs` folder.

## Data source and license

Data from the Diputació de Barcelona open data portal:
https://dadesobertes.diba.cat/datasets/biblioteques-municipals

Licensed under CC BY 4.0. The "last updated" date from the source is stored in
`raw/last_download.json` and displayed in the app footer.
