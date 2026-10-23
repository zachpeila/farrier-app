# Farrier App

Two-sided app for farriers and horse owners: shoeing schedules, horse
records, and (soon) booking, day routes, visit records and invoicing.
US and Canada.

Built with Expo (React Native + TypeScript, Expo Router) on Supabase.

## Run it

```bash
npm install
npx expo start        # then press i (iOS), a (Android) or w (web)
```

`.env` holds the Supabase URL and publishable key. Both are safe to ship
in the client; Row Level Security in the database controls access.

### Supabase settings the app needs

- **Email sign-in code:** sign-in emails a 6-digit code. In the Supabase
  dashboard, Authentication > Email Templates > Magic Link, include
  `{{ .Token }}` in the template so the email contains the code.
- **Invite links:** add `farrierapp://**` to Authentication > URL
  Configuration > Redirect URLs (only needed once links open the app).

## Layout

- `src/app/` routes (Expo Router). `(tabs)/` is the main tab bar.
- `src/lib/database.types.ts` generated from the live schema. Regenerate
  after schema changes (Supabase MCP `generate_typescript_types` or
  `npx supabase gen types typescript --project-id bvtwxbcnswkzskyahdfs`).
- `src/lib/queries.ts` data access shared by screens.
- `src/components/ui.tsx` small shared UI kit.

## How the two sides work

- Someone picks **Farrier** or **Horse owner** at setup (stored in auth
  user metadata, switchable under Account).
- Farriers add clients and horses (`create_horse_for_client`), set a
  shoeing interval per horse (`set_shoeing_interval`), and see the
  **due list** (`due_horses` view) grouped by barn.
- Owners add their own horses (`create_own_horse`) and invite their
  farrier with a code (`provider_invites` → `accept_provider_invite`),
  which also adds the owner to the farrier's clients.
- Farriers can invite a client onto the app (`client_invites` →
  `accept_client_invite`).
- **Booking:** a farrier books a stop (`appointments` + `appointment_horses`)
  at a barn with an arrival window (`scheduled_start`/`scheduled_end`).
  Owners confirm it (`confirm_appointment`); changing the window clears
  the confirmation (database trigger). Owners can request a visit
  (`visit_requests`); the farrier accepts and books it, or declines
  (`respond_to_visit_request`). Owners cancel with `cancel_visit_request`.

## MVP build order

1. Horses, barns, clients, owner invite ✅
2. Due list ✅
3. Booking with arrival windows ✅
4. Day route
5. Visit record with per-foot entries (offline)
6. Invoice at the visit (Stripe)
7. Reminders
