import { getGenerativeModel, Schema } from "firebase/ai";
import { ai } from "../firebase/firebase";

export const BICYCLE_VISION_MODEL =
  import.meta.env.VITE_FIREBASE_AI_MODEL || "gemini-3.5-flash";

const validVerdicts = new Set([
  "likely_same",
  "uncertain",
  "likely_different",
]);

const comparisonSchema = Schema.object({
  properties: {
    verdict: Schema.string(),
    matchingFeatures: Schema.array({ items: Schema.string() }),
    conflictingFeatures: Schema.array({ items: Schema.string() }),
    imageQualityIssues: Schema.array({ items: Schema.string() }),
  },
});

const comparisonModel = getGenerativeModel(ai, {
  model: BICYCLE_VISION_MODEL,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: comparisonSchema,
    temperature: 0.1,
  },
});

const blobToGenerativePart = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const encodedImage = String(reader.result || "").split(",")[1];

      if (!encodedImage) {
        reject(new Error("The bicycle image could not be encoded."));
        return;
      }

      resolve({
        inlineData: {
          data: encodedImage,
          mimeType: blob.type || "image/jpeg",
        },
      });
    };
    reader.onerror = () => reject(new Error("The bicycle image could not be read."));
    reader.readAsDataURL(blob);
  });

const imageUrlToGenerativePart = async (imageUrl) => {
  const response = await fetch(imageUrl, { mode: "cors" });

  if (!response.ok) {
    throw new Error(`Could not download a bicycle image (${response.status}).`);
  }

  const imageBlob = await response.blob();

  if (!imageBlob.type.startsWith("image/")) {
    throw new Error("A report image URL did not return an image.");
  }

  return blobToGenerativePart(imageBlob);
};

const normalizeFeatureList = (features) =>
  (Array.isArray(features) ? features : [])
    .filter((feature) => typeof feature === "string" && feature.trim())
    .slice(0, 8)
    .map((feature) => feature.trim().slice(0, 240));

export async function compareBicycleImages(referenceImageUrl, candidateImageUrl) {
  if (!referenceImageUrl || !candidateImageUrl) {
    throw new Error("Two bicycle images are required for comparison.");
  }

  const [referenceImage, candidateImage] = await Promise.all([
    imageUrlToGenerativePart(referenceImageUrl),
    imageUrlToGenerativePart(candidateImageUrl),
  ]);

  const prompt = `
The first image is Bicycle A and the second image is Bicycle B.
Determine whether they likely show the same individual bicycle.

Compare only visible, intrinsic details of the bicycles: frame geometry, paint
and colour patterns, wheels, tyres, seat, basket, racks, locks, stickers,
licence markings, rust, scratches, dents, missing parts, and accessories.
Do not treat the background, location, camera angle, image quality, or lighting
as evidence that the bicycles are the same.

Use "likely_same" only when multiple distinctive features agree and no major
visible feature conflicts. Use "likely_different" when identifying features
clearly conflict. Use "uncertain" whenever the photographs do not expose enough
comparable detail. Never claim certainty about details that are not visible.
`;

  const result = await comparisonModel.generateContent([
    prompt,
    referenceImage,
    candidateImage,
  ]);
  const responseText = result.response.text();

  let comparison;

  try {
    comparison = JSON.parse(responseText);
  } catch {
    throw new Error("The image comparison returned an invalid response.");
  }

  return {
    verdict: validVerdicts.has(comparison.verdict)
      ? comparison.verdict
      : "uncertain",
    matchingFeatures: normalizeFeatureList(comparison.matchingFeatures),
    conflictingFeatures: normalizeFeatureList(comparison.conflictingFeatures),
    imageQualityIssues: normalizeFeatureList(comparison.imageQualityIssues),
  };
}
