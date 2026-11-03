# TASKS: Magistrado

> Produto: [PRD.md](PRD.md) · Técnica: [TECH_SPEC.md](TECH_SPEC.md) · Memória: [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
> Status em 2026-11-03: T1 e T2 concluídas (commits `b0ea20a` e `b922810`, sem push). "Bloqueada" = espera uma decisão de [TECH_SPEC § Decisões pendentes](TECH_SPEC.md#decisões-pendentes).

## Fase 1: base funcionando com o nome novo

### T1. Criar o repositório novo a partir do autore ✅ 2026-11-03
- **Depende de:** nada (Q4 e Q7 decididas: histórico do zero, remoto `github.com/LucasMinetto/magistrado`)
- **Resultado:** `Magistrado/` é um repositório git com `app/` e `replica/` copiados de `_fontes/autore` (`replica/` mantida com esse nome porque o e2e e os scripts de tokens usam o caminho), `docs/` preservado e `_fontes/` no `.gitignore`. O primeiro commit cita `autore@28fa658` e `taberna@71f7b1c`.
- **Aceite:** `npm.cmd install`, `npm.cmd run typecheck`, `npm.cmd test` e `node e2e/slice.mjs` passam em `app/` sem mudar nada no código.
- **Arquivos:** `app/**`, `replica/**`, `.gitignore`, `.gitattributes`, `README.md`.

### T2. Renomear Mesa → Magistrado ✅ 2026-11-03
- **Depende de:** T1
- **Resultado:** nome do pacote, título da janela, extensão `.magistrado`, protocolo `magistrado://`, backup `.magistrado-backup`, pasta `%APPDATA%/Magistrado`. Sem compatibilidade com `.mesa` (Q6: não há campanhas reais).
- **Aceite:** nenhuma ocorrência técnica de `mesa` em `app/src` (as palavras de interface com sentido de "mesa de jogo" ficam). Os testes e o e2e passam. O backup restaura.
- **Arquivos:** `app/package.json`, `app/src/main/{index,campaigns,backup,vault,exporter}.ts`, `app/src/preload/index.ts`, CSP em `app/src/renderer/index.html`.

## Fase 2: regras e dados

### T3. Portar as regras de Ordem Paranormal
- **Depende de:** T1
- **Resultado:** `app/src/shared/ordem/regras.ts` e `esquemas.ts` (zod 4) portados de `taberna/shared/`.
- **Aceite:** os casos de `taberna/shared/regras.test.ts` rodam no vitest e passam com os mesmos valores.

### T4. Migração 4: personagem com ficha completa ou compacta, ameaça e rolagem
- **Depende de:** T3
- **Resultado:** esquema da campanha na versão 4 conforme a TECH_SPEC (`role` e `sheet` em personagem, `criatura` → `ameaca`, tabela `rolls`), com cópia do banco antes de migrar.
- **Aceite:** uma campanha v3 abre, migra e mantém cenas, fichas, menções e quadros. Os ids são preservados. Há teste em `store.test.ts`.
- **Arquivos:** `app/src/main/{schema.sql,db.ts,store.ts,seed.ts}`, `app/src/shared/types.ts`.

### T4b. Biblioteca única com origem
- **Depende de:** T3
- **Resultado:** `%APPDATA%/Magistrado/biblioteca.sqlite` com `sources` ("Criações próprias" já criada), `lib_threats`, `lib_items` e `lib_rituals`, com migrações próprias e backup próprio.
- **Aceite:** testes de criar origem, cadastrar com origem, filtrar por origem, copiar para a campanha (a cópia sobrevive se o original for apagado) e fazer backup e restaurar a biblioteca.
- **Arquivos:** `app/src/main/library.ts` (novo) e testes.

### T5. IPC dos dados novos
- **Depende de:** T4, T4b
- **Resultado:** canais de personagem (`role`, `sheet`), biblioteca e rolagem validados com zod. Os dados da campanha entram também no desfazer, na lixeira e na busca.
- **Aceite:** testes de store, desfazer e lixeira para cada tipo novo.
- **Arquivos:** `app/src/main/{ipc,store,undo}.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/lib/data.ts`.

## Fase 3: telas

### T6. Ficha completa (agentes e vilões) e ficha compacta (NPCs)
- **Depende de:** T5 (ritual e inventário dependem também de T9)
- **Resultado:** a ficha completa em três colunas com rolagem própria, para agentes e NPCs vilões. A compacta continua no `EntitySheet` com o botão "usar ficha completa", que não perde dados. Coluna 1: retrato, identidade, hexágono de atributos e barras de PV, SAN e PE. Coluna 2: modificador de testes e perícias (todas ou só treinadas, com busca). Coluna 3: abas Combate, Habilidades, Rituais, Inventário e Histórico.
- **Aceite:** os derivados recalculam ao editar. Funciona nos temas claro e escuro e o `contrast.py` passa. Abre por menção, busca (Ctrl+K) e lista de fichas.
- **Base:** `taberna/web/src/ficha/*`, `taberna/web/src/paginas/FichaPagina.tsx`, `taberna/docs/handoff-ficha-rpgpedia.md`.

### T7. Rolagem com dados físicos
- **Depende de:** T3, T5
- **Resultado:** componente que pede os valores dos dados, mostra o total, o crítico e o dano multiplicado, e grava em `rolls`.
- **Aceite:** valores inválidos são recusados. A rolagem aparece no histórico da ficha e pode ser desfeita.
- **Base:** `taberna/web/src/ficha/Rolagem.tsx`.

### T8. Ameaças
- **Depende de:** T5
- **Resultado:** editor e bloco de ameaça no formato do livro, na biblioteca (com origem) e na campanha (cópia ligada a cenas e quadros como as fichas).
- **Aceite:** cria na biblioteca, traz para a campanha, liga a uma cena e aparece na tela de sessão. O menu diz "Ameaças", não "Criaturas".
- **Base:** `taberna/web/src/paginas/AmeacaEditor.tsx`, `taberna/web/src/componentes/BlocoAmeaca.tsx`.

### T9. Rituais e itens
- **Depende de:** T5
- **Resultado:** abas de rituais (elemento, círculo, execução, Discente e Verdadeiro) e de itens (tipo, categoria, espaço) na biblioteca, com filtro por origem e botão "colocar na ficha".
- **Aceite:** um ritual ou item colocado na ficha continua lá mesmo se for apagado da biblioteca.
- **Base:** `taberna/web/src/paginas/RituaisPagina.tsx`, `taberna/web/src/ficha/{Rituais,Inventario}.tsx`.

### T10. Sessão com agentes, ameaças e iniciativa
- **Depende de:** T6, T7, T8
- **Resultado:** a tela de Sessão marca PV, PE e SAN dos agentes e PV das ameaças da cena, e permite rolar dali. Tem o painel de iniciativa: adicionar agentes e ameaças, digitar os valores, ordenar, mostrar o turno e a rodada, passar para o próximo e limpar.
- **Aceite:** conduzir uma cena de combate sem sair da tela de Sessão. Iniciativa, rodada e turno continuam lá depois de fechar e reabrir a campanha.
- **Base:** `PainelIniciativa` em `taberna/web/src/paginas/SessaoPagina.tsx`.
- **Arquivos:** `app/src/renderer/src/screens/Session.tsx`.

## Fase 4: integração e fechamento

### T11. Backup, export e Obsidian com os tipos novos
- **Depende de:** T4–T9
- **Resultado:** `campanha.json` no formato 2. O `legivel/` ganha `Agentes/`, `Rituais/` e `Itens/`, com as rolagens nas notas de sessão. O export (Word, PDF, Markdown) inclui a ficha do agente.
- **Aceite:** o teste de ida e volta passa com todos os tipos novos. Restaurar um backup recupera a ficha com os mesmos derivados.
- **Arquivos:** `app/src/main/{backup,vault,exporter}.ts` e testes.

### T12. Ajuda, README e e2e
- **Depende de:** T6–T11
- **Resultado:** a tela Ajuda explica a ficha e as rolagens. `README.md` do Magistrado. O e2e ganha o fluxo criar agente → mudar atributo → rolar.
- **Aceite:** o e2e completo passa.

### T13. Sessão de teste do usuário
- **Depende de:** T12
- **Resultado:** Lucas conduz uma sessão (ou um ensaio) só no Magistrado.
- **Aceite:** o sinal de sucesso do PRD.

## Depois da fusão (fora deste escopo, já combinado)

### P1. Dados do livro de regras
- Extrair do livro e cadastrar as **ameaças, os itens e os rituais** reais na biblioteca única (T4b, T8, T9), cada um com a origem do livro de onde veio. Pedido do usuário em 2026-11-02.
- Antes de começar: confirmar quais livros (básico, Sobrevivendo ao Horror…) e o formato da extração.

### P2. Versão dos jogadores
- Celular e ficha compartilhada. Os ids UUID do autore já preparam o sync. Fica para depois.
