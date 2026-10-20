import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 15)); app.buttons["Reset"].tap()
 }
 func shot(_ name: String) { let item = XCTAttachment(screenshot: app.screenshot()); item.name = name; item.lifetime = .keepAlways; add(item) }
 func hearts(_ count: Int) { XCTAssertTrue(app.buttons["Lives \(count) of 3. Open lives and refill."].waitForExistence(timeout: 8)) }
 func testTimeoutReopenRetryAndCorrectCompletion() {
  hearts(3); XCTAssertFalse(app.buttons["Check answer"].exists); shot("challenge-ready")
  app.buttons["Start challenge"].tap(); XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout: 5)); shot("challenge-running")
  app.buttons["Fast"].tap(); app.buttons["Reopen"].tap()
  XCTAssertTrue(app.staticTexts["Time’s up"].waitForExistence(timeout: 10)); hearts(2)
  XCTAssertFalse(app.buttons["Check answer"].exists); XCTAssertTrue(app.staticTexts["QA coins 42"].exists); shot("challenge-expired")
  app.buttons["Reopen"].tap(); hearts(2)
  app.buttons["Try again"].tap(); XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout: 5))
  app.swipeUp()
  for pair in [(1,6),(2,5),(3,4)] {
   let labels = ["Number \(pair.0), tile \(pair.0)", "Number \(10-pair.0), tile \(pair.1)"]
   for label in labels { XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 3)); if !app.buttons[label].isHittable { app.swipeUp() }; app.buttons[label].tap() }
   let add=app.buttons["Add this pair"]; if !add.isHittable { app.swipeUp() }; add.tap()
  }
  XCTAssertTrue(app.buttons["Check answer"].isEnabled); app.buttons["Check answer"].tap()
  XCTAssertTrue(app.staticTexts["Every pair found!"].waitForExistence(timeout: 5)); XCTAssertTrue(app.staticTexts["QA coins 46"].exists)
  shot("challenge-correct-reward")
 }
 func testLastLifeLatvianAndSingleActiveRun() {
  app.buttons["LV"].tap()
  XCTAssertTrue(app.buttons["Sākt izaicinājumu"].waitForExistence(timeout: 5))
  XCTAssertTrue(app.staticTexts["Desmita dārgumu medības"].exists); shot("challenge-latvian-ready")
  app.buttons["Reset"].tap(); app.buttons["Start challenge"].tap(); app.buttons["Other"].tap()
  XCTAssertTrue(app.buttons["Resume active challenge"].waitForExistence(timeout: 5)); XCTAssertFalse(app.buttons["Start challenge"].exists)
  app.buttons["Reset"].tap(); app.buttons["Start challenge"].tap(); app.buttons["LastLife"].tap(); app.buttons["Fast"].tap()
  XCTAssertTrue(app.staticTexts["Time’s up"].waitForExistence(timeout: 10)); hearts(0)
  XCTAssertTrue(app.buttons["Lives and refill"].exists); XCTAssertFalse(app.buttons["Try again"].exists); shot("challenge-zero-lives")
 }
 func testTenLessonsAndDistinctSpecialCardsAcrossDifficulties() {
  app.buttons["Catalog"].tap()
  for tier in ["Easy","Medium","Hard"] {
   app.buttons[tier].tap(); XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", ". 10 lessons.")).firstMatch.waitForExistence(timeout: 5)); shot("ten-lessons-\(tier)")
  }
  app.buttons["Cards"].tap()
  for tier in ["Easy","Medium","Hard"] {
   app.buttons[tier].tap(); XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Time limit")).firstMatch.waitForExistence(timeout: 5))
   shot("special-cards-\(tier)"); app.swipeUp(); shot("boss-backstory-\(tier)"); app.swipeDown()
  }
 }
 func testEveryLessonSpecialsAndNewBossCheckpoint() {
  for tier in ["Easy","Medium","Hard"] {
   app.buttons[tier].tap(); app.buttons["Lesson3"].tap()
   XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label CONTAINS %@", "Time limit")).firstMatch.waitForExistence(timeout:5))
   let boss=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "Boss mission")).firstMatch
   if !boss.isHittable { app.swipeUp() }; XCTAssertTrue(boss.exists); shot("lesson-three-specials-\(tier)")
   boss.tap(); XCTAssertTrue(app.staticTexts["Stage 1 of 3"].waitForExistence(timeout:5)); shot("lesson-three-boss-\(tier)")
   let answer=app.buttons["Answer \(tier == "Easy" ? "11" : tier == "Medium" ? "57" : "1280")"]
   for _ in 0..<7 { if answer.isHittable { break }; app.swipeUp() }
   XCTAssertTrue(answer.isHittable); answer.tap(); app.buttons["Check answer"].tap()
   XCTAssertTrue(app.buttons["Continue the mission"].waitForExistence(timeout:5)); shot("lesson-three-checkpoint-\(tier)")
   app.buttons["Continue the mission"].tap(); XCTAssertTrue(app.staticTexts["Stage 2 of 3"].waitForExistence(timeout:5))
   app.buttons["Reopen"].tap(); XCTAssertTrue(app.staticTexts["Stage 2 of 3"].waitForExistence(timeout:5)); shot("lesson-three-resumed-\(tier)")
   app.buttons["Lessons"].tap(); app.swipeUp(); shot("lesson-list-specials-\(tier)")
  }
 }
 func testAchievementsUnlockReopenAndFreeReplay() {
  app.buttons["Trophies"].tap()
  XCTAssertTrue(app.staticTexts["0 of 180 bosses collected"].waitForExistence(timeout:5)); shot("achievements-empty")
  app.buttons["Part"].tap(); XCTAssertTrue(app.staticTexts["0 of 180 bosses collected"].exists)
  app.buttons["All bosses"].tap()
  XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label CONTAINS %@","2 of 3 stages")).firstMatch.waitForExistence(timeout:5)); shot("achievements-locked")
  app.buttons["Collect"].tap()
  XCTAssertTrue(app.staticTexts["3 of 180 bosses collected"].waitForExistence(timeout:5))
  app.buttons["Reopen"].tap(); XCTAssertTrue(app.staticTexts["3 of 180 bosses collected"].waitForExistence(timeout:5)); shot("achievements-collected")
  let first=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","Play ending")).firstMatch
  first.tap(); XCTAssertTrue(app.buttons["Close"].waitForExistence(timeout:5)); app.buttons["Close"].tap()
  XCTAssertTrue(first.waitForExistence(timeout:5)); first.tap()
  XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout:10)); shot("achievement-ending")
  app.buttons["Watch the ending again"].tap(); XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout:10))
  app.buttons["Close"].tap(); XCTAssertTrue(app.staticTexts["QA coins 42"].waitForExistence(timeout:5))
  app.buttons["Reopen"].tap(); XCTAssertTrue(app.staticTexts["3 of 180 bosses collected"].exists)
  app.buttons["LV"].tap(); XCTAssertTrue(app.staticTexts["Sasniegumi"].waitForExistence(timeout:5)); shot("achievements-latvian")
 }
 func testNineIndividualBossEndings() {
  app.buttons["Trophies"].tap(); app.buttons["AllEndings"].tap()
  XCTAssertTrue(app.staticTexts["180 of 180 bosses collected"].waitForExistence(timeout:5))
  for name in ["Alder","Ada","Arlo","Aster","Alba","Acorn","Amble","Anise","Axo"] {
   let boss=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@",name+" ")).firstMatch
   for _ in 0..<14 {
    if boss.isHittable { break }
    app.scrollViews.firstMatch.swipeUp(velocity: .slow)
   }
   XCTAssertTrue(boss.isHittable, app.debugDescription); boss.tap()
   XCTAssertTrue(app.buttons["Watch the ending again"].waitForExistence(timeout:10),"Native WebP playback for \(name)")
   shot("individual-ending-\(name)"); app.buttons["Close"].tap()
  }
  XCTAssertTrue(app.staticTexts["QA coins 42"].exists)
 }
}
