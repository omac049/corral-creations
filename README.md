# Corral Creations

Whimsical, handmade crochet storefront for Corral Creations.

## Local preview

```bash
python3 -m http.server 4174
```

Then open `http://127.0.0.1:4174/`.

## Deployment

This is a static site: `index.html`, `styles.css`, `app.js`, and `assets/` can be deployed from the repository root with GitHub Pages or another static host.

## EasyPost boundary

EasyPost credentials and webhook secrets must never be placed in this public repository or in browser JavaScript. Shipping events should be received and validated by the configured server-side webhook destination, then passed to the storefront or order system through an authenticated backend API.

The configured webhook destination is represented in `.env.example` for deployment documentation only.
