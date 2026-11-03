# Componentes

Base acessível: **Radix UI** (Dialog, DropdownMenu, ContextMenu, Tabs, Tooltip, Popover, ToggleGroup, ScrollArea) + **cmdk** para a paleta. Ícones: **Lucide** (ISC). Fontes empacotadas no app, offline, via `@fontsource`: Inter, Source Serif 4, IBM Plex Mono (todas OFL).

Nada de arte, ícones, fontes ou textos do Autor. Todo rótulo e estado vazio abaixo é texto nosso.

Regras para todos:
- **Cores:** só por papel (`bg-surface`, `text-muted`, `border-border`), nunca hex no componente.
- **Foco:** `focus-visible` sempre com anel de 2px `focus`, deslocado 2px.
- **Movimento:** `fast` (120ms) para hover e `base` (200ms) para abrir e fechar. Tudo respeita `prefers-reduced-motion`.
- **Alvo de clique:** mínimo de 32px. Tamanhos em px a 100% de zoom.

Telas: `S..` = do recon (Autor), `N..` = novas do clone.

---

```
Button
  variants  primary (fundo accent), secondary (contorno border-input), ghost (só texto), danger (contorno danger)
  sizes     sm 28px, md 36px, lg 44px; padding-x 12 / 16 / 20
  states    default, hover (primary: accent-hover; outros: surface-raised), active (escala .98),
            focus-visible, disabled (opacidade .45, sem hover), loading (spinner no lugar do ícone, rótulo fica)
  tokens    radius md, type sm/600; primary: bg accent, text on-accent
  a11y      <button> de verdade; loading = aria-busy e o rótulo continua para o leitor de tela;
            ícone sozinho não é Button, é IconButton
  used on   todas
```

```
IconButton
  variants  ghost, secondary; com badge de ponto (algo pendente)
  sizes     sm 28px, md 32px
  states    como Button; toggled (aria-pressed, fundo surface-raised)
  tokens    radius md, ícone 16px, cor text-muted, hover text
  a11y      aria-label obrigatório; Tooltip com o mesmo texto e o atalho
  used on   barra superior, toolbars do editor e do canvas, S01, S02, S06
```

```
TextField / Textarea
  variants  padrão, sem borda (inline: o nome da ficha, o título da cena), com ícone à esquerda (busca)
  sizes     md 36px; Textarea cresce até 12 linhas
  states    default (borda border-input), hover, focus (borda focus + anel), disabled, read-only,
            error (borda danger + mensagem), vazio com placeholder (text-subtle, serif itálico nos campos de ficha)
  tokens    bg bg, radius md, type sm; rótulo type label text-muted acima
  a11y      <label for> sempre; erro em aria-describedby; placeholder nunca substitui o rótulo
  used on   S03, S04, S11, N01, N02
```

```
Select / Combobox
  variants  select simples (Radix Select), combobox com busca (escolher ficha, lugar, cena)
  states    fechado, aberto, item destacado, item selecionado (check), vazio ("nenhuma ficha com esse nome"),
            "+ criar «texto»" quando não acha
  tokens    lista em surface-raised, shadow pop, radius md
  a11y      setas, Enter, Esc, digitar para pular; role combobox/listbox
  used on   S04 (lugar, grupo), S05 (modelo), N01 (onde foi achada), N02 (cena do evento)
```

```
NumberStepper
  variants  com rótulo (− 48 +), compacto
  states    default, min/max atingido (botão desabilitado), editando o número
  a11y      role spinbutton, setas cima/baixo, Shift = passo maior
  used on   S02 (medidas do editor), StatBlock (PV, NEX)
```

```
GameDateTimeInput
  o que é   escolher data e hora NO JOGO (não do computador)
  partes    data (dd/mm/aaaa) + hora (hh:mm) + dia da semana calculado; atalhos "dia do caso", "+1 h", "+1 dia"
  states    vazio ("sem hora"), preenchido, antes do chamado (rótulo "antes do caso", text-muted),
            fim antes do início (erro), inválida (30/02)
  tokens    números em font mono
  a11y      dois campos com rótulo; leitor ouve "quarta-feira, 22 de julho de 2026, 23 horas e 10"
  used on   S05 (cena), N02 (evento), N01 (achada em)
```

