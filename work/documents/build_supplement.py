"""Builds the supplementary evidence PDF.

Deliberately quieter than the other two deliverables. This is an annex: it
supports the proposal rather than competing with it, so it drops the filled
section blocks, statistic cards and dark table headers and reads like a test
record. It shares the page geometry and the typeface family so the three still
look related, and borrows only the low-level helpers from build_docs.

    D:/anaconda3/conda/envs_dirs/campusone-agentflow/python.exe work/documents/build_supplement.py
"""

from __future__ import annotations

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from build_docs import (
    CONFIG,
    OUT,
    RULE_ROWS,
    TEAM_LINE,
    _borders,
    _fixed,
    _margins,
    _no_borders,
    _shade,
    _spacing,
    _widths,
    add_page_number,
    font,
    keep_together,
)

# A narrower measure than the main documents: an annex reads better dense and
# quiet, and the shorter line length is what makes it feel subordinate.
W = 16.0

INK = "1B2430"
BODY = "333E4C"
MUTED = "6B7885"
HAIR = "D5DBE1"
HAIR_SOFT = "E8ECF0"
ACCENT = "3F5A66"
PASS = "2C6046"
FAIL = "9A3B2A"
MONO_BG = "F6F8F9"

FONT_CN = "Microsoft YaHei"
FONT_CN_LIGHT = "Microsoft YaHei Light"
FONT_MONO = "Consolas"

PAGES_URL = "https://echo5177.github.io/campusone-agentflow/"
LIVE_URL = CONFIG["demoUrl"]


# ------------------------------------------------------------------ helpers --


def configure_annex(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(0.9)

    normal = doc.styles["Normal"]
    normal.font.name = "Segoe UI"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN_LIGHT)
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string(BODY)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.widow_control = True

    doc.core_properties.title = "CampusOne 补充材料"
    doc.core_properties.subject = "可由评审自行复核的验证记录"
    doc.core_properties.author = f"{CONFIG['unit']} {TEAM_LINE}"

    header = section.header.paragraphs[0]
    header.text = ""
    _spacing(header, 0, 0, 1)
    font(header.add_run("CampusOne 补充材料 · 验证记录"), 7.5, MUTED)
    add_page_number(section.footer.paragraphs[0])


def rule(doc, color=HAIR, size=4, space=1):
    """A real hairline: a paragraph bottom border.

    A one-row shaded table cannot go thinner than its row height, so it draws a
    bar rather than a line, which is the heaviness this annex is trying to avoid.
    """
    p = doc.add_paragraph()
    _spacing(p, 0, 0, 1)
    p.paragraph_format.keep_with_next = True
    p_pr = p._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), str(space))
    bottom.set(qn("w:color"), color)
    borders.append(bottom)
    p_pr.append(borders)
    return p


def gap(doc, points=8, keep_next=False):
    p = doc.add_paragraph()
    _spacing(p, 0, 0, 1)
    p.paragraph_format.space_after = Pt(points)
    p.paragraph_format.keep_with_next = keep_next
    return p


def text(doc, s, size=10, color=BODY, after=7, indent=0.0):
    p = doc.add_paragraph()
    _spacing(p, after, 0, 1.55)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    font(p.add_run(s), size, color, light=True)
    return p


def section(doc, number, title, standfirst=None, new_page=False):
    """A plain numbered header over a hairline. No filled blocks.

    Sections flow by default: an annex reads as a continuous record, and giving
    each of six short sections its own page left two of them under 3% ink.
    """
    if new_page:
        _drop_trailing_gap(doc)
        doc.add_page_break()
    else:
        gap(doc, 20)
    p = doc.add_paragraph()
    _spacing(p, 3, 0, 1.2)
    p.paragraph_format.keep_with_next = True
    font(p.add_run(f"{number}　"), 10, MUTED, True, mono=True)
    font(p.add_run(title), 14, INK, True)
    if standfirst:
        q = doc.add_paragraph()
        _spacing(q, 5, 0, 1.5)
        q.paragraph_format.keep_with_next = True
        font(q.add_run(standfirst), 9.5, MUTED, light=True)
    rule(doc, ACCENT, 6)
    gap(doc, 11)


