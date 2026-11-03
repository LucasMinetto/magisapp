# Recon map: Autor / THE AUTOR (desktop Windows, Electron)

Escopo: o Autor inteiro **menos** Música (rádio Ecos), Agenda (rumo ao lançamento), Progresso e a parte de publicação (Publicar, Novels, Portal do Escritor / Hystoria). Ficam: Biblioteca, Manuscrito, Universo, Roteiro, Enredo, Mapas, Diagramação, Revisor IA, Sessão de escrita, Comando, Configurações e backup.
Para: uso próprio do Lucas, mestre de **Ordem Paranormal**. O clone vira uma ferramenta para preparar e conduzir mesas (autorais e aventuras prontas), não para publicar livros. Jogadores e outros sistemas ficam para o futuro.
Pesquisa de usuário: `replica/research.md`. Ela corta Mapas e Diagramação desta versão e acrescenta pistas, relógio da investigação e tela de sessão.
Data: 2026-11-02
Versão estudada: Autor 1.1.32 (Windows), instalado em `C:\Users\lucas\AppData\Local\Programs\Autor`

Método: páginas públicas do theautor.com e o app instalado, clicado na tela com o usuário presente, num projeto de teste ("teste"). O código do app (app.asar) **não** foi lido. Os termos (v1.4, 31/10/2026, cl. 11.2) proíbem engenharia reversa e cópia do app; não há cláusula contra produto concorrente. Este mapa descreve funções e fluxos, não código, arte ou textos.

## Sources

| # | fonte | URL | notas |
| --- | --- | --- | --- |
| 1 | site / marketing | https://theautor.com/ | módulos, planos, requisitos, FAQ |
| 2 | página "o app por dentro" | https://theautor.com/app/ | módulos tela a tela, modo foco, fichas, enredo, diagramação, revisor |
| 3 | vídeo de apresentação | linkado em /app/ ("O aplicativo aberto, tela por tela") | não assistido ainda; vale assistir para Capa e Revisor |
| 4 | termos de uso | https://theautor.com/termos | cl. 11.2 (sem engenharia reversa), 9.1, 3.5 |
| 5 | guias do escritor | https://theautor.com/guias/ | 10 guias de mercado editorial; regras de diagramação (estrutura, lombada, PDF para gráfica) úteis para a Diagramação |
| 6 | feed de atualização | https://baixar.theautor.com/ | só o endereço, do app-update.yml |
| 7 | app instalado, conta do usuário | local | telas S01–S09, S11–S13 capturadas em `replica/screens/` |

Não existe central de ajuda, changelog nem API pública. A confiança vem quase toda do app aberto e da página /app/.

## Core loop

No Autor: escrever capítulos num editor com cara de livro, com o mundo (fichas, mapas, enredo, estrutura) ligado ao texto, e no fim transformar tudo num livro diagramado (PDF de gráfica / EPUB).

No clone: montar a aventura (cenas com hora no jogo, NPCs, lugares, pistas, mapa mental), tudo ligado sozinho, e achar qualquer coisa em segundos durante a sessão.

## Screens