```
Tabs / SegmentedControl
  variants  tabs sublinhadas (abas do Universo), segmentado (Lista | Corkboard | Linha do tempo)
  states    ativo (texto text, sublinhado accent 2px), inativo (text-muted), hover, focus-visible, desabilitado
  a11y      Radix Tabs: setas trocam de aba, Tab entra no painel
  used on   S03, S05, N01
```

```
Sidebar (navegação principal)
  variants  recolhida 56px (só ícones) / aberta 200px (ícone + rótulo); o estado fica salvo
  partes    grupos: Campanha (Início, Fichas, Cenas, Linha do tempo, Pistas, Quadros, Textos),
            Mesa (Sessão), rodapé (Buscar, Lixeira, Ajustes); status embaixo (salvo, backup)
  states    item ativo (fundo surface-raised, barra 2px accent à esquerda, texto text), hover, focus, com badge
  a11y      <nav aria-label="Principal">; item ativo aria-current="page"; Tooltip com o rótulo quando recolhida;
            atalhos Ctrl+1…9
  used on   global
```

```
TopBar
  partes    nome da campanha, data e hora atual no jogo (ClockChip), indicador de salvamento, busca (Ctrl+K)
  height    40px; arrastável (barra de título do Electron), botões da janela à direita
  used on   global
```

```
SaveIndicator
  states    salvando… (pulso), salvo (check, text-muted), erro ao salvar (danger, clique = detalhes e tentar de novo),
            backup feito às 21h30 (no tooltip)
  a11y      aria-live="polite" só para erro e "salvo" depois de erro, não a cada tecla
  used on   TopBar, S04
```

```
StatCard
  variants  número + rótulo; com anel de progresso (0–100%)
  states    zero (número em text-muted), carregando (skeleton)
  tokens    bg surface, border, radius lg; número type xl mono, rótulo type label
  used on   S01, N03
```

```
EmptyState
  partes    ícone Lucide 32px em text-subtle, título serif type lg, uma frase text-muted, 1–2 botões
  regra     todo estado vazio diz o que fazer a seguir, com o botão que faz
  exemplos  Pistas: "Nenhuma pista plantada ainda." [+ Nova pista]
            Linha do tempo: "Dê uma hora às cenas para ver a investigação no tempo." [Abrir cenas]
            Busca: "Nada com «hosp». Criar ficha «hosp»?"
  used on   S02, S03, S05, S06, N01, N02, N03
```

```
Card (ficha, cena)
  variants  ficha em grade (retrato + nome + papel), ficha em linha (lista), cena (título, hora, lugar, NPCs)
  states    default, hover (borda border-input), selecionado (borda accent), arrastando (sombra pop, inclinado 1°),
            na lixeira (opacidade .5, "restaurar")
  tokens    bg surface, border, radius lg, padding 12–16
  a11y      o card inteiro é um link/botão; ações extras num menu (⋯) acessível por teclado
  used on   S03, S04 (fita), S05 corkboard, N03
```

```
Portrait
  variants  imagem, iniciais (fallback), ícone por tipo (local, grupo, criatura)
  sizes     24, 40, 64, 160 (ficha)
  states    sem imagem (iniciais em surface-raised), soltando arquivo (borda tracejada accent), carregando
  a11y      alt = nome da ficha; decorativo quando o nome já está ao lado
  used on   S03, S04, N01, Canvas
```

```
AttributeField (campo da ficha)
  variants  texto curto, texto longo, lista (apelidos, separados por vírgula), número
  partes    rótulo type label + valor; exemplo como placeholder; menu do campo (renomear, remover, mover de grupo)
  states    vazio, preenchido, editando, customizado (o usuário criou)
  a11y      cada campo é um TextField rotulado; grupos são <fieldset><legend>
  used on   S04
```

