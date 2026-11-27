import XCTest

final class NativeLaunchTests: XCTestCase {
 func testHomeReady() {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  if springboard.buttons["Open"].waitForExistence(timeout: 2) { springboard.buttons["Open"].tap() }
  let ready = app.buttons.matching(NSPredicate(format: "label == 'Open settings' OR label == 'Atvērt iestatījumus'")).firstMatch
  XCTAssertTrue(ready.waitForExistence(timeout: 60))
 }
}
final class NativeDragTests: XCTestCase {
 func testA11y() throws { try audit(limit: 86) }
 func testA11ySmoke() throws { try audit(limit: 3) }
 private func audit(limit: Int) throws {
  let app = XCUIApplication(bundleIdentifier: "com.mathmews.app"); app.activate()
  let marker = app.staticTexts["audit-variant"], next = app.buttons["audit-next"]
  XCTAssertTrue(marker.waitForExistence(timeout: 60))
  var rows = [[String: Any]]()
  func frame(_ r: CGRect) -> [String: Double] { ["x":r.minX,"y":r.minY,"width":r.width,"height":r.height] }
  for index in 0..<limit {
   let variant = marker.label
   var controls = [[String: Any]](), failures = [[String: Any]]()
   var seen = Set<String>()
   func collect(_ phase: String) {
    let all = app.buttons.allElementsBoundByIndex + app.sliders.allElementsBoundByIndex + app.steppers.allElementsBoundByIndex + app.pickerWheels.allElementsBoundByIndex
    let active: [(String, CGRect)] = all.compactMap { e in
     guard e.identifier != "audit-next", e.isEnabled, e.isHittable else { return nil }
     let r = e.frame
     guard r.width > 0 && r.height > 0 else { return nil }
     return (e.identifier.isEmpty ? e.label : e.identifier, r)
    }
    for (i, control) in active.enumerated() {
     let (name, r) = control
     let key = "\(name)|\(r)"
     if seen.insert(key).inserted {
      controls.append(["element":name,"phase":phase,"frame":frame(r)])
      if r.width < 44 || r.height < 44 { failures.append(["type":"small-target","element":name,"phase":phase,"frame":frame(r)]) }
     }
     for other in active.dropFirst(i + 1) {
      let intersection = r.intersection(other.1)
      if !intersection.isNull && intersection.width > 0.5 && intersection.height > 0.5 {
       failures.append(["type":"overlap","element":name,"other":other.0,"phase":phase,"intersection":frame(intersection)])
      }
     }
    }
   }
   collect("top")
   let scroll = app.scrollViews.firstMatch
   var clearance: Double? = nil
   var scrollEndVerified = false
   if scroll.exists {
    let tracker = scroll.staticTexts.allElementsBoundByIndex.last ?? scroll.buttons.allElementsBoundByIndex.last
    var previous = tracker?.frame
    var stable = 0
    for step in 1...12 {
     scroll.swipeUp(velocity: .fast); collect("scroll-\(step)")
     if let current = tracker?.frame, let prior = previous {
      stable = abs(current.minY - prior.minY) < 0.5 ? stable + 1 : 0
      previous = current
      if stable >= 2 { scrollEndVerified = true; break }
     }
    }
    let viewport = scroll.frame
    let elements = scroll.buttons.allElementsBoundByIndex + scroll.staticTexts.allElementsBoundByIndex
    let bottoms = elements.compactMap { e -> Double? in
     let r = e.frame
     return r.width > 0 && r.height > 0 && r.minY < viewport.maxY && r.maxY > viewport.minY ? r.maxY : nil
    }
    if let last = bottoms.max() {
     clearance = viewport.maxY - last
     if clearance! < 19.5 { failures.append(["type":"clearance","element":"last visible accessible content","points":clearance!]) }
    }
   }
   let row: [String: Any] = ["variant":variant,"controls":controls,"failures":failures,"clearance":clearance as Any? ?? NSNull(),"scrollEndVerified":scrollEndVerified]
   rows.append(row)
   let partial = XCTAttachment(data: try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys]), uniformTypeIdentifier: "public.json")
   partial.name = "puzzle-a11y-\(variant).json"; partial.lifetime = .keepAlways; add(partial)
   if index + 1 < limit {
    next.tap()
    let changed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label != %@", variant), object: marker)
    guard XCTWaiter.wait(for: [changed], timeout: 10) == .completed else { XCTFail("Variant did not advance from \(variant)"); return }
   }
  }
  let data = try JSONSerialization.data(withJSONObject: rows, options: [.prettyPrinted, .sortedKeys])
  let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
  attachment.name = "puzzle-a11y.json"; attachment.lifetime = .keepAlways; add(attachment)
  XCTAssertEqual(rows.count, limit)
  let failures = rows.reduce(0) { $0 + (($1["failures"] as? [[String: Any]])?.count ?? 0) }
  XCTAssertEqual(failures, 0, "See puzzle-a11y.json attachment for target, overlap, and clearance failures")
 }
}
