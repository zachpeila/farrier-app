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

## Server code

- `supabase/functions/` Edge Functions (Deno). Deploy with
  `supabase functions deploy <name>`.
- `supabase/migrations/` SQL to apply by hand or with the Supabase CLI;
  each file says what it needs first.

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
- **Day route:** barns get a map pin (`locations.latitude/longitude`) from
  their address or the phone's location. The route screen orders the
  day's stops (`appointments.route_order`), estimates driving distance
  between pinned barns (straight line × 1.3, saved as `planned_km`, shown
  in mi or km), and opens the whole day in Google Maps. No maps API key.
- **Visit records (offline first):** a farrier logs a visit per horse
  (`visits`, `visit_feet` per foot, `visit_flags`, `visit_photos` in the
  `visit-photos` bucket at `<horse>/<visit>/<photo>.jpg`). The visit is
  saved on the phone first (`src/lib/outbox.ts`, AsyncStorage + photos
  copied to the documents folder) with ids made on the phone, then
  upserted when there's signal, so retries are safe. Owners see visits
  the farrier shares (`shared_with_owner`). The visit's `next_due_date`
  feeds the due list.
- **Invoicing:** farriers keep a price list (`provider_services`, matched
  to a visit's `work_type`), a per-stop trip fee
  (`profiles.trip_fee_cents`) and sales taxes (`tax_rates`, with GST/HST/
  PST presets by province). An invoice built from an appointment gets a
  line per horse plus the trip fee. Subtotal, tax and totals are worked
  out by database triggers from the lines. Sending sets a due date and
  opens the share sheet with the invoice as text. Cash/cheque/other
  payments go in `payments`; triggers keep paid amounts and status.
- **Reminders:** the app saves each phone's Expo push token
  (`push_tokens`; needs an EAS project id in app config). The
  `send-reminders` Edge Function runs daily from pg_cron and sends: a
  weekly due-soon digest to farriers, a due-soon nudge to owners, "confirm
  this visit" and "visit tomorrow" to owners, and past-due invoice
  reminders. Every send is logged in `notifications`, which is also how
  repeats are avoided. Tapping a reminder opens the horse, visit or invoice.

## MVP build order

1. Horses, barns, clients, owner invite ✅
2. Due list ✅
3. Booking with arrival windows ✅
4. Day route ✅
5. Visit record with per-foot entries (offline) ✅
6. Invoice at the visit (cash/cheque ✅, Stripe cards next)
7. Reminders (push) ✅
