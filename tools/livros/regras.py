"""Regras mecânicas dos livros para a tela Regras: texto por capítulo e seção, com a página do livro.

Fora: ambientação, história e conselhos de como mestrar. As entradas que já estão na biblioteca
(cada ritual, item e ameaça) saem do texto; a tela liga para elas.

Formato do texto de cada seção (um mini-Markdown que a tela entende):
  "## Título" / "### Subtítulo"     títulos
  "@p 123"                          a partir daqui, página 123 do livro
  ":: linha | linha"                quadro ou tabela (uma linha do livro por linha)
  parágrafos com **negrito** e *itálico*
"""
from __future__ import annotations

import re

from itens import fold
from pdf import Linha, Livro, juntar

# (capítulo, título da seção, página do PDF onde começa, título que marca o fim (ou None = próxima seção), página do fim)
OP = [
    ('Introdução', 'A Mecânica Básica: Testes', 19),
    ('Introdução', 'Termos Importantes', 20),
    ('Criação de Personagem', 'Passo a Passo para Criar seu Agente', 23),
    ('Criação de Personagem', 'Atributos', 24),
    ('Criação de Personagem', 'Origens', 26),
    ('Criação de Personagem', 'Classes', 32),
    ('Criação de Personagem', 'Toques Finais', 46),
    ('Perícias', 'Usando Perícias', 49),
    ('Perícias', 'Lista de Perícias', 50, 'Acrobacia'),
    ('Equipamento', 'Patente', 61),
    ('Equipamento', 'Pontos de Prestígio', 61),
    ('Equipamento', 'Capacidade de Carga', 63),
    ('Equipamento', 'Limites de Uso', 63),
    ('Equipamento', 'Armas', 64),
    ('Equipamento', 'Proteções', 72),
    ('Equipamento', 'Equipamento Geral', 73),
    ('Regras', 'Lidando com as Regras', 84),
    ('Regras', 'Testes & Habilidades', 85),
    ('Regras', 'Investigação', 89),
    ('Regras', 'Combate', 92),
    ('Regras', 'Interlúdio', 102),
    ('O Outro Lado', 'Exposição Paranormal', 120),
    ('O Outro Lado', 'Sanidade', 121),
    ('O Outro Lado', 'Poderes Paranormais', 124),
    ('O Outro Lado', 'Rituais', 127),
    ('O Outro Lado', 'Itens Amaldiçoados', 154),
    ('O Mestre', 'Arbitrando Regras', 176),
    ('O Mestre', 'Regras Opcionais', 181),
    ('Ameaças', 'Construindo Combates', 187),
    ('Ameaças', 'Fichas de Ameaças', 188),
    ('Ameaças', 'Perigos', 300),
    ('Apêndice', 'Condições', 320),
    ('Apêndice', 'Clarificações de Regras', 322),
]
# onde cada seção acaba (página do PDF, título que começa o que vem depois)
OP_FIM = {
    'Termos Importantes': (21, 'Começando'),
    'Toques Finais': (47, None),
    'Lista de Perícias': (59, None),
    'Equipamento Geral': (77, None),
    'Interlúdio': (103, None),
    'Rituais': (132, 'Lista de Rituais'),
    'Itens Amaldiçoados': (158, 'Itens Amaldiçoados Especiais'),
    'Arbitrando Regras': (181, 'Regras Opcionais'),
    'Regras Opcionais': (185, None),
    'Fichas de Ameaças': (191, None),
    'Perigos': (303, None),
    'Clarificações de Regras': (323, None),
    'Sanidade': (124, 'Poderes Paranormais'),
    'Poderes Paranormais': (127, 'Rituais'),
}

