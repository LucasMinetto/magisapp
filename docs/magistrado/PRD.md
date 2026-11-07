# PRD: Magistrado

> Iniciativa: `magistrado` · Criado em 2026-11-02 · Status: intenção confirmada, implementação não iniciada
> Relacionados: [TECH_SPEC.md](TECH_SPEC.md) · [TASKS.md](TASKS.md) · [PROJECT_MEMORY.md](PROJECT_MEMORY.md)

## Contexto e problema

Lucas mestra mesas de **Ordem Paranormal RPG** usando dois programas próprios:

- **autore** (github.com/LucasMinetto/autore): app de desktop para preparar e conduzir a mesa. Tem cenas com hora no jogo, linha do tempo, pistas, quadros (mapa mental), corkboard, menções automáticas, busca, sessão, exportar e backup. Está maduro: todos os itens *must* e *should* foram entregues.
- **taberna** (github.com/LucasMinetto/taberna): app web local com a **ficha do agente** calculada pelas regras do livro, **rolagem com dados físicos** e os modelos de **ameaças, itens e rituais**. Não foi finalizado: os modelos existem, mas os dados do livro ainda não foram cadastrados.

Com dois programas, a preparação e a condução ficam divididas. O **Magistrado** junta os dois num app só, com o autore como base.

## Usuário e necessidade

- **Usuário desta versão:** só o mestre (Lucas), num único computador, offline.
- **Necessidade:** preparar e conduzir a sessão inteira num lugar só, com as fichas dos agentes calculando pelo livro, ao lado das cenas, das pistas e do relógio que o autore já oferece.

## Resultado desejado

Um app de desktop chamado **Magistrado**, num **repositório novo**, que parte de uma cópia do autore e recebe do taberna:

1. a ficha do agente (com as regras do livro);
2. a rolagem com dados físicos;
3. os modelos de ameaças, itens e rituais.

### Sinal de sucesso (confirmado)

- Lucas prepara e conduz uma sessão inteira **só no Magistrado**, com as fichas calculando pelas regras do livro, e **não precisa abrir o taberna**.
- Métricas numéricas: *TBD*. Não foram definidas na entrevista.

## Escopo

### Dentro

- Tudo o que o autore já faz hoje, rebatizado para Magistrado.
- **Ficha do agente**: identidade (origem, classe, trilha, NEX, patente), atributos, PV, PE, Sanidade, Defesa, Esquiva, Bloqueio e DT de ritual calculados, 28 perícias, ataques, habilidades, rituais da ficha, inventário com limite por patente e carga, condições e histórico de rolagens. Base: `taberna/shared/regras.ts`, `taberna/shared/esquemas.ts` e `taberna/web/src/ficha/*`.
- **Visual da ficha** (confirmado): **layout do RPGpédia** com os **tokens, as fontes e os temas claro e escuro do autore**. Layout do RPGpédia quer dizer três colunas com rolagem própria, hexágono de atributos e barras de PV, SAN e PE (`taberna/docs/handoff-ficha-rpgpedia.md`).
- **Rolagem com dados físicos**: o mestre digita os valores rolados na mesa. O app escolhe o maior d20 (ou o menor), soma os bônus, detecta o crítico, multiplica os dados de dano e guarda no histórico.
- **Modelos** de ameaças, itens e rituais: cadastro, edição e exibição. Os campos seguem o livro, como já estão no taberna.
- **Biblioteca única** (confirmado): ameaças, itens e rituais ficam num lugar só, compartilhado por todas as campanhas. Cada registro diz **de onde veio** (livro oficial, criação própria, outros livros no futuro).
- **Dois tamanhos de ficha** (confirmado): agentes (personagens dos jogadores) usam a **ficha completa**. NPCs usam uma **ficha compacta**, e NPCs vilões podem usar a **ficha completa**.
- O nome **Ameaças** é mantido (confirmado). A "criatura" do autore vira ameaça.

### Fora (confirmado)

- **Versão dos jogadores**: celular, QR code e mesa ao vivo. Fica para uma versão futura.
- **Tela Livros** do taberna. O autore já abre PDFs em Arquivos e na cena.
- **Campanhas e missões do taberna**. As campanhas, cenas e pistas do autore substituem essas telas.
- **Carga dos dados do livro** (ameaças, itens e rituais reais). É a **próxima etapa, depois da fusão**.
- **Importar dados do taberna**. Não há dados cadastrados lá, só modelos.
- **Alterar os repositórios originais** autore e taberna no GitHub.

## Casos de uso e critérios de aceite

| # | Caso de uso | Critério de aceite observável |
|---|---|---|
| U1 | Abrir o Magistrado e criar ou abrir uma campanha | O app abre com o nome "Magistrado". Todas as telas do autore funcionam como antes: os testes do autore e o e2e passam no repositório novo. |
| U2 | Criar a ficha de um agente na campanha | Ao mudar atributo, NEX ou classe, PV, PE, SAN, Defesa e DT se recalculam com os mesmos resultados dos testes de `taberna/shared/regras.test.ts`. |
| U3 | Ver a ficha na mesa | No PC (janela ≥ 1024 px) aparecem três colunas, cada uma com rolagem própria. Os temas claro e escuro passam no teste de contraste do autore. |
| U4 | Rolar um teste ou um dano com dados físicos | O mestre digita os dados, vê o total, o crítico e o dano multiplicado, e a rolagem entra no histórico da ficha. |
| U5 | Cadastrar uma ameaça e usá-la numa cena | A ameaça tem os campos do livro (VD, Presença Perturbadora, defesas, resistências, ações) e pode ser ligada a uma cena como as fichas de hoje. |
| U6 | Cadastrar rituais e itens e colocá-los na ficha | Um ritual ou item cadastrado pode ser adicionado à ficha do agente. A carga e o limite por patente são respeitados. |
| U6b | Cadastrar uma criação própria ou um livro novo | Na biblioteca, o mestre escolhe ou cria a origem ("Criações próprias", outro livro) e filtra a lista por origem. O que está na biblioteca aparece em qualquer campanha. |
| U6c | Transformar um NPC em vilão | Um NPC de ficha compacta passa para a ficha completa sem perder o que já estava preenchido. |
| U7 | Conduzir a sessão | Na tela de sessão, o mestre marca PV, PE e SAN dos agentes e PV das ameaças sem sair da tela, e controla a ordem de iniciativa (turno e rodada). |
| U8 | Fazer backup e exportar | O backup (`.magistrado-backup`), o `campanha.json` e o `legivel/` (Obsidian) incluem agentes, ameaças, itens, rituais e rolagens, e o teste de ida e volta passa. |

## Restrições e dependências

- **Repositório novo.** Os repositórios originais no GitHub não podem ser alterados. As cópias locais foram usadas na fusão e apagadas em 2026-11-07.
- Desktop Windows, offline, um usuário, sem conta (`docs/arquitetura/arquitetura.md`).
- Nada de arte, texto ou código do RPGpédia. Só o layout é a referência (`handoff-ficha-rpgpedia.md`, seção "O que não copiar").

## Suposições

- **Suposição:** o nome interno "Mesa", a extensão `.mesa`, o protocolo `mesa://` e o `.mesa-backup` passam a usar "Magistrado". Não existem campanhas reais em `.mesa`, então não há compatibilidade a manter (confirmado).
- **Suposição:** Ordem Paranormal continua sendo o único sistema nesta versão.
- Repositório: github.com/LucasMinetto/magistrado (confirmado).

## Questões abertas

Nenhuma no momento. A ordem de iniciativa do taberna entra na tela de sessão (confirmado em 2026-11-02).
