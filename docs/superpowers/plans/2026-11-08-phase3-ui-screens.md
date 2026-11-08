# Phase 3: UI Screens (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all player-facing UI screens for the Magistrado Celular PWA: Ficha, Rolagem, Regras, Biblioteca, Arquivo, Sync.

**Architecture:** Expo Router file-based routing, React Native components, hooks from Phase 2 (`useFicha`, `useBiblioteca`, `useRegras`, `useArquivo`, `useSyncQueue`, `useAuthDB`), op-sqlite for offline data, NativeWind/Tailwind for styling.

**Tech Stack:** Expo SDK 58, React Native, TypeScript, NativeWind v4, op-sqlite, Zustand, Fuse.js (search).

**Spec:** task_plan.md (Phases 4-8), findings.md (UI requirements), Phase 2 deliverables (hooks, DB, seed).

## Global Constraints

- **Offline-first**: All screens work without network; data from local SQLite
- **Sync integration**: Write operations enqueue to `useSyncQueue`; read from local DB
- **Shared types**: Reuse `FichaAgente`, `RitualBiblioteca`, `ItemBiblioteca`, `Regra` from `shared/ordem/esquemas.ts`
- **Calculations**: Use `regras.ts` functions (`derivados`, `dadosDoTeste`, `resolverTeste`, `lerExpressao`, `rolarExpressao`)
- **Theme**: Dark mode (`#0f0f1a` background, `#3b82f6` accent), NativeWind utilities
- **Responsive**: Mobile-first, works on iOS Safari + Android Chrome
- **Accessibility**: Semantic HTML, touch targets ≥44px, contrast ratios

## Review Focus

1. **Sync queue not enqueued on writes** — every create/update/delete must call `useSyncQueue.enqueue()`
2. **Optimistic updates not reverted on sync failure** — test: disconnect network, edit, reconnect, verify rollback or retry
3. **Search not working offline** — Fuse.js index must be built from local data
4. **Dice roller not using shared `regras.ts`** — must use `dadosDoTeste`, `resolverTeste`, `lerExpressao`, `rolarExpressao`
5. **Ficha calculations stale** — `derivados()` must re-run on any attribute/perícia/inventário change

---

### Task 1: Theme & UI Primitives (NativeWind Setup)