def sub(doc, title):
    p = doc.add_paragraph()
    _spacing(p, 4, 12, 1.3)
    p.paragraph_format.keep_with_next = True
    font(p.add_run(title), 10.5, INK, True)


def note(doc, body_text, color=MUTED):
    """An aside set off by a thin left rule rather than a filled box."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [W])
    cell = table.cell(0, 0)
    _margins(cell, 40, 200, 40, 0)
    _borders(
        cell,
        top={"val": "nil"},
        bottom={"val": "nil"},
        right={"val": "nil"},
        left={"val": "single", "sz": "6", "color": HAIR},
    )
    p = cell.paragraphs[0]
    _spacing(p, 0, 0, 1.55)
    font(p.add_run(body_text), 9.5, color, light=True)
    keep_together(doc, table)
    gap(doc, 8)


def steps(doc, items):
    """Action then expected result, as a list rather than a table."""
    for index, (action, expected) in enumerate(items, start=1):
        p = doc.add_paragraph()
        _spacing(p, 1, 0, 1.5)
        p.paragraph_format.left_indent = Cm(0.85)
        p.paragraph_format.first_line_indent = Cm(-0.85)
        p.paragraph_format.keep_with_next = True
        font(p.add_run(f"{index}　"), 9.5, ACCENT, True, mono=True)
        font(p.add_run(action), 10, BODY, light=True)
        q = doc.add_paragraph()
        _spacing(q, 7, 0, 1.5)
        q.paragraph_format.left_indent = Cm(0.85)
        font(q.add_run("看到　"), 9, MUTED, True)
        font(q.add_run(expected), 9.5, INK, light=True)


def record(doc, label, body_text, tone):
    """A verbatim model output, tagged and set in a tinted rule-left block."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [W])
    cell = table.cell(0, 0)
    _shade(cell, MONO_BG)
    _margins(cell, 110, 170, 110, 150)
    _borders(
        cell,
        top={"val": "nil"},
        bottom={"val": "nil"},
        right={"val": "nil"},
        left={"val": "single", "sz": "14", "color": tone},
    )
    p = cell.paragraphs[0]
    _spacing(p, 3, 0, 1.2)
    font(p.add_run(label), 8, tone, True)
    q = cell.add_paragraph()
    _spacing(q, 0, 0, 1.65)
    font(q.add_run(body_text), 9.5, INK, light=True)
    keep_together(doc, table)
    gap(doc, 9)


def code(doc, snippet):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [W])
    cell = table.cell(0, 0)
    _shade(cell, MONO_BG)
    _margins(cell, 110, 150, 110, 150)
    _borders(
        cell,
        top={"val": "single", "sz": "2", "color": HAIR},
        bottom={"val": "single", "sz": "2", "color": HAIR},
        left={"val": "single", "sz": "2", "color": HAIR},
        right={"val": "single", "sz": "2", "color": HAIR},
    )
    first = True
    for line in snippet.split("\n"):
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        _spacing(p, 0, 0, 1.45)
        font(p.add_run(line or " "), 8.4, BODY, mono=True)
    keep_together(doc, table)
    gap(doc, 9)


