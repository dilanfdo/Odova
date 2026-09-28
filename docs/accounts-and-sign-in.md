# Accounts and sign-in

## What this is for

The sync code (see [architecture.md](./architecture.md)) is enough to use
Odova fully, forever, with zero sign-up. Accounts exist to solve one problem:
**"I got a new device / lost my sync code, but I remember my email."**
Signing in with a magic link lets you "link" a garage to your account so it
restores automatically when you sign in elsewhere, instead of retyping a
code. Unlinking a garage does not delete anything — the sync code keeps
working on its own either way.

This is intentionally the same account model the NDL web app already uses,
reusing its backend RPCs (`claim_fuel_garage` / `unlink_fuel_garage`) rather
than inventing a parallel one.

## Why mobile needed its own auth transport

The web app's session lives in cookies (`@supabase/ssr`) — a mobile app has
no cookie jar to share with a website. So Odova runs its own Supabase Auth
session (a JWT persisted via `AsyncStorage`, see `src/lib/supabase.ts`) and
sends it as an `Authorization: Bearer <token>` header. The backend's
`/api/fuel` route accepts *either* a cookie session or a Bearer token —
same endpoints, same RPCs, same claim/unlink logic, so no server-side
duplication was needed to support a second client type.

## Where it lives in code

- `src/context/AccountContext.tsx` — owns the session, exposes
  `sendMagicLink`, `signOut`, `deleteAccount`, and the current `session`
  object.
- `src/context/GarageContext.tsx` — has a boot-time effect that watches
  `session`: whenever a session appears and no sync code is stored yet, it
  automatically calls `restoreFromAccount()` to pull down the linked garage.
  This is also what makes onboarding's "Sign In" tab work with no extra
  plumbing — tapping the emailed link sets the session, and this existing
  effect does the rest.
- `src/screens/OnboardingScreen.tsx` — a third tab ("Sign In") alongside
  "New Garage" / "Have a Code", for the case above: a user with no local
  sync code but an existing linked account.
- `src/screens/SettingsScreen.tsx` — the "Account" section, for a user who
  already has a garage open and wants to link/unlink it, or sign in/out.

## Two real constraints hit building this (not documented anywhere, found by running it)

- **PKCE doesn't work in Hermes.** Supabase JS defaults to
  `flowType: 'pkce'`, which needs `crypto.subtle.digest` to hash the code
  verifier — not present in React Native's JS engine (confirmed live:
  "WebCrypto API is not supported"). Fixed by using `flowType: 'implicit'`
  instead, which returns `access_token`/`refresh_token` directly in the
  redirect URL's fragment (see `extractTokensFromUrl` in
  `AccountContext.tsx`) — no crypto primitive needed. A real polyfill
  (`react-native-quick-crypto` or similar) would let PKCE work, but needs a
  native build either way, so implicit flow was the pragmatic choice.
- **Supabase's Redirect URLs allowlist needs an exact-match entry that
  doesn't always match.** `Linking.createURL('auth/callback')` can produce a
  triple-slash variant (`odova:///auth/callback`) in some build
  configurations, which an exact-match `odova://auth/callback` entry in
  Supabase's Auth → URL Configuration silently fails to match — the link
  opens the app but falls back to the Site URL instead of completing
  sign-in. Fixed by adding a wildcard entry (`odova://**`) alongside the
  exact one. If magic links ever start opening the website instead of the
  app again, check this allowlist first.

## Account deletion

`deleteAccount()` (`AccountContext`) calls `POST /api/fuel
resource=delete_account` (NDL repo), which uses the service-role client's
admin API (`supabase.auth.admin.deleteUser`) — the anon/session client
can't delete its own `auth.users` row, only an admin client can. `profiles`
and `pro_entitlements` cascade-delete with it (`on delete cascade`).
Deliberately does **not** delete garage data: `fuel_vehicles.user_id` is
`on delete set null` (see `002_fuel_user_id.sql`), so any claimed garage
just falls back to anonymous sync-code-only access, the same end state as
unlinking — a user who wants the garage data gone too still has the
separate "Delete All Garage Data" button in Settings. Surfaced in
`SettingsScreen`'s Account section (signed-in state only), behind a
destructive confirmation that explains this split explicitly. This exists
mainly because Google Play's Data Safety policy requires an in-app path to
delete an account when the app allows in-app account creation, which
magic-link sign-in does.

## What's not built

- Any identity provider besides email magic link (no Google/Apple sign-in).
- Server-side enforcement tied to account identity beyond the vehicle-count
  cap — see [known-gaps.md](./known-gaps.md).