**Files:**
- Create: `tailwind.config.js`
- Create: `nativewind-env.d.ts`
- Create: `src/theme/colors.ts`
- Create: `src/theme/spacing.ts`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Checkbox.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/Spinner.tsx`
- Create: `src/components/ui/DiceDisplay.tsx`
- Test: `src/components/ui/__tests__/Button.test.tsx`

**Interfaces:**
- Produces: styled components with consistent design system

- [ ] **Step 1: Configure NativeWind**
  ```bash
  npx expo install nativewind tailwindcss@3.4.0
  # Add babel plugin to babel.config.js
  ```

- [ ] **Step 2: Create theme tokens**
  ```typescript
  // src/theme/colors.ts
  export const colors = {
    bg: '#0f0f1a',
    bgElevated: '#1a1a2e',
    border: '#1a1a2e',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    text: '#e8e8f0',
    textMuted: '#8888a0',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    pv: '#22c55e',
    pe: '#3b82f6',
    san: '#f43f5e',
  }
  ```

- [ ] **Step 3: Implement primitive components** (Button, Card, Input, Select, Checkbox, Modal, Toast, Spinner, DiceDisplay)
  - All components accept `className` for composition
  - Button: variants (primary, secondary, ghost, danger), sizes (sm, md, lg), loading state
  - Input: label, error, helperText, icon support
  - Checkbox: label, indeterminate, grouped (CheckboxGroup)
  - DiceDisplay: shows d20 results with critical highlight

- [ ] **Step 4: Run tests**
  Run: `npx vitest run src/components/ui/__tests__/Button.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add tailwind.config.js nativewind-env.d.ts src/theme/ src/components/ui/
  git commit -m "feat(ui): theme tokens + primitive components with NativeWind"
  ```

---

### Task 2: Tela Ficha — Abas (Resumo, Atributos, Inventário, Condições, Ataques, Habilidades, Rituais)

**Files:**
- Create: `app/campanha/ficha/_layout.tsx` (tab navigator)
- Create: `app/campanha/ficha/index.tsx` (Resumo)
- Create: `app/campanha/ficha/atributos.tsx`
- Create: `app/campanha/ficha/inventario.tsx`
- Create: `app/campanha/ficha/condicoes.tsx`
- Create: `app/campanha/ficha/ataques.tsx`
- Create: `app/campanha/ficha/habilidades.tsx`
- Create: `app/campanha/ficha/rituais.tsx`
- Create: `src/components/ficha/PVPECard.tsx`
- Create: `src/components/ficha/AtributoRow.tsx`
- Create: `src/components/ficha/PericiaRow.tsx`
- Create: `src/components/ficha/ItemCard.tsx`
- Create: `src/components/ficha/CondicaoCheckbox.tsx`
- Create: `src/components/ficha/AtaqueCard.tsx`
- Create: `src/components/ficha/HabilidadeCard.tsx`
- Create: `src/components/ficha/RitualCard.tsx`
- Test: `src/components/ficha/__tests__/PVPECard.test.tsx`

**Interfaces:**
- Consumes: `useFicha` (ficha data, upsert, markSynced), `useBiblioteca` (rituals/itens for display)
- Produces: ficha screens with optimistic updates + sync queue enqueue

- [ ] **Step 1: Create ficha tab layout** (`app/campanha/ficha/_layout.tsx`)
  - 7 tabs: Resumo, Atributos, Inventário, Condições, Ataques, Habilidades, Rituais
  - Ionicons icons per tab

- [ ] **Step 2: Implement Resumo** (`index.tsx`)
  - Large PV/PE/SAN cards (current/max with color coding)
  - Patente, NEX, Carga, Deslocamento, Iniciativa
  - Derived values from `regras.ts` `derivados()`

- [ ] **Step 3: Implement Atributos + Perícias** (`atributos.tsx`)
  - 5 attribute inputs (AGI, FOR, INT, PRE, VIG) with +/- buttons
  - Perícia list: name, attribute, treino (0/5/10/15), extra, total bonus
  - Inline edit: tap treino/extra → number input → save → enqueue sync

- [ ] **Step 4: Implement Inventário** (`inventario.tsx`)
  - List: nome, categoria, espaços, qtd, equipado (toggle), defesa
  - Equipado toggle → recalcula carga/defesa → enqueue sync
  - Add/remove items (modal with ItemBiblioteca picker)

- [ ] **Step 5: Implement Condições** (`condicoes.tsx`)
  - 57 checkboxes (alphabetical, from `CONDICOES` in `regras.ts`)
  - Filter: Todas | Ativas | Inativas
  - Checkbox change → enqueue sync

- [ ] **Step 6: Implement Ataques/Habilidades/Rituais** (readonly lists for MVP)
  - Cards with key info, no inline editing
  - Ataques: nome, perícia, dano, crítico, alcance
  - Habilidades: nome, fonte, custo, descrição
  - Rituais: nome, elemento, círculo, execução

- [ ] **Step 5: Commit**
  ```bash
  git add app/campanha/ficha/ src/components/ficha/
  git commit -m "feat(ficha): 7-tab ficha screens with Resumo, Atributos, Inventário, Condições"
  ```

---

### Task 3: Tela Rolagem — Seletor + 5 Modos (Teste, Ataque, Dano, Ritual, Iniciativa)

**Files:**
- Create: `app/campanha/rolagem/_layout.tsx`
- Create: `app/campanha/rolagem/index.tsx` (Seletor)
- Create: `app/campanha/rolagem/teste.tsx`
- Create: `app/campanha/rolagem/ataque.tsx`
- Create: `app/campanha/rolagem/dano.tsx`
- Create: `app/campanha/rolagem/ritual.tsx`
- Create: `app/campanha/rolagem/iniciativa.tsx`
- Create: `app/campanha/rolagem/historico.tsx`
- Create: `src/components/rolagem/DiceSelector.tsx`
- Create: `src/components/rolagem/DiceInput.tsx`
- Create: `src/components/rolagem/ResultadoCard.tsx`
- Create: `src/components/rolagem/HistoricoList.tsx`
- Create: `src/hooks/useRolagem.ts` (wrapper around `regras.ts` dice functions)
- Test: `src/components/rolagem/__tests__/DiceInput.test.tsx`

**Interfaces:**
- Consumes: `useFicha` (atributos, perícias, ataques, rituais), `useRolagens` (CRUD + sync), `regras.ts` dice functions
- Produces: roller screens with history + sync queue enqueue

- [ ] **Step 1: Create `useRolagem.ts` hook**
  ```typescript
  // Wraps regras.ts: dadosDoTeste, resolverTeste, lerExpressao, rolarExpressao, rolarDado
  // Manages local history + sync queue enqueue
  ```

- [ ] **Step 2: Create seletor screen** (`index.tsx`)
  - 5 cards: Teste, Ataque, Dano, Ritual, Iniciativa
  - Navigation to each mode

- [ ] **Step 3: Implement Teste** (`teste.tsx`)
  - Dropdown: perícia/atributo (searchable, shows bonus)
  - Inputs: bônus extra, dados extras
  - Roll button → shows d20s, escolhido, total, crítico (uses `dadosDoTeste` + `resolverTeste`)

- [ ] **Step 4: Implement Ataque** (`ataque.tsx`)
  - Select ataque from ficha → roll teste → if hit, roll dano
  - Shows d20 test + damage breakdown per type (uses `lerExpressao` + `rolarExpressao`)

- [ ] **Step 5: Implement Dano** (`dano.tsx`)
  - Free expression input (`2d6+3`, `1d8+1d4+2`)
  - Roll → shows individual dice + total per type

- [ ] **Step 6: Implement Ritual** (`ritual.tsx`)
  - Select ritual from ficha → roll teste (Ocultismo)
  - Shows resistência, efeito, dano do ritual

- [ ] **Step 7: Implement Iniciativa** (`iniciativa.tsx`)
  - 1d20+AGI → add to local session initiative

- [ ] **Step 8: Implement Histórico** (`historico.tsx`)
  - List from `useRolagens` with timestamp, type, formula, result

- [ ] **Step 9: Commit**
  ```bash
  git add app/campanha/rolagem/ src/components/rolagem/ src/hooks/useRolagem.ts
  git commit -m "feat(rolagem): 5-mode dice roller with history + sync"
  ```

---

### Task 4: Tela Regras — Sumário Lateral + Busca + Capítulos

**Files:**
- Create: `app/campanha/regras/_layout.tsx` (split view: sidebar + content)
- Create: `app/campanha/regras/index.tsx` (busca + lista capítulos)
- Create: `app/campanha/regras/[capitulo].tsx` (conteúdo)
- Create: `src/components/regras/Sidebar.tsx`
- Create: `src/components/regras/ContentRenderer.tsx`
- Create: `src/hooks/useRegrasData.ts` (loads regras.json from assets or SQLite)
- Test: `src/hooks/__tests__/useRegrasData.test.tsx`

**Interfaces:**
- Consumes: `regras.json` (from assets or sync), `useRegrasData` hook
- Produces: offline-readable rules with search + page markers

- [ ] **Step 1: Prepare regras.json**
  - Copy from desktop sync or bundle `assets/regras.json`
  - Structure: `{ capitulo, titulo, conteudo (HTML), pagina_livro, visivel_para_jogadores }[]`

- [ ] **Step 2: Implement `useRegrasData.ts`**
  - Load from SQLite `regras` table (seeded) or assets fallback
  - Filter by `visivel_para_jogadores: true`
  - Full-text search with Fuse.js

- [ ] **Step 3: Create sidebar layout** (`_layout.tsx`)
  - Left: scrollable chapter list (capítulos 1-8 + apêndices)
  - Right: content area
  - Mobile: drawer/sheet for sidebar

- [ ] **Step 4: Implement chapter content** (`[capitulo].tsx`)
  - Render HTML/markdown from `conteudo`
  - Page markers: "p. 42 (OP)" / "p. 15 (SaH)"
  - Breadcrumbs + prev/next navigation

- [ ] **Step 5: Implement search** (`index.tsx`)
  - Real-time Fuse.js search
  - Results: snippet + chapter link

- [ ] **Step 6: Commit**
  ```bash
  git add app/campanha/regras/ src/components/regras/ src/hooks/useRegrasData.ts
  git commit -m "feat(regras): offline rules with sidebar, search, page markers"
  ```

---

### Task 5: Tela Biblioteca — Rituais + Itens (Tabs + Filtros + Busca)

**Files:**
- Create: `app/campanha/biblioteca/_layout.tsx` (tabs: Rituais | Itens)
- Create: `app/campanha/biblioteca/rituais.tsx`
- Create: `app/campanha/biblioteca/itens.tsx`
- Create: `app/campanha/biblioteca/busca.tsx`
- Create: `app/campanha/biblioteca/[id].tsx` (detalhe)
- Create: `src/components/biblioteca/RitualCard.tsx`
- Create: `src/components/biblioteca/ItemCard.tsx`
- Create: `src/components/biblioteca/Filters.tsx`
- Create: `src/hooks/useBibliotecaData.ts` (already exists from Phase 2)

**Interfaces:**
- Consumes: `useBiblioteca` (CRUD + filters), `useBibliotecaData` (seed data)
- Produces: filterable lists + detail views

- [ ] **Step 1: Implement Rituais tab** (`rituais.tsx`)
  - Filters: Elemento (5), Círculo (1-4), Busca nome/texto
  - Card: nome, elemento badge, círculo badge, execução, alcance, alvo, duração, resistência, efeito, dano

- [ ] **Step 2: Implement Itens tab** (`itens.tsx`)
  - Filters: Tipo (5), Categoria (0-4), Busca nome/texto
  - Card: nome, tipo, categoria, dano/crítico/alcance/proficiência/empunhadura, espaços, defesa

- [ ] **Step 3: Unified search** (`busca.tsx`)
  - Toggle: Rituais | Itens | Todos
  - Fuse.js search on nome + texto completo

- [ ] **Step 4: Detail view** (`[id].tsx`)
  - Full `RitualBiblioteca` / `ItemBiblioteca` fields

- [ ] **Step 5: Commit**
  ```bash
  git add app/campanha/biblioteca/ src/components/biblioteca/
  git commit -m "feat(biblioteca): rituais/itens with filters, search, detail"
  ```

---

### Task 6: Tela Arquivo — Pessoas, Lugares, Anotações, Histórico

**Files:**
- Create: `app/campanha/arquivo/_layout.tsx` (tabs)
- Create: `app/campanha/arquivo/pessoas.tsx`
- Create: `app/campanha/arquivo/lugares.tsx`
- Create: `app/campanha/arquivo/anotacoes.tsx`
- Create: `app/campanha/arquivo/historico.tsx`
- Create: `src/components/arquivo/PessoaCard.tsx`
- Create: `src/components/arquivo/LugarCard.tsx`
- Create: `src/components/arquivo/AnotacaoEditor.tsx`
- Create: `src/components/arquivo/HistoricoTimeline.tsx`

**Interfaces:**
- Consumes: `useArquivo` (CRUD + versioning)
- Produces: versioned cards + markdown editor + timeline

- [ ] **Step 1: Pessoas tab** (`pessoas.tsx`)
  - Cards: nome, retrato, "o que sabe" (cartão "Para os jogadores")
  - Version badge: v1, v2... → tap to see history

- [ ] **Step 2: Lugares tab** (`lugares.tsx`)
  - Cards: nome, imagem, descrição pública
  - Version history

- [ ] **Step 3: Anotações tab** (`anotacoes.tsx`)
  - Markdown editor (textarea + preview)
  - Link to pessoas/lugares
  - Survives mestre updates

- [ ] **Step 4: Histórico tab** (`historico.tsx`)
  - Unified timeline: versões de cartas + interlúdios + anotações
  - Date + author (mestre/jogador)

- [ ] **Step 5: Commit**
  ```bash
  git add app/campanha/arquivo/ src/components/arquivo/
  git commit -m "feat(arquivo): pessoas/lugares/anotações/histórico with versioning"
  ```

---

### Task 7: Tela Sync — Status + QR + Fila Offline

**Files:**
- Create: `app/campanha/sync/index.tsx`
- Create: `src/components/sync/StatusBadge.tsx`
- Create: `src/components/sync/QRDisplay.tsx`
- Create: `src/components/sync/OfflineQueue.tsx`
- Create: `src/components/sync/ManualSyncButton.tsx`

**Interfaces:**
- Consumes: `useSync` (status, pull, push, queue), `useAuth` (campaign URL)
- Produces: connection state, manual controls, offline queue visibility

- [ ] **Step 1: Status badge** (online/offline/syncing/error)
  - Color coding: green/yellow/red
  - Last sync timestamp

- [ ] **Step 2: QR display** (for initial connection)
  - Show campaign URL + token
  - Copy button

- [ ] **Step 3: Offline queue** (list pending operations)
  - Show: operation type, payload preview, retry count, error
  - Manual retry button per item

- [ ] **Step 4: Manual sync button** (pull + push)

- [ ] **Step 5: Commit**
  ```bash
  git add app/campanha/sync/ src/components/sync/
  git commit -m "feat(sync): status, QR, offline queue, manual controls"
  ```

---

### Task 8: PWA Polish + GitHub Pages Deploy

**Files:**
- Modify: `app.json` / `expo.config.js` (PWA manifest, icons, splash)
- Create: `assets/icon-192.png`, `assets/icon-512.png`, `assets/splash.png`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `package.json` (scripts: `build:web`, `deploy:pages`)

**Interfaces:**
- Produces: installable PWA on GitHub Pages

- [ ] **Step 1: Configure PWA manifest**
  - `expo.web.output: 'static'`
  - `expo.pwa.manifest`: name, short_name, icons, display: 'standalone', theme_color

- [ ] **Step 2: Generate icons/splash**
  - `npx expo install @expo/pwa` → `npx expo-pwa generate`

- [ ] **Step 3: GitHub Actions workflow**
  - Build: `npx expo export -p web`
  - Deploy to `gh-pages` branch

- [ ] **Step 4: Verify PWA install**
  - `npx expo export -p web` → `dist/` generated
  - Test install on Chrome Android + Safari iOS

- [ ] **Step 5: Commit**
  ```bash
  git add app.json assets/ .github/workflows/ package.json
  git commit -m "feat(pwa): GitHub Pages deploy, installable PWA"
  ```

---

### Task 9: Final Integration Test + iOS/Android Verification

**Files:** (verification only)

- [ ] **Step 1: Full test suite**
  Run: `npx vitest run` → 19+ tests pass

- [ ] **Step 2: Typecheck + lint**
  Run: `npx tsc --noEmit` + `npx expo lint` → 0 errors

- [ ] **Step 3: Build web**
  Run: `npx expo export -p web` → `dist/` generated

- [ ] **Step 4: Device test**
  - Android Chrome: install PWA, test all screens offline + sync
  - iOS Safari: install PWA, test all screens offline + sync

- [ ] **Step 5: E2E with desktop** (if desktop server ready)
  - Master opens sync → 3 mobiles connect → roll dice → edit ficha → master sees changes

- [ ] **Step 6: Final commit**
  ```bash
  git commit -m "chore: phase 3 complete - all UI screens + PWA deploy"
  ```

---

## Phase 3 Summary

| Task | Screens | Est. Days |
|------|---------|-----------|
| 1. Theme & UI Primitives | — | 0.5 |
| 2. Ficha (7 tabs) | Resumo, Atributos, Inventário, Condições, Ataques, Habilidades, Rituais | 1.5 |
| 3. Rolagem (5 modes) | Seletor, Teste, Ataque, Dano, Ritual, Iniciativa, Histórico | 1 |
| 4. Regras | Sidebar, Busca, Capítulos, Páginas | 0.5 |
| 5. Biblioteca | Rituais, Itens, Busca, Detalhe | 0.5 |
| 6. Arquivo | Pessoas, Lugares, Anotações, Histórico | 0.5 |
| 7. Sync | Status, QR, Fila, Manual | 0.5 |
| 8. PWA Deploy | Icons, GitHub Actions | 0.5 |
| 9. Final Test | E2E, iOS/Android | 0.5 |
| **Total** | | **~6 days** |

**MVP (Phases 1-3 of this plan):** Tasks 1-3 → Ficha + Rolagem + Regras
**Completo:** All 9 tasks