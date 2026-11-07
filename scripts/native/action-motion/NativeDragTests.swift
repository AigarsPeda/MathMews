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
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable) || app.buttons["pilot-next"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}

final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func tap(_ id: String) {
  let b=app.buttons[id]; XCTAssertTrue(b.waitForExistence(timeout: 10), id)
  for _ in 0..<5 { if b.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  XCTAssertTrue(b.isHittable, id); b.tap()
 }
 func shot(_ name: String) { let a=XCTAttachment(screenshot: app.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a) }
 func testMeaningfulMotion() {
  continueAfterFailure=false; app.activate()
  let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout:2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  tap("Give one object")
  XCTAssertTrue(app.staticTexts["In the pool: 7. In each group: 1 · 0 · 0."].exists); shot("sharing-unequal")
  for _ in 0..<5 { tap("Give one object") }
  XCTAssertTrue(app.staticTexts["In the pool: 2. In each group: 2 · 2 · 2."].exists)
  XCTAssertFalse(app.buttons["Give one object"].isEnabled); shot("sharing-remainder")
  tap("Start again"); tap("pilot-next")
  XCTAssertTrue(app.staticTexts["1 tens 15 ones"].waitForExistence(timeout: 5)); shot("before-bundle")
  tap("place-value-bundle"); XCTAssertTrue(app.staticTexts["2 tens 5 ones"].waitForExistence(timeout: 5)); shot("after-bundle")
  tap("place-value-reset"); XCTAssertTrue(app.staticTexts["1 tens 15 ones"].waitForExistence(timeout: 5))
  tap("Corrected result"); XCTAssertTrue(app.buttons["Continue now"].waitForExistence(timeout:5)); shot("corrected-nod")
  tap("Continue now"); XCTAssertTrue(app.staticTexts["Continued 1"].waitForExistence(timeout:5))
 }
}
