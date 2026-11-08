# Progress Log: App Mobile de Jogadores (Magistrado Celular)

## 2026-11-07 - Planejamento Completo (Grey/Green + Issues GitHub)

### Decisões Consolidadas
| Item | Decisão | Fonte |
|------|---------|-------|
| **Stack** | React Native + Expo (PWA) | Entrevista + Issue #3 |
| **Platform** | PWA no GitHub Pages (instalável Android/iOS) | Issue #3 |
| **Sync** | HTTPS + WebSocket + DuckDNS + QR code + user/senha | Issue #2 |
| **MVP Funcionalidades** | Ficha, Rolagem, Regras, Sync WiFi | Issues #2, #4, #15 |
| **Pós-MVP** | Biblioteca (Rituais/Itens), Arquivo do Agente | Issues #5, #15 |
| **Banco Local** | op-sqlite (iOS/Android/Web WASM) | Análise técnica |
| **Navegação** | Expo Router (file-based) | Decisão técnica |
| **Prazo** | MVP 4-5 dias; Completo 1 semana | Estimativa realista |

### Escopo MVP (Fases 1-6, 9, 10)
- ✅ Phase 1: Setup Expo + PWA + GitHub Pages
- ✅ Phase 2: DB Local (op-sqlite) + Schema
- ✅ Phase 3: API Client + Auth (Login/QR) + Sync Engine
- ✅ Phase 4: Tela Ficha (Resumo, Atributos, Inventário, Condições)
- ✅ Phase 5: Tela Rolagem (Teste, Ataque, Dano, Ritual, Iniciativa, Histórico)
- ✅ Phase 6: Tela Regras (Sumário, Busca, Capítulos, Páginas livro)
- ✅ Phase 9: Desktop Servidor HTTPS/WS + DuckDNS + QR + Filtro
- ✅ Phase 10: Integração E2E + Testes Offline + Polimento PWA

### Escopo Pós-MVP (Fases 7, 8)
- ⏳ Phase 7: Tela Biblioteca (Rituais/Itens com filtros + busca)
- ⏳ Phase 8: Tela Arquivo (Pessoas, Lugares, Anotações, Histórico)

### Arquivos de Planejamento Criados/Atualizados
- `task_plan.md` — 10 fases detalhadas com deliverables e verificação
- `findings.md` — Arquitetura completa, dados, sync, estrutura, riscos
- `progress.md` — Este log

---

## 2026-11-07 - Próxima Ação: Iniciar Phase 1

### Phase 1: Setup Expo + PWA + GitHub Pages Deploy
**Objetivo:** Projeto Expo funcional com PWA configurado, build estático gerando `dist/`, deploy no GitHub Pages.

**Tarefas:**
1. `npm create expo-app@latest hermes-app-celular -- --template blank-typescript` (ou usar worktree existente)
2. Instalar dependências: `expo-router`, `op-sqlite`, `@expo/pwa`, `expo-camera` (QR), `zustand`/`jotai` (state), `zod` (já no shared), `fuse.js` (busca)
3. Configurar `app.json` / `expo.config.js`: PWA manifest, `web.output: 'static'`, ícones, splash
4. Configurar Expo Router: estrutura `app/` com rotas iniciais
5. Symlink `shared/` → `../app/src/shared` (ou script copy no `postinstall`)
6. GitHub Actions workflow para deploy em `gh-pages` branch
7. Testar: `npx expo start --web` → abre no navegador; `npx expo export -p web` → gera `dist/`

**Verificação:**
- [ ] `npx expo start --web` carrega sem erros
- [ ] Build estático gera pasta `dist/` com `index.html`, `manifest.webmanifest`, `sw.js`
- [ ] PWA instala no Chrome Android (menu → Instalar app)
- [ ] PWA instala no Safari iOS (compartilhar → Adicionar à Tela Inicial)
- [ ] Service Worker registra e cachea assets

**Tempo estimado:** ~1 dia

---

## Template para Atualizações Diárias

### YYYY-MM-DD - Fase X: <nome>
**Objetivo:** <o que entregar hoje>
**Feito:**
- <item 1>
- <item 2>
**Erros/Blockers:**
- <erro> → <tentativa> → <resolução>
**Próximo:** <próxima tarefa>
**Tempo gasto:** ~Xh