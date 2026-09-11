"""Builds the two Word deliverables from one source of truth.

Identity comes from competition.config.json; every number quoted in the prose is
one that was actually measured against the running system. Run with:

    conda run -n campusone-agentflow python work/documents/build_docs.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "deliverables"
OUT.mkdir(parents=True, exist_ok=True)
CONFIG = json.loads((ROOT / "competition.config.json").read_text(encoding="utf-8"))
TEAM = CONFIG["teamMembers"]
CAPTAIN = CONFIG["teamCaptain"]
TEAM_LINE = "、".join(f"{name}（队长）" if name == CAPTAIN else name for name in TEAM)

# Palette lifted from the product itself, so the documents and the running demo
# read as one thing rather than two unrelated design exercises.
INK = "16233A"
INK_SOFT = "2C3E56"
BRAND = "0F6E78"
BRAND_DEEP = "0B535B"
BRAND_TINT = "E6F2F3"
SLATE = "5A6B7B"
HAIRLINE = "DCE4EA"
PAGE_TINT = "F5F8F9"
WHITE = "FFFFFF"
PASS_FG, PASS_BG = "1B6B4F", "E9F5EF"
WARN_FG, WARN_BG = "8A5A12", "FBF3E1"
FAIL_FG, FAIL_BG = "A8321F", "FBEDEA"

# Microsoft YaHei ships with Windows; the Light weight reads better at body size
# and falls back to the regular weight anywhere it is missing.
FONT_CN = "Microsoft YaHei"
FONT_CN_LIGHT = "Microsoft YaHei Light"
FONT_LATIN = "Segoe UI"
FONT_MONO = "Consolas"

CONTENT_W = 17.0


# ---------------------------------------------------------------- low level --


def _shade(cell, color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), color)


def _borders(cell, **edges) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    node = tc_pr.first_child_found_in("w:tcBorders")
    if node is None:
        node = OxmlElement("w:tcBorders")
        tc_pr.append(node)
    for edge in ("top", "left", "bottom", "right"):
        if edge not in edges:
            continue
        tag = "w:" + edge
        el = node.find(qn(tag))
        if el is None:
            el = OxmlElement(tag)
            node.append(el)
        for key, value in edges[edge].items():
            el.set(qn("w:" + key), str(value))


def _no_borders(cell) -> None:
    _borders(
        cell,
        top={"val": "nil"},
        bottom={"val": "nil"},
        left={"val": "nil"},
        right={"val": "nil"},
    )


def _margins(cell, top=90, start=120, bottom=90, end=120) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = tc_pr.first_child_found_in("w:tcMar")
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tc_pr.append(mar)
    for name, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = mar.find(qn(f"w:{name}"))
        if node is None:
            node = OxmlElement(f"w:{name}")
            mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def _fixed(table) -> None:
    tbl_pr = table._tbl.tblPr
    layout = tbl_pr.first_child_found_in("w:tblLayout")
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        tbl_pr.append(layout)
    layout.set(qn("w:type"), "fixed")


def _widths(table, widths_cm: list[float]) -> None:
    """Sets cell widths and the table grid together.

    python-docx leaves tblGrid at its equal-column default. With a fixed layout
    Word then has two disagreeing sources for the column positions and resolves
    it by widening the table: a three-column block declared at 17cm rendered at
    19.2cm and ran off the right margin. Writing the grid removes the conflict.
    """
    twips = [int(round(width * 567)) for width in widths_cm]
    grid = table._tbl.find(qn("w:tblGrid"))
    if grid is None:
        grid = OxmlElement("w:tblGrid")
        table._tbl.insert(1, grid)
    for existing in grid.findall(qn("w:gridCol")):
        grid.remove(existing)
    for value in twips:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(value))
        grid.append(col)

    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(twips)))
    tbl_w.set(qn("w:type"), "dxa")

    for row in table.rows:
        for idx, width in enumerate(widths_cm):
            cell = row.cells[idx]
            cell.width = Cm(width)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(int(width * 567)))
            tc_w.set(qn("w:type"), "dxa")


def _cant_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:cantSplit")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def keep_together(doc, table, with_previous=True, keep_next=False) -> None:
    """Stops Word breaking a layout block across pages.

    Word will happily push a table onto a page of its own and leave the heading
    that introduces it stranded at the bottom of the previous one. Marking every
    row unsplittable, chaining the rows with keep-with-next, and pinning the
    paragraph above the table keeps each block whole.
    """
    rows = table.rows
    for index, row in enumerate(rows):
        _cant_split(row)
        if index == len(rows) - 1 and not keep_next:
            continue
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.keep_with_next = True
    if not with_previous:
        return
    previous = table._tbl.getprevious()
    while previous is not None and not previous.tag.endswith("}p"):
        previous = previous.getprevious()
    if previous is None:
        return
    if previous.findall(".//" + qn("w:br")):
        return
    p_pr = previous.find(qn("w:pPr"))
    if p_pr is None:
        p_pr = OxmlElement("w:pPr")
        previous.insert(0, p_pr)
    keep = p_pr.find(qn("w:keepNext"))
    if keep is None:
        keep = OxmlElement("w:keepNext")
        p_pr.append(keep)


def _repeat_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def font(run, size=10.5, color=INK, bold=False, mono=False, light=False):
    """Sets the Latin and CJK faces together; Word needs both to be explicit."""
    latin = FONT_MONO if mono else FONT_LATIN
    cjk = FONT_MONO if mono else (FONT_CN_LIGHT if light else FONT_CN)
    run.font.name = latin
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), latin)
    rfonts.set(qn("w:hAnsi"), latin)
    rfonts.set(qn("w:eastAsia"), cjk)
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.font.bold = bold
    return run


def _spacing(paragraph, after=6, before=0, line=1.45) -> None:
    pf = paragraph.paragraph_format
    pf.space_after = Pt(after)
    pf.space_before = Pt(before)
    pf.line_spacing = line


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = font(paragraph.add_run("CampusOne · "), 8, SLATE)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)


def configure(doc: Document, title: str, subject: str) -> None:
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.9)
    section.bottom_margin = Cm(1.7)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.header_distance = Cm(0.8)
    section.footer_distance = Cm(0.7)

    normal = doc.styles["Normal"]
    normal.font.name = FONT_LATIN
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN_LIGHT)
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.line_spacing = 1.45
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.widow_control = True

    for name, size, color in (
        ("Title", 34, INK),
        ("Heading 1", 19, INK),
        ("Heading 2", 13, BRAND_DEEP),
        ("Heading 3", 10.5, INK_SOFT),
    ):
        style = doc.styles[name]
        style.font.name = FONT_LATIN
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_CN)
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(14 if name == "Heading 2" else 10)
        style.paragraph_format.space_after = Pt(6)
        style.paragraph_format.line_spacing = 1.25

    doc.core_properties.title = title
    doc.core_properties.subject = subject
    doc.core_properties.author = f"{CONFIG['unit']} {TEAM_LINE}"
    doc.core_properties.keywords = "智能体, 教育管理, 大模型, 场地申请, CampusOne"

    header = section.header.paragraphs[0]
    header.text = ""
    run = font(header.add_run("CAMPUSONE  可信校园事务智能体"), 8, BRAND, True)
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    _spacing(header, 0, 0, 1)
    add_page_number(section.footer.paragraphs[0])


# --------------------------------------------------------------- components --


def rule_line(doc, color=BRAND, width=CONTENT_W, thickness=0.06) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [width])
    cell = table.cell(0, 0)
    _shade(cell, color)
    _no_borders(cell)
    _margins(cell, 0, 0, 0, 0)
    cell.height = Cm(thickness)
    p = cell.paragraphs[0]
    _spacing(p, 0, 0, 1)
    font(p.add_run(" "), 1, color)
    keep_together(doc, table, with_previous=False)


def kicker(doc, text: str, color=BRAND) -> None:
    p = doc.add_paragraph()
    _spacing(p, 5, 0, 1)
    run = font(p.add_run(text.upper()), 8.5, color, True)
    run.font.name = FONT_LATIN


def body(doc, text: str, size=10.5, color=INK, after=7) -> None:
    p = doc.add_paragraph()
    _spacing(p, after, 0, 1.5)
    font(p.add_run(text), size, color, light=True)


def lead(doc, text: str) -> None:
    p = doc.add_paragraph()
    _spacing(p, 10, 0, 1.5)
    font(p.add_run(text), 11.5, INK_SOFT, light=True)


def bullets(doc, items: Iterable[str], size=10.5, after=4) -> None:
    for item in items:
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.62)
        pf.first_line_indent = Cm(-0.62)
        _spacing(p, after, 0, 1.45)
        font(p.add_run("· "), size, BRAND, True)
        font(p.add_run(item), size, INK, light=True)


def numbered(doc, items: Iterable[str], size=10.5) -> None:
    for index, item in enumerate(items, start=1):
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.72)
        pf.first_line_indent = Cm(-0.72)
        _spacing(p, 5, 0, 1.45)
        font(p.add_run(f"{index:02d}  "), size, BRAND, True, mono=True)
        font(p.add_run(item), size, INK, light=True)


def callout(doc, title: str, text: str, accent=BRAND, fill=BRAND_TINT, after=8) -> None:
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [0.16, CONTENT_W - 0.16])
    left, right = table.cell(0, 0), table.cell(0, 1)
    _shade(left, accent)
    _shade(right, fill)
    for cell in (left, right):
        _no_borders(cell)
    _margins(left, 0, 0, 0, 0)
    _margins(right, 150, 170, 150, 170)
    p = right.paragraphs[0]
    _spacing(p, 3, 0, 1.3)
    font(p.add_run(title), 10.5, accent, True)
    p2 = right.add_paragraph()
    _spacing(p2, 0, 0, 1.45)
    font(p2.add_run(text), 9.8, INK, light=True)
    keep_together(doc, table)
    spacer(doc, after)


def spacer(doc, points=8, keep_next=False):
    p = doc.add_paragraph()
    _spacing(p, 0, 0, 1)
    p.paragraph_format.space_after = Pt(points)
    p.paragraph_format.keep_with_next = keep_next
    return p


def stat_cards(doc, cards: list[tuple[str, str, str]]) -> None:
    table = doc.add_table(rows=1, cols=len(cards))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [CONTENT_W / len(cards)] * len(cards))
    for idx, (value, label, note) in enumerate(cards):
        cell = table.cell(0, idx)
        _shade(cell, PAGE_TINT)
        _margins(cell, 170, 150, 160, 150)
        _borders(
            cell,
            top={"val": "single", "sz": "4", "color": WHITE},
            bottom={"val": "single", "sz": "4", "color": WHITE},
            left={"val": "single", "sz": "12", "color": WHITE},
            right={"val": "single", "sz": "12", "color": WHITE},
        )
        p = cell.paragraphs[0]
        _spacing(p, 2, 0, 1)
        font(p.add_run(value), 19, BRAND, True, mono=True)
        p2 = cell.add_paragraph()
        _spacing(p2, 1, 0, 1.2)
        font(p2.add_run(label), 9.5, INK, True)
        p3 = cell.add_paragraph()
        _spacing(p3, 0, 0, 1.3)
        font(p3.add_run(note), 8.2, SLATE, light=True)
    keep_together(doc, table)


def table_block(doc, headers, rows, widths, size=8.8, mono_cols=(), after=8) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    _fixed(table)
    _widths(table, widths)
    head = table.rows[0]
    _repeat_header(head)
    for idx, text in enumerate(headers):
        cell = head.cells[idx]
        _shade(cell, INK)
        _margins(cell, 110, 120, 110, 120)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        _spacing(p, 0, 0, 1.2)
        font(p.add_run(text), size, WHITE, True)
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        for idx, text in enumerate(row):
            cell = cells[idx]
            _shade(cell, WHITE if ridx % 2 == 0 else PAGE_TINT)
            _margins(cell, 100, 120, 100, 120)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            p = cell.paragraphs[0]
            _spacing(p, 0, 0, 1.3)
            is_mono = idx in mono_cols
            font(
                p.add_run(text),
                size - 0.2 if is_mono else size,
                INK_SOFT if is_mono else INK,
                mono=is_mono,
                light=not is_mono,
            )
    # Re-applied now that the data rows exist; the first call only reached the
    # header row, leaving the rest on python-docx's default equal columns.
    _widths(table, widths)
    for row in table.rows:
        for cell in row.cells:
            _borders(
                cell,
                top={"val": "single", "sz": "2", "color": HAIRLINE},
                bottom={"val": "single", "sz": "2", "color": HAIRLINE},
                left={"val": "nil"},
                right={"val": "nil"},
            )
    keep_together(doc, table)
    spacer(doc, after)


def finding(doc, tag: str, title: str, lines: list[str]) -> None:
    """A defect found in review, what caused it, and how it was closed."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [CONTENT_W])
    cell = table.cell(0, 0)
    _shade(cell, WHITE)
    _margins(cell, 150, 160, 150, 160)
    _borders(
        cell,
        top={"val": "single", "sz": "2", "color": HAIRLINE},
        bottom={"val": "single", "sz": "2", "color": HAIRLINE},
        left={"val": "single", "sz": "18", "color": WARN_FG},
        right={"val": "single", "sz": "2", "color": HAIRLINE},
    )
    p = cell.paragraphs[0]
    _spacing(p, 4, 0, 1.3)
    font(p.add_run(f"{tag}   "), 8.5, WARN_FG, True, mono=True)
    font(p.add_run(title), 10.5, INK, True)
    for label, text in lines:
        q = cell.add_paragraph()
        _spacing(q, 2, 0, 1.45)
        font(q.add_run(f"{label}  "), 9, SLATE, True)
        font(q.add_run(text), 9.5, INK, light=True)
    keep_together(doc, table)
    spacer(doc, 8)


