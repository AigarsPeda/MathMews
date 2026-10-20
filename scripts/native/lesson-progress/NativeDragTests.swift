import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout:15)); app.buttons["Reset"].tap()
 }
 func shot(_ name:String) { let item=XCTAttachment(screenshot:app.screenshot());item.name=name;item.lifetime = .keepAlways;add(item) }
 func lesson(_ number:Int, lv:Bool=false) -> XCUIElement {
  app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "\(lv ? "Nodarbība" : "Lesson") \(number)." )).firstMatch
 }
 func testMixedProgressAndReopen() {
  XCTAssertTrue(lesson(1).waitForExistence(timeout:5)); XCTAssertTrue(lesson(1).label.contains("All done"))
  XCTAssertTrue(lesson(2).label.contains("In progress")); XCTAssertTrue(lesson(2).label.contains("Practice: 2 of 4"))
  XCTAssertTrue(lesson(3).label.contains("Boss left")); XCTAssertTrue(lesson(3).label.contains("Challenge: 1 of 1, Done"))
  shot("lesson-progress-mixed")
  for _ in 0..<4 { if lesson(5).isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  XCTAssertTrue(lesson(4).label.contains("Boss: 1 of 3")); XCTAssertTrue(lesson(5).label.contains("Challenge left"))
  XCTAssertTrue(lesson(5).label.contains("The challenge is optional")); shot("lesson-progress-specials-left")
  app.buttons["Reopen"].tap(); XCTAssertTrue(lesson(1).waitForExistence(timeout:5)); XCTAssertTrue(lesson(1).label.contains("All done"))
 }
 func testFreshAndWrongFirstAnswer() {
  app.buttons["Fresh"].tap(); XCTAssertTrue(lesson(1).waitForExistence(timeout:5)); XCTAssertTrue(lesson(1).label.contains("Not started"))
  XCTAssertTrue(lesson(1).isEnabled); XCTAssertFalse(lesson(2).isEnabled); shot("lesson-progress-not-started-locked")
  app.buttons["Wrong"].tap(); XCTAssertTrue(lesson(1).waitForExistence(timeout:5)); XCTAssertTrue(lesson(1).label.contains("In progress"))
  XCTAssertTrue(lesson(1).label.contains("Practice: 0 of 4, In progress"))
  app.buttons["Reopen"].tap(); XCTAssertTrue(lesson(1).label.contains("In progress")); shot("lesson-progress-started-zero")
 }
 func testNarrowLatvianAndAllDifficulties() {
  for tier in ["medium","hard"] {
   app.buttons[tier].tap(); XCTAssertTrue(lesson(1).waitForExistence(timeout:5)); XCTAssertTrue(lesson(1).label.contains("All done"))
   XCTAssertTrue(lesson(3).label.contains("Boss left")); shot("lesson-progress-\(tier)")
  }
  app.buttons["Narrow"].tap(); app.buttons["LV"].tap()
  let first=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","Viss pabeigts")).firstMatch
  XCTAssertTrue(first.waitForExistence(timeout:5)); XCTAssertTrue(first.isHittable); shot("lesson-progress-narrow-latvian")
 }
}
