# MeasuresOne — Full Application Documentation

> Repository: `Harsh25012005/measuresone-app`
> Generated from a direct read of the source code (not assumptions).

---

## 1. What is MeasuresOne?

**MeasuresOne** is a mobile business-management app built for **tailoring shops / garment stitching businesses** (the kind common in India — the UI text, sample data, and voice assistant are Gujarati/Hindi/English). It replaces the shop owner's paper ledger, measurement notebook, and bill book with one app that runs on a phone, works **offline**, and syncs to the cloud.

Core jobs the app does for a tailor shop owner:

1. Keep a **client (customer) directory** with phone numbers, addresses, and a "book number" (their old paper ledger number).
2. Store each client's **body measurements**, both a fixed set of common fields (chest, waist, shoulder, length, sleeve) and **shop-defined custom fields** (collar, cuff, biceps, hip, thigh, etc.).
3. Create and track **orders** (garment stitching jobs) through a status pipeline: `order_taken → cutting → stitching → ready → delivered`.
4. Generate **bills**, record **partial/full payments**, and show outstanding balances per client.
5. Manage **staff** (tailors/helpers), their wage type (daily / monthly / per-piece), and log **piece-work entries** to compute earnings.
6. Show a **dashboard** with today's deliveries, revenue, overdue orders, top clients, and a calendar of delivery/trial dates.
7. Send customers **WhatsApp** messages (order ready, payment reminders, bills) and receive **push notifications**.
8. Offer a **voice-driven Gujarati AI Order Assistant** that can create a full order (client + measurements + cloth + payment) through a spoken conversation, with no LLM — a rule-based NLU parses the transcribed speech.
9. Support **multi-language UI** (English, Gujarati, Hindi) and **light/dark theme**.
10. Work fully **offline-first**, queuing writes locally and syncing to the cloud when a connection is available.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | **React Native 0.86** + **Expo SDK 57** (managed workflow, dev client) |
| Language | **TypeScript** (strict typed navigation & DB types) |
| UI | **NativeWind v4** (Tailwind CSS for React Native) + a custom design-system component library |
| Navigation | **React Navigation v7** — native-stack + bottom-tabs, with a fully custom animated tab bar |
| Backend / BaaS | **Supabase** (Postgres, Auth, Storage, Edge Functions) via `@supabase/supabase-js` |
| Local/offline DB | **expo-sqlite** — a local mirror of the core tables, with a queue-based sync engine |
| Auth | Supabase Auth — email/password + **Google Sign-In** (native), magic-link/PKCE/token-hash deep links for signup confirmation & password reset |
| State | React Context (`AuthContext`, `ThemeContext`, `ProductTourContext`) — no Redux/MobX |
| i18n | **i18next / react-i18next**, 3 languages (`en`, `gu`, `hi`), namespaced JSON resource files |
| Push notifications | `expo-notifications` + a Supabase Edge Function (`send-push`) + a `device_tokens` table |
| Voice | `expo-speech` (text-to-speech) + `expo-speech-recognition` (speech-to-text) for the AI Order Assistant and voice dictation/search |
| Animation | React Native `Animated` (not Reanimated, deliberately — see below) for the Quick-Add menu/tab bar; `react-native-reanimated` is a dependency but avoided in Expo-Go-sensitive UI |
| Fonts | Google Sans Flex (via `@expo-google-fonts/google-sans-flex`) |
| Build/deploy | **EAS** (`eas.json`), Expo Application Services, bundle IDs `com.measuresone.app` (iOS & Android) |
| Icons | `@expo/vector-icons` (FontAwesome5, Ionicons) |
| Calendars | `react-native-calendars` |

### Notable engineering decisions found in the code
- **Offline-first architecture**: all screens read/write through a local SQLite "repository" layer; a background sync engine pushes/pulls to Supabase. The UI never calls `supabase.from()` directly for the six synced tables.
- **No LLM for the voice assistant** — it's explicitly a small rule-based keyword/pattern matcher (`lib/aiAssistant/gujaratiNlu.ts`) tuned for the exact phrasings a Gujarati-speaking shop owner would use.
- **Google Sign-In is conditionally loaded** at runtime (`require()`, not `import`) and gated behind an `isExpoGo` check, because the native module crashes Expo Go on load.
- **Reanimated is avoided** in the Quick-Add menu/tab bar because Reanimated worklets crash inside Expo Go; the classic `Animated` API is used instead so the app stays testable in Expo Go.
- A single **`AGENTS.md`** file instructs any AI coding agent (including Claude) to re-read the versioned Expo v57 docs before writing code, since "Expo HAS CHANGED" — `CLAUDE.md` simply includes it via `@AGENTS.md`.

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                           App.tsx                              │
│  loads fonts, i18n, theme → wraps app in providers:            │
│  ThemeProvider → SafeAreaProvider → ToastProvider →            │
│  AuthProvider → ProductTourProvider → RootNavigator            │
└──────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │      RootNavigator        │  (chooses flow by auth state)
                 └────────────┬────────────┘
      ┌───────────┬───────────┼───────────────┬───────────────┐
      │           │           │               │               │
  no session   password    no shop yet     shop exists     (always)
      │        recovery link                  │
      ▼           ▼           ▼               ▼
 AuthNavigator ResetPassword ShopSetupScreen  MainNavigator (4 tabs)
