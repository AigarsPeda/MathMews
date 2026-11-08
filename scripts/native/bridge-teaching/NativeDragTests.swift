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
  // The isolated feedback fixture supplies onboarding and progress itself.
  // A fresh simulator may stop at onboarding; never create a cloud save for QA.
  let onboarding = app.textFields.firstMatch
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   (settings.exists && settings.isHittable) || onboarding.exists || app.staticTexts["bridge-qa-state"].exists
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
 }
}
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 let checks = ["en": "Check answer", "lv": "Pārbaudīt atbildi", "ru": "Проверить ответ"]
 let retries = ["en": "Try again", "lv": "Mēģināt vēlreiz", "ru": "Попробуйте еще раз"]
 let nextActions = ["en": "Next puzzle", "lv": "Nākamais uzdevums", "ru": "Следующая головоломка"]
 let results = ["en": "Great job!", "lv": "Lieliski!", "ru": "Отличная работа!"]
 let cases = ["ratio-easy", "ratio-medium", "ratio-hard", "ratio-dense", "equation-easy", "equation-medium", "equation-hard", "equation-zero", "equation-negative", "equation-dense", "equation-multiple-divide", "equation-divide-first"]

 func node(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
 func state() -> [String: Any] {
  let telemetry = app.staticTexts["bridge-qa-state"]
  guard telemetry.exists, let data = telemetry.label.data(using: .utf8),
        let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
  return value
 }
 func openCase(_ name: String, _ locale: String, narrow: Bool = false) {
  XCTAssertTrue(app.buttons["bridge-qa-menu"].exists || app.buttons["bridge-qa-menu"].waitForExistence(timeout: 30))
  tap("bridge-qa-menu"); tap("bridge-qa-locale-\(locale)"); tap(narrow ? "qa-width-narrow" : "qa-width-normal"); tap("bridge-qa-case-\(name)")
  let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
   let current = self.state()
   return current["caseName"] as? String == name && current["locale"] as? String == locale && current["ready"] as? Bool == true && current["metrics"] is [String: Any]
  }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed, "Loading \(name)/\(locale)\n\(app.debugDescription)")
  XCTAssertTrue(app.buttons[checks[locale]!].isHittable, "Check stays in the production dock")
  XCTAssertFalse(app.buttons[checks[locale]!].isEnabled, "An untouched task must not submit")
 }
 func tap(_ id: String, times: Int = 1) {
  let button = app.buttons[id]
  XCTAssertTrue(button.exists || button.waitForExistence(timeout: 8), "Missing \(id)\n\(app.debugDescription)")
  for _ in 0..<times {
   for _ in 0..<6 { if button.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
   for _ in 0..<6 { if button.isHittable { break }; app.scrollViews.firstMatch.swipeDown() }
   XCTAssertTrue(button.isHittable, id); XCTAssertTrue(button.isEnabled, id); button.tap()
  }
 }
 func enter(_ value: Int) { for digit in String(value) { tap("bridge-digit-\(digit)") } }
 func shot(_ name: String) {
  let attachment = XCTAttachment(screenshot: app.screenshot())
  attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
 }
 func assertFits(_ name: String) {
  let previous = continueAfterFailure; continueAfterFailure = true
  defer { continueAfterFailure = previous }
  let current = state()
  let attachment = XCTAttachment(string: String(data: try! JSONSerialization.data(withJSONObject: current, options: [.sortedKeys]), encoding: .utf8)!)
  attachment.name = "\(name)-layout.json"; attachment.lifetime = .keepAlways; add(attachment)
  let metrics = current["metrics"] as! [String: Any]
  XCTAssertLessThanOrEqual((metrics["contentHeight"] as! NSNumber).doubleValue, (metrics["viewportHeight"] as! NSNumber).doubleValue + 2, "Initial board must fit: \(name)")
  XCTAssertTrue(app.buttons["puzzle-picture-help"].isHittable, "Picture help must fit: \(name)")
 }
 func solveEquation(_ name: String) {
  switch name {
  case "equation-easy", "equation-zero": tap("bridge-add--1")
  case "equation-medium": tap("bridge-divide-2")
  case "equation-hard": tap("bridge-add--1", times: 3); tap("bridge-divide-2")
  case "equation-negative": tap("bridge-add-1", times: 2)
  case "equation-dense": tap("bridge-add--5"); tap("bridge-divide-4")
  default: XCTFail("Unknown equation case")
  }
  XCTAssertTrue(node("bridge-equation-ready").waitForExistence(timeout: 5), "Solved equation names the next action")
  XCTAssertFalse(node("bridge-operations").exists, "Do not invite operations after x is alone")
  XCTAssertFalse(node("bridge-equation-step").exists, "No duplicate arithmetic history")
 }
 func checkResult(_ locale: String, _ name: String) {
  tap(checks[locale]!)
  XCTAssertTrue(app.staticTexts[results[locale]!].waitForExistence(timeout: 10), "Real result sheet \(name)")
  shot("\(locale)-\(name)-result")
  tap(nextActions[locale]!)
  let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.app.buttons["bridge-qa-menu"].isHittable }, object: nil)
  XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 10), .completed, "Dismiss the result before selecting another case")
 }
 func testInitialScreens() {
  continueAfterFailure = false; app.activate()
  for locale in ["en", "lv", "ru"] {
   for name in cases {
    openCase(name, locale); shot("\(locale)-\(name)-initial"); assertFits("\(locale)-\(name)")
    XCTAssertFalse(node("bridge-equation-step").exists)
    if name.hasPrefix("ratio") { XCTAssertEqual(app.descendants(matching: .any).matching(identifier: "bridge-value").count, 1, "Exactly one answer display") }
   }
  }
 }
 func testInteractions() {
  continueAfterFailure = false; app.activate()
  // Wrong answer, unchanged retry, correction and reset keep using the real dock.
  openCase("ratio-easy", "en"); enter(9); tap(checks["en"]!)
  XCTAssertTrue(app.buttons[retries["en"]!].waitForExistence(timeout: 8)); XCTAssertEqual(state()["lives"] as? Int, 2)
  shot("en-ratio-easy-incorrect"); tap(retries["en"]!)
  XCTAssertEqual(state()["lives"] as? Int, 2)
  tap("bridge-reset"); XCTAssertFalse(app.buttons[checks["en"]!].isEnabled); shot("en-ratio-easy-reset")
  enter(4); shot("en-ratio-easy-entered"); checkResult("en", "ratio-easy")
  for (name, locale, answer) in [("ratio-medium", "lv", 6), ("ratio-hard", "ru", 4), ("ratio-dense", "en", 12)] {
   openCase(name, locale); enter(answer); shot("\(locale)-\(name)-entered"); checkResult(locale, name)
  }
  for (name, locale) in [("equation-easy", "en"), ("equation-medium", "lv"), ("equation-hard", "ru"), ("equation-zero", "en"), ("equation-negative", "en")] {
   openCase(name, locale)
   if name == "equation-easy" {
    tap("bridge-add-1"); shot("en-equation-easy-changed"); tap(checks[locale]!)
    XCTAssertTrue(app.buttons[retries[locale]!].waitForExistence(timeout: 8)); shot("en-equation-easy-unfinished")
    tap(retries[locale]!); tap("bridge-reset")
    XCTAssertFalse(app.buttons[checks[locale]!].isEnabled); XCTAssertFalse(node("bridge-equation-ready").exists)
    shot("en-equation-easy-reset")
   }
   solveEquation(name); shot("\(locale)-\(name)-ready"); checkResult(locale, name)
  }
 }
 func testBridgeTeaching() {
  testInitialScreens(); testInteractions()
 }
 func testInteractionsAndNarrow() {
  continueAfterFailure = false; app.activate()
  for name in cases.filter({ $0.hasPrefix("equation") }) {
   openCase(name, "ru"); shot("ru-\(name)-initial"); assertFits("ru-\(name)")
  }
  testInteractions(); testNarrowScreens()
 }
 func testDenseScreens() {
  continueAfterFailure = false; app.activate()
  for locale in ["en", "lv", "ru"] {
   for name in ["equation-dense", "equation-multiple-divide", "equation-divide-first"] {
    openCase(name, locale); shot("\(locale)-\(name)-initial"); assertFits("\(locale)-\(name)")
   }
  }
 }
 func testNarrowScreens() {
  continueAfterFailure = false; app.activate()
  for (name, locale) in [("ratio-medium", "lv"), ("equation-hard", "ru")] {
   openCase(name, locale, narrow: true); shot("narrow-\(locale)-\(name)-initial")
   tap("bridge-reset")
   XCTAssertTrue(app.buttons[checks[locale]!].isHittable, "Check stays reachable at 320 pt content width")
  }
 }
 // Run separately after setting simulator Dynamic Type; scrolling is expected.
 func testLargeText() {
  continueAfterFailure = false; app.activate()
  for (name, locale) in [("ratio-dense", "en"), ("equation-medium", "lv"), ("equation-dense", "ru")] {
   openCase(name, locale); XCTAssertGreaterThan((state()["fontScale"] as? NSNumber)?.doubleValue ?? 1, 1.3); shot("large-\(locale)-\(name)-initial")
   if name == "ratio-dense" { enter(12) } else { solveEquation(name) }
   XCTAssertTrue(app.buttons[checks[locale]!].isHittable, "Check stays reachable with larger text")
   shot("large-\(locale)-\(name)-ready"); checkResult(locale, "large-\(name)")
  }
 }
}
