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
 let app=XCUIApplication(bundleIdentifier:"com.mathmews.app")
 override func setUpWithError() throws { continueAfterFailure=false;app.activate();XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout:20));app.buttons["Reset"].tap() }
 func shot(_ name:String){let item=XCTAttachment(screenshot:app.screenshot());item.name=name;item.lifetime = .keepAlways;add(item)}
 func tap(_ label:String){let button=app.buttons[label];XCTAssertTrue(button.waitForExistence(timeout:5),label);if !button.isHittable {app.scrollViews.firstMatch.swipeUp()};button.tap()}
 func visibleText(_ label:String){
  let text=app.staticTexts.matching(NSPredicate(format:"label == %@",label)).firstMatch
  XCTAssertTrue(text.waitForExistence(timeout:5),label)
  let viewport=app.scrollViews.firstMatch.frame
  XCTAssertGreaterThanOrEqual(text.frame.minY,viewport.minY,label)
  XCTAssertLessThanOrEqual(text.frame.maxY,viewport.maxY,label)
 }
 func unchanged(_ count:Int){XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label MATCHES %@","QA lives 0 coins [0-9]+ solved 0 guided \(count)")).firstMatch.waitForExistence(timeout:5))}
 func testGuidedJoiningAtZeroLivesAndReopen(){
  unchanged(0);shot("guided-joining-zero-lives")
  tap("Move a ribbon");tap("Check this step");tap("Next step")
  tap("2 + 1 = 3");tap("Check this step");tap("Next step")
  tap("4");tap("Check this step");unchanged(1);shot("guided-complete-no-rewards")
  tap("Reopen");unchanged(1);XCTAssertTrue(app.buttons["Move a ribbon"].waitForExistence(timeout:5))
 }
 func testFractionMistakesAndInteractiveParts(){
  tap("Fractions");tap("Yes, there are two pieces");tap("Check this step")
  XCTAssertTrue(app.staticTexts["Try this next"].waitForExistence(timeout:5));unchanged(0);shot("guided-fraction-feedback")
  tap("No, halves must be equal");tap("Check this step");tap("Next step")
  tap("Piece 1 of 4");tap("Check this step");tap("Next step")
  tap("2/4");tap("Check this step");unchanged(1);shot("guided-fractions-complete");visibleText("2/4: two of the four equal pieces.");visibleText("You practised with the cat. Try another example or return to your puzzles.")
 }
 func testSubtractionStatus(){
  tap("Subtract")
  for number in stride(from:10,through:7,by:-1){tap("Take ribbon \(number) out")}
  tap("Check this step");unchanged(0)
  visibleText("10 − 4 = 6.")
  shot("guided-subtraction-feedback")
 }
 func testNarrowLatvian(){tap("Narrow");tap("LV");XCTAssertTrue(app.buttons["Pārvieto lenti"].waitForExistence(timeout:5));shot("guided-narrow-latvian");tap("Pārvieto lenti");tap("Pārbaudi šo soli");tap("Nākamais solis");shot("guided-latvian-next-step")}
}
