/**
 * Replicate Demucs integration for real stem separation.
 * Demucs splits audio into 4 stems: vocals, drums, bass, other.
 *
 * Get a free API key at https://replicate.com
 * Add it to your .env file as REPLICATE_API_KEY=r8_...
 */

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const DEMUCS_MODEL = "cjwbw/demucs";

export interface ReplicateOutput {
  bass: string;
  drums: string;
  other: string;
  vocals: string;
}

export interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: ReplicateOutput | null;
  error: string | null;
}

function getApiKey(): string {
  const key = process.env.REPLICATE_API_KEY;
  if (!key) throw new Error("REPLICATE_API_KEY is not set in your .env file");
  return key;
}

export async function startSeparationJob(audioUrl: string): Promise<string> {
  const response = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEMUCS_MODEL,
      input: {
        audio: audioUrl,
        model: "htdemucs",
        stem: null,
        int24: false,
        float32: false,
        output_format: "mp3",
        jobs: 0,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction: ReplicatePrediction = await response.json();
  return prediction.id;
}

export async function getPredictionStatus(
  predictionId: string
): Promise<ReplicatePrediction> {
  const response = await fetch(
    `${REPLICATE_API_URL}/${predictionId}`,
    {
      headers: {
        Authorization: `Token ${getApiKey()}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate poll error: ${error}`);
  }

  return response.json();
}

export function mapReplicateStatus(
  status: ReplicatePrediction["status"]
): "processing" | "completed" | "failed" {
  switch (status) {
    case "succeeded": return "completed";
    case "failed":
    case "canceled": return "failed";
    default: return "processing";
  }
}

export function estimateProgress(
  status: ReplicatePrediction["status"],
  startedAt: number
): number {
  if (status === "succeeded") return 100;
  if (status === "failed" || status === "canceled") return 0;
  const elapsedMs = Date.now() - startedAt;
  return Math.max(5, Math.min(90, Math.round((elapsedMs / 90000) * 90)));
}