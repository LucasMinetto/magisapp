# Skills de uso obrigatório neste projeto

Siga estas regras em toda sessão, sem esperar que o usuário peça.

## 1. `project-brain` — entrada de ideias, projetos e funções

Quando o pedido for uma ideia, um projeto novo, uma nova função ou "qual skill uso para isto?", comece por `project-brain`. Ela entrevista, confirma a intenção e indica a próxima skill. Os documentos persistentes (`PRD.md`, `TECH_SPEC.md`, `TASKS.md`, `PROJECT_MEMORY.md`) ficam com `project-docs`, em `docs/<slug>/`.

## 2. `planning-with-files` — toda tarefa com várias etapas

Use `planning-with-files` em qualquer tarefa que exija cerca de 5 ou mais chamadas de ferramenta, em pesquisas e em trabalhos que atravessem sessões. Ela mantém `task_plan.md`, `findings.md` e `progress.md` como memória de trabalho da tarefa.

A divisão com `project-docs`: `planning-with-files` guarda o andamento da tarefa atual; `project-docs` guarda as decisões duradouras da iniciativa. Ao concluir uma fase, leve as decisões que valem para o projeto ao `PROJECT_MEMORY.md` e ao `TASKS.md`.

## 3. RTK — comandos de shell econômicos

No início da sessão, rode `rtk gain`.

- Se funcionar, o RTK está instalado: prefira os wrappers `rtk` para comandos de shell com muita saída (`rtk git status`, `rtk grep`, `rtk read`, `rtk test ...`, `rtk lint`). Se o hook global (`rtk init -g`) já estiver ativo, os comandos são reescritos automaticamente.
- Se não funcionar, avise o usuário uma vez e ofereça a skill `rtk` para instalar. Não instale nem rode `rtk init` sem a confirmação dele, porque altera o computador e a configuração global do agente.
