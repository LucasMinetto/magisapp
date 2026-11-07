"""Ameaças: fichas grandes (criaturas, em duas colunas) e compactas (ameaças da Realidade, animais).

Cada ficha começa no nome (fonte de título grande) perto da marca "VD". As linhas da ficha viram texto
normalizado (o dado de 20 lados do livro é um glifo: vira "d20"), e os campos saem por expressões regulares.
Habilidades e ações saem pelas linhas: tipo de ação (PADRÃO, REAÇÃO…) ou nome em caixa alta começam uma entrada.
"""
from __future__ import annotations

import re

from pdf import Linha, Livro, juntar, titulo

TIPOS = {'PADRÃO': 'Padrão', 'MOVIMENTO': 'Movimento', 'REAÇÃO': 'Reação', 'LIVRE': 'Livre', 'COMPLETA': 'Completa'}
ELEMENTOS = {'SANGUE': 'Sangue', 'MORTE': 'Morte', 'CONHECIMENTO': 'Conhecimento', 'ENERGIA': 'Energia', 'MEDO': 'Medo'}
TAMANHOS = ('MINÚSCULO', 'PEQUENO', 'MÉDIO', 'GRANDE', 'ENORME', 'COLOSSAL')
ROTULOS = ('PRESENÇA PERTURBADORA', 'SENTIDOS', 'PERCEPÇÃO', 'INICIATIVA', 'DEFESA', 'FORTITUDE', 'REFLEXOS', 'VONTADE', 'PONTOS DE VIDA',
           'RESISTÊNCIAS', 'RESISTÊNCIA', 'VULNERABILIDADES', 'VULNERABILIDADE', 'IMUNIDADES', 'IMUNIDADE', 'ATRIBUTOS', 'AGI', 'FOR', 'INT', 'PRE', 'VIG',
           'PERÍCIAS', 'DESLOCAMENTO', 'AÇÕES', 'TESTE', 'DANO', 'VD')


def texto_span(s) -> str:
    if 'd20' in s.font:
        # um glifo por dado: "OO" é 2d20; um só fica "d20" para juntar com o número antes ("5O" é 5d20)
        n = len(s.text.strip())
        return f'{n}d20' if n > 1 else 'd20'
    if 'Wingdings' in s.font:
        return ' '
    if 'OutroLado' in s.font and s.text.strip() in ('I', 'b'):
        return ''  # marcador de lista do livro
    return s.text


def texto_linha(l: Linha) -> str:
    partes = []
    ant = None
    for s in l.spans:
        tx = texto_span(s)
        if ant is not None and ant.x1 and s.x - ant.x1 > 1.2 and not (partes and partes[-1].endswith(' ')) and not tx.startswith(' ') and 'd20' not in s.font and 'd20' not in ant.font:
            partes.append(' ')
        partes.append(tx)
        ant = s
    t = ''.join(partes)
    # o livro omite o 1 ("O+10" é 1d20+10) e às vezes escreve "–2" antes do dado (dados negativos: fica como está)
    t = re.sub(r'(?<![\d–-])\s*d20', ' 1d20', t)
    t = re.sub(r'(?<=[–-])d20', '1d20', t)  # "–O" é –1d20
    t = re.sub(r'(\dd20)(?=[A-Za-zÀ-ú])', r'\1 ', t)  # "–1d20em testes"
    t = re.sub(r'(\d)\s*d20\s*([+–-])\s*(\d)', lambda m: f'{m.group(1)}d20{"+" if m.group(2) == "+" else "-"}{m.group(3)}', t)
    t = re.sub(r'(\d)\s*d20', r'\1d20', t)
    return re.sub(r'\s+', ' ', t).strip()


def eh_caixa_alta(s) -> bool:
    t = s.text.strip()
    return bool(t) and t.upper() == t and any(c.isalpha() for c in t) and ('Black' in s.font or 'Bold' in s.font)