```

```
MainNavigator (bottom tabs, custom tab bar + centre "Add" button)
 ├── DashboardTab  → DashboardNavigator
 ├── CustomersTab  → CustomersNavigator
 ├── OrdersTab     → OrdersNavigator
 └── SettingsTab   → SettingsNavigator (nests BillingNavigator inside it)
```

### Data flow (offline-first)
```
Screen ──calls──▶ repository.ts (customersRepo / ordersRepo / billsRepo / ...)
                        │
             ┌──────────┴───────────┐
             ▼                       ▼
      local SQLite (db.ts)     pending_ops queue (writes)
             │                       │
             │                kickSync() fire-and-forget
             ▼                       ▼
      instant UI read        sync.ts → pushes queued ops to Supabase,
                              then pulls fresh rows back into SQLite
```
- Reads always come from the local SQLite mirror → instant, offline-capable UI.
- Writes go to SQLite immediately, are appended to a `pending_ops` table, and are pushed to Supabase by `sync.ts` the next time `runSync()` fires (triggered after every write, on network reconnect via `NetInfo`, and periodically).
- Sync is **per-shop** (multi-tenant: everything is scoped by `shop_id`), and pulls use a watermark column (`updated_at` or `created_at`/`payment_date`) so only changed rows are re-fetched.
- A single serialized `dbQueue` (`runExclusive`) prevents overlapping SQLite transactions between concurrent writes and the sync engine.

---

## 4. Backend Data Model (Supabase / Postgres)

Derived from `lib/database.types.ts` (Supabase-generated types) and mirrored locally in `lib/data/db.ts`.

### Tables

#### `shops`
The tenant root — one row per business/shop, owned by one Supabase Auth user.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | FK → auth user |
| shop_name | text | required |
| owner_name | text | required |
| address | text? | |
| phone | text? | |
| logo_url | text? | shop logo image |
| primary_color | text | brand color, default set |
| rush_fee_percent | number | % surcharge applied to rush/urgent orders |
| has_tailoring | boolean | business-type flag |
| has_seen_guide | boolean | product tour flag |
| onboarding_checklist | jsonb | tracks first customer/order/staff/bill milestones |
| created_at | timestamp | |

#### `customers`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| shop_id | uuid | FK |
| name | text | required |
| phone | text? | 10-digit, validated in UI |
| address | text? | |
| book_number | text? | legacy paper ledger number ("Client No.") |
| created_at / updated_at | timestamp | |

#### `measurements`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| shop_id, customer_id | uuid | FK |
| garment_type | text | `shirt` / `pant` / `shirt+pant` |
| chest, waist, shoulder, length, sleeve | number? | legacy fixed numeric columns |
| pant_cloth, shirt_cloth | number? | cloth quantity (m) |
| custom_fields | jsonb | array of `{ label, value }` — shop-defined fields |
| notes | text? | fitting notes |
| updated_at | timestamp | |

#### `measurement_field_definitions`
Per-shop configurable measurement fields (Settings → Custom Measurement Fields).
| Column | Type |
|---|---|
| id, shop_id | uuid |
| field_key | text |
| label | text |
| input_type | text (default) |
| sort_order | int |

#### `orders`
The central entity — one garment-stitching job.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| shop_id, customer_id | uuid | FK |
| order_number | text | e.g. `ORD-12`, auto-incremented from highest existing number |
| cloth_type, cloth_count | text? / int? | |
| design_photo_url | text? | legacy single-photo field |
| design_photo_urls | text[] | current multi-photo array (shirt/pant photo sets) |
| measurement_id | uuid? | FK → measurements |
| order_date | date | |
| delivery_date | date? | can be auto-suggested |
| trial_date | date? | |
| status | enum | `order_taken` \| `cutting` \| `stitching` \| `ready` \| `delivered` |
| priority | enum | `normal` \| `urgent` |
| is_rush | boolean | |
| rush_fee | number? | derived from shop's `rush_fee_percent` |
| assigned_staff_id | uuid? | FK → staff |
| bill_book_number | text? | |
| total_amount, paid_amount | number | |
| payment_mode | text? | `Cash` / `UPI` / etc. |
| created_at / updated_at | timestamp | |

#### `order_items`
Line items within an order (per-garment breakdown, e.g. multiple shirts + pants in one order).
| Column | Type |
|---|---|
| id, shop_id, order_id | uuid |
| garment_type | text |
| cloth_count | int |
| unit_price | number |
| notes | text? |
| measurement_id | uuid? |
| created_at | timestamp |

#### `staff`
| Column | Type | Notes |
|---|---|---|
| id, shop_id | uuid | |
| name, phone?, role? | text | |
| wage_type | enum | `daily` \| `monthly` \| `per_piece` |
| wage_amount | number | base/day/month rate |
| wage_amount_pant, wage_amount_shirt, wage_amount_pair | number? | per-piece rates |
| is_active | boolean | |
| created_at / updated_at | timestamp | |

#### `staff_orders`
Assignment/task linkage between staff and orders.
| Column | Type |
|---|---|
| id, shop_id, order_id, staff_id | uuid |
| task | text? |
| assigned_at, completed_at | timestamp? |

#### `staff_work_entries`
Piece-work log used to compute earnings.
| Column | Type |
|---|---|
| id, shop_id, staff_id | uuid |
| work_type | enum: `pant` \| `shirt` \| `pant_shirt` |
| quantity | int |
| rate_applied | number | rate captured at entry time |
| work_date | date |
| created_at | timestamp |

#### `bills`
| Column | Type |
|---|---|
| id, shop_id, customer_id | uuid |
| order_id | uuid? (nullable — a bill can be standalone or linked to an order) |
| fabric_cost, stitching_charge, discount, tax | number |
| total_amount | number? |
| payment_status | enum: `paid` \| `partial` \| `unpaid` |
| created_at / updated_at | timestamp |

#### `payments`
| Column | Type |
|---|---|
| id, shop_id, bill_id, customer_id | uuid |
| amount_paid | number |
| payment_mode | text? (`Cash`, `UPI`, `Card`, `Bank Transfer`) |
| payment_date | timestamp |

#### `device_tokens`
Push-notification registration per device.
| Column | Type |
|---|---|
| id, shop_id | uuid |
| staff_id | uuid? |
| expo_push_token | text |
| platform | text |
| created_at | timestamp |

#### `notifications_log`
Server-side record of sent notifications.
| Column | Type |
|---|---|
| id, shop_id, customer_id? | uuid |
| type | enum: `order_ready` \| `payment_due` |
| status | enum: `pending` \| `sent` \| `failed` |
| sent_at | timestamp? |

### Enums (Postgres)
```
notification_status : pending | sent | failed
notification_type   : order_ready | payment_due
order_priority       : normal | urgent
order_status          : order_taken | cutting | stitching | ready | delivered
payment_status        : paid | partial | unpaid
wage_type              : daily | monthly | per_piece
work_item_type          : pant | shirt | pant_shirt
```

### Locally synced entities (SQLite mirror)
Only these 6 tables are mirrored offline and synced (see `SYNCED_ENTITIES` in `lib/data/db.ts`):
`customers`, `orders`, `order_items`, `staff`, `bills`, `payments`
(`measurements`, `staff_work_entries`, `staff_orders`, `notifications_log`, `device_tokens`, `shops`, `measurement_field_definitions` are read/written directly against Supabase — they're either shop-scoped singletons or not needed offline.)

---

## 5. Application Structure / Folder Layout

```
measuresone-app/
├── App.tsx                       # Root component: providers, font/i18n/theme bootstrap
├── index.ts                      # Expo entry point
├── app.config.js                 # Expo app config (bundle IDs, plugins, env vars, permissions)
├── eas.json                      # EAS Build profiles
├── babel.config.js / metro.config.js / tailwind.config.js / tsconfig.json
├── global.css                    # Tailwind base styles (NativeWind)
├── credentials.json              # (build signing credentials reference)
├── .env.example                  # SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, GOOGLE_* vars
├── CLAUDE.md → AGENTS.md          # AI coding-agent instructions ("Expo HAS CHANGED")
│
├── assets/                       # App icons, splash, logo, email templates (HTML)
│   └── email-templates/          # confirm-signup.html, reset-password.html (Supabase auth emails)
│
├── locales/                      # i18next resources
│   ├── en/  gu/  hi/              # each has: common, auth, dashboard, customers,
│   │                              # orders, billing, staff, revenue, settings .json
│
├── types/
│   └── index.ts                  # App-level types derived from Supabase types
│                                  # (Shop, Customer, Order, Bill, Payment, Staff, ...
│                                  #  + joined view types: OrderWithRelations, BillWithRelations)
│
├── lib/
│   ├── supabase.ts                # Supabase client init
│   ├── database.types.ts          # Supabase-generated DB schema types
│   ├── i18n.ts                    # i18next setup, language persistence
│   ├── theme.ts                    # theme persistence (light/dark/system)
│   ├── format.ts                   # currency/date formatting helpers
│   ├── haptics.ts                  # haptic feedback wrapper
│   ├── storage.ts                  # AsyncStorage helpers
│   ├── notify.ts                    # invokes Supabase Edge Function "send-push"
│   ├── push.ts                      # Expo push token registration
│   ├── whatsapp.ts                  # WhatsApp deep-link message sending + message templates
│   ├── mailApp.ts                    # opens the user's mail app (email client deep links)
│   ├── measurementFields.ts           # flattens legacy + custom measurement fields for display
│   ├── orderScheduling.ts              # suggests a delivery date from garment count + staff backlog
│   ├── productTour.ts                   # tracks whether the onboarding tour has been seen
│   ├── aiAssistant/
│   │   └── gujaratiNlu.ts               # rule-based Gujarati/English NLU for the voice assistant
│   └── data/
│       ├── db.ts                         # SQLite schema + connection + migration + tx queue
│       ├── repository.ts                  # customersRepo / ordersRepo / billsRepo / staffRepo / paymentsRepo
│       └── sync.ts                         # pull/push sync engine, NetInfo-triggered auto-sync
│
├── context/
│   ├── AuthContext.tsx             # session, shop, sign in/up/out, Google auth, password reset, deep links
│   ├── ThemeContext.tsx            # light/dark/system theme state + colors
│   └── ProductTourContext.tsx      # guided-tour step state machine
│
├── navigation/
│   ├── types.ts                    # All param lists (typed routes) for every stack
│   ├── RootNavigator.tsx           # Auth / ResetPassword / ShopSetup / Main switch
│   ├── MainNavigator.tsx           # bottom tab navigator + custom tab bar + Quick-Add
│   ├── CustomTabBar.tsx            # fully custom animated tab bar with notch for Add button
│   ├── AuthNavigator.tsx           # Login/Signup/ForgotPassword/ConfirmEmail/ComponentShowcase
│   ├── DashboardNavigator.tsx      # Dashboard + everything reachable from it
│   ├── CustomersNavigator.tsx      # Customer list/detail/form + order/bill screens
│   ├── OrdersNavigator.tsx         # Order list + order/bill screens
│   ├── BillingNavigator.tsx        # Billing list + bill screens (nested inside Settings)
│   └── SettingsNavigator.tsx       # Settings + Shop/Staff/Revenue/Custom Fields/Billing
│
├── components/
│   ├── QuickAddMenu.tsx             # the circular "+" action sheet (custom SVG-notch UI)
│   ├── ProductTourWelcome.tsx        # first-run guided tour modal
│   ├── ProductTourSpotlight.tsx       # highlights specific UI during the tour
│   └── ui/                             # design-system component library (see §8)
│
├── screens/
│   ├── ComponentShowcaseScreen.tsx    # internal dev screen to preview all UI components
│   ├── onboarding/ShopSetupScreen.tsx
│   ├── auth/  (Login, Signup, ForgotPassword, ConfirmEmail, ResetPassword)
│   ├── dashboard/ (Dashboard, Calendar, Search, Notifications, Transactions)
│   ├── ai/ AIOrderAssistantScreen.tsx  # voice-driven order creation
│   ├── customers/ (CustomerList, CustomerDetail, CustomerForm, MeasurementForm)
│   ├── orders/ (OrderList, OrderDetail, OrderForm)
│   ├── billing/ (BillingList, BillDetail, BillForm)
│   ├── staff/ (StaffList, StaffDetail, StaffForm, StaffWorkEntryForm)
│   ├── revenue/RevenueScreen.tsx
│   └── settings/ (Settings, ShopEdit, CustomMeasurementFields)
│
├── scripts/
│   └── generate-icons.js            # generates app icon assets
│
└── docs/
    └── email-templates/              # duplicate of the Supabase auth email HTML templates
