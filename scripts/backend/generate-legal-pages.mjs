import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { siteContent } from './public-site-content.mjs';

const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const constants = { exports: {} };
// Only these public fields can enter the generated website, never server secrets.
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
const { PUBLISHER_NAME, SUPPORT_EMAIL } = constants.exports;
const hasEmail = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(SUPPORT_EMAIL) && !/TODO|REPLACE/i.test(SUPPORT_EMAIL);
const hasPublisher = PUBLISHER_NAME.trim() && !/TODO|REPLACE/i.test(PUBLISHER_NAME);
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const filenames = ['index.html', 'privacy.html', 'support.html', 'delete-account.html'];
const outputIndex = process.argv.indexOf('--out-dir');
if (outputIndex !== -1 && !process.argv[outputIndex + 1]) throw new Error('--out-dir requires a directory');
const output = outputIndex === -1 ? 'docs' : process.argv[outputIndex + 1];
const stylesheetVersion = createHash('sha256').update(await fs.readFile('docs/site.css')).digest('hex').slice(0, 12);

function identity(locale) {
  const text = siteContent[locale];
  return { publisher: hasPublisher ? PUBLISHER_NAME : text.publisherPlaceholder,
    email: hasEmail ? SUPPORT_EMAIL : text.emailPlaceholder };
}
const emailLink = (locale, deletion = false) => `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent(
  deletion ? locale === 'lv' ? 'Math Mews konta dzēšanas pieprasījums' : 'Math Mews account deletion request'
    : locale === 'lv' ? 'Math Mews atbalsts' : 'Math Mews support',
)}`;
function renderSections(sections, locale) {
  const text = siteContent[locale], contact = identity(locale);
  return sections.map(section => `<section${section.id ? ` id="${escape(section.id)}"` : ''}>
<h2>${escape(section.title)}</h2>
${section.contact ? `<dl class="contact"><div><dt>${text.publisherLabel}</dt><dd>${escape(contact.publisher)}</dd></div><div><dt>${text.emailLabel}</dt><dd>${hasEmail ? `<a href="${escape(emailLink(locale))}">${escape(contact.email)}</a>` : escape(contact.email)}</dd></div></dl>` : ''}
${section.emailButton && hasEmail ? `<a class="button" href="${escape(emailLink(locale, section.deletionEmail))}">${escape(section.emailButton)}</a>` : ''}
${section.missingEmail && !hasEmail ? `<p class="pending">${escape(section.missingEmail)}</p>` : ''}
${section.paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('\n')}
${section.links ? `<ul class="help-links">${section.links.map(([url, label]) => `<li><a href="${escape(url)}">${escape(label)}</a></li>`).join('')}</ul>` : ''}
</section>`).join('\n');
}
function renderPrivacy(locale) {
  const content = policy.exports.getPrivacyPolicyContent(locale), contact = identity(locale);
  return `<p class="meta">${escape(content.lastUpdatedLabel)}</p>` + renderSections(content.sections.map(section => ({
    ...section,
    paragraphs: section.paragraphs.map(paragraph => paragraph
      .replaceAll(PUBLISHER_NAME, contact.publisher).replaceAll(SUPPORT_EMAIL, contact.email)),
  })), locale);
}
function renderDirectory(locale) {
  const text = siteContent[locale];
  return `<div class="directory">${filenames.slice(1).map((file, i) => `<a class="directory-card" href="${file}">
<h2>${escape(text.cardTitles[i])}<span aria-hidden="true">↗</span></h2><p>${escape(text.cardDescriptions[i])}</p></a>`).join('\n')}</div>`;
}
function renderPage(filename, locale, index) {
  const text = siteContent[locale], prefix = locale === 'lv' ? '../' : '', contact = identity(locale);
  const navigation = () => filenames.slice(1).map((file, i) => `<a href="${file}"${file === filename ? ' aria-current="page"' : ''}>${escape(text.nav[i])}</a>`).join('');
  const alternate = locale === 'en' ? `lv/${filename}` : `../${filename}`;
  const languageLinks = `<nav class="language" aria-label="${escape(text.language)}"><a href="${locale === 'en' ? filename : alternate}" lang="en" hreflang="en"${locale === 'en' ? ' aria-current="true"' : ''}>English</a><a href="${locale === 'lv' ? filename : alternate}" lang="lv" hreflang="lv"${locale === 'lv' ? ' aria-current="true"' : ''}>Latviešu</a></nav>`;
  const body = index === 0 ? renderDirectory(locale) : `<article>${index === 1 ? renderPrivacy(locale) : renderSections(index === 2 ? text.support : text.deletion, locale)}</article>`;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escape(text.intros[index])}">
<title>${escape(index === 0 ? 'Math Mews' : text.titles[index])}${index === 0 ? '' : ' | Math Mews'}</title>
<link rel="stylesheet" href="${prefix}site.css?v=${stylesheetVersion}">
<link rel="icon" type="image/png" href="${prefix}assets/cat.png">
<link rel="alternate" hreflang="${locale === 'en' ? 'lv' : 'en'}" href="${alternate}">
</head>
<body>
<a class="skip" href="#content">${text.skip}</a>
<header class="site-header"><a class="brand" href="index.html"><img src="${prefix}assets/cat.png" width="44" height="44" alt="">Math Mews</a><nav class="main-nav" aria-label="${text.mainNav}">${navigation()}</nav>${languageLinks}</header>
<main id="content"${index === 0 ? '' : ' class="document-page"'}>
<div class="background-decorations" aria-hidden="true"><span class="decoration-blue"></span><span class="decoration-pink"></span><span class="decoration-purple"></span></div>
<div class="hero${index === 0 ? ' hero-home' : ''}"><div class="hero-copy"><h1>${escape(text.titles[index])}</h1><p class="intro">${escape(text.intros[index])}</p></div><div class="cat-portrait"><img src="${prefix}assets/cat.png" width="512" height="512" alt="${escape(text.catAlt)}" fetchpriority="high"></div></div>
<aside class="notice" aria-label="${text.draftTitle}"><p><strong>${text.draftTitle}.</strong> ${escape(text.draft)}</p></aside>
${body}
</main>
<footer class="site-footer"><nav aria-label="${text.footerNav}">${navigation()}</nav><p>Math Mews · ${escape(contact.publisher)}</p><p>${text.hosted} <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">${text.githubPrivacy}</a>.</p></footer>
</body>
</html>
`;
}
await fs.mkdir(path.join(output, 'lv'), { recursive: true });
await fs.mkdir(path.join(output, 'assets'), { recursive: true });
await fs.copyFile('assets/3d/cat-preview.png', path.join(output, 'assets/cat.png'));
if (path.resolve(output) !== path.resolve('docs')) await fs.copyFile('docs/site.css', path.join(output, 'site.css'));
for (const locale of ['en', 'lv']) {
  for (const [index, filename] of filenames.entries()) {
    await fs.writeFile(path.join(output, locale === 'lv' ? 'lv' : '', filename), renderPage(filename, locale, index));
  }
}
console.log('Generated eight complete English/Latvian pages and the existing app cat artwork. Private credentials excluded. Publisher placeholders remain.');
