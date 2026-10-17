import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import process from 'node:process';

const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const constants = { exports: {} };
// Only the two public identity fields can enter the generated site.
const publicEnvironment = Object.fromEntries(
  ['EXPO_PUBLIC_PUBLISHER_NAME', 'EXPO_PUBLIC_SUPPORT_EMAIL'].map(key => [key, process.env[key]]),
);
vm.runInNewContext(compile(await fs.readFile('constants/legal.ts', 'utf8')), {
  module: constants, exports: constants.exports, process: { env: publicEnvironment },
});
const policy = { exports: {} };
vm.runInNewContext(compile(await fs.readFile('legal/privacy-policy-content.ts', 'utf8')), {
  module: policy, exports: policy.exports, require: () => constants.exports,
});
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const { PUBLISHER_NAME, SUPPORT_EMAIL } = constants.exports;
const hasEmail = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(SUPPORT_EMAIL) && !/TODO|REPLACE/i.test(SUPPORT_EMAIL);
const emailLink = subject => `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent(subject)}`;
const email = hasEmail
  ? `<a href="${escape(emailLink('Math Mews support'))}">${escape(SUPPORT_EMAIL)}</a>`
  : 'TODO: add a monitored support email before launch';
const contact = `<p>Publisher: ${escape(PUBLISHER_NAME)}</p><p>Support: ${email}</p>`;
const links = [
  ['privacy.html', 'Privacy'], ['support.html', 'Support'], ['delete-account.html', 'Delete account'],
];
const navigation = current => links.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('');
// These pages stay marked as drafts until the publisher approves the outstanding
// identity, child privacy, retention and operational deletion requirements.
const draft = `<aside class="notice" aria-label="Release draft"><p><strong>Release draft.</strong> Publisher details, support contact, child privacy review, deletion timeframe and retention terms still need confirmation. These pages are not ready for store submission.</p></aside>`;
const page = (filename, title, intro, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escape(intro)}">
<title>${escape(title)} | Math Mews</title>
<link rel="stylesheet" href="site.css">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header><a class="brand" href="index.html">Math Mews</a><nav aria-label="Main navigation">${navigation(filename)}</nav></header>
<main id="content"><p class="eyebrow">For parents and players</p><h1>${escape(title)}</h1><p class="intro">${escape(intro)}</p>
${draft}
${body}
</main>
<footer><nav aria-label="Footer navigation">${navigation(filename)}</nav><p>Math Mews · ${escape(PUBLISHER_NAME)}</p><p>Hosted on GitHub Pages. <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>.</p></footer>
</body>
</html>
`;

let privacy = '<nav class="language" aria-label="Policy language"><a href="#en" lang="en">English</a><a href="#lv" lang="lv">Latviešu</a></nav>';
for (const locale of ['en', 'lv']) {
  const content = policy.exports.getPrivacyPolicyContent(locale);
  privacy += `<article id="${locale}" lang="${locale}"><h2>${escape(content.screenTitle)}</h2><p class="meta">${escape(content.lastUpdatedLabel)}</p>`;
  for (const section of content.sections) {
    privacy += `<section><h3>${escape(section.title)}</h3>${section.paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}</section>`;
  }
  privacy += '</article>';
}
await fs.writeFile('docs/privacy.html', page('privacy.html', 'Privacy policy', 'How Math Mews handles game progress, accounts and purchases. Available in English and Latvian.', privacy));

const supportButton = hasEmail ? `<a class="button" href="${escape(emailLink('Math Mews support'))}">Email support</a>` : '';
await fs.writeFile('docs/support.html', page('support.html', 'Help with your game', 'Get help with Math Mews, missing coins and store purchases.', `<article>
<section><h2>Contact support</h2>${contact}${supportButton}<p>A parent or guardian should contact support for a child. Include your device type, app version and a short description of the problem. For a purchase issue, keep the store receipt. Never send passwords, payment card details or authentication codes.</p></section>
<section><h2>Coin packs</h2><p>Math Mews offers consumable packs of 100, 500 and 1,200 coins. The store displays the price and currency before purchase. Coins belong to your game account and are shared across its pets. Purchased coins do not expire. They cannot be exchanged for cash or transferred to another account.</p><p>Account linking and recovery must be enabled and tested before paid sales. Once available, link a supported account before buying so you can recover your wallet on another device. Restore checks your remaining server balance. It does not grant previously spent coins again.</p></section>
<section><h2>Missing coins</h2><p>If payment succeeded but coins are still syncing, do not buy the pack again. Connect to the internet and reopen the game. Keep the store receipt and contact support if delivery does not complete.</p></section>
<section><h2>Refunds and account deletion</h2><p>Apple or Google handles store payments and refund decisions. Refunded coins are removed from the wallet; if already spent, the wallet can show a debt until recovered. Deleting an account removes its remaining coins and does not automatically refund purchases.</p><p><a href="https://support.apple.com/118223">Apple refund instructions</a> · <a href="https://support.google.com/googleplay/answer/2479637">Google Play refund instructions</a></p><p><a href="delete-account.html">Request account deletion</a></p></section>
<section lang="lv"><h2>Palīdzība latviski</h2><p>Atbalsts: ${email}. Bērna vārdā ar atbalstu jāsazinās vecākam vai aizbildnim. Norādi ierīci, lietotnes versiju un problēmas aprakstu. Nesūti paroles, kartes datus vai autentifikācijas kodus.</p><p>Monētas pieder kontam, un pirktajām monētām nav derīguma termiņa. Atjaunošana nepiešķir jau iztērētās monētas vēlreiz. Ja maksājums ir veikts, bet monētas vēl sinhronizējas, nepērc to pašu paku atkārtoti. Pievienojies internetam un atver spēli vēlreiz. Konta dzēšana neatmaksā pirkumus.</p></section>
</article>`));

const deletionButton = hasEmail ? `<a class="button" href="${escape(emailLink('Math Mews account deletion request'))}">Request account deletion by email</a>` : '<p><strong>TODO: a monitored support email is required to enable deletion requests from this page.</strong></p>';
await fs.writeFile('docs/delete-account.html', page('delete-account.html', 'Delete your account', 'How to request deletion of a Math Mews account and its game data.', `<article>
<section id="request"><h2>Request deletion without the app</h2>${contact}${deletionButton}<p>You do not need to reinstall the game. A parent or guardian can request deletion for their child. Include the linked sign-in email or game account ID if known, and say that you want to delete the Math Mews account and associated data. Do not send a password, sign-in code or payment card details.</p><p>Support must verify account ownership before deleting anything. An account ID alone is not proof of ownership. For an anonymous account whose device and session have been lost, support may be unable to verify ownership. Do not post account details in public GitHub issues.</p><p><strong>TODO before launch:</strong> confirm the monitored mailbox, ownership-verification procedure, request tracking, response and deletion timeframes, and completion notification. The email button opens your mail app; the request is only sent after you send the email. This draft does not submit a request to Supabase.</p></section>
<section><h2>Delete in the app</h2><p>The prepared in-app flow is in Settings, then Delete account and data. Complete the grown-up gate and confirm deletion. This affects all pets and remaining coins on the account, including both test and production data. Keep your session until completion. A pending request is not complete; the app keeps a status receipt and lets you retry.</p><p><strong>TODO before launch:</strong> activate and test the server deletion worker and provider cleanup before presenting this as an available service.</p></section>
<section><h2>What is removed and retained</h2><p>The deletion workflow removes cloud saves, the sign-in account and its RevenueCat customer record. Apple sign-in authorization is revoked when applicable. Limited pseudonymous transaction and coin-ledger records remain for duplicate-credit protection and refunds. Deletion removes remaining coins and does not refund purchases.</p><p><strong>TODO before launch:</strong> disclose the completion timeframe, lawful financial-record retention period and provider backup/log expiry. The final policy must state how long retained records are kept and why.</p></section>
<section lang="lv"><h2>Konta dzēšana</h2><p>Lai pieprasītu Math Mews konta un tā datu dzēšanu bez lietotnes pārinstalēšanas, raksti atbalstam: ${email}. Bērna vārdā jāraksta vecākam vai aizbildnim. Norādi piesaistīto e-pastu vai konta identifikatoru, ja tas ir zināms. Nesūti paroles, pieteikšanās kodus vai kartes datus un nepublicē konta datus GitHub uzdevumos.</p><p>Pirms dzēšanas atbalstam jāpārbauda konta īpašumtiesības. Konta identifikators viens pats nav pierādījums. Dzēšana skar visus konta mīluļus un atlikušās monētas. Pirkumi netiek atmaksāti. Šī lapa ir melnraksts. Pirms publicēšanas jāapstiprina atbalsta e-pasts, pārbaudes kārtība un datu dzēšanas un glabāšanas termiņi.</p></section>
</article>`));

await fs.writeFile('docs/index.html', page('index.html', 'A little help for Math Mews.', 'Privacy, purchase help and account choices for our math game with a virtual pet.', `<div class="directory">
<section><span class="number">01 / YOUR DATA</span><h2><a href="privacy.html">Privacy policy</a></h2><p>What the game stores, how purchases work and the choices available to parents and players.</p><p>English · Latviešu</p></section>
<section><span class="number">02 / YOUR GAME</span><h2><a href="support.html">Support</a></h2><p>Help with missing coins, purchase delivery and store refunds.</p></section>
<section><span class="number">03 / YOUR ACCOUNT</span><h2><a href="delete-account.html">Account deletion</a></h2><p>How to request account deletion and what happens to your game data.</p></section>
</div>`));
console.log('Generated four static release draft pages. Private credentials are excluded. Publisher review and deletion operations remain required.');
