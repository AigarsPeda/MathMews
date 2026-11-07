import XCTest
final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  let developerIntro = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'This is the developer menu'")).firstMatch
  if developerIntro.waitForExistence(timeout: 15), app.buttons["Continue"].exists { app.buttons["Continue"].tap() }
  let reload = app.buttons["Reload"]
  if reload.exists {
   let window = app.windows.firstMatch.frame
   let close = app.buttons.allElementsBoundByIndex.first { $0.isHittable && $0.frame.midX > window.width * 0.8 && $0.frame.maxY <= reload.frame.minY && $0.frame.minY > window.height * 0.25 }
   XCTAssertNotNil(close); close?.tap()
  }
  let settings = app.buttons.matching(NSPredicate(format: "label == 'Open settings' OR label == 'Atvērt iestatījumus'")).firstMatch
  // The isolated feedback fixture supplies onboarding and progress itself.
  // A fresh simulator may stop at onboarding; never create a cloud save for QA.
  let onboarding = app.textFields.firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable) || app.buttons["pilot-next"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 let app=XCUIApplication(bundleIdentifier:"com.mathmews.app")
 func tap(_ id:String) {
  let button=app.buttons[id]
  for _ in 0..<3 { if button.exists && button.isHittable {break};app.scrollViews.firstMatch.swipeUp() }
  for _ in 0..<3 { if button.exists && button.isHittable {break};app.scrollViews.firstMatch.swipeDown() }
  XCTAssertTrue(button.isHittable,id);button.tap()
 }
 func hasText(_ text:String) -> Bool {
  app.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS %@",text)).firstMatch.waitForExistence(timeout:5)
 }
 func testBridgeFeedback() {
  continueAfterFailure=false;app.activate()
  XCTAssertTrue(app.buttons["feedback-next"].waitForExistence(timeout:30))
  let checks = ["Check answer", "Pārbaudīt atbildi", "Проверить ответ"]
  let first = [["Use the same scale factor for both quantities, rather than adding the same amount.", "Check the sign: negative numbers are left of zero, and positive numbers are right of zero.", "A number is still added beside x. Subtract it from both sides.", "Your x and y coordinates are swapped. Read x first, then y."], ["Abus daudzumus reizini ar vienu un to pašu skaitli, nevis pieskaiti tiem vienādu daudzumu.", "Pārbaudi zīmi: negatīvi skaitļi ir pa kreisi no nulles, pozitīvi ir pa labi.", "Pie x vēl ir pieskaitīts skaitlis. Atņem to no abām pusēm.", "Tavas x un y koordinātas ir samainītas vietām. Vispirms nolasi x, tad y."], ["Умножай обе величины на один и тот же множитель, а не прибавляй одно и то же число.", "Проверь знак: отрицательные числа находятся слева от нуля, положительные — справа.", "Рядом с x ещё прибавлено число. Вычти его из обеих частей.", "Координаты x и y поменялись местами. Сначала прочитай x, затем y."]]
  let details = [["Find the multiplier from the first group count to the second, then multiply the item count by it.", "Start at zero and count equal spaces toward the required side.", "Use the same addition or subtraction on both sides until the separate number beside x is gone.", "Start at the origin. Follow x across first, then y up or down."], ["Atrodi, ar ko jāreizina pirmais grupu skaits, lai iegūtu otro. Ar to pašu skaitli reizini priekšmetu skaitu.", "Sāc no nulles un skaiti vienādas atstarpes vajadzīgajā virzienā.", "Abās pusēs veic vienādu saskaitīšanu vai atņemšanu, līdz atsevišķais skaitlis pie x pazūd.", "Sāc koordinātu sākumpunktā. Vispirms seko x pa labi vai kreisi, tad y uz augšu vai leju."], ["Найди множитель, который превращает первое число групп во второе. Умножь на него и количество предметов.", "Начни от нуля и отсчитывай равные промежутки в нужную сторону.", "Прибавляй или вычитай одно и то же с обеих сторон, пока отдельное число рядом с x не исчезнет.", "Начни в начале координат. Сначала отсчитай x по горизонтали, затем y вверх или вниз."]]
  for slot in 0..<12 {
   let lang=slot/4, kind=slot%4
   XCTAssertTrue(hasText("Lives 3"))
   switch kind {
   case 0: tap("bridge-digit-5")
   case 1: tap("bridge-step-1")
   case 2: tap("bridge-add-1")
   default: tap("bridge-x-1");tap("bridge-x-1");tap("bridge-y-1")
   }
   tap(checks[lang]);XCTAssertTrue(hasText(first[lang][kind]));XCTAssertTrue(hasText("Lives 2"))
   switch kind {
   case 0: tap("bridge-erase");tap("bridge-digit-3")
   case 1: tap("bridge-step--1")
   case 2: tap("bridge-add-1")
   default: tap("bridge-x--1")
   }
   tap(checks[lang]);XCTAssertTrue(hasText(details[lang][kind]));XCTAssertTrue(hasText("Lives 1"))
   let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name="feedback-\(slot)";attachment.lifetime = .keepAlways;add(attachment)
   // The expanded banner must leave the draft controls reachable by scrolling.
   switch kind {
   case 0: tap("bridge-erase")
   case 1: tap("bridge-step-1")
   case 2: tap("bridge-add-1")
   default: tap("bridge-x-1")
   }
   XCTAssertFalse(app.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS %@",details[lang][kind])).firstMatch.exists)
   XCTAssertTrue(hasText("Lives 1"))
   if slot<11 {tap("feedback-next")}
  }
 }
}
