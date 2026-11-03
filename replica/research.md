# Pesquisa de usuário: clone do Autor para mestrar RPG

Data: 2026-11-02
Método: entrevista com o próprio usuário (Lucas), no chat, 12 perguntas em 3 blocos (contexto, onde trava, reação).
Participantes: 1. É uma pesquisa de um usuário só, mas é o único usuário do app por enquanto. Antes de abrir o app para jogadores ou outros mestres, repetir com 5 pessoas (roteiro no fim).

## Quem é o usuário

- Mestre de **Ordem Paranormal** (investigação e horror). D&D e outros sistemas só no futuro.
- Mestra mesas autorais e aventuras prontas.
- Não publica livros por enquanto.
- O app é só para ele agora. No futuro, os jogadores teriam a versão deles.

## Como ele trabalha hoje

```
Aventura pronta:  baixa PDF + tokens -> lê -> reescreve no "formato de mestragem" dele
                  (mesma história, mais fácil de ver, com mapas mentais)
Campanha:         Obsidian (notas ligadas, links no texto, canvas)
Mapas:            pega prontos na internet -> apresenta no Owlbear Rodeo
Arquivos:         pastas soltas no computador
Na mesa:          PDF impresso e digital + Obsidian + imagens de evidência
Evidências:       manda pelo Owlbear para os jogadores
```

## Temas

### T1. Obsidian dá conta, mas cansa
> "ele não foi feito para isso e não é agradável de usar nem visualmente nem usualmente por sua complexidade elevada com comandos de ligação e pouco intuitivo além de precisar de diversas plugins"

Ligar notas é o que ele mais usa, e é justamente o que mais custa no Obsidian. O que o encantou no Autor foi ver os links no texto e o controle de mundo e universo prontos, sem configurar nada.
**Insight:** o clone ganha do Obsidian com coisas feitas para mestrar, ligações automáticas e um visual bonito, e não com mais recursos.

### T2. O tempo do mundo se perde
> "o horário do mundo me deixou muito perdido pra conseguir levar a cena pra frente oque acabou deixando muitas lacunas de tempo e ficando meio confuso para os jogadores e o enredo principal"

Foi a maior dor na última preparação. Ele quer um relógio (que horas são agora, quanto falta para o próximo evento) **e** um calendário.
**Insight:** em investigação, o tempo é a espinha da aventura. Cada cena e cada evento precisa de data e hora no jogo, e as lacunas precisam aparecer sozinhas.

### T3. Não acha as coisas na mesa
Perguntado se já deixou de achar algo a tempo durante a sessão: "recorrentemente". O material fica espalhado entre PDF, Obsidian, pastas e Owlbear.
**Insight:** busca rápida e uma tela de sessão valem mais que qualquer editor. Tudo da aventura precisa estar num lugar só, a uma busca de distância.

### T4. Portfólio de pistas
> "adoraria poder ter como se fosse um portifólio de pista com a descrição e onde foi encontrada com data e esse tipo de coisa que fica mais fácil para relembrar em sessões futuras"

O Autor não tem nada parecido. Para Ordem Paranormal, é central.
**Insight:** a pista é uma entidade de primeira classe, com imagem, descrição, onde foi achada, data no jogo, sessão e quem achou. Mais tarde, os jogadores veem as deles.

### T5. Adaptar aventura pronta é o trabalho principal
Ele mantém a história e muda a forma: mapas mentais, a estrutura dele.
**Insight:** o fluxo "importar aventura" (PDF, tokens, imagens) e depois "reorganizar em cenas, NPCs, lugares, pistas e mapa mental" vale tanto quanto criar do zero.

### T6. Fichas: Ordem Paranormal agora, outros sistemas depois
Ele quer NPC e criatura com os números do sistema, e no futuro outros sistemas.
**Insight:** a ficha tem campos livres com um "modelo de sistema" por cima (Ordem Paranormal primeiro). Não fixar os atributos de Ordem no código.

## O que isso muda no clone

| | decisão |
| --- | --- |
| Novo, must | Portfólio de pistas (imagem, descrição, local, data no jogo, sessão, quem achou, status) |
| Novo, must | Relógio da investigação: data e hora atual no jogo, próximos eventos com contagem regressiva |
| Novo, must | Linha do tempo de cenas e eventos com data e hora, mostrando as lacunas |
| Novo, must | Modelo de ficha Ordem Paranormal (NPC, criatura) sobre atributos customizados |
| Novo, should | Tela de sessão (mesa): busca, cena atual, relógio, pistas, NPCs da cena |
| Novo, should | Importar aventura: anexar PDF, tokens e imagens ao projeto e ligar a cenas e fichas |
| Novo, should | Notas de sessão (o que aconteceu, quais pistas foram achadas) |
| Novo, could | Modelos de ficha para outros sistemas (D&D...) |
| Novo, could | Versão dos jogadores (só veem as pistas e fichas liberadas) |
| Sobe | Paleta de comando / busca: já era must, agora vira tela-chave |
| Sobe | Menções automáticas da ficha no texto: should para must (é o que substitui o `[[link]]`) |
| Sobe | Canvas (Enredo): mapa mental da aventura; continua must |
| Sobe | Calendário do mundo: should para must |
| Sobe | Lugar com imagem de mapa (só imagem + notas, sem editor) |
| Cai | Editor de mapas (pincéis, carimbos, grade): para skip por agora; ele vai usar outro programa |
| Cai | Diagramação de livro, capa, EPUB, PDF de gráfica: para skip; não publica |
| Cai | Sessão de escrita com meta de palavras: substituída pela tela de sessão de jogo |
| Cai | Correção IA e Beta-reader: could (não apareceram na entrevista) |
| Mantém | Manuscrito: vira o "texto da aventura" (leitura em voz alta, descrições); peso menor |

## Perguntas em aberto

- Quanto do Roteiro (modelos de estrutura de romance) ele usaria? Ele ainda não testou o Autor. Vale mostrar modelos de aventura de investigação.
- Tokens: só guardar ou também mandar ao Owlbear? (integração; o Owlbear tem SDK de extensões público)
- Em que tela fica a sessão: segundo monitor, notebook na mesa, celular?
- Formato de mestragem dele: ver um exemplo real (uma nota do Obsidian ou um mapa mental) antes de desenhar a tela de cena.

## Roteiro para entrevistar outros mestres (quando o app for para mais gente)

1. Que sistema você mestra, e com que tipo de mesa?
2. Conte a última vez que preparou uma sessão: passos e programas.
3. Onde ficam NPCs, lugares, pistas, criaturas e linha do tempo?
4. O que acontece com isso durante a sessão?
5. O que a sua ferramenta atual não faz bem?
6. Qual parte da última preparação foi mais chata?
7. Já deixou de achar algo na mesa? O quê?
8. Como entrega pistas e handouts aos jogadores, e como lembra quem achou o quê?
9. (Mostrar o protótipo) O que você usaria e o que dispensaria?
