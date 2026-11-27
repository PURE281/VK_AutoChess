# 女武神棋境 · Valkyrie AutoChess

基于《Valkyrie Connect》资源解包的同人自走棋 Web 游戏。React + TypeScript + Vite + Three.js 前端，Node WebSocket 局域网 1v1 联机服务器。

> 仅供学习交流的非商业粉丝作品，素材版权归 Ateam 所有。

## 快速开始

```bash
npm install
npm run dev
```

- 前端：http://127.0.0.1:5173/
- 联机 WebSocket：端口 8787（局域网内自动广播连接地址）

## 游戏模式

- **单机棋境**：与 7 名 AI 指挥官的 8 人自走棋
- **世界树试炼**：20 轮单人长线闯关
- **混沌开局**：全角色卡池实验模式
- **联机对决**：局域网 1v1，同步商店/卡池、神器、符文、准备倒计时、断线重连

## 关于游戏资源（重要）

`public/assets/`（模型 GLB、立绘、图标、音频，约 1.4GB+）**不在版本库中**。这些资源由提取脚本从本地游戏缓存生成：

| 脚本 | 作用 |
|---|---|
| `tools/extract_autochess_data.py` | 生成 `public/data/roster.json` 与图标/立绘 |
| `tools/export_3d_models.py` | 导出角色 GLB 模型（依赖 AssetStudio/FBX2glTF） |
| `tools/export_audio.py` | 导出 BGM/音效（依赖 ffmpeg） |
| `tools/export_voices.py` | 从安卓模拟器缓存导出角色语音 |

如果只需要二次开发游戏逻辑，可以直接从已有部署拷贝 `public/assets/` 与 `public/data/` 到本地即可运行，无需重新提取。

## 验证

```bash
npx tsc --noEmit          # 类型检查
npm run build             # 生产构建
node .verify/engine-test.mjs pve     # 单机引擎回归
node .verify/pvp-server-test.mjs     # 联机服务器回归
node .verify/pvp-browser-test.mjs    # 双浏览器联机端到端
```

更多验证脚本见 `.verify/`（`*-result.json`、截图等产物不入库）。

## 技术要点

- Three.js 棋盘按需懒加载，首屏 gzip 约 85KB
- 生产环境 Service Worker 缓存模型/音频，重复访问秒开
- 连败追赶平衡：连败金币补贴、高品质奖励保底、血量落后补偿、连胜奖励质量衰减
- 战斗回放时间轴驱动模型动画与音效同步

## 部署

- **前端**：push 到 `main` 后 GitHub Actions 自动构建并发布到 GitHub Pages（`https://pure281.github.io/VK_AutoChess/`）。需要在仓库 Settings → Pages 将 Source 设为 **GitHub Actions**。
- **资源**：模型/立绘/音频托管在 Cloudflare R2 公共桶，前端默认从 R2 加载；本地开发如需离线资源，在 `.env.local` 写 `VITE_ASSET_BASE=local`。
- **资源同步**：`python tools/upload_r2.py`（凭据放在 `.env.local`，见 `.env.example`）。
- **联机服务器**：静态托管不包含 WebSocket PVP 服务，联机模式需自行运行 `npm run pvp:server`。

## 公网联机（可选）

GitHub Pages 是纯静态托管，联机 WebSocket 服务器需要自行部署（普通 VPS + nginx 即可）：

1. 服务器上 `git clone` 本仓库并 `npm ci`（`public/data/roster.json` 已入库，无需下载大资源）；
2. 用 systemd 运行 `npx tsx server/pvp-server.ts`（模板：`server/valkyrie-pvp.service.example`），或 `pm2 start npx -- tsx server/pvp-server.ts`；
3. nginx 反代 127.0.0.1:8787 并配置 WebSocket Upgrade 头与 TLS 证书（模板：`server/nginx-pvp.conf.example`）。**必须 wss**：页面是 HTTPS，浏览器会拦截明文 ws://；
4. 在仓库 Settings → Secrets and variables → Actions → **Variables** 添加 `PVP_WS_URL=wss://ws.你的域名`，重新部署即可让前端默认连接该服务器；
5. 也可以不改配置：联机界面里有"服务器地址"输入框，玩家手动填写一次后会记住。

WebSocket 不受浏览器 CORS 限制，无需额外跨域配置。
