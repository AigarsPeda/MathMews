import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false
  app.activate()
  XCTAssertTrue(app.buttons["Add"].waitForExistence(timeout: 15))
 }
 func expect(_ text: String) {
  let caption = app.staticTexts[text].firstMatch
  let scene = app.images[text].firstMatch
  XCTAssertTrue(caption.waitForExistence(timeout: 1) || scene.waitForExistence(timeout: 3), "Missing \(text)\n\(app.debugDescription)")
 }
 func shot(_ name: String) {
  let image = XCTAttachment(screenshot: app.screenshot()); image.name=name; image.lifetime = .keepAlways; add(image)
 }
 func testJoiningTakingAwayAndArrays() {
  app.buttons["Add"].tap()
  expect("Red ribbons: 4. Blue ribbons: 3. Join the two groups.")
  shot("addition-before")
  app.buttons["Join the ribbons"].tap()
  expect("The ribbons are together. Count them to find the total.")
  shot("addition-joined")
  app.buttons["Start again"].tap()
  expect("Red ribbons: 4. Blue ribbons: 3. Join the two groups.")
  app.buttons["Subtract"].tap()
  expect("Start with 9 paper stars. Take away the 3 red stars.")
  app.buttons["Take away 3"].tap()
  expect("The red stars moved away. Count how many stay.")
  shot("subtraction-taken-away")
  app.buttons["Rows"].tap()
  expect("Build 3 rows with 4 toy mice in each.")
  app.buttons["Build the rows"].tap()
  expect("3 rows, 4 toy mice in each. How many altogether?")
  shot("equal-rows-built")
  app.buttons["Use 12 rows"].tap()
  expect("Build 12 rows with 5 planting spaces in each.")
  app.buttons["Build the rows"].tap()
  expect("12 rows, 5 planting spaces in each. How many altogether?")
  shot("large-array-built")
  app.buttons["Lock scene"].tap()
  XCTAssertFalse(app.buttons["Start again"].isEnabled)
 }
 func testSharingWholeRoundsAndLeftovers() {
  app.buttons["Share"].tap()
  expect("In the pool: 23 cookies. 5 groups, 0 in each.")
  XCTAssertFalse(app.buttons["Start again"].isEnabled)
  app.buttons["Share one round"].tap()
  expect("In the pool: 18 cookies. 5 groups, 1 in each.")
  shot("sharing-one-round")
  for _ in 0..<3 { app.buttons["Share one round"].tap() }
  expect("In the pool: 3 cookies. 5 groups, 4 in each.")
  XCTAssertFalse(app.buttons["Share one round"].isEnabled)
  shot("sharing-leftovers")
  app.buttons["Start again"].tap()
  expect("In the pool: 23 cookies. 5 groups, 0 in each.")
  XCTAssertTrue(app.buttons["Share one round"].isEnabled)
 }
 func testMouseTraysAndLocalizedChoices() {
  app.buttons["English"].tap(); app.buttons["Mice"].tap()
  XCTAssertTrue(app.buttons["5 toy mice"].waitForExistence(timeout: 3))
  XCTAssertTrue(app.buttons["10 toy mice"].exists)
  shot("mice-five-and-ten")
  app.buttons["10 toy mice"].tap()
  XCTAssertTrue(app.buttons["10 toy mice"].isSelected)
  app.buttons["Lock scene"].tap()
  XCTAssertFalse(app.buttons["10 toy mice"].isEnabled)
  shot("mice-selected")
  app.buttons["Use 18 mice"].tap()
  XCTAssertTrue(app.buttons["18 toy mice"].exists)
  shot("mice-six-and-eighteen")
  app.buttons["Latviski"].tap()
  XCTAssertTrue(app.buttons["18 rotaļu peles"].waitForExistence(timeout: 3))
  shot("mice-latvian")
  app.buttons["English"].tap(); app.buttons["Trains"].tap()
  XCTAssertTrue(app.buttons["18 train carriages"].exists)
  shot("train-carriages")
 }
 func testParcelSharing() {
  app.buttons["English"].tap(); app.buttons["Share"].tap(); app.buttons["Use parcels"].tap()
  expect("In the pool: 31 parcels. 4 groups, 0 in each.")
  for _ in 0..<7 { app.buttons["Share one round"].tap() }
  expect("In the pool: 3 parcels. 4 groups, 7 in each.")
  shot("parcels-leftovers")
 }
}
