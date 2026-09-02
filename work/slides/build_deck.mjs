import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const artifactToolPath = path.join(
  process.env.USERPROFILE,
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs",
);
const { Presentation, PresentationFile } = await import(pathToFileURL(artifactToolPath).href);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..").replaceAll("\\", "/");
const CONFIG = JSON.parse(await fs.readFile(`${ROOT}/competition.config.json`, "utf8"));
const IDENTITY_LINE = `${CONFIG.unit}  ·  ${CONFIG.teamMembers.join(" / ")}  ·  ${CONFIG.advisor}`;
const OUT = `${ROOT}/deliverables/CampusOne_项目简介与路演答辩.pptx`;
const PREVIEW = `${ROOT}/work/slides/artifact_preview`;
const OG = `${ROOT}/public/og.png`;
const SCREEN = `${ROOT}/work/slides/campusone-dashboard-viewport.png`;

const C = {
  navy: "#102A43",
  navy2: "#173F5F",
  ink: "#183247",
  teal: "#0E9F8F",
  mint: "#DDF6F1",
  coral: "#F26B4A",
  sand: "#FFF3E8",
  blue: "#EAF2F8",
  white: "#FFFFFF",
  slate: "#5C6F7F",
  light: "#F4F7F9",
  line: "#D9E2E8",
  dark: "#081D2C",
  green: "#1B7F5C",
  red: "#B42318",
};

const W = 1280;
const H = 720;
const PAGE = { left: 72, top: 54, width: 1136, height: 612 };

function rect(slide, x, y, w, h, fill, radius = true, line = C.line, lineWidth = 1) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: lineWidth },
    ...(radius ? { borderRadius: "rounded-xl" } : {}),
  });
}

function textbox(slide, text, x, y, w, h, size = 24, color = C.ink, bold = false, align = "left") {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: size,
    color,
    bold,
    alignment: align,
    fontFamily: "Microsoft YaHei",
  };
  return shape;
}

function label(slide, text, x, y, w, fill = C.mint, color = C.teal) {
  rect(slide, x, y, w, 30, fill, true, fill, 0);
  textbox(slide, text, x + 12, y + 5, w - 24, 20, 11, color, true, "center");
}

function addHeader(slide, section, title, subtitle, number) {
  textbox(slide, section.toUpperCase(), PAGE.left, PAGE.top, 310, 22, 11, C.teal, true);
  textbox(slide, title, PAGE.left, PAGE.top + 35, 940, 58, 34, C.navy, true);
  if (subtitle) textbox(slide, subtitle, PAGE.left, PAGE.top + 95, 1020, 34, 15, C.slate, false);
  rect(slide, PAGE.left, PAGE.top + 135, PAGE.width, 3, C.teal, false, C.teal, 0);
  textbox(slide, String(number).padStart(2, "0"), 1154, 654, 54, 18, 10, C.slate, true, "right");
}

function addNotes(slide, sourceLines, presenterLines = []) {
  const notes = [
    ...presenterLines,
    "",
    "[Sources]",
    ...sourceLines.map((s) => `- ${s}`),
  ].join("\n");
  slide.speakerNotes.textFrame.setText(notes);
}

function addCard(slide, { x, y, w, h, tag, title, body, fill = C.white, accent = C.teal }) {
  rect(slide, x, y, w, h, fill, true, C.line, 1);
  rect(slide, x, y, 8, h, accent, true, accent, 0);
  if (tag) textbox(slide, tag, x + 24, y + 18, w - 42, 20, 10, accent, true);
  textbox(slide, title, x + 24, y + (tag ? 45 : 24), w - 44, 48, 20, C.navy, true);
  textbox(slide, body, x + 24, y + (tag ? 95 : 76), w - 44, Math.max(20, h - (tag ? 112 : 92)), 12, C.slate, false);
}

function addMetric(slide, x, y, w, value, title, note, fill = C.white, accent = C.teal) {
  rect(slide, x, y, w, 142, fill, true, C.line, 1);
  textbox(slide, value, x + 18, y + 18, w - 36, 42, 30, accent, true, "center");
  textbox(slide, title, x + 18, y + 64, w - 36, 28, 14, C.navy, true, "center");
  textbox(slide, note, x + 18, y + 101, w - 36, 26, 10, C.slate, false, "center");
}