def ancoras(livro: Livro, ini: int, fim: int) -> list[tuple[int, float, str, int]]:
    """(página do PDF, y do nome, nome, VD) de cada ficha."""
    out = []
    for pdf in range(ini, fim + 1):
        page = livro.doc[pdf - 1]
        spans = [(s, l['bbox']) for b in page.get_text('dict')['blocks'] for l in b.get('lines', []) for s in l['spans'] if s['text'].strip()]
        for i, (s, _) in enumerate(spans):
            t = s['text'].strip()
            if not (t == 'VD' or re.fullmatch(r'VD\s*\d+', t)):
                continue
            m = re.fullmatch(r'VD\s*(\d+)', t)
            vd = int(m.group(1)) if m else next((int(re.sub(r'\D', '', x['text'])) for x, _ in spans[i + 1 : i + 4] if re.sub(r'\D', '', x['text'])), 0)
            y, x = s['bbox'][1], s['bbox'][0]
            cand = [x2 for x2, _ in spans if 'Roman-New-Times' in x2['font'] and 15 < x2['size'] < 60 and y - 50 < x2['bbox'][1] < y + 20]
            meio = page.rect.width / 2
            mesma_col = [z for z in cand if (z['bbox'][0] < meio - 15) == (x < meio - 15)]
            nomes = mesma_col or cand
            nomes.sort(key=lambda z: z['bbox'][1])
            if not nomes:
                # nome escrito em fonte especial na página anterior (o "Estrangeiro" aparece como "???" no sumário)
                ant = livro.doc[pdf - 2] if pdf > 1 else None
                grandes = [z for b in (ant.get_text('dict')['blocks'] if ant else []) for l2 in b.get('lines', []) for z in l2['spans']
                           if z['text'].strip() and z['size'] >= 30 and not z['text'].strip().isdigit()]
                if not grandes:
                    continue
                nomes = [grandes[-1]]
            nome = titulo(' '.join(z['text'].strip() for z in nomes))
            out.append((pdf, nomes[0]['bbox'][1], nome, vd, nomes[0]['bbox'][0]))
    return out


def _secao(txt: str, rotulo: str, fim: tuple[str, ...]) -> str:
    m = re.search(rotulo + r'\s*(.*?)\s*(?=' + '|'.join(fim) + r'|$)', txt, re.S)
    return re.sub(r'\s+', ' ', m.group(1)).strip(' |,;') if m else ''


def _num(s: str) -> int:
    m = re.search(r'-?\d+', s or '')
    return int(m.group(0)) if m else 0


