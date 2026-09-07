# Security Policy

## Supported versions

Security fixes land on the `main` branch of [`Nonarkara/globalmonitor-v3`](https://github.com/Nonarkara/globalmonitor-v3). That is the only supported line.

## Reporting a vulnerability

**Do not open a public issue** for a vulnerability, leaked key, or accidental secret.

1. Prefer [GitHub private vulnerability reporting](https://github.com/Nonarkara/globalmonitor-v3/security/advisories/new) on this repository.
2. If you cannot use Advisories, email [non.ar@depa.or.th](mailto:non.ar@depa.or.th) with a short description, impact, and how to reproduce.

We will acknowledge a good-faith report and say whether we are fixing it. Please give us time to patch before public write-ups.

## Secrets and keys

This dashboard is meant to run without credentials. Optional provider keys (ACLED, FIRMS, AIS, Copernicus, Sheets, and the rest listed in [`.env.example`](.env.example)) must stay off git:

- Copy `.env.example` to `.env.local` on your machine only.
- Never commit `.env`, `.env.local`, `.dev.vars`, or filled tokens.
- Never expose secrets as `VITE_*` (those are bundled into the browser).
- Production bindings belong in the Cloudflare Pages project dashboard, not in this tree.

If you find a key in a commit or a live page, report it privately using the channels above.

## Out of scope

Third-party feeds (ACLED, NASA, AIS, ADS-B, and others) have their own security contacts. Misuse of this OSINT dashboard as official government intelligence is an ethical issue, not a vulnerability — see [README §3](README.md#3-ethical-use).
