# CampusOne AgentFlow

CampusOne 是一款面向高校场地申请的可信事务智能体。它把固定表单、确定性规则、知识依据、大模型辅助、人工审批和事务时间轴放在同一个可演示闭环中。

- 私有演示站点：<https://campusone-agentflow.atticus-5951.chatgpt.site>
- 比赛交付物：`deliverables/`
- 单一身份配置：`competition.config.json`（补齐单位、成员、教师和邮箱后重建材料）

## 产品原则

- **规则优先**：容量、时间冲突、开放时间、必填项、权限和状态转换由程序判断，共六条确定性规则。
- **身份在服务端**：业务接口不接受请求体里的角色，只认 HttpOnly 会话，申请人无法批准自己的申请。
- **证据绑定**：AI 只能使用服务端提供的事实、规则和按规则检索出的知识片段。
- **人工决策**：AI 不批准、不退回、不改变正式业务状态。
- **失败可继续**：模型超时、格式错误或证据不匹配时拒绝 AI 结果并回退固定模板。
- **全程留痕**：申请版本、状态事件、AI 运行（含被拒绝的那次）与人工采纳均可追溯。

## 初赛闭环

`填写申请 → AI 表单辅助 → 规则预检 → 用户确认提交 → 切换管理员身份 → 审核摘要 → 人工退回 → 学生修订 V2 → 人工批准 → 查看时间轴与 AI 证据`

页面右上角的 `申请人 / 管理员` 开关是**演示专用**的身份切换。它是唯一需要替换的接缝：生产环境删除 `/api/demo/role`，由校园统一身份认证写入同一个会话，其余状态机与审计逻辑不变。

每位访问者由会话 Cookie 派生出独立的案件编号，多位评委同时打开演示链接不会互相干扰；`重置演示` 也只清除自己的案件。

## 本地启动

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:generate
npm run db:local:apply
npm run dev
```

默认 `LLM_MODE=mock`，无需 API Key。切换真实模型时，在本地 `.env.local` 中设置以下变量：

```dotenv
LLM_MODE=live
LLM_API_BASE=https://api.deepseek.com
LLM_API_KEY=<your-api-key>
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=12000
```

`.env.local` 已被 Git 忽略，不要把真实密钥写进 `.env.example`、源码、提交记录或浏览器端变量。线上站点使用同名的托管环境变量，其中 `LLM_API_KEY` 必须标记为 secret；修改线上变量后需要重新部署一个已保存版本才会生效。

Conda 环境已定义在 `environment.yml`，可使用：

```powershell
conda env create -f environment.yml
conda activate campusone-agentflow
```

## 质量检查

```powershell
npm run lint
npm test
npm run build
```

`npm test` 覆盖 `docs/test-plan.md` 中 T01–T21 全部用例。比赛范围、执行计划、架构、测试和演示脚本位于 `docs/`。赛方培训材料、群聊记录、真实账号、个人数据和模型密钥不进入仓库。

## 比赛材料

`deliverables/` 已包含不超过 2000 字的项目概要、14 页项目简介 PPT、完整设计方案书、真人视频逐秒脚本与录制指南。

> **注意**：`deliverables/` 中的 Word、PPT 与截图生成于本轮代码修复之前，尚未包含开放时间规则、知识库检索、服务端身份与会话隔离。提交前需按下方命令重建并复核。

提交前仍需在 `competition.config.json` 补齐真实身份信息，并由参赛者录制 3–5 分钟实机演示视频。

身份信息更新后，在已创建的 Conda 环境中运行下列命令可重建两份 Word 文档：

```powershell
conda run -n campusone-agentflow python work/documents/build_docs.py
```

PPT 源文件为 `work/slides/build_deck.mjs`，依赖 Codex 工作区内置的演示文稿运行库；在当前工作区可由 Codex 重建并重新做视觉检查。