def _drop_trailing_spacer(doc) -> None:
    """Removes a trailing empty paragraph before a forced page break.

    Every block ends with a spacer. Left in place, one sitting near the foot of a
    page spills onto the next one, and the explicit break then starts a third:
    the result is a blank page between two sections.
    """
    body = doc.element.body
    for element in reversed(body):
        # The body always ends with sectPr; step past it to reach real content.
        if element.tag.endswith("}sectPr"):
            continue
        if not element.tag.endswith("}p"):
            return
        if element.findall(qn("w:r")):
            return
        body.remove(element)
        return


def section_opener(doc, number: str, title: str, standfirst: str, new_page=True) -> None:
    """`new_page=False` lets short sections flow, which suits the brief: forcing
    a break there left two pages roughly half empty, which reads as unfinished
    rather than airy."""
    if new_page:
        _drop_trailing_spacer(doc)
        doc.add_page_break()
    else:
        spacer(doc, 16)
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(table)
    _widths(table, [1.55, CONTENT_W - 1.55])
    num_cell, text_cell = table.cell(0, 0), table.cell(0, 1)
    _shade(num_cell, INK)
    _shade(text_cell, WHITE)
    for cell in (num_cell, text_cell):
        _no_borders(cell)
    _margins(num_cell, 120, 0, 120, 0)
    _margins(text_cell, 100, 200, 100, 0)
    np = num_cell.paragraphs[0]
    np.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _spacing(np, 0, 0, 1)
    font(np.add_run(number), 20, WHITE, True, mono=True)
    tp = text_cell.paragraphs[0]
    _spacing(tp, 2, 0, 1.2)
    font(tp.add_run(title), 19, INK, True)
    sp = text_cell.add_paragraph()
    _spacing(sp, 0, 0, 1.4)
    font(sp.add_run(standfirst), 9.8, SLATE, light=True)
    keep_together(doc, table, with_previous=False, keep_next=True)
    spacer(doc, 6, keep_next=True)
    rule_line(doc, HAIRLINE, CONTENT_W, 0.03)
    keep_together(doc, doc.tables[-1], with_previous=False, keep_next=True)
    # The chain stops here. Pinning this spacer to whatever follows made the
    # opener plus a full table one unbreakable unit, which Word then pushed to
    # the next page, leaving the page the break had just started empty.
    spacer(doc, 10)


