import XCTest

final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  let intro = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'This is the developer menu'")).firstMatch
  if intro.waitForExistence(timeout: 15), app.buttons["Continue"].exists { app.buttons["Continue"].tap() }
  let reload = app.buttons["Reload"]
  if reload.exists {
   let window = app.windows.firstMatch.frame
   let close = app.buttons.allElementsBoundByIndex.first { $0.isHittable && $0.frame.midX > window.width * 0.8 && $0.frame.maxY <= reload.frame.minY && $0.frame.minY > window.height * 0.25 }
   XCTAssertNotNil(close); close?.tap()
  }
  let settings = app.buttons.matching(NSPredicate(format: "label == 'Open settings' OR label == 'Atvērt iestatījumus'")).firstMatch
  let onboarding = app.textFields.firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   settings.exists || (onboarding.exists && onboarding.isHittable) || app.buttons["Check answer"].exists || app.buttons["fractions-preview-next"].exists || app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Play level'")).firstMatch.exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}

final class NativeDragTests: XCTestCase {
 func testFractionsIntro() throws {
  continueAfterFailure = false
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let names = ["01-color-half", "02-match", "03-compare", "04-true-false", "05-color-whole", "06-count-halves", "07-match-whole", "08-sort", "09-judge-equivalence", "10-cookie-story"]
  for index in 0..<10 {
   let meta = app.staticTexts["fractions-preview-index"]
   let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in meta.exists && meta.label == String(index) && app.buttons["Check answer"].exists }, object: nil)
   XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed)
   let choice: String? = index == 0 ? "Add one piece" : index == 2 ? "2/2" : nil
   if let choice {
    let button = app.buttons[choice]
    XCTAssertTrue(button.waitForExistence(timeout: 8), choice)
    button.tap()
   }
   let attachment = XCTAttachment(screenshot: app.screenshot())
   attachment.name = "fractions-level-1-" + names[index]; attachment.lifetime = .keepAlways; add(attachment)
   if index < 9 { app.buttons["fractions-preview-next"].tap() }
  }
 }
}
