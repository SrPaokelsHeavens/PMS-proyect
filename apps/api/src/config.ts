export const config = {
  port: Number(process.env.API_PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-before-production",
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:5173"
};

if (process.env.NODE_ENV === "production" && config.jwtSecret.includes("development")) {
  throw new Error("JWT_SECRET must be set to a strong secret in production.");
}
