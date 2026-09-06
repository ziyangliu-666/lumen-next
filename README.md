# lumen

一个网页：AI agent 之间互相委派，调用树画成一张你能走进去、还能随时插手的图。
这是 SWE5006 实践模块，Team 1 的项目。

**一条规则：一个 point 就是一个 agent 上下文窗口的生命周期。** 每一个开启新窗口
的事件，都在图上开一个 point，别的都不开。

## 项目怎么搭的

一个单体、一个关系型数据库、一个 React 前端。没有微服务，切片之间也没有对外
接口——它们在同一个进程里，通过各自的公开出口（`index.ts`）互相调用。代码按
**纵切片**分：一个人从头到尾负责一片，包括页面、后端模块、和它的流水线。

```
packages/contracts   前后端共用的事件协议和领域类型（Sprint 1 之后冻结）
apps/server          单体后端
  src/core           领域模型、broker、数据库、http —— 共享，PM 负责
  src/modules        每片一个文件夹，各有一个负责人
apps/web             React 前端，每个页面一个文件夹
```

## 谁负责哪一片

| 切片 | 负责人 | 用例 | 设计模式 |
|---|---|---|---|
| identity | LU YI | 登录、账号、OAuth | Strategy + Template Method |
| projects | PENG XUJIAN | 建项目、看首页 | State |
| session | LIU ZIYANG | 委派、读调用记录 | Composite |
| steering | LI ZHUOYANG | 干预运行、执行命令 | Command + Null Object |
| billing | HE RONG | 花费上限、后台、Stripe | Chain of Responsibility |

新人从 [docs/ONBOARDING.md](docs/ONBOARDING.md) 开始，那里讲怎么用 agent 领活。
每片的详细边界看 [docs/SLICES.md](docs/SLICES.md)，完成标准看
[docs/DOD.md](docs/DOD.md)，代码规范看
[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)。谁负责哪条路径，写在
[CODEOWNERS](CODEOWNERS) 里。

## 怎么跑起来

```bash
npm install
docker compose up -d db          # 本地 Postgres
npm run verify                   # 一条命令：格式 + lint + 类型 + 测试 + 覆盖率
npm run dev --workspace @lumen/server
npm run dev --workspace @lumen/web
```

需要 Node 22 以上。把 `.env.example` 复制成 `.env`，填上你这片要用的密钥。

## 怎么协作

两周一个 sprint，每个 sprint 末尾给老师交一份进度报告。从 Sprint 1 起，CI、CD
和安全测试在每个 pull request 上都跑。一个 pull request 要过对应负责人的 review
（见 [CODEOWNERS](CODEOWNERS)），并且 `npm run verify` 绿了，才能合并。
