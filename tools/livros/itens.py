"""Itens: tabelas de armas, proteções e equipamento geral, descrições e itens amaldiçoados."""
from __future__ import annotations

import re
import unicodedata

import pymupdf

from pdf import Linha, Livro, juntar, paragrafos, titulo

ROMANOS = {'0': 0, 'I': 1, 'II': 2, 'III': 3, 'IV': 4, '1': 1, '2': 2, '3': 3, '4': 4}
TIPO_DANO = {'C': 'Corte', 'I': 'Impacto', 'P': 'Perfuração', 'B': 'Balístico', 'F': 'Fogo', 'E': 'Eletricidade', 'Q': 'Químico'}
MUNICOES = ('bala', 'flecha', 'cartucho', 'foguete', 'combustivel', 'virote', 'dardo')


def fold(s: str) -> str:
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9()]+', ' ', s.lower()).strip()


def numero(s: str) -> float:
    s = s.strip().replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0


# ------------------------------------------------------------------ tabelas

def _spans(page: pymupdf.Page):
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                t = s['text'].replace('­', '').strip()
                if t and 'Optima' in s['font']:
                    yield {'color': s['color'], 't': t, 'x0': s['bbox'][0], 'x1': s['bbox'][2], 'y': (s['bbox'][1] + s['bbox'][3]) / 2, 'font': s['font'], 'size': s['size']}


def tabela(livro: Livro, pdf: int) -> list[dict]:
    """Linhas de tabela da página: {'grupo', 'subgrupo', 'cells': [nome, ...], 'x': x do nome}. Trata tabelas lado a lado."""
    page = livro.doc[pdf - 1]
    spans = list(_spans(page))
    cabecalhos = [s for s in spans if 'SC700' in s['font'] and 'Black' not in s['font']]
    if not cabecalhos:
        return []
    # cabeçalhos: letra grande + resto pequeno; junta por proximidade em x na mesma altura
    cabecalhos.sort(key=lambda s: s['y'])
    faixa_y, base = 0, None
    for s in cabecalhos:
        if base is None or s['y'] - base > 6:
            base = s['y']
            faixa_y += 1
        s['faixa'] = faixa_y
    cabecalhos.sort(key=lambda s: (s['faixa'], s['x0']))
    cols: list[dict] = []
    for s in cabecalhos:
        if cols and -3 <= s['x0'] - cols[-1]['x1'] < 3 and abs(s['y'] - cols[-1]['y']) < 6:
            cols[-1]['x1'] = s['x1']
            cols[-1]['t'] += s['t']
        else:
            cols.append(dict(s))
    # vários blocos de tabela na página (lado a lado ou em alturas diferentes): cada "Nome"/"Arma"/"Proteção"/"Modificação" começa um
    inicios = [i for i, c in enumerate(cols) if fold(c['t']) in ('nome', 'arma', 'protecao', 'item', 'modificacao', 'poder')]
    out: list[dict] = []
    for n, i in enumerate(inicios):
        fim = inicios[n + 1] if n + 1 < len(inicios) else len(cols)
        grupo_cols = cols[i:fim]
        if fold(grupo_cols[0]['t']) == 'modificacao' or len(grupo_cols) < 2:
            continue
        y0 = grupo_cols[0]['y']
        x_ini = grupo_cols[0]['x0'] - 6
        x_fim, y_fim = page.rect.width, page.rect.height
        if fim < len(cols):
            nxt = cols[fim]
            if abs(nxt['y'] - y0) < 8 and nxt['x0'] > x_ini:
                x_fim = nxt['x0'] - 6
            elif nxt['y'] > y0:
                y_fim = nxt['y'] - 6
        centros = [(c['x0'] + c['x1']) / 2 for c in grupo_cols]
        meus = [s for s in spans if x_ini <= s['x0'] < x_fim and y0 + 4 < s['y'] < y_fim and 'SC700' not in s['font'] and s['color'] != 0xBBA268 and s['size'] < 10.5]
        # para no fim da tabela: um vão grande sem linhas
        meus.sort(key=lambda s: (s['y'], s['x0']))
        linhas: list[list[dict]] = []
        for s in meus:
            if linhas and abs(linhas[-1][0]['y'] - s['y']) < 2.5:
                linhas[-1].append(s)
            else:
                if linhas and s['y'] - linhas[-1][0]['y'] > 40:
                    break
                linhas.append([s])
        grupo = sub = ''
        pend_nome: list[str] = []
        ancora: dict | None = None
        for ln in linhas:
            ln.sort(key=lambda s: s['x0'])
            if len(ln) == 1 and 'Italic' in ln[0]['font']:
                if 'Black' in ln[0]['font']:
                    grupo, sub = ln[0]['t'], ''
                else:
                    sub = ln[0]['t']
                ancora = None
                continue
            nome = [s for s in ln if s['x1'] < grupo_cols[1]['x0'] - 2 or (len(grupo_cols) > 1 and s['x0'] < centros[0] + 40 and s['x1'] < centros[1] - 8)]
            resto = [s for s in ln if s not in nome]
            if not resto:
                # pedaço de nome em linha própria: antes da linha dos números ou depois dela
                if ancora is not None and abs(ln[0]['y'] - ancora['y']) < 10:
                    ancora['cells'][0] = (ancora['cells'][0] + ' ' + ' '.join(s['t'] for s in nome)).strip()
                    ancora = None
                else:
                    pend_nome.append(' '.join(s['t'] for s in nome))
                continue
            cells = [''] * len(grupo_cols)
            cells[0] = ' '.join(pend_nome + [s['t'] for s in nome]).strip()
            pend_nome = []
            for s in resto:
                c = (s['x0'] + s['x1']) / 2
                k = min(range(1, len(grupo_cols)), key=lambda j: abs(centros[j] - c))
                cells[k] = (cells[k] + ' ' + s['t']).strip()
            row = {'grupo': grupo, 'subgrupo': sub, 'cols': [fold(c['t']) for c in grupo_cols], 'cells': cells, 'x': nome[0]['x0'] if nome else 0, 'y': ln[0]['y'], 'pagina': livro.numero_impresso(pdf)}
            out.append(row)
            ancora = row
    return out


