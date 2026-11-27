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
