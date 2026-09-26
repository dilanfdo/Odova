# Odova docs

Internal documentation for how Odova is built and why. This folder exists
because the app has accumulated enough moving parts (accounts, billing, ads,
theming) that a single README section per topic stopped being enough — each
doc here goes deep on one area. No secrets, keys, or personal identifiers are
recorded anywhere in this folder; see "Where the real values live" in each doc.

The top-level `README.md` is still the entry point for running the project
locally. Start there; come here for the "how does X actually work, and why is
it built that way" depth.

## Contents

- [architecture.md](./architecture.md) — what Odova is, the sync-code data
  model, how it relates to the NDL web app and backend, project layout.
- [accounts-and-sign-in.md](./accounts-and-sign-in.md) — the optional
  account/magic-link layer on top of the sync code, how it was wired up, and
  the real bugs hit building it.
- [pro-entitlement-and-billing.md](./pro-entitlement-and-billing.md) — the
  one-time Pro purchase: RevenueCat, Play Console, the soft-paywall pattern,
  what's enforced client-side vs. not yet enforced server-side.
- [advertising.md](./advertising.md) — the AdMob banner integration for
  free-tier users, consent handling, and a known upstream packaging bug this
  project had to work around.
- [theming-and-ui.md](./theming-and-ui.md) — the light/dark/system theme
  system and the shared UI components that came out of de-duplicating every
  screen's styling.
- [known-gaps.md](./known-gaps.md) — a running list of what's deliberately
  deferred, so it doesn't get rediscovered from scratch each time.

## How to keep these useful

Update the relevant doc in the same change that touches the area it covers —
these are meant to stay a true reflection of the current build, not a
snapshot of intent. If something here turns out to be wrong, fix the doc
rather than leaving it stale; a wrong doc is worse than no doc.
