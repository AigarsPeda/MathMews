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
 private func openFixture(_ id: String? = nil, locale: String = "en") {
  continueAfterFailure = false
  let route = id.map { "puzzle-layout-qa?example=" + $0 + "&locale=" + locale } ?? "puzzle-layout-audit-qa"
  XCUIDevice.shared.system.open(URL(string: "mathmews://" + route)!)
  let open = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Open"]
  if open.exists { open.tap() }
 }
 private func proof(_ app: XCUIApplication, _ text: String) -> XCUIElement {
  // Proof quantities use nonbreaking spaces to keep the unit with its number.
  let expression = text.split(separator: " ").map { NSRegularExpression.escapedPattern(for: String($0)) }.joined(separator: #"\s+"#)
  return app.descendants(matching: .any).matching(NSPredicate(format: "label MATCHES %@", ".*" + expression + ".*")).firstMatch
 }
 private func expectProof(_ app: XCUIApplication, _ text: String) {
  XCTAssertTrue(proof(app, text).waitForExistence(timeout: 10), "Missing proof: \(text)\n\(app.debugDescription)")
 }
 private func seeResult(_ app: XCUIApplication) {
  let button = app.buttons["See result"]
  XCTAssertTrue(button.waitForExistence(timeout: 10))
  XCTAssertFalse(app.buttons["View path"].exists)
  button.tap()
  XCTAssertTrue(app.buttons["View path"].waitForExistence(timeout: 5))
 }
 func testCookieShareEqual() {
  openFixture("v2-medium-division-equal-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let prompt = app.staticTexts["puzzle-question"]
  XCTAssertTrue(prompt.waitForExistence(timeout: 20))
  XCTAssertEqual(prompt.label, "Share 4 cookies equally between 2 plates.")
  saveSharingScreenshot("cookie-sharing-start")
  // A child can solve it straight away, without running the demonstration.
  app.buttons["Answer 2 each, 0 left"].tap()
  app.buttons["Check answer"].tap()
  seeResult(app)
 }
 func testCookieShareRemainder() {
  openFixture("v2-medium-division-leftovers-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let demo = app.buttons["cookie-sharing-demo"]
  XCTAssertFalse(demo.exists)
  XCTAssertFalse(proof(app, "4 on each plate. 2 left on the tray.").exists)
  app.buttons["Answer 4 each, 2 left"].tap()
  app.buttons["Check answer"].tap()
  expectProof(app, "4 on each plate. 2 left on the tray.")
  saveSharingScreenshot("cookie-sharing-remainder")
  seeResult(app)
 }
 private func saveSharingScreenshot(_ name: String) {
  let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
  shot.name = name
  shot.lifetime = .keepAlways
  add(shot)
 }
 func testLineCrossRight() {
  openFixture("v2-hard-operations-explore-8-1")
  checkMeasurement(Array(repeating: "bridge-step-1", count: 5), result: "−3 + 5 = 2", totalID: "line-solution-equation")
 }
 func testLineCrossLeft() {
  openFixture("v2-hard-operations-explore-8-2")
  checkMeasurement(["Answer -3"], result: "4 − 7 = −3", totalID: "line-solution-equation")
 }
 func testLineFraction() {
  openFixture("v2-medium-fractions-equivalent-2")
  checkMeasurement(Array(repeating: "fraction-line-right", count: 4), result: "4/6 = 2/3", totalID: "line-solution-equation")
 }
 func testLineTens() {
  openFixture("v2-medium-subtraction-lesson-9-boss-2")
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
  openFixture("v2-easy-subtraction-back-2")
  checkMeasurement(["Answer 4"], result: "6 − 2 = 4", totalID: "line-solution-equation")
 }
 private func checkRatio(_ input: [String], bottles: String, litres: String, group: String) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  XCTAssertFalse(app.staticTexts[group].exists)
  for id in input { app.buttons[id].tap() }
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["Watch again"].waitForExistence(timeout: 10))
  for label in [group, bottles, litres] { XCTAssertTrue(app.staticTexts[label].firstMatch.exists, label) }
  seeResult(app)
 }
 func testRatioGrowth() {
  openFixture("v2-medium-multiplication-explore-8-3")
  checkRatio(["Answer 15"], bottles: "6", litres: "15", group: "2 bottles hold 5 litres.")
 }
 func testRatioPartialMultiple() {
  openFixture("v2-hard-hard-measurement-explore-8-path-review-2")
  checkRatio(["bridge-digit-7", "bridge-digit-0"], bottles: "14", litres: "70", group: "2 bottles hold 10 litres.")
 }
 func testRatioShrink() {
  openFixture("v2-hard-measurement-explore-8-1")
  checkRatio(["bridge-digit-4"], bottles: "1", litres: "4", group: "1 bottle holds 4 litres.")
 }
 func testPercentageAmount() {
  openFixture("v2-hard-percentages-quarters-1")
  checkMeasurement(["Answer 20"], result: "1/4 = 25%", totalID: "percentage-rate", detail: "25% of 80 = 20 coins")
 }
 func testPercentageSale() {
  openFixture("v2-hard-percentages-lesson-1-boss-2")
  checkMeasurement(["Answer 128"], result: "20/100 = 20% = 1/5", totalID: "percentage-rate", detail: "160 − 32 = 128 coins")
 }
 func testPercentageBudget() {
  openFixture("v2-hard-percentages-camp-budget-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  if app.buttons["Start challenge"].exists { app.buttons["Start challenge"].tap() }
  // This is one of two valid shopping plans for the same budget.
  for item in ["Chair", "Toy mouse"] {
   let itemButton = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", item)).firstMatch
   XCTAssertTrue(itemButton.waitForExistence(timeout: 20))
   itemButton.tap()
  }
  app.buttons["Check answer"].tap()
  expectProof(app, "100 − 60 − 20 = 20")
  seeResult(app)
 }
 func testDecimalTenths() {
  openFixture("v2-medium-fractions-explore-7-1")
  checkMeasurement(Array(repeating: "decimal-grid-1", count: 3), result: "3 tenths = 0.3", totalID: "decimal-solution-equation")
 }
 func testDecimalHundredths() {
  openFixture("v2-medium-fractions-lesson-8-boss-1")
  checkMeasurement(Array(repeating: "decimal-grid-10", count: 2) + Array(repeating: "decimal-grid-1", count: 4),
                   result: "2 tenths + 4 hundredths = 0.24", totalID: "decimal-solution-equation")
 }
 func testDecimalWholes() {
  openFixture("v2-medium-medium-fractions-explore-9-path-review-2")
  checkMeasurement(Array(repeating: "decimal-add-ones", count: 2) + Array(repeating: "decimal-add-hundredths", count: 6),
                   result: "2 + 6/100 = 2.06", totalID: "decimal-solution-equation")
 }
 func testDecimalSplit() {
  openFixture("v2-medium-fractions-explore-9-3")
  checkMeasurement(["decimal-exchange"], result: "6/10 + 13/100 = 0.73", totalID: "decimal-solution-equation")
 }
 func testFractionPartition() {
  openFixture("v2-easy-fractions-explore-6-1")
  checkMeasurement(["fraction-strip-parts-8"] + Array(repeating: "fraction-strip-add", count: 4),
                   result: "1/2 = 4/8", totalID: "fraction-solution-equation")
 }
 func testFractionPieces() {
  openFixture("v2-easy-fractions-lesson-4-boss-3")
  checkMeasurement(Array(repeating: "Add one piece", count: 3), result: "3/8", totalID: "fraction-solution-count")
 }
 func testFractionEquivalence() {
  openFixture("v2-easy-fractions-kite-2")
  checkMeasurement(["1/3"], result: "2/6 = 1/3", totalID: "fraction-solution-equation")
 }
 func testAreaFill() {
  openFixture("v2-hard-measurement-area-3")
  checkMeasurement(["Answer 12"], result: "4 × 3 = 12")
 }
 func testPerimeterTrace() {
  openFixture("v2-hard-measurement-explore-3-4")
  checkMeasurement(["geometry-digit-1", "geometry-digit-4"], result: "5 + 2 + 5 + 2 = 14")
 }
 func testPerimeterComparison() {
  openFixture("v2-hard-measurement-explore-6-1")
  checkMeasurement(["geometry-choice-1"], result: "A 14 units < B 16 units")
 }
 func testMissingArea() {
  openFixture("v2-hard-measurement-explore-6-2")
  checkMeasurement(["Answer 5"], result: "15 ÷ 3 = 5")
 }
 private func checkMeasurement(_ input: [String], result: String, totalID: String = "geometry-measure-total", detail: String? = nil) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  for id in input {
   XCTAssertTrue(app.buttons[id].waitForExistence(timeout: 20))
   app.buttons[id].tap()
  }
  let total = app.descendants(matching: .any).matching(identifier: totalID).firstMatch
  XCTAssertFalse(total.exists)
  if result.contains("=") { XCTAssertFalse(proof(app, detail ?? result).exists) }
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["Watch again"].waitForExistence(timeout: 12))
  expectProof(app, result)
  if let detail { expectProof(app, detail) }
  seeResult(app)
 }
 func testVolumeBox() {
  openFixture("v2-hard-capacity-lesson-2-1")
  checkVolume(answer: 60, final: "4 × 15 = 60 cm³")
 }
 func testVolumeCubes() {
  openFixture("v2-hard-capacity-lesson-9-4")
  checkVolume(answer: 192, final: "6 × 32 = 192 cubes")
 }
 private func checkVolume(answer: Int, final: String) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let choice = app.buttons["Answer \(answer)"]
  XCTAssertTrue(choice.waitForExistence(timeout: 20))
  choice.tap()
  XCTAssertFalse(proof(app, final).exists)
  app.buttons["Check answer"].tap()
  expectProof(app, final)
  seeResult(app)
 }
 func testGridTurn() {
  openFixture("v2-hard-spatial-lesson-3-1")
  checkGridJourney(answer: 5)
 }
 func testGridFlip() {
  openFixture("v2-easy-spatial-lesson-8-9")
  checkGridJourney(answer: 13)
 }
 func testGridMove() {
  openFixture("v2-hard-spatial-lesson-5-9")
  checkGridJourney(answer: 36)
 }
 private func checkGridJourney(answer: Int) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let choice = app.buttons["grid-choice-\(answer)"]
  XCTAssertTrue(choice.waitForExistence(timeout: 20))
  let letter = String(choice.label.prefix(1))
  XCTAssertTrue(["A", "B", "C"].contains(letter), choice.label)
  choice.tap()
  let journey = app.staticTexts["grid-journey"]
  XCTAssertFalse(journey.exists)
  app.buttons["Check answer"].tap()
  XCTAssertTrue(journey.waitForExistence(timeout: 3))
  XCTAssertFalse(app.buttons["View path"].exists)
  let arrival = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "The arrow lands on \(letter)."), object: journey)
  XCTAssertEqual(XCTWaiter.wait(for: [arrival], timeout: 6), .completed)
  seeResult(app)
 }
 func testShapeCorners() {
  openFixture("v2-easy-spatial-lesson-3-7")
  checkShapeCount(answer: 10, result: "Corners, 4 + 6 = 10")
 }
 func testShapeSymmetry() {
  openFixture("v2-medium-spatial-lesson-1-4")
  checkShapeCount(answer: 8, result: "Lines of symmetry, 3 + 5 = 8")
 }
 func testShapeSides() {
  openFixture("v2-easy-spatial-lesson-1-9")
  checkShapeCount(answer: 7, result: "Sides, 3 + 4 = 7")
 }
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
  XCTAssertFalse(app.buttons["View path"].exists)
  let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", result), object: counter)
  XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 8), .completed)
  seeResult(app)
 }
 func testMoneyReveal() {
  openFixture("v2-easy-money-lesson-7-9")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer €9.00"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let final = "€20.00 − €11.00 = €9.00"
  XCTAssertFalse(proof(app, final).exists)
  app.buttons["Check answer"].tap()
  expectProof(app, "Cost €11.00")
  expectProof(app, "Count money back to reach €20.00")
  expectProof(app, final)
  seeResult(app)
 }
 func testBarReveal() {
  openFixture("v2-easy-data-lesson-9-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 5"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let final = "7 − 2 = 5"
  XCTAssertFalse(proof(app, final).exists)
  app.buttons["Check answer"].tap()
  expectProof(app, final)
  seeResult(app)
 }
 func testJugReveal() {
  openFixture("v2-easy-capacity-lesson-5-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 700"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let final = "1200 − 500 = 700 ml"
  XCTAssertFalse(proof(app, final).exists)
  app.buttons["Check answer"].tap()
  expectProof(app, final)
  seeResult(app)
 }
 func testClockReveal() {
  openFixture("v2-easy-time-lesson-8-9")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let answer = app.buttons["Answer 2"]
  XCTAssertTrue(answer.waitForExistence(timeout: 20))
  answer.tap()
  let final = "120 min (2 h)"
  XCTAssertFalse(proof(app, final).exists)
  app.buttons["Check answer"].tap()
  expectProof(app, final)
  seeResult(app)
 }
 func testKeypadAndModelStayAboveCheck() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  let cases = [
   ("v2-easy-addition-ten-2", "response-key-", "response-key-erase", "7"),
   ("v2-easy-subtraction-take-3", "response-key-", "response-key-erase", "4"),
   ("v2-hard-measurement-area-1", "geometry-digit-", "geometry-erase", "6"),
   ("v2-medium-operations-explore-9-4", "bridge-digit-", "bridge-erase", "2")
  ]
  for (id, prefix, eraseID, answer) in cases {
   openFixture(id)
   let first = app.buttons[prefix + "1"], erase = app.buttons[eraseID], check = app.buttons["Check answer"]
   XCTAssertTrue(first.waitForExistence(timeout: 15), id)
   let dock = app.descendants(matching: .any)["play-answer-dock"].firstMatch
   let scroll = app.descendants(matching: .any)["play-model-scroll"].firstMatch
   let stage = app.descendants(matching: .any)["play-model-stage"].firstMatch
   XCTAssertTrue(dock.exists && stage.exists && scroll.exists, id)
   XCTAssertEqual(stage.frame.maxY, dock.frame.minY, accuracy: 1.5, id)
   XCTAssertEqual(scroll.frame.maxY, dock.frame.minY - 8, accuracy: 1.5, id)
   for key in (0...9).map({ app.buttons[prefix + String($0)] }) + [erase] {
    XCTAssertTrue(key.isHittable, "Unreachable key in \(id)")
    XCTAssertGreaterThanOrEqual(key.frame.height, 44)
    XCTAssertGreaterThanOrEqual(key.frame.width, 44)
    XCTAssertGreaterThanOrEqual(key.frame.minY, dock.frame.minY)
    XCTAssertLessThanOrEqual(key.frame.maxY, check.frame.minY + 1)
   }
   if prefix == "bridge-digit-" {
    let well = dock.descendants(matching: .any)["bridge-value"].firstMatch
    XCTAssertTrue(well.exists, "The distance answer stays with its keypad")
    XCTAssertGreaterThanOrEqual(well.frame.minY, dock.frame.minY)
    XCTAssertLessThanOrEqual(well.frame.maxY, first.frame.minY + 1)
   }
   XCTAssertLessThanOrEqual(check.frame.maxY, app.frame.maxY)
   app.buttons[prefix + "9"].tap()
   erase.tap()
   XCTAssertFalse(check.isEnabled, id)
   app.buttons[prefix + answer].tap()
   XCTAssertTrue(check.isEnabled, id)
   let attachment = XCTAttachment(screenshot: app.screenshot())
   attachment.name = id + "-typed"
   attachment.lifetime = .keepAlways
   add(attachment)
   check.tap()
   XCTAssertTrue(app.buttons["See result"].waitForExistence(timeout: 12), id)
  }
 }
 func testWrittenBalanceRetry() {
  openFixture("v2-easy-addition-explore-5-2")
  continueAfterFailure = false
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let seven = app.buttons["response-key-7"], erase = app.buttons["response-key-erase"]
  let check = app.buttons["Check answer"], retry = app.buttons["Try again"]
  let value = app.staticTexts["response-value"]
  XCTAssertTrue(seven.waitForExistence(timeout: 15))
  XCTAssertTrue(seven.isHittable, "The docked keypad is reachable before scrolling")
  seven.tap()
  check.tap()
  XCTAssertTrue(retry.waitForExistence(timeout: 5))
  retry.tap()
  XCTAssertEqual(value.label, "Your answer: 7")
  XCTAssertFalse(check.isEnabled)
  erase.tap()
  XCTAssertEqual(value.label, "Your answer: ?")
  XCTAssertFalse(check.isEnabled)
  let five = app.buttons["response-key-5"]
  XCTAssertTrue(five.isHittable)
  seven.tap()
  XCTAssertEqual(value.label, "Your answer: 7")
  XCTAssertFalse(check.isEnabled)
  XCTAssertTrue(erase.isHittable)
  erase.tap()
  XCTAssertEqual(value.label, "Your answer: ?")
  five.tap()
  XCTAssertEqual(value.label, "Your answer: 5")
  XCTAssertTrue(check.isEnabled)
  check.tap()
  expectProof(app, "8 + 5 = 13")
  seeResult(app)
 }
 func testBalanceReveal() {
  openFixture("v2-easy-addition-explore-5-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  func capture(_ name: String) {
   let image = XCTAttachment(screenshot: app.screenshot())
   image.name = name
   image.lifetime = .keepAlways
   add(image)
  }
  let check = app.buttons["Check answer"]
  app.buttons["6"].tap()
  app.buttons["balance-left-pan"].tap()
  XCTAssertFalse(app.staticTexts["balance-comparison"].exists)
  check.tap()
  expectProof(app, "13 > 11")
  capture("balance-left-heavy")
  app.buttons["Try again"].tap()
  app.buttons["4"].tap()
  app.scrollViews.firstMatch.swipeDown()
  app.buttons["balance-left-pan"].tap()
  XCTAssertTrue(check.isEnabled, app.debugDescription)
  check.tap()
  expectProof(app, "7 + 4 = 11")
  capture("balance-equal")
  seeResult(app)

 }
 func testMouseArray() {
  openFixture("v2-easy-multiplication-rows-1")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let row = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Row 1")).firstMatch
  XCTAssertTrue(row.waitForExistence(timeout: 10))
  row.tap()
  row.tap()
  checkCountingReplay(app, answer: "2", equation: "1 × 2 = 2")
 }
 func testRibbonJoinMotion() {
  openFixture("v2-easy-addition-join-1")
  checkTrayMove(from: "counting-bank-tray", to: "counting-main-tray", answer: "3", equation: "2 + 1 = 3")
 }
 func testStarRemovalMotion() {
  openFixture("v2-easy-subtraction-take-1")
  checkTrayMove(from: "counting-main-tray", to: "counting-bank-tray", answer: "4", equation: "5 − 1 = 4")
 }
 private func checkTrayMove(from: String, to: String, answer: String, equation: String) {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  let source = app.buttons[from], destination = app.buttons[to]
  XCTAssertTrue(source.waitForExistence(timeout: 10))
  let initial = source.label
  source.tap(); destination.tap()
  let changed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND label != %@", initial), object: source)
  XCTAssertEqual(XCTWaiter.wait(for: [changed], timeout: 5), .completed)
  destination.tap(); source.tap()
  let restored = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND label == %@", initial), object: source)
  XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 5), .completed)
  checkCountingReplay(app, answer: answer, equation: equation)
 }
 private func checkCountingReplay(_ app: XCUIApplication, answer: String, equation: String) {
  XCTAssertFalse(proof(app, equation).exists)
  app.buttons["Answer " + answer].tap()
  app.buttons["Check answer"].tap()
  expectProof(app, equation)
  app.buttons["Watch again"].tap()
  expectProof(app, equation)
  seeResult(app)
 }
 func testCountingReveal() {
  openFixture("v2-easy-addition-join-3")
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  app.activate()
  let check = app.buttons["Check answer"]
  let seven = app.buttons["response-key-7"]
  XCTAssertTrue(seven.waitForExistence(timeout: 15))
  seven.tap()
  check.tap()
  XCTAssertTrue(app.buttons["See result"].waitForExistence(timeout: 2))
  seeResult(app)
 }
 func testLayout() throws {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
  // Start a fresh measurement session after any single-example test.
  XCUIDevice.shared.system.open(URL(string: "mathmews://")!)
  let leftPuzzle = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.staticTexts["puzzle-question"])
  XCTAssertEqual(XCTWaiter.wait(for: [leftPuzzle], timeout: 10), .completed)
  openFixture()
  XCTAssertTrue(app.staticTexts["layout-done"].waitForExistence(timeout: 600))
  struct Measurement: Decodable {
   let id: String, locale: String, variant: String
   let viewportHeight: Double, contentHeight: Double
  }
  let json = app.staticTexts["layout-report"].label
  let report = XCTAttachment(string: json)
  report.name="layout-measurements.json"; report.lifetime = .keepAlways; add(report)
  let measurements = try XCTUnwrap(try? JSONDecoder().decode([Measurement].self, from: Data(json.utf8)))
  XCTAssertEqual(measurements.count, Int(app.staticTexts["layout-count"].label))
  let rows = measurements
  XCTAssertGreaterThan(rows.count, 300)
  XCTAssertEqual(Set(rows.map { $0.locale }), ["en", "lv", "ru"])
  XCTAssertEqual(Set(rows.map { $0.locale + "/" + $0.id }).count, rows.count)
  let variants = Set(rows.map { $0.variant })
  for locale in ["en", "lv", "ru"] {
   let localized = rows.filter { $0.locale == locale }
   XCTAssertEqual(Set(localized.map { $0.variant }), variants)
   XCTAssertTrue(localized.allSatisfy { $0.viewportHeight > 0 && $0.contentHeight > 0 })
   let deepest = try XCTUnwrap(localized.max { $0.contentHeight - $0.viewportHeight < $1.contentHeight - $1.viewportHeight })
   openFixture(deepest.id, locale: locale)
   let scroll = app.scrollViews.firstMatch, heading = app.staticTexts["puzzle-question"]
   XCTAssertTrue(heading.waitForExistence(timeout: 10) && heading.isHittable)
   let content = scroll.children(matching: .any).firstMatch
   XCTAssertTrue(content.exists)
   for _ in 0..<12 { if content.frame.maxY <= scroll.frame.maxY + 2 { break }; scroll.swipeUp() }
   XCTAssertLessThanOrEqual(content.frame.maxY, scroll.frame.maxY + 2, "Reach the end of \(locale) \(deepest.id)")
   for _ in 0..<12 { if heading.isHittable { break }; scroll.swipeDown() }
   XCTAssertTrue(heading.isHittable, "Return to the question in \(locale) \(deepest.id)")
  }
 }
}