| ID | tela | rota / como chegar | propósito | componentes principais | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | Biblioteca | sidebar "Biblioteca" (tela inicial) | escolher/abrir projeto, visão geral | card do projeto selecionado (capa, nome, autor, arquivo `.autor`, palavras/capítulos/cenas/mundo, Continuar/Editar/Exportar), "Diagramar capa", frase do livro, Projetos recentes (paginação "1 de 1"), Resumo da biblioteca (6 contadores), Dica do app (carrossel), Atividade recente; topo: busca, sync, sininho, skins, tela cheia, Abrir, mascote, + Novo | filled (1 projeto), sem capa |
| S02 | Manuscrito | sidebar "Manuscrito" | escrever capítulos | lista de capítulos (+, ◇ reordenar?), página do editor, barra Medidas (fonte 48, linha 1.50, página 820), Buscar, status "Rascunho", tela cheia (foco), barra flutuante de formatação, rodapé (palavras, parágrafos, página x/y, min de leitura, meta x/1000), painel direito: + Novo bloco (notas do capítulo), Correção IA (perfil + provedor), Resumo do capítulo, Beta-reader; cronômetro de sessão | empty ("Crie ou selecione um capítulo"), capítulo novo vazio |
| S03 | Universo – lista | sidebar "Universo" | fichário do mundo | abas Personagens, Locais, Grupos, Lore, Calendário, Idiomas; Acervo; Unificar livros; busca por nome/apelido/texto; + Adicionar | empty ("Nenhum personagem ainda") |
| S04 | Ficha (personagem) | S03 → card | ficha completa | trilha "‹ Personagens / TESTE · PERSONAGEM", fita de fichas + Novo, retrato (+ galeria), Nome, Papel na história, Atributos agrupados (Identidade, Vida, Aparência) com marcador ✦ por campo, Seus atributos (+ atributo customizado), Descrição física, Personalidade, Arco, Frase marcante, "No manuscrito" (onde aparece no texto), indicador "Salvo" | ficha nova vazia |
| S05 | Roteiro | sidebar "Roteiro" | cenas e estrutura | Lista / Corkboard, "Aplicar modelo" (10 estruturas), Salvar template, Apagar template, + Cena, Acervo | empty, dropdown de modelos aberto |
| S06 | Enredo (canvas) | sidebar "Enredo" | quadro infinito de plots | vários quadros (+), + Card, + Personagem·lugar, + Imagem, + Texto, Arranjar (auto-layout), desfazer/refazer, zoom 100%, tela cheia, ajuda | empty ("Criar primeiro quadro") |
| S07 | Diagramação – modos | sidebar "Diagramação" | escolher Livro ou Capa | 2 cards grandes | — |
| S08 | Diagramar livro | S07 → Livro | miolo + ebook | Modos, Trazer livro, Salvar, desfazer/refazer, Tema, Página, Mostrar, Inserir, Numeração, Exportar, Zoom 90%, Ajustar; painel Propriedades | empty ("Nenhuma diagramação aberta") |
| S09 | Mapas | sidebar "Mapas" | mapa do mundo | seletor de mapa, +, duplicar, excluir; Estilo (Aquarela, Clássicos, Gravura); Folha (Região 2048×1280), Minha imagem, Tema (Pergaminho), Moldura, Fundo, Grade (Sem, Quadrada, Hexagonal, Pontos); Desenhar: Seta, Pincéis (93), Carimbos (397), Rótulo, Marcador, Ligar lugares, Estrada; Para o livro; Acabamento; Exportar | empty ("Criar primeiro mapa" / "Já tenho um mapa pronto (imagem)") |
| S10 | Diagramar capa | S07 → Capa | capa aberta | abas Impressa, Capa dura, Ebook, Marcadores; Livro 3D; Exportar capa (PDF); Formato 15,5×23 cm, Unidade mm, Lombada (mm), Orelha (mm), Guias, zoom; Arquivo de capa, + Imagem, Montar capa; Saída Gráfica (CMYK); prévia contracapa / lombada / capa com legenda corte, dobra, sangria, ISBN; alerta "Impede a gráfica" (sem arte, lombada estimada sem miolo) | empty com alerta |
| S11 | Comando | sidebar "Comando" | paleta de busca/ações | campo "Buscar capítulos, personagens, cenas ou comandos", filtros Projeto, Comando, Capítulo, Universo, Cena; lista de comandos com descrição | aberto |
| S12 | Sessão de escrita | sidebar "Sessão" (gaveta à direita) | foco + meta da sessão | obra em curso, anel de meta (0 de 1000), % da meta, Δ dias, capítulo ativo, tempo de sessão, números do livro | filled |
| S13 | Configurações | sidebar "Configurações" | aparência, escrita, Drive, dados | estrela animada; cada ponta é uma seção que mostra o nome no hover e abre no clique. Vista: ponta direita → **Tutoriais** (vídeo-aulas por módulo: Comece por aqui 3, Escrita 20, Universo 4, Roteiro e Corkboard 2, Enredo 3, Agenda 1, Diagramação 23, IA 1; "Passo a passo escrito"; formulário Dúvidas com e-mail e imagem). Pela paleta: "Aparência, escrita, Drive e dados"; pelo guia de backup: seção **Nuvem › A Arca › Restaurar** | só Tutoriais aberto; outras pontas não abertas |
| S13b | Cópia no Google Drive | S13 Tutoriais → "Assista primeiro" | ligar backup | passos numerados, intervalo 15 min / 30 min / 1 h / 2 h, pasta "Autor Backups", cópia nova substitui a anterior; Baixar o Google Drive, Ligar no Google Drive | aberto |
| S14 | Lixeira | sidebar "Lixeira" (modal) | restaurar itens apagados | contador de itens, aviso "até 60 dias e depois é apagado automaticamente", lista, Fechar | empty |
| S15 | Novo projeto | S01 → + Novo | criar livro | no plano Mensal abre **"Limite de projetos"**: oferta de upgrade, ou "Exportar e excluir um projeto" (salva .docx, vai para a Lixeira por 60 dias). O formulário em si não foi visto | limite atingido |
| S15b | Editar projeto | S01 → Editar | ações do projeto | Backup na Arca, Renomear, Revelar pasta, Meta do livro, Frase do livro, Excluir | aberto |
| S16 | Modo foco | S02 → ⛶ | escrever sem painéis | tela cheia só com o capítulo | do site |
| S17 | Correção (resultado) | S02 → selecionar trecho → ✦ | revisar trecho | original × sugestão por erro, aceitar/recusar, "Corrigir de novo", modo LOCAL ou chave própria | do site |
| S18 | Exportar | S01 → Exportar (modal) | sair com o texto | PDF, Word (.docx), Texto (.txt); Cancelar | aberto |
| N01 | Portfólio de pistas | novo no clone | ver e registrar pistas | grade de cartões com imagem; filtro por sessão, local, status | a desenhar |
| N02 | Relógio e linha do tempo | novo no clone | tempo da investigação | data/hora atual no jogo, avançar tempo, próximos eventos com contagem, linha do tempo com lacunas | a desenhar |
| N03 | Tela de sessão (mesa) | novo no clone | conduzir a sessão | busca, cena atual, relógio, pistas da cena, NPCs da cena, notas rápidas | a desenhar |

