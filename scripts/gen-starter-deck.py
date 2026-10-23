# -*- coding: utf-8 -*-
"""마코디 웹 PPT 기본 양식(public/mocks/slides.json) 생성 — 건축·인테리어 마감재 제안서용.
심플·여백 위주. 캔버스 1000 x 562.5. 실행: python scripts/gen-starter-deck.py
구성: 표지 / 프로젝트 개요 / 디자인 컨셉 / 공간 제안(투시도+마감재) / 마감재 리스트 / 마무리
"""
import json, os, itertools

W, H = 1000, 562.5
INK = '#1f1f1f'      # 본문
SUB = '#8a8a8a'      # 보조 글자
LINE = '#d9d9d9'     # 가는 선
PH = '#f1f0ee'       # 이미지 자리(웜 그레이)
PH_TXT = '#a9a6a1'
ACC = '#6c2bd9'      # 마코디 보라(번호 정도만)
FONT = 'Pretendard'

_n = itertools.count(1)
def nid(): return f'mcd{next(_n):04d}'

def p(text, size=14, color=INK, bold=False, align='left', spacing=None):
    t = f'<span style="font-size: {size}px; color: {color};{f" letter-spacing: {spacing}px;" if spacing else ""}">{text}</span>'
    if bold: t = f'<strong>{t}</strong>'
    return f'<p style="text-align: {align};">{t}</p>'

def text(left, top, width, height, html, line_height=1.4):
    return {'type': 'text', 'id': nid(), 'left': left, 'top': top, 'width': width, 'height': height,
            'content': html, 'rotate': 0, 'defaultFontName': FONT, 'defaultColor': INK, 'lineHeight': line_height}

def rect(left, top, width, height, fill, label=None):
    e = {'type': 'shape', 'id': nid(), 'left': left, 'top': top, 'width': width, 'height': height,
         'viewBox': [200, 200], 'path': 'M 0 0 L 200 0 L 200 200 L 0 200 Z', 'fill': fill,
         'fixedRatio': False, 'rotate': 0}
    if label:
        e['text'] = {'content': p(label, 12, PH_TXT, align='center'), 'defaultFontName': FONT,
                     'defaultColor': PH_TXT, 'align': 'middle'}
    return e

def line(left, top, length, color=LINE, width=1, vertical=False):
    end = [0, length] if vertical else [length, 0]
    return {'type': 'line', 'id': nid(), 'left': left, 'top': top, 'start': [0, 0], 'end': end,
            'points': ['', ''], 'color': color, 'style': 'solid', 'width': width}

def header(no, title):
    """내용 슬라이드 공통 머리 — 번호·제목(왼쪽), 프로젝트명(오른쪽), 가는 선. 바닥에 회사명·쪽"""
    return [
        text(56, 34, 520, 30, p(f'<span style="color: {ACC};">{no}</span>&nbsp;&nbsp;{title}', 18, INK, bold=True)),
        text(640, 38, 304, 24, p('프로젝트명', 11, SUB, align='right')),
        line(56, 74, 888),
        text(56, 522, 400, 20, p('회사명  |  Interior Design Proposal', 9, SUB, spacing=0.5)),
    ]

def table(left, top, col_widths, rows, row_h=34):
    data = []
    for r, row in enumerate(rows):
        cells = []
        for c, val in enumerate(row):
            st = {'fontname': FONT, 'fontsize': '11px', 'color': INK if r else '#ffffff',
                  'align': 'center' if c in (0, 1) else 'left', 'vAlign': 'middle'}
            if r == 0: st.update(bold=True, backcolor='#2b2b2b')
            cells.append({'id': nid(), 'colspan': 1, 'rowspan': 1, 'text': val, 'style': st})
        data.append(cells)
    total = sum(col_widths)
    return {'type': 'table', 'id': nid(), 'left': left, 'top': top, 'width': total, 'height': row_h * len(rows),
            'colWidths': [w / total for w in col_widths], 'cellMinHeight': row_h, 'rotate': 0, 'data': data,
            'outline': {'width': 1, 'style': 'solid', 'color': LINE}}

def slide(elements, bg='#ffffff'):
    return {'id': nid(), 'elements': elements, 'background': {'type': 'solid', 'color': bg}}

slides = []

# 1. 표지
slides.append(slide([
    rect(520, 0, 480, H, PH, '대표 투시도 / 외관 이미지'),
    text(56, 64, 400, 24, p('INTERIOR DESIGN PROPOSAL', 11, SUB, spacing=2)),
    text(56, 180, 440, 110, p('프로젝트명', 40, INK, bold=True) + p('인테리어 마감재 제안서', 18, SUB), 1.3),
    line(56, 312, 40, INK, 2),
    text(56, 330, 420, 90,
         p('클라이언트&nbsp;&nbsp;&nbsp;고객사명', 11, SUB) + p('위치&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;서울시 OO구', 11, SUB)
         + p('날짜&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2026. 00. 00', 11, SUB), 1.8),
    text(56, 500, 400, 24, p('회사명 · 담당 디자이너', 11, INK, bold=True)),
]))

