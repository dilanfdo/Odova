# Architecture

## What Odova is

Odova is an Android-first (iOS-capable, not yet shipped) vehicle fuel and
maintenance tracking app built with Expo/React Native. It is a **second
client** of an existing backend — the same Supabase database and REST API
(`nexusdigitallabs.dev/api/fuel`) that already powers a browser-based "Fuel
Tracker" tool on the NexusDigitalLabs (NDL) website. Odova does not run its
own backend; it reuses the web app's schema, sync-code identity model, and
API surface so both clients read and write the same data.

This matters for anyone extending Odova: a change to the data model or API
contract has to stay compatible with (or be made in) the NDL repo, not this
one. `src/lib/fuel-utils.ts` and `src/lib/currencies.ts` are verbatim ports of
the web app's pure-TypeScript calculation files, kept in sync by hand.

## The sync-code identity model

There is no mandatory account system. Opening the app for the first time
creates a **garage** — one or more vehicles and their fill-up history — under
a randomly generated **sync code** (e.g. `mygarage-7x4p`), stored locally via
AsyncStorage and stored server-side as the row-owning key in Supabase. Anyone
who has the code can load the same garage on another device by typing it in.
No email, password, or personal information is required for this to work.

Signing in (see [accounts-and-sign-in.md](./accounts-and-sign-in.md)) is a
strictly optional, additive layer on top of this — it never replaces the sync
code, it just lets a code be "claimed" by an account so it can be restored by
logging in instead of retyping the code.

## Request flow

`src/lib/api.ts` is the single point of contact with the backend. Every
screen goes through it rather than calling Supabase directly — the app never
holds a Supabase service-role key or direct table credentials; it talks to
`/api/fuel` over plain HTTPS `fetch`, the same way the web client's React
component does. When a session exists (see accounts doc), requests carry an
`Authorization: Bearer <token>` header; when they don't, requests are
authenticated purely by knowing the sync code, exactly like the web app.

## Project layout

```
src/
  lib/            fuel-utils, currencies, api client, reminders (type + status
                   helper — CRUD lives in api.ts/GarageContext), units
                   (metric/imperial conversion), notifications, entitlements
                   (Pro), ads, supabase (Auth client), storage (AsyncStorage
                   — device-local prefs only: theme, currency, units), config
  context/        GarageContext   — sync code, vehicles, fills, the onboarding
                                     step machine
                   EntitlementContext — Pro status
                   AccountContext     — optional sign-in, session, claim/unlink
  navigation/     RootNavigator — swaps stacks based on GarageContext's `step`
                   ('onboarding' | 'vehicle_setup' | 'main')
  screens/        Onboarding, VehicleSetup, Dashboard, AddFill, AddVehicle,
                   Settings, Maintenance, AddReminder, Paywall
  components/     LineChart (react-native-svg port of the web SVG chart),
                   ProGate (soft-paywall wrapper), AdBanner, Skeleton,
                   ui.tsx (shared building blocks — see theming-and-ui.md)
  theme.tsx       Color tokens, ThemeModeProvider (light/dark/system),
                   useColors/useThemedStyles hooks
```

## Why a few things are built the way they are

- **No Supabase keys ship in the app.** Row-level security on
  `fuel_vehicles`/`fuel_fills`/`fuel_reminders` (NDL repo migrations `008`,
  `011`) means only the server-side service-role key can touch those tables;
  the app never has direct database access, only the REST endpoint.
- **`/api/fuel` needs a trailing slash.** The NDL site runs Next.js with
  `trailingSlash: true`; `src/lib/config.ts`/`api.ts` account for this. Native
  `fetch` isn't subject to CORS, so this only ever bit browser-based testing
  (`npm run web`), never a real device.
- **Maintenance reminders sync server-side**, mirroring fills — a `fuel_reminders`
  table (NDL repo migration `011`) synced via `GarageContext`, so they follow
  a garage across devices the same way vehicles and fills do (including
  restoring via a signed-in account). This used to be AsyncStorage-only,
  device-local; it was migrated once the "reminders silently don't follow you
  to a new device" gap was flagged as a real UX problem, not deferred forever.
  Local notifications (`src/lib/notifications.ts`) are still scheduled
  on-device regardless — that part necessarily stays local no matter where
  the reminder data lives.
- **Units are a presentation-layer concern only.** Storage and the API are
  always metric (km, litres) — `src/lib/units.ts` converts at the edge
  (display formatting and input parsing), controlled by a `unitSystem`
  preference in `GarageContext` (metric/imperial, AsyncStorage-persisted).
  This means adding a unit system needed zero backend changes.