Excluídos do mapa por pedido do usuário: Música, Progresso, Agenda, Novels, Publicar.

## Flows

```
F01 Criar projeto e escrever o primeiro capítulo
    S01 (+ Novo) -> S15 -> S02 (Criar o primeiro capítulo) -> digitar
    happy path clicks: ~4
    edge: nome de arquivo repetido, sem autor, autosave falha, fechar sem salvar
```

```
F02 Criar uma ficha e ver onde ela aparece no texto
    S03 (+ Adicionar) -> S04 (nome, papel, atributos, retrato) -> "No manuscrito" lista as menções
    happy path clicks: 3 + digitação
    edge: ficha sem nome (não procura no texto), apelidos separados por vírgula, nomes ambíguos
```

```
F03 Montar a estrutura a partir de um modelo
    S05 (Aplicar modelo -> Jornada do Herói) -> cenas criadas -> Corkboard -> arrastar/editar cena
    happy path clicks: 3
    edge: aplicar modelo com cenas já existentes, salvar modelo próprio, apagar modelo
```

```
F04 Ligar plots num quadro
    S06 (Criar primeiro quadro) -> + Card / + Personagem·lugar -> ligar cards -> Arranjar
    happy path clicks: ~5
    edge: quadro grande (performance), desfazer, card de ficha apagada
```

```
F05 Corrigir um trecho com IA
    S02 selecionar trecho -> ✦ na barra flutuante -> S17 sugestões -> aceitar uma a uma
    happy path clicks: 3 + 1 por sugestão
    edge: Ollama não instalado / pouca RAM, chave inválida, sem internet, trecho grande demais
```

```
F06 Fazer o mapa do mundo
    S09 (Criar primeiro mapa) -> estilo + grade -> pincéis/carimbos -> Marcador ligado a ficha -> Exportar ou "Para o livro"
    happy path clicks: ~8
    edge: importar imagem pronta, grade hexagonal, mapa grande, marcador de ficha apagada
```

```
F07 Diagramar e exportar o livro
    S07 -> S08 (Trazer livro) -> Tema / Página / Numeração -> Exportar (PDF gráfica ou EPUB)
    happy path clicks: ~6
    edge: capítulo vazio, imagens sem resolução, plano sem exportação (ver Out of scope)
```

```
F08 Sessão de escrita com meta
    S12 (abrir gaveta) -> escrever em S02 -> anel de meta sobe -> fechar
    happy path clicks: 1
```

