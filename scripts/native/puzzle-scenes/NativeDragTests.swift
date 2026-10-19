import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false
  app.activate()
  XCTAssertTrue(app.buttons["Add"].waitForExistence(timeout: 15))
 }
 func expect(_ text: String) { XCTAssertTrue(app.staticTexts[text].firstMatch.waitForExistence(timeout: 3), "Missing \(text)\n\(app.debugDescription)") }
 func shot(_ name: String) {
  let image = XCTAttachment(screenshot: app.screenshot()); image.name=name; image.lifetime = .keepAlways; add(image)
 }
 func testJoiningTakingAwayAndArrays() {
  app.buttons["Add"].tap()
  expect("Two groups: 4 counters and 3 counters. Join them and count.")
  shot("addition-before")
  app.buttons["Join the counters"].tap()
  expect("The two groups are together. Count the counters to find the total.")
  shot("addition-joined")
  app.buttons["Start again"].tap()
  expect("Two groups: 4 counters and 3 counters. Join them and count.")
  app.buttons["Subtract"].tap()
  expect("Start with 9 counters. The red counters are the 3 to take away.")
  app.buttons["Take away 3"].tap()
  expect("The red counters moved away. Count how many stay.")
  shot("subtraction-taken-away")
  app.buttons["Rows"].tap()
  expect("Build 3 rows with 4 counters in each.")
  app.buttons["Build the rows"].tap()
  expect("The counters are in 3 rows, with 4 in each. How many altogether?")
  shot("equal-rows-built")
  app.buttons["Use 12 rows"].tap()
  expect("Build 12 rows with 5 counters in each.")
  app.buttons["Build the rows"].tap()
  expect("The counters are in 12 rows, with 5 in each. How many altogether?")
  shot("large-array-built")
  app.buttons["Lock scene"].tap()
  XCTAssertFalse(app.buttons["Start again"].isEnabled)
 }
 func testSharingWholeRoundsAndLeftovers() {
  app.buttons["Share"].tap()
  expect("Counters in the pool: 23. 5 groups, 0 in each.")
  XCTAssertFalse(app.buttons["Start again"].isEnabled)
  app.buttons["Share one round"].tap()
  expect("Counters in the pool: 18. 5 groups, 1 in each.")
  shot("sharing-one-round")
  for _ in 0..<3 { app.buttons["Share one round"].tap() }
  expect("Counters in the pool: 3. 5 groups, 4 in each.")
  XCTAssertFalse(app.buttons["Share one round"].isEnabled)
  shot("sharing-leftovers")
  app.buttons["Start again"].tap()
  expect("Counters in the pool: 23. 5 groups, 0 in each.")
  XCTAssertTrue(app.buttons["Share one round"].isEnabled)
 }
}
