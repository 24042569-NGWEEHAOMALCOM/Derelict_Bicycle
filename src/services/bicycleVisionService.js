import { getGenerativeModel, Schema } from "firebase/ai";
import { ai } from "../firebase/firebase";

export const BICYCLE_VISION_MODEL =
  import.meta.env.VITE_FIREBASE_AI_MODEL || "gemini-3.5-flash";

const verdicts = ["likely_same", "uncertain", "likely_different"];
const responseSchema = Schema.object({
  properties: {
    verdict: Schema.string(),
    matchingFeatures: Schema.array({ items: Schema.string() }),
    conflictingFeatures: Schema.array({ items: Schema.string() }),
    imageQualityIssues: Schema.array({ items: Schema.string() }),
  },
});

const model = getGenerativeModel(ai, {
  model: BICYCLE_VISION_MODEL,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema,
    temperature: 0.1,
  },
});

async function imageUrlToPart(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not download a bicycle image.");

  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return {
    inlineData: {
      data: dataUrl.split(",")[1],
      mimeType: blob.type || "image/jpeg",
    },
  };
}

const cleanList = (value) =>
  Array.isArray(value) ? value.map(String).slice(0, 8) : [];

export async function compareBicycleImages(firstUrl, secondUrl) {
  const images = await Promise.all([
    imageUrlToPart(firstUrl),
    imageUrlToPart(secondUrl),
  ]);

  const prompt = `Compare the bicycles in these two images. Ignore the background,
lighting and camera angle. Compare the frame, colour, wheels, seat, basket,
locks, stickers, rust, scratches, damage and accessories. Return likely_same
only when several distinctive details match, likely_different for clear
conflicts, or uncertain when the images do not show enough detail.`;

  const result = await model.generateContent([prompt, ...images]);
  const comparison = JSON.parse(result.response.text());

  return {
    verdict: verdicts.includes(comparison.verdict)
      ? comparison.verdict
      : "uncertain",
    matchingFeatures: cleanList(comparison.matchingFeatures),
    conflictingFeatures: cleanList(comparison.conflictingFeatures),
    imageQualityIssues: cleanList(comparison.imageQualityIssues),
  };
}
