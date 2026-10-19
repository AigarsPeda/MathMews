import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func expect(_ text: String) { XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 5), "Missing \(text)\n\(app.debugDescription)") }
 func tapTick(_ value: Int) {
  let track = app.descendants(matching: .any)["number-line-track"].firstMatch
  let number = app.buttons["Number \(value)"]
  if number.isEnabled { XCTAssertTrue(number.isHittable) }
  // Tap the drawn tick, above the number label's original touch area.
  track.coordinate(withNormalizedOffset: CGVector(dx: (number.frame.midX-track.frame.minX)/track.frame.width, dy: 74.0/152.0)).tap()
 }
 func testTicksLabelsButtonsScrollingAndLocking() {
  app.activate(); expect("Number line touch check"); expect("Selected 8")
  tapTick(5); expect("Selected 5"); expect("Changes 1")
  XCTAssertTrue(app.buttons["Number 5"].isSelected)
  tapTick(2); expect("Selected 2")
  tapTick(8); expect("Selected 8")
  app.buttons["Number 6"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.67)).tap()
  expect("Selected 6")
  app.buttons["Move one number to the left"].tap(); expect("Selected 5")
  app.buttons["Move one number to the right"].tap(); expect("Selected 6")
  app.buttons["Lock answer"].tap()
  XCTAssertFalse(app.buttons["Number 3"].isEnabled)
  tapTick(3); expect("Selected 6"); expect("Changes 6")
  app.buttons["Wide range"].tap(); expect("Selected 12")
  tapTick(13); expect("Selected 13")
  let track = app.descendants(matching: .any)["number-line-track"].firstMatch
  for _ in 0..<3 { track.swipeRight() }
  expect("Selected 13")
  tapTick(-2); expect("Selected -2"); expect("Changes 2")
  XCTAssertFalse(app.buttons["Move one number to the left"].isEnabled)
  let shot = XCTAttachment(screenshot: app.screenshot()); shot.name="number-line-direct-selection"; shot.lifetime = .keepAlways; add(shot)
 }
}
