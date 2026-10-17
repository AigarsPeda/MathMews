# Public release pages

The public site is hosted by GitHub Pages at:

- https://aigarspeda.github.io/MathMews/privacy.html
- https://aigarspeda.github.io/MathMews/support.html
- https://aigarspeda.github.io/MathMews/delete-account.html

These URLs are configured in `.env` and `.env.example`. Copy the same public
values to the EAS build environment. The pages are release drafts. Confirm the
publisher's legal name, monitored support email, launch-country child privacy
requirements, deletion timeframe and retained-record periods before submission.
Keep the draft banner until those decisions and the deletion workflow are complete.

## Update the pages

Fill `EXPO_PUBLIC_PUBLISHER_NAME` and `EXPO_PUBLIC_SUPPORT_EMAIL` in `.env`.
Edit `legal/privacy-policy-content.ts` for the shared English/Latvian policy,
`constants/legal.ts` for its date, `scripts/backend/generate-legal-pages.mjs` for
support/deletion content and `docs/site.css` for styling. Then run:

```sh
npm run legal:generate
```

The generator writes `docs/index.html`, `docs/privacy.html`, `docs/support.html`
and `docs/delete-account.html`. It reads only the selected public identity fields;
server credentials are never inserted into the pages. Regenerate and commit the
HTML whenever its source or contact details change. Do not commit `.env`.

## Deletion requests

Once a valid support email is configured, the deletion page displays a prominent
email request button. The visitor sends the email from their own mail app, without
reinstalling Math Mews or using a GitHub account. The site itself does not collect
or submit account data. A mailbox and an operational process are still required.

Before release, confirm the mailbox is monitored, test the email links, verify
ownership through the linked provider, track requests and notify the requester
when complete. An account ID alone must never authorize deletion. Do not ask for
passwords or authentication codes, or collect requests in public GitHub issues.
Anonymous accounts with lost devices may not have sufficient ownership proof.
Activate and test the prepared Supabase account deletion workflow separately.
An email request button does not deploy the server worker or remove accounts.

## Deployment

The existing `.github/workflows/github-pages.yml` runs on pushes to `main` or
manual dispatch. Repository Settings → Pages → Source must be **GitHub Actions**.
The local workflow change stages only the four HTML pages and `site.css`, plus an
empty `.nojekyll` file. It excludes development notes, benchmarks and artwork.
This workflow restriction is prepared locally but was not published: the current
GitHub OAuth login has `repo` scope but lacks `workflow` scope. The live workflow
still publishes the repository’s `docs/` folder. The five public HTML/CSS files
were published separately; no local development notes or artwork were uploaded.
There is no custom domain, build service, database or paid hosting requirement.
The public repository's ordinary code visibility is independent of Pages.

After deployment, open all three HTTPS URLs while signed out and check both
languages, navigation, contact and deletion links on a phone. Only use the final,
reviewed versions in App Store Connect and Play Console. GitHub logs visitor IP
addresses for security; the policy discloses this hosting behavior.

Publication commit: `e5f6e22d2e6c657f79e99fe86121951d3fd1e3ac` contains only
the four HTML pages and stylesheet. Granting GitHub CLI workflow permission or
saving the prepared workflow through GitHub is a separate publisher action.
