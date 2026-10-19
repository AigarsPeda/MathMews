import XCTest

final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false
  app.activate()
  XCTAssertTrue(app.buttons["Sorting"].waitForExistence(timeout: 15))
 }
 func expect(_ label: String, file: StaticString = #filePath, line: UInt = #line) {
  XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 3), "Missing \(label)\n\(app.debugDescription)", file: file, line: line)
 }
 func drag(_ label: String, to target: XCUIElement) {
  expect(label)
  app.buttons[label].press(forDuration: 0.2, thenDragTo: target)
 }
 func shot(_ name: String) {
  let attachment = XCTAttachment(screenshot: app.screenshot())
  attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
 }
 func testBasketTransfersAndReturn() {
  app.buttons["Sorting"].tap(); app.buttons["Reset board"].tap()
  let left = app.staticTexts["Below 10"].firstMatch
  let right = app.staticTexts["10 or more"].firstMatch
  drag("12, not placed", to: left); expect("12, Below 10")
  drag("12, Below 10", to: right); expect("12, 10 or more")
  shot("basket-to-basket")
  drag("12, 10 or more", to: app.buttons["6, not placed"]); expect("12, not placed")
  // An outside release keeps the existing assignment and unlocks scrolling.
  drag("12, not placed", to: app.staticTexts["Native drag check"].firstMatch); expect("12, not placed")
  for number in [3, 8, 6] { drag("\(number), not placed", to: left); expect("\(number), Below 10") }
  for number in [12, 10, 19] { drag("\(number), not placed", to: right); expect("\(number), 10 or more") }
  XCTAssertTrue(app.buttons["Check my baskets"].isEnabled)
  app.buttons["Check my baskets"].tap()
  XCTAssertTrue(app.staticTexts["Correct"].firstMatch.waitForExistence(timeout: 3))
  XCTAssertFalse(app.buttons["Check my baskets"].isEnabled)
  shot("sorting-correct")
  app.swipeUp()
  app.buttons["Retry"].tap()
  // Moving a placed tile after scrolling checks fresh board coordinates.
  drag("19, 10 or more", to: app.staticTexts["Drag a tile back here to take it out of a basket."].firstMatch)
  expect("19, not placed")
  shot("sorting-after-scroll")
  app.swipeDown()
 }
 func testPatternSwapsReplacementAndReturn() {
  app.buttons["Pattern"].tap(); app.buttons["Reset board"].tap()
  drag("Number 10", to: app.staticTexts["?"].firstMatch); expect("Position 2, 10")
  drag("Number 20", to: app.staticTexts["?"].firstMatch); expect("Position 4, 20")
  drag("Position 2, 10", to: app.buttons["Position 4, 20"])
  expect("Position 2, 20"); expect("Position 4, 10")
  shot("pattern-gaps-swapped")
  drag("Position 4, 10", to: app.buttons["Position 2, 20"])
  expect("Position 2, 10"); expect("Position 4, 20")
  drag("Number 12", to: app.buttons["Position 2, 10"])
  expect("Position 2, 12"); expect("Number 10")
  drag("Position 2, 12", to: app.buttons["Number 30"])
  expect("Number 12"); expect("Position 4, 20")
  XCTAssertFalse(app.buttons["Check the whole pattern"].isEnabled)
  drag("Number 10", to: app.staticTexts["?"].firstMatch); expect("Position 2, 10")
  drag("Position 4, 20", to: app.staticTexts["Native drag check"].firstMatch); expect("Position 4, 20")
  app.buttons["Check the whole pattern"].tap()
  XCTAssertTrue(app.staticTexts["Correct"].firstMatch.waitForExistence(timeout: 3))
  XCTAssertFalse(app.buttons["Check the whole pattern"].isEnabled)
  shot("pattern-correct")
 }
}
