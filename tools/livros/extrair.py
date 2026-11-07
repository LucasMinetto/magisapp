"""Extrai dos PDFs de Ordem Paranormal os rituais, itens e ameaças para a biblioteca do Magistrado.

Uso (na pasta tools/livros):
    python extrair.py "<Ordem Paranormal RPG v1-3.pdf>" "<Sobrevivendo-ao-Horror-v1-3.pdf>"

Gera app/src/main/livros/oprpg.json e sah.json. Os PDFs não vão para o git; os JSON vão (repositório privado).
Precisa de PyMuPDF (pip install pymupdf). A marca d'água com nome e e-mail de quem comprou o PDF nunca passa
(pdf.py descarta qualquer linha com e-mail, e o teste do app confere os JSON).
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ameacas  # noqa: E402
import itens  # noqa: E402
import regras  # noqa: E402
import rituais  # noqa: E402
from itens import fold  # noqa: E402
from pdf import EMAIL, Livro  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / 'app' / 'src' / 'main' / 'livros'
NS = uuid.UUID('6f1c0f0e-6d1b-4f2a-9d7e-6d61676973a1')  # ids fixos: o mesmo registro tem sempre o mesmo id


def ident(sigla: str, tipo: str, nome: str) -> str:
    return str(uuid.uuid5(NS, f'{sigla}/{tipo}/{fold(nome)}'))


def limpa_ameaca(a: dict) -> dict:
    for k in ('resistencias', 'vulnerabilidades', 'imunidades', 'pericias', 'sentidos'):
        a[k] = re.sub(r'\s+[A-ZÁÉÍÓÚ]$', '', a[k]).strip(' ,;|')
    if a['sentidos'].isupper():
        a['sentidos'] = a['sentidos'].capitalize()
    for h in a['habilidades'] + a['acoes']:
        h['descricao'] = h['descricao'].strip()
    return a


def corrige_itens(sigla: str, xs: list[dict]) -> list[dict]:
    out = []
    vistos = set()
    meds = next((i['descricao'] for i in xs if fold(i['nome']).startswith('medicamentos')), '')
    for i in xs:
        n = fold(i['nome'])
        if n.startswith('medicamentos '):
            i['nome'] = i['nome'].split(' ', 1)[1]
        if sigla == 'SaH':
            if n in ('balas curtas', 'cartuchos'):
                continue  # já estão no livro básico
            if i['tipo'] == 'Equipamento' and not i['descricao'] and i['espacos'] == 0.5 and i['categoria'] == 1 and fold(i['nome']).startswith('anti') or n in ('broncodilatador', 'coagulante', 'antidoto', 'antiemetico', 'antitermico', 'antihistaminico', 'anti inflamatorio', 'antibiotico'):
                i['descricao'] = meds
            if n in ('ampliador', 'perturbador', 'potencializador', 'prolongador'):
                i['nome'] = f"Catalisador {i['nome'].lower()}"
            if n == 'primeira adaga a':
                i['nome'] = 'A Primeira Adaga'
            if n == 'tablet do saber custoso':
                i['nome'] = 'Tábula do saber custoso'
        if sigla == 'OPRPG' and n == 'medidor de estabilidade da membrana':
            # Livro, p. 66-67: a frase continua no alto da coluna seguinte; o que vem depois é a tabela ao lado.
            corte = 'ainda pode não ter sido'
            if corte not in i['descricao']:
                raise SystemExit('Medidor de estabilidade: o texto mudou, confira a correção.')
            i['descricao'] = i['descricao'].split(corte)[0] + corte + (
                ' afetado por manifestações, assim como um lugar com a Membrana protegida por conter uma criatura'
                ' poderosa vinda de outro lugar.'
            )
        if fold(i['nome']) in vistos:
            continue
        vistos.add(fold(i['nome']))
        out.append(i)
    return out


def livro_op(caminho: str) -> dict:
    op = Livro(caminho, 'OPRPG', 10)
    desc = itens.descricoes(op, 64, 78)
    its = itens.armas(op, [66, 67], desc) + itens.protecoes(op, [72], desc) + itens.gerais(op, [73, 77], desc) + itens.amaldicoados(op, 158, 161)
    return {
        'fonte': {'nome': 'Ordem Paranormal RPG', 'sigla': 'OPRPG'},
        'rituais': rituais.extrair(op, 127, 154),
        'itens': corrige_itens('OPRPG', its),
        'ameacas': [limpa_ameaca(a) for a in ameacas.extrair(op, 186, 303)],
    }


def livro_sah(caminho: str) -> dict:
    sah = Livro(caminho, 'SaH', 1)
    desc = itens.descricoes(sah, 37, 47)
    its = itens.armas(sah, [39], desc) + itens.gerais(sah, [41], desc) + itens.amaldicoados_tabela(sah, [59], 58, 62)
    # o capítulo das missões traz fichas próprias de cada aventura: ficam de fora (são do roteiro)
    return {
        'fonte': {'nome': 'Sobrevivendo ao Horror', 'sigla': 'SaH'},
        'rituais': rituais.extrair(sah, 47, 58),
        'itens': corrige_itens('SaH', its),
        'ameacas': [limpa_ameaca(a) for a in ameacas.extrair(sah, 125, 166)],
    }


def com_ids(dados: dict) -> dict:
    sigla = dados['fonte']['sigla']
    for tipo in ('rituais', 'itens', 'ameacas'):
        for r in dados[tipo]:
            r['id'] = ident(sigla, tipo, r['nome'])
            if isinstance(r.get('espacos'), float) and r['espacos'].is_integer():
                r['espacos'] = int(r['espacos'])
        # nomes repetidos no mesmo livro (ex.: duas fichas com o mesmo nome) ganham sufixo
        vistos: dict[str, int] = {}
        for r in dados[tipo]:
            n = vistos.get(r['id'], 0)
            vistos[r['id']] = n + 1
            if n:
                r['nome'] = f"{r['nome']} ({n + 1})"
                r['id'] = ident(sigla, tipo, r['nome'])
    return dados


REGRAS = RAIZ / 'app' / 'src' / 'renderer' / 'src' / 'regras' / 'regras.json'


def main(op_pdf: str, sah_pdf: str) -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    todos = []
    for nome, dados in (('oprpg', livro_op(op_pdf)), ('sah', livro_sah(sah_pdf))):
        todos.append(dados)
        dados = com_ids(dados)
        texto = json.dumps(dados, ensure_ascii=False, indent=1)
        if EMAIL.search(texto):
            raise SystemExit(f'{nome}: sobrou um e-mail no texto (marca d\'água?). Nada foi gravado.')
        (SAIDA / f'{nome}.json').write_text(texto + '\n', encoding='utf-8')
        print(nome, {k: len(v) for k, v in dados.items() if isinstance(v, list)})

    # regras: sem as entradas que já estão na biblioteca
    excluir = {fold(r['nome']) for d in todos for k in ('rituais', 'itens', 'ameacas') for r in d[k]}
    op = Livro(op_pdf, 'OPRPG', 10, junta_max=18)
    sah = Livro(sah_pdf, 'SaH', 1, junta_max=18)
    secoes = regras.extrair(op, 'Ordem Paranormal RPG', regras.OP, regras.OP_FIM, excluir, 323)
    secoes += regras.extrair(sah, 'Sobrevivendo ao Horror', regras.SAH, regras.SAH_FIM, excluir, 124)
    texto = json.dumps(secoes, ensure_ascii=False, indent=1)
    if EMAIL.search(texto):
        raise SystemExit("regras: sobrou um e-mail no texto (marca d'água?). Nada foi gravado.")
    REGRAS.parent.mkdir(parents=True, exist_ok=True)
    REGRAS.write_text(texto + '\n', encoding='utf-8')
    print('regras', len(secoes), 'seções')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