def ficha(nome: str, vd: int, linhas: list[Linha]) -> dict:
    # descarta legendas de arte e o texto corrido (ambientação): a ficha é toda em Optima
    linhas = [l for l in linhas if l.font != 'Optima-Medium' and not l.font.startswith(('Warnock', 'Roman-New-Times', 'Keyes', 'FStein')) or 'Gabriele' in l.font or ('Keyes' in l.font and 'ENIGMA' in l.text.upper())]
    textos = [texto_linha(l) for l in linhas]
    txt = '\n'.join(t for t, l in zip(textos, linhas) if 'Gabriele' not in l.font)

    a = {k: '' for k in ('elemento', 'tipo', 'tamanho', 'presencaDano', 'presencaNexImune', 'percepcao', 'iniciativa', 'sentidos', 'fortitude', 'reflexos', 'vontade',
                         'resistencias', 'vulnerabilidades', 'imunidades', 'pericias', 'deslocamento', 'enigma', 'descricao')}
    a.update(nome=nome, vd=vd, presencaDt=0, defesa=0, pv=0, pvMachucado=0, agi=0, **{'for': 0}, int=0, pre=0, vig=0, habilidades=[], acoes=[])
    cab = txt[:1500]
    for k, v in ELEMENTOS.items():
        if re.search(rf'(?<![A-ZÇÃÕÉ]){k}(?![A-ZÇÃÕÉ])', cab.split('PRESENÇA')[0].split('SENTIDOS')[0]):
            a['elemento'] = v if not a['elemento'] else a['elemento'] + ', ' + v
    m = re.search(r'(CRIATURA|PESSOA|ANIMAL|HUMANOIDE|OBJETO|CONSTRUTO)\s+(' + '|'.join(TAMANHOS) + ')', cab)
    if m:
        a['tipo'], a['tamanho'] = m.group(1).capitalize(), m.group(2).capitalize()
    m = re.search(r'PRESENÇA PERTURBADORA\s*DT\s*(\d+)\s*([^\n]*)', txt)
    if m:
        a['presencaDt'] = int(m.group(1))
        resto = m.group(2)
        n = re.search(r'NEX\s*(\d+%?)', resto)
        if n:
            a['presencaNexImune'] = n.group(1) if n.group(1).endswith('%') else n.group(1) + '%'
            resto = resto[: n.start()]
        a['presencaDano'] = resto.strip(' |')
    m = re.search(r'PERCEPÇÃO\s*([–-]?\d+d20[+-]?\d*)\s*((?:(?!DEFESA|INICIATIVA|FORTITUDE)[^\n|])*)', txt, re.I)
    if m:
        a['percepcao'] = m.group(1)
        a['sentidos'] = m.group(2).strip(' |,')
    m = re.search(r'INICIATIVA\s*([–-]?\d+d20[+-]?\d*)\s*((?:(?!DEFESA|PERCEPÇÃO|FORTITUDE)[^\n|])*)', txt, re.I)
    if m:
        a['iniciativa'] = m.group(1)
        if not a['sentidos'] and m.group(2).strip():
            a['sentidos'] = m.group(2).strip(' |,')
    m = re.search(r'DEFESA\s*(\d+)', txt)
    a['defesa'] = int(m.group(1)) if m else 0
    for campo, rot in (('fortitude', 'FORTITUDE'), ('reflexos', 'REFLEXOS'), ('vontade', 'VONTADE')):
        m = re.search(rot + r'\s*([–-]?\d+d20[+-]?\d*)', txt, re.I)
        a[campo] = m.group(1) if m else ''
    m = re.search(r'PONTOS DE VIDA\s*(\d+)\s*\|?\s*(?:(\d+)\s*machucado|machucado\s*(\d+))?', txt, re.I)
    if m:
        a['pv'] = int(m.group(1))
        a['pvMachucado'] = int(m.group(2) or m.group(3) or 0)
    else:
        m = re.search(r'(?m)^(\d+)\s*\|\s*(\d+)\s*machucado', txt, re.I)  # o número veio antes do rótulo
        if m:
            a['pv'], a['pvMachucado'] = int(m.group(1)), int(m.group(2))
    # cada campo vai até o próximo rótulo, ou até um nome de habilidade em caixa alta seguido de texto
    caixa_alta = r'\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\b(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+\b)*\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]?[a-záéíóúâêôãõç]'
    fim_defesas = ('VULNERABILIDADES?', 'IMUNIDADES?', 'ATRIBUTOS', r'\bAGI\b', r'\bAgi \d', 'RESISTÊNCIAS?', 'DESLOCAMENTO', 'PERÍCIAS', 'AÇÕES', caixa_alta)
    a['resistencias'] = _secao(txt, r'RESISTÊNCIAS?', fim_defesas)
    a['vulnerabilidades'] = _secao(txt, r'VULNERABILIDADES?', fim_defesas)
    a['imunidades'] = _secao(txt, r'IMUNIDADES?', fim_defesas)
    for k in ('agi', 'for', 'int', 'pre', 'vig'):
        m = re.search(rf'\b{k.upper()}\s*(-?\d+|–)', txt, re.I)
        a[k] = _num(m.group(1)) if m and m.group(1) != '–' else 0
    a['pericias'] = _secao(txt, 'PERÍCIAS', ('DESLOCAMENTO', r'\bAGI\b', r'\bAgi \d', 'AÇÕES', caixa_alta))
    m = re.search(r'DESLOCAMENTO\s*([^\n]*)', txt)
    if m:
        a['deslocamento'] = re.sub(r'\s*\|\s*(\d+)\s*$', r' (\1 quadrados)', m.group(1).strip())

    # ----- habilidades, ações e enigma, pelas linhas depois dos campos (deslocamento, atributos, perícias)
    rot_campo = re.compile(r'^(DESLOCAMENTO|AGI\b|Agi \d|PERÍCIAS|ATRIBUTOS|RESISTÊNCIAS?|VULNERABILIDADES?|IMUNIDADES?)')
    marcas = [i for i, t in enumerate(textos) if rot_campo.match(t)]
    ini = (max(marcas) + 1) if marcas else len(linhas)
    atual: dict | None = None
    corpo: list[str] = []
    em_acoes = False
    enigma: list[str] = []
    no_enigma = False

    def fecha():
        if atual is not None:
            atual['descricao'] = _corpo(corpo)
            (a['acoes'] if atual.pop('_acao') else a['habilidades']).append(atual)

    def resto_de(spans) -> str:
        return texto_linha(Linha(0, 0, 0, 0, 0, 0, list(spans))) if spans else ''

    for l, t in zip(linhas[ini:], textos[ini:]):
        if not t:
            continue
        if 'ENIGMA' in t.upper() and l.size >= 12:
            fecha()
            atual, corpo, no_enigma = None, [], True
            continue
        if no_enigma:
            if 'Gabriele' in l.font:
                enigma.append(t)
                continue
            no_enigma = False  # o quadro do enigma acabou; a ficha continua (outra coluna)
        if 'Gabriele' in l.font:
            continue
        spans = [x for x in l.spans if 'Wingdings' not in x.font and x.text.strip()]
        if not spans:
            continue
        if spans[0].text.strip() == 'AÇÕES':
            fecha()
            atual, corpo, em_acoes = None, [], True
            spans = spans[1:]
            if not spans:
                continue
        primeiro = spans[0].text.strip()
        tipo = TIPOS.get(primeiro.split()[0]) if primeiro and primeiro.split()[0] in TIPOS and primeiro.upper() == primeiro else None
        if tipo:
            fecha()
            resto = spans[1:]
            if primeiro.split()[0] != primeiro:  # tipo e nome no mesmo pedaço
                nome_e = primeiro[len(primeiro.split()[0]):].strip()
            else:
                nomes = []
                while resto and eh_caixa_alta(resto[0]):
                    nomes.append(resto.pop(0).text.strip())
                nome_e = ' '.join(nomes)
            atual = {'tipo': tipo, 'nome': titulo(nome_e) or tipo, '_acao': True}
            corpo = [resto_de(resto)] if resto else []
            em_acoes = True
            continue
        if re.match(r'^AGI\s', t):
            continue
        if eh_caixa_alta(spans[0]) and primeiro not in ROTULOS and not primeiro.startswith(('TESTE', 'DANO')):
            if atual is not None and atual['nome'] == 'Agredir':
                corpo.append('\n' + _ataque(t))  # "GARRAS Corpo a corpo x2"
                continue
            if not em_acoes:
                fecha()
                atual = {'tipo': '', 'nome': titulo(primeiro), '_acao': False}
                corpo = [resto_de(spans[1:])] if len(spans) > 1 else []
                continue
        if atual is not None:
            if primeiro.upper().startswith(('TESTE', 'DANO')) and atual['nome'] == 'Agredir':
                corpo.append('\n' + _ataque(t))
            else:
                corpo.append(t)
    fecha()
    a['enigma'] = juntar(enigma)
    return a


