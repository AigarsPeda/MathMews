import type { AppLocale } from "@/types/locale";
import { PRIVACY_POLICY_LAST_UPDATED, SUPPORT_EMAIL } from "@/constants/legal";

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
        "Math Mews is an educational math game with a virtual pet. It can be enjoyed at any age. This policy explains what information the app processes and how it is used.",
        "We designed Math Mews so children can play without creating an account or entering an email address.",
      ],
    },
    {
      title: "Information we store",
      paragraphs: [
        "Game progress on your device: pet name, room layout, coins, unlocks, puzzle progress, and similar gameplay data.",
        "A copy of that progress in our cloud database (Supabase) when you are online, tied to an anonymous identifier so the game can sync and restore after reinstall.",
        "Purchase history for coin packs: transaction identifiers and coin amounts, stored in your save and processed through Apple / Google and RevenueCat. We do not receive your payment card details.",
        "App language preference (English or Latvian).",
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
        "Supabase — hosts encrypted game save data. Privacy: supabase.com/privacy",
        "RevenueCat — manages in-app purchases and anonymous purchase records. Privacy: revenuecat.com/privacy",
        "Apple App Store / Google Play — process payments when a parent buys coin packs.",
        "These providers process data under their own policies. We only send what is needed for save sync and purchases.",
      ],
    },
    {
      title: "In-app purchases",
      paragraphs: [
        "Real-money purchases are coin packs only. A parent or guardian must pass a math question before the purchase screen opens.",
        "Coin packs are consumable. Recovery of coins and progress relies primarily on automatic cloud save, not Apple's restore purchases button.",
      ],
    },
    {
      title: "Cloud save and multiple games",
      paragraphs: [
        "You can have more than one saved game on the same account. Each game is stored as a separate cloud record.",
        "On the same device, progress usually returns after reinstall. Moving to a new phone without linking an Apple or Google account may start a new anonymous profile; older cloud saves may not appear until account linking is added in a future update.",
      ],
    },
    {
      title: "Your choices",
      paragraphs: [
        "Delete all my data in Settings removes local progress and all cloud saves for the current profile, then starts fresh.",
        "You can play offline; the game reads from your device first and syncs when a network is available.",
      ],
    },
    {
      title: "Children's privacy",
      paragraphs: [
        "Math Mews is suitable for all ages. If a child plays, a parent or guardian should supervise purchases and help with restore if needed.",
        "If you believe we have collected a child's personal information in error, contact us and we will delete it.",
      ],
    },
    {
      title: "Security and retention",
      paragraphs: [
        "Data is transmitted over HTTPS. Cloud data is protected by row-level security so each user can access only their own saves.",
        "We keep game data while you use the app. Deleting your data in Settings removes cloud copies promptly.",
      ],
    },
    {
      title: "Changes",
      paragraphs: [
        "We may update this policy. The last updated date appears at the top. Continued use after changes means you accept the updated policy.",
      ],
    },
    {
      title: "Contact",
      paragraphs: [`Email: ${SUPPORT_EMAIL}`],
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
        "Math Mews ir izglītojoša matemātikas spēle ar virtuālu mīluli. To var spēlēt jebkurā vecumā. Šī politika skaidro, kādu informāciju lietotne apstrādā un kā tā tiek izmantota.",
        "Math Mews ir veidots tā, lai bērni varētu spēlēt bez konta izveides vai e-pasta ievadīšanas.",
      ],
    },
    {
      title: "Informācija, ko glabājam",
      paragraphs: [
        "Spēles progress ierīcē: mīluļa vārds, istabas izkārtojums, monētas, atslēgājumi, puzļu progress un līdzīgi spēles dati.",
        "Šī progresa kopija mūsu mākoņa datubāzē (Supabase), kad esi tiešsaistē, saistīta ar anonīmu identifikatoru, lai spēle varētu sinhronizēt un atjaunot pēc pārinstalēšanas.",
        "Monētu paku pirkumu vēsture: darījumu identifikatori un monētu daudzumi, glabāti tavā saglabājumā un apstrādāti caur Apple / Google un RevenueCat. Mēs nesaņemam maksājumu kartes datus.",
        "Lietotnes valodas preference (angļu vai latviešu).",
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
        "Supabase — mitina šifrētus spēles saglabājumus. Privātums: supabase.com/privacy",
        "RevenueCat — pārvalda pirkumus lietotnē un anonīmus pirkumu ierakstus. Privātums: revenuecat.com/privacy",
        "Apple App Store / Google Play — apstrādā maksājumus, kad vecāks pērk monētu pakas.",
        "Šie pakalpojumu sniedzēji apstrādā datus saskaņā ar savām politikām. Mēs sūtām tikai to, kas nepieciešams saglabājumu sinhronizācijai un pirkumiem.",
      ],
    },
    {
      title: "Pirkumi lietotnē",
      paragraphs: [
        "Par īstu naudu pārdodam tikai monētu pakas. Vecākam vai aizbildnim jāatbild uz matemātikas jautājumu, pirms atveras pirkuma ekrāns.",
        "Monētu pakas ir patērējamas. Monētu un progresa atgūšana galvenokārt balstās uz automātisku mākoņa saglabāšanu, nevis Apple pirkumu atjaunošanas pogu.",
      ],
    },
    {
      title: "Mākoņa saglabāšana un vairākas spēles",
      paragraphs: [
        "Vienā kontā var būt vairākas saglabātas spēles. Katra spēle glabāta kā atsevišķs mākoņa ieraksts.",
        "Tajā pašā ierīcē progress parasti atgriežas pēc pārinstalēšanas. Pārejot uz jaunu tālruni bez Apple vai Google konta saistīšanas var sākties jauns anonīms profils; vecākie mākoņa saglabājumi var nebūt redzami, līdz nākotnē pievienosim kontu saistīšanu.",
      ],
    },
    {
      title: "Tavas izvēles",
      paragraphs: [
        "Dzēst visus manus datus iestatījumos noņem lokālo progresu un visus mākoņa saglabājumus pašreizējam profilam, pēc tam sākas no jauna.",
        "Vari spēlēt bezsaistē; spēle vispirms lasa no ierīces un sinhronizē, kad ir tīkls.",
      ],
    },
    {
      title: "Bērnu privātums",
      paragraphs: [
        "Math Mews ir piemērots jebkuram vecumam. Ja spēlē bērns, vecākam vai aizbildnim jāuzrauga pirkumi un jāpalīdz ar atjaunošanu, ja nepieciešams.",
        "Ja uzskati, ka esam kļūdaini savākuši bērna personas informāciju, sazinies ar mums — mēs to dzēsīsim.",
      ],
    },
    {
      title: "Drošība un glabāšana",
      paragraphs: [
        "Dati tiek pārsūtīti, izmantojot HTTPS. Mākoņa datus aizsargā rindu līmeņa drošība, lai katrs lietotājs redz tikai savus saglabājumus.",
        "Glabājam spēles datus, kamēr lieto lietotni. Dzēšot datus iestatījumos, mākoņa kopijas tiek noņemtas nekavējoties.",
      ],
    },
    {
      title: "Izmaiņas",
      paragraphs: [
        "Varam atjaunināt šo politiku. Pēdējās izmaiņas datums ir augšā. Turpinot lietot pēc izmaiņām, tu piekrīti atjauninātajai politikai.",
      ],
    },
    {
      title: "Kontakti",
      paragraphs: [`E-pasts: ${SUPPORT_EMAIL}`],
    },
  ],
};

export function getPrivacyPolicyContent(locale: AppLocale): PrivacyPolicyContent {
  return locale === "lv" ? LV : EN;
}