```
F09 Achar qualquer coisa
    S11 (Comando) -> digitar -> Enter
    happy path clicks: 1 + digitação
```

```
F10 Backup e restauração
    S13 -> Drive / dados -> backup em camadas ("Arca") + Google Drive opcional
    edge: arquivo corrompido, restaurar versão antiga
    (visto o guia em S13b: Google Drive para PC, intervalo de 15 min a 2 h,
     pasta "Autor Backups"; restaurar em Configurações › Nuvem › A Arca › Restaurar)
```

Fluxos novos do clone (da pesquisa, sem equivalente no Autor):

```
F11 Registrar uma pista achada na sessão
    N03 tela de sessão -> "pista achada" -> escolhe pista (ou cria) -> marca local, hora no jogo, quem achou
    happy path clicks: 3
    edge: pista sem imagem, achada por dois jogadores, achada fora de ordem, desfazer
```

```
F12 Avançar o tempo da investigação
    N03 ou N02 -> avançar (+10 min, +1 h, próxima cena) -> próximos eventos recalculam
    happy path clicks: 1
    edge: voltar o tempo, evento que já passou sem os jogadores agirem, cena sem hora
```

```
F13 Adaptar uma aventura pronta
    S01 nova campanha -> anexar PDF, tokens, imagens -> criar cenas (com hora), NPCs, lugares, pistas
    -> ligar tudo no canvas (mapa mental)
    happy path clicks: depende do tamanho da aventura; medir no protótipo
    edge: PDF grande, imagens repetidas, pista que aparece em duas cenas
```

```
F14 Achar algo durante a sessão
    qualquer tela -> busca (atalho) -> digitar parte do nome -> Enter
    happy path clicks: 0 (atalho) + digitação; meta: menos de 3 segundos
```

## Components

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Botão | primário dourado contornado, secundário, fantasma, ícone | default, hover, ativo, desabilitado | todas |
| Sidebar | recolhida (só ícones) / expandida (rótulos), grupo de status (Projeto, Salvo, Foco, Sem Arca, % meta) | item ativo | global |
| Barra superior | logo, projeto, selo de plano, "Subir de plano", janela | — | global |
| Cartão de estatística | número + rótulo | — | S01, S02, S12 |
| Estado vazio | ícone + título + texto + 1–2 CTAs | — | S02, S03, S05, S06, S08, S09 |
| Abas | texto, sublinhado no ativo | — | S03, S05 |
| Dropdown / select | nativo estilizado, com grupos | aberto, fechado | S02, S05, S09 |
| Stepper numérico | − valor + | — | S02 (fonte, linha, página) |
| Barra de formatação flutuante | — | aparece com seleção | S02 |
| Editor de página | página centralizada com título de capítulo | vazio, digitando | S02 |
| Painel lateral recolhível | esquerda / direita, seta de recolher | aberto, fechado | S02, S08 |
| Campo de atributo | rótulo + placeholder de exemplo + ✦ | vazio, preenchido | S04 |
| Card de ficha | iniciais / retrato, nome | selecionado | S03, S04 |
| Gaveta (drawer) | direita | aberto | S12 |
| Paleta de comando | busca + chips de filtro + lista | — | S11 |
| Canvas infinito | grade de pontos, zoom, nós, arestas | vazio | S06 |
| Editor de mapa | barra de ferramentas em 3 linhas, folha | vazio | S09 |
| Toolbar de documento | botões com menu ▾ | — | S08 |
| Tooltip | — | hover | S01 |
| Anel de progresso | — | 0–100% | S01, S12 |
| Carrossel de dicas | ‹ › | — | S01 |
| Skins (temas) | Âmbar, Diana, Jade, LoveLab, FairyTale, Breakdown, Rubi, Papel | — | global |

## Inferred data model

