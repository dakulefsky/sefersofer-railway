// server/transkribus.ts
// Uses Transkribus V2 Processing API for handwritten Hebrew OCR.

const AUTH_URL = "https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token";
const V2_API_BASE = "https://transkribus.eu/processing/v2/processes";

// ─── Token management ────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const email = process.env.TRANSKRIBUS_EMAIL || process.env.TRANSKRIBUS_USER;
  const password = process.env.TRANSKRIBUS_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing TRANSKRIBUS_EMAIL or TRANSKRIBUS_PASSWORD environment variables.");
  }

  const body = new URLSearchParams({
    grant_type: "password",
    username: email,
    password: password,
    client_id: "transkribus-api-client",
  });

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Transkribus auth failed: ${response.status}`);
  }

  const data = (await response.json()) as any;
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

// ─── Main transcription function (V2 API) ──────────────────────────────────

export async function transcribeAndParse(imageUrl: string): Promise<{
  regions: {
    regionType: string;
    words: {
      wordIndex: number;
      text: string;
      confidence: number;
      isFlagged: boolean;
      isScribble: boolean;
    }[];
  }[];
}> {
  const modelId = parseInt(process.env.TRANSKRIBUS_MODEL_ID || "371705", 10);

  try {
    const token = await getAccessToken();
    console.log("[Transkribus] Starting V2 HTR job for model:", modelId);

    // Step 1: Submit image URL directly to V2 Processing API
    const startResponse = await fetch(V2_API_BASE, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: { modelId: modelId },
        image: { imageUrl: imageUrl }
      })
    });

    if (!startResponse.ok) {
      const text = await startResponse.text();
      throw new Error(`Failed to start job: ${startResponse.status} ${text}`);
    }

    const startData = (await startResponse.json()) as any;
    const processId = startData.processId || startData.id;
    console.log("[Transkribus] V2 Job started, ID:", processId);

    // Step 2: Poll for completion
    const maxWaitMs = 2 * 60 * 1000;
    const deadline = Date.now() + maxWaitMs;
    let isFinished = false;

    while (Date.now() < deadline) {
      const statusRes = await fetch(`${V2_API_BASE}/${processId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      const statusData = (await statusRes.json()) as any;
      console.log("[Transkribus] Job status:", statusData.status);

      // The V2 API usually returns SUCCESS or FINISHED
      if (statusData.status === "FINISHED" || statusData.status === "SUCCESS") {
        isFinished = true;
        break;
      }
      if (statusData.status === "FAILED" || statusData.status === "ERROR") {
        throw new Error(`HTR job failed: ${JSON.stringify(statusData)}`);
      }

      await new Promise((r) => setTimeout(r, 2500));
    }

    if (!isFinished) throw new Error("Transkribus processing timed out after 2 minutes.");

    // Step 3: Get PAGE XML result
    console.log("[Transkribus] Job complete. Fetching PAGE XML...");
    const xmlRes = await fetch(`${V2_API_BASE}/${processId}/page`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!xmlRes.ok) throw new Error(`Failed to fetch XML: ${xmlRes.status}`);
    const xmlContent = await xmlRes.text();

    // Step 4: Parse
    return { regions: parsePageXml(xmlContent) };

  } catch (err: any) {
    console.error("[Transkribus] Error during transcription:", err.message);
    throw err;
  }
}

// ─── Parse PAGE XML format ────────────────────────────────────────────────

function parsePageXml(xmlContent: string) {
  const regions: any[] = [];
  let wordIndex = 0;
  
  const regionRegex = /<TextRegion[^>]*>([\s\S]*?)<\/TextRegion>/g;
  let regionMatch;

  while ((regionMatch = regionRegex.exec(xmlContent)) !== null) {
    const regionContent = regionMatch[1];
    const words: any[] = [];
    
    const wordRegex = /<Word[^>]*>[\s\S]*?<Unicode>([^<]*)<\/Unicode>[\s\S]*?<\/Word>/g;
    let wordMatch;

    while ((wordMatch = wordRegex.exec(regionContent)) !== null) {
      const wordText = wordMatch[1].trim();
      if (wordText) {
        words.push({
          wordIndex: wordIndex++,
          text: wordText,
          confidence: 0.85, 
          isFlagged: false,
          isScribble: false,
        });
      }
    }

    if (words.length > 0) {
      regions.push({ regionType: "main", words });
    }
  }

  if (regions.length === 0) {
    console.warn("[Transkribus] No text regions extracted from PAGE XML");
    regions.push({ regionType: "main", words: [] });
  }

  return regions;
}
