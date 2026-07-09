// server/transkribus.ts
// Uses Transkribus Metagrapho (Processing) API for handwritten Hebrew OCR.

const AUTH_URL = "https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token";
const V1_API_BASE = "https://transkribus.eu/processing/v1/processes";

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
    client_id: "processing-api-client", 
  });

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transkribus auth failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as any;
  
  if (!data.access_token) {
    throw new Error("Auth succeeded but returned no access token: " + JSON.stringify(data));
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

// ─── Security Bypass for Redirects ─────────────────────────────────────────

async function fetchWithAuth(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    },
    // Force Node to stop at the redirect so we can handle it manually
    redirect: "manual"
  };

  let response = await fetch(url, fetchOptions);

  // If Transkribus tries to redirect us (301, 302, 307, 308), we manually follow it
  if (response.status >= 300 && response.status < 400) {
    const redirectUrl = response.headers.get("location");
    if (redirectUrl) {
      console.log(`[Transkribus] API redirected to ${redirectUrl}. Preserving Auth header...`);
      // Re-fire the request to the new URL with the Authorization header intact
      response = await fetch(redirectUrl, fetchOptions);
    }
  }

  return response;
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
  const modelId = parseInt(process.env.TRANSKRIBUS_MODEL_ID || "371705", 10);

  try {
    const token = await getAccessToken();
    console.log("[Transkribus] Starting HTR job for model:", modelId);

    // Using our custom fetchWithAuth to survive server redirects
    const startResponse = await fetchWithAuth(V1_API_BASE, token, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: {
          textRecognition: { htrId: modelId }
        },
        image: {
          imageUrl: imageUrl
        }
      })
    });

    if (!startResponse.ok) {
      const text = await startResponse.text();
      throw new Error(`Failed to start job: ${startResponse.status} ${text}`);
    }

    const startData = (await startResponse.json()) as any;
    const processId = startData.processId || startData.id || startData.process_id;
    
    if (!processId) {
      throw new Error(`Could not find processId in response: ${JSON.stringify(startData)}`);
    }
    
    console.log("[Transkribus] Job started, ID:", processId);

    // Poll for completion
    const maxWaitMs = 2 * 60 * 1000;
    const deadline = Date.now() + maxWaitMs;
    let isFinished = false;

    while (Date.now() < deadline) {
      const statusRes = await fetchWithAuth(`${V1_API_BASE}/${processId}`, token);
      
      const statusData = (await statusRes.json()) as any;
      console.log("[Transkribus] Job status:", statusData.status);

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

    // Get PAGE XML result
    console.log("[Transkribus] Job complete. Fetching PAGE XML...");
    const xmlRes = await fetchWithAuth(`${V1_API_BASE}/${processId}/page`, token);

    if (!xmlRes.ok) throw new Error(`Failed to fetch XML: ${xmlRes.status}`);
    const xmlContent = await xmlRes.text();

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
