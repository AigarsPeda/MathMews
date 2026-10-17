-- Permanent virtual coin price reduction. Re-runs do not halve prices again.
-- Existing campaign labels and start/end times are retained; sale ratios scale
-- to the new base price. Confirmed wallet history and ownership are untouched.
begin;
create temporary table bedroom_price_changes on commit drop as
select kind, old_price, new_price, unnest(item_ids) as item_id
from (values
('bed',12,6,array['blue','green','red']::text[]),
('bed',16,8,array['pink']::text[]),
('bed',20,10,array['purple']::text[]),
('bed',24,12,array['houseA']::text[]),
('bed',32,16,array['houseB']::text[]),
('bed',36,18,array['houseC']::text[]),
('bed',40,20,array['houseD']::text[]),
('bed',48,24,array['houseE']::text[]),
('bed',52,26,array['houseF']::text[]),
('bed',56,28,array['houseG']::text[]),
('decoration',12,6,array['shelfBlue']::text[]),
('decoration',16,8,array['booksBookGreen','halloweenPumpkin','kitchenBreadBasket','kitchenMixerHand','rugStripedRunner','shelfGreen','tableTan']::text[]),
('decoration',20,10,array['bedroomFloorLamp','booksPile','carpetTile','catTreeTan','halloweenGhostLantern','halloweenWitchHat','kitchenChairWindsor','lampTableCeramic','lickingPad','poster1','rugBraidedRound','tablePink']::text[]),
('decoration',24,12,array['bathroomBathCarpet','bathroomBathWindow','bathroomLaundryHamper','bedroomNightstand','booksNotebooks','booksRingBinderBlue','carpetSmall','catTreeBlue','catTreePink','chairOfficeA','chairOfficeB','computerBendedScreen','computerNewImacB','computerOldImacB','computerOldPcB','computerRotationScreenB','computerRotationScreenC','computerVerticalScreen','curtainCreamLinen','feedingTile','halloweenBatGarland','kitchenBarStoolOak','kitchenChairMint','kitchenMixerStand','lampTableBanker','lampTableMushroom','lavaLampOff','officeAc','plantA','plantSmall','poster2','poster3','rugFlowerPink','tableBlue','tablePurple','windowPlain']::text[]),
('decoration',28,14,array['bathroomDuck','bathroomHanger','bathroomTowelStand','booksRingBinderDark','carpetClassic','chairOfficeMain','computerNewImacA','computerNewKeyboard','consoleAtari','curtainRoseTieback','feedingPebble','halloweenCauldron','kitchenBarStoolMetal','kitchenChairUpholstered','kitchenMicrowave','lampFloorPaper','lavaLampAni','livingAirCon','officeBlueprint','officeBoardEmpty','officeBoardFull','plantB','portraitCat','poster4','rugGeometricTeal','tvBigAniA','tvBigAniB','tvBigOff','tvDvdAni','wallSpotCylinderBlack','wallSpotCylinderWhite','windowBlinds']::text[]),
('decoration',32,16,array['bathroomHangingTowel','bathroomLongShelf','booksRingBinderGreen','booksRingBinderOrange','bowlTan','carpetRound','chairClassicA','cleaningRobot','computerOldImacA','computerOldKeyboard','consoleDreamcast','consoleGameboy','curtainBlueDrape','deskWoodA','japaneseBonsai','japaneseCandle','kitchenBarStoolVelvet','kitchenChairBistro','kitchenModernShelfCharcoal','kitchenModernShelfNavy','kitchenModernShelfSage','kitchenModernShelfWhite','livingBook','officeCalculator','officeCartonBox','plantE','poster16','poster5','sofaA','wallSpotBellBrass','wallSpotBellRose','window7A','windowWhiteClassic']::text[]),
('decoration',36,18,array['bathroomMirror','bathroomShowerBin','booksRingBinderRed','bowlBlue','carpetRed','chairClassicB','computerOldPcA','computerPcTower','consoleGameboyAdvance','foodTrailTray','japaneseCartonBox','lampFloorTripod','livingSmallTable','officeCorkboardA','officeCorkboardB','officeDiploma','plantCactusA','poster17','sofaB','wallSpotBarChrome','wallSpotBarOak','window7B','window7C','windowRoundPorthole']::text[]),
('decoration',40,20,array['bathroomShowerFloor','bathroomShowerTap','booksRingBinderYellow','bowlPurple','chairClassicC','computerRotationScreenA','consoleGamecube','consoleNes','deskWoodB','doorOakPanel','japaneseCanvas','japaneseClothesCase','kibbleDispenser','kitchenDiningTable','kitchenModernFloorShelfCharcoal','kitchenModernFloorShelfNavy','kitchenModernFloorShelfSage','kitchenModernFloorShelfWhite','kitchenWallCabinetSage','livingSpeaker','officeDrawingTable','officeFireExtinguisher','plantCactusB','plantSunflower','posterFire','posterMap','sofaPillow','window8A','windowOakWide']::text[]),
('decoration',44,22,array['bathroomShowerTray','bedroomDresser','bowlPink','chairClassicD','chairRockingOak','computerMacbookClosed','computerWacomTablet','consoleNes4','doorMintGlass','japaneseCanvasLetters','kitchenModernWallCabinetCharcoal','kitchenModernWallCabinetNavy','kitchenModernWallCabinetSage','kitchenModernWallCabinetWhite','kitchenWallCabinetOak','lampFloorArc','livingTable','officeGlassWall','officeHeadset','plantPotted','posterMedical','sofaBlueClassic','window8B','yarnRed']::text[]),
('decoration',48,24,array['bathroomSmallShelf','bathroomSoapGreen','chairGamingA','computerBendedScreenAni','computerMacbookOpen','consoleN64','consoleNes4B','deskOffice','japaneseLamp','japanesePlant','kitchenSinkCabinet','kitchenWallCabinetGlass','livingShelvingA','officeKitchenTable','officeLongRack','officePaper1','plantTallGreen','window8C','windowArched','yarnBlue']::text[]),
('decoration',52,26,array['bathroomSoapRed','bathroomSoapYellow','chairGamingB','computerMacbookAni','computerPcTowerAni','consoleSwitch','doorBarnSliding','foodBag','japaneseSeat','livingShelvingB','officePaper2','officePaper3','plantTallPink','sofaRoseTufted','window11A']::text[]),
('decoration',56,28,array['bathroomDoubleVanity','bathroomTapShower','bathroomTapWall','bedroomWardrobe','chairGamingC','consolePs1','consolePsp','japaneseShelf','japaneseTable','kitchenModernCounterCharcoal','kitchenModernCounterNavy','kitchenModernCounterSage','kitchenModernCounterWhite','kitchenRange','officePaper4','officePaper5','officePaper6','plantTallBlue','sofaTanLeather','window11B','window11C']::text[]),
('decoration',60,30,array['bathroomTissues','bathroomToiletPaper','chairGamingD','consolePs2','japaneseToriGate','kitchenFridge','officePartition','officePencilHolder','plantTallPurple','windowJapaneseL']::text[]),
('decoration',64,32,array['bathroomShowerCabin','bathroomTowelBlue','bedroomDoubleBed','consolePs3','japaneseBaseCup','kitchenModernSinkCharcoal','kitchenModernSinkNavy','kitchenModernSinkSage','kitchenModernSinkWhite','officePhotosA','officePhotosB','sofaCreamCloud','windowJapaneseR']::text[]),
('decoration',68,34,array['bathroomTowelGreen','bathroomTowelRed','consolePs4','consolePs5','japaneseCup','japaneseDish','kitchenModernInductionCharcoal','kitchenModernInductionNavy','kitchenModernInductionSage','kitchenModernInductionWhite','officePictureFrame','officeProjectorStand','officeRack']::text[]),
('decoration',72,36,array['bathroomBathAni','bathroomBathOvalCharcoal','bathroomBathOvalRose','bathroomBathOvalSage','bathroomBathOvalWhite','bathroomWcFurniture','consoleSnes','japaneseTea','kitchenIsland','officeRolledPapers','officeRuler']::text[]),
('decoration',76,38,array['bathroomWcAni','bathroomWcTapAni','consoleSegaGenesis','consoleWii','japaneseCloset','japaneseVase','livingFireplaceCream','officeRumbaRobot','officeStickyNote1','officeStickyNote2','sofaCornerSage']::text[]),
('decoration',80,40,array['bathroomBathClawfootCream','bathroomBathClawfootNavy','consoleXbox','consoleXbox360','consoleXboxX','japaneseClosetBase','japaneseClosetDoor1Closed','japaneseClosetDoor1Open','japaneseClosetDoor2Closed','japaneseClosetDoor2Open','japaneseClosetDrawerClosed','japaneseClosetDrawerOpen','japaneseDoorAni','japaneseSlidingDoorAni','officeClockAni','officeCopyMachineDarkAni','officeCopyMachineWhiteAni','officeDocumentShredderAni','officeMedicalKitAni','officeMetallicClosetAni','officePrinterAni','officeProjectorAni','officeProjectorScreenAni','officeStickyNote3','officeStickyNote4','officeStickyNote5','officeStickyNote6','officeStickyNoteBlue','officeStickyNoteGreen','officeStickyNotePink','officeStickyNoteRed','officeTelephone','officeTrashEmpty','officeTrashFull','officeTrashSquare','officeTvOff','officeWaterDispenserAni','officeWhiteboardEraser','officeWhiteBox','officeWoodClosetAni']::text[]),
('decoration',84,42,array['kitchenModernFridgeCharcoal','kitchenModernFridgeNavy','kitchenModernFridgeSage','kitchenModernFridgeWhite']::text[]),
('decoration',88,44,array['kitchenModernIslandCharcoal','kitchenModernIslandNavy','kitchenModernIslandSage','kitchenModernIslandWhite']::text[]),
('decoration',96,48,array['bathroomJacuzziSage','bathroomJacuzziWhite']::text[]),
('life',15,7,array['one']::text[]),
('room',12,6,array['room2']::text[]),
('room',16,8,array['room3']::text[]),
('room',20,10,array['room4']::text[]),
('room',24,12,array['room5','room6']::text[]),
('room',28,14,array['room7']::text[]),
('room',32,16,array['room8','room9']::text[]),
('room',36,18,array['room10']::text[]),
('room',40,20,array['room11','room12']::text[]),
('room',44,22,array['room13']::text[]),
('room',48,24,array['room14','room15','room20','room25']::text[]),
('room',52,26,array['room16','room17','room21','room28']::text[]),
('room',56,28,array['room18','room19','room22','room23','room26','room27','room29','room30']::text[]),
('room',60,30,array['room24']::text[]),
('skin',12,6,array['orange']::text[]),
('skin',16,8,array['grey']::text[]),
('skin',24,12,array['white']::text[]),
('toy',12,6,array['blueBall','mouse','pinkBall','scratchPostGreen']::text[]),
('toy',16,8,array['scratchPostBlue']::text[]),
('toy',20,10,array['scratchPostPurple']::text[]),
('toy',24,12,array['scratchPostRed']::text[])
) as prices(kind,old_price,new_price,item_ids);
do $$
begin
  if exists(select 1 from bedroom_price_changes p join wallet_private.store_catalog c
    on c.kind=p.kind and c.item_id=p.item_id where c.price not in(p.old_price,p.new_price)) then
    raise exception 'Catalog prices changed since the price review. Refresh the reduction before applying.';
  end if;
end $$;
with changed as (
  update wallet_private.store_catalog c
  set price=p.new_price,
      sale_price=case when c.sale_price is null then null
        else floor(p.new_price::numeric*c.sale_price/c.price)::integer end
  from bedroom_price_changes p
  where c.kind=p.kind and c.item_id=p.item_id and c.price=p.old_price
  returning c.kind,c.item_id
)
select kind,count(*) as items_reduced from changed group by kind order by kind;
commit;
