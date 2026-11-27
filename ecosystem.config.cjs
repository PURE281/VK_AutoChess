// pm2 process config for the PVP WebSocket server.
// Usage:  pm2 start ecosystem.config.cjs && pm2 save
// Requires Node.js >= 20 (uses `node --import tsx` to run TypeScript directly,
// no npm wrapper process, so pm2 stop/restart signals reach the server itself).
module.exports = {
  apps: [
    {
      name: "valkyrie-pvp",
      script: "server/pvp-server.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      // Resolve to whatever directory this file lives in, so the config works
      // no matter where the repo is cloned (/var/www, /opt, home dir, ...).
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PVP_PORT: "8787",
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
