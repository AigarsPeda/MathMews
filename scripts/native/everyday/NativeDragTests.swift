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
  // The isolated reward fixture supplies onboarding and progress itself.
  // A fresh simulator may stop at onboarding; never create a cloud save for QA.
  let onboarding = app.textFields.firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable) || app.buttons["pilot-next"].exists || app.buttons["Level 1"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}

final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 let cases: [[String]] = [["What time does the clock show?","Answer 02:30","Answer 03:30","en"],["How many toys are in group B?","Answer 20","Answer 21","en"],["How many straight sides do these shapes have altogether?","Answer 7","Answer 5","en"],["Turn the marked square 1 quarter-turn clockwise around the grid centre. Which square does it reach?","Answer 17","Answer 11","en"],["Pay with €20. How many euros remain?","Answer 14.75","Answer 14.25","en"],["How many millilitres are in the jug?","Answer 100","Answer 101","en"],["What is the volume of this box in cm³?","Answer 8","Answer 9","en"],["How many minutes pass on the same day?","Answer 90","Answer 91","en"],["Pavisam ir 130 rotaļlietu. Cik ir trūkstošajā grupā A?","Atbilde 30","Atbilde 31","lv"],["Заплати €20. Сколько евро останется после скидки?","Ответ 8,3","Ответ 7,8","ru"],["Каждая бутылка вмещает 200 мл. Сколько бутылок нужно для всей жидкости? Последняя может быть неполной.","Ответ 6","Ответ 7","ru"]]
 func tap(_ id: String) {
  let b=app.buttons[id]; XCTAssertTrue(b.waitForExistence(timeout: 8), id)
  for _ in 0..<4 { if b.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  XCTAssertTrue(b.isHittable, id); b.tap()
 }
 func shot(_ name: String) { let a=XCTAttachment(screenshot: app.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a) }
 func testShoppingItems() {
  continueAfterFailure=false; app.activate()
  let springboard=XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout:2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  tap("pilot-shopping")
  XCTAssertTrue(app.staticTexts["Prepare a picnic. Buy 1 apple and 1 cookie. What is the total cost in euros?"].waitForExistence(timeout:8))
  XCTAssertTrue(app.descendants(matching:.any)["Apple: €2. Cookie: €3."].exists)
  XCTAssertFalse(app.staticTexts["Practice money"].exists)
  shot("picnic-shopping-en")
  tap("Answer 5"); tap("pilot-check"); XCTAssertTrue(app.staticTexts["Correct"].exists)
  tap("pilot-help")
  XCTAssertTrue(app.staticTexts["A different example"].waitForExistence(timeout:8))
  XCTAssertTrue(app.descendants(matching:.any)["Apple: €5. Cookie: €6."].exists)
  shot("picnic-shopping-help")
  tap("Try my puzzle")
  tap("pilot-language")
  XCTAssertTrue(app.descendants(matching:.any)["Ābols: €2. Cepums: €3."].waitForExistence(timeout:5))
  shot("picnic-shopping-lv-320")
  tap("pilot-language")
  XCTAssertTrue(app.descendants(matching:.any)["Яблоко: €2. Печенье: €3."].waitForExistence(timeout:5))
  shot("picnic-shopping-ru-320")
 }
 func testEverydayTopics() {
  continueAfterFailure=false; app.activate()
  let springboard=XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  for (i, row) in cases.enumerated() {
   if i == 8 || i == 9 { tap("pilot-language") }
   XCTAssertTrue(app.staticTexts[row[0]].waitForExistence(timeout: 10), row[0])
   XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
   shot("everyday-\(i)-\(row[3])")
   tap(row[2]); tap("pilot-check"); XCTAssertTrue(app.staticTexts["Try again"].exists)
   tap(row[1]); tap("pilot-check"); XCTAssertTrue(app.staticTexts["Correct"].exists)
   XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
   if i == 0 || i == 8 || i == 10 {
    tap("pilot-help")
    let title = i == 0 ? "A different example" : i == 8 ? "Cits piemērs" : "Другой пример"
    XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 8)); shot("everyday-help-\(row[3])")
    let close = i == 0 ? "Try my puzzle" : i == 8 ? "Risināt savu uzdevumu" : "Перейти к моей задаче"
    tap(close)
   }
   if i < cases.count - 1 { tap("pilot-next") }
  }
 }
}