# 2. 프로젝트 개요
rows = [('프로젝트명', '프로젝트명을 입력하세요'), ('위치', '서울시 OO구 OO로 00'), ('용도', '오피스 / 상업 / 주거'),
        ('면적', '000㎡ (00평)'), ('공사 범위', '바닥 · 벽 · 천장 마감 전체'), ('일정', '2026. 00 ~ 2026. 00')]
els = header('01', '프로젝트 개요')
for i, (k, v) in enumerate(rows):
    y = 112 + i * 52
    els += [text(56, y, 110, 24, p(k, 12, SUB)), text(166, y, 300, 24, p(v, 13, INK)), line(56, y + 38, 410)]
els.append(rect(510, 104, 434, 392, PH, '평면도 / 현장 사진'))
slides.append(slide(els))

# 3. 디자인 컨셉
els = header('02', '디자인 컨셉')
els.append(text(56, 104, 330, 90, p('Warm Minimal', 26, INK, bold=True) + p('따뜻한 소재감과 절제된 선으로<br>머물고 싶은 공간을 만듭니다.', 13, SUB), 1.5))
for i, (kw, desc) in enumerate([('소재', '자연스러운 질감의 우드 · 석재'), ('색감', '웜 그레이와 베이지 톤'), ('빛', '간접 조명으로 부드럽게')]):
    y = 250 + i * 76
    els += [text(56, y, 60, 24, p(f'0{i+1}', 12, ACC, bold=True)), text(100, y, 300, 50, p(kw, 14, INK, bold=True) + p(desc, 12, SUB), 1.5)]
for r in range(2):
    for c in range(3):
        els.append(rect(430 + c * 174, 104 + r * 198, 164, 188, PH, '무드 이미지'))
slides.append(slide(els))

# 4. 공간 제안 — 투시도 + 적용 마감재
els = header('03', '공간 제안 — 공간명')
els.append(rect(56, 96, 600, 400, PH, '투시도 (그림을 넣거나 붙여넣기)'))
els.append(text(684, 96, 260, 24, p('적용 마감재', 13, INK, bold=True)))
els.append(line(684, 126, 260))
for i, (code, part) in enumerate([('F-01', '바닥'), ('W-01', '벽'), ('C-01', '천장')]):
    y = 142 + i * 76
    els += [text(684, y, 70, 22, p(code, 12, ACC, bold=True)), text(744, y, 200, 50, p(part, 12, INK, bold=True) + p('품명 / 브랜드 / 규격', 11, SUB), 1.5),
            line(684, y + 66, 260)]
els.append(text(684, 384, 260, 110,
                p('TIP', 10, ACC, bold=True, spacing=1)
                + p('오른쪽 마코디 탭에서 자재를 누르면 스펙 카드가 들어갑니다. <strong>AI</strong> 버튼으로 투시도 위를 둘러 그리면 비슷한 자재를 찾아줍니다.', 11, SUB), 1.6))
slides.append(slide(els))

# 5. 마감재 리스트
els = header('04', '마감재 리스트')
els.append(table(56, 100, [70, 80, 150, 170, 140, 130, 148], [
    ('구분', '코드', '위치', '품명', '브랜드', '규격(mm)', '비고'),
    ('바닥', 'F-01', '오피스 전체', '', '', '', ''),
    ('바닥', 'F-02', '라운지', '', '', '', ''),
    ('벽', 'W-01', '메인 벽', '', '', '', ''),
    ('벽', 'W-02', '회의실', '', '', '', ''),
    ('천장', 'C-01', '전체', '', '', '', ''),
    ('기타', 'E-01', '가구 / 몰딩', '', '', '', ''),
]))
els.append(text(56, 360, 888, 40, p('* 제품 사양과 가격은 공급사 사정에 따라 바뀔 수 있습니다. 실제 시공 전 샘플로 색상과 질감을 확인해 주세요.', 10, SUB)))
slides.append(slide(els))

# 6. 마무리
slides.append(slide([
    text(56, 200, 600, 80, p('감사합니다', 36, INK, bold=True) + p('Thank you', 14, SUB, spacing=1), 1.4),
    line(56, 300, 40, INK, 2),
    text(56, 320, 500, 80, p('회사명', 13, INK, bold=True) + p('담당자명 · 연락처 010-0000-0000 · email@company.com', 11, SUB), 1.7),
    text(56, 500, 600, 24, p('마감재 정보 제공 · 마코디 macodi.co.kr', 10, SUB)),
]))

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'mocks', 'slides.json')
json.dump(slides, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('slides:', len(slides), '->', os.path.abspath(out))