def table_quiet(doc, headers, rows, widths, size=8.8, mono_cols=()):
    """Hairline rules instead of a filled header bar and zebra striping."""
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    _fixed(table)
    _widths(table, widths)
    head = table.rows[0]
    for idx, label in enumerate(headers):
        cell = head.cells[idx]
        _margins(cell, 60, 0 if idx == 0 else 110, 80, 110)
        p = cell.paragraphs[0]
        _spacing(p, 0, 0, 1.25)
        font(p.add_run(label), size - 0.4, MUTED, True)
    for row in rows:
        cells = table.add_row().cells
        for idx, value in enumerate(row):
            cell = cells[idx]
            _margins(cell, 80, 0 if idx == 0 else 110, 80, 110)
            p = cell.paragraphs[0]
            _spacing(p, 0, 0, 1.45)
            is_mono = idx in mono_cols
            font(
                p.add_run(value),
                size - 0.3 if is_mono else size,
                BODY,
                mono=is_mono,
                light=not is_mono,
            )
    _widths(table, widths)
    for index, row in enumerate(table.rows):
        for cell in row.cells:
            _borders(
                cell,
                top={"val": "nil"},
                left={"val": "nil"},
                right={"val": "nil"},
                bottom={
                    "val": "single",
                    "sz": "6" if index == 0 else "2",
                    "color": ACCENT if index == 0 else HAIR_SOFT,
                },
            )
    keep_together(doc, table)
    gap(doc, 10)


def _drop_trailing_gap(doc):
    body_el = doc.element.body
    for element in reversed(body_el):
        if element.tag.endswith("}sectPr"):
            continue
        if not element.tag.endswith("}p"):
            return
        if element.findall(qn("w:r")):
            return
        body_el.remove(element)
        return


# --------------------------------------------------------------------- doc --


