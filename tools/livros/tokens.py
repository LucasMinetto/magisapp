"""Tokens das ameaças dos livros: reduz as imagens e liga cada uma à sua ameaça.

Uso: python tokens.py "<pasta Ameaças>"

- Lê a tabela LIGACOES (arquivo -> nome da ameaça, conferida à mão).
- Reduz cada imagem para no máximo 640 px no lado maior, em WebP, e grava em
  app/resources/livros-tokens/<sha256[:16]>.webp (o app embute essa pasta).
- Grava app/src/main/livros/tokens.json: {id da ameaça: {"token": ..., "extras": [...]}}.
  O primeiro arquivo de cada ameaça é o token principal; os outros são variantes.
"""
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
SAIDA_IMG = RAIZ / 'app' / 'resources' / 'livros-tokens'
SAIDA_JSON = RAIZ / 'app' / 'src' / 'main' / 'livros' / 'tokens.json'
LIVROS = [RAIZ / 'app' / 'src' / 'main' / 'livros' / f for f in ('oprpg.json', 'sah.json')]
LADO = 640

# arquivo (relativo à pasta) -> ameaça. A ordem importa: o primeiro de cada ameaça é o principal.
LIGACOES = [
    ('Conhecimento/Anjo/Anjo.png', 'Anjo'),
    ('Conhecimento/Parasita de culpa/parasita de culpa.png', 'Parasita de Culpa'),
    ('Conhecimento/bicho papão/bicho papão.jfif', 'Bicho-papão'),
    ('Conhecimento/espreitador/espreitador.png', 'Espreitador'),
    ('Conhecimento/estrangeiro/Estrangeiro.png', 'Estrangeiro'),
    ('Conhecimento/existido/existido.png', 'Existido'),
    ('Conhecimento/lembrado/Lembrado.png', 'Lembrado'),
    ('Conhecimento/mascara do desespero/mascara do desespero.jpg', 'Máscara do Desespero'),
    ('Conhecimento/ocioso/Ocioso.png', 'Ocioso'),
    ('Conhecimento/rastejador sombrio/Rastejador Sombrio.png', 'Rastejador Sombrio'),
    ('Conhecimento/silhueta/silhueta.jfif', 'Silhueta'),
    ('Conhecimento/vulto/vulto.png', 'Vulto'),
    ('Degolificada/degolificada.png', 'Degolificada'),
    ('Degolificada/Degolificada Conturbada.png', 'Degolificada'),
    ('Degolificada/Degolificada Devorada.png', 'Degolificada'),
    ('Degolificada/degolificada decrepta.png', 'Degolificada'),
    ('Degolificada/degolificada gnostica.png', 'Degolificada'),
    ('Energia/Anarquico/anarquico.jfif', 'Anárquico'),
    ('Energia/Anarquico descontrolado/anarquico descontrolado.png', 'Anárquico Descontrolado'),
    ('Energia/Anomiatico/anomiatico.png', 'Anomiático'),
    ('Energia/Cibordue/Ciborgue - Por Andrew.png', 'Ciborgue'),
    ('Energia/Telopsita/Telopsia com espirais.png', 'Telopsia'),
    ('Energia/anfitrião/anfitrião.png', 'Anfitrião'),
    ('Energia/anfitrião/anfitrião 2.png', 'Anfitrião'),
    ('Energia/anfitrião/anfitrião 3.png', 'Anfitrião'),
    ('Energia/anfitrião/anfitrião 4.png', 'Anfitrião'),
    ('Energia/anfitrião/anfitrição 5.png', 'Anfitrião'),
    ('Energia/anfitrião/anfitrião 6.png', 'Anfitrião'),
    ('Energia/infecticidio/infecticidio.jfif', 'Infecticídio'),
    ('Energia/pertubado de energia/Perturbado de energia.png', 'Perturbado de Energia'),
    ('Energia/sukkalgir/sukkalgir.png', 'Sukkalgir'),
    ('Energia/tempestuoso/Tempestuoso.png', 'Tempestuoso'),
    ('Energia/viajante/viajante.png', 'Viajante'),
    ('Morte/Aracnasita/aracnasita.png', 'Aracnasita'),
    ('Morte/Deus da morte/Deus da morte.jfif', 'O Deus da Morte'),
    ('Morte/Enraizado/enraizado.png', 'Enraizado'),
    ('Morte/Escutado/escutado.png', 'Escutado'),
    ('Morte/Succ/succ.png', 'Succ'),
    # o .png é maior; o .jpg da mesma imagem fica de fora
    ('Morte/carniçal preto da morte/carniçal preto da morte.png', 'Carniçal Preto da Morte'),
    ('Morte/ceifador espiral/ceifador espiral.jfif', 'Ceifador Espiral'),
    ('Morte/esqueleto de lodo/esqueleto de lodo.png', 'Esqueleto de Lodo'),
    ('Morte/marionete/marionete.png', 'Marionete'),
    ('Morte/mumia xipofaga/mumia xipofaga.png', 'Múmia Xipófaga'),
    ('Morte/nidere/nidere.jpg', 'Nidere'),
    ('Morte/sempiternal/sempiternal.png', 'Sempiternal'),
    ('Sangue/Diabo.png', 'O Diabo'),
    ('Sangue/Enpap X.png', 'Enpap-x'),
    ('Sangue/Mulher afogada.png', 'Mulher Afogada'),
    ('Sangue/Titã de sangue.png', 'Titã de Sangue'),
    ('Sangue/aberração de carne.jpg', 'Aberração de Carne'),
    ('Sangue/aniquilação.jfif', 'Aniquilação'),
    ('Sangue/carente.png.png', 'Carente'),
    ('Sangue/dama de carnoe.png', 'Dama de Sangue'),
    ('Sangue/kerberus.jpg', 'Kerberos'),
    ('Sangue/minotauro.png', 'Minotauro'),
    ('Sangue/zumbi de sangue.png', 'Zumbi de Sangue'),
    ('Sangue/zumbi de sangue bestial.png', 'Zumbi de Sangue Bestial'),
]


def reduzir(caminho: Path) -> bytes:
    im = Image.open(caminho)
    im = im.convert('RGBA') if (im.mode in ('P', 'LA', 'RGBA') or 'transparency' in im.info) else im.convert('RGB')
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=82, method=6)
    return buf.getvalue()


def main(pasta: str) -> None:
    base = Path(pasta)
    ids = {}
    for f in LIVROS:
        for a in json.loads(f.read_text(encoding='utf-8'))['ameacas']:
            ids[a['nome']] = a['id']
    SAIDA_IMG.mkdir(parents=True, exist_ok=True)
    for velho in SAIDA_IMG.glob('*.webp'):
        velho.unlink()
    saida: dict[str, dict] = {}
    for arquivo, nome in LIGACOES:
        if nome not in ids:
            sys.exit(f'Ameaça não encontrada nos livros: {nome}')
        dados = reduzir(base / arquivo)
        token = hashlib.sha256(dados).hexdigest()[:16] + '.webp'
        (SAIDA_IMG / token).write_bytes(dados)
        r = saida.setdefault(ids[nome], {'nome': nome, 'token': token, 'extras': []})
        if r['token'] != token and token not in r['extras']:
            r['extras'].append(token)
    SAIDA_JSON.write_text(json.dumps(saida, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum(p.stat().st_size for p in SAIDA_IMG.glob('*.webp'))
    print(f'{len(saida)} ameaças com token, {len(list(SAIDA_IMG.glob("*.webp")))} imagens, {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
