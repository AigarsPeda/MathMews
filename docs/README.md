# BrainPet — GitHub Pages (privacy policy)

**URL:** https://aigarspeda.github.io/brainpet/privacy.html

---

## Setup (recommended — no Actions needed)

1. Open **Settings → Pages**:  
   https://github.com/AigarsPeda/brainpet/settings/pages

2. Under **Build and deployment → Source**, choose **Deploy from a branch** (not GitHub Actions).

3. **Branch:** `main` → folder **`/docs`** → **Save**.

4. Wait 1–2 minutes. Refresh:  
   https://aigarspeda.github.io/brainpet/privacy.html

That’s it. Every push to `main` that changes `docs/` updates the site automatically.

---

## If you see 404

| Check                                         | Fix                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Source is “GitHub Actions” but workflow fails | Switch to **Deploy from a branch** (see above)                                                                   |
| Wrong folder                                  | Must be **`/docs`**, not `/ (root)`                                                                              |
| Just saved                                    | Wait 2–5 minutes for first deploy                                                                                |
| File missing                                  | Confirm [docs/privacy.html](https://github.com/AigarsPeda/brainpet/blob/main/docs/privacy.html) exists on `main` |

**Do not** use the “Static HTML” / “Jekyll” buttons on the Pages screen — they add extra workflows you don’t need

---

## App Store Connect

Privacy Policy URL:

```
https://aigarspeda.github.io/brainpet/privacy.html
```

Same as `PRIVACY_POLICY_URL` in `constants/legal.ts`.

---

## When you change the policy

1. `docs/privacy.html` — public English page
2. `legal/privacy-policy-content.ts` — in-app EN + LV
3. `constants/legal.ts` — `PRIVACY_POLICY_LAST_UPDATED`
4. Push to `main`

---

## Support email

Update `SUPPORT_EMAIL` in `constants/legal.ts` and the mailto in `privacy.html` before launch.
