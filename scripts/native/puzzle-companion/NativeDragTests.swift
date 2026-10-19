import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Progress moment"].waitForExistence(timeout: 15))
 }
 func expect(_ text: String) {
  XCTAssertTrue(app.staticTexts[text].firstMatch.waitForExistence(timeout: 5), "Missing \(text)\n\(app.debugDescription)")
 }
 func shot(_ name: String) {
  let image = XCTAttachment(screenshot: app.screenshot()); image.name=name; image.lifetime = .keepAlways; add(image)
 }
 func testCharacterMessagesAndSingleContinuation() {
  app.buttons["Progress moment"].tap()
  expect("Minka says: You've solved 5 puzzles! I'm glad we're learning together.")
  XCTAssertTrue(app.buttons["Go to next puzzle"].isHittable)
  let body = app.scrollViews.containing(.staticText, identifier: "Minka says: You've solved 5 puzzles! I'm glad we're learning together.").firstMatch
  XCTAssertGreaterThanOrEqual(body.frame.width, app.windows.firstMatch.frame.width - 20, "The result fills the sheet without a horizontal inset frame")
  XCTAssertLessThan(app.windows.firstMatch.frame.maxY - app.buttons["Back to home"].frame.maxY, 72, "Actions sit above the home indicator without the extra bottom gap")
  shot("cat-progress")
  app.buttons["Go to next puzzle"].doubleTap()
  expect("Continued 1")
  // Native onDismiss must not run Continue again or replace a Home choice.
  app.buttons["Retry moment"].tap()
  expect("Minka says: There's no rush. Let's look at the clues and try one small step.")
  XCTAssertTrue(app.buttons["Try again"].isHittable)
  shot("cat-retry")
  app.buttons["Try again"].tap()
  expect("Continued 2")
  app.buttons["Boss moment"].tap()
  expect("Minka says: Boss cleared! High paw for sticking with it.")
  shot("cat-boss")
  app.buttons["Back to home"].tap()
  expect("Home 1"); expect("Continued 2")
  app.buttons["Boss stage moment"].tap()
  expect("Minka says: Another part of the boss cleared! Let's take the next step together.")
  shot("cat-boss-stage")
  app.buttons["Continue the mission"].tap()
  expect("Continued 3")
  app.buttons["Latvian moment"].tap()
  expect("Minka saka: Boss pieveikts! Dod ķepu par neatlaidību!")
  shot("cat-latvian")
  app.buttons.matching(NSPredicate(format: "label == %@", "Uz nākamo uzdevumu")).firstMatch.tap()
  expect("Continued 4")
  app.buttons["Long hint moment"].tap()
  expect("Minka says: There's no rush. Let's look at the clues and try one small step.")
  XCTAssertTrue(app.buttons["Try again"].isHittable, "Continue stays reachable before scrolling the long hint")
  app.scrollViews.containing(.staticText, identifier: "Minka says: There's no rush. Let's look at the clues and try one small step.").firstMatch.swipeUp()
  XCTAssertTrue(app.buttons["Try again"].isHittable, "Continue stays reachable after scrolling the long hint")
  shot("cat-long-hint")
  app.buttons["Try again"].tap()
  expect("Continued 5")
 }
 func testNextPuzzleCanPresentItsOwnResult() {
  // Exercise a preloaded native route replacement, including the closing sheet.
  // Repeating the flow catches a sheet that still owns the native presentation.
  for number in 2...4 {
   app.buttons["Next puzzle flow"].tap()
   XCTAssertTrue(app.buttons["Go to next puzzle"].waitForExistence(timeout: 5))
   app.buttons["Go to next puzzle"].doubleTap()
   expect("Puzzle \(number)")
   XCTAssertTrue(app.buttons["Next puzzle flow"].isHittable, "The dismissed result no longer blocks the next puzzle")
   XCTAssertFalse(app.buttons["Go to next puzzle"].exists, "The old result is gone before the next puzzle opens")
  }
  shot("next-puzzle-after-dismissal")
 }
}
