export const jwtConfig = {
  accessSecret: process.env.JWT_ACCESS_SECRET || "access-secret",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret",
  accessExpiry: "15m",    // short-lived
  refreshExpiry: "7d",    // long-lived
};
