# AI Wealth OS — Claude Code Project Rules

## 1. 项目定位

AI Wealth OS 是一个个人 / 家庭财富管理系统。

核心目标：

- 统一管理家庭资产、负债、现金流、投资和财务自由状态
- 自动更新全球市场资产数据
- 管理家庭收入、支出、信用卡、贷款、年金等现金流
- 计算 Financial Freedom / 财务自由进度
- 为未来 AI CFO 提供可靠、统一、可解释的数据基础

这是一个真实使用中的个人财务系统。

因此：

> 财务数据正确性、计算口径一致性、数据安全优先于代码重构和功能数量。

---

# 2. 技术栈

当前项目主要技术：

- Next.js
- React
- TypeScript
- Supabase
- Tailwind CSS / CSS
- Vercel
- Vercel Cron
- Git / GitHub
- 外部市场数据 API
- Claude Code
- 当前 Claude Code 使用 DeepSeek Anthropic-compatible API

当前项目目录：

C:\Users\cyjtd\AI-Wealth-OS

---

# 3. 最重要的开发原则

## 3.1 先分析，再修改

除非用户明确要求直接修改，否则：

1. 先读取相关文件
2. 理解现有实现
3. 检查相关依赖
4. 找出影响范围
5. 给出方案
6. 再修改

不要看到一个简单需求就立即重写整个文件。

## 3.2 最小修改原则

用户只要求修改一个功能时：

- 优先只修改相关代码
- 不要顺便重构无关代码
- 不要改变现有 UI
- 不要改变数据库结构
- 不要改变计算逻辑
- 不要删除已有功能

除非这些修改是完成当前任务所必需的。

## 3.3 不要猜数据库结构

涉及 Supabase 时：

先确认：

- 表名
- 字段名
- 类型
- 主键
- 唯一约束
- 外键
- RLS
- 当前代码中的实际查询方式

不要根据变量名称猜数据库结构。

---

# 4. 财务数据规则

这是本项目最重要的规则之一。

## 4.1 财务数字不能随意修改

任何涉及：

- 资产
- 负债
- 收入
- 支出
- 投资
- 投资收益
- 贷款
- 信用卡
- 年金
- 现金流
- Financial Freedom
- 净资产

的代码修改，都必须先理解原有计算逻辑。

不能为了让页面显示“正确”而直接修改数字。

## 4.2 UI 与计算逻辑必须分离

如果用户要求：

> “只改 UI”

则：

- 只修改 UI
- 不修改计算逻辑
- 不修改数据库
- 不修改 API
- 不修改数据源

如果一个 UI 修改确实会影响逻辑，必须先说明。

---

# 5. Financial Freedom 规则

Financial Freedom 是本项目的核心功能之一。

当前项目中存在多个 Financial Freedom 相关页面和计算逻辑。

因此：

> 在修改 Financial Freedom 相关代码之前，必须先搜索整个项目中所有相关实现。

重点检查：

- Financial Freedom 页面
- simulation
- history
- asset growth
- expense growth
- retirement
- retirement age
- retirement year
- financial freedom history
- 相关 API
- 相关 Supabase 表

不要假设项目中只有一个 Financial Freedom 算法。

如果发现多个算法或多个口径：

1. 先列出差异
2. 不要擅自选择一个删除
3. 告诉用户
4. 等用户确认后再统一

---

# 6. 投资资产规则

投资相关代码涉及：

- 中国资产
- 美国资产
- 香港资产
- 卢森堡资产
- 基金
- ETF
- 黄金
- 债券
- 现金

修改投资逻辑前必须确认：

- 市场
- 币种
- NAV / Price
- Shares
- Cost
- Profit
- Profit Rate
- 汇率
- Snapshot Date

## 6.1 汇率

中国资产通常以 CNY 计价。

US / HK / LU 等海外资产需要根据项目当前规则转换为 CNY。

不要自行改变项目当前汇率转换规则。

