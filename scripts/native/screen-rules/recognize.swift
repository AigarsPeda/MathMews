// Emit visible lines and normalized top-left image bounds for comparison with AX text.
import Foundation
import Vision
import ImageIO

struct Line: Encodable {
    let text: String
    let box: [Double]
    let confidence: Float
}

let args = CommandLine.arguments
if args.count < 3 { exit(2) }
do {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    let languages = try request.supportedRecognitionLanguages()
    if let language = languages.first(where: { $0.hasPrefix(args[1]) }) {
        request.recognitionLanguages = [language]
    }
    for path in args.dropFirst(2) {
        let handler = VNImageRequestHandler(url: URL(fileURLWithPath: path))
        try handler.perform([request])
        let lines = (request.results ?? []).compactMap { observation -> Line? in
            guard let match = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            return Line(text: match.string, box: [box.minX, 1-box.maxY, box.maxX, 1-box.minY], confidence: match.confidence)
        }
        try JSONEncoder().encode(lines).write(to: URL(fileURLWithPath: path + ".ocr.json"), options: .atomic)
    }
} catch {
    FileHandle.standardError.write(Data("Vision text recognition failed: \(error)\n".utf8))
    exit(1)
}
