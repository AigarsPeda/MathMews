import XCTest
import UIKit
final class NativeDragTests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "com.mathmews.app")
 func expect(_ text: String) { XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 5), "Missing \(text)\n\(app.debugDescription)") }
 func tapTick(_ value: Int) {
  let track = app.descendants(matching: .any)["number-line-track"].firstMatch
  let number = app.buttons["Number \(value)"]
  if number.isEnabled { XCTAssertTrue(number.isHittable) }
  // Tap the drawn tick, above the number label's original touch area.
  track.coordinate(withNormalizedOffset: CGVector(dx: (number.frame.midX-track.frame.minX)/track.frame.width, dy: 74.0/152.0)).tap()
 }
 func testSelectedMarkerBottomEdge() {
  app.activate(); expect("Number line touch check"); expect("Selected 8")
  let track = app.descendants(matching: .any)["number-line-track"].firstMatch
  let number = app.buttons["Number 8"]
  let image = app.screenshot().image.cgImage!
  let scale = CGFloat(image.width) / app.windows.firstMatch.frame.width
  // The selected-number background begins at 86/152 of the track height.
  // This point must still show the ring's lower border, rather than that background.
  let x = number.frame.midX * scale
  let y = (track.frame.minY + track.frame.height * 86.25 / 152.0) * scale
  let sample = image.cropping(to: CGRect(x: floor(x), y: floor(y), width: 1, height: 1))!
  var pixel = [UInt8](repeating: 0, count: 4)
  pixel.withUnsafeMutableBytes { data in
   let context = CGContext(data: data.baseAddress, width: 1, height: 1, bitsPerComponent: 8,
    bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
   context.draw(sample, in: CGRect(x: 0, y: 0, width: 1, height: 1))
  }
  XCTAssertGreaterThan(Int(pixel[1]) - Int(pixel[0]), 40, "The teal marker border stays above the number label")
  XCTAssertGreaterThan(Int(pixel[2]) - Int(pixel[0]), 40, "The marker border remains blue, not the pale label background")
  let shot = XCTAttachment(screenshot: app.screenshot()); shot.name="number-line-complete-marker"; shot.lifetime = .keepAlways; add(shot)
 }
 func testTicksLabelsButtonsScrollingAndLocking() {
  app.activate(); expect("Number line touch check"); expect("Selected 8")
  tapTick(5); expect("Selected 5"); expect("Changes 1")
  XCTAssertTrue(app.buttons["Number 5"].isSelected)
  tapTick(2); expect("Selected 2")
  tapTick(8); expect("Selected 8")
  app.buttons["Number 6"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.67)).tap()
  expect("Selected 6")
  app.buttons["Move one number to the left"].tap(); expect("Selected 5")
  app.buttons["Move one number to the right"].tap(); expect("Selected 6")
  app.buttons["Lock answer"].tap()
  XCTAssertFalse(app.buttons["Number 3"].isEnabled)
  tapTick(3); expect("Selected 6"); expect("Changes 6")
  app.buttons["Wide range"].tap(); expect("Selected 12")
  tapTick(13); expect("Selected 13")
  let track = app.descendants(matching: .any)["number-line-track"].firstMatch
  for _ in 0..<3 { track.swipeRight() }
  expect("Selected 13")
  tapTick(-2); expect("Selected -2"); expect("Changes 2")
  XCTAssertFalse(app.buttons["Move one number to the left"].isEnabled)
  let shot = XCTAttachment(screenshot: app.screenshot()); shot.name="number-line-direct-selection"; shot.lifetime = .keepAlways; add(shot)
 }
}
