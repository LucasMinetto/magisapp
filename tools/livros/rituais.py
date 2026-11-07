"""Rituais: nome (fonte de título), linha do elemento e círculo (texto branco), campos e texto."""
from __future__ import annotations

import re

from pdf import Linha, Livro, juntar, paragrafos, titulo

ELEMENTOS = {'SANGUE': 'Sangue', 'MORTE': 'Morte', 'CONHECIMENTO': 'Conhecimento', 'ENERGIA': 'Energia', 'MEDO': 'Medo'}
LINHA_ELEMENTO = re.compile(r'^\s*((?:SANGUE|MORTE|CONHECIMENTO|ENERGIA|MEDO|VARIÁVEL)\s*\d?\s*)+$')
CAMPOS = {'execução': 'execucao', 'alcance': 'alcance', 'alvo': 'alvo', 'alvos': 'alvo', 'área': 'alvo', 'efeito': 'alvo', 'duração': 'duracao', 'resistência': 'resistencia'}
DADO = r'\d+d\d+(?:\s*\+\s*\d+)?'
# "6d8 pontos de dano de Sangue", "10d6 pontos de dano mental", "6d8 pontos de dano (metade corte, metade Sangue)"
DANO = re.compile(rf'({DADO})\s+pontos?\s+de\s+dano(?![^.;]{{0,25}}?(?:por\s+espaço|para\s+cada))(?:\s+de\s+(\w+)|\s+\(metade\s+(\w+),\s+metade\s+(\w+)\)|\s+(mental|químico|qu[íi]mica))?', re.I)
# (dano "por espaço" ou "para cada 3m" varia com a cena: não é o dano do ritual)
# nas formas Discente e Verdadeiro: "muda o dano (direto) para 10d8", "aumenta o dano ... para 6d6"
MUDA_DANO = re.compile(rf'o\s+dano[^.;]{{0,40}}?\s+para\s+({DADO})', re.I)


def tipo_do_dano(m: re.Match) -> str:
    if m.group(2):
        return m.group(2).capitalize()
    if m.group(3):
        return f'{m.group(3).capitalize()} e {m.group(4).capitalize()}'
    if m.group(5):
        return 'Mental' if m.group(5).lower() == 'mental' else 'Químico'
    return ''


def eh_vermelho(c: int) -> bool:
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    return r > 150 and g < 80 and b < 80


def eh_nome(l: Linha) -> bool:
    return ('DaisyWheel' in l.font and l.size >= 17) or ('Keyes' in l.font and l.size >= 14)


def eh_linha_elemento(l: Linha) -> bool:
    return 'Optima' in l.font and LINHA_ELEMENTO.match(l.text) is not None


def eh_corpo(l: Linha) -> bool:
    return 'Warnock' in l.font


def eh_campo(l: Linha) -> bool:
    return 'Optima' in l.font and l.size < 9.6 and not eh_linha_elemento(l)


def ler_campos(linhas: list[Linha]) -> tuple[dict[str, str], str]:
    campos: dict[str, list[str]] = {}
    alvo_tipo = 'Alvo'
    atual: str | None = None
    for l in linhas:
        for s in l.spans:
            t = s.text
            if s.bold and eh_vermelho(s.color):
                rotulo = t.strip().rstrip(':').strip().lower()
                if rotulo in CAMPOS:
                    atual = CAMPOS[rotulo]
                    if atual == 'alvo':
                        alvo_tipo = {'área': 'Área', 'efeito': 'Efeito'}.get(rotulo, 'Alvo')
                    campos.setdefault(atual, [])
                    continue
            if atual:
                campos[atual].append(t)
    out = {k: juntar([' '.join(v)]).strip().rstrip(';').strip() for k, v in campos.items()}
    # rótulo que veio sem a cor de rótulo, grudado no valor anterior ("médio Alvo: o ritual")
    for k in list(out):
        m = re.search(r'\s(Alvo|Área|Efeito|Duração|Resistência):?\s+(.*)$', out[k])
        if m and CAMPOS[m.group(1).lower()] not in out:
            out[k] = out[k][: m.start()].strip()
            out[CAMPOS[m.group(1).lower()]] = m.group(2).strip()
            if m.group(1) in ('Área', 'Efeito'):
                alvo_tipo = m.group(1)
    if out.get('alvo', '').startswith('ou Área:'):
        out['alvo'] = out['alvo'][len('ou Área:'):].strip()
    return out, alvo_tipo