## 6.2 市场数据

项目存在自动更新市场数据的 Cron。

修改市场更新逻辑时必须特别注意：

- 中国交易日
- 美国交易日
- 香港交易日
- 卢森堡交易日
- 最新交易数据
- snapshot date
- 重复写入
- API rate limit
- 时区

不要简单使用“今天的数据”。

必须遵守当前项目实际的交易日判断逻辑。

---

# 7. Cron 规则

项目使用 Vercel Cron。

涉及：

`app/api/cron/update-market/route.ts`

时：

必须先检查：

- Cron authentication
- CRON_SECRET
- 当前 Vercel Cron 配置
- UTC 时间
- 交易日判断
- API 调用
- Supabase 写入
- 重复 snapshot
- error handling

不要为了修一个问题而删除现有的交易日判断。

---

# 8. Supabase 规则

Supabase 是项目核心数据层。

修改数据库相关代码时：

### 必须先检查实际 schema

不要凭记忆猜：

- 表名
- 字段名
- 类型
- constraint
- unique index

特别注意：

- asset_history
- holdings
- holdings_history
- financial_freedom_history
- 现金流相关表
- 贷款相关表
- 信用卡相关表

如果遇到 duplicate key：

不要简单删除 unique constraint。

先确认：

1. 为什么产生重复数据
2. 当前业务是否真的允许重复
3. 应该 upsert、update 还是 insert
4. unique constraint 是否本来就是正确的

---

# 9. API Rules

修改 API Route 时必须检查：

- authentication
- authorization
- input validation
- error handling
- Supabase permissions
- external API failures
- rate limits
- duplicate requests

尤其是 Cron API：

> 不允许为了方便调试而永久关闭认证。

---

# 10. Authentication / Security

这是一个个人财富系统。

安全优先。

不要：

- 把 API Key 写入源码
- 把 Supabase service role key 写入客户端
- 把密码写入代码
- 把 Secret 输出到 console
- 把 API Key 提交到 Git
- 为了测试而永久关闭认证

如果发现已有安全问题：

先报告问题，再提出最小修复方案。

---

# 11. Claude Code / AI 使用规则

当前 Claude Code 通过 Anthropic-compatible API 使用 DeepSeek。

当前主要模型：

- deepseek-v4-pro[1m]
- deepseek-v4-flash

不要因为项目中存在 Claude Code，而擅自修改项目的 AI Provider。

如果用户明确要求：

- DeepSeek → 使用 DeepSeek
- Qwen → 使用 Qwen
- Claude → 使用 Claude

必须按照用户指定的 Provider 实现。

---

# 12. Agent 使用规则

对于大型分析任务，可以使用多个 background agents。

适合拆分：

- 页面分析
- Supabase schema
- API
- Cron
- 投资逻辑
- Financial Freedom
- UI

但是：

> 多 Agent 不代表可以同时随意修改同一个文件。

大型修改必须控制文件冲突。

优先：

- 多 Agent 只读分析
- 主 Agent 汇总
- 再统一修改

---

# 13. AI CFO 规划

AI CFO 是未来的重要功能。

当前阶段不要直接让 AI 修改真实财务数据。

推荐发展阶段：

### Phase 1 — Read Only

AI CFO：

- 读取资产
- 读取负债
- 读取现金流
- 读取投资
- 读取目标
- 分析 Financial Freedom

只提供分析。

### Phase 2 — Recommendation

AI CFO 可以：

- 给出现金流建议
- 投资建议
- 贷款建议
- 消费建议
- Financial Freedom 建议

但不直接执行。

### Phase 3 — Action

只有经过明确确认后，AI 才可以执行：

- 新增记录
- 修改记录
- 删除记录
- 调整计划

任何涉及真实财务数据的写操作必须有明确确认机制。

---

# 14. AI CFO 数据层

未来优先建立统一的数据上下文层，例如：

`lib/cfo/context.ts`

目标是把：

