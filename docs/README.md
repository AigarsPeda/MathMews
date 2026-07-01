# BrainPet — GitHub Pages (legal docs)

Host the public privacy policy for App Store Connect.

## Setup (one time)

1. Push this repo to GitHub (`AigarsPeda/brainpet`).
2. On GitHub: **Settings → Pages**
3. **Build and deployment → Source:** Deploy from a branch
4. **Branch:** `main` (or your default branch) → folder **`/docs`**
5. Save. After a minute or two the site is live at:

   **https://aigarspeda.github.io/brainpet/privacy.html**

Use that URL in:

- App Store Connect → **Privacy Policy URL**
- `constants/legal.ts` → `PRIVACY_POLICY_URL` (already set to match)

## Files

| File | Purpose |
| ---- | ------- |
| `privacy.html` | Public English privacy policy (App Store) |

When you change the policy, update:

1. `docs/privacy.html`
2. `legal/privacy-policy-content.ts` (in-app EN + LV)
3. `constants/legal.ts` → `PRIVACY_POLICY_LAST_UPDATED`

## Support email

Update `SUPPORT_EMAIL` in `constants/legal.ts` and the mailto link in `privacy.html` before launch.
