# Math Mews — GitHub Pages (privacy policy)

**URL:** https://aigarspeda.github.io/brainpet/privacy.html

---

## Setup (one-time)

1. Open **Settings → Pages**:  
   https://github.com/AigarsPeda/brainpet/settings/pages

2. Under **Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”).

3. Push this repo (includes `.github/workflows/github-pages.yml`).

4. **Actions** → **Deploy GitHub Pages** → confirm it runs green, or use **Run workflow**.

5. Wait 1–2 minutes. Refresh:  
   https://aigarspeda.github.io/brainpet/privacy.html

**Why GitHub Actions?** Branch deploy runs a built-in workflow on **every** push to `main`. Our workflow only runs when files under **`docs/`** change (or the workflow file itself).

---

## If you see 404

| Check | Fix |
| ----- | --- |
| Source is still “Deploy from a branch” | Switch to **GitHub Actions** (see above) |
| Workflow never ran | Push a change under `docs/`, or **Actions → Run workflow** |
| Just saved | Wait 2–5 minutes for first deploy |
| File missing | Confirm [docs/privacy.html](https://github.com/AigarsPeda/brainpet/blob/main/docs/privacy.html) exists on `main` |

**Do not** use the “Static HTML” / “Jekyll” buttons on the Pages screen.

---

## Deploy stuck / failed

If **Deploy GitHub Pages** fails with *“in progress deployment”*:

1. **Actions** → cancel any **running** Pages workflows.
2. Wait **10–15 minutes**.
3. **Re-run** the latest failed job (one at a time).

If a **`gh-pages`** branch exists from old experiments, you can delete it:  
https://github.com/AigarsPeda/brainpet/branches

---

## App Store Connect

Privacy Policy URL:

```
https://aigarspeda.github.io/brainpet/privacy.html
```

Same as `PRIVACY_POLICY_URL` in `constants/legal.ts`.

---

## When you change the policy

1. `docs/privacy.html` — public English page (triggers deploy)
2. `legal/privacy-policy-content.ts` — in-app EN + LV (no deploy)
3. `constants/legal.ts` — `PRIVACY_POLICY_LAST_UPDATED` (no deploy)
4. Push to `main`

Only edits under `docs/` trigger a new Pages deploy. App-only policy changes do not.

---

## Support email

Update `SUPPORT_EMAIL` in `constants/legal.ts` and the mailto in `privacy.html` before launch.
