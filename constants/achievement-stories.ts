import type { AppLocale } from "@/types/locale";

// Ten short films, each presented on the collectible stage of its learning world.
const stories = {
  bridge: { en: ["Nailed the landing", "One mighty leap. One very surprised cushion.", "The landing is ready. Is the cat?"], lv: ["Ideāla piezemēšanās", "Viens varens lēciens. Un ļoti pārsteigts spilvens.", "Viss gatavs lēcienam. Vai kaķītis arī?"] },
  book: { en: ["Catch of the day", "This story has a fishy ending. Quick, catch it!", "An ordinary book. Probably."], lv: ["Dienas loms", "Grāmata atveras, un ārā izlec zivs. Ķer!", "Parasta grāmata. Droši vien."] },
  loom: { en: ["Purrito", "One tiny tug. Five turns of yarn. One very cosy cat.", "Just one little ball of yarn..."], lv: ["Kaķītis kamolītī", "Viens rāviens, pieci dzijas apļi, un kaķītim silti!", "Tikai viens mazs dzijas kamoliņš..."] },
  clock: { en: ["Totally planned", "The alarm falls apart. The cat acts like that was the plan.", "Someone forgot to turn off the alarm."], lv: ["Viss bija plānots", "Modinātājs izjūk. Kaķītis izliekas, ka tā bija iecerēts.", "Kāds aizmirsa izslēgt modinātāju."] },
  balloon: { en: ["Unexpected takeoff", "Hold the balloon... or let the balloon hold you.", "How strong can one little balloon be?"], lv: ["Negaidīta pacelšanās", "Turi balonu... vai ļauj balonam turēt tevi.", "Cik stiprs var būt viens mazs balons?"] },
  sorter: { en: ["Special delivery", "The box was empty. The cat had other ideas.", "A mysterious delivery is waiting."], lv: ["Īpaša piegāde", "Kaste bija tukša. Kaķītim bija cita doma.", "Tevi gaida noslēpumaina piegāde."] },
  boat: { en: ["Captain Quack", "A duck float, a tiny crew and a very fluffy captain.", "The captain is ready for a first voyage."], lv: ["Kapteinis Pēkšķis", "Visi uz klāja pie pūkainākā pīļu kapteiņa!", "Kapteinis ir gatavs savam pirmajam braucienam."] },
  fountain: { en: ["Ah... ah... ACHOO!", "One drop of water. One giant flower. One enormous sneeze.", "This flower needs a tiny drink."], lv: ["Ā... ā... APČĪ!", "Ūdens piliens, milzu puķe un varens šķaudiens.", "Šī puķe grib mazliet padzerties."] },
  beacon: { en: ["Disco whiskers", "The spotlight is on. These paws were born to dance.", "One cat. One spotlight."], lv: ["Disko ūsiņas", "Gaisma iedegas. Šīs ķepiņas ir dzimušas dejai.", "Viens kaķītis. Viens prožektors."] },
  trophy: { en: ["Best. Cat bed. Ever.", "A trophy this comfy deserves a victory nap.", "You earned the trophy. The cat has plans."], lv: ["Labākā kaķa gultiņa", "Uzvara nosvinēta. Laiks snaudai kausā.", "Tu ieguvi kausu. Kaķītim ir savi plāni."] },
} as const;
export function getAchievementStory(sceneId: string, locale: AppLocale) {
  const kind = sceneId.includes("-") ? sceneId.split("-").at(-1)! : "trophy";
  const [title, description, teaser] = (stories[kind as keyof typeof stories] ?? stories.trophy)[locale];
  return { title, description, teaser };
}
