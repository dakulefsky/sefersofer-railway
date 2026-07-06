// server/transkribus.ts
// Uses Transkribus Legacy API for handwritten Hebrew OCR.
//
// SETUP:
//   1. Sign up at transkribus.org
//   2. Add to your .env:
//        TRANSKRIBUS_USER=your@email.com
//        TRANSKRIBUS_PASSWORD=yourpassword
//        TRANSKRIBUS_MODEL_ID=371705

const AUTH_URL = "https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token";
const LEGACY_API_BASE = "https://transkribus.eu/TrpServer/rest";

// ─── Token management ────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    console.log("[Transkribus] Using cached token");
    return cachedToken;
  }

  const email = process.env.TRANSKRIBUS_EMAIL || process.env.TRANSKRIBUS_USER;
  const password = process.env.TRANSKRIBUS_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing TRANSKRIBUS_EMAIL/TRANSKRIBUS_USER or TRANSKRIBUS_PASSWORD environment variables."
    );
  }

  console.log("[Transkribus] Fetching new access token...");

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
    const text = await response.text();
    console.error("[Transkribus] Auth failed:", response.status, text);
    throw new Error(`Transkribus auth failed: ${response.status} — ${text}`);
  }

  const data = (await response.json()) as any;
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;

  console.log("[Transkribus] Token obtained successfully, expires in:", data.expires_in, "seconds");

  return cachedToken!;
}

// ─── Get user collections ──────────────────────────────────────────────────

async function getUserCollections(): Promise<any[]> {
  const token = await getAccessToken();

  console.log("[Transkribus] Fetching user collections...");

  const response = await fetch(`${LEGACY_API_BASE}/collections`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[Transkribus] Failed to get collections:", response.status);
    throw new Error(`Failed to get collections: ${response.status}`);
  }

  const data = (await response.json()) as any;
  console.log("[Transkribus] Collections API response (first 500 chars):", JSON.stringify(data).substring(0, 500));
  console.log("[Transkribus] Response keys:", Object.keys(data));
  
  // Try different response formats
  const collections = data.collections || data.colls || data.list || (Array.isArray(data) ? data : []);
  console.log("[Transkribus] Found", Array.isArray(collections) ? collections.length : 0, "collections");
  
  return Array.isArray(collections) ? collections : [];
}

// ─── Upload image to collection ────────────────────────────────────────────

async function uploadImageToCollection(
  collectionId: string,
  imageUrl: string,
  fileName: string
): Promise<string> {
  const token = await getAccessToken();

  console.log("[Transkribus] Uploading image to collection:", collectionId);

  // Fetch the image from the URL
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const mimeType = imageResponse.headers.get('content-type') ?? 'application/octet-stream';

  // Use built-in FormData - let fetch handle multipart framing
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: mimeType });
  
  // Try 'file' field with fileName parameter
  formData.append('file', blob, fileName);
  formData.append('fileName', fileName);

  console.log("[Transkribus] Uploading with field name 'file' and fileName param, mime type:", mimeType);

  let response = await fetch(`${LEGACY_API_BASE}/collections/${collectionId}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  // If 415, try with 'files' field instead
  if (response.status === 415) {
    console.log("[Transkribus] Got 415 with 'file' field, retrying with 'files'...");
    const formData2 = new FormData();
    formData2.append('files', blob, fileName);
    response = await fetch(`${LEGACY_API_BASE}/collections/${collectionId}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData2,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[Transkribus] Upload failed:", response.status, text);
    throw new Error(`Upload failed: ${response.status}. Response: ${text}`);
  }

  const data = (await response.json()) as any;
  return data.docId || data.id;
}


// ─── Run HTR on a document page ────────────────────────────────────────────

async function runHTROnPage(
  collectionId: string,
  docId: string,
  pageNr: number,
  modelId: string
): Promise<string> {
  const token = await getAccessToken();

  console.log(
    "[Transkribus] Running HTR on page",
    pageNr,
    "with model",
    modelId,
    "in collection",
    collectionId
  );

  const response = await fetch(
    `${LEGACY_API_BASE}/collections/${collectionId}/${docId}/pages/${pageNr}/recognition/htr?modelId=${modelId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("[Transkribus] HTR request failed:", response.status, text);
    throw new Error(`HTR request failed: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return data.jobId || data.id;
}

// ─── Poll job status ──────────────────────────────────────────────────────

async function getJobStatus(jobId: string): Promise<any> {
  const token = await getAccessToken();

  const response = await fetch(`${LEGACY_API_BASE}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.status}`);
  }

  return await response.json();
}

