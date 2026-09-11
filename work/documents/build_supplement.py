"""Builds the supplementary evidence PDF.

Imports the design system from build_docs so the three documents look like one
set. Importing that module does not rebuild the other two deliverables: those
only run under its __main__ guard.

    D:/anaconda3/conda/envs_dirs/campusone-agentflow/python.exe work/documents/build_supplement.py
"""

from __future__ import annotations

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH

from build_docs import (
    BRAND,
    BRAND_TINT,
    CONFIG,
    CONTENT_W,
    HAIRLINE,
    INK,
    OUT,
    PAGE_TINT,
    SLATE,
    TEAM_LINE,
    WARN_BG,
    WARN_FG,
    WHITE,
    _margins,
    _no_borders,
    _shade,
    _fixed,
    _widths,
    _spacing,
    body,
    bullets,
    callout,
    configure,
    font,
    keep_together,
    kicker,
    numbered,
    rule_line,
    section_opener,
    spacer,
    stat_cards,
    table_block,
)

PAGES_URL = "https://echo5177.github.io/campusone-agentflow/"
LIVE_URL = CONFIG["demoUrl"]


def quote_block(doc, label, text, tone_fg, tone_bg):
    """A verbatim model output. The point of this document is that these are
    things the model actually said, not paraphrases of them."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [CONTENT_W])
    cell = table.cell(0, 0)
    _shade(cell, tone_bg)
    _no_borders(cell)
    _margins(cell, 130, 150, 130, 150)
    p = cell.paragraphs[0]
    _spacing(p, 3, 0, 1.3)
    font(p.add_run(label), 8.5, tone_fg, True)
    q = cell.add_paragraph()
    _spacing(q, 0, 0, 1.6)
    font(q.add_run(f"\u201c{text}\u201d"), 9.5, INK, light=True)
    keep_together(doc, table)
    spacer(doc, 8)


def steps(doc, rows):
    """Numbered verification steps: what to click, and what to look for."""
    table_block(
        doc,
        ["步骤", "操作", "应当看到"],
        rows,
        [1.6, 7.2, 8.2],
        8.8,
        mono_cols=(),
    )


def build() -> "object":
    doc = Document()
    configure(doc, "CampusOne 补充材料", "可由评审自行复核的验证证据")

    # ---------------------------------------------------------------- cover --
    spacer(doc, 26)
    rule_line(doc, BRAND, 3.2, 0.09)
    spacer(doc, 14)
    kicker(doc, "补充材料 / SUPPLEMENTARY EVIDENCE")
    h = doc.add_paragraph()
    _spacing(h, 4, 0, 1.05)
    font(h.add_run("CampusOne"), 40, INK, True)
    s = doc.add_paragraph()
    _spacing(s, 16, 0, 1.25)
    font(s.add_run("这些结论，您可以自己验证一遍"), 16, "0B535B", True)
    callout(
        doc,
        "这份材料是做什么的",
        "它不复述方案书。项目的核心主张是“模型的输出会被拦住，而且拦得住这件事可以被检验”，"
        "而录屏无法证明一次拒绝是真的校验还是写死的分支。所以这里只放两类东西："
        "可以由评审亲自点开复现的操作，以及系统运行时留下的原始记录。",
        BRAND,
        BRAND_TINT,
        12,
    )
    stat_cards(
        doc,
        [
            ("60 秒", "可自行复现", "三个动作，浏览器即可"),
            ("105", "自动化测试", "全部通过"),
            ("3", "已修复缺陷", "含模型原话与复验"),
        ],
    )
    spacer(doc, 16)

    meta = doc.add_table(rows=5, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(meta)
    _widths(meta, [3.2, CONTENT_W - 3.2])
    fields = [
        ("参赛单位", CONFIG["unit"]),
        ("团队名称", CONFIG.get("teamName", "")),
        ("团队成员", TEAM_LINE),
        ("指导教师", CONFIG["advisor"]),
        ("版本", "2026 年 9 月 · 初赛提交版"),
    ]
    for row, (key, value) in zip(meta.rows, fields):
        for cell in row.cells:
            _margins(cell, 85, 0, 85, 0)
            from build_docs import _borders

            _borders(
                cell,
                top={"val": "nil"},
                left={"val": "nil"},
                right={"val": "nil"},
                bottom={"val": "single", "sz": "2", "color": HAIRLINE},
            )
        p0 = row.cells[0].paragraphs[0]
        _spacing(p0, 0, 0, 1.3)
        font(p0.add_run(key), 9, SLATE, True)
        p1 = row.cells[1].paragraphs[0]
        _spacing(p1, 0, 0, 1.3)
        font(p1.add_run(value), 9.5, INK)
    keep_together(doc, meta, with_previous=False)
    spacer(doc, 14)
    p = doc.add_paragraph()
    _spacing(p, 0, 0, 1.4)
    font(
        p.add_run("说明：本材料引用的每一条结果都来自对运行中系统的实测，均可按第 01 节的方式复现。"),
        8.5,
        SLATE,
        light=True,
    )

    # ------------------------------------------------------------------ 01 --
    section_opener(doc, "01", "请您自己验证", "两个入口，三个动作。不需要装任何东西，也不需要我们的密钥。")

    table_block(
        doc,
        ["入口", "地址", "说明"],
        [
            ["浏览器版（推荐）", PAGES_URL, "无需密钥，打开即用，AI 为本地可复现输出"],
            ["私有站点", LIVE_URL, "接入真实模型 deepseek-chat，展示真实调用耗时"],
        ],
        [3.4, 7.6, 6.0],
        8.6,
        mono_cols=(1,),
    )
    body(
        doc,
        "两个入口的规则引擎、校验层和状态机完全一致，区别只在 AI 那一层是真实调用还是本地可复现输出。"
        "下面三个动作在任一入口都成立，各自一分钟内可以看到结果。",
    )

    doc.add_heading("动作一：让程序否掉一个明显不合规的申请", level=2)
    steps(
        doc,
        [
            ["1", "在“申请办理”页，把“预计人数”改成 800（该场地容量 120 人）", "右侧事实卡片中“预计人数”由“容量可用”变为“需调整”"],
            ["2", "点击“规则预检”", "六条规则逐条给出判定，VENUE-CAP-001 标红并写明“预计 800 人，超过场地容量 120 人”"],
            ["3", "点击“让 AI 帮我整理”", "AI 文字上方先出现红色“规则预检未通过 · 1 项”，并注明“以上结论由规则引擎判定，不由模型给出”"],
        ],
    )
    callout(
        doc,
        "这一步在证明什么",
        "合规判定不经过模型。模型看得到规则结论，但改不了它，也不被允许自己下结论。"
        "第 05 节给出了这条约束缺失时模型实际说过的话。",
        BRAND,
        BRAND_TINT,
    )

    doc.add_heading("动作二：让模型说一条不存在的规则，看它被拦下来", level=2)
    steps(
        doc,
        [
            ["1", "在右侧“演示模型异常”下拉框中选择“虚构规则”", "下方提示说明该开关在真实模型下同样生效"],
            ["2", "点击“运行表单整理”", "AI 面板显示“输出已拒绝”，错误码为 RULE_NOT_FOUND"],
            ["3", "打开左侧“AI 运行证据”", "该次运行被记录为“已拒绝”，保留任务、模型、耗时与错误码"],
        ],
    )
    body(
        doc,
        "注入方式是把一个不存在的规则编号 VENUE-RULE-999 放进模型输出中已声明的字段里。"
        "校验器扫描整份输出，发现编号不在规则目录中即拒绝。被拒绝的输出不会显示给用户，"
        "业务状态也不发生任何变化。",
    )

    doc.add_heading("动作三：以申请人身份直接批准自己的申请", level=2)
    body(
        doc,
        "这一条需要用开发者工具发一个请求，因为界面上根本没有这个按钮。在私有站点按 F12 打开控制台，粘贴：",
    )
    code_block(
        doc,
        "fetch('/api/case', { method: 'POST',\n"
        "  headers: { 'Content-Type': 'application/json' },\n"
        "  body: JSON.stringify({ action: 'transition', to: 'approved',\n"
        "                         role: 'admin', actorId: 'admin-zhou' })\n"
        "}).then(r => r.status)",
    )
    body(
        doc,
        "返回 409，案件状态不变。业务接口不读取请求里的身份字段，操作角色只认服务端会话，"
        "所以伪造身份这条路在接口层就是堵死的。",
    )

    # ------------------------------------------------------------------ 02 --
    section_opener(doc, "02", "判定与证据是怎么绑定的", "每条规则有编号，每条编号有制度依据，模型只能引用真实存在的编号。")
    from build_docs import RULE_ROWS

    table_block(doc, ["规则编号", "判定内容", "制度依据"], RULE_ROWS, [3.6, 8.6, 4.8], 8.8, mono_cols=(0, 2))
    body(
        doc,
        "规则目录、证据白名单和知识检索读的是同一份定义，所以一条规则不可能只存在于其中一处。"
        "模型输出里出现的每一个编号都会被比对：规则编号要在目录中，证据编号要指向真实存在的表单字段、"
        "场地事实、知识条目或管理员填写的退回意见。",
    )

    doc.add_heading("输出要过的几道关", level=2)
    numbered(
        doc,
        [
            "结构校验：发给模型的契约由校验用的同一份 Schema 直接生成，描述和校验不会不一致。",
            "规则编号校验：扫描整份输出，出现目录里没有的编号即拒绝。",
            "证据编号校验：引用的证据必须真实存在。",
            "语义校验：已退回的案件，通知草稿中不得出现“等待审批”“无需修改”这类与状态矛盾的表述。",
        ],
    )
    table_block(
        doc,
        ["拒绝码", "触发条件", "是否重试"],
        [
            ["INVALID_JSON", "返回的不是合法 JSON", "是"],
            ["SCHEMA_MISMATCH", "字段缺失、多余或类型不符", "是"],
            ["SEMANTIC_CONFLICT", "内容与案件当前状态矛盾", "是"],
            ["RULE_NOT_FOUND", "引用了不存在的规则编号", "否"],
            ["EVIDENCE_NOT_FOUND", "引用了不存在的证据编号", "否"],
            ["MODEL_TIMEOUT", "模型未在预算内返回", "否"],
        ],
        [4.2, 8.4, 4.4],
        8.8,
        mono_cols=(0,),
    )
    body(
        doc,
        "可重试的三类会带着校验器的具体报错再问模型一次，仍不通过就降级为固定文案。"
        "每一次尝试单独留痕，被拦下的那次也留在运行记录里，不会被悄悄抹掉。",
    )

    # ------------------------------------------------------------------ 03 --
    section_opener(doc, "03", "故障注入实测", "三类任务乘三种故障，九种组合逐一实测。")
    body(
        doc,
        "演示开关不是把结果写死。它先让系统真实调用一次模型，再对返回结果注入故障；"
        "超时则是把请求预算收缩到真实中断为止。所以证据面板里的拒绝理由和耗时都是实测值。",
    )
    table_block(
        doc,
        ["任务", "非法 JSON", "虚构规则", "模型超时"],
        [
            ["表单整理 form_assist", "INVALID_JSON", "RULE_NOT_FOUND", "MODEL_TIMEOUT"],
            ["审核摘要 review_brief", "INVALID_JSON", "RULE_NOT_FOUND", "MODEL_TIMEOUT"],
            ["退回通知 return_message_draft", "INVALID_JSON", "RULE_NOT_FOUND", "MODEL_TIMEOUT"],
        ],
        [5.0, 4.0, 4.0, 4.0],
        8.6,
        mono_cols=(1, 2, 3),
    )
    body(
        doc,
        "九种组合的错误码全部符合预期。超时故障实测约 614 毫秒后中断，"
        "记录的是真实等待时间而不是预先填好的数字。三次故障期间案件状态均未发生变化。",
    )

    # ------------------------------------------------------------------ 04 --
    section_opener(
        doc,
        "04",
        "我们主动找出并修复的三个缺陷",
        "把真实出错的原话放出来，比声称系统可靠更能说明这套约束在做事。",
    )
    body(
        doc,
        "下面三条都是开发过程中真实出现过的。它们的共同点是：接口全部返回成功、"
        "自动化测试全绿，但模型说的话是错的。这正是我们把“模型语义”单独列为一类验收项的原因。",
    )

    doc.add_heading("缺陷一：模型对着一条正在失败的规则说了假话", level=2)
    body(doc, "把预计人数改成 800（场地容量 120）后运行表单整理，规则 VENUE-CAP-001 正在失败，模型却回复：")
    quote_block(doc, "修复前 · 模型原话", "已验证的活动信息完整，符合场地申请要求。", WARN_FG, WARN_BG)
    body(
        doc,
        "原因是表单整理当时是唯一不跑规则引擎的任务，只把裸表单发给模型。它没有任何规则结论，"
        "被要求解释自己的工作时就自行补了一个合规判断。修复后同一输入的回复：",
    )
    quote_block(
        doc,
        "修复后 · 模型原话",
        "申请表单必填字段齐全，时间顺序有效，且当前时段无冲突、设备需求可满足、在场地开放时间内。"
        "但预计人数 800 人超过场地容量 120 人，因此申请未通过校验。建议调整活动人数或更换更大场地。",
        "1B6B4F",
        "E9F5EF",
    )
    body(doc, "复验：同一输入连续 6 次真实模型调用，每次都如实说明超出容量，无一次给出合规结论。")

    doc.add_heading("缺陷二：退回通知写成了“已提交、等待审批”", level=2)
    body(doc, "对一份已被管理员退回的申请生成退回通知，模型输出：")
    quote_block(
        doc,
        "修复前 · 模型原话",
        "您的场地申请已提交，我们正在处理中。请留意后续通知。",
        WARN_FG,
        WARN_BG,
    )
    body(
        doc,
        "这条通知通过了当时的全部校验，因为它结构合法、没有引用假编号。问题在于内容与案件状态相反。"
        "该任务同样没有拿到案件状态：给它一份规则全过的申请，它合理地推断案件还在审批中。修复后：",
    )
    quote_block(
        doc,
        "修复后 · 模型原话",
        "您好，您提交的“2026 秋季社团招新宣讲会”场地申请已收到。经初步核对，预计参加人数为 80 人，"
        "已接近场地容量上限（120 人）。为保障活动安全有序进行，请您补充现场秩序维护与疏散安排的具体说明，"
        "并重新提交申请。",
        "1B6B4F",
        "E9F5EF",
    )
    body(
        doc,
        "处置分三层：接口从服务端读取当前状态与管理员填写的退回意见并传入；新增语义校验，"
        "已退回状态下出现等待审批类表述直接拒绝并允许重试；模型被拒时的降级文案直接引用管理员原话，"
        "保证通知里始终有申请人真正需要的那一句。复验：连续 8 次真实模型调用全部通过，"
        "无矛盾表述，每次都引用了管理员填写的原句。",
    )

    doc.add_heading("缺陷三：故障演示只在本地模式生效", level=2)
    body(
        doc,
        "三种模型异常的演示开关原本接在本地模式分支上，接入真实模型后点击没有反应；"
        "其中“虚构规则”还会报成结构错误，与演示口径不符。原因是故障注入与模型模式耦合，"
        "且注入方式对不同任务不一致。修复后故障与模型模式解耦，先真实调用再注入，"
        "超时改为收缩真实请求预算。复验即第 03 节的九种组合，全部符合预期。",
    )

    # ------------------------------------------------------------------ 05 --
    section_opener(doc, "05", "自动化测试与实测记录", "测试证明接口与状态路径正确；模型语义另行实测。")
    stat_cards(
        doc,
        [
            ("105", "自动化测试", "12 个测试文件全部通过"),
            ("9", "闭环事件", "含一次退回与修订 V2"),
            ("0", "高危依赖", "Critical / High"),
        ],
    )
    spacer(doc, 10)
    body(
        doc,
        "测试覆盖方案书列出的 T01 至 T21 全部用例，其中包含浏览器演示版的相关用例。"
        "三份材料引用的数字取自同一次运行。",
    )

    doc.add_heading("权限、并发与流程", level=2)
    bullets(
        doc,
        [
            "完整状态链走通：草稿到提交、接件、退回、修订 V2、再提交、批准、归档，共 9 条事件，V1 与 V2 并存。",
            "申请人在请求体里伪造管理员身份直接批准，服务端返回 409，案件状态未变。",
            "四个并发的重复提交只产生一条事件，四个请求均返回 200，幂等键由服务端推导。",
            "空退回意见的退回请求被拒绝，返回 RETURN_REASON_REQUIRED。",
            "两个不同会话各自持有独立案件，互不影响；重置演示只清除调用者自己的案件。",
        ],
        10,
        4,
    )

    doc.add_heading("真实模型（deepseek-chat）", level=2)
    table_block(
        doc,
        ["实测项", "结果"],
        [
            ["表单整理连续 6 次", "全部通过校验，单次耗时 1.2 至 1.4 秒"],
            ["超容量输入下的表述", "6 次全部如实说明超出容量，无合规断言"],
            ["退回通知连续 8 次", "全部通过，无等待审批类矛盾表述，均引用管理员原句"],
            ["三类任务 × 三种故障", "9 种组合错误码全部符合预期"],
            ["超时故障", "约 614 毫秒后中断，记录为真实耗时"],
        ],
        [6.0, 11.0],
        8.8,
    )

    # ------------------------------------------------------------------ 06 --
    section_opener(doc, "06", "边界声明", "把没做的事说清楚，比把做过的事说满更重要。")
    table_block(
        doc,
        ["事项", "当前状态"],
        [
            ["场地、制度与申请数据", "全部为模拟数据，不含任何真实师生信息"],
            ["身份切换入口", "演示专用。生产环境删除该路由，改由学校统一身份认证写入同一会话"],
            ["知识检索", "按规则绑定取用四份制度文件，不是向量召回"],
            ["已占用时段", "静态演示数据，未接入真实排期系统"],
            ["退回通知", "只产出草稿，界面没有发送动作，不构成站内或邮件送达"],
            ["效率提升数据", "尚未开展真实试点，本阶段不给出任何百分比"],
        ],
        [5.0, 12.0],
        8.8,
    )
    callout(
        doc,
        "关于口径",
        "自动化测试通过只说明接口与状态路径正确，不代表模型文案的业务语义一定正确。"
        "本项目两次语义缺陷都是在接口全绿的情况下发现的，因此把模型语义单独列为一类验收项，"
        "并在第 04 节公开了原始出错记录。",
        WARN_FG,
        WARN_BG,
    )
    body(
        doc,
        "下一阶段先邀请至少 3 名同学试用，记录完成时间与看不懂的字段，"
        "再建立审批时长、退回率和人工采纳率基线。这些数字现在还没有，所以不写。",
    )

    path = OUT / "CampusOne_补充材料.docx"
    doc.save(path)
    return path


def code_block(doc, text: str) -> None:
    """Monospaced block for something the reviewer is meant to paste and run."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [CONTENT_W])
    cell = table.cell(0, 0)
    _shade(cell, "0F1B2E")
    _no_borders(cell)
    _margins(cell, 130, 150, 130, 150)
    first = True
    for line in text.split("\n"):
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        _spacing(p, 0, 0, 1.45)
        font(p.add_run(line or " "), 8.6, "CFE6E4", mono=True)
    keep_together(doc, table)
    spacer(doc, 8)


if __name__ == "__main__":
    built = build()
    print(f"wrote {built}")
