# Security policy

## Public-repository rules

- Never commit Stripe or EasyPost API keys, webhook secrets, payment credentials, customer addresses, or order exports.
- Create Stripe Checkout Sessions server-side from the canonical product catalog; never trust prices submitted by the browser.
- Verify Stripe webhook signatures before fulfilling or recording an order.
- Keep secrets in the hosting provider's encrypted environment variables.
- Keep local secrets in `.env` or `.dev.vars`; both are ignored and must never be committed.
- Do not call EasyPost directly from `index.html` or `app.js`.
- Validate EasyPost webhook signatures server-side over HTTPS before processing an event.
- Make webhook processing idempotent because delivery retries are expected.

## Reporting

Please report a suspected vulnerability privately to the repository owner rather than opening a public issue with sensitive details.
