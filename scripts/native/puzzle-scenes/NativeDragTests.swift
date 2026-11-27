import XCTest

final class NativeDragTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.activate()
        XCTAssertTrue(app.buttons["Add"].waitForExistence(timeout: 20))
    }

    func element(_ name: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: name).firstMatch
    }

    func tap(_ button: XCUIElement) {
        XCTAssertTrue(button.exists || button.waitForExistence(timeout: 4), button.description)
        let scroll = app.scrollViews.firstMatch
        for _ in 0..<5 {
            let frame = button.frame
            if button.isHittable && scroll.frame.contains(CGPoint(x: frame.midX, y: frame.midY)) { break }
            if frame.midY < scroll.frame.midY { scroll.swipeDown() } else { scroll.swipeUp() }
        }
        XCTAssertTrue(button.isHittable, button.description)
        button.tap()
    }

    func press(_ name: String) { tap(app.buttons[name].firstMatch) }

    func expect(_ name: String) {
        let target = element(name)
        XCTAssertTrue(target.exists || target.waitForExistence(timeout: 4), "Missing \(name)\n\(app.debugDescription)")
    }

    func expectTray(_ id: String, _ label: String) {
        let tray = app.buttons.matching(identifier: id).matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(tray.exists || tray.waitForExistence(timeout: 5), "Expected \(id) to report \(label)")
    }

    func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testJoiningTakingAwayAndArrays() {
        press("Add")
        expect("4 + 3 = ?")
        expectTray("counting-main-tray", "4 to start")
        expectTray("counting-bank-tray", "3 to add")
        shot("addition-before")
        press("counting-bank-tray")
        press("counting-main-tray")
        expectTray("counting-bank-tray", "2 to add")
        shot("addition-one-moved")
        press("counting-main-tray")
        press("counting-bank-tray")
        expectTray("counting-bank-tray", "3 to add")

        press("Subtract")
        expect("9 − 3 = ?")
        press("counting-main-tray")
        press("counting-bank-tray")
        expectTray("counting-bank-tray", "1 on the card")
        shot("subtraction-one-moved")

        press("Rows")
        expect("3 × 4 = ?")
        tap(element("Row 3"))
        XCTAssertFalse(element("3 × 4 = 12").exists)
        shot("three-rows")
        press("Use 12 rows")
        expect("12 × 5 = ?")
        tap(element("Row 12"))
        shot("large-array")
        press("Lock scene")
        XCTAssertFalse(element("Row 12").exists)
    }

    func deal(_ objects: String, to group: String, rounds: Int, total: Int) {
        expect("Supply, \(total)")
        for round in 0..<rounds {
            for tray in 1...4 {
                let piece = round * 4 + tray
                press("\(objects) \(piece), Supply")
                press("\(group) \(tray), \(round)")
                expect("\(objects) \(piece), \(group) \(tray)")
            }
        }
        expect("Supply, \(total - rounds * 4)")
        for tray in 1...4 { expect("\(group) \(tray), \(rounds)") }
    }

    func testSharingSingleObjectsAndLeftovers() {
        press("Share")
        deal("cookies", to: "Plate", rounds: 4, total: 18)
        shot("sharing-leftovers")
        press("cookies 1, Plate 1")
        press("Supply, 2")
        expect("Plate 1, 3")
        expect("Supply, 3")
    }

    func testMouseTraysAndLocalizedChoices() {
        press("English")
        press("Mice")
        expect("2 toy mice")
        press("6 toy mice")
        XCTAssertTrue(app.buttons["6 toy mice"].isSelected)
        shot("mice-six-and-two")
        press("Lock scene")
        XCTAssertFalse(app.buttons["6 toy mice"].isEnabled)
        press("Larger mouse trays")
        expect("10 toy mice")
        press("Latviski")
        expect("10 rotaļu peles")
        shot("mice-latvian")
        press("English")
        press("Trains")
        expect("12 train carriages")
        expect("18 train carriages")
        shot("train-carriages")
    }

    func testParcelSharing() {
        press("Share")
        press("Use parcels")
        deal("parcels", to: "Tray", rounds: 7, total: 31)
        shot("parcels-leftovers")
    }
}
