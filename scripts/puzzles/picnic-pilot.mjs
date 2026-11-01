const text=(en,lv)=>({en,lv});
/** Presentation-only pilot. Keep the existing level, scene and checkpoint IDs. */
export const picnicPilot = {
  title:text('A picnic with Boba','Pikniks ar Bobu'),
  goal:text('a picnic with friends','pikniku ar draugiem'),
  backstory:text('Boba is getting a picnic ready. Help open the basket, pack lunch and spread the blanket.','Boba gatavojas piknikam. Palīdzi atvērt grozu, salikt pusdienas un izklāt segu.'),
  intro:text('Solve three tasks to prepare the picnic together.','Atrisini trīs uzdevumus, lai kopā sagatavotu pikniku.'),
  outcome:text('Lunch is packed and the blanket is ready. Enjoy the picnic!','Pusdienas ir grozā, un sega ir izklāta. Lai jauks pikniks!'),
  stages:[
    {title:text('Open the basket','Atver grozu'),before:text('Help Boba get the basket ready.','Palīdzi Bobam sagatavot grozu.'),after:text('Boba opens the basket while the cat looks inside.','Boba atver grozu, un kaķis ieskatās tajā.')},
    {title:text('Pack lunch','Saliec pusdienas'),before:text('Get lunch into the basket.','Ieliec pusdienas grozā.'),after:text('The cat packs lunch. Boba closes the lid.','Kaķis ieliek pusdienas grozā. Boba aizver vāku.')},
    {title:text('Spread the blanket','Izklāj segu'),before:text('Make a place for the picnic.','Sagatavo vietu piknikam.'),after:text('Boba spreads the blanket. The picnic is ready!','Boba izklāj segu. Pikniks ir gatavs!')}
  ],
  catActions:[text('The cat meets Boba beside an empty basket.','Kaķis satiek Bobu pie tukša groza.'),text('Boba opens the basket; the cat looks inside.','Boba atver grozu; kaķis ieskatās tajā.'),text('The cat packs lunch and Boba closes the lid.','Kaķis saliek pusdienas, un Boba aizver vāku.'),text('Boba unfolds the blanket. Both friends sit beside their picnic.','Boba izklāj segu. Abi draugi apsēžas pie piknika groza.')]
};
