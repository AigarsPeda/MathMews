import XCTest
final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let settings = app.buttons.matching(NSPredicate(format: "label == 'Open settings' OR label == 'Atvērt iestatījumus'")).firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in settings.exists && settings.isHittable }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 let first = "achievement-easy-addition-join-lesson-1-boss"
 let second = "achievement-easy-addition-ten-lesson-2-boss"
 let third = "achievement-easy-addition-explore-3-lesson-3-boss"
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 20)); app.buttons["Reset"].tap()
 }
 func shot(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }
 func testOrderedGrayAndColoredCollection() {
  XCTAssertTrue(app.buttons[first].waitForExistence(timeout: 8))
  XCTAssertTrue(app.buttons[first].isEnabled); XCTAssertFalse(app.buttons[second].isEnabled)
  XCTAssertFalse(app.buttons["Collected"].exists); XCTAssertFalse(app.buttons["All bosses"].exists)
  XCTAssertLessThan(app.buttons[first].frame.minX, app.buttons[second].frame.minX)
  XCTAssertLessThan(app.buttons[first].frame.minY, app.buttons[third].frame.minY)
  shot("achievement-sequence")
  app.buttons[first].tap(); XCTAssertTrue(app.buttons["Share GIF"].waitForExistence(timeout: 6))
  XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout: 6)); app.buttons["Watch the ending again"].tap()
  shot("achievement-preview")
  XCTAssertLessThan(app.buttons["Share GIF"].frame.maxY, app.windows.firstMatch.frame.maxY - 20)
  app.buttons["Close"].tap(); XCTAssertTrue(app.buttons["Reopen"].waitForExistence(timeout: 5)); app.buttons["Reopen"].tap()
  XCTAssertTrue(app.buttons[first].waitForExistence(timeout: 5)); XCTAssertTrue(app.buttons[first].isEnabled)
  XCTAssertFalse(app.buttons[second].isEnabled)
  app.buttons["LV narrow"].tap(); XCTAssertTrue(app.staticTexts["Sasniegumi"].waitForExistence(timeout: 5))
  shot("achievement-narrow-latvian")
  app.buttons[first].tap(); XCTAssertTrue(app.buttons["Kopīgot GIF"].waitForExistence(timeout: 5))
  XCTAssertTrue(app.buttons["Aizvērt"].isHittable); shot("achievement-preview-latvian")
  app.buttons["Aizvērt"].tap(); app.buttons["Empty"].tap()
  XCTAssertTrue(app.buttons[first].waitForExistence(timeout: 5)); XCTAssertFalse(app.buttons[first].isEnabled)
  XCTAssertFalse(app.buttons[third].isEnabled); shot("achievement-all-locked")
 }
 func testNativeGifShareAndCancel() {
  app.buttons[first].tap(); XCTAssertTrue(app.buttons["Share GIF"].waitForExistence(timeout: 6))
  app.buttons["Share GIF"].tap()
  let gifDetails = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'GIF Image'")).firstMatch
  let nativeSheet = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in gifDetails.exists }, object: nil)
  let shareResult = XCTWaiter.wait(for: [nativeSheet], timeout: 15)
  shot("achievement-native-gif-share")
  XCTAssertEqual(shareResult, .completed)
  let dismissRegions = app.otherElements.matching(identifier: "PopoverDismissRegion").allElementsBoundByIndex
  let window = app.windows.firstMatch.frame
  let dismiss = dismissRegions.first { $0.frame.minY >= 0 && $0.frame.minX >= 0 && $0.frame.width <= window.width + 1 }
  XCTAssertNotNil(dismiss)
  dismiss!.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).tap()
  XCTAssertTrue(app.buttons["Share GIF"].waitForExistence(timeout: 5)); XCTAssertTrue(app.buttons["Share GIF"].isEnabled)
  app.buttons["Close"].tap()
  XCTAssertTrue(app.staticTexts["777/1/7"].waitForExistence(timeout: 5))
  XCTAssertTrue(app.buttons[first].isEnabled); XCTAssertFalse(app.buttons[second].isEnabled)
 }
}