```
StatBlock (sistema)
  o que é   os campos do modelo de sistema (Ordem Paranormal: NEX, PV, PE, Sanidade, AGI FOR INT PRE VIG,
            perícias, rituais, elemento), desenhados a partir de template_fields, nunca fixos no código
  variants  edição (S04), compacto só leitura (tela de sessão, canvas)
  partes    recursos com atual/máximo e barra (PV 18/24), atributos em grade de 5, listas (rituais)
  states    recurso no zero (danger), editando atual com + / −
  a11y      barra com role meter e aria-valuenow/max
  used on   S04, N03, nó de ficha no canvas
```

```
Chip / Badge
  variants  status da pista (oculta = clue-hidden, achada = clue-found, entendida = clue-understood),
            status da cena (planejada, jogada, pulada), tipo de ficha, "antes do caso", contagem
  tokens    radius pill, type xs/600, fundo = cor a 14%, texto = cor cheia
  a11y      cor nunca sozinha: sempre com texto ou ícone
  used on   N01, N02, N03, S05
```

```
ClockChip / GameClock
  variants  chip na barra superior ("qua 22/07 · 23h10"), painel grande (tela de sessão e N02)
  partes    data com dia da semana, hora em mono, avançar (+10 min, +1 h, próxima cena, definir…),
            próximo evento com contagem ("ritual em 2h50")
  states    normal, evento em menos de 1 h (warning), evento já passou sem resolução (danger),
            sem eventos ("nada marcado à frente")
  a11y      mudanças anunciadas em aria-live polite; avançar tem atalho (Alt+→)
  used on   TopBar, N02, N03
```

```
TimelineRow / TimelineGap
  variants  cena, evento, sessão real (marcador), lacuna
  partes    hora à esquerda (mono), título, lugar, NPCs; lacuna = faixa tracejada "3h sem nada — o que eles fazem?"
  states    passado (antes da hora atual, text-muted), agora (marcador accent), futuro, evento evitado (riscado)
  a11y      lista ordenada (<ol>); a lacuna é um item com texto, não só um desenho
  used on   N02, N03
```

```
ClueCard
  variants  grade (imagem grande), linha (compacta), detalhe (painel lateral)
  partes    imagem ou ícone de documento, título, status Chip, onde foi achada, quando (data no jogo + sessão),
            quem achou (Portraits), "o que revela" (só o mestre; oculto por padrão, botão olho)
  states    oculta, achada, entendida, sem imagem, imagem carregando
  a11y      o "revela" fica escondido com aria-expanded; imagem com alt = título da pista
  used on   N01, N03, nó de pista no canvas
```

```
Dialog (modal)
  variants  confirmação (excluir, restaurar backup), formulário (nova campanha, marcar pista achada), aviso
  sizes     sm 400px, md 560px, lg 760px
  states    abrindo/fechando (fade + escala .98), enviando (botão loading), erro no formulário
  tokens    bg surface-raised, border, radius lg, shadow pop; overlay preto a 60%
  a11y      Radix Dialog: foco preso, Esc fecha, foco volta ao botão que abriu; título em aria-labelledby;
            ação destrutiva nunca é o foco inicial
  used on   S14 (lixeira), S15, S18 (exportar), backup, N01
```

```
Drawer (gaveta lateral)
  variants  direita 360px
  states    aberta, fechada; não bloqueia a tela (sem overlay) quando é painel de apoio
  a11y      role="complementary" quando não é modal; Esc fecha
  used on   S12 (vira painel da sessão), detalhe da pista em N01
```

```
CommandPalette (busca global)
  partes    campo, filtros em chips (Tudo, Fichas, Cenas, Pistas, Textos, Comandos), resultados agrupados
            com ícone, título, trecho com o termo destacado, atalho Enter / Ctrl+Enter (abrir ao lado)
  states    vazio (recentes), digitando, sem resultado (oferece criar), carregando (> 150 ms mostra skeleton)
  tokens    largura 640px, topo a 15% da altura, bg surface-raised, shadow pop
  a11y      cmdk: setas, Enter, Esc; role combobox + listbox; resultado ativo anunciado
  meta      de Ctrl+K até a ficha aberta em menos de 3 s (F14)
  used on   global (Ctrl+K), S11
```

