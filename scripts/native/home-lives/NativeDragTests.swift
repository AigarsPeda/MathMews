import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 15)); app.buttons["Reset"].tap()
 }
 func shot(_ name: String) { let item = XCTAttachment(screenshot: app.screenshot()); item.name = name; item.lifetime = .keepAlways; add(item) }
 func heart(_ count: Int) -> XCUIElement {
  app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Lives \(count) of 3.")).firstMatch
 }
 func testHomeCountdownAndRefill() {
  XCTAssertTrue(heart(3).waitForExistence(timeout: 5))
  let coins = app.buttons["You have 42 coins. Tap to get more coins."]
  let streak = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Streak: 1 day")).firstMatch
  XCTAssertTrue(streak.exists)
  XCTAssertEqual(coins.frame.width, streak.frame.width, accuracy: 1)
  XCTAssertEqual(coins.frame.width, heart(3).frame.width, accuracy: 1)
  XCTAssertLessThan(app.buttons["Settings"].frame.width, 36)
  XCTAssertFalse(heart(3).label.contains("Next life")); shot("home-lives-full")
  app.buttons["Lose"].tap(); XCTAssertTrue(heart(2).waitForExistence(timeout: 5))
  let initial = heart(2).label
  XCTAssertTrue(initial.contains("Next life in 29:"))
  let ticking = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.heart(2).label != initial }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ticking], timeout: 3), .completed)
  app.buttons["Reopen"].tap(); XCTAssertTrue(heart(2).waitForExistence(timeout: 5))
  XCTAssertTrue(heart(2).label.contains("Next life in 29:")); shot("home-lives-countdown")
  heart(2).tap()
  let buy = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Buy a life for")).firstMatch
  XCTAssertTrue(buy.waitForExistence(timeout: 5)); buy.tap()
  XCTAssertTrue(heart(3).waitForExistence(timeout: 5)); XCTAssertFalse(heart(3).label.contains("Next life"))
 }
 func testRegenerationAndNarrowLatvianHeader() {
  app.buttons["Empty"].tap(); XCTAssertTrue(heart(0).waitForExistence(timeout: 5)); shot("home-lives-empty")
  app.buttons["Quick"].tap(); XCTAssertTrue(heart(1).waitForExistence(timeout: 6))
  XCTAssertTrue(heart(1).label.contains("Next life"))
  app.buttons["FullSoon"].tap(); XCTAssertTrue(heart(3).waitForExistence(timeout: 6))
  XCTAssertFalse(heart(3).label.contains("Next life"))
  app.buttons["Lose"].tap(); app.buttons["Narrow"].tap(); app.buttons["LV"].tap()
  let lives = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Dzīvības 2 no 3.")).firstMatch
  XCTAssertTrue(lives.waitForExistence(timeout: 5)); XCTAssertTrue(lives.label.contains("Nākamā dzīvība pēc"))
  XCTAssertTrue(lives.isHittable); XCTAssertTrue(app.buttons["Settings"].isHittable)
  let coins = app.buttons["Tev ir 1234567 monētas. Pieskaries, lai iegūtu vairāk."]
  XCTAssertTrue(coins.isHittable); XCTAssertLessThan(coins.frame.maxX, lives.frame.minX)
  XCTAssertLessThanOrEqual(lives.frame.maxX, app.buttons["Settings"].frame.minX + 1)
  shot("home-lives-narrow-latvian")
 }
}
