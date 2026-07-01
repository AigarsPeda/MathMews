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

**Do not** use the “Static HTML” / “Jekyll” buttons on the Pages screen — they add extra workflows you don’t need.

---

## “pages build and deployment” failed (deploy stuck)

GitHub runs an automatic **pages build and deployment** workflow when you push changes under `docs/`. Sometimes the **deploy** step fails with:

> *due to in progress deployment. Please cancel … first*

**Your site can still work** — check https://aigarspeda.github.io/brainpet/privacy.html (if it loads, App Store is fine).

To clear the queue so **future** edits deploy:

1. **Actions** → cancel every **running** “pages build and deployment” workflow:  
   https://github.com/AigarsPeda/brainpet/actions
2. Wait **10–15 minutes** (GitHub releases the stuck deployment slot).
3. **Actions** → open the latest failed run → **Re-run all jobs** (only one, not several at once).
4. If it keeps failing: **Settings → Pages** → switch source to **None**, Save, then set **`main` / `/docs`** again.

Do **not** add extra Pages workflows in this repo — branch deploy is enough.

If a **`gh-pages`** branch exists from old experiments, delete it:  
https://github.com/AigarsPeda/brainpet/branches — keep only **`main` + `/docs`** for Pages.

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
