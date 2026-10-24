import type { AppLocale } from "@/types/locale";

// Reward plots are independent of the learning mission. Each world keeps its own cast and setting.
const stories = {
  bridge: { en: ["Who needs a bridge?", "A perfect bridge. One very unnecessary leap."], lv: ["Kam vajag tiltu?", "Ideāls tilts. Un viens pilnīgi nevajadzīgs lēciens."] },
  book: { en: ["That wasn't in the plan", "Open the book. Meet a very big pop-up fish."], lv: ["Tas nebija plānots", "Atver grāmatu. Iepazīsties ar ļoti lielu papīra zivi."] },
  loom: { en: ["Just a little scarf", "One more row... and now it's a whole outfit."], lv: ["Tikai maza šallīte", "Vēl viena rinda... un nu tas ir vesels tērps."] },
  clock: { en: ["Act natural", "The gears go wild. Nothing to see here."], lv: ["Viss kārtībā", "Zobrati trako. Te nekas īpašs nenotiek."] },
  balloon: { en: ["The hat takes a holiday", "Ready for takeoff! The hat gets the first ride."], lv: ["Cepure dodas atvaļinājumā", "Gatavi pacelties! Pirmais brauciens tiek cepurei."] },
  sorter: { en: ["I can carry one more", "A little delivery becomes a very wobbly tower."], lv: ["Vēl vienu varu panest", "Maza piegāde pārvēršas ļoti ļodzīgā tornī."] },
  boat: { en: ["Captain Quack", "A tiny boat. A passenger who forgot to pack light."], lv: ["Kapteinis Pēkšķis", "Maza laiviņa. Un negaidīti liels pasažieris."] },
  fountain: { en: ["The fanciest hat stand", "The fountain works! The hat gets a private water ride."], lv: ["Smalkākais cepuru statīvs", "Strūklaka darbojas! Cepurei tiek īpašs ūdens brauciens."] },
  beacon: { en: ["Accidental dance star", "The light comes on. Suddenly, it's showtime."], lv: ["Nejaušā deju zvaigzne", "Iedegas gaisma. Pēkšņi sākas priekšnesums."] },
  trophy: { en: ["A slightly enormous victory", "You asked for a trophy. Nobody said how big."], lv: ["Mazliet milzīga uzvara", "Tu gribēji kausu. Neviens neteica, cik lielu."] },
} as const;
export function getAchievementStory(sceneId: string, locale: AppLocale) {
  const kind = sceneId.includes("-") ? sceneId.split("-").at(-1)! : "trophy";
  const [title, description] = (stories[kind as keyof typeof stories] ?? stories.trophy)[locale];
  return { title, description };
}
