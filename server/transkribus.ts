// server/transkribus.ts
// Replaces llm.ts — uses Transkribus metagrapho API for handwritten Hebrew OCR.
//
// SETUP:
//   1. Sign up at transkribus.org (Organisation plan needed for API access)
//   2. Add to your .env:
//        TRANSKRIBUS_EMAIL=your@email.com
//        TRANSKRIBUS_PASSWORD=yourpassword
//        TRANSKRIBUS_MODEL_ID=       ← see model IDs below
//
// HEBREW MODEL IDs (pick one):
//   Hebrew square script (most common Talmud/Gemara hand): look up on
//   https://www.transkribus.org/hebrew-manuscript-transcription
//   The community models page lists IDs for:
//     - DiJeSt (Hebrew/Yiddish printed)
//     - IGRA Sfardi (Sephardic semi-cursive)
//     - The Dybbuk (Yiddish handwriting)
//   Start with the one closest to your manuscript's script style.
//   You can train your own model later using corrected pages from this app.

const AUTH_URL =
  "https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token";
const PROCESS_URL = "https://transkribus.eu/processing/v2/processes";

// ─── Token management ────────────────────────────────────────────────────────
// Transkribus tokens expire — cache and refresh automatically.

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const email = process.env.TRANSKRIBUS_EMAIL || process.env.TRANSKRIBUS_USER;
  const password = process.env.TRANSKRIBUS_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing TRANSKRIBUS_EMAIL/TRANSKRIBUS_USER or TRANSKRIBUS_PASSWORD environment variables. " +
      "Sign up at transkribus.org and add your credentials to .env"
    );
  }

  const body = new URLSearchParams({
    grant_type: "password",
    username: email,
    password: password,
    client_id: "processing-api-client",
  });

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transkribus auth failed: ${response.status} — ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // expires_in is in seconds
  tokenExpiresAt = now + data.expires_in * 1000;

  return cachedToken!;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranskribusWord {
  text: string;
  confidence: number; // 0.0–1.0
}

