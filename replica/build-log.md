# Build log

App em `app/` (nome provisório "Mesa"). Rodar: `cd app && npm run build && npx electron .`
Testes: `npx vitest run` (76 de unidade: tempo do jogo, menções, linha do tempo, pistas, anexos, importar, quadros, textos, lixeira, sessão, modelo, modelos de estrutura, acervo, desfazer, migração, backup, exportar, banco) e `node e2e/slice.mjs` (115 checagens clicando no app, capturas em `replica/clone-screens/`).

| ID | data | estado | o que falta | mais difícil do que parecia |
| --- | --- | --- | --- | --- |
| Shell | 2026-11-02 | feito | atalhos Ctrl+1…9; barra de título própria | tema do Tailwind: a primeira versão do `tailwind.css` criava variáveis em ciclo (`--color-bg: var(--color-bg)`); o gerador agora escreve valores literais |
| S15 Nova campanha | 2026-11-02 | feito | escolher outra pasta ao criar (hoje: Documentos/Campanhas Mesa) | — |
| S01 Biblioteca / Início | 2026-11-02 | feito | ações do projeto (S15b, should) | a capa de uma campanha fechada precisa ser lida da pasta dela: `mesa://capa/` só serve campanhas da lista de recentes, abrindo o banco só para leitura |
| S03 Fichas | 2026-11-02 | feito | ordenar e filtrar por grupo | — |
| S04 Ficha | 2026-11-02 | feito | relações entre fichas e "não marcar no texto" (fora dos must) | — |
| S05 Cenas | 2026-11-02 | parcial | corkboard, reordenar arrastando, NPCs presentes marcados à mão, modelos de estrutura | — |
| S02 Editor (cenas e Textos) | 2026-11-02 | feito | cartão ao passar o mouse na menção | menções: decoração recalculada a cada tecla; ok para cenas, medir com textos longos |
| Menu `/` do editor | 2026-11-02 | feito | — | busca fichas, cria ficha pelo texto digitado e aplica formatos de bloco; testado no fluxo ponta a ponta |
| S11 Busca (Ctrl+K) | 2026-11-02 | feito | filtros por tipo, recentes | Enter pegava o comando "criar" em vez do primeiro resultado (criava ficha por engano); corrigido, e há teste para isso |
| N02 Linha do tempo e relógio | 2026-11-02 | feito | ligar evento a uma cena (a coluna existe, a tela não usa); sessões reais como marcadores (vêm com Pistas/Sessão); escolher a duração mínima da lacuna | lacunas com cenas sobrepostas e com a hora atual no meio: o cálculo foi para `shared/timeline.ts`, com testes; evento criado numa lacuna do passado era marcado "passou sem resolução" na hora, agora nasce como "aconteceu" |
| N01 Pistas | 2026-11-02 | feito | ligar pista a pista; miniaturas (hoje a imagem original é mostrada reduzida); notas de sessão; colar imagem da área de transferência | anexos precisam do protocolo `mesa://` (registrado antes do `ready`) e de `webUtils.getPathForFile` no preload para arrastar e soltar com sandbox; o arrastar e soltar não é coberto pelo e2e (o Playwright não entrega caminho de arquivo), a importação é testada pelo botão com o diálogo simulado |
| S06 Quadros (canvas) | 2026-11-02 | feito | cor do card; ligação escolhendo o lado (hoje sai pela direita e entra pela esquerda); tela cheia; mover nó com o teclado é do React Flow, sem teste próprio | o Ctrl+Z precisa ouvir a janela toda (clicar no fundo do quadro não dá foco a nada); renomear tinha de esperar o salvamento antes de recarregar a lista; o rótulo das ligações saía preto sem texto até estilizar `edge-textbg`; @xyflow/react fixado em 12.12.0 (a 12.12.1 saiu no dia) |
| Textos | 2026-11-02 | feito | reordenar, pastas; importar aventura (should) | — |
| S14 Lixeira | 2026-11-02 | feito | apagar anexos que ficaram sem uso | testes do e2e: `getByText('Regras da casa')` também achava "as regras da casa" no estado vazio e seguia antes da tela trocar; agora espera o título da tela |
| N03 Sessão | 2026-11-02 | feito | iniciativa e rolagens (fora do escopo por enquanto); escolher à mão quem está na cena | a cena "de agora" sai do relógio: a que contém a hora, senão a próxima planejada, senão a última |
| S05 Corkboard e modelos | 2026-11-02 | feito | arrastar entre colunas por dia | o corkboard usa a ordem de planejamento (`sort`); a lista continua pela hora no jogo, as duas convivem |
| Desfazer global | 2026-11-02 | feito | desfazer importação também apaga o arquivo de anexos/ (hoje só some do banco) | gatilhos TEMPORÁRIOS do SQLite (não mudam o arquivo da campanha); antes de desfazer, salvar o que está no debounce, senão a tela regrava o valor desfeito ao remontar |
| Ajuda, tema claro, modo foco | 2026-11-02 | feito | — | o tema claro sai do mesmo gerador de tokens e passa no mesmo teste de contraste |
| Arquivos (importar aventura) | 2026-11-02 | feito | apagar arquivo (hoje fica até restaurar backup sem ele); arquivo acima de 200 MB é recusado em vez de pedir confirmação; mandar token ao Owlbear (pesquisa, em aberto) | o leitor de PDF do Chromium precisa de `plugins: true`, `frame-src mesa:` na CSP e do `content-type` certo no protocolo; o nome vai no `content-disposition` para virar título; a página não pode buscar `mesa://` (só `<img>`/`<iframe>`), então o e2e confere o arquivo pelo processo principal |
| S18 Exportar | 2026-11-02 | feito | escolher fichas ou cenas soltas (hoje é por parte); imagens WebP/AVIF entram no PDF mas não no Word | o Word precisa do tamanho da imagem: lido do cabeçalho do PNG/JPEG/GIF; docx fixado em 9.7.1 (as versões de outubro tinham menos de duas semanas) |
| S17 Ajustes (backup) | 2026-11-02 | feito | aparência; backup de arquivos muito grandes trava a janela enquanto gera (é síncrono, para poder rodar ao fechar) | o Obsidian não mostra imagem de fora do cofre: a raiz do backup é o cofre, com `legivel/` e `anexos/` lado a lado; no Windows o banco corrompido ficava aberto e não deixava apagar, agora fecha sempre |