```

---

## 6. Navigation Map (screen-by-screen flow)

### 6.1 Root-level flow (`RootNavigator`)
```
                 ┌──────────────┐
   no session →  │ AuthNavigator │
                 └──────────────┘
   password-recovery deep link →  ResetPasswordScreen
   session but no shop row yet →  ShopSetupScreen (onboarding)
   session + shop  →              MainNavigator (the actual app)
```

### 6.2 Auth flow
`Login → Signup → ForgotPassword → ConfirmEmail`
- **LoginScreen**: email/password + "Sign in with Google" button.
- **SignupScreen**: creates a Supabase auth user; detects "already registered" via Supabase's empty-`identities` trick.
- **ForgotPasswordScreen**: sends a reset email; sets a pending-recovery flag in AsyncStorage (needed because PKCE reset links can drop the `type=recovery` query param).
- **ConfirmEmailScreen**: shown after signup, can resend the confirmation email.
- **ResetPasswordScreen** (root-level, gated by `passwordRecovery` state): set a new password after tapping the emailed link.
- **ComponentShowcaseScreen**: a hidden dev-only screen listing all `components/ui` primitives (reachable from the Auth stack for design QA).

### 6.3 Onboarding
- **ShopSetupScreen**: first-run form to create the `shops` row (shop name, owner name, address, phone, tailoring toggle). Required before the main app unlocks.

### 6.4 Main app — 4 bottom tabs + centre "Add" button
The tab bar (`CustomTabBar.tsx`) is a **custom-drawn SVG bar** with a scalloped notch that a floating circular **Add** button sits inside. Tapping Add opens `QuickAddMenu` — a bottom sheet with shortcuts (e.g. + New Client, + New Order, + New Bill, + AI Assistant) rather than navigating to a 5th tab.

**Tab 1 — Dashboard** (`DashboardNavigator`)
- `DashboardScreen` — home screen: greeting, onboarding checklist, "Due Today" / "This Month Revenue" / "Owed Today" / "Today's Deliveries" stat cards, overdue-orders alert banner, Top Clients list, recent transaction history, calendar shortcut, search shortcut.
  - → `OrderForm`, `OrderDetail`, `BillForm`, `BillDetail`
  - → `Notifications` (order-ready / payment-due notification feed)
  - → `Calendar` (delivery & trial dates per day)
  - → `Transactions` (full payment/transaction history, searchable)
  - → `Search` (voice or text search across clients)
  - → `AIOrderAssistant` (Gujarati voice order flow)

**Tab 2 — Customers** (`CustomersNavigator`)
- `CustomerListScreen` — searchable/filterable client list (filter: has balance due).
  - → `CustomerDetailScreen` (tabs: **Profile / Orders / Bills**; shows outstanding balance, measurements list, order history, "Send Payment Reminder" via WhatsApp, edit/delete)
    - → `CustomerFormScreen` (add/edit client: name, phone, address, book number)
    - → `MeasurementFormScreen` (add/edit a measurement set: garment type, legacy/custom fields, notes)
    - → `OrderFormScreen`, `OrderDetailScreen`, `BillFormScreen`, `BillDetailScreen`

**Tab 3 — Orders** (`OrdersNavigator`)
- `OrderListScreen` — searchable/filterable order list (filter: priority, show/hide delivered).
  - → `OrderFormScreen` (multi-step wizard — see §7)
  - → `OrderDetailScreen` (status stepper, design photos, measurement snapshot, assigned staff, payment summary, WhatsApp actions, mark complete, delete)
  - → `BillFormScreen`, `BillDetailScreen`

**Tab 4 — Settings** (`SettingsNavigator`)
- `SettingsScreen` — shop info summary, language switch, theme switch (Light/Dark/System), links to sub-sections, Sign Out.
  - → `ShopEditScreen` (shop logo, name, owner name, address, phone, rush-fee %)
  - → `StaffListScreen` → `StaffFormScreen` / `StaffDetailScreen` → `StaffWorkEntryFormScreen`
  - → `RevenueScreen` (revenue/earnings summary — see §7)
  - → `Billing` (nests the entire `BillingNavigator`: `BillingListScreen` → `BillFormScreen` / `BillDetailScreen`) — billing no longer has its own bottom tab; it lives under Settings.
  - → `CustomMeasurementFieldsScreen` (shop-defined measurement field manager)

### 6.5 Shared routes
`OrderForm`, `OrderDetail`, `BillForm`, `BillDetail` are registered identically in **three different stacks** (Dashboard, Customers, Orders) via a shared `SharedOrderRoutes` type, so the same order/bill can be opened from wherever the user's flow started, with consistent params (`{ customerId?, orderId? }` / `{ orderId?, customerId? }` / `{ billId }`).

---

## 7. Screens — Purpose, Fields & Flows in Detail

### 7.1 Dashboard (`DashboardScreen.tsx`)
- Greeting header with owner name.
- First-run **onboarding checklist** (add first customer → create first order → add staff → create first bill), tracked in `shops.onboarding_checklist`.
- Stat cards: **Due Today**, **This Month Revenue**, **Owed Today**, **Today's Deliveries**.
- **Overdue alert** banner (tap → filtered order list).
- **Top Clients** list (most frequent/highest-value).
- **Recent transactions** (payments) with a "View all" → Transactions screen.
- Search bar → `SearchScreen` (supports **voice search** via mic icon).
- Calendar nav icon → `CalendarScreen`.
- Notification bell → `NotificationsScreen`.
- Centre **Add** button → `QuickAddMenu`.

### 7.2 Order Form (`OrderFormScreen.tsx`, ~970 lines) — the most complex screen
A **multi-step wizard** (`stepOf` / `stepTitles`: *Who & What → Measurements & Photos → When's it due? → Payment*, collapsing into fewer steps on the simpler "quick create" mode):
| Field | Type | Notes |
|---|---|---|
| Customer | Dropdown (searchable) | select existing or "+ Add Client" inline (Quick Add sheet) |
| Garment Type | Dropdown | Shirt / Pant / Shirt+Pant, or multiple garment line-items |
| Shirt / Pant Quantity | Number inputs | per garment type, feeds `order_items` |
| Number of Cloth Pieces | Number input | |
| Measurement | Dropdown / inline form | pick an existing saved measurement or add a new one on the spot |
| Design Photos | Image picker (camera or gallery) | separate Shirt Photos / Pant Photos galleries, multiple images each |
| Item Notes | Text (+ voice dictation mic) | |
| Delivery Date | Date picker | **auto-suggested** via `orderScheduling.ts` (base 2 days + 1 day/garment + 0.5 day per open order already assigned to that staff member, skipping Sundays) — user can override |
| Trial Date | Date picker | |
| Rush order? | Yes/No radio | if yes, computes `rush_fee` from `shop.rush_fee_percent` |
| Assign Staff | Dropdown | list of active staff |
| Bill Book Number | Text | legacy paper bill-book cross-reference |
| Total Amount / Paid Amount | Number inputs | on create; once a bill exists, further payment edits happen from the Bill screen instead |
| Payment Mode | Radio | Cash / UPI (UPI shows a confirm-completed dialog) |

On save: creates the `orders` row (+ `order_items`), auto-creates a linked `bills` row, and shows a success toast with the paid/due breakdown. Edit mode reuses the same screen (`editTitle`/`updateOrder`).

### 7.3 Order Detail (`OrderDetailScreen.tsx`)
- Order number / token badge, urgent badge, delivery-date badge.
- **Status stepper** (`OrderProgressStepper` component) — `order_taken → cutting → stitching → ready → delivered`, tap to advance.
- Design photo gallery.
- Order details (dates, bill book number).
- Measurement snapshot (chest/waist/shoulder/length/sleeve/pant cloth/shirt cloth + custom fields, via `measurementFields.ts`).
- Assigned staff.
- Payment summary (total/paid/balance due, payment mode) + "View Bill / Record Payment" link.
- **Customer messages**: "Send completion message" and "Send Payment Reminder" — both open pre-filled WhatsApp messages.
- Mark Complete / Delete Order (with confirmation dialog — cascades to delete the linked bill too).

### 7.4 Customer List / Detail / Form
- **List**: search by name/phone, filter "has balance due", empty states for first-run vs. no-search-match.
- **Detail**: 3 tabs — **Profile** (contact info, outstanding balance, book number, measurements list with add/edit/delete, "Send Payment Reminder"), **Orders** (searchable order history for this client, "+ New Order"), **Bills** (searchable bill history, "+ Bill").
- **Form**: Name*, Phone* (10-digit validated), Address, Client No. (book number)*. After saving a *new* client it optionally prompts "Add measurements now?".

### 7.5 Measurement Form (`MeasurementFormScreen.tsx`)
- Garment Type: Shirt / Pant / Shirt+Pant.
- **Shirt Measurements** section: Chest, Shoulder, Sleeve Length, Shirt Length, Collar, Cuff, Biceps, Stomach (all in inches).
- **Pant Measurements** section: Waist, Seat, Pant Length, Hip, Thigh, Knee, Bottom, Crotch (all in inches).
- **Custom Fields**: shop-defined, arbitrary label/value pairs (e.g. anything added in Settings → Custom Measurement Fields), stored as JSON.
- Notes (free text, fitting instructions).
- Falls back to "No measurement fields set up yet" if the shop hasn't defined any custom fields.

### 7.6 Order List (`OrderListScreen.tsx`)
- Search by order number or customer.
- Filter modal: priority (Normal/Urgent), toggle to show/hide delivered (completed) orders — with a count badge.
- "All caught up" empty state when everything active is done, showing how many completed orders are hidden.
- List item: token badge, delivery badge, urgent flag, piece count, customer name.

### 7.7 Billing (List / Detail / Form)
- **List**: search by client name, filter by payment status (Paid/Partial/Unpaid), shows last-bill date, bill count, and outstanding amount per client. A **"Collect"** section highlights money owed across all clients (`Money to Collect`) with a total.
- **Detail**: total/paid/balance, customer name & phone, "linked to an order" indicator, itemized breakdown (Fabric Cost, Stitching Charge, Tax, Discount), payment history list, **Record Payment** sheet (amount, capped at pending balance), **Share Bill via WhatsApp**, delete bill.
- **Form**: pick customer, choose "Paid in Full" vs "Not Paid Yet", either a single **Bill Amount** or **split into items** (Fabric Cost / Stitching Charge / Discount / Tax with an auto-computed total), optional prompt to send the bill to the client via WhatsApp immediately after saving.

### 7.8 Staff (List / Detail / Form / Work Entry)
- **List**: search by name/phone, filter by wage type.
- **Form**: Name*, Phone, Wage Type (Daily/Monthly/Per Piece), Wage Amount, and if per-piece: **Price per Pant**, **Price per Shirt** (and implicitly a pair rate).
- **Detail**: performance report (this month / last month / all-time earnings), "Send earnings message" (WhatsApp), Work Entries log with running piece-work total, "Add Work Entry", edit/delete staff (deleting unassigns their orders rather than deleting them).
- **Work Entry Form**: Work Date, Work Type (Pant/Shirt/Pant+Shirt), Quantity, shows the applied rate and computed total pay; warns if no per-piece rate is configured for that type.

### 7.9 Revenue (`RevenueScreen.tsx`)
- Total Revenue (note: "based on payments actually received", not just billed amounts).
- This Month / Today breakdowns.
- Summary: Payments received, Staff piece-work cost, **Net earnings**, Outstanding from customers.
- Month-by-month revenue history/chart.

### 7.10 Settings
- Shop summary + tailoring-enabled flag, language switch (English/Gujarati/Hindi), appearance (Light/Dark/System), links to Business (Billing & Payments, Staff Management, Revenue, Custom Measurement Fields), Help (How to Use This App — re-triggers the guided tour), Sign Out (confirmation dialog).
- **Shop Edit**: logo upload, shop name*, owner name*, address, phone, rush-order fee %.
- **Custom Measurement Fields**: add/remove shop-wide custom measurement field names (duplicate-name guard), shown to every client's measurement form afterward.

### 7.11 Dashboard sub-screens
- **Calendar**: month view; days with deliveries/trials are marked; tapping a day lists "Delivery — #N" / "Trial — #N" entries.
- **Search**: text or **voice search** for clients; "No client found → Add as new client".
- **Notifications**: feed of order-ready / payment-due notifications with relative timestamps (just now / Nm ago / Nh ago / Nd ago).
- **Transactions**: full searchable payment/transaction history.

### 7.12 AI Order Assistant (`AIOrderAssistantScreen.tsx`) — Voice Ordering Flow
A **guided, spoken conversation** (text-to-speech questions via `expo-speech`, speech-to-text answers via `expo-speech-recognition`) that walks the shop owner through creating a complete order hands-free, mostly in **Gujarati**:

```
greeting → askIntent → askClientType (new/existing/unknown)
   → collectNewClient (name + phone by voice) OR
     collectExistingClientSearch → chooseClientFromList (or confirmCreateNewFallback)
   → askMeasurementOrOrder
   → askGarmentForMeasurement → collectMeasurementField (loops per field) → confirmMeasurementDone
   → askClothCount → askTotalAmount → askDiscount
   → confirmWhatsApp (send confirmation over WhatsApp?)
   → done  (order + measurement + customer created; order number auto-generated as ORD-N)
