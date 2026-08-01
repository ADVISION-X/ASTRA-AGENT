import AppKit
import Foundation
import Vision

struct Observation: Codable {
  let faceCount: Int
  let readableTexts: [String]
  let classifications: [String]
}

guard CommandLine.arguments.count == 2,
      let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  fputs("IMAGE_DECODE_FAILED\n", stderr)
  exit(2)
}

let faces = VNDetectFaceRectanglesRequest()
let text = VNRecognizeTextRequest()
let classification = VNClassifyImageRequest()
text.recognitionLevel = .accurate
text.usesLanguageCorrection = true

do {
  try VNImageRequestHandler(cgImage: cgImage).perform([faces, text, classification])
  let readableTexts = (text.results ?? []).compactMap { observation in
    observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
  }.filter { !$0.isEmpty }
  let result = Observation(
    faceCount: faces.results?.count ?? 0,
    readableTexts: readableTexts,
    classifications: (classification.results ?? [])
      .filter { $0.confidence >= 0.2 }
      .prefix(20)
      .map { $0.identifier }
  )
  let data = try JSONEncoder().encode(result)
  print(String(data: data, encoding: .utf8)!)
} catch {
  fputs("VISION_ANALYSIS_FAILED:\(error.localizedDescription)\n", stderr)
  exit(3)
}
