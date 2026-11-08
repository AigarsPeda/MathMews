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
 func testReachability() {
  continueAfterFailure=false; app.activate()
  XCTAssertTrue(app.staticTexts["puzzle-question"].waitForExistence(timeout:15))
  Thread.sleep(forTimeInterval:0.6)
  let top=XCTAttachment(screenshot:app.screenshot());top.name="Top";top.lifetime = .keepAlways;add(top)
  let help=app.buttons["puzzle-picture-help"]
  for _ in 0..<4 { if help.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  XCTAssertTrue(help.isHittable)
  let answer=app.buttons.matching(NSPredicate(format:"label ENDSWITH ' 11'")).firstMatch
  XCTAssertTrue(answer.isHittable); answer.tap()
  let controls=XCTAttachment(screenshot:app.screenshot());controls.name="Controls";controls.lifetime = .keepAlways;add(controls)
 }
 func testReview() {
  continueAfterFailure=false; app.activate()
  let question=app.staticTexts["puzzle-question"]
  XCTAssertTrue(question.waitForExistence(timeout:15))
  let help=app.buttons["puzzle-picture-help"], scroll=app.scrollViews.firstMatch
  XCTAssertTrue(help.waitForExistence(timeout:5)); XCTAssertTrue(help.isHittable)
  for number in ["10", "11", "12"] { XCTAssertTrue(app.buttons["Answer " + number].isHittable) }
  XCTAssertGreaterThanOrEqual(question.frame.minY, scroll.frame.minY)
  XCTAssertLessThanOrEqual(help.frame.maxY, scroll.frame.maxY)
  let before=question.frame.minY
  let initial=XCTAttachment(screenshot:app.screenshot());initial.name="iPhone15-chart";initial.lifetime = .keepAlways;add(initial)
  scroll.swipeUp()
  XCTAssertEqual(question.frame.minY,before,accuracy:1,"All content must fit without scrolling at default text size")
  app.buttons["Answer 11"].tap()
  XCTAssertTrue(app.buttons["Check answer"].isEnabled)
  let selected=XCTAttachment(screenshot:app.screenshot());selected.name="iPhone15-selected";selected.lifetime = .keepAlways;add(selected)
 }
}
