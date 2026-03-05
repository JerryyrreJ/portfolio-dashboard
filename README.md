# Portfolio Dashboard 📈

一个功能丰富的股票投资组合管理仪表板，支持实时股价追踪、持仓分析和交易记录管理。

## ✨ 特性

- 📊 **实时股价追踪** - 集成 Finnhub API，获取实时股票报价
- 📈 **股票详情页** - 详细的个股分析，包括价格走势图表、持仓统计
- 📝 **交易记录管理** - 记录买入/卖出交易，支持删除操作
- 🎯 **投资组合概览** - 按市场分组展示持仓，实时计算盈亏
- 📱 **响应式设计** - 现代化的 UI 界面，支持各种屏幕尺寸

## 🛠️ 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite + Prisma ORM
- **图表**: Recharts
- **API**: Finnhub (股票数据)

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone <repository-url>
cd portfolio-dashboard
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
DATABASE_URL=file:./prisma/dev.db
FINNHUB_API_KEY=your_finnhub_api_key_here
```

获取 Finnhub API Key: https://finnhub.io/

### 4. 初始化数据库

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 📁 项目结构

```
portfolio-dashboard/
├── prisma/                 # Prisma schema 和迁移
│   ├── schema.prisma
│   └── dev.db
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── api/          # API 路由
│   │   │   ├── assets/
│   │   │   └── transactions/
│   │   ├── components/   # 组件
│   │   ├── stock/[ticker]/  # 股票详情页
│   │   ├── page.tsx      # 首页/仪表板
│   │   └── layout.tsx
│   ├── lib/              # 工具库
│   │   └── finnhub.ts    # Finnhub API 客户端
│   └── hooks/            # React Hooks
├── .env                  # 环境变量
├── next.config.ts
├── package.json
└── README.md
```

## 🔧 功能详情

### 股票详情页 (`/stock/[ticker]`)

- 📊 实时价格显示，带涨跌幅
- 📈 价格走势图表（支持多时间范围：1M/3M/6M/1Y/3Y/ALL）
- 📋 持仓统计：当前价值、成本基础、总收益、平均买入价
- 📜 交易历史列表
- 🗑️ 支持删除交易记录

### 首页仪表板 (`/`)

- 💼 投资组合概览
- 📊 市场价值分布图表
- 📈 各市场持仓明细（按 NASDAQ/NYSE/OTC 分组）
- 💰 实时盈亏计算

### 交易管理

- ➕ 添加交易（买入/卖出）
- 🗑️ 删除交易
- 📜 交易历史列表页 (`/transactions`)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

---

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)
