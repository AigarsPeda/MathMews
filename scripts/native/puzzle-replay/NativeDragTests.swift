import XCTest

final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  let intro = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'This is the developer menu'")).firstMatch
  if intro.waitForExistence(timeout: 15), app.buttons["Continue"].exists { app.buttons["Continue"].tap() }
  let reload = app.buttons["Reload"]
  if reload.exists {
   let frame = app.windows.firstMatch.frame
   app.buttons.allElementsBoundByIndex.first { $0.isHittable && $0.frame.midX > frame.width * 0.8 && $0.frame.maxY <= reload.frame.minY && $0.frame.minY > frame.height * 0.25 }?.tap()
  }
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   app.buttons["Open settings"].isHittable || app.textFields.firstMatch.isHittable || app.buttons["QA Replay"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}

final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["QA Replay"].waitForExistence(timeout: 15))
 }
 func tap(_ label: String) {
  let button = app.buttons[label]
  XCTAssertTrue(button.waitForExistence(timeout: 10), label)
  XCTAssertTrue(button.isHittable, label); button.tap()
 }
 func answer(_ value: String) { tap("Answer \(value)"); tap("Check answer") }
 func shot(_ name: String) {
  let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
 }
 func assertSecondOpen() {
  XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'QA level 2 open'")).firstMatch.exists)
  XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'QA baskets 1'")).firstMatch.exists)
 }
 func startTimed() {
  tap("QA Timed")
  let timed = app.descendants(matching: .any)["pace-timed"]
  XCTAssertTrue(timed.waitForExistence(timeout: 5)); timed.tap(); tap("Start challenge")
 }
 func testFullReplayAndNextLevel() {
  tap("QA Replay")
  for value in ["10", "5", "11:00", "8", "600", "2", "2"] {
   answer(value); tap("Next puzzle"); assertSecondOpen()
  }
  let timed = app.descendants(matching: .any)["pace-timed"]
  XCTAssertTrue(timed.waitForExistence(timeout: 5)); timed.tap(); tap("Start challenge")
  for value in ["10:00", "4"] { answer(value); tap("Next puzzle"); assertSecondOpen() }
  answer("3"); XCTAssertTrue(app.buttons["Next level"].waitForExistence(timeout: 10)); shot("replay-complete-next-level")
  tap("Next level")
  XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Make a reading corner.'")).firstMatch.waitForExistence(timeout: 5))
  assertSecondOpen(); shot("level-two-after-replay")
 }
 func testReopenTimedReplayWithoutReplayFlag() {
  startTimed(); answer("10:00"); tap("Next puzzle")
  // Save and remount to model leaving and reopening the level.
  tap("QA Reopen")
  answer("4"); tap("Next puzzle"); assertSecondOpen()
  answer("3"); tap("Next level"); assertSecondOpen(); shot("reopened-timed-replay-complete")
 }
 func testTimeoutAndUntimedRetry() {
  startTimed(); answer("10:00"); tap("Next puzzle")
  tap("QA Expire")
  XCTAssertTrue(app.buttons["Try again"].waitForExistence(timeout: 5)); assertSecondOpen()
  let untimed = app.descendants(matching: .any)["pace-untimed"]
  XCTAssertTrue(untimed.waitForExistence(timeout: 5)); untimed.tap(); tap("Try again")
  for value in ["10:00", "4"] { answer(value); tap("Next puzzle"); assertSecondOpen() }
  answer("3"); tap("Next level"); assertSecondOpen(); shot("expired-replay-untimed-retry")
 }
}
