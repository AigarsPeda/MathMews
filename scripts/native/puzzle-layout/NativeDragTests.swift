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
   settings.exists || (onboarding.exists && onboarding.isHittable) || app.buttons["pilot-next"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 func testCookieShareEqual() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let prompt = app.staticTexts["puzzle-question"]
  XCTAssertTrue(prompt.waitForExistence(timeout: 20))
  XCTAssertEqual(prompt.label, "Share 4 cookies equally between 2 plates.")
  saveSharingScreenshot("cookie-sharing-start")
  // A child can solve it straight away, without running the demonstration.
  app.buttons["Answer 2 each, 0 left"].tap()
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 12))
 }
 func testCookieShareRemainder() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let demo = app.buttons["cookie-sharing-demo"]
  XCTAssertTrue(demo.waitForExistence(timeout: 20))
  demo.tap()
  let status = app.staticTexts["cookie-sharing-status"]
  let shared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "4 on each plate. 2 left on the tray."), object: status)
  XCTAssertEqual(XCTWaiter.wait(for: [shared], timeout: 10), .completed)
  saveSharingScreenshot("cookie-sharing-remainder")
  app.buttons["Answer 4 each, 2 left"].tap()
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 12))
 }
 private func saveSharingScreenshot(_ name: String) {
  let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
  shot.name = name
  shot.lifetime = .keepAlways
  add(shot)
 }
 func testLineCrossRight() {
  checkMeasurement(Array(repeating: "bridge-step-1", count: 5), result: "−3 + 5 = 2", totalID: "line-solution-equation")
 }
 func testLineCrossLeft() {
  checkMeasurement(["Answer -3"], result: "4 − 7 = −3", totalID: "line-solution-equation")
 }
 func testLineFraction() {
  checkMeasurement(Array(repeating: "fraction-line-right", count: 4), result: "4/6 = 2/3", totalID: "line-solution-equation")
 }
 func testLineTens() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let track = app.descendants(matching: .any)["number-line-track"].firstMatch
  XCTAssertTrue(track.waitForExistence(timeout: 20))
  // Step between visible ticks to test the real long, scrolling line.
  for value in stride(from: 76, through: 46, by: -3) {
   app.buttons["Number \(value)"].tap()
  }
  checkMeasurement(["Number 44"], result: "79 − 35 = 44", totalID: "line-solution-equation")
 }
 func testLineSubtract() {
  checkMeasurement(["Answer 4"], result: "6 − 2 = 4", totalID: "line-solution-equation")
 }
 func testRatioGrowth() {
  checkMeasurement(["Answer 15"], result: "2 : 5 = 6 : 15", totalID: "ratio-equation")
 }
 func testRatioPartialMultiple() {
  checkMeasurement(["bridge-digit-7", "bridge-digit-0"], result: "8 : 40 = 14 : 70", totalID: "ratio-equation")
 }
 func testRatioShrink() {
  checkMeasurement(["bridge-digit-4"], result: "3 : 12 = 1 : 4", totalID: "ratio-equation")
 }
 func testPercentageAmount() {
  checkMeasurement(["Answer 20"], result: "25/100 = 25% = 1/4", totalID: "percentage-rate", detail: "25% of 80 = 20 coins")
 }
 func testPercentageSale() {
  checkMeasurement(["Answer 128"], result: "20/100 = 20% = 1/5", totalID: "percentage-rate", detail: "160 − 32 = 128 coins")
 }
 func testPercentageBudget() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  XCTAssertTrue(app.buttons["Start challenge"].waitForExistence(timeout: 20))
  app.buttons["Start challenge"].tap()
  // This is one of two valid shopping plans for the same budget.
  for item in ["Chair", "Toy mouse"] {
   let itemButton = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", item)).firstMatch
   XCTAssertTrue(itemButton.waitForExistence(timeout: 20))
   itemButton.tap()
  }
  app.buttons["Check answer"].tap()
  let total = app.staticTexts["percentage-result"]
  XCTAssertTrue(total.waitForExistence(timeout: 8))
  XCTAssertEqual(total.label, "100 − 60 − 20 = 20 coins left")
  XCTAssertFalse(app.buttons["View path"].exists)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))
 }
 func testDecimalTenths() {
  checkMeasurement(Array(repeating: "decimal-grid-1", count: 3), result: "3/10 = 0.3", totalID: "decimal-solution-equation")
 }
 func testDecimalHundredths() {
  checkMeasurement(Array(repeating: "decimal-grid-10", count: 2) + Array(repeating: "decimal-grid-1", count: 4),
                   result: "24/100 = 0.24", totalID: "decimal-solution-equation")
 }
 func testDecimalWholes() {
  checkMeasurement(Array(repeating: "decimal-add-ones", count: 2) + Array(repeating: "decimal-add-hundredths", count: 6),
                   result: "2 + 6/100 = 2.06", totalID: "decimal-solution-equation")
 }
 func testDecimalSplit() {
  checkMeasurement(["decimal-exchange"], result: "6/10 + 13/100 = 0.73", totalID: "decimal-solution-equation")
 }
 func testFractionPartition() {
  checkMeasurement(["fraction-strip-parts-8"] + Array(repeating: "fraction-strip-add", count: 4),
                   result: "1/2 = 4/8", totalID: "fraction-solution-equation")
 }
 func testFractionPieces() { checkMeasurement(Array(repeating: "Add one piece", count: 3), result: "3/8", totalID: "fraction-solution-count") }
 func testFractionEquivalence() { checkMeasurement(["1/3"], result: "2/6 = 1/3", totalID: "fraction-solution-equation") }
 func testAreaFill() { checkMeasurement(["Answer 12"], result: "4 × 3 = 12") }
 func testPerimeterTrace() { checkMeasurement(["geometry-digit-1", "geometry-digit-4"], result: "5 + 2 + 5 + 2 = 14") }
 func testPerimeterComparison() { checkMeasurement(["geometry-choice-1"], result: "14 < 16") }
 func testMissingArea() { checkMeasurement(["Answer 5"], result: "15 ÷ 3 = 5") }
 private func checkMeasurement(_ input: [String], result: String, totalID: String = "geometry-measure-total", detail: String? = nil) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  for id in input {
   XCTAssertTrue(app.buttons[id].waitForExistence(timeout: 20))
   app.buttons[id].tap()
  }
  let total = app.staticTexts[totalID]
  XCTAssertFalse(total.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(total.waitForExistence(timeout: 3))
  XCTAssertNotEqual(total.label, result)
  XCTAssertFalse(app.buttons["View path"].exists)
  let finished = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", result), object: total)
  XCTAssertEqual(XCTWaiter.wait(for: [finished], timeout: 8), .completed)
  if let detail { XCTAssertEqual(app.staticTexts["percentage-result"].label, detail) }
  XCTAssertFalse(app.buttons["View path"].exists)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))
 }
 func testVolumeBox() { checkVolume(answer: 60, final: "4 × 15 = 60 cm³") }
 func testVolumeCubes() { checkVolume(answer: 192, final: "6 × 32 = 192 cubes") }
 private func checkVolume(answer: Int, final: String) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let choice = app.buttons["Answer \(answer)"]
  XCTAssertTrue(choice.waitForExistence(timeout: 20))
  choice.tap()
  let count = app.staticTexts["volume-count"]
  XCTAssertFalse(count.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(count.waitForExistence(timeout: 3))
  XCTAssertNotEqual(count.label, final)
  XCTAssertFalse(app.buttons["View path"].exists)
  let filled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", final), object: count)
  XCTAssertEqual(XCTWaiter.wait(for: [filled], timeout: 10), .completed)
  XCTAssertFalse(app.buttons["View path"].exists)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))
 }
 func testGridTurn() { checkGridJourney(answer: 5) }
 func testGridFlip() { checkGridJourney(answer: 13) }
 func testGridMove() { checkGridJourney(answer: 36) }
 private func checkGridJourney(answer: Int) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let choice = app.buttons["Answer \(answer)"]
  XCTAssertTrue(choice.waitForExistence(timeout: 20))
  choice.tap()
  let journey = app.staticTexts["grid-journey"]
  XCTAssertFalse(journey.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(journey.waitForExistence(timeout: 3))
  XCTAssertFalse(app.buttons["View path"].exists)
  let arrival = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "Square \(answer)"), object: journey)
  XCTAssertEqual(XCTWaiter.wait(for: [arrival], timeout: 6), .completed)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 5))
 }
 func testShapeCorners() { checkShapeCount(answer: 10, result: "Corners, 4 + 6 = 10") }
 func testShapeSymmetry() { checkShapeCount(answer: 8, result: "Lines of symmetry, 3 + 5 = 8") }
 func testShapeSides() { checkShapeCount(answer: 7, result: "Sides, 3 + 4 = 7") }
 private func checkShapeCount(answer: Int, result: String) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let choice = app.buttons["Answer \(answer)"]
  XCTAssertTrue(choice.waitForExistence(timeout: 20))
  choice.tap()
  let counter = app.descendants(matching: .any).matching(identifier: "shape-count").firstMatch
  XCTAssertFalse(counter.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(counter.waitForExistence(timeout: 3))
  XCTAssertNotEqual(counter.label, result)
  XCTAssertFalse(app.buttons["View path"].exists)
  let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", result), object: counter)
  XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 8), .completed)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 5))
 }
 func testMoneyReveal() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 9"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let result = app.staticTexts["money-solution-caption"]
  XCTAssertFalse(result.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.staticTexts["money-price-stage"].waitForExistence(timeout: 4))
  XCTAssertTrue(app.staticTexts["money-change-stage"].waitForExistence(timeout: 6))
  XCTAssertFalse(app.buttons["View path"].exists)
  XCTAssertTrue(result.waitForExistence(timeout: 5))
  XCTAssertEqual(result.label, "€20 − €11 = €9")
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 5))
 }
 func testBarReveal() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 5"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let caption = app.staticTexts["bar-solution-caption"]
  XCTAssertFalse(caption.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(caption.waitForExistence(timeout: 5))
  XCTAssertEqual(caption.label, "7 − 2 = 5")
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 5))
 }
 func testJugReveal() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 700"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let caption = app.descendants(matching: .any).matching(identifier: "jug-solution-caption").firstMatch
  XCTAssertFalse(caption.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(caption.waitForExistence(timeout: 3))
  XCTAssertFalse(app.buttons["View path"].exists)
  let settled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "500 + 700 = 1200 ml"), object: caption)
  XCTAssertEqual(XCTWaiter.wait(for: [settled], timeout: 6), .completed)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))
 }
 func testClockReveal() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 2"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let caption = app.descendants(matching: .any).matching(identifier: "clock-solution-caption").firstMatch
  XCTAssertFalse(caption.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(caption.waitForExistence(timeout: 3))
  XCTAssertFalse(app.buttons["View path"].exists)
  let expected = NSPredicate(format: "label CONTAINS %@", "07:00 → 09:00, +120 min (2 h)")
  let settled = XCTNSPredicateExpectation(predicate: expected, object: caption)
  XCTAssertEqual(XCTWaiter.wait(for: [settled], timeout: 7), .completed)
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))
 }
 func testBalanceReveal() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  func capture(_ name: String) {
   let image = XCTAttachment(screenshot: app.screenshot())
   image.name = name
   image.lifetime = .keepAlways
   add(image)
  }
  let check = app.buttons["Check answer"]
  XCTAssertTrue(app.buttons["Answer 6"].waitForExistence(timeout: 20))
  app.buttons["Answer 6"].tap()
  XCTAssertFalse(app.staticTexts["balance-comparison"].exists)
  check.tap()
  let comparison = app.staticTexts["balance-comparison"]
  XCTAssertTrue(comparison.waitForExistence(timeout: 4))
  XCTAssertEqual(comparison.label, "13 > 11")
  capture("balance-left-heavy")
  app.buttons["Answer 4"].tap()
  check.tap()
  XCTAssertTrue(comparison.waitForExistence(timeout: 3))
  XCTAssertEqual(comparison.label, "11 = 11")
  capture("balance-equal")
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))

 }
 func testMouseArray() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let build = app.buttons["Build the rows"]
  XCTAssertTrue(build.waitForExistence(timeout: 15))
  build.tap()
  XCTAssertTrue(app.buttons["Start again"].waitForExistence(timeout: 3))
  app.buttons["Start again"].tap()
  app.buttons["Answer 2"].tap()
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 6))
 }
 func testRibbonJoinMotion() { checkCountingReplay("Join the ribbons", answer: "3") }
 func testStarRemovalMotion() { checkCountingReplay("Take away 1", answer: "4") }
 private func checkCountingReplay(_ action: String, answer: String) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let play = app.buttons[action]
  XCTAssertTrue(play.waitForExistence(timeout: 15))
  play.tap()
  app.buttons["Start again"].tap()
  XCTAssertTrue(play.exists)
  app.buttons["Answer " + answer].tap()
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 8))
 }
 func testCountingReveal() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let check = app.buttons["Check answer"]
  let seven = app.buttons["response-key-7"]
  XCTAssertTrue(seven.waitForExistence(timeout: 15))
  seven.tap()
  check.tap()
  XCTAssertTrue(app.buttons["See result"].waitForExistence(timeout: 2))
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 8))
 }
 func testLayout() {
  let app=XCUIApplication(bundleIdentifier:"com.mathmews.app"); app.activate()
  XCTAssertTrue(app.staticTexts["layout-done"].waitForExistence(timeout:600))
  let report = XCTAttachment(string: app.staticTexts["layout-report"].label)
  report.name="iPhone15-layout-measurements.json"; report.lifetime = .keepAlways; add(report)
  XCTAssertGreaterThan(Int(app.staticTexts["layout-count"].label) ?? 0, 300)
  XCTAssertEqual(app.staticTexts["layout-summary"].label,"0 overflowing screens")
 }
}
