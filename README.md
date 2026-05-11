# 🃏 德州扑克计分（Poker Scorer）

一个极简的**线下德州扑克计分/记账工具**。大家真人在桌上玩牌，用这个 App 实时同步筹码、买入、下注、结算。不涉及游戏逻辑，只管算账。

## 特性

- 🎯 **昵称 + 6 位房间号**即可进房，不用注册
- 💰 **初始买入 + 银行随时加注**，完整买入记录可查
- 🃏 **每轮实时显示下注**，所有人看到同样的底池
- 🏆 **支持平分底池**（split pot / 边池场景）
- ↶ **撤销上一步**，手滑了不怕
- 📊 **自动生成最简转账方案**（最小化转账次数的贪心算法）
- 🔄 **实时同步**通过 SSE，自动断线重连
- 💾 **纯内存存储**，房间 6 小时无操作自动销毁
- 🚀 **纯 Serverless**，`git push` 到 Vercel 即部署

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 部署 | Vercel |
| 存储 | Upstash Redis（Vercel Marketplace 一键集成） |
| 实时 | Server-Sent Events (SSE) + Redis 版本轮询 |
| UI | Tailwind CSS |

## 一键部署到 Vercel

### 步骤 1：推到 GitHub
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### 步骤 2：在 Vercel 导入项目
1. 打开 <https://vercel.com/new>
2. 选择你的仓库
3. 框架会自动识别为 Next.js，保持默认配置

### 步骤 3：添加 Upstash Redis（关键！）
1. 项目创建后，进入 **Storage** 标签页
2. 点击 **Create Database** → 选 **Upstash → Redis**
3. 选择免费的 Global 数据库 → 创建
4. 环境变量 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 会自动注入

### 步骤 4：Redeploy
点一下 **Redeploy**，部署完成即可使用。之后 `git push` 就会自动部署。

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置 Upstash Redis
# 访问 https://console.upstash.com 创建免费 Redis 实例
cp .env.example .env.local
# 编辑 .env.local 填入 KV_REST_API_URL 和 KV_REST_API_TOKEN

# 3. 启动
npm run dev
```

打开 <http://localhost:3000>

## 使用流程

1. **房主**：在首页选「创建房间」→ 填昵称、筹码面值（1 筹码 = 多少元）、初始买入 → 进入房间
2. **其他玩家**：首页选「加入房间」→ 输入房号和昵称、初始买入 → 进入
3. 游戏中：
   - 筹码不够了 → 点某人卡片的「+ 买入」从银行拿筹码
   - 开始新一手 → 点顶部「开始新一手」
   - 每个人下注 → 点卡片的「下注」输入金额（可反复加注）
   - 一手结束 → 点「结算本手」勾选赢家，自动分配底池（支持平分）
   - 手滑了 → 点「撤销上一步」
4. **结束**：所有人点「汇总」查看盈亏榜和最简转账清单

## 项目结构

```
app/
├── page.tsx                          # 首页（创建/加入房间）
├── room/[id]/page.tsx                # 房间主页
├── room/[id]/summary/page.tsx        # 汇总结算页
└── api/
    ├── room/create/route.ts          # 创建房间
    ├── room/join/route.ts            # 加入房间
    ├── room/[roomId]/route.ts        # 读取房间状态
    ├── action/route.ts               # 统一操作入口（买入/下注/结算/撤销/...）
    └── subscribe/[roomId]/route.ts   # SSE 实时订阅
components/
├── PlayerCard.tsx                    # 玩家卡片
├── BuyInDialog.tsx                   # 银行买入弹窗
├── BetDialog.tsx                     # 下注弹窗
├── SettleDialog.tsx                  # 结算弹窗
├── HistoryPanel.tsx                  # 历史 / 日志 / 买入记录
└── Dialog.tsx                        # 通用弹窗
lib/
├── types.ts                          # 共享类型
├── redis.ts                          # Upstash Redis 客户端
├── room.ts                           # 房间业务逻辑（核心）
├── settlement.ts                     # 最简转账算法
├── api.ts                            # 前端 API 封装
└── session.ts                        # 本地身份保存
hooks/
└── useRoomStream.ts                  # SSE 订阅 hook
```

## 架构关键点

### 为什么用 SSE 不用 WebSocket？
Vercel 的 Serverless Functions 不支持常驻 WebSocket。SSE 通过 streaming response 天然支持，且自带断线重连，在这个场景下代码量更少、更可靠。

### 实时同步如何实现？
- 任何操作 → `POST /api/action` → 更新 Redis + 递增版本号
- `/api/subscribe/:roomId` 每 800ms 轮询一次版本号，变化时推送最新状态
- 单次 SSE 连接活 55 秒后主动关闭让客户端重连（避免 Vercel 函数超时）

### 并发冲突如何处理？
房间数据作为单个 JSON blob 存在 Redis，操作时用 `SET NX EX 2` 做自旋锁，确保同一房间的操作串行执行。朋友局规模下几乎不会冲突。

### 数据会丢吗？
- Redis key TTL = 6 小时，每次操作续期
- 「内存的就行」需求下这是预期行为，散局后数据自动清理
- 所有操作都有日志（保留最近 50 条），可撤销、可追溯

## 免责声明
本工具**只计分，不打牌**。请遵守当地法律法规，朋友间娱乐为主。

## License
MIT