// ─── Get page XML (transcription result) ────────────────────────────────────

async function getPageXml(collectionId: string, docId: string, pageNr: number): Promise<string> {
  const token = await getAccessToken();

  const response = await fetch(
    `${LEGACY_API_BASE}/collections/${collectionId}/${docId}/pages/${pageNr}/xml`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get page XML: ${response.status}`);
  }

  return await response.text();
}

// ─── Main transcription function ───────────────────────────────────────────

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
  const modelId = process.env.TRANSKRIBUS_MODEL_ID || "371705";

  try {
    // Step 1: Use hardcoded collection ID
    const collectionId = "2449075";
    console.log("[Transkribus] Using collection:", collectionId);

    // Step 2: Upload image
    const fileName = `temp_${Date.now()}.jpg`;
    const docId = await uploadImageToCollection(collectionId, imageUrl, fileName);
    console.log("[Transkribus] Document created:", docId);

    // Step 3: Run HTR
    const jobId = await runHTROnPage(collectionId, docId, 1, modelId);
    console.log("[Transkribus] HTR job started:", jobId);

    // Step 4: Poll for completion (max 2 minutes)
    const maxWaitMs = 2 * 60 * 1000;
    const pollIntervalMs = 2000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const jobStatus = await getJobStatus(jobId);
      console.log("[Transkribus] Job status:", jobStatus.status);

      if (jobStatus.status === "FINISHED") {
        console.log("[Transkribus] HTR completed successfully");
        break;
      }

      if (jobStatus.status === "FAILED") {
        throw new Error(`HTR job failed: ${jobStatus.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Step 5: Get the result XML
    const xmlContent = await getPageXml(collectionId, docId, 1);
    console.log("[Transkribus] Retrieved page XML, length:", xmlContent.length);

    // Step 6: Parse PAGE XML to extract words
    const regions = parsePageXml(xmlContent);

    return { regions };
  } catch (err: any) {
    console.error("[Transkribus] Error during transcription:", err.message);
    throw err;
  }
}

// ─── Parse PAGE XML format ────────────────────────────────────────────────

function parsePageXml(xmlContent: string): {
  regionType: string;
  words: {
    wordIndex: number;
    text: string;
    confidence: number;
    isFlagged: boolean;
    isScribble: boolean;
  }[];
}[] {
  // Simple XML parsing for PAGE format
  // PAGE XML contains <TextRegion> elements with <TextLine> elements containing <Word> elements

  const regions: any[] = [];
  let wordIndex = 0;

  // Extract all text regions
  const regionRegex = /<TextRegion[^>]*>([\s\S]*?)<\/TextRegion>/g;
  let regionMatch;

  while ((regionMatch = regionRegex.exec(xmlContent)) !== null) {
    const regionContent = regionMatch[1];
    const words: any[] = [];

    // Extract words from this region
    const wordRegex = /<Word[^>]*>[\s\S]*?<Unicode>([^<]*)<\/Unicode>[\s\S]*?<\/Word>/g;
    let wordMatch;

    while ((wordMatch = wordRegex.exec(regionContent)) !== null) {
      const wordText = wordMatch[1].trim();
      if (wordText) {
        words.push({
          wordIndex: wordIndex++,
          text: wordText,
          confidence: 0.85, // Transkribus doesn't always provide confidence, use reasonable default
          isFlagged: false,
          isScribble: false,
        });
      }
    }

    if (words.length > 0) {
      regions.push({
        regionType: "main",
        words,
      });
    }
  }

  // If no regions found, return empty
  if (regions.length === 0) {
    console.warn("[Transkribus] No text regions extracted from PAGE XML");
    regions.push({
      regionType: "main",
      words: [],
    });
  }

  return regions;
}
