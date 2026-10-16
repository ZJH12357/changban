# 常伴：Netlify 比赛演示版

## 保留两套后端

同一份页面、桌宠、账号权限和业务代码，按构建目标选择数据库：

| 场景 | 构建 / 启动命令 | 数据库 |
| --- | --- | --- |
| 原 Sites 平台 | `npm run build` | Cloudflare D1，原有绑定不变 |
| Netlify | `npm run build:netlify` | Netlify Database（PostgreSQL） |
| 电脑本地演示 | `npm run demo` | `.data/changban.sqlite` |

三套数据彼此独立。不要把 Sites 密钥或本地数据库上传给 Netlify，也不要让 Netlify 接口转发到原网站。

## 在 Netlify 上操作

1. 在你的 Netlify 账号中，选择导入已有 Git 项目，连接个人 GitHub 仓库 `ZJH12357/changban`。只授权这个仓库即可。选择 `main` 分支。
2. 保留仓库提供的 `netlify.toml` 配置：项目根目录为空；构建命令 `npm run build:netlify`；发布目录 `.next`；Node.js 24。平台应检测为 Next.js；不要选择纯静态上传，也不要填写 `dist`。
3. 使用 Free 套餐。项目依赖 `@netlify/database`，迁移放在 `netlify/database/migrations/`。按平台的数据库开通提示确认；Netlify 应在部署过程中创建独立数据库并应用迁移。若提示缺少数据库，在该项目的 Database 页面创建，再重新部署。不要在聊天、GitHub 或前端代码中粘贴数据库连接串。
4. 检查部署日志：Next.js 构建及数据库迁移都应成功。若失败，不要清空旧站数据或更换收费套餐；先保留错误日志进行排查。
5. 把新项目的访问可见性设为公开并发布，获取平台返回的 `.netlify.app` 地址。GitHub 仓库继续保持私有。此地址与原 Sites 地址不同，不会替换旧站。

平台界面和数据库是否自动开通以你的账号实际提示为准；这份适配代码不能代替账号内的服务开通授权。源码构建成功不等于已完成线上部署。

## 首次测试（无需迁移旧站账号）

1. 用电脑注册一个新的老人账号，填写虚拟称呼、虚拟联系方式。注册会生成家庭及示例日程。
2. 在老人端“家人”页面复制家庭码。
3. 用手机打开同一个 Netlify 地址，注册家属账号并绑定家庭码。电话号码可使用演示号码 `00000000000`；不要拨打演示号码。
4. 家属创建一条今天的日程；老人端应在刷新或下一个同步周期显示。老人完成后，家属端的进度、桌宠和历史页应同步更新。
5. 反过来分别测试手机老人端、电脑家属端；再测未绑定账号、另一个家庭、退出重登、未共享生活记录和未来日程。
6. 用手机 Wi-Fi 与移动网络分别访问。Netlify 免费和公开访问不代表保证每个大陆网络可达。

所有参赛演示只用虚拟资料。网站仍要求登录；“公开网站”不等于公开各家庭数据。网页关闭后仍不提供锁屏／后台定时提醒。

## 开发验证

需要 Node.js 24，先执行 `npm ci`：

```text
npm run test:postgres
npm run typecheck
npm run build:netlify
npm run build
```

`test:postgres` 使用 PGlite 在内存中运行真实 PostgreSQL 引擎和现有 API 处理函数，覆盖事务回滚、角色／家庭隔离、注册绑定、日程、家属提醒、历史和共享权限；它不连接任何线上数据库。平台自身的 SDK 连接、Functions 包装及手机公网访问仍须在首次 Netlify 部署后验收。

安装 Playwright 和可用浏览器后，还可先执行 `npm run build:netlify`，再执行 `npm run test:netlify-ui`。该测试在本机临时启动 PostgreSQL 协议服务器和正式 Next.js 构建，使用实际 Netlify 数据库 SDK，检查手机老人端与电脑家属端的数据同步。可通过 `PLAYWRIGHT_MODULE` 和 `PLAYWRIGHT_CHANNEL` 指定现有工具，不属于线上运行依赖。测试进程结束时会关闭临时服务及内存数据库。

## 免费额度

Netlify 的发布、后端运行、数据库和流量共同消耗账号套餐额度。部署前查看 Usage & billing，确认 Free 和剩余额度；不要为了测试开启付费充值。比赛前检查额度和地址访问状态。

## 技术边界

- `db/runtime.ts` 和 `drizzle/` 保留原 Sites 后端；没有修改旧站表或导出旧数据。
- Next.js webpack 根据 `CHANGBAN_BACKEND=netlify`（或平台的 `NETLIFY=true`）将数据库入口替换为 `db/netlify-runtime.ts`。
- `db/postgres-adapter.ts` 只适配当前业务用到的参数化 SQL：占位符、保留字段名、大小写别名和 `INSERT OR IGNORE`。不是通用 SQLite 模拟器；新增特殊 SQL 必须补测试。
- Netlify 的批量写操作使用同一连接的 PostgreSQL 事务；不使用内存变量、临时磁盘或整个 JSON 文件当作双端共享数据库。
- 建表只在平台迁移阶段执行；HTTP 请求不执行建表或清库。当前迁移无预置共享密码或线上种子账号。
