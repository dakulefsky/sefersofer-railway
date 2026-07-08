// server/transkribus.ts
// TEMPORARY MOCK: Transkribus's live endpoints (both Legacy and V2) are currently 
// throwing 404s due to their active server migration. This mock allows frontend 
// and database development to continue unblocked.

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
  console.log("[Transkribus Mock] Bypassing broken external API...");
  console.log("[Transkribus Mock] Pretending to process image URL:", imageUrl);

  // Simulate a 2-second network delay so your frontend loading state works
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("[Transkribus Mock] Returning simulated OCR data.");

  // Return realistic mocked data based on your database schema
  return {
    regions: [
      {
        regionType: "main",
        words: [
          { wordIndex: 0, text: "בְּרֵאשִׁ֖ית", confidence: 95, isFlagged: false, isScribble: false },
          { wordIndex: 1, text: "בָּרָ֣א", confidence: 92, isFlagged: false, isScribble: false },
          { wordIndex: 2, text: "אֱלֹהִ֑ים", confidence: 88, isFlagged: true, isScribble: false }, // Flagged for UI testing
          { wordIndex: 3, text: "אֵ֥ת", confidence: 99, isFlagged: false, isScribble: false },
          { wordIndex: 4, text: "הַשָּׁמַ֖יִם", confidence: 91, isFlagged: false, isScribble: false },
          { wordIndex: 5, text: "וְאֵ֥ת", confidence: 97, isFlagged: false, isScribble: false },
          { wordIndex: 6, text: "הָאָֽרֶץ", confidence: 85, isFlagged: false, isScribble: false },
        ],
      },
      {
        regionType: "margin_right",
        words: [
          { wordIndex: 7, text: "פירוש", confidence: 70, isFlagged: false, isScribble: false },
          { wordIndex: 8, text: "[scribble]", confidence: 40, isFlagged: false, isScribble: true },
        ],
      }
    ],
  };
}
