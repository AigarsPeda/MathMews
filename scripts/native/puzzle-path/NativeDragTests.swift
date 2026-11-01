import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["QA Path"].waitForExistence(timeout:25))
 }
 func shot(_ name:String) { let item=XCTAttachment(screenshot:app.screenshot()); item.name=name; item.lifetime = .keepAlways; add(item) }
 func testTopicPathOpensTenPuzzleLevel() {
  let gear = app.images["gearshape.fill"]
  if gear.exists {
   gear.coordinate(withNormalizedOffset: CGVector(dx:0.5, dy:0.5)).press(forDuration:0.3,
     thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx:0.04, dy:0.1)))
  }
  app.buttons["QA Topics"].tap()
  XCTAssertTrue(app.staticTexts["Choose a topic"].waitForExistence(timeout:5))
  XCTAssertFalse(app.buttons["Play Addition"].exists)
  XCTAssertTrue(app.buttons["Continue playing"].exists)
  shot("choose-topic")
  app.buttons["Addition"].tap()
  XCTAssertTrue(app.buttons["Level 5"].waitForExistence(timeout:5))
  XCTAssertTrue(app.buttons["Level 5"].isEnabled)
  XCTAssertTrue(app.buttons["Level 5"].isSelected)
  XCTAssertFalse(app.buttons["Level 6"].isEnabled)
  XCTAssertTrue(app.buttons["Level 10"].exists)
  XCTAssertFalse(app.buttons["Puzzle 7"].exists)
  XCTAssertFalse(app.buttons["Choose a level"].exists)
  XCTAssertEqual(app.tabBars.count, 0)
  shot("topic-level-path")
  app.buttons["QA Narrow"].tap()
  XCTAssertTrue(app.buttons["Level 10"].exists)
  shot("topic-path-320")
  app.buttons["QA Narrow"].tap()
  app.buttons["Level 1"].tap()
  XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout:8))
  XCTAssertFalse(app.buttons["Level 1"].exists)
  XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format:"label CONTAINS %@", "of 10")).firstMatch.exists)
  shot("level-opens-directly-in-puzzle")
 }
 func testContinuePlayingResumesSavedPuzzle() {
  app.buttons["QA Topics"].tap()
  XCTAssertTrue(app.buttons["Continue playing"].waitForExistence(timeout:5))
  XCTAssertTrue(app.staticTexts["Find the missing part"].exists)
  shot("resume-card")
  app.buttons["QA Narrow"].tap()
  shot("resume-card-320")
  app.buttons["Continue playing"].tap()
  XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout:8))
  XCTAssertFalse(app.buttons["Level 5"].exists)
  // The destination reads the app's save, while the selection fixture owns its sample progress.
  // The pure path checks verify the exact resumed puzzle; here verify direct native entry.
  XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format:"label CONTAINS %@", "of 10")).firstMatch.exists)
  shot("resume-opens-saved-puzzle")
 }
}
