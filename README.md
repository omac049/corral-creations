# Corral Creations

Whimsical, handmade crochet storefront for Corral Creations.

## Local preview

```bash
python3 -m http.server 4174
```

Then open `http://127.0.0.1:4174/`.

## Deployment

This is a static site: `index.html`, `styles.css`, `app.js`, and `assets/` can be deployed from the repository root with GitHub Pages or another static host. The newsletter form is intentionally transparent about its not-yet-connected provider; connect a mailing-list endpoint before treating submissions as opt-in records.

## Sandbox Stripe checkout

The storefront uses Stripe-hosted Checkout. The browser sends only catalog IDs and quantities; the Worker owns prices, shipping, tax configuration, and the webhook boundary.

1. Create a Stripe test-mode secret key and webhook signing secret. Never put either value in this repository.
2. Copy `.dev.vars.example` to `.dev.vars` for local Worker development, or store the same values as encrypted Wrangler secrets:

   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

3. Set `STRIPE_AUTOMATIC_TAX=true` only after Stripe Tax is configured for the test account. Keep it `false` for a basic Checkout smoke test.
4. Deploy the Worker with `npx wrangler deploy`, then replace the placeholder in the `checkout-api-url` meta tag in `index.html` with the deployed Worker URL before publishing the static site.
5. Register `POST https://<worker-host>/webhook` in Stripe test mode and use its signing secret as `STRIPE_WEBHOOK_SECRET`.

The Worker is intentionally locked to `sk_test_` keys while `ENVIRONMENT=sandbox`. The `OrderLedger` Durable Object records signed successful Checkout events idempotently so a webhook retry does not create a second order record.

For a test payment, use Stripe's test card `4242 4242 4242 4242` with any future expiry, any three-digit CVC, and a valid US shipping address.

## EasyPost boundary

EasyPost credentials and webhook secrets must never be placed in this public repository or in browser JavaScript. Shipping events should be received and validated by the configured server-side webhook destination, then passed to the storefront or order system through an authenticated backend API.

The configured webhook destination is represented in `.env.example` for deployment documentation only.
