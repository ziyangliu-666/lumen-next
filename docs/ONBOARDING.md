# 上手指南 — 每个人怎么用 Agent 开始

这份文档是给团队五个人看的。目标只有一个：你读完之后，知道自己负责什么、
在哪里领任务、按什么规范写、什么时候和别人联调。

代码、注释、文件名一律英文（见 [CODING_STANDARDS.md](CODING_STANDARDS.md)）。这份说明用中文。

---

## 0. 一句话

lumen 是一个网页：AI agent 之间互相委派，调用树画成一张你能走进去的图。
我们把它当作 SWE5006 的实践项目来做。整个系统是一个**单体**：一个进程、一个
关系型数据库、一个 React 前端。代码按**纵切片**划分，一个人从头到尾负责一片。

## 1. 你负责哪一片

| 你 | 切片 | 页面 | 后端模块 | 设计模式 |
|---|---|---|---|---|
| LIU ZIYANG（PM） | 共享契约 + session | 04 Session 图/调用树 | contracts, core, session | Composite |
| LU YI | identity | 02 Sign in, 05 Account | identity | Strategy + Template Method |
| PENG XUJIAN | projects | 01 Landing, 03 Home | projects | State |
| LI ZHUOYANG | steering | 04 Session composer/文件 | steering | Command + Null Object |
| HE RONG | billing | 05 Wallet/Keys, 06 Admin | billing | Chain of Responsibility |

你的一整片代码在 `apps/server/src/modules/<你的切片>/`，前端页面在
`apps/web/src/pages/<你的页面>/`。谁负责哪条路径，写在 [/CODEOWNERS](../CODEOWNERS) 里。

## 2. 第一天：把环境跑起来

```bash
git clone https://github.com/ziyangliu-666/lumen-next.git
cd lumen-next
npm install
docker compose up -d db        # 本地 Postgres
npm run verify                 # 一条命令：格式 + lint + 类型 + 测试 + 覆盖率
```

`npm run verify` 全绿，说明你的环境和主分支一致。跑不通先解决这个，再写代码。

看到系统真的动起来：

```bash
npm run dev --workspace @lumen/server   # 单体后端
npm run dev --workspace @lumen/web      # 前端，打开 http://localhost:4173
```

## 3. 你的工作台在哪

打开你切片的文件夹，里面有三样东西：

1. `README.md` — 你的用例、你的设计问题、你要证明的设计模式。
2. 设计模式骨架（比如 `pointComposite.ts`、`budgetGuard.ts`）— 已经能编译、
   已经有测试。这是你的起点，不是从空白开始。
3. `<slice>.test.ts` — 里面有几个 `it.todo(...)`。**每一个 todo 就是一个任务。**
   你的活，就是把这些 todo 变成真正跑通的测试。

举例，`identity.test.ts` 里：

```ts
it.todo('GithubStrategy exchanges an OAuth code for a verified email');
it.todo('SessionStrategy resolves an existing cookie to its principal');
```

这两行就是 LU YI 第一个 sprint 要做的两件事。

## 4. 怎么用 Agent 干活

你不用一行行手写。你指挥一个 AI coding agent，在你自己的文件夹里干活。方法：

1. 在你的切片目录里开一个 agent（Claude Code / Codex 都行）。
2. 把下面这段话发给它（**英文，因为它引用的都是英文路径和规范**）：

```
You are working on the `<slice>` vertical slice of the lumen monorepo.
Read these first: apps/server/src/modules/<slice>/README.md, docs/CODING_STANDARDS.md,
docs/SLICES.md, packages/contracts/src.

Your task: make the next `it.todo(...)` in <slice>.test.ts a real passing test,
and implement the code it needs. Rules:
- Only touch files inside your slice folder and its web page. Never import another
  slice's internals — import its public index only.
- `npm run verify` must stay green: format, lint, strict typecheck, coverage.
- Demonstrate the slice's design pattern; document the brute-force version first,
  then the refactor.
- Small commits, Conventional Commits, one branch per task.
Show me the plan before you write code.
```

3. Agent 干完一个 todo，你自己跑一遍 `npm run verify`，看懂它写了什么，再让它继续下一个。

Agent 写的每一段，你都要能解释清楚——不是它写完就不管。答辩时老师会针对你的
设计问题和设计模式提问，这部分按个人贡献打分（Chandra 邮件原话）。

## 5. 从哪里领任务

任务有三个来源，按优先级：

1. **你切片里的 `it.todo(...)`** — 最直接。做完一个划掉一个。
2. **本 sprint 的目标** — 见 [DOD.md](DOD.md) 的 Sprint DOD 表。每个 sprint 有一个
   可演示的结果，你的 todo 要往那个结果上凑。
3. **GitHub Issues / Projects** — 我们把 backlog 放这里。领一个 issue，开一个分支。

### Sprint 1（9-2 至 9-12）每个人的第一批任务

- **全员**：跑通 `npm run verify`；读完本文档 + 你的切片 README。
- **LIU ZIYANG**：冻结 `packages/contracts` 和 `core`（领域模型、事件协议、基础
  schema）。把 walking skeleton 串起来：登录 → 一个项目 → 一个 session → 一个
  point，端到端渲染。
