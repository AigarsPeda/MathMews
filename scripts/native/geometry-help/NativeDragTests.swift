import XCTest
final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  let developerIntro = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'This is the developer menu'")).firstMatch
  if developerIntro.waitForExistence(timeout: 15), app.buttons["Continue"].exists { app.buttons["Continue"].tap() }
  let reload = app.buttons["Reload"]
  if reload.exists {
   let window = app.windows.firstMatch.frame
   let close = app.buttons.allElementsBoundByIndex.first { $0.isHittable && $0.frame.midX > window.width * 0.8 && $0.frame.maxY <= reload.frame.minY && $0.frame.minY > window.height * 0.25 }
   XCTAssertNotNil(close); close?.tap()
  }
  let settings = app.buttons.matching(NSPredicate(format: "label == 'Open settings' OR label == 'Atvērt iestatījumus'")).firstMatch
  // The isolated reward fixture supplies onboarding and progress itself.
  // A fresh simulator may stop at onboarding; never create a cloud save for QA.
  let onboarding = app.textFields.firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable) || app.buttons["pilot-next"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 let app=XCUIApplication(bundleIdentifier:"com.mathmews.app")
 func shot(_ name:String) {
  Thread.sleep(forTimeInterval:1.0)
  let attachment=XCTAttachment(screenshot:app.screenshot());attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
 }
 func testGeometryHelp() {
  continueAfterFailure=false;app.activate()
  let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout:2) {springboard.buttons["Open"].tap()}
  if app.buttons["Open"].exists {app.buttons["Open"].tap()}
  XCTAssertTrue(app.buttons["pilot-next"].waitForExistence(timeout:30))
  let nextLabels=["Next step","Nākamais solis","Следующий шаг"]
  let replayLabels=["Start again","Sākt vēlreiz","Начать заново"]
  let names=["en-comparison","lv-area","ru-perimeter"]
  for scenario in 0..<3 {
   let next=app.buttons[nextLabels[scenario]], replay=app.buttons[replayLabels[scenario]]
   XCTAssertTrue(next.waitForExistence(timeout:8));XCTAssertFalse(replay.isEnabled)
   for step in 0..<3 {
    XCTAssertTrue(app.staticTexts["Frame \(step)"].waitForExistence(timeout:8))
    shot("\(names[scenario])-\(step)")
    if step<2 {next.tap()}
   }
   XCTAssertFalse(next.isEnabled);replay.tap();XCTAssertTrue(app.staticTexts["Frame 0"].waitForExistence(timeout:8));XCTAssertFalse(replay.isEnabled)
   if scenario<2 {app.buttons["pilot-next"].tap()}
  }
 }
}
