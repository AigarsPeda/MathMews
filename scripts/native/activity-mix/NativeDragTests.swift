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
   settings.exists || (onboarding.exists && onboarding.isHittable) || app.buttons["pilot-next"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func tap(_ id: String) {
  let b = app.buttons[id]; XCTAssertTrue(b.waitForExistence(timeout: 8), id)
  for _ in 0..<5 { if b.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  XCTAssertTrue(b.isHittable, id); b.tap()
 }
 func shot(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }
 func testActivityMix() throws {
  continueAfterFailure = false; app.activate()
  for index in 0..<27 {
   let meta = app.staticTexts["mix-case"]
   XCTAssertTrue(meta.waitForExistence(timeout: 20))
   let data = try XCTUnwrap(meta.label.data(using: .utf8))
   let row = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: String])
   XCTAssertEqual(row["index"], String(index)); XCTAssertFalse(app.buttons[row["check"]!].isEnabled)
   shot("mix-\(index)-\(row["locale"]!)-start")
   if row["kind"] == "write" {
    tap("response-key-9")
    XCTAssertTrue(app.buttons[row["check"]!].isEnabled == (row["format"] != "clock" && row["format"] != "fraction"))
    tap("response-key-erase"); XCTAssertFalse(app.buttons[row["check"]!].isEnabled)
    for digit in row["answer"]! { tap("response-key-" + String(digit)) }
   } else { tap(row["answer"]!) }
   XCTAssertTrue(app.buttons[row["check"]!].isEnabled)
   shot("mix-\(index)-\(row["locale"]!)-filled")
   tap(row["check"]!)
   XCTAssertTrue(app.staticTexts["mix-correct"].waitForExistence(timeout: 8))
   shot("mix-\(index)-\(row["locale"]!)-correct")
   if index < 26 { tap("mix-next") }
  }
 }
 func testRefinedPrompts() throws {
  continueAfterFailure = false; app.activate(); tap("mix-focus")
  for index in 21..<27 {
   let meta = app.staticTexts["mix-case"]
   XCTAssertTrue(meta.waitForExistence(timeout: 15))
   let row = try XCTUnwrap(try JSONSerialization.jsonObject(with: try XCTUnwrap(meta.label.data(using: .utf8))) as? [String: String])
   XCTAssertEqual(row["index"], String(index)); shot("final-mix-\(index)-ru-start")
   tap(row["answer"]!); shot("final-mix-\(index)-ru-filled"); tap(row["check"]!)
   XCTAssertTrue(app.staticTexts["mix-correct"].waitForExistence(timeout: 8))
   if index < 26 { tap("mix-next") }
  }
 }

}
