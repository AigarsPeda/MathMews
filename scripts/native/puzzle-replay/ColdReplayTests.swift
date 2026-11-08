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
   if springboard.buttons["Open"].exists { springboard.buttons["Open"].tap() }
   if app.buttons["Open"].exists { app.buttons["Open"].tap() }
   if intro.exists && app.buttons["Continue"].exists { app.buttons["Continue"].tap() }
   return app.buttons["Open settings"].exists || app.textFields.firstMatch.exists || app.buttons["QA Seed replay"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}

final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["QA Seed replay"].waitForExistence(timeout: 20))
 }
 func tap(_ label: String) {
  let button = app.buttons[label]; XCTAssertTrue(button.waitForExistence(timeout: 10), label)
  XCTAssertTrue(button.isHittable, label); button.tap()
 }
 func answer(_ value: String) { tap("Answer \(value)"); tap("Check answer") }
 func diskMatches() { XCTAssertTrue(app.staticTexts["QA disk matches"].waitForExistence(timeout: 10), "The production provider writes this checkpoint to disk") }
 func runSnapshot() -> [String] {
  let row = app.staticTexts["cold-run"]; XCTAssertTrue(row.waitForExistence(timeout: 10))
  return String(row.label.dropFirst("QA run ".count)).components(separatedBy: "|")
 }
 func assertSecondOpen(lives: Int = 3) {
  XCTAssertEqual(app.staticTexts["cold-unlock"].label, "QA level 2 open, lives \(lives)")
 }
 func shot(_ name: String) {
  let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
 }
 func startTimed() {
  tap("QA Seed replay")
  let timed = app.descendants(matching: .any)["pace-timed"]
  XCTAssertTrue(timed.waitForExistence(timeout: 10)); timed.tap(); tap("Start challenge")
  diskMatches(); assertSecondOpen()
 }
 func coldRestart(until: TimeInterval? = nil) {
  app.terminate()
  XCTAssertEqual(app.state, .notRunning, "The app process must be stopped, not just backgrounded")
  if let until = until { Thread.sleep(forTimeInterval: max(2, until - Date().timeIntervalSince1970 + 1)) }
  else { Thread.sleep(forTimeInterval: 2) }
  app.launch()
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   self.app.buttons["Open settings"].exists || self.app.textFields.firstMatch.exists || self.app.buttons["QA Seed replay"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 40), .completed)
  // No seed or in-memory save is supplied after relaunch. GameProvider loads AsyncStorage.
  app.open(URL(string: "mathmews:///cold-replay-qa")!)
  XCTAssertTrue(app.buttons["QA Resume disk replay"].waitForExistence(timeout: 20))
  diskMatches()
 }
 func assertRestored(_ original: [String], task: Int, solved: Int, status: String = "active", lives: Int = 3) {
  let restored = runSnapshot()
  XCTAssertEqual(restored[0], original[0], "The run ID survives process termination")
  XCTAssertEqual(restored[1], original[1], "Relaunch cannot reset the original deadline")
  XCTAssertEqual(restored[2], "v2-easy-cat-plans-picnic-\(task)")
  XCTAssertEqual(restored[3], status); XCTAssertEqual(restored[4], "\(solved)")
  assertSecondOpen(lives: lives)
 }
 func testColdReplayBeforeAndAfterAnswers() {
  startTimed(); let original = runSnapshot()
  coldRestart(); assertRestored(original, task: 8, solved: 0)
  tap("QA Resume disk replay"); answer("10:00")
  XCTAssertTrue(app.buttons["Next puzzle"].waitForExistence(timeout: 10))
  // Terminate with the successful result sheet still open.
  coldRestart(); assertRestored(original, task: 9, solved: 1)
  tap("QA Resume disk replay"); answer("4"); tap("Next puzzle"); diskMatches()
  coldRestart(); assertRestored(original, task: 10, solved: 2)
  tap("QA Resume disk replay"); answer("3"); tap("Next level")
  XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Make a reading corner.'")).firstMatch.waitForExistence(timeout: 10))
  assertSecondOpen(); diskMatches(); shot("cold-replay-finished-level-two")
 }
 func testDeadlinePassesWhileAppIsTerminated() {
  startTimed(); answer("10:00"); tap("Next puzzle")
  tap("QA Near deadline"); diskMatches(); let original = runSnapshot()
  let deadline = Double(original[1])! / 1000
  XCTAssertGreaterThan(deadline, Date().timeIntervalSince1970)
  coldRestart(until: deadline)
  assertRestored(original, task: 8, solved: 0, status: "expired", lives: 2)
  // Repeated cold launches cannot charge another life or revoke a completed level.
  coldRestart(); assertRestored(original, task: 8, solved: 0, status: "expired", lives: 2)
  tap("QA Resume disk replay")
  XCTAssertTrue(app.buttons["Try again"].waitForExistence(timeout: 10)); assertSecondOpen(lives: 2)
  shot("cold-expired-replay-level-two-still-open")
 }
}
