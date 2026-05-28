#!/usr/bin/env python3
"""
从 ChatGPT 另存网页中提取对话正文，导出为 Markdown（UTF-8）。

用法：
  python scripts/extract_chatgpt_conversation_html.py \\
    html/ChatGPT-xxxx.html \\
    docs/00_项目总览/05_ChatGPT对话整理.md
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_html", type=Path)
    ap.add_argument("output_md", type=Path)
    args = ap.parse_args()

    try:
        from markdownify import markdownify as html_to_md
    except ImportError:
        print("需要: pip install beautifulsoup4 markdownify", file=sys.stderr)
        return 1

    html = args.input_html.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")

    def _is_turn_messages(c):
        if not c:
            return False
        parts = c if isinstance(c, list) else [c]
        return any("group/turn-messages" in str(p) for p in parts)

    turns = soup.find_all("div", class_=_is_turn_messages)
    lines: list[str] = [
        "---",
        f"document_type: dialogue_archive",
        f"source_file: {args.input_html.as_posix()}",
        "---",
        "",
        "# ChatGPT 对话整理（医院医学装备数字化治理平台 · 需求溯源）",
        "",
        "本节由离线 HTML 自动抽取生成，结构与粗体等与线上展示基本一致；可作需求讨论过程留痕与评审引用。",
        "",
        "**重新导出**（在项目根目录）：`python scripts/extract_chatgpt_conversation_html.py \"html/ChatGPT - 医院医学装备数字化治理平台.html\" \"docs/00_项目总览/05_ChatGPT对话整理-需求溯源.md\"` · 依赖：`pip install beautifulsoup4 markdownify`。",
        "",
    ]

    for i, turn in enumerate(turns, start=1):
        role_el = turn.find(attrs={"data-message-author-role": True})
        role = role_el.get("data-message-author-role") if role_el else "unknown"
        if role == "user":
            bubble = turn.find("div", class_=re.compile(r"whitespace-pre-wrap"))
            text = bubble.get_text("\n").strip() if bubble else ""
        elif role == "assistant":

            def _has_markdown_class(c):
                if not c:
                    return False
                if isinstance(c, str):
                    return "markdown" in c
                return "markdown" in " ".join(str(x) for x in c)

            md_root = turn.find("div", class_=_has_markdown_class)
            if md_root:
                inner = "".join(str(x) for x in md_root.contents)
                text = html_to_md(inner, heading_style="ATX", bullets="-").strip()
            else:
                text = ""
        else:
            text = turn.get_text("\n").strip()

        if not text:
            continue

        label = {"user": "用户", "assistant": "助手"}.get(role, role)
        lines.extend([f"## 轮次 {i} · {label}", "", text, ""])

    merged = "\n".join(lines)
    args.output_md.write_text(merged, encoding="utf-8")
    physical_lines = merged.count("\n") + (1 if merged else 0)
    print(f"wrote {args.output_md} ({len(turns)} turns, ~{physical_lines} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
