<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo-dark.png">
    <img alt="lumen" src="apps/web/public/logo-light.png" width="480">
  </picture>
</div>

<br>

一个自动科研系统：给它一个研究问题，多个 AI agent 分工去查资料、跑计算，整个过程
实时列成一棵调用树，你随时能点进去看、插话、改方向。SWE5006 实践模块，Team 1。

## 架构

后端是一个单体：一个进程、一个 Postgres 数据库，模块之间在进程内直接调用，不走
网络、不拆微服务。前端是一个 React 单页应用。

代码按功能垂直切分，一个人负责一个模块，从页面一直写到后端，而不是分成
前端组和后端组。

```
packages/contracts   前后端共用的事件协议和数据类型（第一个 sprint 之后锁定）
apps/server          后端单体
  src/core           领域模型、事件广播、数据库、HTTP —— 公共部分，Sprint 1 后冻结
  src/modules        每个模块一个目录，各有一个负责人
apps/web             React 前端，每个页面一个目录
```

## 谁负责什么

![lumen 分工与模块](docs/slices.svg)

- 界面设计（每个屏幕标了归属）：[线上 ziy.bio/lumen-next](https://ziy.bio/lumen-next/) · [源文件 docs/spec/index.html](docs/spec/index.html)
- 怎么配合 agent 干活（新人先看）：[docs/ONBOARDING.md](docs/ONBOARDING.md)
- 系统架构、共用的类型和接口、每个模块对外提供什么：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 每个模块的具体边界：[docs/SLICES.md](docs/SLICES.md)
- 怎样算做完：[docs/DOD.md](docs/DOD.md)
- 代码规范：[docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md)
- 前端只有一套外观：[docs/UI.md](docs/UI.md)
- 哪个目录归谁：[CODEOWNERS](CODEOWNERS)

## 本地跑起来

```bash
npm install
docker compose up -d db          # 起一个本地 Postgres
npm run verify                   # 一条命令跑完：格式化、lint、类型检查、测试、覆盖率
npm run dev --workspace @lumen/server
npm run dev --workspace @lumen/web
```

需要 Node 22 以上。把 `.env.example` 复制成 `.env`，填上你这条线要用的密钥。

## 怎么协作

两周一个 sprint，每个 sprint 结束交一份进度报告。从第一个 sprint 起，每个 PR 都会
自动跑 CI、CD 和安全扫描。代码想合进主干，得先过对应负责人的 review，而且 CI 全绿。