# ------------------------------------------------------------------ descrições "Nome. texto"

def eh_titulo_entrada(l: Linha) -> bool:
    s = l.spans[0]
    return 'Semibold' in s.font and s.color not in (0, 0x231F20) and s.text.strip().endswith('.')


def descricoes(livro: Livro, ini: int, fim: int) -> dict[str, tuple[str, int]]:
    """{nome dobrado: (texto, página)} das entradas em negrito colorido seguidas de texto."""
    linhas = livro.faixa(ini, fim)
    out: dict[str, tuple[str, int]] = {}
    atual: str | None = None
    corpo: list[Linha] = []
    pagina = 0

    def fecha():
        if atual:
            texto = paragrafos(corpo)
            out[fold(atual)] = (texto, pagina)

    for l in linhas:
        # Subitem de lista ("I Atordoamento. Também chamadas…"): o marcador é um glifo de outra fonte e a linha é
        # do texto da entrada atual (granadas, medicamentos…). Sem isto a primeira linha de cada subitem se perdia.
        if atual and l.spans and 'OutroLado' in l.spans[0].font and l.spans[0].text.strip() in ('I', 'b') and len(l.spans) > 1:
            corpo.append(Linha(l.pagina, l.pdf, l.x, l.y, l.x1, l.col, l.spans[1:]))
            continue
        if eh_titulo_entrada(l):
            fecha()
            atual = l.spans[0].text.strip().rstrip('.')
            pagina = l.pagina
            resto = l.spans[1:]
            l2 = Linha(l.pagina, l.pdf, l.x, l.y, l.x1, l.col, resto)
            corpo = [l2] if resto else []
        elif atual and 'Warnock' in l.font:
            corpo.append(l)
        elif atual and l.size > 10.5:
            fecha()  # título de seção ou quadro: a entrada acabou
            atual, corpo = None, []
    fecha()
    return out


