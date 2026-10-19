import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func button(_ text: String) -> XCUIElement { app.buttons.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch }
 func clock() -> Double { ProcessInfo.processInfo.systemUptime }
 func wait(_ destination: XCUIElement, timeout: Double = 30) {
  let deadline = clock() + timeout
  while clock() < deadline {
   if destination.exists && destination.isHittable { return }
   usleep(100_000)
  }
  XCTFail("Destination did not become interactive: \(destination)\n\(app.debugDescription)")
 }
 func record(_ kind: String, _ round: Int, _ name: String, _ start: Double) {
  print("RELEASE_SAMPLE \(kind) \(round) \(name) \((clock() - start) * 1000)")
 }
 func timed(_ kind: String, _ round: Int, _ name: String, _ source: XCUIElement, _ destination: XCUIElement) {
  wait(source)
  let start = clock()
  source.tap()
  wait(destination)
  record(kind, round, name, start)
 }
 func navigate(_ kind: String, _ round: Int) {
  timed(kind, round, "home-topics", button("Solve a math puzzle"), button("Addition."))
  app.swipeUp()
  timed(kind, round, "topics-lessons", button("Numbers and order."), button("Small numbers in order"))
  timed(kind, round, "lessons-levels", button("Small numbers in order"), button("Puzzle 1,"))
  timed(kind, round, "levels-play", button("Puzzle 1,"), app.staticTexts["Put the number tiles from smallest to largest."].firstMatch)
  timed(kind, round, "play-levels", button("Go back"), button("Puzzle 1,"))
  timed(kind, round, "levels-lessons", button("Go back"), button("Small numbers in order"))
  timed(kind, round, "lessons-topics", button("Go back"), button("Numbers and order."))
  timed(kind, round, "topics-home", button("Go back"), button("Solve a math puzzle"))
 }
 func shot(_ name: String) {
  let attachment = XCTAttachment(screenshot: app.screenshot())
  attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
 }
 func testReleasePerformance() {
  continueAfterFailure = false
  for round in 0..<3 {
   app.terminate()
   let start = clock()
   app.launch()
   wait(button("Solve a math puzzle"), timeout: 60)
   record("launch", round, round == 0 ? "first-after-install" : "process-cold", start)
   if round == 0 { shot("release-first-home") }
   navigate("first-navigation", round)
  }
  for round in 0..<3 { navigate("warm-navigation", round) }
  button("Solve a math puzzle").tap()
  wait(button("Easy difficulty."))
  for difficulty in ["Medium", "Hard", "Easy"] {
   let tab = button("\(difficulty) difficulty.")
   tab.tap()
   expectation(for: NSPredicate(format: "selected == true"), evaluatedWith: tab)
   waitForExpectations(timeout: 10)
  }
  shot("release-puzzle-topics")
  let window = app.windows.firstMatch
  window.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.4))
   .press(forDuration: 0.05, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.4)))
  wait(button("Solve a math puzzle"))
  shot("release-after-navigation")
 }
}
