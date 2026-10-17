// Complete website copy for each language. Privacy text remains shared with the app.
export const siteContent = {
  en: {
    skip: 'Skip to content', mainNav: 'Main navigation', footerNav: 'Footer navigation', language: 'Website language',
    nav: ['Privacy', 'Support', 'Delete account'],
    titles: ['A little help for Math Mews.', 'Privacy policy', 'Help with your game', 'Delete your account'],
    intros: [
      'Find help with your game, purchases and account.',
      'How Math Mews handles game progress, accounts and purchases.',
      'Help with Math Mews, missing coins and store purchases.',
      'How to delete your Math Mews account and what happens to your game data.',
    ],
    catAlt: 'The orange-and-white Math Mews cat',
    draftTitle: 'Release draft',
    draft: 'Publisher details, support contact, child privacy review, deletion timeframe and retention terms still need confirmation. These pages are not ready for store submission.',
    publisherLabel: 'Publisher', emailLabel: 'Support', publisherPlaceholder: 'TODO: publisher legal name', emailPlaceholder: 'TODO: monitored support email',
    hosted: 'Hosted on GitHub Pages.', githubPrivacy: 'GitHub privacy statement',
    cardTitles: ['Privacy policy', 'Support', 'Account deletion'],
    cardDescriptions: [
      'Understand what the game stores and the choices you have about your data.',
      'Get help with missing coins, purchase delivery and store refunds.',
      'Find out how to delete your account and what happens to your saved games.',
    ],
    support: [
      { title: 'Contact support', contact: true, emailButton: 'Email support', paragraphs: [
        'A parent or guardian should contact support for a child. Include your device type, app version and a short description of the problem. For a purchase issue, keep the store receipt.',
        'Never send passwords, payment card details or authentication codes.',
      ] },
      { title: 'Coin packs', paragraphs: [
        'Math Mews offers consumable packs of 100, 500 and 1,200 coins. The store displays the price and currency before purchase. Coins belong to your game account and are shared across its pets. Purchased coins do not expire. They cannot be exchanged for cash or transferred to another account.',
        'Account linking and recovery must be enabled and tested before paid sales. Once available, link a supported account before buying so you can recover your wallet on another device. Restore checks your remaining server balance. It does not grant previously spent coins again.',
      ] },
      { title: 'Missing coins', paragraphs: [
        'If payment succeeded but coins are still syncing, do not buy the pack again. Connect to the internet and reopen the game. Keep the store receipt and contact support if delivery does not complete.',
      ] },
      { title: 'Refunds and account deletion', paragraphs: [
        'Apple or Google handles store payments and refund decisions. Refunded coins are removed from the wallet. If they have already been spent, the wallet can show a debt until recovered. Deleting an account removes its remaining coins and does not automatically refund purchases.',
      ], links: [
        ['https://support.apple.com/118223', 'Apple refund instructions'],
        ['https://support.google.com/googleplay/answer/2479637', 'Google Play refund instructions'],
        ['delete-account.html', 'Request account deletion'],
      ] },
    ],
    deletion: [
      { title: 'Request deletion without the app', id: 'request', contact: true, emailButton: 'Request account deletion by email', deletionEmail: true,
        missingEmail: 'TODO: a monitored support email is required to enable deletion requests from this page.', paragraphs: [
          'You do not need to reinstall the game. A parent or guardian can request deletion for their child. Include the linked sign-in email or game account ID if known, and say that you want to delete the Math Mews account and associated data. Do not send a password, sign-in code or payment card details.',
          'Support must verify account ownership before deleting anything. An account ID alone is not proof of ownership. For an anonymous account whose device and session have been lost, support may be unable to verify ownership. Do not post account details in public GitHub issues.',
          'TODO before launch: confirm the monitored mailbox, ownership-verification procedure, request tracking, response and deletion timeframes, and completion notification. The email button opens your mail app. A request is only sent after you send the email; this website does not submit a deletion request itself.',
        ] },
      { title: 'Delete in the app', paragraphs: [
        'Open Settings, then Delete account and data. Complete the grown-up gate and confirm deletion. This affects all pets and remaining coins on the account. Keep your session until completion. A pending request is not complete; the app keeps a status receipt and lets you retry.',
        'TODO before launch: finish configuring and testing deletion for linked Apple and Google accounts, including Apple authorization revocation.',
      ] },
      { title: 'What is removed and retained', paragraphs: [
        'The deletion workflow removes cloud saves, the sign-in account and its RevenueCat customer record. Apple sign-in authorization is revoked when applicable. Limited pseudonymous transaction and coin-ledger records remain for duplicate-credit protection and refunds. Deletion removes remaining coins and does not refund purchases.',
        'TODO before launch: disclose the completion timeframe, lawful financial-record retention period and provider backup/log expiry. The final policy must state how long retained records are kept and why.',
      ] },
    ],
  },
  lv: {
    skip: 'Pāriet uz saturu', mainNav: 'Galvenā navigācija', footerNav: 'Navigācija lapas apakšā', language: 'Vietnes valoda',
    nav: ['Privātums', 'Atbalsts', 'Dzēst kontu'],
    titles: ['Palīdzība tavai Math Mews spēlei.', 'Privātuma politika', 'Palīdzība spēlē', 'Dzēs savu kontu'],
    intros: [
      'Atbildes taviem jautājumiem. Palīdzība ar spēli, pirkumiem un kontu vienuviet.',
      'Kā Math Mews apstrādā spēles progresu, kontus un pirkumus.',
      'Palīdzība ar Math Mews, trūkstošām monētām un pirkumiem veikalā.',
      'Kā dzēst Math Mews kontu un kas notiek ar taviem spēles datiem.',
    ],
    catAlt: 'Math Mews oranžbaltais kaķis',
    draftTitle: 'Publicēšanas melnraksts',
    draft: 'Vēl jāapstiprina izdevēja dati, atbalsta kontaktinformācija, bērnu privātuma prasības un datu dzēšanas un glabāšanas termiņi. Šīs lapas vēl nav gatavas iesniegšanai lietotņu veikalos.',
    publisherLabel: 'Izdevējs', emailLabel: 'Atbalsts', publisherPlaceholder: 'TODO: izdevēja juridiskais nosaukums', emailPlaceholder: 'TODO: uzraudzīta atbalsta e-pasta adrese',
    hosted: 'Vietni mitina GitHub Pages.', githubPrivacy: 'GitHub privātuma paziņojums',
    cardTitles: ['Privātuma politika', 'Atbalsts', 'Konta dzēšana'],
    cardDescriptions: [
      'Uzzini, kādus datus spēle glabā un kādas ir tavas izvēles.',
      'Saņem palīdzību ar trūkstošām monētām, pirkumu piegādi un atmaksām.',
      'Uzzini, kā dzēst kontu un kas notiek ar saglabātajām spēlēm.',
    ],
    support: [
      { title: 'Sazinies ar atbalstu', contact: true, emailButton: 'Rakstīt atbalstam', paragraphs: [
        'Bērna vārdā ar atbalstu jāsazinās vecākam vai aizbildnim. Norādi ierīces veidu, lietotnes versiju un īsi apraksti problēmu. Ja jautājums ir par pirkumu, saglabā veikala kvīti.',
        'Nesūti paroles, maksājumu kartes datus vai autentifikācijas kodus.',
      ] },
      { title: 'Monētu pakas', paragraphs: [
        'Math Mews piedāvā patērējamas pakas ar 100, 500 un 1200 monētām. Veikals pirms pirkuma parāda cenu un valūtu. Monētas pieder tavam spēles kontam, un tās koplieto tā mīluļi. Pirktajām monētām nav derīguma termiņa. Tās nevar apmainīt pret naudu vai pārsūtīt citam kontam.',
        'Pirms pārdošanas par īstu naudu jāiespējo un jāpārbauda kontu piesaistīšana un atjaunošana. Kad šī iespēja ir pieejama, pirms pirkuma piesaisti atbalstītu kontu, lai maku varētu atjaunot citā ierīcē. Atjaunošana pārbauda atlikušo servera maka atlikumu. Tā nepiešķir jau iztērētās monētas vēlreiz.',
      ] },
      { title: 'Trūkstošas monētas', paragraphs: [
        'Ja maksājums ir veikts, bet monētas vēl sinhronizējas, nepērc to pašu paku atkārtoti. Pievienojies internetam un atver spēli vēlreiz. Saglabā veikala kvīti un sazinies ar atbalstu, ja monētas netiek piegādātas.',
      ] },
      { title: 'Atmaksas un konta dzēšana', paragraphs: [
        'Apple vai Google apstrādā veikala maksājumus un lemj par atmaksām. Atmaksātās monētas tiek noņemtas no maka. Ja tās jau ir iztērētas, maks var uzrādīt parādu, līdz tas tiek segts. Konta dzēšana noņem tā atlikušās monētas un automātiski neatmaksā pirkumus.',
      ], links: [
        ['https://support.apple.com/lv-lv/118223', 'Apple norādījumi par atmaksu'],
        ['https://support.google.com/googleplay/answer/2479637?hl=lv', 'Google Play norādījumi par atmaksu'],
        ['delete-account.html', 'Pieprasīt konta dzēšanu'],
      ] },
    ],
    deletion: [
      { title: 'Pieprasi dzēšanu bez lietotnes', id: 'request', contact: true, emailButton: 'Pieprasīt konta dzēšanu e-pastā', deletionEmail: true,
        missingEmail: 'TODO: lai šajā lapā varētu pieprasīt dzēšanu, jānorāda uzraudzīta atbalsta e-pasta adrese.', paragraphs: [
          'Spēle nav jāpārinstalē. Vecāks vai aizbildnis var pieprasīt dzēšanu sava bērna vārdā. Norādi piesaistītā konta e-pastu vai spēles konta identifikatoru, ja tas ir zināms, un pasaki, ka vēlies dzēst Math Mews kontu un ar to saistītos datus. Nesūti paroli, pieteikšanās kodu vai kartes datus.',
          'Pirms dzēšanas atbalstam jāpārbauda konta īpašumtiesības. Konta identifikators viens pats tās nepierāda. Ja anonīma konta ierīce un sesija ir zaudēta, atbalsts var nespēt pārbaudīt īpašumtiesības. Nepublicē konta datus publiskos GitHub uzdevumos.',
          'TODO pirms publicēšanas: apstiprināt uzraudzītu pastkasti, īpašumtiesību pārbaudes kārtību, pieprasījumu uzskaiti, atbildes un dzēšanas termiņus un paziņojumu par pabeigšanu. E-pasta poga atver tavu pasta lietotni. Pieprasījums tiek nosūtīts tikai tad, kad nosūti e-pastu; šī vietne pati dzēšanas pieprasījumu neiesniedz.',
        ] },
      { title: 'Dzēs kontu lietotnē', paragraphs: [
        'Atver Iestatījumus un izvēlies Dzēst kontu un datus. Izpildi uzdevumu pieaugušajiem un apstiprini dzēšanu. Tas skar visus konta mīluļus un atlikušās monētas. Saglabā sesiju līdz pabeigšanai. Gaidošs pieprasījums vēl nav pabeigts; lietotne saglabā statusa apliecinājumu un ļauj mēģināt vēlreiz.',
        'TODO pirms publicēšanas: pabeigt konfigurēt un pārbaudīt piesaistītu Apple un Google kontu dzēšanu, arī Apple autorizācijas atsaukšanu.',
      ] },
      { title: 'Kas tiek dzēsts un saglabāts', paragraphs: [
        'Dzēšanas process noņem mākoņa saglabājumus, pieteikšanās kontu un tā RevenueCat klienta ierakstu. Apple pieteikšanās autorizācija tiek atsaukta, ja tā ir izmantota. Ierobežoti pseidonīmi darījumu un monētu žurnāla ieraksti paliek atkārtotas piešķiršanas novēršanai un atmaksām. Dzēšana noņem atlikušās monētas un neatmaksā pirkumus.',
        'TODO pirms publicēšanas: norādīt dzēšanas izpildes termiņu, finanšu ierakstu tiesisko glabāšanas termiņu un pakalpojumu rezerves kopiju un žurnālu dzēšanas termiņus. Gala politikā jānorāda, cik ilgi un kāpēc tiek glabāti atlikušie ieraksti.',
      ] },
    ],
  },
};
