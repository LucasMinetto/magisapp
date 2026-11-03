# TASKS: Magistrado

> Produto: [PRD.md](PRD.md) · Técnica: [TECH_SPEC.md](TECH_SPEC.md) · Memória: [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
> Status em 2026-11-03: T1 a T7 concluídas. Próxima: T8 (ameaças), depois T9. "Bloqueada" = espera uma decisão de [TECH_SPEC § Decisões pendentes](TECH_SPEC.md#decisões-pendentes).

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

### T3. Portar as regras de Ordem Paranormal ✅ 2026-11-03
- **Depende de:** T1
- **Resultado:** `app/src/shared/ordem/regras.ts` e `esquemas.ts` (zod 4) portados de `taberna/shared/`.
- **Aceite:** os casos de `taberna/shared/regras.test.ts` rodam no vitest e passam com os mesmos valores.

### T4. Migração 4: personagem com ficha completa ou compacta, ameaça e rolagem ✅ 2026-11-03
- **Depende de:** T3
- **Resultado:** esquema da campanha na versão 4 conforme a TECH_SPEC (`sheet`, `sheet_data` e `origin` em `entities`; agente = `is_player`, já que `role` existia com outro sentido; `criatura` → `ameaca`, tabela `rolls`), com cópia do banco antes de migrar.
- **Aceite:** uma campanha v3 abre, migra e mantém cenas, fichas, menções e quadros. Os ids são preservados. Há teste em `store.test.ts`.
- **Arquivos:** `app/src/main/{schema.sql,db.ts,store.ts,seed.ts}`, `app/src/shared/types.ts`.

### T4b. Biblioteca única com origem ✅ 2026-11-03
- **Depende de:** T3
- **Resultado:** `%APPDATA%/Magistrado/biblioteca.sqlite` com `sources` ("Criações próprias" já criada), `lib_threats`, `lib_items` e `lib_rituals`, com migrações próprias e backup próprio.
- **Aceite:** testes de criar origem, cadastrar com origem, filtrar por origem, copiar para a campanha (a cópia sobrevive se o original for apagado) e fazer backup e restaurar a biblioteca.
- **Arquivos:** `app/src/main/library.ts` (novo) e testes.

### T5. IPC dos dados novos ✅ 2026-11-03
- **Depende de:** T4, T4b
- **Resultado:** canais de personagem (`role`, `sheet`), biblioteca e rolagem validados com zod. Os dados da campanha entram também no desfazer, na lixeira e na busca.
- **Aceite:** testes de store, desfazer e lixeira para cada tipo novo.
- **Arquivos:** `app/src/main/{ipc,store,undo,library}.ts`, `app/src/preload/index.ts`, `app/src/shared/types.ts`. Testes em `app/src/main/sheet.test.ts`.

## Fase 3: telas

### T6. Ficha completa (agentes e vilões) e ficha compacta (NPCs) ✅ 2026-11-03
- **Depende de:** T5 (ritual e inventário dependem também de T9)
- **Resultado:** a ficha completa em três colunas com rolagem própria, para agentes e NPCs vilões. A compacta continua no `EntitySheet` com o botão "usar ficha completa", que não perde dados. Coluna 1: retrato, identidade, hexágono de atributos e barras de PV, SAN e PE. Coluna 2: modificador de testes e perícias (todas ou só treinadas, com busca). Coluna 3: abas Combate, Habilidades, Rituais, Inventário e Histórico.
- **Aceite:** os derivados recalculam ao editar. Funciona nos temas claro e escuro e o `contrast.py` passa. Abre por menção, busca (Ctrl+K) e lista de fichas.
- **Base:** `taberna/web/src/ficha/*`, `taberna/web/src/paginas/FichaPagina.tsx`, `taberna/docs/handoff-ficha-rpgpedia.md`.
- **Feito:** `app/src/renderer/src/ficha/` (contexto, partes, Identidade, Pericias, Combate, Habilidades, Rituais, Inventario, Historico, FichaCompleta). Três colunas a partir de 1280 px de largura; abaixo disso as abas vão para baixo das perícias. Uma sexta aba, **Notas**, guarda histórico e objetivo da ficha, atributos próprios, descrição, notas do mestre e "Aparece em". Sem modo jogo/edição: a ficha é editável direto. Os botões de rolar só aparecem quando a tela passa `rolar` (T7). Ritual e item da biblioteca ainda não entram pela ficha (T9). O vilão volta à compacta com confirmação; a completa fica guardada. e2e com 14 verificações novas.

### T7. Rolagem (o Magistrado rola ou o mestre digita os dados físicos) ✅ 2026-11-03
- **Depende de:** T3, T5
- **Revisada em 2026-11-03** (entrevista com o Lucas).
- **Resultado:** janela de rolagem aberta pelos botões da ficha, com duas formas: **o Magistrado rola** ou **digitar** o que saiu nos dados físicos.
  - **Teste:** digita só o d20 que ficou (o maior; o menor quando o atributo é 0), não todos. O app calcula total e crítico.
  - **Dano separado por tipo**, uma soma por tipo (ex.: arma amaldiçoada = Balístico 9 + Energia 7), porque cada alvo resiste a um tipo. O bônus entra por cima; no crítico digita-se a nova soma.
  - Caixa **"Rola dados físicos"** em cada personagem decide a forma em que a janela abre (marcada = digitar). NPCs e ameaças começam desmarcados.
  - Grava em `rolls`.
- **Aceite:** valores inválidos são recusados. A rolagem aparece no histórico da ficha e pode ser desfeita.
- **Fora:** escolher o alvo e aplicar o dano com resistências (P3), jogadores rolando sozinhos (P2).
- **Base:** `taberna/web/src/ficha/Rolagem.tsx`.
- **Feito:** `ficha/JanelaRolagem.tsx` (aberta pela FichaCompleta). Ataque ganhou **danos extras** (outros tipos, até 6) e ritual ganhou **tipo de dano**. No crítico só o dano da arma multiplica; os extras não. Teste digitado valida 1 a 20; soma digitada valida a faixa dos dados. A caixa fica em `dadosFisicos` da ficha; sem ela vale "é jogador". Desfazer na janela e no Histórico (e o Ctrl+Z geral). e2e com 11 verificações novas.

### T8. Ameaças
- **Depende de:** T5
- **Resultado:** editor e bloco de ameaça no formato do livro, na biblioteca (com origem) e na campanha (cópia ligada a cenas e quadros como as fichas).
- **Aceite:** cria na biblioteca, traz para a campanha, liga a uma cena e aparece na tela de sessão. O menu diz "Ameaças", não "Criaturas" (já feito na T4).
- **Atenção:** o editor de ameaça precisa passar a editar o bloco em `sheet_data` (`blocoAmeacaSchema`). Hoje ele edita os campos do modelo em `stats`, e a ameaça vinda da biblioteca chega com `stats` vazio.
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
- **Conferir no livro** (pedido em 2026-11-03):
  - **Crítico:** a T7 multiplica só o dano da arma; os danos extras (ex.: Energia de arma amaldiçoada) não multiplicam. Confirmar a regra e ajustar `FormularioDano` em `ficha/JanelaRolagem.tsx` se for diferente.
  - **Cobertura:** verificar se tudo o que o livro traz para ameaças, rituais e itens tem campo no Magistrado (`blocoAmeacaSchema`, `camposRitual`, `camposItem` em `shared/ordem/esquemas.ts`) e acrescentar o que faltar.

### P3. Direcionar o dano ao alvo
- Escolher quem recebe o dano de uma rolagem, descontar as resistências por tipo e tirar o PV. Depende das resistências das ameaças em `sheet_data` (T8). Pedido do usuário em 2026-11-03, ao revisar a T7.

### P2. Versão dos jogadores
- Celular e ficha compartilhada. Os ids UUID do autore já preparam o sync. Fica para depois.