```
- Uses small rule-based parsers (`gujaratiNlu.ts`): yes/no detection, new-vs-existing-client detection, garment choice (Shirt/Pant/Shirt+Pant), first-number extraction (digits and Gujarati number words एक/બે/ત્રણ...), 10-digit phone extraction, name-around-phone cleanup, and "pair"-aware cloth-count parsing.
- On completion, sends a **Gujarati WhatsApp confirmation message** with the order number, item, quantity and total, always in Gujarati regardless of the app's UI language (this is deliberate per the code comments).

---

## 8. UI Component Library (`components/ui/`)

A self-built design system (NativeWind-styled), consistently reused across every screen/form:

| Component | Purpose |
|---|---|
| `Button` | primary/secondary/etc. variants & sizes |
| `InputField` | labeled text input with validation/error state |
| `Card` | content container |
| `Badge` | small status/label chip (e.g. Urgent, Token #) |
| `Checkbox` | boolean toggle |
| `RadioGroup` / `RadioButton` | single-select choice sets (priority, payment mode, etc.) |
| `Dropdown` | searchable select (customer picker, garment type, staff, wage type) |
| `Toggle` | switch |
| `Avatar` | initials/photo circle |
| `Modal` — `BottomSheet` / `CenterModal` | sheet & centered dialog primitives |
| `DatePickerField` | native date picker wrapper |
| `ImagePickerField` | camera/gallery photo picker |
| `Header` | screen header (title, back button, actions) |
| `EmptyState` | "no data yet" illustration + CTA |
| `LoadingSpinner` | full-screen or inline loading |
| `ToastProvider` / `useToast` | app-wide toast notifications |
| `GoogleIcon` | Google "G" logo for the sign-in button |
| `SearchBar` | search input with icon |
| `OrderProgressStepper` | the 5-stage order status visual stepper |
| `QuickAddCustomerSheet` | inline "add a client without leaving this screen" sheet |
| `VoiceListeningOverlay` | full-screen "listening…" overlay for voice input |
| `RecordPaymentSheet` | bottom sheet to record a payment against a bill |
| `FilterNotice` | banner showing active filters with a reset action |

Plus app-level components:
- `QuickAddMenu` — the custom SVG-drawn action sheet opened from the centre tab-bar "+" button.
- `ProductTourWelcome` / `ProductTourSpotlight` — first-run guided tour (welcome modal + step-by-step spotlight highlighting Customers → Orders → Billing → Staff).

---

## 9. Cross-Cutting Features

### 9.1 Internationalization (i18n)
- Languages: **English (`en`)**, **Gujarati (`gu`)**, **Hindi (`hi`)** — auto-detected from device locale on first run, then persisted (`AsyncStorage`, key `apna-kapad:language`), changeable from Settings.
- 9 namespaces per language: `common`, `orders`, `customers`, `staff`, `billing`, `dashboard`, `settings`, `auth`, `revenue`.
- Every screen's copy (labels, placeholders, validation errors, empty states, confirmation dialogs) is fully translated across all three languages.

### 9.2 Theming
- Light / Dark / **System** modes, persisted, applied consistently via a `useTheme()` hook and NativeWind's `dark:` classes; the status bar background/style is dynamically matched to the current page background.

### 9.3 WhatsApp Integration (`lib/whatsapp.ts`)
- Deep-links into WhatsApp (`whatsapp://send`) with a `wa.me` fallback (handles Android 11+ package-visibility restrictions by attempting the open and catching failures rather than using `canOpenURL`).
- Message templates: order-ready, bill summary, payment-due reminder, and a Gujarati AI-assistant order confirmation.
- Phone numbers are normalized to `91XXXXXXXXXX` (India country code) when a bare 10-digit number is stored.

