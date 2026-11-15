// AVFoundation extraction preserves simulator presentation timestamps; no ffmpeg needed.
import AVFoundation
import AppKit
let args = CommandLine.arguments
let specURL = URL(fileURLWithPath: args[1])
let spec = try JSONSerialization.jsonObject(with: Data(contentsOf: specURL)) as! [String: Any]
let asset = AVURLAsset(url: URL(fileURLWithPath: spec["video"] as! String))
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
// Select the nearest captured frame. RecordVideo is variable-rate, not necessarily 60fps.
generator.requestedTimeToleranceBefore = CMTime(seconds: 1.0/30, preferredTimescale: 60000)
generator.requestedTimeToleranceAfter = CMTime(seconds: 1.0/30, preferredTimescale: 60000)
var results: [[String: Any]] = []
for shot in spec["frames"] as! [[String: Any]] {
  let requested = shot["time"] as! Double
  var actual = CMTime.zero
  do {
    let frame = try generator.copyCGImage(at: CMTime(seconds: requested, preferredTimescale: 60000), actualTime: &actual)
    let crop = shot["crop"] as? [Double]
    let part: CGImage
    if let c = crop { part = frame.cropping(to: CGRect(x: c[0], y: c[1], width: c[2], height: c[3]))! }
    else { part = frame }
    let rep = NSBitmapImageRep(cgImage: part)
    try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: shot["path"] as! String))
    results.append(["path": shot["path"]!, "requested": requested, "actual": CMTimeGetSeconds(actual)])
  } catch { results.append(["path": shot["path"]!, "error": String(describing: error)]) }
}
let track = asset.tracks(withMediaType: .video).first!
let report: [String: Any] = ["duration": CMTimeGetSeconds(asset.duration), "nominalFrameRate": track.nominalFrameRate,
  "width": track.naturalSize.width, "height": track.naturalSize.height, "frames": results]
try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: spec["report"] as! String))
