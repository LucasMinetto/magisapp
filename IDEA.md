# IDEA.md: Magistrado

O **Magistrado** é um software de desktop offline para mestres de **Ordem Paranormal RPG**, criado para unificar a preparação e a condução de sessões. Ele funde as funcionalidades de gestão de campanha do app *autore* com o motor de regras e fichas de personagens do app *taberna*.

## Visão Geral
- **Público:** Mestre solo, desktop offline.
- **Objetivo:** Preparar e conduzir toda a sessão em um único ambiente, eliminando a necessidade de alternar entre ferramentas.
- **Base:** Fusão dos repositórios *autore* (gestão de campanha/cenas) e *taberna* (regras/fichas/ameaças).

## Funcionalidades Principais
### 1. Gestão de Campanhas (Herdado do autore)
- **Linha do Tempo e Cenas:** Controle de tempo de jogo e agendamento de eventos.
- **Pistas e Quadro (Mapas Mentais):** Organização de evidências e conexões entre mistérios.
- **Corkboard e Arquivos:** Espaço para notas da sessão e gerenciamento de arquivos (PDFs, imagens).
- **Busca e Backup:** Sistema de busca global e rotina de backup íntegra.

### 2. Motor de Fichas (Herdado do taberna)
- **Cálculo Automático:** Fichas de agentes que seguem as regras oficiais do livro (PV, PE, Sanidade, Defesa, DT de rituais, etc.).
- **Layout RPGpédia:** Três colunas com rolagem independente, hexágono de atributos e barras visuais de status.
- **Rolagem Física:** Entrada manual de resultados de dados físicos da mesa com cálculo automático de bônus, críticos e danos multiplicados.

### 3. Biblioteca Centralizada
- **Ameaças, Itens e Rituais:** Cadastro e gerenciamento de modelos que podem ser usados em qualquer campanha.
- **Origem dos Dados:** Cada item identifica sua procedência (Livro Oficial, Criação Própria, etc.).
- **Fichas Flexíveis:** Agentes usam ficha completa; NPCs usam ficha compacta, com opção de upgrade para ficha completa para vilões.

## Tecnologias e Arquitetura
- **Plataforma:** Desktop (Windows, offline).
- **Core:** Baseado no app *autore*.
- **Integração:** Migração dos esquemas e regras do *taberna* (`regras.ts`, `esquemas.ts`).
- **Repositório:** Projeto novo (magistrado), sem afetar os originais *autore* e *taberna*.

## Sinal de Sucesso
O Magistrado é validado quando Lucas consegue conduzir uma sessão completa sem precisar abrir qualquer outra ferramenta para consultar regras, calcular fichas ou gerenciar ameaças.