def cover(doc, doc_kind: str, subtitle: str, version: str, claim: str,
          cards: list[tuple[str, str, str]]) -> None:
    spacer(doc, 30)
    rule_line(doc, BRAND, 3.2, 0.09)
    spacer(doc, 14)
    kicker(doc, doc_kind)
    h = doc.add_paragraph()
    _spacing(h, 4, 0, 1.05)
    font(h.add_run("CampusOne"), 40, INK, True)
    s = doc.add_paragraph()
    _spacing(s, 18, 0, 1.25)
    font(s.add_run(subtitle), 16, BRAND_DEEP, True)
    callout(doc, "核心主张", claim, BRAND, BRAND_TINT, 12)
    stat_cards(doc, cards)
    spacer(doc, 16)

    meta = doc.add_table(rows=5, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.LEFT
    _fixed(meta)
    _widths(meta, [3.2, CONTENT_W - 3.2])
    fields = [
        ("参赛单位", CONFIG["unit"]),
        ("团队成员", TEAM_LINE),
        ("指导教师", CONFIG["advisor"]),
        ("联系邮箱", CONFIG["contactEmail"]),
        ("版本", version),
    ]
    for row, (key, value) in zip(meta.rows, fields):
        for cell in row.cells:
            _margins(cell, 85, 0, 85, 0)
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
    font(p.add_run(f"赛道：{CONFIG['competitionTrack']} · 初赛"), 8.5, SLATE, light=True)


# ------------------------------------------------------------ shared content --

RULE_ROWS = [
    ["VENUE-REQ-001", "必填字段完整，并逐项列出缺项名称", "KB-VENUE-001"],
    ["VENUE-TIME-001", "结束时间晚于开始时间", "KB-VENUE-001"],
    ["VENUE-CAP-001", "人数为正整数且不超过场地核定容量", "KB-VENUE-001、KB-SAFETY-001"],
    ["VENUE-SLOT-001", "与已占用时段无重叠", "KB-VENUE-001"],
    ["VENUE-EQP-001", "设备需求可被该场地满足", "KB-VENUE-002"],
    ["VENUE-HOUR-001", "在场地开放时间内且不跨日", "KB-VENUE-003"],
]

FAULT_ROWS = [
    ["非法 JSON", "真实调用模型后，把返回替换为自然语言", "INVALID_JSON"],
    ["虚构规则", "把 VENUE-RULE-999 注入各任务已声明的字段", "RULE_NOT_FOUND"],
    ["模型超时", "收缩请求预算，真实中断连接", "MODEL_TIMEOUT"],
]


# ------------------------------------------------------------------ summary --


def build_summary() -> Path:
    doc = Document()
    configure(doc, "CampusOne 项目概要介绍", "初赛项目概要介绍")
    cover(
        doc,
        "项目概要介绍 / PROJECT BRIEF",
        "面向高校场地申请的可信事务智能体",
        "2026 年 9 月 · 初赛提交版",
        "大模型负责读懂和表述，程序负责判定事实与规则，人负责最终决定。三者的边界写在代码里，可以现场验证。",
        [
            ("6", "确定性规则", "容量、时段与开放时间"),
            ("105", "自动化测试", "覆盖 T01–T21 用例"),
            ("3", "受约束 AI 任务", "均不可改变正式状态"),
        ],
    )

    section_opener(doc, "01", "项目概述",
                   "从一件每周都要处理的小事做起，把闭环做完整。")
    body(doc, "场地申请规则密集，来回沟通的成本很高。学生不清楚要填什么、为什么被退回；"
              "管理员反复核对人数、时段和设备，再手写一遍退回意见。CampusOne 把这条流程"
              "做成了可运行的系统：AI 整理表述，程序逐条判定六项规则，管理员基于带证据的"
              "摘要决定批准还是退回，每次状态变化和模型调用都留档。")
    body(doc, "申请、预检、提交、接件、退回、修订 V2、批准到归档已完整跑通。前端是四视图"
              "工作台，后端运行在 Cloudflare Worker，数据存于 D1。演示默认接入 DeepSeek，"
              "也可切换到可复现的本地模式离线演示。")
    callout(doc, "产品边界",
            "模型没有写库权限，不能批准、退回或改变任何正式状态。业务接口也不认调用方"
            "自称的身份：角色由服务端会话决定，请求体里写 role: \"admin\" 会被忽略。")

    doc.add_heading("三类用户各自的麻烦", level=2)
    bullets(doc, [
        "学生：不知道容量和开放时间这些硬约束，提交后只能等，看不到进度。",
        "管理员：同样的核对做很多遍，退回意见每次重写，口径不统一。",
        "管理部门：想查某次审批依据了哪条规则、哪一版申请，往往查不到。",
    ])

    section_opener(doc, "02", "我们的做法",
                   "把该由程序确定的事情，从模型手里拿走。", new_page=False)
    doc.add_heading("六条规则由程序判定", level=2)
    body(doc, "容量、时段冲突、开放时间这类可计算的判定全部交给规则引擎，模型不参与。"
              "每条规则有编号和制度依据，界面直接显示，可自行复算。")
    table_block(doc, ["规则编号", "判定内容", "制度依据"], RULE_ROWS,
                [3.6, 8.6, 4.8], 8.8, mono_cols=(0, 2))

    doc.add_heading("模型只做三件事", level=2)
    numbered(doc, [
        "表单整理：把学生写的活动说明理顺，不改人数、时间和设备，采纳与否由学生点确认。",
        "审核摘要：把已验证的事实和规则结果排列给管理员看，判断仍由人做。",
        "退回通知：按管理员填写的具体意见起草通知，只能引用这条已保存的意见。",
    ])
    body(doc, "三个任务的输出契约由代码里的校验 Schema 直接生成，模型返回的 JSON 要过结构、"
              "规则编号、证据编号三道校验才会显示。任一道不过就显示固定文案，业务照常进行。")

    doc.add_heading("故障可以当场演示", level=2)
    body(doc, "界面上有一个演示开关，可注入三种模型异常，接入真实模型时同样生效："
              "先真实调用，再注入故障，所以拒绝理由和耗时都是真实测量值。")
    table_block(doc, ["故障", "注入方式", "系统返回"], FAULT_ROWS,
                [3.0, 9.4, 4.6], 8.8, mono_cols=(2,))

    section_opener(doc, "03", "已经验证过什么",
                   "下面每个数字都来自实测，没有推算。", new_page=False)
    stat_cards(doc, [
        ("9 / 9", "闭环事件", "含一次退回与修订 V2"),
        ("8 / 8", "退回通知实测", "语义与人工意见一致"),
        ("409", "越权请求", "伪造管理员身份被拒"),
    ])
    spacer(doc, 10)
    bullets(doc, [
        "完整状态链走通：草稿到提交、接件、退回、修订 V2、再提交、批准、归档，共 9 条事件，V1 与 V2 并存。",
        "申请人在请求体里伪造 role: \"admin\" 直接批准，服务端返回 409，状态不变。",
        "四个并发的重复提交只产生一条事件，四个请求都返回 200，幂等键由服务端推导。",
        "接入 deepseek-chat 时，表单整理连续 6 次通过校验，耗时 1.2 至 1.4 秒。",
        "三类任务 × 三种故障共 9 种组合错误码全部符合预期，超时实测约 614 毫秒。",
    ], 10, 5)

    section_opener(doc, "04", "交付与下一步",
                   "初赛交付一个能跑也能查的系统；复赛推进真实接入。", new_page=False)
    table_block(doc, ["交付物", "状态", "说明"], [
        ["Web 应用", "完成", "四视图工作台，可一键重置"],
        ["源代码与自动化测试", "完成", "105 项测试，lint 与构建通过"],
        ["私有演示部署", "完成", "可切换真实模型与本地模式"],
        ["方案书 / PPT / 演示视频", "完成", "视频由团队真人讲解实机操作"],
        ["接入学校真实系统", "后续", "需授权后对接统一身份与场地数据"],
    ], [5.4, 2.2, 9.4], 8.8)
    body(doc, "下一阶段先请至少 3 名同学试用，记录完成时间与看不懂的字段，"
              "再建立审批时长、退回率和人工采纳率基线。这些数字现在还没有，所以不写。")
    callout(doc, "演示入口",
            f"{CONFIG['demoUrl']}　·　演示数据均为模拟数据，不含真实师生信息。",
            INK, PAGE_TINT, 8)

    path = OUT / "CampusOne_项目概要介绍.docx"
    doc.save(path)
    return path


# ----------------------------------------------------------------- proposal --


def build_proposal() -> Path:
    doc = Document()
    configure(doc, "CampusOne 可信校园事务智能体设计方案书", "需求分析、设计说明、测试方案与结果")
    cover(
        doc,
        "设计方案书 / DESIGN PROPOSAL",
        "场地申请可信智能体 · 设计方案书",
        "V2.0 · 2026 年 9 月",
        "把大模型放进一个它无法越权的控制面：能读能写文字，不能决定结果。"
        "本方案说明这个控制面怎么设计、怎么验证、以及验证中发现了什么。",
        [
            ("6", "确定性规则", "全部由程序判定"),
            ("21", "测试用例", "T01–T21 逐条对应"),
            ("5", "输出拒绝码", "含语义矛盾拦截"),
        ],
    )

    # 01
    section_opener(doc, "01", "需求分析",
                   "先说清楚这条流程今天卡在哪里，再说系统做什么。")
    doc.add_heading("1.1 场景与现状", level=2)
    body(doc, "高校场地申请通常由学生组织发起，经二级学院或场地管理部门审核。"
              "规则本身不复杂：容量上限、开放时间、是否与已有活动冲突、设备能否满足。"
              "麻烦在于这些规则散落在若干份制度文件里，学生填表时看不到，"
              "管理员只能靠经验逐条核对，退回时再手写一遍原因。同一个问题被解释很多遍。")
    doc.add_heading("1.2 引入大模型后的新风险", level=2)
    body(doc, "把大模型直接接到这类流程上有一个明显风险：它会用流畅的语言给出错误结论。"
              "本项目在开发过程中真实遇到过两次，详见第 6 章。"
              "这决定了系统的设计前提，即模型的输出必须先被验证，才能出现在人的面前，"
              "而且任何时候都不能由它来改变正式状态。")
    doc.add_heading("1.3 功能与非功能需求", level=2)
    table_block(doc, ["编号", "需求", "验收方式"], [
        ["FR-01", "学生可填写申请，AI 协助整理表述但不改事实", "对比采纳前后的字段值"],
        ["FR-02", "提交前由程序完成六项规则预检并显示依据", "界面显示规则编号与证据引用"],
        ["FR-03", "管理员可接件、退回（须填意见）、批准、办结", "状态机与事件日志"],
        ["FR-04", "退回后创建新版本，旧版本保留且可对照", "版本列表与逐字段差异"],
        ["FR-05", "每次模型调用留痕，含被拒绝的那一次", "AI 运行证据表"],
        ["NFR-01", "模型不可用时业务不中断", "注入超时故障后继续办理"],
        ["NFR-02", "操作身份不可由调用方自称", "伪造身份的请求返回 409"],
        ["NFR-03", "多人同时访问互不干扰", "两个会话持有独立案件"],
        ["NFR-04", "判定与展示的时间口径一致", "统一按校园墙钟计算"],
    ], [2.0, 8.4, 6.6], 8.8, mono_cols=(0,))

    # 02
    section_opener(doc, "02", "总体设计",
                   "五层结构，模型只出现在其中一层，且没有向下写入的权限。")
    table_block(doc, ["层", "职责", "关键约束"], [
        ["交互层", "四视图工作台：申请办理、事务档案、规则与知识、AI 运行证据",
         "按角色显示可执行操作，权限仍以服务端为准"],
        ["领域层", "表单 Schema、规则引擎、状态机、版本与校园时钟",
         "所有可计算判定在此完成，模型不参与"],
        ["Agent 层", "任务模板、上下文装配、输出解析、证据校验、有限修复与降级",
         "只读取已验证事实，输出须过三道校验"],
        ["知识层", "四份制度文件，按规则绑定检索", "只返回当前任务命中的条目并标注来源"],
        ["数据层", "场地、事务、版本、事件、规则、知识、AI 运行", "事件与版本只追加，不覆盖"],
    ], [2.4, 7.6, 7.0], 8.8)
    callout(doc, "信任边界",
            "浏览器不接触模型密钥；用户文本与知识片段一律视为不可信数据，不进入系统指令区；"
            "模型没有状态写入、任意查库或对外发通知的工具。")

    doc.add_heading("2.1 技术选型", level=2)
    body(doc, "前端 React 19，服务端渲染与路由使用 vinext，部署为 Cloudflare Worker，"
              "结构化数据存 Cloudflare D1，ORM 用 drizzle，校验用 zod。"
              "模型侧走 OpenAI 兼容接口，当前接 DeepSeek，换成其他 MaaS 不需要改业务代码。"
              "选这套的原因很实际：一条命令就能部署出一个可访问的私有站点，评委点开即用。")

    # 03
    section_opener(doc, "03", "业务流程与状态机",
                   "状态只能按图迁移，且每次迁移都要留下可核对的痕迹。")
    body(doc, "案件有六个状态。学生只能推动草稿到提交、退回到新草稿；"
              "接件、退回、批准、办结属于管理员。越权迁移在服务端被拒绝，不是靠前端藏按钮。")
    table_block(doc, ["原状态", "目标状态", "执行角色", "附加约束"], [
        ["草稿 draft", "已提交 submitted", "申请人", "必须先通过六项规则预检"],
        ["已提交 submitted", "审核中 under_review", "管理员", "—"],
        ["审核中 under_review", "已退回 returned", "管理员", "退回意见为必填，空意见被拒"],
        ["审核中 under_review", "已批准 approved", "管理员", "—"],
        ["已退回 returned", "草稿 draft", "申请人", "生成新版本，旧版本保留"],
        ["已批准 approved", "已归档 completed", "管理员", "—"],
    ], [4.0, 4.0, 2.6, 6.4], 8.8)
    doc.add_heading("3.1 幂等与并发", level=2)
    body(doc, "幂等键由服务端根据案件、版本、原状态和目标状态推导，不接受客户端传入。"
              "早期版本由前端拼一个带随机后缀的键，导致唯一索引形同虚设。"
              "现在重复点击或网络重试会命中同一把键，合并为一次事件。")

    # 04
    section_opener(doc, "04", "规则与知识设计",
                   "规则表、证据白名单和知识检索共用同一份目录，不可能只在一处存在。")
    table_block(doc, ["规则编号", "判定内容", "制度依据"], RULE_ROWS,
                [3.6, 8.6, 4.8], 8.8, mono_cols=(0, 2))
    doc.add_heading("4.1 知识按规则检索", level=2)
    body(doc, "知识库有四份模拟制度文件。检索不是向量召回，就是按规则绑定取用，"
              "这一点在方案里如实说明。价值不在检索算法，而在于交给模型的每一段文字"
              "都能追到是哪条规则需要它，界面上也会把命中的条目标为“本次已引用”。")
    doc.add_heading("4.2 时间口径", level=2)
    body(doc, "Worker 运行在 UTC，评委的机器可能在任何时区。所有规则判定与界面展示"
              "统一按 Asia/Shanghai 墙钟计算，避免同一条申请在不同机器上落到开放时间的两侧。")

    # 05
    section_opener(doc, "05", "Agent 任务设计",
                   "三个任务，一条执行路径，三道校验，一次有限修复。")
    table_block(doc, ["任务", "输入（均为已验证事实）", "输出用途"], [
        ["表单整理 form_assist", "申请正文、六项规则判定结果、命中的知识条目",
         "建议文案，学生确认后才写入"],
        ["审核摘要 review_brief", "申请正文、全部规则判定、四份知识条目",
         "供管理员判断，不含批准结论"],
        ["退回通知 return_message_draft", "申请正文、规则判定、案件状态、管理员填写的退回意见",
         "退回文案草稿，须人工确认"],
    ], [4.2, 7.2, 5.6], 8.8)
    doc.add_heading("5.1 输出校验", level=2)
    numbered(doc, [
        "结构校验：发给模型的契约由 zod Schema 直接生成，与校验时使用的是同一份定义，不会出现描述与校验不一致。",
        "规则编号校验：扫描整份输出，出现目录里没有的规则编号即拒绝。",
        "证据编号校验：evidenceRefs 只能引用系统里真实存在的编号，包括规则号、表单字段、场地事实、知识条目和管理员退回意见。",
        "语义校验：已退回的案件，通知草稿里不得出现“等待审批”“无需修改”这类与状态矛盾的表述。",
    ], 10)
    body(doc, "前三道拒绝会记录错误码并显示固定降级文案。结构问题和语义矛盾允许再问一次，"
              "把校验器的具体报错回传给模型；超时和 HTTP 错误不重试。"
              "每一次尝试单独写入运行记录，被拦下的坏输出仍然留在证据里。")
    table_block(doc, ["拒绝码", "含义", "是否重试"], [
        ["INVALID_JSON", "返回的不是合法 JSON", "是"],
        ["SCHEMA_MISMATCH", "字段缺失、多余或类型不符", "是"],
        ["SEMANTIC_CONFLICT", "内容与案件当前状态矛盾", "是"],
        ["RULE_NOT_FOUND", "引用了不存在的规则编号", "否"],
        ["EVIDENCE_NOT_FOUND", "引用了不存在的证据编号", "否"],
        ["MODEL_TIMEOUT", "模型未在预算内返回", "否"],
    ], [4.2, 8.4, 4.4], 8.8, mono_cols=(0,))

    # 06
    section_opener(doc, "06", "开发过程中发现并修复的问题",
                   "这三个缺陷都是真实出现过的，把它们写出来比声称“系统很可靠”更有说服力。")
    finding(doc, "缺陷 01", "模型对着一条正在失败的规则说了假话", [
        ("现象", "把预计人数改成 800 人（场地容量 120 人）后运行表单整理，"
                 "模型回复“信息完整，且人数未超过场地容量”，而规则 VENUE-CAP-001 正在失败。"),
        ("原因", "表单整理是当时唯一不跑规则引擎的任务，只把裸表单发给模型。"
                 "模型没有任何规则结论，被要求解释自己的工作时就自行补了一个合规判断。"),
        ("处置", "接口改为先判定再调用，把判定结果作为已验证上下文传入；"
                 "提示词明确合规结论不由模型给出；界面把程序判定放在模型文字上方并注明来源。"),
        ("复验", "同样的 800 人输入连续 6 次真实模型调用，每次都如实说明超出容量。"),
    ])
    finding(doc, "缺陷 02", "退回通知写成了“已提交、等待审批”", [
        ("现象", "对一份已被退回的申请生成退回通知，模型输出“您的申请已提交，我们正在处理中”，"
                 "并且通过了当时的全部校验。"),
        ("原因", "该任务同样没有拿到案件状态。给它一份规则全过的申请，"
                 "它合理地推断案件还在审批中。"),
        ("处置", "接口从服务端读取当前状态与最近一条人工退回意见并传入；"
                 "新增语义校验，已退回状态下出现等待审批类表述直接拒绝并允许重试；"
                 "模型被拒时的降级文案直接引用管理员原话。"),
        ("复验", "连续 8 次真实模型调用全部通过，无矛盾表述，每次都引用管理员填写的原句。"),
    ])
    finding(doc, "缺陷 03", "故障演示只在本地模式生效", [
        ("现象", "三种模型异常的演示开关接在本地模式分支上，接入真实模型后点击没有反应；"
                 "其中“虚构规则”还会报成结构错误，与演示口径不符。"),
        ("原因", "故障注入与模型模式耦合，且注入方式对不同任务不一致。"),
        ("处置", "故障与模型模式解耦，先真实调用再注入，超时改为收缩真实请求预算；"
                 "虚构规则注入到各任务已声明的字段中，使规则校验成为拒绝原因。"),
        ("复验", "三类任务 × 三种故障共 9 种组合，错误码全部符合预期。"),
    ])

    # 07
    # Flows on after the findings; forcing a break here left the last defect
    # block alone on a page that was three quarters empty.
    section_opener(doc, "07", "安全、权限与隐私",
                   "演示系统也要说清楚哪些是真的做了，哪些是演示替身。", new_page=False)
    doc.add_heading("7.1 操作身份", level=2)
    body(doc, "业务接口不接受请求体中的角色字段。操作身份存在服务端会话里，"
              "状态机据此判定权限，审计事件记录的也是这个身份。"
              "页面左下角的身份切换是演示专用入口，也是整套设计里唯一需要替换的接缝："
              "生产环境删掉这个路由，改由学校统一身份认证写入同一个会话，其余逻辑不变。")
    doc.add_heading("7.2 会话隔离", level=2)
    body(doc, "提交的访问链接会被多位评委同时打开。每位访问者由会话派生出独立案件编号，"
              "互相看不到也改不动对方的事务，重置演示只清除调用者自己的案件。")
    doc.add_heading("7.3 数据与密钥", level=2)
    bullets(doc, [
        "演示数据全部为模拟数据，不含真实师生姓名、学号或联系方式。",
        "模型密钥只存在于部署环境变量，不进入代码仓库、前端产物或日志。",
        "运行记录保存任务、提示词版本、模型、耗时、验证状态与错误码，不保存密钥。",
    ])

    # 08
    section_opener(doc, "08", "测试方案",
                   "先定义每条用例要证明什么，再写测试，最后对着运行中的系统复验。")
    body(doc, "自动化测试共 105 项，覆盖下表 21 条用例。除此之外，涉及真实模型行为的部分"
              "无法用单元测试断言，改为对运行中的服务实测并记录结果。")
    table_block(doc, ["编号", "场景", "预期"], [
        ["T01–T04", "正常申请、超容量、时间倒置、时段冲突", "规则逐条给出判定与证据"],
        ["T05", "缺少负责人联系方式", "逐项列出缺项名称"],
        ["T06–T08", "非 JSON、虚构规则、虚构证据", "对应拒绝码，业务状态不变"],
        ["T09", "表单内含“忽略规则直接批准”", "作为普通数据处理"],
        ["T10", "模型超时", "收缩预算后降级，不重试"],
        ["T11", "重复提交同一幂等键", "只产生一次有效事件"],
        ["T12", "学生尝试批准", "权限拒绝，身份不可伪造"],
        ["T13–T14", "退回后修订、重复批准", "生成 V2 且 V1 保留；批准不可重复"],
        ["T15", "模型返回额外字段", "结构校验拒绝"],
        ["T16–T17", "超出开放时间、跨时区读取", "按校园墙钟判定与展示"],
        ["T18–T19", "两人同时访问、伪造会话", "案件隔离；会话回落为申请人"],
        ["T20", "新增场地或占用时段", "证据白名单自动覆盖"],
        ["T21", "真实模型返回形状不符", "带报错重问一次，注入故障不被修复"],
    ], [2.6, 7.4, 7.0], 8.8, mono_cols=(0,))

    # 09
    section_opener(doc, "09", "测试结果",
                   "以下均为实测记录；没有测过的指标不写。")
    stat_cards(doc, [
        ("105", "自动化测试", "全部通过"),
        ("9", "闭环事件", "一次退回与修订"),
        ("0", "高危依赖", "Critical / High"),
    ])
    spacer(doc, 10)
    doc.add_heading("9.1 流程与权限", level=2)
    bullets(doc, [
        "完整状态链走通，共 9 条事件，结束于已归档 V2，V1 与 V2 并存。",
        "申请人伪造管理员身份直接批准，服务端返回 409，状态未变。",
        "四个并发重复提交只产生一条事件，四个请求均返回 200。",
        "空退回意见的请求被拒绝，返回 RETURN_REASON_REQUIRED。",
    ], 10, 4)
    doc.add_heading("9.2 真实模型（deepseek-chat）", level=2)
    table_block(doc, ["项目", "实测结果"], [
        ["表单整理连续 6 次", "全部通过校验，耗时 1.2 至 1.4 秒"],
        ["超容量输入下的表述", "6 次全部如实说明超出容量，无合规断言"],
        ["退回通知连续 8 次", "全部通过，无等待审批类矛盾表述，均引用管理员原句"],
        ["三类任务 × 三种故障", "9 种组合错误码全部符合预期"],
        ["超时故障", "约 614 毫秒后中断，记录为真实耗时"],
    ], [6.0, 11.0], 8.8)
    callout(doc, "关于口径",
            "自动化测试通过只说明接口与状态路径正确，不代表模型文案的业务语义一定正确。"
            "本项目两次语义缺陷都是接口全绿的情况下发现的，因此把模型语义单独列为一类验收项。",
            WARN_FG, WARN_BG)

    # 10
    section_opener(doc, "10", "创新点与应用价值",
                   "价值不在模型本身，在于把模型的不可靠限制在不影响结果的范围内。")
    table_block(doc, ["设计选择", "具体做法", "带来的差别"], [
        ["判定与表述分离", "六项规则由程序判定，模型不参与通过与否",
         "模型说错话不会改变审批结果"],
        ["输出可核对", "规则号、证据号、知识条目与运行耗时同屏显示",
         "结论能追到依据，评审可自行复算"],
        ["失败可演示", "三种故障在真实模型下同样生效", "异常下的行为可以当场检验，而不是靠承诺"],
        ["模型可替换", "OpenAI 兼容接口 + 任务契约", "更换 MaaS 不改业务代码"],
    ], [3.6, 7.4, 6.0], 8.8)
    body(doc, "同一套控制面可以复制到证明开具、设备借用、访客预约这类同样规则密集的事务。"
              "效率提升需要真实试点数据支撑，本阶段没有采集，因此不给出百分比。")

    # 11
    section_opener(doc, "11", "实施路径",
                   "复赛之前能做完的事，和需要学校授权才能做的事，分开写。")
    table_block(doc, ["阶段", "内容", "前置条件"], [
        ["初赛后两周", "邀请至少 3 名同学试用，记录完成时间与看不懂的字段", "无"],
        ["复赛阶段", "接入统一身份认证，替换演示身份切换入口", "学校授权"],
        ["复赛阶段", "接入真实场地与占用数据，扩充制度知识库", "场地管理部门配合"],
        ["试点阶段", "建立审批时长、退回率与人工采纳率基线", "真实流量"],
    ], [3.4, 9.2, 4.4], 8.8)

    # 12
    section_opener(doc, "12", "交付清单",
                   "提交前逐项核对；未完成的照实标注。")
    table_block(doc, ["交付物", "状态", "备注"], [
        ["项目概要介绍", "完成", "正文不超过 2000 字"],
        ["设计方案书（本文）", "完成", "含需求分析、设计说明、测试方案与结果"],
        ["项目简介 PPT", "完成", "不超过 20 页"],
        ["3 至 5 分钟演示视频", "待录制", "由团队真人讲解实机操作"],
        ["可访问演示站点", "完成", "模拟数据，可一键重置"],
        ["源代码与测试", "完成", "105 项测试、lint 与生产构建通过"],
    ], [5.6, 2.4, 9.0], 8.8)
    callout(doc, "信息声明",
            "本方案所有场地、制度与申请数据均为模拟数据。文中每一项实测结果都可在演示站点复现；"
            "尚未测量的指标（如效率提升幅度）不在本文出现。",
            INK, PAGE_TINT)

    path = OUT / "CampusOne_可信校园事务智能体设计方案书.docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    for built in (build_summary(), build_proposal()):
        print(f"wrote {built.relative_to(ROOT)}")
