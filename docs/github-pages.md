# GitHub Pages 静态 Mock 演示

公开入口：https://echo5177.github.io/campusone-agentflow/

这个入口复用当前 CampusOne 界面，全部业务操作在浏览器中完成，无需登录、数据库、服务端接口或 API Key。原有服务端站点仍使用原来的构建方式。

## 可演示内容

- 填写和保存申请、六项确定性规则预检。
- 表单整理、审核摘要、退回通知三类 Mock 输出；输出仍经过 Schema、规则编号、证据引用校验。
- 申请人提交，管理员开始审核、填写退回意见、批准和归档。
- 申请人按退回意见修订，生成 V2；旧版本和事件记录保留。
- 非 JSON、虚构规则、超时三类故障；失败有记录，仍可人工办理。
- 本地保存办理进度；重置演示同时清除记录并恢复申请人身份。

页面明确标注 Mock。角色切换和档案用于演示流程，本地存储不具备服务端身份认证、跨设备同步或防篡改能力。访客数据只保存在当前浏览器的 `campusone-pages-v1` 项，不会上传。浏览器禁用存储时会提示刷新后重置。

## 本地预览

```powershell
npm ci
npm run dev:pages
```

打开终端显示的地址，路径为 `/campusone-agentflow/`。

```powershell
npm run build:pages
npm run preview:pages
```

静态产物输出到 `dist-pages/`。此目录包含 HTML、CSS 和 JavaScript；不包含原始方案书、PPT、录音视频、环境文件或服务端代码。字体使用系统回退，不访问 Google Fonts。

## 自动发布

`.github/workflows/pages.yml` 在相关代码推送到 `main` 时执行检查、测试和静态构建，并上传 `dist-pages/` 到 GitHub Pages。也可在 Actions 中手动运行 `Deploy Mock demo to GitHub Pages`。

仓库保持私有，Pages 网站公开。构建与部署使用 GitHub 自动提供的 `GITHUB_TOKEN`，不需要配置模型 API Key 或额外部署密钥。

`vite.pages.config.ts` 将客户端请求模块替换为浏览器 Mock；入口放在 `static-demo/`，避免被现有应用识别为 Pages Router 路由。Mock 输出模板与服务端 Mock 共享，规则、状态机、故障注入和验证器也复用现有实现。

更换仓库名称时，Actions 会自动采用新的仓库路径；本地构建可以设置 `PAGES_BASE_PATH`。

## 录制时的口径

原脚本的点击顺序和表单内容可继续用于此入口。开场说明“本次使用无需密钥的 Mock 演示版本”。介绍运行证据时说“Mock 输出经过实际校验”，耗时是本地处理耗时。介绍权限与档案时说明当前页面模拟办理流程，服务端版本负责真实会话与数据库留痕。

GitHub Pages 的国内访问效果仍取决于访问者的网络环境，不能保证所有地区均可访问。