def acha(desc: dict[str, tuple[str, int]], nome: str) -> tuple[str, int]:
    f = fold(nome)
    if f in desc:
        return desc[f]
    # "Granada de fragmentação" ↔ "Granadas"; "Balas curtas" ↔ "Balas"
    for k, v in desc.items():
        k1 = k[:-1] if k.endswith('s') else k
        if f.startswith(k + ' ') or k.startswith(f + ' ') or f.startswith(k1 + ' ') or f == k1:
            return v
    if f.replace('ss', 's') in desc:
        return desc[f.replace('ss', 's')]
    return '', 0


# ------------------------------------------------------------------ montagem

def _item(nome: str, **kw) -> dict:
    base = {'nome': nome, 'tipo': 'Equipamento', 'categoria': 0, 'espacos': 1, 'defesa': 0, 'dano': '', 'tipoDano': '', 'critico': '',
            'alcance': '', 'proficiencia': '', 'empunhadura': '', 'elemento': '', 'descricao': '', 'pagina': 0}
    base.update(kw)
    return base


def armas(livro: Livro, paginas: list[int], desc: dict) -> list[dict]:
    out = []
    vistos: set[str] = set()
    grupo_ant = ''
    for pdf in paginas:
        for r in tabela(livro, pdf):
            if 'dano' not in r['cols']:
                continue
            r['grupo'] = r['grupo'] or grupo_ant
            grupo_ant = r['grupo']
            c = dict(zip(r['cols'], r['cells']))
            nome = c.get('arma', r['cells'][0]).strip()
            if not nome or c.get('categoria', '—') in ('—', '–', ''):
                continue  # coronhada e outros ataques sem item
            prof = re.sub(r'^Armas\s+', '', r['grupo']).strip()
            sub = r['subgrupo']
            emp = 'Leve' if 'Leve' in sub else 'Uma mão' if 'Uma Mão' in sub or 'Uma mão' in sub else 'Duas mãos' if 'Duas' in sub else ''
            municao = c.get('dano', '—') in ('—', '–') and any(m in fold(nome) for m in MUNICOES)
            texto, pg = acha(desc, nome)
            tipo = c.get('tipo', '')
            if fold(nome) in vistos:
                continue
            vistos.add(fold(nome))
            if municao:
                out.append(_item(nome, tipo='Munição', categoria=ROMANOS.get(c.get('categoria', '0'), 0), espacos=numero(c.get('espacos', '1')), descricao=texto, pagina=r['pagina']))
                continue
            out.append(_item(
                nome,
                tipo='Arma',
                categoria=ROMANOS.get(c.get('categoria', '0'), 0),
                espacos=numero(c.get('espacos', '1')),
                dano=c.get('dano', '').replace('—', ''),
                critico=c.get('critico', '').replace('—', ''),
                alcance=c.get('alcance', '').replace('—', '').replace('–', '').lower(),
                tipoDano='/'.join(TIPO_DANO.get(t.strip(), t.strip()) for t in re.split(r'[/ ]', tipo) if t.strip() and t.strip() not in '—–'),
                proficiencia=prof.capitalize() if prof else '',
                empunhadura=emp,
                descricao=texto,
                pagina=r['pagina'],
            ))
    return out


def protecoes(livro: Livro, paginas: list[int], desc: dict) -> list[dict]:
    out = []
    for pdf in paginas:
        for r in tabela(livro, pdf):
            if 'defesa' not in r['cols']:
                continue
            c = dict(zip(r['cols'], r['cells']))
            nome = r['cells'][0].strip()
            texto, _ = acha(desc, nome)
            if not texto:
                texto, _ = acha(desc, f'Proteção {nome}')
            if nome in ('Leve', 'Pesada'):
                nome = f'Proteção {nome.lower()}'
            out.append(_item(nome, tipo='Proteção', categoria=ROMANOS.get(c.get('categoria', '0'), 0), espacos=numero(c.get('espacos', '1')),
                             defesa=int(numero(c.get('defesa', '0').replace('+', ''))), descricao=texto, pagina=r['pagina']))
    return out