```
DropdownMenu / ContextMenu
  variants  menu de ação (⋯), clique direito no card, no nó do canvas e no texto selecionado
  states    item, item destrutivo (danger), desabilitado com motivo no tooltip, submenu, separador
  a11y      Radix: setas, Enter, Esc, digitar para pular
  used on   S03, S05, S06, N01
```

```
Tooltip
  regra     só para rótulos de ícones e atalhos; nunca para informação que não existe em outro lugar
  timing    abre em 500 ms, fecha ao sair; teclado: abre no foco
  used on   global
```

```
Toast
  variants  info, sucesso, erro (com "tentar de novo"), desfazer ("Pista excluída · Desfazer")
  timing    5 s; erro fica até fechar; pausa no hover
  a11y      região aria-live; erro com role alert
  used on   global
```

```
SidePanel (lista recolhível)
  variants  esquerda (lista de cenas, capítulos), direita (inspetor da seleção)
  sizes     240px / 300px, arrastável 200–400px, o tamanho fica salvo
  states    aberto, recolhido (só a seta), redimensionando
  a11y      separador com role separator e setas para redimensionar; botão recolher com aria-expanded
  used on   S02, S05, S06, N01
```

```
Editor (texto da cena e dos documentos)
  base      TipTap 2
  partes    página centralizada (largura reading-max 720px, type reading serif 18/30), título em type xl
  states    vazio ("Escreva o que acontece aqui…"), digitando, só leitura (tela de sessão)
  a11y      role textbox multiline, rotulado com o título da cena
  used on   S02, S05, N03
```

```
FloatingToolbar (seleção no editor)
  partes    negrito, itálico, título, lista, citação ("leia em voz alta"), link para ficha, "virar pista"
  states    aparece na seleção, some no Esc ou ao perder a seleção
  a11y      Alt+F10 leva o foco para a barra; role toolbar com setas entre botões
  used on   S02
```

```
MentionHighlight (ligação automática)
  o que é   nome ou apelido de ficha no texto ganha sublinhado pontilhado text-muted; hover mostra um cartão
            com retrato, papel e os números principais; Ctrl+clique abre a ficha
  states    normal, hover, ficha na lixeira (sem destaque), ficha com "não marcar no texto" (sem destaque)
  a11y      não muda o texto; o cartão abre também com o atalho Ctrl+. no cursor
  used on   S02, S05, N03
```

```
Canvas (mapa mental)
  base      @xyflow/react
  nós       card (texto livre), ficha (retrato + nome + StatBlock compacto), pista (ClueCard pequena),
            cena (título + hora), imagem, nota (texto sem moldura)
  arestas   curva, rótulo opcional, seta opcional
  states    vazio (EmptyState), selecionado (borda accent), conectando (linha tracejada), arrastando
  toolbar   + Card, + Ficha, + Pista, + Cena, + Imagem, + Texto, Arranjar, desfazer/refazer, zoom, tela cheia
  a11y      Tab percorre os nós; setas movem o selecionado; Enter edita; Delete remove (com Desfazer);
            lista alternativa dos nós e ligações para leitor de tela
  used on   S06
```

```
FileDrop / Importar
  o que é   soltar PDF, tokens e imagens em qualquer lugar da campanha
  states    arrastando por cima (borda tracejada accent + "Solte para importar"), copiando (progresso),
            arquivo repetido (reaproveitado, avisa), arquivo grande (> 200 MB, pede confirmação), erro
  a11y      sempre há um botão "Importar arquivos" equivalente
  used on   S04 (retrato), N01 (imagem da pista), importar aventura
```

---

## Telas novas, em componentes

```
N01 Portfólio de pistas   Tabs (status) + filtros Select + grade de ClueCard + Drawer de detalhe + FileDrop
N02 Linha do tempo        GameClock grande + TimelineRow/Gap + GameDateTimeInput no editor do evento
N03 Tela de sessão        TopBar com GameClock + 3 colunas: cena atual (Editor só leitura + NPCs com StatBlock
                          compacto) | pistas da cena (ClueCard em linha, "marcar achada") | notas rápidas
                          + CommandPalette sempre a um Ctrl+K
```