def elemento_circulo(t: str) -> tuple[str, int]:
    pares = re.findall(r'(SANGUE|MORTE|CONHECIMENTO|ENERGIA|MEDO|VARIÁVEL)\s*(\d)?', t)
    circulo = next((int(n) for _, n in pares if n), 1)
    if len(pares) == 1 and pares[0][0] in ELEMENTOS:
        return ELEMENTOS[pares[0][0]], circulo
    return 'Variável', circulo


def extrair(livro: Livro, ini: int, fim: int) -> list[dict]:
    linhas = livro.faixa(ini, fim)
    rituais: list[dict] = []
    i = 0
    while i < len(linhas):
        l = linhas[i]
        prox = linhas[i + 1] if i + 1 < len(linhas) else None
        # nome em duas linhas (nome longo)
        nome_linhas = [l]
        j = i + 1
        while eh_nome(l) and j < len(linhas) and eh_nome(linhas[j]) and linhas[j].col == l.col:
            nome_linhas.append(linhas[j])
            j += 1
        prox = linhas[j] if j < len(linhas) else None
        if not (eh_nome(l) and prox and eh_linha_elemento(prox)):
            i += 1
            continue
        # título de seção em caixa alta grudado no nome ("DESCRIÇÃO DOS RITUAIS" + "Alterar Destino")
        while len(nome_linhas) > 1 and nome_linhas[0].text.isupper() and not nome_linhas[-1].text.isupper():
            nome_linhas.pop(0)
        nome = titulo(juntar([x.text for x in nome_linhas]))
        elemento, circulo = elemento_circulo(prox.text)
        k = j + 1
        # linha do elemento às vezes quebra: "SANGUE" + "1"
        while k < len(linhas) and eh_linha_elemento(linhas[k]):
            elemento, circulo = elemento_circulo(prox.text + ' ' + linhas[k].text)
            k += 1
        campos_l: list[Linha] = []
        while k < len(linhas) and eh_campo(linhas[k]):
            campos_l.append(linhas[k])
            k += 1
        corpo: list[Linha] = []
        while k < len(linhas) and not eh_nome(linhas[k]):
            if eh_corpo(linhas[k]):
                a, b = (corpo[-1] if corpo else None), linhas[k]
                # outra coluna começando no meio de uma frase de outro texto (introdução do capítulo)
                if a and (a.col != b.col or a.pdf != b.pdf) and b.text[:1].islower() and a.text.rstrip().endswith('.'):
                    break
                corpo.append(b)
            elif corpo:
                break  # quadro ou título de seção: acabou o ritual
            k += 1
        if not campos_l:
            i = k  # lista de rituais por círculo, não é um ritual
            continue
        campos, alvo_tipo = ler_campos(campos_l)
        efeito_l, disc_l, verd_l = [], [], []
        alvo_lista = efeito_l
        for c in corpo:
            primeiro = c.spans[0]
            if primeiro.bold and eh_vermelho(primeiro.color) and primeiro.text.strip().startswith('Discente'):
                alvo_lista = disc_l
            elif primeiro.bold and eh_vermelho(primeiro.color) and primeiro.text.strip().startswith('Verdadeiro'):
                alvo_lista = verd_l
            alvo_lista.append(c)
        tira = lambda s: re.sub(r'^(Discente|Verdadeiro)\s*', '', s).strip()
        r = {
            'nome': nome,
            'elemento': elemento,
            'circulo': circulo,
            'execucao': campos.get('execucao', ''),
            'alcance': campos.get('alcance', ''),
            'alvo': campos.get('alvo', ''),
            'alvoTipo': alvo_tipo,
            'duracao': campos.get('duracao', ''),
            'resistencia': campos.get('resistencia', ''),
            'efeito': paragrafos(efeito_l),
            'discente': tira(paragrafos(disc_l)),
            'verdadeiro': tira(paragrafos(verd_l)),
            'danoNormal': '',
            'danoDiscente': '',
            'danoVerdadeiro': '',
            'tipoDano': '',
            'pagina': l.pagina,
        }
        m = DANO.search(r['efeito'])
        if m:
            r['danoNormal'] = m.group(1).replace(' ', '')
            r['tipoDano'] = tipo_do_dano(m)
        for campo, texto in (('danoDiscente', r['discente']), ('danoVerdadeiro', r['verdadeiro'])):
            m2 = MUDA_DANO.search(texto) or DANO.search(texto)
            if m2:
                r[campo] = m2.group(1).replace(' ', '')
                if not r['tipoDano'] and isinstance(m2.re, type(DANO)) and m2.re is DANO:
                    r['tipoDano'] = tipo_do_dano(m2)
        rituais.append(r)
        i = k
    return rituais
