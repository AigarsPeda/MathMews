import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 15)); app.buttons["Reset"].tap()
 }
 func shot(_ name: String) { let item = XCTAttachment(screenshot: app.screenshot()); item.name = name; item.lifetime = .keepAlways; add(item) }
 func hearts(_ count: Int) { XCTAssertTrue(app.buttons["Lives \(count) of 3. Open lives and refill."].waitForExistence(timeout: 8)) }
 func testTimeoutReopenRetryAndCorrectCompletion() {
  hearts(3); XCTAssertFalse(app.buttons["Check answer"].exists); shot("challenge-ready")
  app.buttons["Start challenge"].tap(); XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout: 5)); shot("challenge-running")
  app.buttons["Fast"].tap(); app.buttons["Reopen"].tap()
  XCTAssertTrue(app.staticTexts["Time’s up"].waitForExistence(timeout: 10)); hearts(2)
  XCTAssertFalse(app.buttons["Check answer"].exists); XCTAssertTrue(app.staticTexts["QA coins 42"].exists); shot("challenge-expired")
  app.buttons["Reopen"].tap(); hearts(2)
  app.buttons["Try again"].tap(); XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout: 5))
  app.swipeUp()
  for pair in [(1,6),(2,5),(3,4)] {
   let labels = ["Number \(pair.0), tile \(pair.0)", "Number \(10-pair.0), tile \(pair.1)"]
   for label in labels { XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 3)); if !app.buttons[label].isHittable { app.swipeUp() }; app.buttons[label].tap() }
   let add=app.buttons["Add this pair"]; if !add.isHittable { app.swipeUp() }; add.tap()
  }
  XCTAssertTrue(app.buttons["Check answer"].isEnabled); app.buttons["Check answer"].tap()
  XCTAssertTrue(app.staticTexts["Every pair found!"].waitForExistence(timeout: 5)); XCTAssertTrue(app.staticTexts["QA coins 46"].exists)
  shot("challenge-correct-reward")
 }
 func testLastLifeLatvianAndSingleActiveRun() {
  app.buttons["LV"].tap()
  XCTAssertTrue(app.buttons["Sākt izaicinājumu"].waitForExistence(timeout: 5))
  XCTAssertTrue(app.staticTexts["Desmita dārgumu medības"].exists); shot("challenge-latvian-ready")
  app.buttons["Reset"].tap(); app.buttons["Start challenge"].tap(); app.buttons["Other"].tap()
  XCTAssertTrue(app.buttons["Resume active challenge"].waitForExistence(timeout: 5)); XCTAssertFalse(app.buttons["Start challenge"].exists)
  app.buttons["Reset"].tap(); app.buttons["Start challenge"].tap(); app.buttons["LastLife"].tap(); app.buttons["Fast"].tap()
  XCTAssertTrue(app.staticTexts["Time’s up"].waitForExistence(timeout: 10)); hearts(0)
  XCTAssertTrue(app.buttons["Lives and refill"].exists); XCTAssertFalse(app.buttons["Try again"].exists); shot("challenge-zero-lives")
 }
 func testTenLessonsAndDistinctSpecialCardsAcrossDifficulties() {
  app.buttons["Catalog"].tap()
  for tier in ["Easy","Medium","Hard"] {
   app.buttons[tier].tap(); XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", ". 10 lessons.")).firstMatch.waitForExistence(timeout: 5)); shot("ten-lessons-\(tier)")
  }
  app.buttons["Cards"].tap()
  for tier in ["Easy","Medium","Hard"] {
   app.buttons[tier].tap(); XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Time limit")).firstMatch.waitForExistence(timeout: 5))
   shot("special-cards-\(tier)"); app.swipeUp(); shot("boss-backstory-\(tier)"); app.swipeDown()
  }
 }
}
