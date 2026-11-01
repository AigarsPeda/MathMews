import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["QA Path"].waitForExistence(timeout:25))
 }
 func shot(_ name:String) { let item=XCTAttachment(screenshot:app.screenshot()); item.name=name; item.lifetime = .keepAlways; add(item) }
 func assertCurrentLevelVisible(_ number: Int) {
  let level = app.buttons["Level \(number)"]
  let visible = NSPredicate { _, _ in
   let viewport = self.app.scrollViews.firstMatch.frame
   return level.exists && level.isSelected && level.isHittable && level.frame.minY >= viewport.minY && level.frame.maxY <= viewport.maxY
  }
  expectation(for: visible, evaluatedWith: nil)
  waitForExpectations(timeout: 5)
 }
 func testThemedCraftTrailsAndReplay() {
  app.buttons["QA Path"].tap()
  let topics = ["Subtraction", "Numbers and order", "Patterns", "Equal groups", "Fractions",
   "Addition", "Subtraction", "Equal groups", "Sharing and division", "Fractions", "Number routes",
   "Number routes", "Fractions", "Patterns", "Percentages", "Measure and estimate", "Reasoning", "Addition"]
  for (index, title) in topics.enumerated() {
   app.buttons["QA Theme"].tap()
   XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout:5))
   let difficulty = index < 5 || index == 17 ? "Easy" : index < 11 ? "Medium" : "Hard"
   XCTAssertTrue(app.staticTexts[difficulty].firstMatch.exists)
   for _ in 0..<8 {
    if app.buttons["Level 1"].isHittable { break }
    app.scrollViews.firstMatch.swipeDown()
   }
   shot("collection-\(index)-\(difficulty)-\(title)")
  }
  testBlenderTrailAndLocalizedCallout()
 }
 func testRevisedHardFractionsCraft() {
  app.buttons["QA Path"].tap()
  for _ in 0..<13 { app.buttons["QA Theme"].tap() }
  XCTAssertTrue(app.staticTexts["Fractions"].firstMatch.waitForExistence(timeout:5))
  XCTAssertTrue(app.staticTexts["Hard"].firstMatch.exists)
  assertCurrentLevelVisible(1)
  XCTAssertFalse(app.buttons["Level 2"].isEnabled)
  shot("collection-12-Hard-Fractions")
 }
 func testBlenderTrailAndLocalizedCallout() {
  app.buttons["QA Path"].tap()
  app.buttons["QA Level 6"].tap()
  assertCurrentLevelVisible(6)
  // The visual callout ignores touches; level semantics carry its title and state.
  XCTAssertTrue(app.buttons["Level 5"].isEnabled)
  XCTAssertFalse(app.buttons["Level 7"].isEnabled)
  shot("blender-trail-level-6")
  app.buttons["QA Narrow"].tap()
  assertCurrentLevelVisible(6)
  shot("blender-trail-320")
  app.buttons["QA LV"].tap()
  XCTAssertTrue(app.buttons["6. līmenis"].waitForExistence(timeout:5))
  XCTAssertTrue(app.buttons["6. līmenis"].isHittable)
  shot("blender-trail-320-lv")
  let finish = app.descendants(matching: .any)["topic-trail-finish"]
  for _ in 0..<10 {
   if finish.isHittable { break }
   app.scrollViews.firstMatch.swipeUp()
  }
  XCTAssertTrue(finish.isHittable)
  XCTAssertEqual(finish.label, "Finišs")
  shot("blender-trail-finish-lv")
  app.buttons["QA Topics"].tap()
  XCTAssertTrue(app.staticTexts["Izvēlies tēmu"].waitForExistence(timeout:5))
  app.buttons["Saskaitīšana"].tap()
  XCTAssertTrue(app.buttons["6. līmenis"].waitForExistence(timeout:5))
  for _ in 0..<8 {
   if app.buttons["1. līmenis"].isHittable { break }
   app.scrollViews.firstMatch.swipeDown()
  }
  shot("blender-trail-start-lv")
  app.buttons["1. līmenis"].tap()
  XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout:8))
  XCTAssertFalse(app.buttons["1. līmenis"].exists)
  shot("blender-trail-replay-puzzle")
 }
 func testCurrentLevelVisibleWhenOpeningAndReturning() {
  app.buttons["QA Path"].tap()
  assertCurrentLevelVisible(5)
  app.buttons["QA Level 10"].tap()
  assertCurrentLevelVisible(10)
  app.buttons["QA Topics"].tap()
  app.buttons["Addition"].tap()
  assertCurrentLevelVisible(10)
  app.buttons["QA Narrow"].tap()
  assertCurrentLevelVisible(10)
  shot("current-level-10-visible")
  for _ in 0..<10 {
   if app.buttons["Level 1"].isHittable { break }
   app.scrollViews.firstMatch.swipeDown()
  }
  app.buttons["Level 1"].tap()
  XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout:8))
  // Pop to the fixture's isolated save instead of the play button's /puzzles destination.
  app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)).press(forDuration: 0.1,
    thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)))
  assertCurrentLevelVisible(10)
  shot("current-level-visible-after-return")
 }
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
  for _ in 0..<6 {
   if app.buttons["Level 5"].frame.maxY < app.scrollViews.firstMatch.frame.maxY { break }
   app.scrollViews.firstMatch.swipeUp()
  }
  XCTAssertTrue(app.buttons["Level 5"].isHittable)
  XCTAssertGreaterThanOrEqual(app.buttons["Level 5"].frame.width, 92)
  XCTAssertLessThan(app.buttons["Level 5"].frame.maxY, app.scrollViews.firstMatch.frame.maxY)
  shot("topic-level-path")
  app.buttons["QA Narrow"].tap()
  XCTAssertTrue(app.buttons["Level 10"].exists)
  shot("topic-path-320")
  for _ in 0..<8 {
   if app.buttons["Level 10"].frame.maxY <= app.scrollViews.firstMatch.frame.maxY { break }
   app.scrollViews.firstMatch.swipeUp()
  }
  XCTAssertLessThanOrEqual(app.buttons["Level 10"].frame.maxY, app.scrollViews.firstMatch.frame.maxY)
  XCTAssertGreaterThanOrEqual(app.buttons["Level 10"].frame.minY, app.scrollViews.firstMatch.frame.minY)
  shot("topic-trail-end-320")
  app.buttons["QA Narrow"].tap()
  for _ in 0..<8 {
   if app.buttons["Level 1"].isHittable { break }
   app.scrollViews.firstMatch.swipeDown()
  }
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
