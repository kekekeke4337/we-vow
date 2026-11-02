# Security and privacy

## Private by default

Run locally unless you have configured an HTTPS reverse proxy and explicit allowed origins. Invitation URLs are credentials. Do not post them publicly or record them in screenshots, logs, issue reports or analytics.

## Never commit runtime data

The following must remain outside Git:

- `.local/` and custom `WEDDING_DATA_DIR` contents
- SQLite databases and WAL/SHM files
- invitation manifests, sessions, chat, blessings and photo metadata
- `.env`, certificates, private keys, access tokens and cookies
- private character art or personally identifying guest data

## Reporting a vulnerability

Do not open a public issue containing a live invitation, personal data or a working exploit against an active wedding. Reproduce against a fresh local instance with synthetic identities and redact all credentials.

## Public deployment checklist

1. Use a fresh data directory and fresh invitations.
2. Set `PUBLIC_ORIGIN` to the exact HTTPS origin.
3. Restrict `ALLOWED_ORIGINS`; never use `*`.
4. Keep the service behind rate limiting and a maintained reverse proxy.
5. Run `npm test` and `npm run review:privacy` from a clean checkout.
6. Back up the private database before upgrades.