```
Project (Livro)  id, title, author_name, file_path (.autor), cover_image, tagline ("frase do livro"),
                 created_at, opened_at, modified_at, word_goal
                 evidence: S01 (teste.autor, Aberto/Modificado), S12
                 confidence: high

Chapter          id, project_id, order, title, body (rich text), status (rascunho | ...), word_count,
                 summary (resumo IA), goal_words
                 evidence: S02 (Capítulo 1, Rascunho, x/1000), painel Resumo do capítulo
                 confidence: high (status além de "rascunho": guess)

ChapterBlock     id, chapter_id, title, body, size        ("+ Novo bloco": sinopse, clima, pistas...)
                 evidence: S02 painel direito
                 confidence: medium

Entity (Ficha)   id, project_id (ou mundo compartilhado), kind (personagem | local | grupo | lore),
                 name, role, portrait, gallery[], aliases[], attributes (json por grupo),
                 custom_attributes[{label, value}], physical_description, personality, arc,
                 catchphrase, notes
                 evidence: S03 abas, S04 campos
                 confidence: high (personagem), medium (locais/grupos/lore têm campos próprios)

World / Acervo   id, name; Entity pode pertencer a vários livros ("Unificar livros", "Acervo")
                 evidence: S03 botões Acervo, Unificar livros; S01 contador "Mundo"
                 confidence: guess

CalendarEvent    id, world_id, date (calendário próprio), title, entity_ids[]
                 evidence: S03 aba Calendário; campos "Nasceu ex.: 3 de março, 12 - ano 12"
                 confidence: guess

Language (Idioma) id, world_id, name, lexicon[{word, meaning}], rules
                 evidence: S03 aba Idiomas; site "idioma construído por livro"
                 confidence: guess

Mention          entity_id, chapter_id, offset    (pode ser calculado, não salvo)
                 evidence: S04 "No manuscrito"
                 confidence: medium

Scene            id, project_id, order, title, summary, chapter_id?, beat, status, pov_entity_id?
                 evidence: S05 (+ Cena, Lista, Corkboard), S01 contador Cenas
                 confidence: medium

StructureTemplate id, name, beats[{name, description}], builtin bool
                 evidence: S05 (10 modelos embutidos, Salvar/Apagar template)
                 confidence: high

Board            id, project_id, name, viewport
BoardNode        id, board_id, type (card | entity | image | text), entity_id?, x, y, w, h, content
BoardEdge        id, board_id, from_node, to_node, label
                 evidence: S06 botões
                 confidence: high (nós), medium (rótulo de aresta)

Map              id, project_id, name, style, sheet (preset + w×h), theme, frame, background,
                 grid (none | square | hex | dots), image?
MapItem          id, map_id, type (stroke | stamp | label | marker | road | link), data, entity_id?
                 evidence: S09
                 confidence: high (config), medium (itens)

Layout (Diagramação) id, project_id, theme, page_size, margins, typography, chapter_opening,
                 numbering, ornaments, elements[]
Cover            id, project_id, size, spine_width (calculada), bleed_mm (5), flaps, front, back, spine
                 evidence: S08, S07, site
                 confidence: medium

WritingSession   id, project_id, started_at, ended_at, words_start, words_end, chapter_id
                 evidence: S12, cronômetro em S02
                 confidence: medium

AIProfile        id, name ("Revisão de Texto (padrão)"), provider (ollama | openai | anthropic | google),
                 model, api_key (local), prompt
                 evidence: S02 Correção IA
                 confidence: medium

Backup           id, project_id, created_at, location (local "Arca" | google_drive)
TrashItem        id, kind, payload, deleted_at
Settings         skin, editor defaults, drive link, ai providers
                 evidence: sidebar status "Sem Arca", Lixeira, S13
                 confidence: guess
```

Entidades novas do clone (da pesquisa; nenhuma tem evidência no Autor, são requisitos):

```
SystemTemplate   id, name ("Ordem Paranormal"), entity_kind (npc | criatura), fields[{key, label, type, group}]
                 ex.: NEX, PV, PE/PD, Sanidade, atributos AGI FOR INT PRE VIG, perícias, rituais, elemento
Clue (Pista)     id, campaign_id, title, image, description, found_at_location_id, found_game_time,
                 found_session_id, found_by[], scene_id, status (oculta | achada | entendida), notes
GameClock        campaign_id, current_game_time, calendar_id
TimelineEvent    id, campaign_id, title, game_time (ou intervalo), scene_id?, entity_ids[],
                 happens_if_ignored bool, status
GameSession      id, campaign_id, number, real_date, game_time_start, game_time_end, notes, clues_found[]
Attachment       id, campaign_id, kind (pdf | token | imagem | mapa), file, linked_ids[]
```

