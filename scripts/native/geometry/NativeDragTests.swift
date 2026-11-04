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
 func enter(_ value: Int) { for digit in String(value) { tap("geometry-digit-\(digit)") } }
 func shot(_ name: String) {
  app.scrollViews.firstMatch.swipeDown()
  let a=XCTAttachment(screenshot: app.screenshot()); a.name=name; a.lifetime = .keepAlways; add(a)
 }
 func next() { tap("pilot-next"); app.scrollViews.firstMatch.swipeDown() }
 func shape(_ name: String = "main") -> XCUIElement { app.descendants(matching: .any)["geometry-shape-\(name)"].firstMatch }
 func testGeometry() {
  continueAfterFailure=false; app.activate()
  let springboard=XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  if app.buttons["Open"].exists { app.buttons["Open"].tap() }
  expect("What is the area of this rectangle?"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  XCTAssertTrue(shape().exists); XCTAssertEqual(shape().frame.width/2,shape().frame.height/3,accuracy:0.5)
  tap("geometry-mark",6); expect("Squares covered: 6"); XCTAssertFalse(app.buttons["geometry-mark"].isEnabled)
  XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  enter(10); tap("pilot-check"); expect("Try again"); tap("geometry-erase",2); enter(6)
  shot("en-area-squares"); tap("pilot-check"); expect("Correct"); XCTAssertFalse(app.buttons["geometry-digit-1"].isEnabled)
  next(); tap("geometry-mark",10); expect("Boundary edges traced: 10"); enter(10)
  shot("en-perimeter-edges"); tap("pilot-check"); expect("Correct")
  next(); tap("pilot-language"); expect("Kuram taisnstūrim ir lielāks perimetrs?")
  XCTAssertEqual(app.buttons["geometry-choice-2"].label,"Vienādi perimetri")
  XCTAssertEqual(shape("A").frame.width/3,shape("B").frame.width/2,accuracy:0.5)
  XCTAssertLessThan(shape("A").frame.maxX,shape("B").frame.minX)
  XCTAssertEqual(shape("A").frame.maxY,shape("B").frame.maxY,accuracy:0.5)
  tap("geometry-choice-0"); tap("pilot-check"); expect("Try again")
  tap("geometry-choice-1"); shot("lv-same-area-different-perimeter"); tap("pilot-check"); expect("Correct")
  next(); expect("Nav mērogā"); enter(5); shot("lv-missing-area"); tap("pilot-check"); expect("Correct")
  next(); enter(3); shot("lv-missing-perimeter"); tap("pilot-check"); expect("Correct")
  next(); tap("pilot-language"); expect("Какова площадь этого прямоугольника?"); XCTAssertFalse(app.buttons["geometry-mark"].exists)
  enter(16); tap("geometry-reset"); expect("Answer none"); XCTAssertFalse(app.buttons["pilot-check"].isEnabled)
  enter(16); shot("ru-independent-area"); tap("pilot-check"); expect("Correct")
  next(); expect("Каков периметр этого прямоугольника?"); tap("geometry-mark",3); enter(12)
  shot("ru-perimeter"); tap("pilot-check"); expect("Correct")
  next(); XCTAssertEqual(app.buttons["geometry-choice-2"].label,"Периметры равны"); tap("geometry-choice-2")
  shot("ru-equal-perimeters"); tap("pilot-check"); expect("Correct")
  next(); expect("Не в масштабе"); enter(5); shot("ru-independent-missing-side"); tap("pilot-check"); expect("Correct")
 }
}