- **LU YI**：identity 的 password + session 两条路先通（骨架已在），OAuth 留 todo。
- **PENG XUJIAN**：projects 的四态卡片，让卡片订阅 `state.live` 决定是否轮询。
- **LI ZHUOYANG**：steering 的 SteerQueue 接到真实的 end-of-turn / next-step 时机。
- **HE RONG**：billing 的 escalate → 审批请求接线；Stripe top-up 的接口先立住。

## 6. 规范：只有一条命令

不用背规范。`npm run verify` 绿，就是合规。它检查：格式（Prettier）、lint
（ESLint 严格 + 边界规则）、类型（TypeScript strict）、测试和覆盖率。

细则在 [CODING_STANDARDS.md](CODING_STANDARDS.md)。三条最重要的：

- **边界铁律**：你只能通过一个切片的 `index.ts` 用它，不能伸手进它的内部文件。
  ESLint 会直接报错。这是五个人不打架的保证。
- **金额用整数分**，不用浮点。
- **复杂的类先写测试**（委派引擎、预算链、状态机）。琐碎的胶水不用测。

## 7. 提交流程

```
从 main 拉最新 → 开分支 → agent 干活 → npm run verify 绿 → 提 PR → 切片 owner
审 → CI 绿 → 合并
```

- 分支名：`<slice>/<短主题>`，比如 `identity/github-oauth`。
- 提交信息：Conventional Commits，比如 `feat(identity): ...`、`fix(billing): ...`。
- PR 要过 `CODEOWNERS` 里对应 owner 的 review，且 CI 绿。模板会提示你勾 DOD。
- 分支活得短。别攒一大坨再合。

一个 PR 什么时候算 Done，看 [DOD.md](DOD.md) 的 Story DOD。代码写完不算 Done，
测试证明了行为、CI 绿了、owner 审了，才算 Done。

## 8. 什么时候联调，怎么联调

**联调不是最后才做的事。** 因为大家都对着同一份 `packages/contracts` 写，联调
的本质就是：确认你的切片发的/收的事件，和契约一致。

三个固定的联调点：

1. **Sprint 1 结束（9-12）：第一次全员联调 = walking skeleton。**
   五个人的骨架串起来跑一遍：在登录页登录（LU YI 的 stub）→ 首页看到一个项目
   （PENG XUJIAN）→ 进 session（LIU ZIYANG）→ 一个 point 渲染出来，带上花费
   （HE RONG 的 ledger）。这一趟跑通，Sprint 1 才算 Done。

2. **每个 sprint 的中点：一次集成检查。**
   （这是我们上个 workshop 复盘里定的：不要拖到最后一天才集成。）中点这天，所有
   人把分支合进 main，一起跑 `npm run dev` 前后端，走一遍当前 sprint 的主流程。

3. **两个切片碰头的地方，随时联调。** 已知的碰头点：
   - **session 页**：LIU ZIYANG 的图 + LI ZHUOYANG 的 composer 共用一页。两人
     约好 props 边界，各写各的。
   - **所有人依赖 identity**：每片都需要登录用户。LU YI 的真登录没上之前，大家
     用 `core/http/authGuard.ts` 里的 stub 账号开发。LU YI 的一上线，全员切过去。
   - **花费显示**：billing 写 ledger，projects 和 session 读它显示。约定好读的
     接口，谁先谁后不卡。

### 怎么操作一次联调

```bash
git checkout main && git pull
docker compose up -d db
npm run verify                 # 先确认主分支本身是绿的
npm run dev --workspace @lumen/server
npm run dev --workspace @lumen/web
# 五个人一起，照着当前 sprint 的主流程点一遍，记下断的地方，开 issue
```

联调断了，不是谁的错，是契约没对齐。回到 `packages/contracts` 看是不是漏了字段，
改契约走 review（契约 Sprint 1 之后是冻结的，改它要 PM 过）。

## 9. 时间线

| 日期 | 事 |
|---|---|
| 9-2 | 项目开始 |
| **9-12** | Sprint 1 结束 + **第一次进度报告** + 第一次全员联调 |
| 9-26 | Sprint 2 结束 + 第二次进度报告 |
| 10-10 | Sprint 3 结束 + 第三次进度报告 |
| 10-24 | Sprint 4 结束 + 第四次进度报告 |
| **10-26** | **答辩**（Team 1，9:30–10:15，Zoom） |
| 11-10 | 最终报告 |

每个 sprint 两周，末尾交一次进度报告给老师。CI、CD、安全测试从 Sprint 1 起每个
sprint 都跑（Chandra 要求）。

## 10. 卡住了找谁

- 环境 / 契约 / 联调 / 流程问题 → LIU ZIYANG（PM）。
- 你切片内部的设计问题 → 先问你的 agent，再在组里贴出来一起看。
- 老师要的东西（报告、DOD、交付物）→ 看 [DOD.md](DOD.md)，还有问题问 PM。

先把 `npm run verify` 跑绿，再开始。