Mudanças nas entidades do Autor: Scene ganha game_time_start e game_time_end; Entity ganha system_template_id e
stats (json); Project vira Campaign, com system.

Relacionamentos: Project 1-n Chapter, Chapter 1-n ChapterBlock, Project 1-n Scene, Scene n-1 Chapter (opcional), World 1-n Entity, Project n-n World, Entity n-n Chapter (via Mention), Project 1-n Board, Board 1-n BoardNode 1-n BoardEdge, BoardNode n-1 Entity (opcional), Project 1-n Map, Map 1-n MapItem, MapItem n-1 Entity (marcador), Project 1-1 Layout, Project 1-1 Cover, Project 1-n WritingSession.

Armazenamento: tudo local, um arquivo `.autor` por livro (formato desconhecido, não foi aberto).

## Feature matrix

Ver `features.csv`, já ajustado pela pesquisa. Must: 22, should: 15, could: 10, skip: 15.

## Adaptação para RPG

Decidido na pesquisa (`research.md`), já no matrix:
- portfólio de pistas, relógio da investigação, linha do tempo com lacunas, calendário (must)
- modelo de ficha Ordem Paranormal sobre atributos customizados, sem fixar o sistema no código (must)
- menções automáticas no texto no lugar do `[[link]]` do Obsidian (must)
- tela de sessão, notas de sessão, importar aventura (PDF, tokens, imagens) (should)
- outros sistemas, versão dos jogadores, envio ao Owlbear Rodeo (could, futuro)

Ainda em aberto, para o architect: modelos de estrutura de investigação no Roteiro; onde a tela de sessão roda (segundo monitor, notebook, celular); encontros e tabelas aleatórias.

## Out of scope (cannot or should not be cloned)

- Removidos pelo usuário: Música (rádio Ecos), Agenda/Norte (rumo ao lançamento), Progresso, Publicar, Novels, Portal do Escritor / Hystoria.
- Cortados pela pesquisa nesta versão: editor de mapas (vai usar outro programa) e toda a Diagramação (livro, capa, EPUB, PDF de gráfica), porque ele não publica.
- Arte e conteúdo do Autor: logo/estrela, mascote, ilustrações das skins, pincéis e carimbos de mapa, ornamentos, capas, fontes licenciadas. Usar assets próprios ou de bancos livres (CC0).
- Textos do app (dicas, placeholders, descrições dos modelos, tutoriais): reescrever.
- Planos, licença, ativação em 2 computadores, limite de projetos, "Subir de plano": uso próprio, não precisa.
- Sincronização Estelar (celular/web): depende do servidor deles; rever quando houver versão dos jogadores.
- A comunidade e os usuários do Portal.

## Size

Telas: 13 do Autor que entram no clone (S01–S06, S11, S12 como base da tela de sessão, S13, S14, S15, S15b, S18) + 3 novas (N01–N03). Fluxos 14 (F01–F14, sem F06 e F07, que foram cortados). Entidades ~20.

Partes difíceis:
1. **Ligação automática fichas ↔ texto**: achar nomes e apelidos no texto rico sem sintaxe, rápido, sem falso positivo demais.
2. **Tempo da investigação**: calendário próprio, relógio, cenas e eventos com hora, cálculo de lacunas e de "o que acontece se os jogadores não agirem".
3. **Canvas / mapa mental**: quadro infinito com nós de ficha, pista, imagem e texto, ligações e arranjo automático.

Também: busca global instantânea, editor rich text, anexos grandes (PDF, tokens), backup + Google Drive, app desktop offline (Electron ou Tauri).

Tamanho: **M** (algumas semanas). Sem Diagramação e Mapas, as duas partes mais pesadas do Autor saíram. Uma primeira fatia útil (fichas + cenas com hora + pistas + busca) cabe em poucos fins de semana.

## Não verificado

- S16 (modo foco) e S17 (correção IA) só vistos no site. A correção não foi rodada porque o provedor configurado (OpenAI) cobra por chamada.
- S13: só a seção Tutoriais foi aberta; as outras pontas da estrela (aparência, escrita, Nuvem/Arca) não.
- S15: o formulário de novo projeto não aparece no plano Mensal (limite de 1 projeto).
- Ficaram no projeto de teste "teste" um capítulo vazio ("Capítulo 1") e talvez uma ficha vazia ("Sem nome"); podem ser apagados.
