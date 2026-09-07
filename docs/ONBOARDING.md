# 上手指南：怎么配合 agent 开始干活

这份文档给团队五个人看。读完你应该清楚四件事：自己负责什么、去哪领活、按什么规范
写、什么时候和别人联调。

代码、注释、文件名一律英文（见 [CODING_STANDARDS.md](CODING_STANDARDS.md)），
这份说明用中文。

---

## 0. 项目是什么

lumen 是一个网页应用：多个 AI agent 互相委派，调用关系画成一张能点进去、能插手的
图。我们拿它当 SWE5006 的实践项目做。整个后端是一个单体：一个进程、一个数据库。
前端是一个 React 单页应用。代码按功能垂直切分，一个人负责一个模块，从页面一直写到
后端。

## 1. 你负责什么

| 你 | 模块 | 页面 | 后端目录 | 设计模式 |
|---|---|---|---|---|
| 刘子阳 | 公共契约 + session | Session 页的图和调用树 | contracts, core, session | Composite |
| 陆毅 | identity | 登录页、设置页的账号 | identity | Strategy + Template Method |
| 彭徐剑 | projects | 落地页、首页 | projects | State |
| 李卓阳 | steering | Session 页的输入框和文件面板 | steering | Command + Null Object |
| 贺融 | billing | 设置页的钱包和密钥、后台 | billing | Chain of Responsibility |

你的后端代码在 `apps/server/src/modules/<你的模块>/`，前端页面在
`apps/web/src/pages/<你的页面>/`。哪个目录归谁写在 [/CODEOWNERS](../CODEOWNERS) 里。

## 2. 第一天：把环境跑起来

```bash
git clone https://github.com/ziyangliu-666/lumen-next.git
cd lumen-next
npm install
docker compose up -d db        # 起一个本地 Postgres
npm run verify                 # 一条命令：格式化、lint、类型检查、测试、覆盖率
```

`npm run verify` 全绿，说明你本地和主干一致。跑不过先把这个解决掉，再动手写。

想看东西真的跑起来：

```bash
npm run dev --workspace @lumen/server   # 后端
npm run dev --workspace @lumen/web      # 前端，浏览器开 http://localhost:4173
```

## 3. 你的模块是空的，你来设计

进你模块的目录，里面只有两样东西：

1. `README.md`：你的用例、你要解决的设计问题、proposal 里提的候选模式。
2. `index.ts`：空的。你的模块对外提供什么，都从这个文件导出。

没有人替你定好类。你先设计，再写代码。顺序是：

1. 9-10 晚之前，在自己的 Google 文档里写好设计：用例主流程、分析类图、设计问题、
   你选的模式和为什么选它。候选模式是 proposal 6.4 里的假设，不是结论，你比较过
   再定。
2. 设计定了，再在你的目录里写代码。带模式的类每个都要有单元测试。

## 4. 怎么用 agent 干

不用一行行手敲。你指挥一个 AI 编程 agent（Claude Code、Codex 都行），在你模块的
目录里干活。步骤：

1. 在你的目录里开一个 agent。
2. 把下面这段发给它（**用英文，因为它引用的都是英文路径和规范**）：

```
You are working on the `<slice>` vertical slice of the lumen monorepo.
Read these first: apps/server/src/modules/<slice>/README.md, docs/CODING_STANDARDS.md,
docs/SLICES.md, docs/DOD.md, docs/UI.md, packages/contracts/src.

My design for this slice is below. Implement the next story from it:
<paste the relevant part of your design doc: the classes, the pattern, the story>

Rules:
- Only touch files inside your slice folder and its web page. Never import another
  slice's internals — import its public index only.
- The account in core/http/authGuard.ts is temporary: it trusts a header so every
  slice can work before real sign-in lands. Build against it; do not replace it.
- Write the unit test first for every class that carries the design pattern.
- `npm run verify` must stay green: format, lint, strict typecheck, coverage.
- Document the brute-force version first, then the refactor to the pattern.
- On the web side, follow docs/UI.md: build from the components in
  apps/web/src/ui (shadcn/ui), colour only with the theme classes from
  apps/web/src/styles/theme.css, no inline styles, no hex values, no new UI
  dependency, and no import from another page. Read the existing page in your
  folder and match it.
- Small commits, Conventional Commits, one branch per task.
Show me the plan before you write code.
```

3. Agent 做完一个 story，你自己跑一遍 `npm run verify`，把它写的东西看懂，再让它接着下一个。

agent 写的每一段，你都得能讲清楚，不能让它写完就撒手。答辩时老师会盯着你的设计
问题和设计模式问，这部分按个人贡献打分（Chandra 邮件里写明了）。

## 5. 去哪领活

三个地方，按顺序：

1. **你自己的设计文档**：设计写好了，里面的每个类、每个流程就是一件件活。
2. **这个 sprint 的目标**：见 [DOD.md](DOD.md) 里的 Sprint DOD 表。每个 sprint
   有一个能演示的成果，你的活要往那个成果上靠。
3. **GitHub Issues / Projects**：backlog 放这儿，领一个 issue 开一个分支。

活做了多少，记在你自己的 Google 文档里（入口在协作索引）。每天收工写一行：做了
什么、工时、卡点。进度报告和燃尽图从这里取，所以不记就等于没做。

### 第一个 sprint（9-2 到 9-12）每人的活

- **所有人**：把 `npm run verify` 跑绿；读完这份文档和你自己模块的 README；9-10 晚
  之前在自己的 Google 文档里写好 API 接口、系统设计、工作量。