def build():
    doc = Document()
    configure_annex(doc)

    # Masthead rather than a cover page: an annex should not open with a hero.
    p = doc.add_paragraph()
    _spacing(p, 2, 0, 1.2)
    font(p.add_run("CampusOne　可信校园事务智能体"), 9.5, MUTED, True)
    h = doc.add_paragraph()
    _spacing(h, 4, 0, 1.2)
    font(h.add_run("补充材料：验证记录"), 20, INK, True)
    s = doc.add_paragraph()
    _spacing(s, 10, 0, 1.55)
    font(
        s.add_run("本材料不复述方案书。它只提供两类内容：评审可以自己动手复现的操作，以及系统运行时留下的原始记录。"),
        10,
        BODY,
        light=True,
    )
    rule(doc, ACCENT, 8)
    gap(doc, 12)

    meta = doc.add_table(rows=3, cols=4)
    meta.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(meta)
    _widths(meta, [2.4, 5.6, 2.4, 5.6])
    cells = [
        ("参赛单位", CONFIG["unit"]),
        ("团队名称", CONFIG.get("teamName", "")),
        ("团队成员", TEAM_LINE),
        ("指导教师", CONFIG["advisor"]),
        ("版本", "2026 年 9 月 · 初赛提交版"),
        ("测试基准", "自动化测试 105 项，全部通过"),
    ]
    for index, (key, value) in enumerate(cells):
        row, col = divmod(index, 2)
        kc = meta.cell(row, col * 2)
        vc = meta.cell(row, col * 2 + 1)
        for cell in (kc, vc):
            _margins(cell, 50, 0, 50, 80)
            _no_borders(cell)
        pk = kc.paragraphs[0]
        _spacing(pk, 0, 0, 1.4)
        font(pk.add_run(key), 8.5, MUTED)
        pv = vc.paragraphs[0]
        _spacing(pv, 0, 0, 1.4)
        font(pv.add_run(value), 9, INK)
    keep_together(doc, meta, with_previous=False)
    gap(doc, 14)

    # ------------------------------------------------------------------ 01 --
    section(
        doc,
        "01",
        "请您自己验证",
        "两个入口，三个动作。不需要安装任何东西，也不需要我们的密钥。",
    )
    table_quiet(
        doc,
        ["入口", "地址", "说明"],
        [
            ["浏览器版", PAGES_URL, "无需密钥，打开即用，AI 为本地可复现输出"],
            ["私有站点", LIVE_URL, "接入真实模型 deepseek-chat，显示真实调用耗时"],
        ],
        [2.6, 7.2, 6.2],
        8.6,
        mono_cols=(1,),
    )
    text(
        doc,
        "两个入口的规则引擎、校验层和状态机完全一致，区别只在 AI 那一层是真实调用还是本地可复现输出。"
        "下面三个动作在任一入口都成立，各自一分钟内可以看到结果。",
    )

    sub(doc, "动作一　让程序否掉一个明显不合规的申请")
    steps(
        doc,
        [
            ("在“申请办理”页，把“预计人数”改成 800（该场地核定容量 120 人）",
             "右侧“预计人数”由“容量可用”变为“需调整”"),
            ("点击“规则预检”",
             "六条规则逐条给出判定，VENUE-CAP-001 标红，写明“预计 800 人，超过场地容量 120 人”"),
            ("点击“让 AI 帮我整理”",
             "AI 文字上方先出现“规则预检未通过 · 1 项”，并注明“以上结论由规则引擎判定，不由模型给出”"),
        ],
    )
    note(
        doc,
        "合规判定不经过模型。模型看得到规则结论，但改不了它，也不被允许自己下结论。"
        "第 04 节给出了这条约束缺失时，模型实际说过的话。",
    )

    sub(doc, "动作二　让模型引用一条不存在的规则")
    steps(
        doc,
        [
            ("在右侧“演示模型异常”中选择“虚构规则”", "下方提示说明该开关在真实模型下同样生效"),
            ("点击“运行表单整理”", "AI 面板显示“输出已拒绝”，错误码 RULE_NOT_FOUND"),
            ("打开左侧“AI 运行证据”", "该次运行记为“已拒绝”，保留任务、模型、耗时与错误码"),
        ],
    )
    text(
        doc,
        "注入方式是把一个不存在的规则编号 VENUE-RULE-999 放进模型输出中已声明的字段里。"
        "校验器扫描整份输出，发现编号不在规则目录中即拒绝。被拒绝的内容不会显示给用户，业务状态也不变化。",
    )

    sub(doc, "动作三　以申请人身份直接批准自己的申请")
    text(doc, "界面上没有这个按钮，所以这一条要用开发者工具发请求。在私有站点按 F12 打开控制台，粘贴：")
    code(
        doc,
        "fetch('/api/case', { method: 'POST',\n"
        "  headers: { 'Content-Type': 'application/json' },\n"
        "  body: JSON.stringify({ action: 'transition', to: 'approved',\n"
        "                         role: 'admin', actorId: 'admin-zhou' })\n"
        "}).then(r => r.status)",
    )
    text(
        doc,
        "返回 409，案件状态不变。业务接口不读取请求里的身份字段，操作角色只认服务端会话，"
        "伪造身份这条路在接口层就是堵死的。",
    )

    # ------------------------------------------------------------------ 02 --
    section(doc, "02", "判定与证据的绑定关系", "每条规则有编号，每个编号有制度依据，模型只能引用真实存在的编号。")
    table_quiet(doc, ["规则编号", "判定内容", "制度依据"], RULE_ROWS, [3.4, 8.0, 4.6], 8.8, mono_cols=(0, 2))
    text(
        doc,
        "规则目录、证据白名单和知识检索读取同一份定义，一条规则不会只存在于其中一处。"
        "模型输出里出现的每个编号都会被比对：规则编号要在目录中，证据编号要指向真实存在的表单字段、"
        "场地事实、知识条目或管理员填写的退回意见。",
    )

    sub(doc, "输出要通过的四道校验")
    steps(
        doc,
        [
            ("结构校验", "发给模型的契约由校验用的同一份 Schema 生成，描述与校验不会不一致"),
            ("规则编号校验", "扫描整份输出，出现目录里没有的编号即拒绝"),
            ("证据编号校验", "引用的证据必须真实存在"),
            ("语义校验", "已退回的案件，通知草稿中不得出现“等待审批”“无需修改”这类与状态矛盾的表述"),
        ],
    )
    table_quiet(
        doc,
        ["拒绝码", "触发条件", "重试"],
        [
            ["INVALID_JSON", "返回的不是合法 JSON", "是"],
            ["SCHEMA_MISMATCH", "字段缺失、多余或类型不符", "是"],
            ["SEMANTIC_CONFLICT", "内容与案件当前状态矛盾", "是"],
            ["RULE_NOT_FOUND", "引用了不存在的规则编号", "否"],
            ["EVIDENCE_NOT_FOUND", "引用了不存在的证据编号", "否"],
            ["MODEL_TIMEOUT", "模型未在预算内返回", "否"],
        ],
        [4.4, 9.2, 2.4],
        8.8,
        mono_cols=(0,),
    )
    text(
        doc,
        "可重试的三类会带着校验器的具体报错再问模型一次，仍不通过则降级为固定文案。"
        "每次尝试单独留痕，被拦下的那次也留在运行记录里。",
    )

    # ------------------------------------------------------------------ 03 --
    section(doc, "03", "故障注入实测", "三类任务乘三种故障，九种组合逐一实测。")
    text(
        doc,
        "演示开关不是把结果写死。它先让系统真实调用一次模型，再对返回结果注入故障；"
        "超时则是把请求预算收缩到真实中断为止。所以证据面板里的拒绝理由和耗时都是实测值。",
    )
    table_quiet(
        doc,
        ["任务", "非法 JSON", "虚构规则", "模型超时"],
        [
            ["表单整理", "INVALID_JSON", "RULE_NOT_FOUND", "MODEL_TIMEOUT"],
            ["审核摘要", "INVALID_JSON", "RULE_NOT_FOUND", "MODEL_TIMEOUT"],
            ["退回通知", "INVALID_JSON", "RULE_NOT_FOUND", "MODEL_TIMEOUT"],
        ],
        [3.0, 4.4, 4.4, 4.2],
        8.6,
        mono_cols=(1, 2, 3),
    )
    text(
        doc,
        "九种组合的错误码全部符合预期。超时故障实测约 614 毫秒后中断，记录的是真实等待时间。"
        "三次故障期间案件状态均未发生变化。",
    )

    # ------------------------------------------------------------------ 04 --
    section(
        doc,
        "04",
        "开发中发现并修复的三个缺陷",
        "把真实出错的原话放出来，比声称系统可靠更能说明这套约束在做事。",
    )
    text(
        doc,
        "三条都是开发过程中真实出现过的。共同点是接口全部返回成功、自动化测试全绿，"
        "但模型说的话是错的。这正是我们把模型语义单独列为一类验收项的原因。",
    )

    sub(doc, "缺陷一　模型对着一条正在失败的规则说了假话")
    text(doc, "把预计人数改成 800（场地容量 120 人）后运行表单整理，规则 VENUE-CAP-001 正在失败，模型却回复：")
    record(doc, "修复前 · 模型原话", "已验证的活动信息完整，符合场地申请要求。", FAIL)
    text(
        doc,
        "原因是表单整理当时是唯一不跑规则引擎的任务，只把裸表单发给模型。它没有任何规则结论，"
        "被要求解释自己的工作时就自行补了一个合规判断。修复后同一输入的回复：",
    )
    record(
        doc,
        "修复后 · 模型原话",
        "申请表单必填字段齐全，时间顺序有效，且当前时段无冲突、设备需求可满足、在场地开放时间内。"
        "但预计人数 800 人超过场地容量 120 人，因此申请未通过校验。建议调整活动人数或更换更大场地。",
        PASS,
    )
    text(doc, "复验：同一输入连续 6 次真实模型调用，每次都如实说明超出容量，无一次给出合规结论。")

    sub(doc, "缺陷二　退回通知写成了“已提交、等待审批”")
    text(doc, "对一份已被管理员退回的申请生成退回通知，模型输出：")
    record(doc, "修复前 · 模型原话", "您的场地申请已提交，我们正在处理中。请留意后续通知。", FAIL)
    text(
        doc,
        "这条通知通过了当时的全部校验，因为它结构合法、没有引用假编号，问题在于内容与案件状态相反。"
        "该任务同样没有拿到案件状态：给它一份规则全过的申请，它合理地推断案件还在审批中。修复后：",
    )
    record(
        doc,
        "修复后 · 模型原话",
        "您好，您提交的“2026 秋季社团招新宣讲会”场地申请已收到。经初步核对，预计参加人数为 80 人，"
        "已接近场地容量上限（120 人）。为保障活动安全有序进行，请您补充现场秩序维护与疏散安排的具体说明，"
        "并重新提交申请。",
        PASS,
    )
    text(
        doc,
        "处置分三层：接口从服务端读取当前状态与管理员填写的退回意见并传入；新增语义校验，"
        "已退回状态下出现等待审批类表述直接拒绝并允许重试；模型被拒时的降级文案直接引用管理员原话。"
        "复验：连续 8 次真实模型调用全部通过，无矛盾表述，每次都引用了管理员填写的原句。",
    )

    sub(doc, "缺陷三　故障演示只在本地模式生效")
    text(
        doc,
        "三种模型异常的演示开关原本接在本地模式分支上，接入真实模型后点击没有反应；"
        "其中“虚构规则”还会报成结构错误，与演示口径不符。原因是故障注入与模型模式耦合，"
        "且注入方式对不同任务不一致。修复后故障与模型模式解耦，先真实调用再注入，"
        "超时改为收缩真实请求预算。复验即第 03 节的九种组合，全部符合预期。",
    )

    # ------------------------------------------------------------------ 05 --
    section(doc, "05", "测试与实测记录", "测试证明接口与状态路径正确；模型语义另行实测。")
    text(
        doc,
        "自动化测试 105 项全部通过，覆盖方案书列出的 T01 至 T21 全部用例，"
        "其中包含浏览器演示版的相关用例。三份材料引用的数字取自同一次运行。",
    )

    sub(doc, "权限、并发与流程")
    table_quiet(
        doc,
        ["实测项", "结果"],
        [
            ["完整状态链", "草稿到提交、接件、退回、修订 V2、再提交、批准、归档，共 9 条事件，V1 与 V2 并存"],
            ["伪造管理员身份批准", "服务端返回 409，案件状态未变"],
            ["四个并发重复提交", "只产生一条事件，四个请求均返回 200，幂等键由服务端推导"],
            ["空退回意见的退回", "被拒绝，返回 RETURN_REASON_REQUIRED"],
            ["两个会话同时访问", "各自持有独立案件，重置只清除调用者自己的案件"],
        ],
        [4.4, 11.6],
        8.8,
    )

    sub(doc, "真实模型 deepseek-chat")
    table_quiet(
        doc,
        ["实测项", "结果"],
        [
            ["表单整理连续 6 次", "全部通过校验，单次耗时 1.2 至 1.4 秒"],
            ["超容量输入下的表述", "6 次全部如实说明超出容量，无合规断言"],
            ["退回通知连续 8 次", "全部通过，无等待审批类矛盾表述，均引用管理员原句"],
            ["三类任务 × 三种故障", "9 种组合错误码全部符合预期"],
            ["超时故障", "约 614 毫秒后中断，记录为真实耗时"],
        ],
        [4.4, 11.6],
        8.8,
    )
    note(
        doc,
        "自动化测试通过只说明接口与状态路径正确，不代表模型文案的业务语义一定正确。"
        "本项目两次语义缺陷都是在接口全绿的情况下发现的，因此把模型语义单独列为一类验收项，"
        "并在第 04 节公开了原始出错记录。",
    )

    # ------------------------------------------------------------------ 06 --
    section(doc, "06", "边界声明", "把没做的事说清楚，比把做过的事说满更重要。")
    table_quiet(
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
        [4.4, 11.6],
        8.8,
    )
    text(
        doc,
        "下一阶段先邀请至少 3 名同学试用，记录完成时间与看不懂的字段，"
        "再建立审批时长、退回率和人工采纳率基线。这些数字现在还没有，所以不写。",
    )

    path = OUT / "CampusOne_补充材料.docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    print(f"wrote {build()}")
