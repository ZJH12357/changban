# 常伴 AI 日程对话

## 使用

本地复制根目录 `.env.example` 为 `.env.local`，填写 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`。地址使用服务商控制台提供的 Chat Completions 兼容接口基础地址，不包含末尾 `/chat/completions`。模型需要支持 JSON Object 输出。千问等模型如要求关闭思考，设置 `AI_DISABLE_THINKING=true`。重启 `npm run demo`。

Netlify 在项目 Environment variables 中填写同名变量，确保运行时 Functions 可读取，再重新部署。不把真实密钥写入源码、netlify.toml 或 GitHub。参考：https://docs.netlify.com/build/functions/environment-variables/ 。模型协议参考：https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions 。

真实账号打开桌宠“和桌宠说句话”，配置可用时出现“同意并开启 AI 对话”。开启前不发送聊天；开启后向配置的模型提供本轮文字、当前草稿及最近最多 12 条对话，不自动上传家庭码、联系方式、生活记录。用户自行输入的个人信息仍会随文字发送。退出面板后对话不保留。体验模式保持离线规则流程，不调用在线模型。

## 行为

- DeepSeek 官方 API 使用 `AI_BASE_URL=https://api.deepseek.com`、`AI_MODEL=deepseek-flash`、`AI_DISABLE_THINKING=false`。后端识别官方域名并发送 DeepSeek 专用的 `thinking: {type: "disabled"}`，不发送千问专用参数。
- 基础规则模式采用分步问卷：事项 → 频率 → 日期 → 时间 → 可选备注 → 确认。日期、时间可直接选择；步骤支持返回修改，备注随日程保存。无需模型密钥即可使用。
- 模型理解口语、追问缺失信息、修改当前草稿及简短闲聊；日程查询按钮继续使用程序中的真实数据。
- 仅新增日程与修改当前草稿；删除、修改已有日程、完成记录、发送家属提醒仍使用原有面板。
- 服务端固定提示词位于 `lib/ai-schedule-server.ts`，普通用户无编辑接口；不在提示词中保存任何凭证。
- 模型没有工具或数据库访问能力。输出通过字段、日期、时间校验；“确认保存”按钮仍是唯一保存入口，复用账号权限和幂等逻辑。
- 无配置时使用基础规则。模型超时或返回异常时按基础规则处理并显示原因；网络连接失败保留文字和草稿，允许重试或关闭 AI。
- 请求超时 15 秒，输入最多 300 字，模型回复最多 600 字，每个服务实例每账号每分钟最多 10 次。多实例部署应在服务商设置费用上限；实例内限流不等于全站额度保护。
- 不记录模型密钥、对话内容或上游错误详情；提供商自身的数据处理规则以服务协议为准。

## 验证

`node scripts/ai-schedule-test.mjs` 使用模拟模型检验字段校验、未来时间、请求来源与登录限制、回退和密钥隔离；不消耗真实调用额度。`node scripts/schedule-conversation-test.mjs` 验证原规则及保存领域流程。真实模型对口音转写、口语与多轮纠正的效果应使用配置后的实测结果评价，模拟测试不代表识别准确率。