- **刘子阳**：定稿 `packages/contracts` 和 `core`（数据类型、事件协议、基础表结构），
  然后把最小闭环串起来：登录 → 一个项目 → 一个 session → 一个 point，从头渲染到尾。
- **其他四个人**：设计定了以后，把带模式的第一个类和它的测试写出来，合一个 PR。
  这个 sprint 不要求页面和路由，那些等 core 的接口上了再接。

## 6. 规范就一条命令

不用背规范。`npm run verify` 绿了就是合规。它一次跑完：格式化（Prettier）、lint
（ESLint 严格模式 + 边界检查）、类型检查（TypeScript strict）、测试和覆盖率。

细则在 [CODING_STANDARDS.md](CODING_STANDARDS.md)。最要紧的四条：

- **边界**：别人的模块你只能通过它的 `index.ts` 用，不能直接引它内部的文件。
  引错了 ESLint 直接报错。这是五个人不互相踩脚的关键。
- **钱一律用整数分**，别用小数。
- **复杂的类先写测试**（委派引擎、预算链、状态机这些）。琐碎的胶水代码不用测。
- **前端只有一套外观**：组件从 `apps/web/src/ui/` 里拿，颜色只用
  `apps/web/src/styles/theme.css` 里的主题类。写死颜色、写 `style={{}}`、引别人的
  页面，ESLint 都会拦。细则一页纸，在 [UI.md](UI.md)。

## 7. 提交流程

```
拉最新主干 → 开分支 → agent 干活 → npm run verify 绿 → 提 PR → 对应 owner review
→ CI 绿 → 合并
```

- 分支名：`<模块>/<简短主题>`，比如 `identity/github-oauth`。
- 提交信息用 Conventional Commits，比如 `feat(identity): ...`、`fix(billing): ...`。
- PR 要过 [/CODEOWNERS](../CODEOWNERS) 里对应负责人的 review，而且 CI 得绿。模板会
  提醒你对照 DOD 打勾。
- 分支别攒太久，写一点合一点。

一个 PR 什么时候算做完，看 [DOD.md](DOD.md) 里的 Story DOD。代码写出来不算完。
测试证明了它对、CI 绿了、owner 也 review 过了，才算完。

## 8. 什么时候联调，怎么联调

**联调不是留到最后才做的事。** 大家都对着同一份 `packages/contracts` 写，联调
说白了就是：确认你发出去、收进来的事件和契约对得上。

三个固定的联调点：

1. **第一个 sprint 结束（9-12）：第一次全员联调，跑通最小闭环。**
   五个人的代码串起来走一遍：登录页登录（陆毅的临时登录）→ 首页看到一个项目（彭徐剑）
   → 进 session（刘子阳）→ 一个 point 带着花费渲染出来（贺融的账目）。这一趟通了，
   第一个 sprint 才算做完。

2. **每个 sprint 的中间，做一次集成检查。**
   （这是上次 workshop 复盘时定的：别拖到最后一天才集成。）这天所有人把分支合进
   主干，一起跑前后端，把当前 sprint 的主流程走一遍。

3. **两个模块交界的地方，随时联调。** 已知的交界处：
   - **session 页**：刘子阳的图和李卓阳的输入框在同一页。两人先说好组件之间的边界，
     然后各写各的。
   - **所有人都依赖 identity**：每个模块都需要一个登录用户。陆毅的真登录上线之前，
     大家先用 `core/http/authGuard.ts` 里写死的临时账号开发；他一上线，全员切过去。
   - **花费的显示**：billing 负责写账目，projects 和 session 负责读出来显示。先把
     读的接口说好，谁先谁后都不卡。

### 一次联调具体怎么操作

```bash
git checkout main && git pull
docker compose up -d db
npm run verify                 # 先确认主干本身是绿的
npm run dev --workspace @lumen/server
npm run dev --workspace @lumen/web
# 五个人一起，照当前 sprint 的主流程点一遍，断在哪记下来、开个 issue
```

联调断了，通常不是谁写错了，是契约没对齐。回 `packages/contracts` 看是不是少了字段。
契约在第一个 sprint 之后定稿，要改得走 review。

## 9. 时间线

| 日期 | 事 |
|---|---|
| 9-2 | 项目开始 |
| **9-10 晚** | 每人在自己的 Google 文档里写好：API 接口、系统设计、工作量（人天） |
| **9-12** | 第一个 sprint 结束 + **第一次进度报告** + 第一次全员联调 |
| 9-26 | 第二个 sprint 结束 + 第二次进度报告 |
| 10-10 | 第三个 sprint 结束 + 第三次进度报告 |
| 10-24 | 第四个 sprint 结束 + 第四次进度报告 |
| **10-26** | **答辩**（Team 1，9:30–10:15，Zoom） |
| 11-1 | 最终报告（Chandra 8-31 邮件定的截止日） |

两周一个 sprint，末尾交一次进度报告。CI、CD、安全测试从第一个 sprint 起每次都跑
（Chandra 的要求）。

## 10. 卡住了找谁

- 环境、契约、联调、流程的问题 → 找刘子阳。
- 你模块内部的设计问题 → 先问你的 agent，再拿到群里一起看。
- 老师要交的东西（报告、DOD、交付物）→ 看 [DOD.md](DOD.md)，还有问题群里问。

先把 `npm run verify` 跑绿，再开始。
