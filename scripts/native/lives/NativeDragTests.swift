import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 15))
  app.buttons["Reset"].tap()
 }
 func shot(_ name: String) { let item = XCTAttachment(screenshot: app.screenshot()); item.name=name; item.lifetime = .keepAlways; add(item) }
 func hearts(_ count: Int) {
  let label="Lives \(count) of 3. Open lives and refill."
  XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 5),"Missing \(label)\n\(app.debugDescription)")
 }
 func answer(_ value: Int) {
  let choice=app.buttons["Answer \(value)"]
  if !choice.isHittable { app.swipeUp() }
  XCTAssertTrue(choice.waitForExistence(timeout: 3)); choice.tap()
 }
 func wrong(_ value: Int) { answer(value); app.buttons["Check answer"].tap() }
 func testThreeMistakesPauseCheckingAcrossReopenAndRefill() {
  hearts(3); shot("three-lives-ready")
  wrong(6); hearts(2)
  wrong(8); hearts(1)
  wrong(6); hearts(0)
  XCTAssertTrue(app.staticTexts["Out of lives"].exists)
  XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  XCTAssertTrue(app.staticTexts["QA coins 42"].exists)
  shot("three-mistakes-paused")
  app.buttons["Reopen"].tap(); hearts(0)
  XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  app.buttons["See a worked example"].tap()
  let close=app.buttons["Try my puzzle"].firstMatch
  XCTAssertTrue(close.waitForExistence(timeout:5))
  let settled=XCTNSPredicateExpectation(predicate:NSPredicate(format:"hittable == true"),object:close)
  XCTAssertEqual(XCTWaiter.wait(for:[settled],timeout:5),.completed)
  shot("help-with-no-lives"); close.tap()
  app.buttons["Lives and refill"].tap()
  let buy=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Buy a life for")).firstMatch
  XCTAssertTrue(buy.waitForExistence(timeout: 5)); buy.tap(); hearts(1)
  answer(7); XCTAssertTrue(app.buttons["Check answer"].isEnabled); app.buttons["Check answer"].tap()
  XCTAssertTrue(app.staticTexts["Great job!"].waitForExistence(timeout: 5))
  shot("full-reward-after-refill")
 }
 func testRegenerationUnlocksCheckingAndLatvianLivesAreLocalized() {
  app.buttons["Empty"].tap(); hearts(0)
  answer(7); XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  app.buttons["Regen"].tap(); hearts(1)
  XCTAssertTrue(app.buttons["Check answer"].isEnabled)
  app.buttons["LV"].tap()
  XCTAssertTrue(app.buttons["Dzīvības 1 no 3. Atvērt dzīvības un papildināšanu."].waitForExistence(timeout: 5))
  shot("latvian-lives")
  app.buttons["LV"].tap()
 }
}
