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
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable)
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func expect(_ text: String) { XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 8), "Missing \(text)\n\(app.debugDescription)") }
 func tap(_ id: String, _ times: Int = 1) {
  let button = app.buttons[id]
  XCTAssertTrue(button.waitForExistence(timeout: 8), id)
  for _ in 0..<times {
   for _ in 0..<3 { if button.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
   XCTAssertTrue(button.isEnabled, id); XCTAssertTrue(button.isHittable, id); button.tap()
  }
 }
 func shot(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a) }
 func next() { tap("pilot-next"); app.scrollViews.firstMatch.swipeDown() }
 func testPlaceValuePilot() {
  continueAfterFailure = false; app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  expect("Build 34 with tens and ones.")
  XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("place-value-addTen", 3); tap("place-value-addOne", 3); tap("pilot-check"); expect("Try again")
  tap("place-value-addOne"); expect("3 tens 4 ones"); shot("en-build-34"); tap("pilot-check"); expect("Correct")
  XCTAssertFalse(app.buttons["place-value-addOne"].isEnabled)
  next(); expect("1 tens 15 ones"); tap("place-value-bundle"); expect("2 tens 5 ones"); tap("pilot-check"); expect("Correct")
  next(); tap("place-value-addOperand"); expect("3 tens 13 ones")
  XCTAssertFalse(app.buttons["place-value-addOperand"].isEnabled)
  tap("pilot-check"); expect("Try again"); shot("en-add-before-exchange")
  tap("place-value-bundle"); expect("4 tens 3 ones"); tap("pilot-check"); expect("Correct")
  next(); tap("place-value-split"); expect("2 tens 11 ones"); tap("pilot-check"); expect("Correct")
  next(); tap("pilot-language"); XCTAssertEqual(app.buttons["pilot-language"].label, "English"); XCTAssertEqual(app.buttons["place-value-removeTen"].label, "Atņem 1 desmitu"); shot("lv-subtraction-start")
  tap("place-value-removeOne", 2); XCTAssertFalse(app.buttons["place-value-removeOne"].isEnabled)
  tap("place-value-reset"); expect("4 tens 2 ones"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("place-value-split"); expect("3 tens 12 ones"); shot("lv-subtraction-split")
  tap("place-value-removeTen"); tap("place-value-removeOne", 7); expect("2 tens 5 ones")
  tap("pilot-check"); expect("Correct"); shot("lv-subtraction-complete")
  next(); tap("place-value-split"); tap("place-value-removeTen", 2); tap("place-value-removeOne", 4)
  expect("2 tens 7 ones"); tap("pilot-check"); expect("Correct"); shot("lv-independent-example")
 }
}
