/**
 * Replicate Demucs integration for real stem separation.
 * Demucs splits audio into 4 stems: vocals, drums, bass, other.
 *
 * Get a free API key at https://replicate.com
 * Add it to your .env file as REPLICATE_API_KEY=r8_...
 */

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// Demucs model on Replicate (htdemucs — best quality 4-stem model)
const DEMUCS_VERSION =
  "25a173108cff36ef9f80f854c162d01df9e6528dc9f23d2c2aacedc3bf17f9d7";

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

/**
 * Start a Demucs separation job on Replicate.
 * Returns the prediction ID to poll later.
 */
export async function startSeparationJob(audioUrl: string): Promise<string> {
  const response = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: DEMUCS_VERSION,
      input: {
        audio: audioUrl,
        model: "htdemucs",
        stem: null, // separate all stems
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

/**
 * Poll Replicate for the status of a prediction.
 */
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

/**
 * Map Replicate status → our app status.
 */
export function mapReplicateStatus(
  status: ReplicatePrediction["status"]
): "processing" | "completed" | "failed" {
  switch (status) {
    case "succeeded":
      return "completed";
    case "failed":
    case "canceled":
      return "failed";
    default:
      return "processing";
  }
}

/**
 * Estimate progress % based on Replicate status.
 * Replicate doesn't give a real progress value so we fake a range.
 */
export function estimateProgress(
  status: ReplicatePrediction["status"],
  startedAt: number
): number {
  if (status === "succeeded") return 100;
  if (status === "failed" || status === "canceled") return 0;

  const elapsedMs = Date.now() - startedAt;
  // Demucs typically takes 30–90s. Cap fake progress at 90%.
  const estimated = Math.min(90, Math.round((elapsedMs / 90000) * 90));
  return Math.max(5, estimated);
}