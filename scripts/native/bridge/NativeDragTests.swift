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
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func expect(_ text: String) { XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 8), "Missing \(text)\n\(app.debugDescription)") }
 func tap(_ id: String, _ times: Int = 1) {
  let button=app.buttons[id]; XCTAssertTrue(button.waitForExistence(timeout: 8), id)
  for _ in 0..<times {
   for _ in 0..<3 { if button.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
   XCTAssertTrue(button.isEnabled, id); XCTAssertTrue(button.isHittable, id); button.tap()
  }
 }
 func applyOperation(_ id: String, times: Int = 1) {
  for _ in 0..<times {
   tap(id)
   let pan = app.buttons["balance-left-pan"], scroll = app.scrollViews.firstMatch
   // XCT can report a clipped pan as hittable. Bring its center into the board's viewport.
   if !scroll.frame.insetBy(dx: 0, dy: 16).contains(CGPoint(x: pan.frame.midX, y: pan.frame.midY)) { scroll.swipeDown() }
   XCTAssertTrue(pan.isEnabled)
   pan.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.25)).tap()
   let placed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
    let operation = self.app.buttons[id]
    return !operation.exists || !operation.isSelected
   }, object: nil)
   XCTAssertEqual(XCTWaiter.wait(for: [placed], timeout: 3), .completed, "Place \(id) on the pan")
  }
 }
 func enter(_ value: Int) { for digit in String(value) { tap("bridge-digit-\(digit)") } }
 func shot(_ name: String) { app.scrollViews.firstMatch.swipeDown(); let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a) }
 func next() { tap("pilot-next");app.scrollViews.firstMatch.swipeDown();XCTAssertFalse(app.buttons["pilot-check"].isEnabled) }
 func solve() { tap("pilot-check");expect("Correct");let reset = app.buttons["bridge-reset"];XCTAssertFalse(reset.exists && reset.isEnabled) }
 func testBridge() {
  continueAfterFailure=false;app.activate()
  let springboard=XCUIApplication(bundleIdentifier:"com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout:2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  XCTAssertTrue(app.buttons["pilot-next"].waitForExistence(timeout:30));XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  shot("en-easy-ratio-start");enter(9);tap("pilot-check");expect("Try again");tap("bridge-reset");enter(4);shot("en-easy-ratio");solve();next()
  tap("bridge-step-1",2);shot("en-easy-line");solve();next()
  shot("en-easy-equation-start");applyOperation("bridge-add--1")
  XCTAssertTrue(app.staticTexts["bridge-equation-ready"].waitForExistence(timeout: 5), "The ready note follows the tiles once they settle")
  XCTAssertFalse(app.buttons["bridge-add-1"].exists)
  tap("bridge-reset")
  XCTAssertFalse(app.staticTexts["bridge-equation-ready"].exists)
  XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  applyOperation("bridge-add--1");shot("en-easy-equation");solve();next()
  let grid=app.descendants(matching:.any)["bridge-plot"].firstMatch
  XCTAssertTrue(grid.waitForExistence(timeout:8));XCTAssertEqual(grid.frame.width,grid.frame.height,accuracy:0.5)
  grid.coordinate(withNormalizedOffset:CGVector(dx:0.25,dy:0.5)).tap()
  XCTAssertEqual(app.descendants(matching: .any)["bridge-point"].firstMatch.label, "(1, 2)");tap("bridge-reset");tap("bridge-x-1");tap("bridge-y-1",2);shot("en-easy-coordinates");solve();next()
  enter(6);shot("lv-medium-ratio");solve();next()
  tap("bridge-step--1");shot("lv-medium-negatives");solve();next()
  shot("lv-medium-equation-start");applyOperation("bridge-divide-2");shot("lv-medium-equation");solve();next()
  tap("bridge-x-1");tap("bridge-y-1",2);shot("lv-medium-coordinates");solve();next()
  enter(4);shot("ru-hard-ratio");solve();next()
  tap("bridge-step-1",5);shot("ru-hard-negatives");solve();next()
  shot("ru-hard-equation-start");applyOperation("bridge-add--1", times: 3);applyOperation("bridge-divide-2");shot("ru-hard-equation");solve();next()
  tap("bridge-x--1",2);tap("bridge-y-1",3);shot("ru-hard-coordinates");solve();next()
  tap("bridge-zero");shot("lv-zero-answer");solve();next()
  enter(4);shot("ru-grid-distance");solve()
 }
}
