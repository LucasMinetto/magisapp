"""Leitura dos PDFs de Ordem Paranormal em linhas com fonte, cor e posição.

O livro é diagramado em duas colunas: as linhas saem coluna esquerda inteira, depois a direita.
A marca d'água (nome e e-mail de quem comprou o PDF) é descartada aqui: nenhuma linha com e-mail passa.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import pymupdf

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")


@dataclass
class Span:
    text: str
    font: str
    size: float
    color: int
    x: float
    x1: float = 0

    @property
    def bold(self) -> bool:
        return 'Bold' in self.font or 'Semibold' in self.font or 'Black' in self.font

    @property
    def italic(self) -> bool:
        return self.font.endswith('-It') or 'Italic' in self.font


@dataclass
class Linha:
    pagina: int  # página impressa no livro
    pdf: int  # página do PDF (1 = primeira)
    x: float
    y: float
    x1: float
    col: int
    spans: list[Span] = field(default_factory=list)

    @property
    def text(self) -> str:
        # O glifo do dado (fonte com "d20"): "–O" é –1d20, "OO" é 2d20, "3O" é 3d20. O marcador de lista do livro
        # ("I" ou "b" na fonte OutroLado) não é texto.
        out = ''
        for s in self.spans:
            t = s.text
            if 'd20' in s.font and t.strip():
                n = re.search(r'(\d+)$', out)
                out = out[: n.start()] + f'{n.group(1)}d20' if n and len(t.strip()) == 1 else out + f'{len(t.strip())}d20'
            elif 'OutroLado' in s.font and t.strip() in ('I', 'b'):
                continue
            else:
                out += t
        return out.strip()

    @property
    def font(self) -> str:
        return self.spans[0].font if self.spans else ''

    @property
    def size(self) -> float:
        return max((s.size for s in self.spans), default=0)

    @property
    def color(self) -> int:
        return self.spans[0].color if self.spans else 0

    def __repr__(self) -> str:  # para depurar
        return f'<p{self.pagina} c{self.col} y{self.y:.0f} {self.font} {self.size:.0f} #{self.color:06x} {self.text[:50]!r}>'


class Livro:
    def __init__(self, caminho: str, sigla: str, deslocamento: int, junta_max: float | None = None):
        self.doc = pymupdf.open(caminho)
        # maior vão horizontal entre pedaços que ainda são a mesma linha (None = qualquer um).
        # No texto corrido, um vão grande é um quadro ao lado, não a continuação da frase.
        self.junta_max = junta_max
        self.sigla = sigla
        # página impressa = página do PDF - deslocamento (quando o rodapé não traz o número)
        self.deslocamento = deslocamento
        self._cache: dict[int, list[Linha]] = {}

    def __len__(self) -> int:
        return self.doc.page_count

    def numero_impresso(self, pdf: int) -> int:
        return pdf - self.deslocamento

    def linhas(self, pdf: int) -> list[Linha]:
        """Linhas da página `pdf` (1 = primeira), na ordem de leitura, sem marca d'água nem rodapé."""
        if pdf in self._cache:
            return self._cache[pdf]
        page = self.doc[pdf - 1]
        w, h = page.rect.width, page.rect.height
        meio = w / 2
        impressa = self.numero_impresso(pdf)
        out: list[Linha] = []
        for b in page.get_text('dict', flags=pymupdf.TEXT_PRESERVE_WHITESPACE)['blocks']:
            for l in b.get('lines', []):
                spans = [Span(s['text'].replace('­', ''), s['font'], s['size'], s['color'], s['bbox'][0], s['bbox'][2]) for s in l['spans'] if s['text'].strip()]
                if not spans:
                    continue
                texto = ''.join(s.text for s in spans)
                if EMAIL.search(texto):
                    continue  # marca d'água
                x0, y0, x1, _ = l['bbox']
                if y0 > h - 50 and re.fullmatch(r'\s*\d{1,3}\s*', texto):
                    continue  # número da página no rodapé
                if abs(l['dir'][1]) > 0.1:
                    continue  # texto girado (lombada, decoração)
                col = 0 if x0 < meio - 15 else 1
                out.append(Linha(impressa, pdf, x0, y0, x1, col, spans))
        # junta pedaços da mesma linha (mesma coluna, mesma altura), em ordem de x
        out.sort(key=lambda l: (l.col, l.y))
        grupos: list[list[Linha]] = []
        for l in out:
            perto = self.junta_max is None or (grupos and min(abs(l.x - g.x1) for g in grupos[-1]) < self.junta_max)
            if grupos and perto and grupos[-1][0].col == l.col and abs(grupos[-1][-1].y - l.y) < 3.5 and abs(grupos[-1][0].y - l.y) < 7 and not any(_sobrepoe(g, l) for g in grupos[-1]):
                grupos[-1].append(l)
            else:
                grupos.append([l])
        merged: list[Linha] = []
        for g in grupos:
            g.sort(key=lambda l: l.x)
            base = g[0]
            for l in g[1:]:
                gap = l.x - base.x1
                if gap > 1 and not base.spans[-1].text.endswith(' ') and not l.spans[0].text.startswith(' '):
                    l.spans[0].text = ' ' + l.spans[0].text
                base.spans.extend(l.spans)
                base.x1 = max(base.x1, l.x1)
            merged.append(base)
        merged.sort(key=lambda l: (l.col, round(l.y), l.x))
        self._cache[pdf] = merged
        return merged

    def faixa(self, ini: int, fim: int) -> list[Linha]:
        """Linhas das páginas `ini` a `fim` do PDF, inclusive."""
        return [l for p in range(ini, fim + 1) for l in self.linhas(p)]


def _sobrepoe(a: Linha, b: Linha) -> bool:
    return b.x < a.x1 - 2 and a.x < b.x1 - 2


def juntar(linhas: list[str]) -> str:
    """Junta linhas de um parágrafo desfazendo a hifenização do fim de linha."""
    out = ''
    for t in linhas:
        t = t.strip().replace('­', '')
        if not t:
            continue
        if out.endswith('-') and len(out) > 1 and out[-2].isalpha() and t[:1].islower():
            out = out[:-1] + t
        elif out:
            out += ' ' + t
        else:
            out = t
    return re.sub(r'\s+', ' ', out).strip()


def paragrafos(linhas: list[Linha], fator: float = 1.45) -> str:
    """Texto corrido: quebra de parágrafo quando o espaço entre linhas é maior que o normal."""
    blocos: list[list[str]] = []
    ant: Linha | None = None
    for l in linhas:
        novo = ant is None or l.col != ant.col or l.pdf != ant.pdf or (l.y - ant.y) > fator * max(ant.size, 9) or (l.y - ant.y) < -1
        # mudou de coluna/página mas a frase não terminou: continua o mesmo parágrafo
        if novo and ant is not None and blocos and (l.col != ant.col or l.pdf != ant.pdf):
            fim = blocos[-1][-1].rstrip()
            if fim and fim[-1] not in '.:!?)”"' :
                novo = False
        if novo:
            blocos.append([])
        blocos[-1].append(l.text)
        ant = l
    return '\n\n'.join(juntar(b) for b in blocos if juntar(b))


def titulo(s: str) -> str:
    """'SEDE DE ADRENALINA' → 'Sede de Adrenalina' (os livros usam caixa alta em alguns títulos)."""
    if not s.isupper():
        return s
    menores = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'no', 'na', 'nos', 'nas', 'com', 'por', 'para', 'ao', 'à'}
    palavras = s.lower().split()
    return ' '.join(p if (i > 0 and p in menores) else p[:1].upper() + p[1:] for i, p in enumerate(palavras))
