# BrainPet — GitHub Pages (legal docs)

Public privacy policy for App Store Connect.

**URL:** https://aigarspeda.github.io/brainpet/privacy.html

---

## If you see 404

The HTML file is in the repo, but **GitHub Pages must be turned on once**:

1. Open https://github.com/AigarsPeda/brainpet/settings/pages
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to `main` (or run the **Deploy GitHub Pages** workflow manually under Actions).
4. Wait 1–2 minutes, then open the URL above.

You can also use **Deploy from a branch** → branch `main` → folder `/docs` — either method works; pick one only.

### Verify the file is on GitHub

https://github.com/AigarsPeda/brainpet/blob/main/docs/privacy.html

---

## App Store Connect

Paste this into **Privacy Policy URL**:

```
https://aigarspeda.github.io/brainpet/privacy.html
```

Same value as `PRIVACY_POLICY_URL` in `constants/legal.ts`.

---

## When you change the policy

1. Edit `docs/privacy.html` (public English page)
2. Edit `legal/privacy-policy-content.ts` (in-app EN + LV)
3. Update `PRIVACY_POLICY_LAST_UPDATED` in `constants/legal.ts`
4. Push to `main` — Pages redeploys automatically

---

## Support email

Update `SUPPORT_EMAIL` in `constants/legal.ts` and the mailto link in `privacy.html` before launch.
