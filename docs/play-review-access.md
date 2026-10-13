# Google Play review access

Play's reviewers can't create accounts, open an inbox, or make purchases, so the
Play Console **Sign in details** use a dedicated reviewer account that has an
email + password and a lifetime promotional Pro entitlement.

## What exists

- **Supabase Auth user** `play-review@nexusdigitallabs.dev`, created with the
  admin API (`email_confirm: true`, `user_metadata.purpose =
  "google-play-review"`). It is the only account with a password; users created
  by the app have none, so password sign-in is unusable for anyone else.
- **A seeded garage** (one vehicle, six fill-ups) claimed by that user, so
  reviewers land on a populated dashboard after signing in.
- **A RevenueCat promotional entitlement** `odova_pro` (lifetime) on the
  RevenueCat app user id that equals the Supabase user id. The app calls
  `Purchases.logIn(<supabase user id>)` on sign-in, and `EntitlementContext`
  listens for customer-info changes, so Pro unlocks without a restart.

## Where the credentials live

Not in this repo. They are in `~/.config/odova/play-review-credentials.json`
on the maintainer's machine (mode 600) and in the Play Console sign-in details.

## How reviewers use it

Onboarding → **Sign in** → **Sign in with a password** → email and password.
The same option is in Settings → Account for a device that already has a garage.

## Rotating the password

Run the admin update against Supabase Auth (`PUT /auth/v1/admin/users/<id>` with
a new random `password`), update the Play Console sign-in details, and update
the local credentials file. Rotate after each review cycle if you prefer.

## Granting Pro again (if the entitlement is ever revoked)

```bash
curl -X POST "https://api.revenuecat.com/v1/subscribers/<SUPABASE_USER_ID>/entitlements/odova_pro/promotional" \
  -H "Authorization: Bearer $RC_SECRET" -H "Content-Type: application/json" \
  -d '{"duration":"lifetime"}'
```

`RC_SECRET` is RevenueCat's **secret** API key (Project settings → API keys).
Keep it out of chat, shell history and the repo.
