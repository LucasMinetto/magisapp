# Task Plan: App Mobile de Jogadores (Magistrado Celular)

## Goal
Criar versão mobile (PWA via Expo) do Magistrado para **jogadores** — ficha, rolagem, regras, rituais/itens, arquivo do agente — sincronizando via WiFi local (HTTPS + WebSocket) com o app desktop do mestre. MVP em 1 semana.

## Fonte
Issues GitHub P2: #2 (Servidor/Sync), #3 (PWA GitHub Pages), #4 (Agente/Ficha), #5 (Arquivo), #15 (Regras/Biblioteca)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Stack: React Native + Expo (PWA) | Compartilha código React/TypeScript com desktop; Expo suporta web + nativo |
| Platform: PWA (web instalável) | Acesso imediato sem store; funciona no celular do jogador na mesa |
| Sync: WiFi local (HTTPS + WebSocket + DuckDNS) | Spec do Issue #2; PC mestre = servidor; QR code + user/senha |
| Escopo: Apenas jogador | Mestre usa desktop; mobile não tem criação/edição de campanhas, ameaças, etc. |
| Reuso: `shared/ordem/*`, `shared/types.ts`, `regras.ts`, `esquemas.ts` | Lógica pura (cálculos, schemas zod) roda igual no mobile |
| Banco: op-sqlite | iOS/Android/Web (WASM); API SQLite padrão |
| Navegação: Expo Router (file-based) | Type-safe, integra com Expo, suporta web nativamente |

## Current Phase
Phase 1: Setup Expo + PWA + GitHub Pages deploy

## Phases

