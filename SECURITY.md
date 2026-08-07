# Security policy

## Public-repository rules

- Never commit EasyPost API keys, webhook secrets, payment credentials, customer addresses, or order exports.
- Keep secrets in the hosting provider's encrypted environment variables.
- Do not call EasyPost directly from `index.html` or `app.js`.
- Validate EasyPost webhook signatures server-side over HTTPS before processing an event.
- Make webhook processing idempotent because delivery retries are expected.

## Reporting

Please report a suspected vulnerability privately to the repository owner rather than opening a public issue with sensitive details.
