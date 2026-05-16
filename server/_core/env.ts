export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminInitSecret: process.env.ADMIN_INIT_SECRET ?? "",
  appId: process.env.VITE_APP_ID ?? "baiwen-admin",
  isProduction: process.env.NODE_ENV === "production",
  dashScopeApiKey:process.env.DASHSCOPE_API_KEY ?? "",
};
