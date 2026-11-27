import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false
  app.activate()
  XCTAssertTrue(app.staticTexts["Practice variety review"].waitForExistence(timeout: 15))
 }
 func shot(_ name: String) {
  let item = XCTAttachment(screenshot: app.screenshot()); item.name = name; item.lifetime = .keepAlways; add(item)
 }
 func solve(_ answer: String) {
  let socket = app.buttons["machine-rule-socket"], gap = app.buttons["pattern-next-gap"]
  if socket.exists {
   app.buttons["machine-rule-" + answer].tap()
   socket.tap()
  } else if gap.exists {
   app.buttons[answer].tap()
   gap.tap()
  } else {
   let choice = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Answer \(answer)", "Atbilde \(answer)")).firstMatch
   XCTAssertTrue(choice.waitForExistence(timeout: 3), app.debugDescription)
   choice.tap()
  }
  app.buttons["Check"].tap()
  XCTAssertTrue(app.staticTexts["Correct answer"].waitForExistence(timeout: 3))
 }
 func next() { app.buttons["Next activity"].tap() }
 func testPatternMissionsChangeRulesAndInteraction() {
  app.buttons["Music boss"].tap()
  solve("15"); next(); solve("+5"); next()
  XCTAssertTrue(app.staticTexts["Finish the tune. Which beat is missing?"].exists)
  shot("music-boss-missing-beat"); solve("16")
  app.buttons["Signal boss"].tap()
  solve("48"); next(); solve("+32"); next()
  XCTAssertTrue(app.staticTexts["Complete the transmission code. Which value is missing?"].exists)
  shot("signal-boss-missing-code"); solve("20")
 }
 func testPatternsChangeRulesAndInteractionWithinTheLesson() {
  app.buttons["Hard"].tap()
  XCTAssertTrue(app.staticTexts["What comes next?"].exists)
  XCTAssertFalse(app.staticTexts["Every step uses ×3. What comes next?"].exists)
  solve("162"); next()
  shot("hard-division-machine"); solve("÷4"); next()
  XCTAssertTrue(app.staticTexts["Which number belongs in the gap?"].exists)
  shot("hard-missing-number"); solve("27"); next()
  shot("hard-final-pattern"); solve("37")
  app.buttons["Easy"].tap()
  solve("5"); next(); solve("+2"); next()
  XCTAssertTrue(app.staticTexts["Which number belongs in the gap?"].exists)
  shot("easy-missing-number"); solve("5"); next(); solve("5")
  app.buttons["More Hard"].tap(); app.buttons["Latviski"].tap()
  XCTAssertTrue(app.staticTexts["Kas būs tālāk?"].exists)
  solve("768"); next(); solve("+8"); next()
  XCTAssertTrue(app.staticTexts["Kurš skaitlis iederas tukšajā vietā?"].exists)
  shot("latvian-missing-number"); solve("24"); next(); solve("47")
  app.buttons["English"].tap()
 }
}