# Sobrevivendo ao Horror (sem sumário embutido): página do PDF = impressa + 1
SAH = [
    ('Sobreviventes', 'Novas Origens', 8),
    ('Sobreviventes', 'O Combatente Sobrevivente', 15),
    ('Sobreviventes', 'O Especialista Sobrevivente', 23),
    ('Sobreviventes', 'O Ocultista Sobrevivente', 27),
    ('Sobreviventes', 'Nova Classe: O Sobrevivente', 31),
    ('Sobreviventes', 'Poderes Gerais', 34),
    ('Sobreviventes', 'Equipamentos', 38),
    ('Sobreviventes', 'Poderes Paranormais', 47),
    ('O Horror', 'Novas Ações de Investigação', 82),
    ('O Horror', 'Atributos Negativos', 82),
    ('O Horror', 'Eventos de Investigação', 83),
    ('O Horror', 'Medo em Jogo', 88),
    ('O Horror', 'Perseguições', 91),
    ('O Horror', 'Furtividade', 93),
    ('O Horror', 'Fabricação em Campo', 95),
    ('O Horror', 'Vida Além da Ordem', 95),
    ('Regras Opcionais', 'NEX & Experiência', 99),
    ('Regras Opcionais', 'Jogando sem Sanidade', 105),
    ('Regras Opcionais', 'Ferimentos Debilitantes', 106),
    ('Regras Opcionais', 'Jogando sem Mapa', 107),
    ('Regras Opcionais', 'Evolução por Patentes', 109),
    ('Regras Opcionais', 'Os Limites da Compreensão Humana', 114),
    ('Regras Opcionais', 'Conjuração Complexa', 115),
    ('Regras Opcionais', 'Conjurando Rituais Desconhecidos', 118),
    ('Regras Opcionais', 'Desastres Paranormais', 118),
    ('Regras Opcionais', 'Combate Narrativo', 120),
]
SAH_FIM = {
    'Atributos Negativos': (82, 'Novas Ações de Investigação'),
    'Poderes Paranormais': (48, None),
    'Equipamentos': (46, None),
    'Vida Além da Ordem': (98, None),
    'Combate Narrativo': (124, None),
    'Poderes Gerais': (37, None),
}


# Linhas que o PDF põe na ordem errada (a coluna se mistura). Cada uma é conferida na página do livro.
CORRECOES: dict[str, list[tuple[str, str]]] = {
    # Livro, p. 17-18: a linha "algum momento, você se envolveu em um assunto da Ordem" é do Criminoso, não do Chef.
    'Origens': [
        ('se en-\n\nalgum momento, você se envolveu em um assunto da Ordem volvesse', 'se envolvesse'),
        ('criminosa. Em\n\n@p 18\n\n— talvez', 'criminosa. Em algum momento, você se envolveu em um assunto da Ordem\n\n@p 18\n\n— talvez'),
    ],
}


def eh_titulo(l: Linha) -> bool:
    return l.size >= 12.5 and any(f in l.font for f in ('DaisyWheel', 'Keyes', 'Westsac', 'Roman-New-Times', 'Optima'))


def bate(l: Linha, titulo: str) -> bool:
    a, b = fold(l.text), fold(titulo)
    return bool(a) and (a == b or b.startswith(a) and len(a) >= 5 or a.startswith(b))


def _inline(spans) -> str:
    out = ''
    for s in spans:
        t = s.text
        if not t.strip():
            out += t
            continue
        if 'd20' in s.font:  # o glifo do dado: "–O" é –1d20, "OO" é 2d20; "3O" (número antes) é 3d20
            n = re.search(r'(\d+)$', out)
            if n and len(t.strip()) == 1:
                out = out[: n.start()] + f'{n.group(1)}d20'
            else:
                out += f'{len(t.strip())}d20'
            continue
        if 'OutroLado' in s.font and t.strip() in ('I', 'b'):  # marcador de lista do livro (glifo), não é texto
            continue
        if 'Semibold' in s.font or ('Bold' in s.font and 'Warnock' in s.font and len(t.strip()) < 45):
            out += f'**{t.strip()}** ' if not t.startswith(' ') else f' **{t.strip()}** '
        elif s.italic and 'Warnock' in s.font:
            out += f'*{t.strip()}* ' if not t.startswith(' ') else f' *{t.strip()}* '
        else:
            out += t
    return re.sub(r'\s+', ' ', out).replace('** **', ' ').replace('* *', ' ')


def fonte_principal(l: Linha) -> str:
    conta: dict[str, int] = {}
    for s in l.spans:
        conta[s.font] = conta.get(s.font, 0) + len(s.text.strip())
    return max(conta, key=conta.get) if conta else ''


