# 名人信息爬虫系统

一个用于收集世界级名人公开信息的 Web 应用，收集的数据可用于训练个性化 Agent。

## 功能特点

- **AI 智能识别**: 通过 AI 对话确认目标名人身份，避免歧义
- **多源数据采集**: 支持 Twitter/X、YouTube、Wikipedia、新闻、书籍等多个数据源
- **权重分级系统**: 根据信息来源可靠度自动分配权重
  - P1 (权重 1.0): 本人直接发言（社交媒体、采访、演讲）
  - P2 (权重 0.8): 本人作品（授权传记、本人著作）
  - P3 (权重 0.6): 权威第三方（非授权传记、新闻报道）
  - P4 (权重 0.5): 综合信息（Wikipedia 等）
  - P5 (权重 0.3): 他人评价
- **多格式导出**: 支持 JSON 和 Markdown 格式导出
- **可视化进度**: 实时显示爬取进度和数据统计

## 技术栈

- **前端**: Next.js 14, React 18, Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: SQLite (通过 Prisma ORM)
- **LLM**: 支持 OpenAI GPT-4 和 Claude

## 快速开始

### 1. 安装依赖

```bash
cd celebrity-crawler
npm install
```

### 2. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 访问应用

打开浏览器访问 http://localhost:3000

## 使用流程

1. **配置 LLM**: 选择 OpenAI 或 Claude，输入 API Key
2. **选择数据源**: 勾选需要爬取的数据源，配置相应的 API Key
3. **确认名人**: 与 AI 对话，确认要收集信息的名人
4. **开始爬取**: 系统自动从选定的数据源爬取数据
5. **预览导出**: 查看数据分布，导出为 JSON 或 Markdown 格式

## 数据源配置

| 数据源 | 是否需要 API Key | 说明 |
|--------|------------------|------|
| Wikipedia | 否 | 免费，无需配置 |
| Twitter/X | 是 | 需要 Twitter API Bearer Token |
| YouTube | 是 | 需要 YouTube Data API Key |
| 新闻 | 可选 | 可使用 Google Custom Search API |
| 书籍 | 否 | 使用 Google Books API（免费） |

## 项目结构

```
celebrity-crawler/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   └── page.tsx           # 主页面
│   ├── components/            # React 组件
│   ├── lib/
│   │   ├── crawlers/          # 各数据源爬虫
│   │   ├── llm/               # LLM 适配器
│   │   ├── db/                # 数据库操作
│   │   └── utils/             # 工具函数
│   └── types/                 # TypeScript 类型
├── prisma/                    # 数据库 Schema
├── data/                      # 数据存储
└── package.json
```

## 注意事项

- API Key 仅在本地使用，不会上传到服务器
- 请遵守各平台的使用条款和 API 限制
- 爬取大量数据时请注意 API 配额

## License

MIT
