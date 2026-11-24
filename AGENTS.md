# KhataFlow — Context for AI/Developers

## Overview
Expo SDK 54 / React Native app for Indian kirana store billing & khata (ledger) management. Bilingual (English/Hindi). Phone-based OTP auth. Backend: Laravel API at `https://khata-flow-api.onrender.com/api`.

## Critical Rules
- **Always read exact Expo SDK 54 docs** at https://docs.expo.dev/versions/v54.0.0/ before writing code.
- **Never use AsyncStorage for auth tokens** — use `expo-secure-store`.
- **No external state libraries** — use React Context only.
- **File-based routing** via `expo-router` v6 — routes defined by `app/` directory structure.
- **New Architecture enabled** (`newArchEnabled: true` in app.json).

## Tech Stack
- **Expo SDK ~54.0.33** with `expo-router` ~6.0.23
- **TypeScript** strict mode, `@/` path alias to project root
- **i18next** ^26.3.0 + **react-i18next** ^17.0.8 (English + Hindi)
- **react-native-reanimated** ~4.1.1
- **expo-secure-store** ~15.0.8
- **expo-speech-recognition** ^3.1.3 (on-device STT; native module — needs a dev/prod build, does not work in Expo Go)
- **expo-font** (Inter, Lexend, NotoSansDevanagari)
- **expo-print** + **expo-sharing** (PDF invoice generation)
- **Build**: EAS with 4 profiles (development, preview, production, universal-apk)

## Project Structure
```
khata-flow/
  app/                        — File-based routes (expo-router)
    _layout.tsx               — Root: fonts, i18n init, AuthProvider, ToastProvider, Stack
    index.tsx                 — Redirects to /splash
    splash.tsx                — Animated splash + auth/language routing logic
    language-select.tsx       — English/Hindi picker (shows only once ever)
    login.tsx                 — Phone + OTP two-step auth
    shop-setup.tsx            — 3-step wizard (Details → Location → Logo)
    edit-profile.tsx          — Edit shop with image picker
    (tabs)/                   — Bottom tabs: Dashboard, Customers, Inventory, Reports, Settings, Sync
    bill/                     — Stack nav wrapped in BillProvider: voice, items, search, review, success, history, detail, modals
    customers/                — Stack: list, add, [id] detail
    inventory/                — Stack: list, add, stock-in
    reports/                  — Daily/monthly/custom tabs, PDF export
    modals/                   — low-stock-alert, expense-add
  components/                 — Loader, FullScreenLoader, toast-provider, SidebarDrawer, themed-text/view, etc.
  constants/theme.ts          — Colors (light/dark), Tokens, Typography, Spacing, BorderRadius
  hooks/                      — use-color-scheme, use-theme-color
  lib/
    api.ts                    — Typed API client (30+ methods), 401 interceptor → forceSignOut
    auth-context.tsx          — AuthProvider: signIn, signOut, forceSignOut, setUser; loads from SecureStore
    bill-context.tsx          — BillProvider: items, customer, paymentMode, discount, GST, resetBill
    i18n.ts                   — initI18n, hasStoredLanguage, changeLanguage, getCurrentLanguage
    bill-pdf.ts               — shareInvoicePdf, shareOnWhatsApp (Android intent)
    voice-parser.ts           — local rule-based fallback parser (catalog/alias matching) used when /voice/parse fails
  locales/
    en.json                   — ~800 English translations
    hi.json                   — ~800 Hindi translations
  assets/images/              — icon, splash-icon, logo, adaptive-icon, android/ multi-res
```

## Navigation Flow
```
App Open → _layout (fonts + i18n init) → splash.tsx
  → stored language? No → /language-select → /login
  → stored language? Yes → /login
  → auth token exists (has_shop)? → /(tabs)
  → auth token exists (!has_shop)? → /shop-setup
```

## Auth Flow
1. Phone input → OTP sent (via API)
2. OTP verify → receives `{user, token}` → stored in SecureStore
3. `has_shop` field on user gates: tabs vs shop-setup
4. `clearStaleAuth()` runs once on first launch to clear prior sessions