- Assets
- Liabilities
- Cash Flow
- Investments
- Loans
- Credit Cards
- Financial Freedom
- Goals

转换成统一的数据结构。

AI 不应该直接到处查询 Supabase。

推荐：

```text
Supabase
   ↓
CFO Context
   ↓
Business Calculations
   ↓
AI CFO
```

而不是：

```text
AI
 ↓
随意查询多个 Supabase 表
```

---

# 15. UI 规则

如果用户只要求 UI：

只修改：

- layout
- spacing
- width
- color
- font
- alignment
- visibility
- responsive behavior

不要修改：

- calculation
- API
- database
- business logic

---

# 16. 页面修改规则

修改页面前：

1. 找到对应 `page.tsx`
2. 找到相关 components
3. 找到相关 lib
4. 找到 API
5. 确认数据来源

不要因为一个页面文件很大，就直接重写整个页面。

---

# 17. TypeScript Rules

项目使用 TypeScript。

不要通过：

```ts
any
```

来快速绕过类型错误。

优先：

- 正确声明类型
- 修复接口
- 修复 null / undefined
- 修复 API response 类型
- 保持现有类型安全

除非用户明确要求，否则不要大量使用 `as any`。

---

# 18. Build / Test Rules

修改代码后，根据修改范围运行适当检查。

优先：

```bash
npm run build
```

如果项目存在 lint：

```bash
npm run lint
```

如果修改了特定逻辑，也应该运行对应测试。

如果 build 失败：

1. 读取完整错误
2. 找到真正原因
3. 修复
4. 再次 build

不要看到第一个错误就大范围重构。

---

# 19. Git Rules

不要自动：

```bash
git add .
git commit
git push
```

除非用户明确要求。

修改完成后：

优先告诉用户：

```bash
git status
```

以及修改了哪些文件。

---

# 20. Secrets

以下内容绝对不能进入 Git：

- API Keys
- DeepSeek API Key
- Qwen API Key
- Anthropic API Key
- Supabase Service Role Key
- Database password
- OAuth secrets
- CRON_SECRET

项目使用的本地 Secret 文件必须进入 `.gitignore`。

如果发现 Secret 已经被 Git tracking：

立即提醒用户。

---

# 21. 不要擅自改变用户已经确定的业务规则

用户已经确定的财务规则、投资配置、贷款规则、现金流规则等：

不要因为“看起来更合理”就自行改变。

如果发现规则之间冲突：

必须：

1. 找出冲突
2. 明确指出
3. 给出选择
4. 等用户决定

---

# 22. 解释修改

完成任务后，必须简洁说明：

### 修改了什么

列出文件。

### 为什么修改

说明原因。

### 是否改变业务逻辑

明确：

- 是
- 否

### 是否通过 Build

说明：

```text
npm run build
PASS / FAIL
```

### 是否修改数据库

明确说明。

---

# 23. 默认工作模式

除非用户明确要求：

> 直接修改

否则默认：

```text
分析
 ↓
说明问题
 ↓
提出方案
 ↓
等待确认
 ↓
修改
 ↓
Build
 ↓
报告结果
```

---

# 24. 对用户的理解

用户正在开发一个长期使用的 AI Wealth OS。

这个系统不是一次性 Demo。

因此所有修改都应该考虑：

- 可维护性
- 数据正确性
- 历史数据
- 向后兼容
- 数据安全
- 财务计算一致性
- 未来 AI CFO
- 长期扩展

优先稳定、清晰、可解释，而不是追求代码数量。

---

# 25. 当前阶段优先级

当前项目优先级：

1. 数据正确性
2. 财务计算口径统一
3. 数据安全
4. Cron 稳定性
5. Supabase 数据一致性
6. Financial Freedom 统一
7. UI 稳定
8. AI CFO 数据层
9. AI CFO
10. 自动化 Agent

不要为了增加 AI 功能而牺牲现有财务系统的可靠性。
