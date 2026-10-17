import type { AppLocale } from "@/types/locale";
import { PRIVACY_POLICY_LAST_UPDATED, SUPPORT_EMAIL, PUBLISHER_NAME } from "@/constants/legal";

export type PrivacySection = {
  title: string;
  paragraphs: string[];
};

export type PrivacyPolicyContent = {
  screenTitle: string;
  screenHint: string;
  lastUpdatedLabel: string;
  viewOnline: string;
  contactLabel: string;
  sections: PrivacySection[];
};

const EN: PrivacyPolicyContent = {
  screenTitle: "Privacy policy",
  screenHint: "How Math Mews handles your data.",
  lastUpdatedLabel: `Last updated: ${PRIVACY_POLICY_LAST_UPDATED}`,
  viewOnline: "View online",
  contactLabel: "Questions?",
  sections: [
    {
      title: "Overview",
      paragraphs: [
        "Math Mews is a math game with a virtual pet, intended for children from about age 6 and for adults. This policy explains the data used for gameplay, accounts and purchases.",
        "The app creates an anonymous account automatically when online. Playing does not require an email address. A grown-up can optionally link a supported sign-in account to protect progress.",
      ],
    },
    {
      title: "Information we store",
      paragraphs: [
        "Game progress on your device: pet name, room layout, coins, unlocks, puzzle progress, and similar gameplay data.",
        "Supabase stores cloud saves, a pseudonymous account ID, the server coin wallet, earned rewards, spending and administrator adjustments. Recovery on another device requires access to the same linked account; an anonymous profile alone does not guarantee recovery after reinstall.",
        "Apple or Google processes coin-pack payments. RevenueCat processes store transactions and purchase history using the account ID. Our server keeps transaction identifiers and a coin ledger so repeated events do not grant coins twice. We do not receive payment card details.",
        "App language preference, English or Latvian. If a grown-up links a sign-in provider or parent email, Supabase also processes the account information needed for that sign-in.",
        "If you email support or request account deletion by email, we process your email address and the information you provide to answer your request and verify account ownership. Do not send passwords, sign-in codes or payment card details.",
      ],
    },
    {
      title: "Information we do not collect",
      paragraphs: [
        "We do not ask children for their email address, phone number, home address, or precise location.",
        "We do not use advertising trackers or sell personal information.",
        "We do not knowingly collect personal information from children beyond what is needed to run the game.",
      ],
    },
    {
      title: "Third-party services",
      paragraphs: [
        "Supabase hosts authentication, cloud saves, wallets and deletion requests. Privacy: supabase.com/privacy",
        "RevenueCat processes purchases and purchase records associated with a pseudonymous account ID. Privacy: revenuecat.com/privacy",
        "Apple App Store and Google Play process payments and provide store purchase records.",
        "GitHub Pages hosts our public privacy, support and account-deletion pages. GitHub logs visitors' IP addresses for security. GitHub privacy: docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
        "These providers process data under their own policies. We only send what is needed for save sync and purchases.",
      ],
    },
    {
      title: "In-app purchases",
      paragraphs: [
        "Real-money purchases are consumable coin packs. The purchase screen is behind a reading-and-sequencing parent gate. The gate does not verify a person’s age or provide parental consent.",
        "Coins belong to the account, shared by its pets. Purchased coins do not expire. The server wallet records the current balance, including spending and refunds. Restore checks that balance; it does not reissue coins already spent. Linking an account before buying helps recovery on another device.",
      ],
    },
    {
      title: "Cloud save and multiple games",
      paragraphs: [
        "You can have more than one saved game on the same account. Each game is stored as a separate cloud record.",
        "Account linking and recovery must be enabled and tested before release. Until then, do not rely on moving an anonymous account to another device. A local or anonymous save may be lost after removal or device replacement. Store history alone does not reconstruct a spent consumable balance.",
      ],
    },
    {
      title: "Your choices",
      paragraphs: [
        "Delete account and data in Settings requests removal of the authentication account and every cloud pet in both test and production environments. Provider cleanup must complete before the app reports success. Failed or pending requests keep the local game and session for retry. Deletion does not refund purchases.",
        "Puzzles and pet care work offline. Coin rewards wait for server synchronization; spending and purchases require an online wallet.",
      ],
    },
    {
      title: "Children's privacy",
      paragraphs: [
        "Children are part of the intended audience. A parent or guardian should handle account linking, purchases and deletion. Optional parent account fields should contain the grown-up’s details, not the child’s.",
        "If you believe we have collected a child's personal information in error, contact us and we will delete it.",
      ],
    },
    {
      title: "Security and retention",
      paragraphs: [
        "Data is transmitted over HTTPS. Cloud data is protected by row-level security so each user can access only their own saves.",
        "Deletion removes active saves, authentication and the RevenueCat customer record after provider cleanup. Limited pseudonymous ledger and transaction records remain to prevent duplicate credits and handle refunds. Provider backups and operational logs can have separate retention periods. TODO before publication: set the legal retention schedule, deletion completion timeframe and backup/log expiry with the publisher.",
      ],
    },
    {
      title: "Changes",
      paragraphs: [
        "We may update this policy. The last updated date appears at the top. Review the updated policy when its date changes.",
      ],
    },
    {
      title: "Contact",
      paragraphs: [`Publisher: ${PUBLISHER_NAME}`, `Email: ${SUPPORT_EMAIL}`],
    },
  ],
};

