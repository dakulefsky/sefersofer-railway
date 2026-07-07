export const ENV = {
  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  
  // JWT
  jwtSecret: process.env.JWT_SECRET ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "", // Alias for backwards compatibility
  
  // Node environment
  isProduction: process.env.NODE_ENV === "production",
  
  // Transkribus (for OCR)
  transkribusUser: process.env.TRANSKRIBUS_USER ?? "",
  transkribusPassword: process.env.TRANSKRIBUS_PASSWORD ?? "",
  transkribusModelId: process.env.TRANSKRIBUS_MODEL_ID ?? "",
  
  // LLM (optional, for context correction)
  llmApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  llmApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  
  // OAuth (deprecated, kept for backwards compatibility)
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  appId: process.env.VITE_APP_ID ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  
  // Forge API (deprecated, aliases for LLM API)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
