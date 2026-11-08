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
 func expect(_ text: String) { XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 8), "Missing \(text)\n\(app.debugDescription)") }
 func tap(_ id: String, _ times: Int = 1) {
  let button=app.buttons[id]; XCTAssertTrue(button.waitForExistence(timeout: 8), id)
  for _ in 0..<times {
   for _ in 0..<3 { if button.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
   XCTAssertTrue(button.isEnabled, id); XCTAssertTrue(button.isHittable, id); button.tap()
  }
 }
 func linePoint(_ tick: Int, _ divisions: Int) {
  let track=app.descendants(matching: .any)["fraction-line-track"].firstMatch
  XCTAssertTrue(track.waitForExistence(timeout: 8)); XCTAssertTrue(track.isHittable)
  track.coordinate(withNormalizedOffset: CGVector(dx: (16+(track.frame.width-32)*Double(tick)/Double(divisions))/track.frame.width, dy: 0.38)).tap()
 }
 func shot(_ name: String) { let a=XCTAttachment(screenshot: app.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a) }
 func next() { tap("pilot-next"); app.scrollViews.firstMatch.swipeDown() }
 func testFractionModels() {
  continueAfterFailure=false; app.activate()
  let springboard=XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  expect("Shade 1/2 of the strip."); XCTAssertFalse(app.buttons["pilot-check"].isEnabled); XCTAssertFalse(app.buttons["fraction-strip-remove"].isEnabled)
  tap("fraction-strip-add",2); tap("pilot-check"); expect("Try again")
  tap("fraction-strip-remove"); expect("2 parts 1 shaded"); shot("en-strip-half"); tap("pilot-check"); expect("Correct")
  XCTAssertFalse(app.buttons["fraction-strip-add"].isEnabled)
  next(); expect("Place 1/2 on the number line."); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  linePoint(0,2); expect("Point 0"); tap("pilot-check"); expect("Try again")
  linePoint(1,2); expect("Point 1"); shot("en-line-half"); tap("pilot-check"); expect("Correct")
  XCTAssertFalse(app.buttons["fraction-line-right"].isEnabled)
  next(); linePoint(4,4); expect("Point 4"); XCTAssertFalse(app.buttons["fraction-line-right"].isEnabled)
  tap("fraction-line-left"); expect("Point 3"); shot("en-independent-quarters"); tap("pilot-check"); expect("Correct")
  next(); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("fraction-strip-parts-8"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("fraction-strip-add"); tap("pilot-check"); expect("Try again")
  tap("fraction-strip-parts-4"); expect("4 parts none shaded"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("fraction-strip-add",2); shot("en-equivalent-half"); tap("pilot-check"); expect("Correct")
  next(); tap("pilot-language"); XCTAssertEqual(app.buttons["pilot-language"].label,"English")
  XCTAssertEqual(app.buttons["fraction-line-right"].label,"Soli pa labi")
  linePoint(4,6); expect("Point 4"); shot("lv-line-thirds-sixths"); tap("pilot-check"); expect("Correct")
  next(); XCTAssertEqual(app.buttons["fraction-strip-add"].label,"Iekrāso vienu daļu")
  tap("fraction-strip-parts-8"); tap("fraction-strip-add",4); expect("8 parts 4 shaded")
  tap("fraction-strip-reset"); expect("none parts none shaded"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("fraction-strip-parts-8")
  let board=app.descendants(matching: .any)["fraction-strip-board"].firstMatch
  // The six-point frame is decoration, not part of the fraction's measured whole.
  let inset = 6.0, inner = board.frame.width - inset * 2
  for (fraction, shaded) in [(0.05,0),(0.125,1),(0.5,4),(0.95,8)] {
   board.coordinate(withNormalizedOffset: CGVector(dx: (inset + inner * fraction) / board.frame.width, dy: 0.5)).tap()
   expect("8 parts \(shaded) shaded")
  }
  board.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
  expect("8 parts 4 shaded"); shot("lv-equivalent-eighths"); tap("pilot-check"); expect("Correct")
  tap("pilot-again"); tap("fraction-strip-parts-4"); tap("fraction-strip-add",2)
  expect("4 parts 2 shaded"); shot("lv-alternative-quarters"); tap("pilot-check"); expect("Correct")
  next(); linePoint(5,6); expect("Point 5"); shot("lv-independent-sixths"); tap("pilot-check"); expect("Correct")
 }
}
