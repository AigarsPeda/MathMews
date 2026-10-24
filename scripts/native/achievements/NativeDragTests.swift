import XCTest
final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  let developerIntro = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'This is the developer menu'")).firstMatch
  if developerIntro.waitForExistence(timeout: 3), app.buttons["Continue"].exists { app.buttons["Continue"].tap() }
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
   (settings.exists && settings.isHittable) || (onboarding.exists && onboarding.isHittable)
  }, object: nil)
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
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 20)); app.buttons["Reset"].tap()
 }
 func tab(_ label: String) -> XCUIElement {
  app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
 }
 func shot(_ name: String) { let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a) }
 func testOrderedGrayAndColoredCollection() {
  XCTAssertTrue(app.buttons[first].waitForExistence(timeout: 8))
  XCTAssertTrue(app.buttons[first].isEnabled); XCTAssertTrue(app.buttons[second].isEnabled)
  XCTAssertTrue(tab("Collected").exists); XCTAssertTrue(tab("All rewards").exists)
  XCTAssertGreaterThan(app.buttons[first].frame.width, 280)
  XCTAssertLessThan(app.buttons[first].frame.minY, app.buttons[second].frame.minY)
  shot("achievement-sequence")
  app.buttons[first].tap(); XCTAssertTrue(app.buttons["Share GIF"].waitForExistence(timeout: 6))
  XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout: 6)); app.buttons["Watch the ending again"].tap()
  app.buttons["Pause"].tap(); XCTAssertTrue(app.buttons["Play"].exists)
  app.buttons["Play"].tap(); XCTAssertTrue(app.buttons["Pause"].exists)
  shot("achievement-preview")
  Thread.sleep(forTimeInterval: 4.5)
  shot("achievement-punchline")
  XCTAssertLessThan(app.buttons["Share GIF"].frame.maxY, app.windows.firstMatch.frame.maxY - 20)
  app.buttons["Close"].tap(); XCTAssertTrue(app.buttons["Reopen"].waitForExistence(timeout: 5)); app.buttons["Reopen"].tap()
  XCTAssertTrue(app.buttons[first].waitForExistence(timeout: 5)); XCTAssertTrue(app.buttons[first].isEnabled)
  XCTAssertTrue(app.buttons[second].isEnabled)
  app.buttons["LV narrow"].tap(); XCTAssertTrue(app.staticTexts["Sasniegumi"].waitForExistence(timeout: 5))
  shot("achievement-narrow-latvian")
  app.buttons[first].tap(); XCTAssertTrue(app.buttons["Kopīgot GIF"].waitForExistence(timeout: 5))
  XCTAssertTrue(app.buttons["Aizvērt"].isHittable); shot("achievement-preview-latvian")
  app.buttons["Aizvērt"].tap(); app.buttons["Empty"].tap()
  XCTAssertTrue(app.buttons[first].waitForExistence(timeout: 5)); XCTAssertTrue(app.buttons[first].isEnabled)
  XCTAssertTrue(app.buttons[third].isEnabled); shot("achievement-all-locked")
  app.buttons[first].tap()
  XCTAssertTrue(app.buttons["Atvērt nodarbību"].waitForExistence(timeout: 5))
  XCTAssertFalse(app.buttons["Kopīgot GIF"].exists)
  shot("achievement-unlock-instructions")
  app.buttons["Aizvērt"].tap()
  tab("Iegūtie").tap()
  XCTAssertTrue(app.staticTexts["Tava pirmā filmiņa tevi gaida"].waitForExistence(timeout: 5))
 }
 func testFishAndScarfContactEndings() {
  app.buttons["Contact review"].tap()
  for (id, name) in [(second, "achievement-fish-contact"), (third, "achievement-scarf-contact")] {
   for _ in 0..<5 {
    if app.buttons[id].isHittable { break }
    app.swipeUp()
   }
   XCTAssertTrue(app.buttons[id].isHittable); app.buttons[id].tap()
   XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout: 6))
   app.buttons["Watch the ending again"].tap()
   Thread.sleep(forTimeInterval: 4.6)
   let movie = app.images["achievement-movie"]
   XCTAssertTrue(movie.exists)
   let heldFrame = movie.screenshot().pngRepresentation
   app.buttons["Pause"].tap()
   XCTAssertEqual(heldFrame, movie.screenshot().pngRepresentation, "Pause must preserve the displayed frame")
   shot(name)
   XCTAssertTrue(app.buttons["Share GIF"].isHittable)
   app.buttons["Close"].tap()
  }
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
  XCTAssertTrue(app.buttons[first].isEnabled); XCTAssertTrue(app.buttons[second].isEnabled)
 }
}
