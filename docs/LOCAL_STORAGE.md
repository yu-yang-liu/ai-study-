# 本地存储模式

项目现在默认使用本地 SQLite，不需要 Supabase、PostgreSQL 或 pgvector。

## 启动

在项目根目录执行：

```bash
pnpm install
copy apps/web/.env.example apps/web/.env.local
pnpm --filter @ai-study/web dev
```

`.env.local` 至少保留：

```dotenv
SQLITE_PATH=./data/ai-study.sqlite
```

`SQLITE_PATH` 可以改成绝对路径。数据库首次启动时会自动创建，不需要执行 SQL migration。

项目要求 Node 24 或更高版本，因为使用 Node 内置的 `node:sqlite`。

## 数据位置

```text
data/ai-study.sqlite       用户、题库、错题、对话、学习记录
试卷/                       原始试卷、答案、解析文件
```

SQLite 数据库和 WAL 临时文件已加入 `.gitignore`。备份时复制 `data/ai-study.sqlite`；应用停止后复制最稳妥。

## 账号

注册和登录由本地 SQLite 完成：

- 密码使用 Node `scrypt` 哈希，不保存明文密码。
- 浏览器使用 httpOnly 会话 cookie。
- iOS 等客户端继续使用 access token / refresh token 接口。
- 没有邮箱验证回调；本地注册后可以直接登录。

## 题库

题库数据写入 SQLite 的 `question_bank` 表；题目图片、PDF 等二进制文件不塞进数据库。原始试卷放在根目录 `试卷/`（不进 git），后续解析模型再把结构化结果写入题库。

### 题库 seed 管线（scripts/seed-bank）

原料：`试卷/高考/2025/`（9 科试卷+答案成对 PDF）与 `试卷/高考/2026/`（语文 txt 等）。三条命令按顺序执行（Node 24+）：

```bash
node scripts/seed-bank/extract-pdf.mts          # 试卷/ PDF+txt → tmp/seed/text/*.txt
node scripts/seed-bank/parse-exam.mts           # DeepSeek/qwen 拆题 → tmp/seed/entries.jsonl（--subject 数学 可单科试跑）
node scripts/seed-bank/import-bank.mts          # entries.jsonl → question_bank（按 id upsert，幂等）
```

拆题需要 `DEEPSEEK_API_KEY`（失效时自动回退 `DASHSCOPE_API_KEY` 的 qwen）。embedding 是可选的：

- `.env.local` 配了 `DASHSCOPE_API_KEY`：import 时自动批量算向量，语义 RAG 立即可用；
- 没配：题目文本照常入库（浏览/练习不受影响），RAG 检索返回空。之后补上 key 跑 `node scripts/seed-bank/backfill-embedding.mts` 一键补算。
- `node scripts/seed-bank/smoke-rag.mts` 可验证相似度检索（需要 embedding）。

题库的向量字段以 JSON 文本保存。没有 embedding 时，普通题库浏览和练习不受影响，语义 RAG 会返回空结果或跳过。

## 不再使用的配置

以下配置不再需要，也不应写入 `.env.local`：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

旧的 `packages/core/src/db/migrations/` 只保留为历史记录，新的本地数据库不会读取它们。

