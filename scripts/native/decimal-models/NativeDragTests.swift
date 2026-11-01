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
 func gridCell(_ count: Int, _ scale: Int) {
  let grid=app.descendants(matching: .any)["decimal-grid"].firstMatch
  XCTAssertTrue(grid.waitForExistence(timeout: 8)); XCTAssertTrue(grid.isHittable)
  XCTAssertEqual(grid.frame.width, grid.frame.height, accuracy: 1, "The grid must be a square whole")
  grid.coordinate(withNormalizedOffset: CGVector(dx: (Double((count-1)%10)+0.5)/10, dy: scale == 10 ? 0.5 : (Double((count-1)/10)+0.5)/10)).tap()
 }
 func shot(_ name: String) { let a=XCTAttachment(screenshot: app.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a) }
 func next() { tap("pilot-next"); app.scrollViews.firstMatch.swipeDown() }
 func testDecimalModels() {
  continueAfterFailure=false; app.activate()
  let springboard=XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  expect("Shade 0.3 of the whole."); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  gridCell(2,10); tap("pilot-check"); expect("Try again")
  tap("decimal-grid-1"); expect("Grid 3"); shot("en-grid-tenths"); tap("pilot-check"); expect("Correct")
  XCTAssertFalse(app.buttons["decimal-grid-1"].isEnabled)
  next(); expect("Build 0.6."); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("decimal-add-tenths",6); expect("Columns 0/6/0"); shot("en-build-tenths"); tap("pilot-check"); expect("Correct")
  next(); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  gridCell(94,100); expect("Grid 94"); gridCell(40,100); expect("Grid 40");
  tap("decimal-grid--10"); expect("Grid 30"); tap("decimal-grid-10"); expect("Grid 40"); expect("40/100 = 0.40"); shot("en-grid-hundredths"); tap("pilot-check"); expect("Correct")
  next(); tap("pilot-language"); XCTAssertEqual(app.buttons["pilot-language"].label,"English")
  expect("Iekrāso 0,07 no veselā."); gridCell(76,100); expect("Grid 76"); gridCell(7,100); expect("7/100 = 0,07");
  tap("decimal-grid-reset"); expect("Grid none"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  gridCell(7,100); shot("lv-small-hundredths"); tap("pilot-check"); expect("Correct")
  next(); expect("Izveido skaitli 1,25."); tap("decimal-add-ones"); tap("decimal-add-tenths",2); tap("decimal-add-hundredths",5)
  expect("Columns 1/2/5"); expect("Kopā: 1,25"); shot("lv-build-decimal"); tap("pilot-check"); expect("Correct")
  next(); expect("Kopā: 0,46"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  shot("lv-before-exchange"); tap("decimal-exchange"); expect("Columns 0/4/6"); expect("Kopā: 0,46")
  XCTAssertFalse(app.buttons["decimal-exchange"].isEnabled)
  tap("decimal-place-reset"); expect("Columns none/none/none"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  tap("decimal-exchange"); shot("lv-after-exchange"); tap("pilot-check"); expect("Correct")
  next(); tap("decimal-exchange"); expect("Columns 0/6/13"); expect("Kopā: 0,73"); shot("lv-split-tenth"); tap("pilot-check"); expect("Correct")
  next(); tap("decimal-add-ones"); tap("decimal-add-hundredths",4); expect("Columns 1/0/4"); expect("Kopā: 1,04")
  shot("lv-zero-placeholder"); tap("pilot-check"); expect("Correct")
 }
}
