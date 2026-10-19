import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Restart mission"].waitForExistence(timeout: 20))
 }
 func expect(_ text: String) {
  XCTAssertTrue(app.staticTexts[text].firstMatch.waitForExistence(timeout: 5), "Missing \(text)\n\(app.debugDescription)")
 }
 func shot(_ name: String) {
  let image = XCTAttachment(screenshot: app.screenshot()); image.name=name; image.lifetime = .keepAlways; add(image)
 }
 func testAllEighteenCatMissions() {
  for i in 1...18 {
   app.buttons["Restart mission"].tap()
   for stage in 1...2 {
    app.buttons["Complete task"].tap()
    let image = app.images["Mission scene: \(stage) of 3 tasks complete"].firstMatch
    XCTAssertTrue(image.waitForExistence(timeout: 5))
    XCTAssertTrue(app.buttons["Continue the mission"].isHittable)
    XCTAssertTrue(NSPredicate(format: "value == %@", "Ready for the next task").evaluate(with: image)
      || XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "Ready for the next task"), object: image)], timeout: 5) == .completed,
      "Cat reaction \(stage) in mission \(i) finishes once")
    XCTAssertFalse(app.buttons["Watch the ending again"].exists)
    if i == 1 { shot("cat-stage-\(stage)-reaction") }
    app.buttons["Continue the mission"].tap()
    expect("Checkpoint \(stage)")
   }
   app.buttons["Complete task"].tap()
   XCTAssertTrue(app.buttons["Finish mission"].waitForExistence(timeout: 5))
   XCTAssertTrue(app.buttons["Finish mission"].isHittable, "Continuation never waits for animation")
   XCTAssertLessThanOrEqual(app.buttons["Back to home"].frame.maxY, app.windows.firstMatch.frame.maxY - 20, "Both actions stay fully above the home indicator \(app.debugDescription)")
   XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout: 10), "Ending \(i) plays once and exposes replay")
   shot("boss-\(i)-outcome")
   app.buttons["Watch the ending again"].tap()
   // Leaving during a replay must cancel its frame callback cleanly.
   app.buttons["Finish mission"].tap()
   expect("Mission finished")
   app.buttons["Next mission"].tap()
  }
 }
 func testCheckpointsRetryResumeAndLatvian() {
  app.buttons["Restart mission"].tap()
  expect("Checkpoint 0")
  shot("boss-before-task-one")
  app.buttons["Wrong answer"].tap()
  expect("This task has not changed the scene.")
  app.buttons["Try again"].tap()
  expect("Checkpoint 0")
  app.buttons["Complete task"].tap()
  XCTAssertTrue(app.images["Mission scene: 1 of 3 tasks complete"].waitForExistence(timeout: 5))
  XCTAssertLessThanOrEqual(app.buttons["Continue the mission"].frame.maxY, app.windows.firstMatch.frame.maxY - 20, "A tall scene must not push Continue outside the sheet")
  shot("boss-task-one-cleared")
  app.buttons["Continue the mission"].tap()
  expect("Checkpoint 1")
  app.buttons["Complete task"].tap()
  XCTAssertTrue(app.images["Mission scene: 2 of 3 tasks complete"].waitForExistence(timeout: 5))
  shot("boss-task-two-cleared")
  app.buttons["Continue the mission"].tap()
  expect("Checkpoint 2")
  app.buttons["Restart mission"].tap()
  expect("Checkpoint 0")
  app.buttons["Resume at task two"].tap()
  expect("Checkpoint 1")
  let resumed = app.images["Mission scene: 1 of 3 tasks complete"].firstMatch
  XCTAssertTrue(resumed.exists)
  XCTAssertNotEqual(resumed.value as? String, "The cat is reacting to your answer", "Resuming a checkpoint does not replay its success reaction")
  app.buttons["Switch language"].tap()
  app.buttons["Preview ending"].tap()
  XCTAssertTrue(app.buttons["Noskatīties noslēgumu vēlreiz"].waitForExistence(timeout: 10))
  shot("boss-latvian-outcome")
  app.buttons["Finish mission"].doubleTap()
  expect("Mission finished")
  app.buttons["Switch language"].tap()
  app.buttons["Restart mission"].tap()
 }
}