Notas da fatia:
- **Modelo Ordem Paranormal conferido com os livros do usuário** (básico e Sobrevivendo ao Horror), só nomes de campos: patente, trilha, deslocamento, inventário; classe Sobrevivente; Estágio e PD (Determinação) como regras opcionais escondidas até pedir; criatura com tamanho, percepção, iniciativa, Fortitude/Reflexos/Vontade, imunidades e vulnerabilidades. O modelo embutido é sincronizado ao abrir qualquer campanha (`syncOrdemTemplate`), sem perder valores.
- **Backup (.mesa-backup):** zip com `LEIA-ME.md`, `campanha.sqlite` (VACUUM INTO), `campanha.json` (formato 1, ida e volta testada), `anexos/` e `legivel/` (Markdown com `[[links]]`, aliases e quadros em JSON Canvas). Abrir a pasta inteira como cofre no Obsidian. Restaurar nunca sobrescreve: vira `<nome> (restaurada AAAA-MM-DD).mesa`; se o banco não abrir, monta do json e refaz a busca.
- **No PowerShell deste PC** o `npm.ps1` é bloqueado pela política de scripts: usar `npm.cmd` / `npx.cmd`.
- **Esquema versão 2:** coluna `campaign.cover_id`. Migrações em `db.ts`; antes de migrar uma campanha existente o app grava `campanha.sqlite.v1.bak` (`VACUUM INTO`).
- **Desvios da arquitetura:**
  - Relações entre fichas (`entities:relate`) ficaram para depois: estavam no marco 5 da arquitetura, mas não são must no `features.csv`.
  - Sem canal `clues:markFound`: "Achada agora" é um `clues:save` com situação, hora e sessão. Achada sem hora nem sessão ganha a hora do relógio no processo principal.
  - Drizzle ficou de fora por enquanto: SQL direto no `store.ts`, tipado à mão. Revisar se o esquema crescer.
  - O `schema.sql` do app é uma cópia de `replica/schema.sql`. A migração 001 é essa cópia.
- **Largura de 390 px não se aplica.** É app desktop, com janela mínima de 1024×640. As capturas são a 1360×768, como as referências.
- **Instalação no Windows:**
  - O npm 11 bloqueia scripts de instalação. O Electron é baixado pelo `postinstall` do app (`node node_modules/electron/install.js`).
  - O better-sqlite3 13 já vem com binário pronto para win32-x64, sem compilar.
- **Computer use não controla o Electron de desenvolvimento** (não é app instalado). A verificação é feita com Playwright (`e2e/slice.mjs`).

## Etapa 4 (construção) encerrada em 2026-11-02

- must 22/22 e should 16/16 completos. Could: 3 completos, 2 parciais (acervo como cópia, ajuda sem vídeos) e 6 decididos, não esquecidos:
  - adiados pelo próprio usuário na pesquisa: outros sistemas, versão dos jogadores, Owlbear;
  - fora do produto: idiomas construídos, IA (2 itens).
- Esquema na versão 3, com migrações e cópia do banco antes de cada uma.
- Próximas etapas: instalador (electron-builder), /replica-test (QA sistemático), /replica-diff, e opcionalmente /replica-brand (nome e cor definitivos).