def gerais(livro: Livro, paginas: list[int], desc: dict) -> list[dict]:
    out = []
    for pdf in paginas:
        for r in tabela(livro, pdf):
            if r['cols'][:1] != ['nome'] or 'dano' in r['cols'] or 'defesa' in r['cols'] or len(r['cols']) != 3:
                continue
            nome = r['cells'][0].strip()
            if not nome:
                continue
            esp = r['cells'][2].strip()
            texto, _ = acha(desc, nome)
            out.append(_item(nome, categoria=ROMANOS.get(r['cells'][1].strip(), 0), espacos=numero(esp) if esp not in ('*', '–', '—') else 0,
                             descricao=texto, pagina=r['pagina']))
    return out


# ------------------------------------------------------------------ itens amaldiçoados com nome

ELEM = {'SANGUE': 'Sangue', 'MORTE': 'Morte', 'CONHECIMENTO': 'Conhecimento', 'ENERGIA': 'Energia', 'MEDO': 'Medo', '[VARIA]': 'Variável'}


def amaldicoados(livro: Livro, ini: int, fim: int, fonte_nome=('DaisyWheel', 'Keyes'), tam_min=12.5, tam_max=15.5) -> list[dict]:
    """Itens especiais: título (DaisyWheel 14), elemento pelo cabeçalho anterior, texto até o próximo título."""
    linhas = livro.faixa(ini, fim)
    out: list[dict] = []
    elemento = ''
    atual: dict | None = None
    corpo: list[Linha] = []

    def fecha():
        if atual is not None:
            atual['descricao'] = paragrafos(corpo)
            out.append(atual)

    for l in linhas:
        t = l.text.strip()
        if t.upper() in ELEM and ('Optima' in l.font or 'Bold' in l.font):
            elemento = ELEM[t.upper()]
            continue
        if any(f in l.font for f in fonte_nome) and tam_min <= l.size <= tam_max:
            # nome em duas linhas
            if atual is not None and not corpo and abs(l.y - atual['_y']) < l.size * 1.6:
                atual['nome'] = titulo(atual['nome'] + ' ' + t)
                atual['_y'] = l.y
                continue
            fecha()
            atual = _item(titulo(t), tipo='Amaldiçoado', categoria=2, espacos=1, elemento=elemento, pagina=l.pagina)
            atual['_y'] = l.y
            corpo = []
            continue
        if atual is not None and 'Warnock' in l.font:
            corpo.append(l)
    fecha()
    for i in out:
        i.pop('_y', None)
        # "Exceto quando indicado o contrário, contam como itens de categoria II" (livro, p. 148): o texto pode dizer outra.
        m = re.search(r'\bde categoria (IV|III|II|I)\b', i['descricao'])
        if m:
            i['categoria'] = ROMANOS[m.group(1)]
    return out


def amaldicoados_tabela(livro: Livro, tabelas: list[int], ini: int, fim: int) -> list[dict]:
    """Itens amaldiçoados com tabela (Poder | Elemento | Categoria | Espaços) e descrição "Nome." (Sobrevivendo ao Horror)."""
    desc = descricoes(livro, ini, fim)
    out = []
    for pdf in tabelas:
        for r in tabela(livro, pdf):
            if r['cols'][:1] != ['poder']:
                continue
            c = dict(zip(r['cols'], r['cells']))
            nome = titulo(r['cells'][0].strip())
            texto, pg = acha(desc, nome)
            out.append(_item(nome[:1].upper() + nome[1:], tipo='Amaldiçoado', categoria=ROMANOS.get(c.get('categoria', 'II'), 2), espacos=numero(c.get('espacos', '1')),
                             elemento=c.get('elemento', '').strip().capitalize(), descricao=texto, pagina=pg or r['pagina']))
    return out
