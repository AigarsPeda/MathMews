import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Selection"].waitForExistence(timeout:15))
 }
 func shot(_ name:String) { let item=XCTAttachment(screenshot:app.screenshot());item.name=name;item.lifetime = .keepAlways;add(item) }
 func testBerrySelectionPlayAndResult() {
  app.buttons["Selection"].tap()
  XCTAssertTrue(app.staticTexts["Let's play."].waitForExistence(timeout:5))
  XCTAssertTrue(app.buttons["Start playing"].exists)
  XCTAssertEqual(app.tabBars.count,0)
  shot("berry-selection")
  for name in ["Medium", "Hard", "Easy"] {
   let tab = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "\(name) difficulty.")).firstMatch
   tab.tap()
   XCTAssertTrue(tab.isSelected)
   XCTAssertTrue(app.buttons["Start playing"].exists)
   shot("berry-difficulty-\(name.lowercased())")
  }
  app.buttons["Play"].tap()
  XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout:5))
  XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  shot("berry-puzzle-ready")
  app.buttons["Answer 9"].tap()
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["Lives 2 of 3. Open lives and refill."].waitForExistence(timeout:5))
  XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  shot("berry-puzzle-incorrect")
  app.buttons["Answer 10"].tap()
  XCTAssertTrue(app.buttons["Check answer"].isEnabled)
  shot("berry-puzzle-selected")
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.staticTexts["Great job!"].waitForExistence(timeout:5))
  shot("berry-result")
 }
}
