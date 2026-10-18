# Public Math Mews website

The home, privacy, support and account-deletion pages each have complete English
and Latvian versions. The language switch preserves the current page. Navigation
within a language stays in that language. JavaScript updates translations in place,
preserves scroll position and slides the language indicator. Browser back/forward
also restores the language. Without JavaScript, the links open the complete static
translations. No cookies are required.

| Page | English | Latvian |
| --- | --- | --- |
| Home | `index.html` | `lv/index.html` |
| Privacy | `privacy.html` | `lv/privacy.html` |
| Support | `support.html` | `lv/support.html` |
| Delete account | `delete-account.html` | `lv/delete-account.html` |

The public root is https://aigarspeda.github.io/MathMews/.
Existing English URLs remain valid for the app and store configuration.

## Edit and generate

- Edit website translations in `scripts/backend/public-site-content.mjs`.
- Edit the shared app/website privacy text in `legal/privacy-policy-content.ts`.
- Edit the layout in `scripts/backend/generate-legal-pages.mjs`, styling in `docs/site.css` and language switching in `docs/site.js`.
- Set the public publisher/support fields in the ignored `.env`, then run `npm run legal:generate`.
- The generator writes eight HTML pages and copies the app's existing cat artwork to `docs/assets/cat.png`.
- Only the two public identity fields enter the generator. Never commit `.env` or put server credentials in website content.

Colors match `GameColors`: cream, coral, turquoise, white and peach borders.
Typography uses the device's rounded/system sans font with local fallbacks.
Fonts and cat artwork require no external image/font service.

## Outstanding release details

Both languages retain a draft notice while publisher identity, support contact,
child privacy review, deletion timeframe and retention terms remain unconfirmed.
Missing values have translated placeholders. No email request button appears
until a valid monitored support address is configured.

A deletion email opens the visitor's mail app. This static website does not submit
requests or delete accounts. Support must verify ownership, track requests and
confirm completion. Never request passwords or authentication codes. An account
ID alone is insufficient proof of ownership. Linked-provider deletion acceptance
and the final external support process remain release requirements.

## Deploy and check

GitHub Pages uses `.github/workflows/github-pages.yml` on pushes to `main` or
manual dispatch. Its explicit staging list includes the eight HTML pages,
`site.css`, `site.js`, `assets/cat.png` and `.nojekyll`. Development notes, benchmarks and
other artwork must stay outside the Pages artifact.

Run `node --test scripts/backend/test-public-site.mjs` for translation coverage,
local navigation/assets, escaped public fields, contact links and actual workflow
staging. Check English/Latvian pages at phone and desktop widths before publishing.