### 9.4 Push Notifications
- Registers the device's Expo push token (`registerForPushNotifications`) against the shop in `device_tokens`, skipped gracefully in Expo Go / simulators / without FCM credentials.
- Sending is server-side via a Supabase Edge Function `send-push`, invoked from `lib/notify.ts` for `order_ready` / `payment_due` events — always best-effort/non-blocking.

### 9.5 Authentication (`AuthContext.tsx`)
- Email/password sign-up & sign-in (Supabase Auth).
- **Google Sign-In** (native, custom dev build only — not available in Expo Go).
- Email confirmation flow with resend.
- Password reset via deep link (`measuresone://reset-password`), handling all three Supabase link shapes (implicit URL fragment tokens, PKCE `?code=`, and hashed `?token_hash=&type=`) and disambiguating a password-recovery link from a normal sign-in link.
- On sign-in, loads/creates the user's `shops` row and starts the offline sync engine + push registration.

### 9.6 Offline Sync Engine (`lib/data/sync.ts`, `lib/data/db.ts`, `lib/data/repository.ts`)
- `runSync(shopId)`: pulls incremental changes per synced table (watermark-based), then pushes any queued local writes (`pending_ops`) back to Supabase, retrying failed ops on the next run without blocking new ones.
- Auto-sync triggers on network reconnect (`NetInfo`) and after every local write (`kickSync`).
- All local database access is serialized through a single promise queue (`runExclusive`) to avoid SQLite's lack of nested-transaction support.

