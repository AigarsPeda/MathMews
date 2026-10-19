import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false
  app.activate()
  XCTAssertTrue(app.staticTexts["Hard question review"].waitForExistence(timeout: 15))
 }
 func shot(_ name: String) {
  let item = XCTAttachment(screenshot: app.screenshot()); item.name = name; item.lifetime = .keepAlways; add(item)
 }
 func top() { app.swipeDown() }
 func testInferredFractionAndCounterexampleStayHidden() {
  app.buttons["Fractions"].tap()
  XCTAssertFalse(app.staticTexts["1"].exists)
  shot("fraction-before")
  app.buttons["Wrong feedback"].tap()
  XCTAssertFalse(app.staticTexts["1"].exists)
  app.buttons["Success feedback"].tap()
  XCTAssertTrue(app.staticTexts["1"].waitForExistence(timeout: 3))
  top(); app.buttons["Claims"].tap()
  XCTAssertFalse(app.staticTexts["20 × 1 > 20"].exists)
  shot("claim-before")
  app.buttons["Wrong feedback"].tap()
  XCTAssertFalse(app.staticTexts["20 × 1 > 20"].exists)
  app.buttons["Success feedback"].tap()
  XCTAssertTrue(app.staticTexts["20 × 1 > 20"].waitForExistence(timeout: 3))
  top(); app.buttons["Fractions"].tap(); app.buttons["Latviski"].tap(); top()
  XCTAssertFalse(app.staticTexts["1"].exists)
  shot("fraction-latvian-before")
  app.buttons["English"].tap(); top()
 }
 func testHardPromptsLeaveTheMethodToTheLearner() {
  app.buttons["Operations"].tap()
  XCTAssertTrue(app.staticTexts["Which operations make the target? Keep the numbers in order."].exists)
  XCTAssertTrue(app.staticTexts["Fill each gap, then check your answer."].exists)
  XCTAssertFalse(app.staticTexts["Fill each gap. Multiplication and division come first. Then check."].exists)
  shot("operations-before")
  app.buttons["Discount"].tap()
  XCTAssertTrue(app.staticTexts["A toy costs 200 coins and has a 50% discount. Which sale price is correct?"].exists)
  shot("discount-before")
  app.buttons["Estimate"].tap()
  XCTAssertTrue(app.staticTexts["What is the total to the nearest ten?"].exists)
  shot("estimate-before")
  app.buttons["Area"].tap()
  XCTAssertFalse(app.staticTexts["8 × 6 = ?"].exists)
  shot("area-without-equation")
 }
}
