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
  // The isolated lesson fixture supplies onboarding and progress itself.
  // A fresh simulator may stop at onboarding; never create a cloud save for QA.
  let onboarding = app.textFields.firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable) || app.buttons["qa-Topics"].exists || app.buttons["Cat plans"].exists || app.buttons["Level 1"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}

final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func tap(_ id: String) {
  let button = app.buttons[id]; XCTAssertTrue(button.waitForExistence(timeout: 10), id)
  for _ in 0..<5 { if button.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  XCTAssertTrue(button.isHittable, id); button.tap()
 }
 func shot(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }
 func heading(_ prefix: String) -> XCUIElement { app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch }
 func testCatPlans() {
  continueAfterFailure = false; app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  XCTAssertTrue(app.buttons["Addition"].waitForExistence(timeout: 15)); shot("subjects-first")
  XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label CONTAINS 'rewards'")).firstMatch.exists)
  for _ in 0..<6 { if app.buttons["Cat plans"].isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  shot("cat-plans-separated")
  tap("Cat plans"); XCTAssertTrue(app.buttons["Level 1"].waitForExistence(timeout: 5)); shot("three-cat-plans-with-decoration")
  tap("qa-Timer"); XCTAssertTrue(heading("Prepare a picnic").waitForExistence(timeout: 5)); shot("simple-timer-choice")
  let timed = app.descendants(matching: .any)["pace-timed"]; XCTAssertTrue(timed.waitForExistence(timeout: 5)); timed.tap(); tap("Start challenge")
  XCTAssertTrue(heading("Prepare a picnic. The cats arrive").waitForExistence(timeout: 5)); shot("picnic-clock")
  let wrongClock = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Answer ' AND label != 'Answer 10:00'")).firstMatch
  XCTAssertTrue(wrongClock.waitForExistence(timeout: 5)); wrongClock.tap(); tap("Check answer")
  XCTAssertTrue(app.buttons["Try again"].waitForExistence(timeout: 5)); shot("mistake-recovery")
  XCTAssertTrue(app.staticTexts["Lives 2"].exists); XCTAssertTrue(app.buttons["Back to path"].exists)
  tap("Try again"); XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  XCTAssertTrue(app.staticTexts["Lives 2"].exists)
  tap("Answer 10:00"); tap("Check answer"); tap("Next puzzle")
  XCTAssertTrue(heading("Prepare a picnic. Each water station").waitForExistence(timeout: 5)); shot("picnic-water")
  tap("qa-Last life")
  let wrongWater = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Answer ' AND label != 'Answer 4'")).firstMatch
  XCTAssertTrue(wrongWater.waitForExistence(timeout: 5)); wrongWater.tap(); tap("Check answer")
  XCTAssertTrue(app.buttons["Refill lives to try again"].waitForExistence(timeout: 5)); shot("empty-lives-recovery")
  XCTAssertTrue(app.staticTexts["Lives 0"].exists); XCTAssertTrue(app.buttons["Back to path"].isHittable)
  XCTAssertFalse(app.buttons["Check answer"].exists)
  tap("Refill lives to try again")
  let buy = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Buy a life for'")).firstMatch
  XCTAssertTrue(buy.waitForExistence(timeout: 5))
  let refillCost = buy.label.components(separatedBy: CharacterSet.decimalDigits.inverted).compactMap { Int($0) }.first!
  buy.tap()
  XCTAssertTrue(app.buttons["Try again"].waitForExistence(timeout: 5)); tap("Try again")
  tap("Answer 4"); tap("Check answer"); tap("Next puzzle")
  XCTAssertTrue(heading("Prepare a picnic. Your pretend budget").waitForExistence(timeout: 5)); shot("picnic-budget")
  tap("Answer 3"); tap("Check answer")
  XCTAssertTrue(heading("The picnic is ready.").waitForExistence(timeout: 5)); shot("plan-complete")
  XCTAssertTrue(app.staticTexts["Run completed"].exists)
  XCTAssertTrue(app.staticTexts["Bread baskets 1"].exists)
  XCTAssertTrue(app.buttons["Place in house"].exists)
  XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'You earned Bread basket'")).firstMatch.exists)
  XCTAssertTrue(app.staticTexts["Coins \(66 - refillCost)"].exists)
  XCTAssertFalse(app.buttons["New milestone performance"].exists)
  XCTAssertFalse(app.buttons["Watch the adventure ending"].exists)
  tap("Next level"); XCTAssertTrue(heading("Make a reading corner.").waitForExistence(timeout: 5)); shot("reading-corner")
  tap("qa-Party"); XCTAssertTrue(heading("Plan a cat party.").waitForExistence(timeout: 5)); shot("cat-party")
  tap("qa-Language"); XCTAssertTrue(heading("Izplāno kaķu ballīti.").waitForExistence(timeout: 5)); shot("cat-party-lv-narrow")
  tap("qa-Language"); XCTAssertTrue(heading("Спланируй кошачью вечеринку.").waitForExistence(timeout: 5)); shot("cat-party-ru-narrow")
  tap("qa-Language")
  let wrongParty = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Answer ' AND label != 'Answer 16'")).firstMatch
  XCTAssertTrue(wrongParty.waitForExistence(timeout: 5)); wrongParty.tap(); tap("Check answer")
  tap("Back to path")
  let returned = app.buttons["Level 1"].waitForExistence(timeout: 10)
  shot("returned-to-path")
  if !returned { let diagnostic = XCTAttachment(string: app.debugDescription); diagnostic.lifetime = .keepAlways; add(diagnostic) }
  XCTAssertTrue(returned)
  XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label CONTAINS 'rewards'")).firstMatch.exists)
 }
}