## State Management (React Context only)
- **AuthContext** — wraps entire app: token, user, loading, signIn/signOut/forceSignOut
- **BillContext** — wraps only bill screens: items, customer, paymentMode, discount, notes, computed totals
- **ToastContext** — wraps inside AuthGate: showToast (success/error/info), showConfirm

## Key Features
- **Billing**: 5% GST, PDF invoice with amount-in-words, WhatsApp sharing via Android intent
- **Voice Billing**: `app/bill/voice.tsx` (entry: dashboard "Voice Bill" quick action) records Hindi/English speech with `expo-speech-recognition`, sends the transcript to `POST /api/voice/parse` via `api.parseVoiceBill()`, lets the user edit the draft (items/qty/customer/payment/discount), then fills BillContext and opens the normal `/bill/review` screen. Unresolved products must be matched (or removed) before review. On API failure it falls back to `lib/voice-parser.ts` + `source: 'local'`.
- **Udhaar (Credit)**: Track customer credit, due amounts, payment recording
- **Stock Management**: Real-time tracking, low-stock alerts
- **Customers**: Search, credit history, quick add
- **Reports**: Daily/monthly/custom range with charts
- **Sync**: Status page with pending count (placeholder)
- **Language**: Hindi/English toggle in Settings
- **Offline Mode**: Not yet implemented (Coming Soon on welcome page)

## i18n / Language
- Persisted in **SecureStore** under key `app_language`
- `hasStoredLanguage()` checks if user ever selected → gates /language-select vs /login
- Fallback: device locale via `expo-localization` (prefers Hindi if device set to Hindi)
- Changeable in Settings screen (toggles hi/en)

## API Communication
- `lib/api.ts`: plain object with typed async methods
- Base URL from `Constants.expoConfig.extra.apiUrl` (from .env → app.config.js)
- Fallback: `http://192.168.1.9:8000/api`
- Production: `https://khata-flow-api.onrender.com/api`
- 401 response → calls `forceSignOut()` set via `setUnauthorizedHandler`
- Voice: `api.parseVoiceBill(token, transcript, 'hi'|'en')` → `POST /voice/parse`, returns `{items, customer, customer_name, payment_method, discount, notes, assistant_reply, source}`. The backend owns the Gemini key; the app never holds it. Free-tier backend may cold-start (~30-60s) after Render sleep.

## Theme & Design
- **Colors**: Material 3-inspired (primary, secondary, tertiary, error, surfaces)
- **Typography**: Inter (body), Lexend (headings), NotoSansDevanagari (Hindi)
- **Spacing**: 0.5-12 scale (xs, sm, md, lg, xl, xxl)
- **Icons**: Material Symbols (via expo-vector-icons)
- Support for light/dark mode via system color scheme

## Build & Deploy
- `eas build --profile universal-apk` for production APK (arm64-v8a)
- `npx expo start` for development
- Portrait only, Android target
- After adding/updating `expo-speech-recognition` (or its app.json plugin), rebuild the dev client / APK — Expo Go cannot load the native module. Plugin adds RECORD_AUDIO + speech service visibility queries; iOS gets mic/speech usage strings.

## Backend (khata-flow-api)
Separate Laravel 13 project at `D:\dukandar\khata-flow-api`. See its AGENTS.md for full context. Key points:
- Phone-based OTP auth (4-digit, hardcoded `1234` for testing)
- Laravel Passport Bearer tokens
- SQLite local / MySQL on Render.com
- Endpoints: products, customers, bills (with items/payments), stock, expenses, reports, dashboard, sync, profile

## Welcome Page
`khata-flow-api/resources/views/welcome.blade.php` — Tailwind landing page with features: Super Fast Billing (w/ WhatsApp sharing), Offline Mode (Coming Soon), Udhaar Management, Stock Management, Daily Reports, Multiple Languages (Hindi/English).