const LV: PrivacyPolicyContent = {
  screenTitle: "Privātuma politika",
  screenHint: "Kā Math Mews apstrādā tavus datus.",
  lastUpdatedLabel: `Pēdējoreiz atjaunināts: ${PRIVACY_POLICY_LAST_UPDATED}`,
  viewOnline: "Skatīt tiešsaistē",
  contactLabel: "Jautājumi?",
  sections: [
    {
      title: "Pārskats",
      paragraphs: [
        "Math Mews ir matemātikas spēle ar virtuālu mīluli bērniem aptuveni no 6 gadu vecuma un pieaugušajiem. Šī politika skaidro spēles, kontu un pirkumu datu izmantošanu.",
        "Tiešsaistē lietotne automātiski izveido anonīmu kontu. Spēlēšanai e-pasts nav jāievada. Pieaugušais var piesaistīt atbalstītu kontu, lai saglabātu piekļuvi progresam.",
      ],
    },
    {
      title: "Informācija, ko glabājam",
      paragraphs: [
        "Spēles progress ierīcē: mīluļa vārds, istabas izkārtojums, monētas, atslēgājumi, puzļu progress un līdzīgi spēles dati.",
        "Supabase glabā mākoņa saglabājumus, pseidonīmu konta identifikatoru, monētu maku, nopelnītās monētas, tēriņus un administratora labojumus. Atjaunošanai citā ierīcē vajadzīga piekļuve tam pašam piesaistītajam kontam. Anonīms profils negarantē atjaunošanu pēc pārinstalēšanas.",
        "Apple vai Google apstrādā monētu paku maksājumus. RevenueCat apstrādā veikala darījumus un pirkumu vēsturi, izmantojot konta identifikatoru. Serveris glabā darījumu identifikatorus un monētu žurnālu, lai atkārtoti notikumi nepiešķirtu monētas vēlreiz. Mēs nesaņemam maksājumu kartes datus.",
        "Lietotnes valoda, angļu vai latviešu. Ja pieaugušais piesaista kontu vai vecāka e-pastu, Supabase apstrādā arī pieteikšanai nepieciešamos konta datus.",
        "Ja raksti atbalstam vai pieprasi konta dzēšanu e-pastā, apstrādājam tavu e-pastu un sniegto informāciju, lai atbildētu un pārbaudītu konta īpašumtiesības. Nesūti paroles, pieteikšanās kodus vai kartes datus.",
      ],
    },
    {
      title: "Informācija, ko nevācam",
      paragraphs: [
        "Mēs nelūdzam bērniem e-pastu, tālruņa numuru, mājas adresi vai precīzu atrašanās vietu.",
        "Mēs neizmantojam reklāmu izsekošanu un nepārdodam personas informāciju.",
        "Mēs apzināti nevācam no bērniem personas informāciju, kas nav nepieciešama spēles darbībai.",
      ],
    },
    {
      title: "Trešo pušu pakalpojumi",
      paragraphs: [
        "Supabase nodrošina pieteikšanos, mākoņa saglabājumus, monētu makus un dzēšanas pieprasījumus. Privātums: supabase.com/privacy",
        "RevenueCat apstrādā pirkumus un to ierakstus, kas saistīti ar pseidonīmu konta identifikatoru. Privātums: revenuecat.com/privacy",
        "Apple App Store un Google Play apstrādā maksājumus un nodrošina veikala darījumu ierakstus.",
        "GitHub Pages mitina mūsu publiskās privātuma, atbalsta un konta dzēšanas lapas. Drošības nolūkos GitHub reģistrē apmeklētāju IP adreses. GitHub privātums: docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
        "Šie pakalpojumu sniedzēji apstrādā datus saskaņā ar savām politikām. Mēs sūtām tikai to, kas nepieciešams saglabājumu sinhronizācijai un pirkumiem.",
      ],
    },
    {
      title: "Pirkumi lietotnē",
      paragraphs: [
        "Par īstu naudu pārdodam patērējamas monētu pakas. Pirkumu ekrānu aizsargā lasīšanas un secības uzdevums pieaugušajiem. Šis solis nepārbauda vecumu un nav vecāku piekrišana.",
        "Monētas pieder kontam, un tās koplieto tā mīluļi. Pirktajām monētām nav derīguma termiņa. Servera maks uzskaita atlikumu, tēriņus un atmaksas. Atjaunošana pārbauda šo atlikumu, nevis piešķir iztērētās monētas vēlreiz. Pirms pirkuma piesaistīts konts palīdz atjaunot piekļuvi citā ierīcē.",
      ],
    },
    {
      title: "Mākoņa saglabāšana un vairākas spēles",
      paragraphs: [
        "Vienā kontā var būt vairākas saglabātas spēles. Katra spēle glabāta kā atsevišķs mākoņa ieraksts.",
        "Pirms publicēšanas jāiespējo un jāpārbauda kontu piesaistīšana un atjaunošana. Līdz tam nepaļaujies uz anonīma konta pārcelšanu citā ierīcē. Vietējais vai anonīmais saglabājums var pazust pēc lietotnes noņemšanas vai ierīces maiņas. Veikala vēsture viena pati neatjauno iztērētu monētu atlikumu.",
      ],
    },
    {
      title: "Tavas izvēles",
      paragraphs: [
        "Dzēst kontu un datus iestatījumos pieprasa pieteikšanās konta un visu tā mākoņa mīluļu dzēšanu gan testa, gan produkcijas vidē. Lietotne ziņo par panākumu tikai pēc pakalpojumu sniedzēju datu sakopšanas. Kļūdas vai nepabeigta pieprasījuma gadījumā vietējā spēle un sesija paliek atkārtotam mēģinājumam. Dzēšana neatmaksā pirkumus.",
        "Puzles un mīluļa aprūpe darbojas bezsaistē. Monētu atlīdzības gaida servera sinhronizāciju. Tērēšanai un pirkumiem vajadzīgs tiešsaistes maks.",
      ],
    },
    {
      title: "Bērnu privātums",
      paragraphs: [
        "Spēle paredzēta arī bērniem. Vecākam vai aizbildnim jāveic konta piesaistīšana, pirkumi un dzēšana. Vecāka konta laukos jāievada pieaugušā, nevis bērna dati.",
        "Ja uzskati, ka esam kļūdaini savākuši bērna personas informāciju, sazinies ar mums — mēs to dzēsīsim.",
      ],
    },
    {
      title: "Drošība un glabāšana",
      paragraphs: [
        "Dati tiek pārsūtīti, izmantojot HTTPS. Mākoņa datus aizsargā rindu līmeņa drošība, lai katrs lietotājs redz tikai savus saglabājumus.",
        "Dzēšana noņem aktīvos saglabājumus, pieteikšanās kontu un RevenueCat klienta ierakstu pēc pakalpojumu datu sakopšanas. Ierobežoti pseidonīmi monētu un darījumu ieraksti paliek atkārtotas piešķiršanas novēršanai un atmaksām. Pakalpojumu rezerves kopijām un žurnāliem var būt citi glabāšanas termiņi. TODO pirms publicēšanas: ar izdevēju noteikt glabāšanas grafiku, dzēšanas izpildes termiņu un rezerves kopiju un žurnālu dzēšanas termiņus.",
      ],
    },
    {
      title: "Izmaiņas",
      paragraphs: [
        "Varam atjaunināt šo politiku. Pēdējās izmaiņas datums ir augšā. Izlasi atjaunināto politiku, kad mainās tās datums.",
      ],
    },
    {
      title: "Kontakti",
      paragraphs: [`Izdevējs: ${PUBLISHER_NAME}`, `E-pasts: ${SUPPORT_EMAIL}`],
    },
  ],
};

export function getPrivacyPolicyContent(locale: AppLocale): PrivacyPolicyContent {
  return locale === "lv" ? LV : EN;
}
