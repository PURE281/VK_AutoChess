// pm2 entry point. Kept as plain .js so pm2 does not try to inject ts-node;
// TypeScript handling is done by `node --import tsx` (see ecosystem.config.cjs).
import("./pvp-server.ts");