def secao_md(linhas: list[Linha], excluir: set[str]) -> str:
    blocos: list[str] = []
    par: list[str] = []
    quadro: list[str] = []
    pagina = None
    ant: Linha | None = None

    def fecha_par():
        nonlocal par
        if par:
            t = juntar(par)
            m = re.match(r'^\*\*([^*]+?)\.?\*\*', t)
            if not (m and fold(m.group(1).rstrip('.')) in excluir):
                blocos.append(t)
            par = []

    def fecha_quadro():
        nonlocal quadro
        if quadro:
            blocos.append('\n'.join(':: ' + q for q in quadro))
            quadro = []

    for l in linhas:
        t = l.text.strip()
        if not t:
            continue
        if l.pagina != pagina:
            fecha_par()
            fecha_quadro()
            pagina = l.pagina
            blocos.append(f'@p {pagina}')
        if eh_titulo(l):
            fecha_par()
            fecha_quadro()
            # título em duas linhas
            if blocos and blocos[-1].startswith('#') and ant is not None and eh_titulo(ant) and abs(l.y - ant.y) < l.size * 1.6 and l.col == ant.col:
                blocos[-1] += ' ' + t
            else:
                nivel = '##' if l.size >= 17 else '###'
                blocos.append(f'{nivel} {t}')
            ant = l
            continue
        fp = fonte_principal(l)
        if 'Warnock' in fp or 'Keyes' in fp or 'Gabriele' in fp:
            fecha_quadro()
            novo = ant is None or l.col != ant.col or l.pdf != ant.pdf or (l.y - ant.y) > 1.45 * max(ant.size, 9) or (l.y - ant.y) < -1 or 'Warnock' not in fonte_principal(ant)
            # parágrafo que continua na outra coluna ou página
            if novo and par and ant is not None and (l.col != ant.col or l.pdf != ant.pdf) and par[-1].rstrip()[-1:] not in '.:!?)”"':
                novo = False
            primeiro = l.spans[0]
            if 'Semibold' in primeiro.font and primeiro.text.strip().endswith('.'):
                novo = True
            if novo:
                fecha_par()
            par.append(_inline(l.spans))
        elif 'Optima' in fp and fp != 'Optima-Medium':
            fecha_par()
            quadro.append(re.sub(r'\s+', ' ', ''.join(('d20' if 'd20' in s.font else s.text) for s in l.spans if 'Wingdings' not in s.font)).strip())
        ant = l
    fecha_par()
    fecha_quadro()
    # tira marcas de página sem conteúdo depois delas
    out: list[str] = []
    for b in blocos:
        if b.startswith('@p') and out and out[-1].startswith('@p'):
            out[-1] = b
        else:
            out.append(b)
    while out and out[-1].startswith('@p'):
        out.pop()
    return '\n\n'.join(out)


def extrair(livro: Livro, nome_livro: str, secoes: list[tuple], fins: dict, excluir: set[str], ultima: int) -> list[dict]:
    out = []
    for n, sec in enumerate(secoes):
        cap, titulo_s, ini = sec[0], sec[1], sec[2]
        marca_ini = sec[3] if len(sec) > 3 else titulo_s
        if titulo_s in fins:
            fim, marca_fim = fins[titulo_s]
        elif n + 1 < len(secoes):
            prox = secoes[n + 1]
            fim, marca_fim = prox[2], (prox[3] if len(prox) > 3 else prox[1])
        else:
            fim, marca_fim = ultima, None
        linhas = livro.faixa(ini, fim)
        # começo: o título da seção na primeira página (se não achar, a página toda)
        k0 = next((i for i, l in enumerate(linhas) if l.pdf == ini and eh_titulo(l) and bate(l, marca_ini)), None)
        if k0 is None:
            k0 = next((i for i, l in enumerate(linhas) if l.pdf == ini), 0)
        else:
            # pula o resto do título, quando ele ocupa duas linhas
            t0 = linhas[k0]
            k0 += 1
            while k0 < len(linhas) and eh_titulo(linhas[k0]) and linhas[k0].col == t0.col and 0 <= linhas[k0].y - t0.y < t0.size * 2.2:
                t0 = linhas[k0]
                k0 += 1
        k1 = len(linhas)
        if marca_fim:
            k1 = next((i for i, l in enumerate(linhas) if i > k0 and l.pdf == fim and eh_titulo(l) and bate(l, marca_fim)), k1)
            if k1 == len(linhas) and fim != ini:
                # não achou o título do fim: para antes da página do fim
                k1 = next((i for i, l in enumerate(linhas) if l.pdf == fim), k1)
        md = secao_md(linhas[k0:k1], excluir)
        for errado, certo in CORRECOES.get(titulo_s, []):
            if errado not in md:
                raise SystemExit(f'Correção de "{titulo_s}" não achou o trecho: {errado[:60]!r}')
            md = md.replace(errado, certo)
        if not md.strip():
            continue
        out.append({
            'id': fold(f'{nome_livro} {titulo_s}').replace(' ', '-'),
            'livro': nome_livro,
            'capitulo': cap,
            'titulo': titulo_s,
            'pagina': livro.numero_impresso(ini),
            'texto': md,
        })
    return out
