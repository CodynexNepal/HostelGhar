# Hostel Ghar – Cookie Policy & Consent Implementation

## Overview
This branch (`codynex/inspect-hostel-ghar-frontend-404eed`) implements:

1. **Cookie Policy page** – `/cookie-policy` (responsive, accessible, flat design).
2. **First-visit cookie consent popup** – appears once per browser until the user makes a choice.
3. **Three consent actions** – Accept All, Reject Optional, Customize Preferences.
4. **Persistent preferences** – stored in `localStorage` under a versioned key.
5. **Reopen settings** – footer link "Cookie Settings" reopens the consent dialog.
6. **Footer integration** – policy link + settings link added to the site footer.

## Design System (Aliza Wears / HostelGhar SOP)
- **Zero** gradients, glassmorphism, or neon glow.
- **60-30-10 color balance**:
  - 60% – warm alabaster `#F7F7F5` and white `#FFFFFF` surfaces.
  - 30% – deep charcoal ink `#0E0F0C` for text and secondary surfaces.
  - 10% – lime `#C3FF7D` / `#9FE870` strictly for primary CTAs and active states.
- `tabular-nums` for any numeric metrics.
- Flat, high-contrast, accessible (WCAG 2.1 AA).

## Architecture
```
src/
  app/
    cookie-policy/
      page.tsx          # Cookie Policy page (SSR/SSG)
    layout.tsx          # Root layout (footer injection)
    components/
      Footer.tsx        # Site footer with policy + settings links
      CookieConsent/
        index.tsx       # Consent popup component
        PreferencesPanel.tsx  # Customize toggles
        types.ts        # Shared types
  lib/
    cookies/
      index.ts          # Cookie consent storage & policy logic
      categories.ts     # Cookie category definitions
      defaults.ts       # Default consent state
  hooks/
    useCookieConsent.ts # React hook wrapping the consent module
```

## Cookie Categories
| Category | Required | Description |
|---|---|---|
| `essential` | Yes | Session, security, load balancing. Cannot be disabled. |
| `analytics` | No | Anonymous usage metrics (e.g., Plausible/PostHog). |
| `marketing` | No | Personalized ads, social pixels. |
| `preferences` | No | UI preferences, language, theme. |

## Persistence
- Key: `hostelghar:cookie-consent:v1`
- Value: JSON `{ version, acceptedAt, categories: { essential: true, analytics: bool, marketing: bool, preferences: bool } }`
- If the key is absent or the version mismatches, the popup reappears.

## Testing & QA Gate (SOP-001)
Before any task is marked complete, the following **must** pass:
1. `npx tsc --noEmit`
2. `npx eslint . --ext .ts,.tsx`
3. `npm run test` (unit + integration)
4. `npm run build` (production build)

If **any** check fails:
- A linked correction task is spawned assigned to the responsible engineer.
- **Deployment is blocked.**

## Deployment Policy (CEO Clarification)
- **Do NOT deploy to production** until:
  1. All QA checks pass.
  2. Staging verification is complete.
  3. The CEO explicitly approves deployment.
- A deployment approval request is prepared in `docs/deployment-approval.md`.

## Running Locally
```bash
npm install
npm run dev
# Visit http://localhost:3000/cookie-policy
# Clear localStorage to re-trigger the consent popup:
#   localStorage.removeItem('hostelghar:cookie-consent:v1')
```

## Environment Variables
No new environment variables are required. If analytics/marketing SDKs are later integrated, gate their initialization behind the consent state from `useCookieConsent()`.
