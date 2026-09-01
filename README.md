# CampusOne AgentFlow

CampusOne 是一款面向高校场地申请的可信事务智能体。它把固定表单、确定性规则、知识依据、大模型辅助、人工审批和事务时间轴放在同一个可演示闭环中。

## 产品原则

- **规则优先**：容量、时间冲突、必填项、权限和状态转换由程序判断。
- **证据绑定**：AI 只能使用服务端提供的事实、规则和知识片段。
- **人工决策**：AI 不批准、不退回、不改变正式业务状态。
- **失败可继续**：模型超时、格式错误或证据不匹配时拒绝 AI 结果并回退固定模板。
- **全程留痕**：申请版本、状态事件、AI 运行与人工采纳均可追溯。

## 初赛闭环

`填写申请 → AI 表单辅助 → 规则预检 → 用户确认提交 → 管理员审核摘要 → 人工退回 → 学生修订 V2 → 人工批准 → 查看时间轴与 AI 证据`

## 本地启动

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:generate
npm run db:local:apply
npm run dev
```

默认 `LLM_MODE=mock`，无需 API Key。切换真实模型时，在本地 `.env.local` 中设置 `LLM_MODE=live`、模型地址和密钥；不要提交 `.env.local`。

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

比赛范围、架构、测试和演示脚本位于 `docs/`。赛方培训材料、群聊记录、真实账号、个人数据和模型密钥不进入仓库。