export interface TranskribusLine {
  text: string;
  confidence: number;
  words: TranskribusWord[];
  // Bounding box as percentage of image dimensions (0–100)
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface TranskribusRegion {
  id: string;
  // Transkribus region types we map to our own RegionType
  type: string; // "paragraph", "marginalia", "footnote", "heading", etc.
  lines: TranskribusLine[];
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface TranskribusResult {
  status: "FINISHED" | "FAILED" | "CREATED" | "RUNNING";
  content?: {
    text: string;
    regions: TranskribusRegion[];
  };
}

// ─── Region type mapping ─────────────────────────────────────────────────────
// Map Transkribus region types → our internal RegionType enum

type RegionType = "main" | "margin_right" | "margin_left" | "margin_top" | "margin_bottom" | "interlinear";

function mapRegionType(trankribusType: string): RegionType {
  const t = trankribusType.toLowerCase();
  if (t.includes("margin")) return "margin_right"; // refine per page if needed
  if (t.includes("footnote") || t.includes("bottom")) return "margin_bottom";
  if (t.includes("heading") || t.includes("header")) return "margin_top";
  if (t.includes("interline") || t.includes("insertion")) return "interlinear";
  return "main";
}

// ─── Submit a page for HTR ───────────────────────────────────────────────────

/**
 * Submit a manuscript page image URL to Transkribus for HTR.
 * Returns a processId — poll getProcessResult() until status is FINISHED.
 *
 * imageUrl must be publicly accessible (use Supabase Storage public URL or
 * a signed URL with sufficient lifetime).
 */
export async function submitPageForTranscription(imageUrl: string): Promise<string> {
  const modelId = process.env.TRANSKRIBUS_MODEL_ID;
  if (!modelId) {
    throw new Error(
      "Missing TRANSKRIBUS_MODEL_ID in .env. " +
      "Find your model ID at transkribus.org/hebrew-manuscript-transcription"
    );
  }

  const token = await getAccessToken();

  const response = await fetch(PROCESS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        modelId: parseInt(modelId, 10),
        // Request word-level segmentation and confidence scores
        lineDetection: true,
        wordSegmentation: true,
      },
      image: { imageUrl },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transkribus submit failed: ${response.status} — ${text}`);
  }

  const data = await response.json();
  return data.processId as string;
}

// ─── Poll for result ──────────────────────────────────────────────────────────

/**
 * Get the current status/result of a submitted process.
 * Keep polling every few seconds until status === "FINISHED".
 */
export async function getProcessResult(processId: string): Promise<TranskribusResult> {
  const token = await getAccessToken();

  const response = await fetch(`${PROCESS_URL}/${processId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transkribus poll failed: ${response.status} — ${text}`);
  }

  return (await response.json()) as TranskribusResult;
}

// ─── Wait for completion ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000; // poll every 3 seconds
const MAX_WAIT_MS = 5 * 60 * 1000; // give up after 5 minutes

/**
 * Submit an image and wait until Transkribus finishes processing it.
 * Returns the parsed result ready to save to your database.
 */
export async function transcribePage(imageUrl: string): Promise<TranskribusResult> {
  const processId = await submitPageForTranscription(imageUrl);

  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const result = await getProcessResult(processId);

    if (result.status === "FINISHED") return result;
    if (result.status === "FAILED") {
      throw new Error(`Transkribus HTR failed for process ${processId}`);
    }

    // CREATED or RUNNING — keep polling
  }

  throw new Error(
    `Transkribus timed out after ${MAX_WAIT_MS / 1000}s for process ${processId}`
  );
}

// ─── Convert result → your saveOcrResult input format ───────────────────────

/**
 * Convert a finished Transkribus result into the shape that
 * routers.ts → pages.saveOcrResult expects.
 *
 * This is what you pass to trpc.pages.saveOcrResult.mutate().
 */
export function parseTranskribusResult(result: TranskribusResult): {
  regions: {
    regionType: RegionType;
    anchorWordIndex?: number;
    bbox?: { x: number; y: number; w: number; h: number };
    words: {
      wordIndex: number;
      text: string;
      confidence: number;
      isFlagged: boolean;
      isScribble: boolean;
    }[];
  }[];
} {
  if (!result.content) return { regions: [] };

  let globalWordIndex = 0;

  const regions = result.content.regions.map((region) => {
    const regionType = mapRegionType(region.type);

    // Flatten all lines → words
    const words: {
      wordIndex: number;
      text: string;
      confidence: number;
      isFlagged: boolean;
      isScribble: boolean;
    }[] = [];

    for (const line of region.lines) {
      if (line.words && line.words.length > 0) {
        // Word-level data available
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text) continue;

          const confidence = word.confidence ?? line.confidence ?? 0;
          words.push({
            wordIndex: globalWordIndex++,
            text,
            confidence,
            // Flag anything below 75% confidence for human review
            isFlagged: confidence < 0.75,
            // Transkribus sometimes returns "[unclear]" or similar markers
            isScribble: text === "[unclear]" || text === "[illegible]" || text === "***",
          });
        }
      } else {
        // Line-level only — split on spaces
        const lineWords = line.text.trim().split(/\s+/).filter(Boolean);
        for (const w of lineWords) {
          words.push({
            wordIndex: globalWordIndex++,
            text: w,
            confidence: line.confidence ?? 0.5,
            isFlagged: (line.confidence ?? 0.5) < 0.75,
            isScribble: w === "[unclear]" || w === "[illegible]",
          });
        }
      }
    }

    return {
      regionType,
      bbox: region.bbox,
      words,
    };
  });

  return { regions };
}

// ─── Full pipeline helper ─────────────────────────────────────────────────────

/**
 * One-call convenience: transcribe an image and return the parsed regions.
 * Use this in your pages.transcribe tRPC mutation.
 *
 * Example usage in routers.ts:
 *
 *   const result = await transcribeAndParse(page.imageUrl);
 *   // result.regions is ready to pass to saveOcrResult
 */
export async function transcribeAndParse(imageUrl: string) {
  const result = await transcribePage(imageUrl);
  return parseTranskribusResult(result);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
