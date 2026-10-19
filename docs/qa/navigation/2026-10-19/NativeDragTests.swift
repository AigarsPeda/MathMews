import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func button(_ text: String) -> XCUIElement { app.buttons.matching(NSPredicate(format:"label CONTAINS %@", text)).firstMatch }
 func timed(_ name: String, _ source: XCUIElement, _ destination: XCUIElement) {
  XCTAssertTrue(source.waitForExistence(timeout: 10), "Missing source \(source)\n\(app.debugDescription)")
  let start = Date()
  source.tap()
  let deadline = Date().addingTimeInterval(10)
  while !destination.exists && Date() < deadline { usleep(20_000) }
  XCTAssertTrue(destination.exists, "Missing destination\n\(app.debugDescription)")
  XCTAssertTrue(destination.isHittable)
  print("NAV_SAMPLE \(name) \(Date().timeIntervalSince(start)*1000)")
 }
 func testNavigation() {
  continueAfterFailure = false
  app.activate()
  for i in 0..<3 {
   timed("\(i)-home-topics",button("Solve a math puzzle"),button("Addition."))
   app.swipeUp()
   timed("\(i)-topics-lessons",button("Numbers and order."),button("Small numbers in order"))
   timed("\(i)-lessons-levels",button("Small numbers in order"),button("Continue lesson"))
   timed("\(i)-levels-play",button("Continue lesson"),app.staticTexts["Put the number tiles from smallest to largest."].firstMatch)
   timed("\(i)-play-levels",button("Go back"),button("Continue lesson"))
   timed("\(i)-levels-lessons",button("Go back"),button("Small numbers in order"))
   timed("\(i)-lessons-topics",button("Go back"),button("Numbers and order."))
   timed("\(i)-topics-home",button("Go back"),button("Solve a math puzzle"))
  }
 }
 func testSwipeBackAndDifficulty() {
  continueAfterFailure = false
  app.activate()
  XCTAssertTrue(button("Solve a math puzzle").waitForExistence(timeout: 10))
  button("Solve a math puzzle").tap()
  XCTAssertTrue(button("Easy difficulty.").waitForExistence(timeout: 10))
  for difficulty in ["Medium", "Hard", "Easy"] {
   let tab = button("\(difficulty) difficulty.")
   tab.tap()
   let selected = NSPredicate(format: "selected == true")
   expectation(for: selected, evaluatedWith: tab)
   waitForExpectations(timeout: 10)
  }
  let window = app.windows.firstMatch
  window.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.4))
   .press(forDuration: 0.05, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.4)))
  XCTAssertTrue(button("Solve a math puzzle").waitForExistence(timeout: 10))
  XCTAssertTrue(button("Solve a math puzzle").isHittable)
 }
}