### 9.7 Order Scheduling Heuristic (`lib/orderScheduling.ts`)
Suggests (never forces) a delivery date:
```
delivery date = today + 2 base days
                     + 1 day per garment in the order
                     + 0.5 day × (assigned staff's current open-order count)
                (skipping Sundays)
```

### 9.8 Product Tour / Onboarding
- First-run **guided tour**: Welcome modal → spotlighted walkthrough of adding a customer → creating an order → raising a bill → adding staff, tracked per-user in AsyncStorage (`hasSeenProductTour` / `markProductTourSeen`) so a second account on the same device still sees it.
- Separate **dashboard checklist** (`has add first customer / created first order / added first staff / sent first bill`) persisted server-side in `shops.onboarding_checklist`.

---

## 10. Build & Environment

- **Env vars** (`.env.example`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME`.
- **App identity**: name `MeasuresOne`, slug `measuresone`, scheme `measuresone://`, bundle/package id `com.measuresone.app` on both iOS and Android.
- **EAS project ID**: `4623e4e2-cc7b-421b-8aff-d3021c25c452` (`eas.json` defines build profiles).
- **Permissions requested**: camera & photo library (design photos), microphone & speech recognition (voice dictation/search/AI assistant), notifications.
- **iOS `LSApplicationQueriesSchemes`**: whitelist of mail-client URL schemes (Gmail, Outlook, Yahoo Mail, ProtonMail, Spark, generic `message`) so the app can detect/open the user's mail app for email-related flows.
- **Scripts**: `npm start` (Expo dev server), `npm run android` / `ios` (native builds via `expo run:*`), `npm run web`, `npm run typecheck` (`tsc --noEmit`).

---

## 11. Summary — What Kind of Product Is This?

MeasuresOne is a **vertical SaaS-style mobile app for tailoring/garment shops**, most directly aimed at the Indian tailoring trade (Gujarati-first voice UX, INR-style bill breakdowns, WhatsApp-centric customer communication, "book number" ledger continuity). It functions as an **all-in-one shop operating system**:

- CRM (clients + measurements)
- Job/production tracker (orders through a cutting→stitching→ready→delivered pipeline)
- Invoicing & payments ledger
- Payroll/piece-work tracker for tailoring staff
- Owner-facing analytics (dashboard + revenue reports)
- A hands-free voice assistant to take a full order without typing

...built offline-first on Expo/React Native with Supabase as the backing cloud service, so it keeps working on a shop floor with unreliable connectivity and syncs automatically once back online.