### Phase 1: Setup Expo + PWA + GitHub Pages Deploy
**Status:** pending
**Deliverables:**
- `package.json` com Expo SDK 51+, React Native Web, TypeScript, op-sqlite, expo-router
- `app.json` / `expo.config.js` configurado para PWA (`expo.web.output: 'static'`)
- `expo.pwa.manifest` com name, icons, start_url, display: 'standalone'
- Service Worker (Workbox via `@expo/pwa` ou `expo-service-worker`)
- Estrutura `app/` (Expo Router) com rotas: index, login, campanha/*, settings
- Symlink `shared/` → `../app/src/shared` (ou copy script no build)
- Deploy GitHub Pages: GitHub Actions ou `gh-pages` branch
- Verificação: `npx expo start --web` abre no navegador; build estático gera pasta `dist/`
- Teste: instala PWA no Android Chrome e iOS Safari

### Phase 2: DB Local (op-sqlite) + Schema
**Status:** pending
**Deliverables:**
- `src/db/schema.sql`: tabelas para ficha, biblioteca (rituais/itens), regras, arquivo (pessoas/lugares/anotacoes/historico), sync (fila offline, campanhas), auth
- `src/db/migrations/`: versionamento do schema
- `src/db/index.ts`: inicialização, helpers CRUD, transações
- Seed: dados de teste (ficha exemplo, rituais, itens, regras)
- Verificação: `npx expo start` → console mostra tabelas criadas; CRUD básico funciona

### Phase 3: API Client + Auth (Login/QR) + Sync Engine
**Status:** pending
**Deliverables:**
- `src/api/client.ts`: `fetch` wrapper + WebSocket client (reconexão automática, heartbeat)
- `src/api/protocol.ts`: tipos de mensagem (pull, push, delta, ack, error), versionamento `X-Protocol-Version`
- `src/api/sync.ts`: 
  - `pull(campaignId, userId)` → ficha + biblioteca + regras + arquivo + cartões
  - `push(campaignId, userId, changes)` → EntityInput + RollInput[] + anotações
  - Fila offline local (IndexedDB/op-sqlite): actions com timestamp + ID único
  - Merge no reconectar: last-write-wins por campo; conflitos logados
- `src/hooks/useAuth.ts`: login user/senha, JWT/session storage, QR scanner (expo-camera)
- `src/hooks/useSync.ts`: estado conexão (online/offline/syncing), pull/push manual, auto-sync quando online
- Desktop: servidor HTTPS + WS em `main/` (porta 3443), certificado DuckDNS, botão "Abrir para jogadores" → QR code
- Verificação: mobile escaneia QR → login → pull recebe ficha; edita PV → push → desktop reflete

### Phase 4: Tela Ficha do Personagem (MVP)
**Status:** pending
**Deliverables:**
- Rotas: `app/campanha/ficha/_layout.tsx` (tabs), `index.tsx` (Resumo), `atributos.tsx`, `inventario.tsx`, `condicoes.tsx`, `ataques.tsx`, `habilidades.tsx`, `rituais.tsx`
- **Resumo**: PV/PE/SAN grandes (atual/máx), patente, NEX, carga, deslocamento, iniciativa
- **Atributos + Perícias**: 5 atributos editáveis; lista de perícias com treino/extra editável; bônus calculado
- **Inventário**: lista itens (nome, categoria, espaços, quantidade, equipado, defesa); toggle equipar; soma carga/defesa
- **Condições**: checkboxes das 57 condições do livro (ordenadas); filtro ativas/inativas
- **Ataques/Habilidades/Rituais**: listas da ficha completa (readonly no MVP; edição depois)
- Cálculos derivados via `regras.ts`: `derivados()`, `patentePorPrestigio()`, `nivelNex()`, carga/defesa
- `useFicha.ts`: carrega do SQLite, salva com debounce, push para sync queue
- Verificação: abre ficha sincronizada → edita PV/condições/inventário → salva → sync → desktop atualizado

### Phase 5: Tela Rolagem de Dados (MVP)
**Status:** pending
**Deliverables:**
- Rotas: `app/campanha/rolagem/_layout.tsx`, `index.tsx` (seletor), `teste.tsx`, `ataque.tsx`, `dano.tsx`, `ritual.tsx`, `iniciativa.tsx`, `historico.tsx`
- **Seletor**: cards para Teste | Ataque | Dano | Ritual | Iniciativa
- **Teste**: seleciona perícia/atributo (dropdown com busca) → bônus auto → dados extras → rola d20s → mostra escolhido, total, crítico
- **Ataque**: seleciona ataque da ficha → rola d20 (teste) → se acerta, rola dano (usa `lerExpressao` + `rolarExpressao`) → mostra total por tipo
- **Dano**: input livre expressão (`2d6+3`, `1d8+1d4+2`) → rola → mostra dados individuais + total
- **Ritual**: seleciona ritual da ficha → rola teste (Ocultismo) → mostra resistência/efeito/dano do ritual
- **Iniciativa**: 1d20+AGI → adiciona à iniciativa local da sessão
- **Histórico**: lista rolagens da sessão (persistido no SQLite) com timestamp, tipo, fórmula, resultado
- `useRolagens.ts`: CRUD local + push para sync queue
- Verificação: rola 3d20+5 (teste) → vê crítico natural 20 → histórico salva; rola ataque + dano → vê breakdown

### Phase 6: Tela Regras (MVP)
**Status:** pending
**Deliverables:**
- Rotas: `app/campanha/regras/_layout.tsx` (sumário lateral fixo), `index.tsx` (busca + capítulos), `[capitulo].tsx` (conteúdo)
- Dados: `regras.json` do desktop (já tem texto + páginas + `visivelParaJogadores`) copiado para `assets/regras.json` ou puxado no primeiro sync
- **Sumário lateral**: capítulos 1-8 + apêndices; marcação visual do capítulo atual
- **Busca**: full-text no conteúdo (Fuse.js ou SQL FTS5); resultados com snippet + capítulo
- **Conteúdo**: renderiza markdown/HTML do livro; marcadores de página impressa (OP = PDF-10, SaH = PDF-1)
- **Navegação**: breadcrumbs, anterior/próximo, scroll spy no sumário
- Offline-first: todo conteúdo cached no SQLite + Service Worker
- Verificação: abre capítulo 3 → busca "crítico" → encontra seção com página do livro

### Phase 7: Tela Biblioteca (Rituais + Itens) — Pós-MVP
**Status:** pending
**Deliverables:**
- Rotas: `app/campanha/biblioteca/_layout.tsx` (tabs), `rituais.tsx`, `itens.tsx`, `busca.tsx`, `[id].tsx`
- **Rituais**: lista filtrável por elemento (Sangue/Morte/Conhecimento/Energia/Medo), círculo (1-4), busca nome/texto; card mostra nome, elemento, círculo, execução, alcance, alvo, duração, resistência, efeito, dano
- **Itens**: lista filtrável por tipo (Arma/Proteção/Equipamento/Munição/Amaldiçoado), categoria (0-4), busca; card mostra nome, tipo, dano/crítico/alcance/proficiência/empunhadura, espaços, defesa
- **Busca unificada**: toggle Rituais/Itens/Todos; Fuse.js no nome + texto completo
- **Detalhe**: todos os campos do `ritualBibliotecaSchema` / `itemBibliotecaSchema`
- Dados: cache local do pull (apenas rituais/itens liberados — NÃO ameaças, Issue #15)
- Verificação: filtra "Fogo + círculo 2" → abre "Tocha" → vê execução/alcance/dano

### Phase 8: Tela Arquivo do Agente — Pós-MVP (Issue #5)
**Status:** pending
**Deliverables:**
- Rotas: `app/campanha/arquivo/_layout.tsx` (tabs), `pessoas.tsx`, `lugares.tsx`, `anotacoes.tsx`, `historico.tsx`
- **Pessoas**: cartões "Para os jogadores" de NPCs (nome, retrato, o que sabe); versão atual + histórico de versões
- **Lugares**: cartões "Para os jogadores" de locais (nome, imagem, descrição pública); versão atual + histórico
- **Anotações**: editor livre do jogador (markdown); sobrevive a updates do mestre; vinculável a pessoas/lugares
- **Histórico**: timeline unificada (versões de cartões + interlúdios + anotações); data + autor
- Dados: cartões vêm do pull (filtrados por "conhecido pelo agente"); anotações só no mobile
- Verificação: mestre atualiza cartão no desktop → mobile recebe nova versão + mantém antiga → jogador anota → anotação persiste

### Phase 9: Desktop — Servidor HTTPS/WS + DuckDNS + QR + Filtro (MVP)
**Status:** pending
**Deliverables:**
- `main/servidor-jogadores.ts`: servidor HTTPS (Node `https` + `ws` ou `fastify` + `ws`)
- Certificados: DuckDNS assistente (subdomínio + token → `acme.sh` ou similar); fallback `mkcert` para dev
- `main/sync-handler.ts`: 
  - Auth: bcrypt + JWT (expiração 30 dias, refresh token)
  - Pull: `GET /api/sync/pull?campaignId&userId` → filtrado por `liberadoPara[userId]`
  - Push: `POST /api/sync/push` → valida + aplica + broadcast WS para outros jogadores
  - WS: `ws://host/sync?token` → mensagens `delta`, `ack`, `ping`
- Filtro de liberação: 
  - Ficha: só o agente do `userId`
  - Biblioteca: só rituais/itens marcados como liberados (NÃO ameaças)
  - Regras: só seções com `visivelParaJogadores: true`
  - Cartões: só NPCs/lugares com `conhecidoPor.includes(userId)`
- UI Desktop: botão "Abrir para jogadores" → gera QR (URL + token curto) → mostra IP local + QR
- Logs auditoria: `console.log('[SYNC]', {userId, campaignId, action, fields})`
- Verificação: mestre clica botão → QR aparece → mobile escaneia → login → pull traz só dados liberados

### Phase 10: Integração Ponta-a-Ponta + Testes Offline + Polimento PWA (MVP)
**Status:** pending
**Deliverables:**
- Fluxo completo: mestre abre sync → 3 jogadores mobile conectam → rolam dados → editam fichas → mestre vê mudanças
- Testes offline: desliga WiFi → edita PV/condições/anotações → religa → sync sobe fila sem duplicar
- Testes conflito: dois jogadores editam mesmo campo → last-write-wins + log
- PWA polimento: ícones 192/512 maskable, splash screen, `theme-color`, `apple-mobile-web-app-*`
- Performance: bundle size < 500KB gzipped; TTI < 3s em 3G
- Testes iOS Safari + Android Chrome (Issue #3)
- Verificação: mesa real (mestre desktop + 3 jogadores mobile) roda 1 sessão completa sem bugs

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Expo + Electron sharing `shared/` paths | Symlink `shared/` no mobile → `../app/src/shared`; testar build web cedo |
| SQLite no Expo Web (PWA) | `op-sqlite` suporta web via WASM; fallback: IndexedDB (Dexie) se travar |
| HTTPS no desktop (DuckDNS) | Assistente no app; testar com `localhost` + `mkcert` primeiro |
| Descoberta WiFi no navegador | QR code com URL completa (HTTPS + token); sem mDNS |
| Sync tempo real + offline | WebSocket com reconexão automática; fila local com timestamps + ID único |
| iOS Safari PWA quirks | Testar no device real desde dia 1; `apple-mobile-web-app-*` meta tags |
| Prazo 1 semana | MVP = Fases 1-6,9,10; Biblioteca e Arquivo = pós-MVP |
| Versionamento protocolo | Header `X-Protocol-Version` em toda request; app avisa se incompatível (Issue #3) |

## Open Questions (Resolvidos pelos Issues)
1. ✅ Desktop expõe API? → Sim, Issue #2: servidor HTTPS/WS novo em `main/`
2. ✅ Formato sync? → Pull filtrado por userId + push delta; versionamento protocolo (Issue #3)
3. ✅ Autenticação? → User/senha por campanha + QR code com token curto (Issue #2)
4. ❓ Ícones/splash PWA? → Usar assets do desktop adaptados
5. ✅ Navegação? → Expo Router (file-based)

## Next Step
Iniciar **Phase 1**: Setup Expo + PWA + GitHub Pages deploy no worktree `hermes-app-celular`.