# Goodreads book explorer

A static website for searching, sorting, and filtering 1,727 books with 200,000+ Goodreads ratings. Built with plain HTML, CSS, and JavaScript. No dependencies or build step.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8765
```

Open http://localhost:8765. Use an HTTP server rather than opening `index.html` directly, because the app loads `books.json` with `fetch`.

## Put it on GitHub

Create a repository and upload this folder's contents to its root. Keep `index.html`, `app.js`, `styles.css`, and `books.json` together.

To publish with GitHub Pages:

1. Open your repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select your branch (usually `main`) and **/ (root)**, then save.

The included `.nojekyll` file lets GitHub Pages serve the static files directly. All app asset paths are relative, so repository sites work without changing a base URL.

[GitHub Pages setup documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Files

- `index.html`: page, filter popover, and dialogs
- `styles.css`: layout and visual styles
- `app.js`: filtering, sorting, virtualized table, and interactions
- `books.json`: collection and source metadata
- `.nojekyll`: static GitHub Pages publishing

## Behavior

Genre rules can be combined: Require matches all selected genres, Include matches any selected genre, and Exclude matches none. Hidden genre labels reset on refresh and can be restored with Show hidden labels. Rating, ratings-count, publication-year, and text filters are supported. Overall popularity ranks stay fixed when results are filtered.

## Data

The Goodreads ratings snapshot is from October 6, 2026; publication-year metadata was enriched afterward. Ratings and written reviews are separate counts. The collection comes from community-maintained Goodreads lists and is not guaranteed exhaustive. Individual records retain their source and timing information in `books.json`; counts are not live.

Goodreads source-list links are shown in the app's Data sources dialog and stored under `meta.sources` in `books.json`. Publication-year enrichment also used [Goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k). Book covers load from their existing remote URLs.