def _ataque(t: str) -> str:
    t = re.sub(r'^TESTE\s*', 'Teste ', t)
    t = re.sub(r'\|\s*DANO\s*', '| Dano ', t)
    m = re.match(r"^([A-ZÁÉÍÓÚÂÊÔÃÕÇÜ ,’'\-]+?)(\s+(?:Corpo|À|Distância|Corpo a corpo).*)$", t)
    if m:
        return f'{titulo(m.group(1).strip())}:{m.group(2)}'
    return t


def _corpo(partes: list[str]) -> str:
    out = ''
    for p in partes:
        if p.startswith('\n'):
            out = out.rstrip() + '\n' + p.strip()
        elif out.endswith('-') and p[:1].islower():
            out = out[:-1] + p
        else:
            out = (out + ' ' + p).strip() if not out.endswith('\n') else out + p
    return re.sub(r'[ \t]+', ' ', out).strip()


def extrair(livro: Livro, ini: int, fim: int) -> list[dict]:
    lista = ancoras(livro, ini, fim)
    meio = livro.doc[ini - 1].rect.width / 2
    # posição de leitura: página, coluna, altura
    pos = [(pdf, 0 if x < meio - 15 else 1, y, nome, vd) for pdf, y, nome, vd, x in lista]
    todas = [l for p in range(ini, fim + 1) for l in livro.linhas(p)]
    # Títulos grandes (abertura de outra criatura ou seção): a ficha não passa deles. Sem isto a Mescla (SaH p. 129)
    # engolia as páginas do Espectro Inesquecido até a ficha de exemplo do "Marcado".
    aberturas = sorted(
        (p, 0, s['bbox'][1])
        for p in range(ini, fim + 1)
        for b in livro.doc[p - 1].get_text('dict')['blocks']
        for l in b.get('lines', [])
        for s in l['spans']
        if s['size'] >= 30 and s['text'].strip() and not s['text'].strip().isdigit()
    )
    out = []
    for n, (pdf, col, y, nome, vd) in enumerate(pos):
        ini_k = (pdf, col, y - 2)
        fim_k = (pos[n + 1][0], pos[n + 1][1], pos[n + 1][2] - 2) if n + 1 < len(pos) else (fim + 1, 0, 0)
        corte = next((a for a in aberturas if a[0] > pdf), None)
        if corte and corte < fim_k:
            fim_k = corte
        linhas = [l for l in todas if ini_k <= (l.pdf, l.col, l.y) < fim_k]
        a = ficha(nome, vd, linhas)
        a['pagina'] = livro.numero_impresso(pdf)
        if not a['enigma']:
            # O quadro "Enigma de Medo" costuma ficar na página de abertura da criatura, antes da ficha.
            anterior = pos[n - 1][:3] if n else (ini, 0, 0)
            abertura = max((x for x in aberturas if anterior < x < (pdf, col, y)), default=None)
            if abertura:
                a['enigma'] = enigma_da_abertura([l for l in todas if abertura <= (l.pdf, 0, l.y) and (l.pdf, l.col, l.y) < ini_k])
        out.append(a)
    return out


def enigma_da_abertura(linhas: list[Linha]) -> str:
    """O texto do quadro "Enigma de Medo" (fonte Gabriele, logo depois do título do quadro)."""
    texto: list[str] = []
    dentro = False
    for l in linhas:
        t = texto_linha(l).strip()
        if not t:
            continue
        if 'ENIGMA' in t.upper() and l.size >= 12 and 'Gabriele' not in l.font:
            dentro = True
            continue
        if dentro:
            if 'Gabriele' in l.font:
                texto.append(t)
            elif texto:
                break
    return juntar(texto)
