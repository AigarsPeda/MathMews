import XCTest
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 override func setUpWithError() throws {
  continueAfterFailure = false; app.activate()
  XCTAssertTrue(app.buttons["Selection"].waitForExistence(timeout:15))
 }
 func shot(_ name:String) { let item=XCTAttachment(screenshot:app.screenshot());item.name=name;item.lifetime = .keepAlways;add(item) }
 func solve(_ answer: String) {
  let choice = app.buttons["Answer \(answer)"]
  XCTAssertTrue(choice.waitForExistence(timeout:5))
  for _ in 0..<4 { if choice.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
  choice.tap()
  app.buttons["Check answer"].tap()
 }
 func assertClock() {
  XCTAssertTrue(app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@","Time remaining ")).firstMatch.waitForExistence(timeout:5))
 }
 func testTimedRunRewardsExpiryAndChoice() {
  app.buttons["Timed"].tap()
  let timedChoice = app.descendants(matching:.any).matching(NSPredicate(format:"label == %@","3:00, 2× coins")).firstMatch
  XCTAssertTrue(timedChoice.waitForExistence(timeout:5))
  XCTAssertFalse(app.buttons["Picture help"].exists, "Help is only offered once the puzzle starts")
  shot("timed-choice-bonus-visible")
  timedChoice.tap()
  XCTAssertTrue(app.staticTexts["Finish all 3 remaining puzzles in time to earn double coins."].exists)
  app.buttons["Start challenge"].tap()
  assertClock()
  solve("7")
  XCTAssertTrue(app.staticTexts["8 coins waiting"].waitForExistence(timeout:5))
  XCTAssertTrue(app.staticTexts["QA coins 42"].exists)
  app.buttons["Next puzzle"].tap()
  XCTAssertTrue(app.buttons["Answer 8"].waitForExistence(timeout:5))
  app.buttons["Reopen"].tap()
  XCTAssertTrue(app.buttons["Answer 8"].waitForExistence(timeout:5), "Reload resumes the later puzzle")
  assertClock()
  shot("timed-countdown-later-puzzle")
  app.buttons["Fast"].tap()
  XCTAssertTrue(app.staticTexts["Time’s up"].waitForExistence(timeout:12))
  XCTAssertTrue(app.buttons["Lives 2 of 3. Open lives and refill."].exists)
  XCTAssertTrue(app.staticTexts["QA coins 42"].exists)
  XCTAssertFalse(app.buttons["Picture help"].exists)
  shot("timed-checkpoint-after-expiry")
  timedChoice.tap()
  app.buttons["Try again"].tap()
  for (index, answer) in ["7","8","10"].enumerated() {
   assertClock()
   solve(answer)
   if index < 2 {
    XCTAssertTrue(app.staticTexts["\((index+1)*8) coins waiting"].waitForExistence(timeout:5))
    XCTAssertTrue(app.staticTexts["QA coins 42"].exists)
    app.buttons["Next puzzle"].tap()
   }
  }
  XCTAssertTrue(app.staticTexts["Timed run complete!"].waitForExistence(timeout:5))
  XCTAssertTrue(app.staticTexts["QA coins 66"].exists, "Only a finished run receives all 24 coins")
  XCTAssertTrue(app.buttons["Next level"].exists)
  XCTAssertEqual(app.buttons.matching(identifier:"View path").count, 1, "The secondary action is the only View path button")
  shot("timed-double-reward-collected")
  app.buttons["Next level"].tap()
  XCTAssertTrue(app.staticTexts["The cat has 4 ribbons and adds 2 more. How many altogether?"].waitForExistence(timeout:5))
  XCTAssertTrue(app.buttons["Check answer"].exists)
  XCTAssertFalse(app.buttons["Check answer"].isEnabled, "The next level starts with a fresh answer")
  shot("next-level-first-puzzle")
 }
 func assertSameFrame(_ actual: CGRect, _ expected: CGRect, _ message: String) {
  XCTAssertEqual(actual.minX, expected.minX, accuracy: 0.5, message)
  XCTAssertEqual(actual.minY, expected.minY, accuracy: 0.5, message)
  XCTAssertEqual(actual.width, expected.width, accuracy: 0.5, message)
  XCTAssertEqual(actual.height, expected.height, accuracy: 0.5, message)
 }
 func testPuzzleContentChangesInPlace() {
  app.buttons["Play"].tap()
  let check = app.buttons["Check answer"]
  let back = app.buttons["Go back"]
  let lives = app.buttons["Lives 3 of 3. Open lives and refill."]
  XCTAssertTrue(check.waitForExistence(timeout:10))
  XCTAssertTrue(back.exists)
  let backFrame = back.frame, livesFrame = lives.frame, checkFrame = check.frame
  shot("puzzle-continuity-first")
  for (index, answer) in ["5", "+2"].enumerated() {
   let choice = app.buttons["Answer \(answer)"]
   XCTAssertTrue(choice.waitForExistence(timeout:5))
   XCTAssertFalse(choice.isSelected)
   XCTAssertFalse(check.isEnabled, "Each new puzzle starts without the previous answer")
   choice.tap()
   XCTAssertTrue(check.isEnabled)
   check.tap()
   let next = app.buttons["Next puzzle"]
   XCTAssertTrue(next.waitForExistence(timeout:5))
   next.tap()
   let question = index == 0 ? "Choose the rule that works for this machine." : "Which number belongs in the gap? 7, 6, ?, 4, 3."
   XCTAssertTrue(app.staticTexts[question].waitForExistence(timeout:5))
   XCTAssertFalse(next.exists)
   XCTAssertFalse(check.isEnabled)
   assertSameFrame(back.frame, backFrame, "Back stays in place")
   assertSameFrame(lives.frame, livesFrame, "Lives stay in place")
   assertSameFrame(check.frame, checkFrame, "The answer dock stays in place")
   XCTAssertEqual(app.tabBars.count, 0)
   shot("puzzle-continuity-next-\(index + 2)")
  }
 }
 func testBerrySelectionPlayAndResult() {
  app.buttons["Selection"].tap()
  XCTAssertTrue(app.staticTexts["Let's play."].waitForExistence(timeout:5))
  XCTAssertTrue(app.buttons["Start playing"].exists)
  XCTAssertEqual(app.tabBars.count,0)
  shot("berry-selection")
  for name in ["Medium", "Hard", "Easy"] {
   let tab = app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@", "\(name) difficulty.")).firstMatch
   tab.tap()
   XCTAssertTrue(tab.isSelected)
   XCTAssertTrue(app.buttons["Start playing"].exists)
   shot("berry-difficulty-\(name.lowercased())")
  }
  app.buttons["Play"].tap()
  XCTAssertTrue(app.buttons["Check answer"].waitForExistence(timeout:5))
  XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  shot("berry-puzzle-ready")
  app.buttons["Answer 9"].tap()
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.buttons["Lives 2 of 3. Open lives and refill."].waitForExistence(timeout:5))
  XCTAssertFalse(app.buttons["Check answer"].isEnabled)
  shot("berry-puzzle-incorrect")
  app.buttons["Answer 10"].tap()
  XCTAssertTrue(app.buttons["Check answer"].isEnabled)
  shot("berry-puzzle-selected")
  app.buttons["Check answer"].tap()
  XCTAssertTrue(app.staticTexts["Great job!"].waitForExistence(timeout:5))
  shot("berry-result")
 }
}