function addPill(slide, x, y, w, text, fill, color) {
  rect(slide, x, y, w, 35, fill, true, fill, 0);
  textbox(slide, text, x + 8, y + 7, w - 16, 22, 11, color, true, "center");
}

function arrow(slide, x, y, w = 40) {
  textbox(slide, "→", x, y, w, 34, 24, C.teal, true, "center");
}

async function imageBytes(path) {
  const bytes = await fs.readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(PREVIEW, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  const ogBytes = await imageBytes(OG);
  const screenBytes = await imageBytes(SCREEN);

  // 01 — cover-image-field
  {
    const s = presentation.slides.add();
    s.background.fill = C.dark;
    rect(s, 0, 0, 1280, 720, C.dark, false, C.dark, 0);
    rect(s, 746, 0, 534, 720, C.navy, false, C.navy, 0);
    s.images.add({ blob: ogBytes, contentType: "image/png", alt: "CampusOne 品牌主视觉", fit: "cover", position: { left: 758, top: 72, width: 450, height: 236 }, geometry: "roundRect", borderRadius: "rounded-2xl" });
    label(s, "教育管理应用创新赛 · 初赛", 72, 62, 250, C.mint, C.teal);
    textbox(s, "CampusOne", 72, 145, 620, 80, 56, C.white, true);
    textbox(s, "可信校园事务智能体", 72, 226, 620, 58, 32, "#7BE0D2", true);
    textbox(s, "一名会解释、会整理，\n但不会越权审批的数字协作员工。", 72, 310, 610, 108, 23, "#D9E6EE", false);
    addPill(s, 72, 464, 178, "规则优先", "#153A52", "#7BE0D2");
    addPill(s, 266, 464, 200, "证据可追溯", "#153A52", "#7BE0D2");
    addPill(s, 482, 464, 232, "人工最终确认", "#153A52", "#7BE0D2");
    textbox(s, IDENTITY_LINE, 72, 628, 720, 25, 11, "#9FB6C5", false);
    addMetric(s, 780, 350, 188, "13 / 13", "单元测试", "全部通过", "#102A43", "#7BE0D2");
    addMetric(s, 988, 350, 188, "9", "闭环事件", "含退回 / V2", "#102A43", "#FF9B7D");
    addMetric(s, 780, 512, 396, "可运行 · 可审计 · 可降级", "当前状态", "私有部署 / Mock 稳定演示", "#102A43", C.white);
    addNotes(s, ["项目工作区《比赛简介和要求.md》（访问于 2026-09-02）", "CampusOne README 与测试记录（GitHub Private Repository）"], ["开场先讲产品定位，不展开技术栈。"]);
  }

  // 02 — two-column comparison
  {
    const s = presentation.slides.add(); s.background.fill = C.light;
    addHeader(s, "WHY NOW", "问题不在“没有表单”", "而在理解、核对、解释与责任边界没有被一起设计。", 2);
    addCard(s, { x: 72, y: 225, w: 350, h: 330, tag: "学生申请人", title: "我到底缺什么？", body: "规则分散、字段不清；\n提交后只看到状态，\n看不到原因和下一步。", fill: C.white, accent: C.coral });
    addCard(s, { x: 465, y: 225, w: 350, h: 330, tag: "行政审核人", title: "为什么重复核对？", body: "在表单、材料和规则间来回切换；\n退回意见反复编写；\n摘要无法回到证据。", fill: C.white, accent: C.teal });
    addCard(s, { x: 858, y: 225, w: 350, h: 330, tag: "管理者", title: "过程如何追溯？", body: "缺少版本、操作者、规则命中、\n模型运行和失败降级记录。", fill: C.white, accent: C.navy2 });
    textbox(s, "高频 · 规则密集 · 多角色 · 需要问责", 72, 587, 1136, 35, 18, C.navy, true, "center");
    addNotes(s, ["CampusOne 需求分析，docs/competition-scope.md", "参赛团队拟定的场地申请业务计划"], ["三类痛点分别对应三类角色。"]);
  }

  // 03 — three-layer principle
  {
    const s = presentation.slides.add(); s.background.fill = C.white;
    addHeader(s, "DESIGN PRINCIPLE", "AI 不是审批人", "把能力分配给最擅长、也最能承担责任的一方。", 3);
    const xs = [72, 455, 838];
    const cards = [
      ["01", "AI 理解", "整理申请说明\n生成审核摘要\n改写已确定的退回原因", C.teal, C.mint],
      ["02", "程序判定", "校验字段 / 日期 / 容量 / 冲突\n控制权限与状态机\n检查模型引用和事实", C.navy2, C.blue],
      ["03", "人工确认", "采纳 AI 建议\n判断软性风险\n退回 / 批准 / 办结", C.coral, C.sand],
    ];
    cards.forEach((c, i) => {
      rect(s, xs[i], 223, 326, 326, c[4], true, c[4], 0);
      rect(s, xs[i] + 24, 248, 52, 52, c[3], true, c[3], 0);
      textbox(s, c[0], xs[i] + 24, 260, 52, 26, 16, C.white, true, "center");
      textbox(s, c[1], xs[i] + 24, 322, 276, 44, 26, C.navy, true);
      textbox(s, c[2], xs[i] + 24, 389, 278, 110, 14, C.ink, false);
    });
    arrow(s, 410, 365); arrow(s, 793, 365);
    addPill(s, 398, 585, 484, "模型可替换，责任边界不漂移", C.navy, C.white);
    addNotes(s, ["CampusOne 技术架构，docs/architecture.md", "CampusOne 智能体设计方案书，第 4–8 节"], ["强调：AI 的价值没有减少，但权限被明确限制。"]);
  }

  // 04 — timeline
  {
    const s = presentation.slides.add(); s.background.fill = C.light;
    addHeader(s, "USER JOURNEY", "一条包含退回与修订的完整事务链", "每一步都有角色、状态、版本和事件记录。", 4);
    rect(s, 105, 348, 1040, 6, C.line, false, C.line, 0);
    const steps = [
      ["01", "填表", "学生", C.teal], ["02", "预检", "程序", C.navy2], ["03", "提交", "学生", C.teal],
      ["04", "审核", "审核人", C.coral], ["05", "退回", "审核人", C.coral], ["06", "修订 V2", "学生", C.teal],
      ["07", "批准", "审核人", C.coral], ["08", "办结", "审核人", C.green],
    ];
    steps.forEach((st, i) => {
      const x = 82 + i * 144;
      rect(s, x, 319, 62, 62, st[3], true, st[3], 0);
      textbox(s, st[0], x, 337, 62, 25, 14, C.white, true, "center");
      textbox(s, st[1], x - 25, 404, 112, 28, 14, C.navy, true, "center");
      textbox(s, st[2], x - 25, 439, 112, 24, 10, C.slate, false, "center");
    });
    addPill(s, 275, 528, 730, "draft → submitted → under_review → returned → draft(V2) → … → completed", C.white, C.navy);
    addNotes(s, ["CampusOne 状态机实现与手工 E2E 记录", "docs/architecture.md；docs/test-plan.md"], ["在“退回”处停顿：旧版本不覆盖，而是创建 V2。"]);
  }

  // 05 — product proof / cover-image-field
  {
    const s = presentation.slides.add(); s.background.fill = C.dark;
    textbox(s, "PRODUCT", 72, 55, 220, 22, 11, "#7BE0D2", true);
    textbox(s, "不是原型，\n是可以现场运行的产品", 72, 105, 580, 112, 38, C.white, true);
    textbox(s, "固定演示数据 · 一键重置 · 角色动作 · 规则证据 · 故障注入", 72, 240, 610, 55, 16, "#B8CCD8", false);
    addPill(s, 72, 326, 180, "学生申请", "#153A52", "#7BE0D2");
    addPill(s, 268, 326, 180, "审核协作", "#153A52", "#7BE0D2");
    addPill(s, 464, 326, 180, "证据审计", "#153A52", "#7BE0D2");
    rect(s, 72, 418, 590, 150, "#0E2738", true, "#244B62", 1);
    textbox(s, "现场可证明", 98, 443, 190, 28, 13, "#7BE0D2", true);
    textbox(s, "正常闭环  /  退回修订  /  非法模型输出被拒绝", 98, 489, 520, 42, 18, C.white, true);
    rect(s, 770, 62, 365, 596, C.white, true, "#2A4C60", 1);
    s.images.add({ blob: screenBytes, contentType: "image/png", alt: "CampusOne 移动端完整页面截图", fit: "contain", position: { left: 794, top: 82, width: 317, height: 556 }, geometry: "roundRect", borderRadius: "rounded-xl" });
    textbox(s, "05", 1154, 654, 54, 18, 10, "#9FB6C5", true, "right");
    addNotes(s, ["http://localhost:3000/ 本地运行截图（2026-09-02）", "https://campusone-agentflow.atticus-5951.chatgpt.site（私有生产站点）"], ["此页直接切到浏览器演示，不停留讲视觉细节。"]);
  }

  // 06 — architecture
  {
    const s = presentation.slides.add(); s.background.fill = C.white;
    addHeader(s, "ARCHITECTURE", "业务控制面包围模型能力", "模型只在受限任务和结构化输出中工作。", 6);
    const layers = [
      ["交互层", "学生申请 / 审核台 / 证据视图", C.mint, C.teal],
      ["领域层", "表单 Schema / 规则 / 状态机 / 版本 / 权限", C.blue, C.navy2],
      ["Agent 层", "任务模板 / 最小上下文 / 解析 / 校验 / 降级", C.sand, C.coral],
      ["知识层", "规则 / 指南 / 设备说明 / 来源片段", "#F3ECFF", "#7C3AED"],
      ["数据层", "D1 / SQLite · 7 张表 · 事件与 AI 运行", "#E9F7ED", C.green],
    ];
    layers.forEach((l, i) => {
      const y = 201 + i * 78;
      rect(s, 72, y, 1136, 58, l[2], true, l[2], 0);
      textbox(s, l[0], 100, y + 15, 170, 28, 16, l[3], true);
      textbox(s, l[1], 278, y + 15, 895, 28, 14, C.ink, false);
    });
    addPill(s, 896, 583, 312, "密钥仅在服务端环境变量", C.navy, C.white);
    addNotes(s, ["docs/architecture.md", "CampusOne 源码：app/api、lib、db 目录"], ["从上往下讲；强调领域层才拥有正式写权限。"]);
  }

  // 07 — agent tasks
  {
    const s = presentation.slides.add(); s.background.fill = C.light;
    addHeader(s, "AGENT CONTRACTS", "三个窄任务，统一安全外壳", "清晰契约比高权限自治更适合正式校园事务。", 7);
    addCard(s, { x: 72, y: 210, w: 350, h: 356, tag: "FORM_ASSIST", title: "把申请说清楚", body: "输入：已填字段 + 最小指南\n\n输出：润色建议 / 缺项\n\n人工确认后才采用；\n不改人数、日期等事实。", fill: C.white, accent: C.teal });
    addCard(s, { x: 465, y: 210, w: 350, h: 356, tag: "REVIEW_BRIEF", title: "把证据排整齐", body: "输入：事实 + 规则结果 + 证据\n\n输出：摘要 / 通过失败项 / 人工判断项\n\n不能发明规则，不能批准。", fill: C.white, accent: C.navy2 });
    addCard(s, { x: 858, y: 210, w: 350, h: 356, tag: "RETURN_MESSAGE", title: "把原因讲明白", body: "输入：程序已确认的退回原因\n\n输出：友好说明 / 修改步骤\n\n不能增加新理由，不能自动发送。", fill: C.white, accent: C.coral });
    addPill(s, 315, 594, 650, "严格 JSON → Schema → 任务 → 引用 → 事实 → 降级", C.navy, C.white);
    addNotes(s, ["CampusOne Agent API 实现与输出 Schema", "CampusOne 智能体设计方案书，第 6 节"], ["这页用‘能做/不能做’快速讲清权限。"]);
  }

  // 08 — rules comparison
  {
    const s = presentation.slides.add(); s.background.fill = C.white;
    addHeader(s, "DETERMINISTIC RULES", "可计算规则，不交给大模型", "模型负责解释；程序负责是否通过。", 8);
    const rules = [
      ["REQ-001", "必填字段", "缺失字段列表"], ["CAP-001", "人数 ≤ 容量", "申请人数 / 容量"],
      ["TIME-001", "结束 > 开始", "起止时间"], ["HOUR-001", "处于开放时段", "申请/开放时段"],
      ["CONFLICT-001", "同场地无冲突", "冲突事务编号"],
    ];
    rules.forEach((r, i) => {
      const y = 196 + i * 76;
      addPill(s, 72, y, 160, r[0], i === 1 ? C.sand : C.mint, i === 1 ? C.coral : C.teal);
      textbox(s, r[1], 264, y + 6, 330, 28, 16, C.navy, true);
      textbox(s, r[2], 616, y + 7, 310, 26, 13, C.slate, false);
      addPill(s, 1000, y, 208, i === 1 ? "失败即阻止提交" : "返回明确证据", i === 1 ? C.sand : C.light, i === 1 ? C.red : C.slate);
    });
    addNotes(s, ["CampusOne 规则引擎源代码与 docs/test-plan.md", "设计方案书，第 7 节"], ["演示 CAP-001：人数超过容量时，规则 ID 与事实同时出现。"]);
  }

  // 09 — state/version timeline
  {
    const s = presentation.slides.add(); s.background.fill = C.light;
    addHeader(s, "AUDIT TRAIL", "退回不是覆盖，而是生成 V2", "历史版本保持只读，状态变化追加事件。", 9);
    rect(s, 72, 202, 510, 390, C.white, true, C.line, 1);
    label(s, "版本记录", 96, 226, 112, C.blue, C.navy2);
    addCard(s, { x: 98, y: 275, w: 456, h: 135, tag: "V1 · RETURNED", title: "申请人数 120", body: "保留原始事实与退回理由", fill: C.sand, accent: C.coral });
    arrow(s, 303, 414, 44);
    addCard(s, { x: 98, y: 449, w: 456, h: 135, tag: "V2 · APPROVED", title: "申请人数 80", body: "修改后重新提交并批准", fill: C.mint, accent: C.teal });
    rect(s, 626, 202, 582, 390, C.dark, true, C.dark, 0);
    textbox(s, "事件时间轴", 652, 228, 240, 28, 15, "#7BE0D2", true);
    const events = ["创建申请", "AI 表单建议", "规则预检", "提交", "开始审核", "退回", "创建 V2", "重新提交 / 审核", "批准 / 办结"];
    events.forEach((e, i) => {
      const col = i < 5 ? 0 : 1;
      const row = col === 0 ? i : i - 5;
      const x = col === 0 ? 654 : 926;
      const y = 278 + row * 55;
      rect(s, x, y + 4, 12, 12, i === 5 ? C.coral : C.teal, true, "none", 0);
      textbox(s, e, x + 24, y, 240, 24, 12, C.white, i === 5);
    });
    addNotes(s, ["CampusOne case_versions 与 case_events 表", "人工 E2E 验证记录（9 个关键事件）"], ["强调事件是追加式证据，不依赖模型生成。"]);
  }

  // 10 — trust/failure injection
  {
    const s = presentation.slides.add(); s.background.fill = C.white;
    addHeader(s, "FAIL SAFE", "安全不是口号：现场注入故障", "错误被看见、被记录，但不会改变事务状态。", 10);
    const faults = [
      ["invalid_json", "模型返回非 JSON", "结构解析拒绝", C.coral],
      ["rule_999", "引用不存在规则", "RULE_NOT_FOUND", C.red],
      ["timeout", "模型超时", "固定模板降级", C.navy2],
    ];
    faults.forEach((f, i) => addCard(s, { x: 72 + i * 393, y: 222, w: 350, h: 215, tag: f[0], title: f[1], body: `结果：${f[2]}\n\n正式状态：保持不变`, fill: i === 1 ? C.sand : C.light, accent: f[3] }));
    rect(s, 72, 478, 1136, 96, C.dark, true, C.dark, 0);
    textbox(s, "模型失败 ≠ 业务失败", 100, 500, 360, 34, 24, C.white, true);
    textbox(s, "记录 AI 运行 → 返回明确错误 → 启用确定性降级 → 人工继续处理", 490, 506, 680, 28, 15, "#B8CCD8", false);
    addNotes(s, ["CampusOne 故障注入实现：none / invalid_json / rule_999 / timeout", "人工 WebMCP 与 API 验证记录"], ["现场选择 rule_999，展示 RULE_NOT_FOUND 和状态不变。"]);
  }

  // 11 — metrics layout
  {
    const s = presentation.slides.add(); s.background.fill = C.light;
    addHeader(s, "VERIFICATION", "已经执行的结果，不是愿景数字", "工程测试、浏览器验收和依赖审计共同构成证据。", 11);
    addMetric(s, 72, 213, 258, "13 / 13", "Vitest 单测", "规则 / 状态 / AI 契约", C.white, C.teal);
    addMetric(s, 354, 213, 258, "PASS", "完整 E2E", "含退回 / V2 / 办结", C.white, C.navy2);
    addMetric(s, 636, 213, 258, "PASS", "WebMCP", "3 项工具契约验证", C.white, C.coral);
    addMetric(s, 918, 213, 290, "0", "高危依赖", "Critical / High", C.white, C.green);
    addCard(s, { x: 72, y: 385, w: 546, h: 170, tag: "幂等性", title: "重复迁移不产生重复事件", body: "同一幂等键重复调用，事件总数保持不变。", fill: C.white, accent: C.teal });
    addCard(s, { x: 646, y: 385, w: 562, h: 170, tag: "模型引用校验", title: "rule_999 被拒绝", body: "返回 RULE_NOT_FOUND；事务状态保持不变。", fill: C.white, accent: C.coral });
    addPill(s, 364, 590, 552, "真实用户试点：待团队组织 ≥3 人并保留原始记录", C.sand, C.coral);
    addNotes(s, ["npm test / npm run build / npm audit 执行结果（2026-09-02）", "docs/test-plan.md；设计方案书第 12 节"], ["主动说明：用户试点尚未执行，因此不报虚构效率提升。"]);
  }

  // 12 — innovation + value
  {
    const s = presentation.slides.add(); s.background.fill = C.white;
    addHeader(s, "INNOVATION & VALUE", "创新不在“让模型做更多”", "而在让每个结论都可验证、每个高风险动作都可控。", 12);
    const items = [
      ["双控制面", "语言理解与业务决策解耦", C.teal],
      ["证据化 Agent", "规则 / 知识 / 事实 / 版本统一引用", C.navy2],
      ["故障可演示", "非 JSON / 超时 / 虚假规则现场验证", C.coral],
      ["跨场景复用", "可信控制面可迁移到其他校园事务", C.green],
    ];
    items.forEach((it, i) => {
      const x = 72 + (i % 2) * 574;
      const y = 214 + Math.floor(i / 2) * 170;
      rect(s, x, y, 546, 138, C.light, true, C.line, 1);
      rect(s, x + 22, y + 24, 10, 88, it[2], true, it[2], 0);
      textbox(s, it[0], x + 52, y + 26, 440, 34, 21, C.navy, true);
      textbox(s, it[1], x + 52, y + 73, 455, 38, 13, C.slate, false);
    });
    addPill(s, 218, 573, 844, "价值用真实指标验证：填表时长 / 首次通过率 / 退回次数 / 审核时长", C.navy, C.white);
    addNotes(s, ["CampusOne 智能体设计方案书，第 14 节", "比赛评分维度：创新性与应用价值（项目工作区赛事材料）"], ["创新与价值分开讲：前者是机制，后者需要试点数据验证。"]);
  }

  // 13 — roadmap timeline
  {
    const s = presentation.slides.add(); s.background.fill = C.light;
    addHeader(s, "ROADMAP", "从可信样板到校内试点", "先验证，再接入；先治理，再扩展。", 13);
    const stages = [
      ["S0", "初赛样板", "产品 / 测试 / 部署 / 路演", "已完成", C.teal],
      ["S1", "小规模试点", "3–10 名用户 / 指标基线 / 规则校对", "下一步", C.coral],
      ["S2", "真实系统接入", "SSO / OA / 场地数据 / 合规评审", "需校方授权", C.navy2],
      ["S3", "复制新场景", "设备借用 / 访客 / 证明申请", "中期", C.green],
    ];
    stages.forEach((st, i) => {
      const x = 72 + i * 282;
      rect(s, x, 223, 258, 320, C.white, true, C.line, 1);
      rect(s, x, 223, 258, 62, st[4], true, st[4], 0);
      textbox(s, st[0], x + 18, 242, 50, 25, 14, C.white, true);
      textbox(s, st[1], x + 24, 313, 210, 36, 20, C.navy, true);
      textbox(s, st[2], x + 24, 373, 210, 74, 12, C.slate, false);
      addPill(s, x + 24, 481, 210, st[3], i === 0 ? C.mint : C.light, i === 0 ? C.teal : C.slate);
    });
    addPill(s, 305, 579, 670, "团队信息待补：产品答辩 / 前端交互 / 后端 Agent / 测试材料", C.sand, C.coral);
    addNotes(s, ["CampusOne 智能体设计方案书，第 15 节", "docs/delivery-checklist.md"], ["明确团队信息是提交前唯一的身份类必填项。"]);
  }

  // 14 — closing / cover-image-field
  {
    const s = presentation.slides.add(); s.background.fill = C.dark;
    rect(s, 0, 0, 1280, 720, C.dark, false, C.dark, 0);
    rect(s, 734, 0, 546, 720, C.navy, false, C.navy, 0);
    s.images.add({ blob: ogBytes, contentType: "image/png", alt: "CampusOne 可信智能体主视觉", fit: "contain", position: { left: 772, top: 128, width: 470, height: 247 }, geometry: "roundRect", borderRadius: "rounded-2xl" });
    rect(s, 0, 0, 734, 720, C.dark, false, C.dark, 0);
    addPill(s, 814, 430, 170, "规则优先", "#153A52", "#7BE0D2");
    addPill(s, 1000, 430, 200, "证据可追溯", "#153A52", "#7BE0D2");
    addPill(s, 814, 486, 386, "人工最终确认", "#153A52", "#7BE0D2");
    textbox(s, "CAMPUSONE", 72, 74, 250, 24, 11, "#7BE0D2", true);
    textbox(s, "让校园智能体\n真正进入业务，\n又始终保持可控。", 72, 145, 610, 188, 42, C.white, true);
    textbox(s, "AI 理解  ·  程序判定  ·  人工确认", 72, 368, 600, 38, 20, "#B8CCD8", false);
    addPill(s, 72, 451, 520, "可运行 · 可审计 · 可降级 · 可复制", "#153A52", "#7BE0D2");
    textbox(s, "私有演示站点", 72, 545, 170, 24, 11, "#7BE0D2", true);
    textbox(s, "campusone-agentflow.atticus-5951.chatgpt.site", 72, 580, 600, 30, 14, C.white, false);
    textbox(s, "THANK YOU", 72, 644, 230, 24, 11, "#9FB6C5", true);
    addNotes(s, ["https://campusone-agentflow.atticus-5951.chatgpt.site", "https://github.com/echo5177/campusone-agentflow（Private）"], ["收束到一句话：一个可用、可审计、不会越权的数字协作员工。"]);
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(`${PREVIEW}/${stem}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${PREVIEW}/${stem}.layout.json`, await layout.text());
  }
  await writeBlob(`${PREVIEW}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);
  console.log(`saved ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
