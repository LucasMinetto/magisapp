# Findings: App Mobile de Jogadores (Magistrado Celular)

## Fonte: Issues GitHub P2 (Versão dos Jogadores)
| Issue | Título | Status | Decisões-chave |
|-------|--------|--------|----------------|
| #1 | P2: Versão dos jogadores | OPEN | Parent issue |
| #2 | **P2.1 Servidor no PC do mestre e sincronização** | OPEN | PC mestre = servidor; botão "Abrir para jogadores"; QR code; HTTPS via DuckDNS; usuários/senha; fila offline; multi-campanha/mestre |
| #3 | **P2.2 App do jogador (PWA única no GitHub Pages)** | OPEN | PWA no GitHub Pages; um app pra todas campanhas; multi-mestre; versionamento protocolo; offline-first |
| #4 | **P2.3 Agente do jogador: escolher, criar e evoluir** | OPEN | MVP: escolher agente pronto + ver ficha; Criação/evolução guiada = depois |
| #5 | P2.5 Arquivo do agente | OPEN | 4 seções: Pessoas, Lugares, Anotações, Histórico; cartões "Para os jogadores" do mestre |
| #15 | **P2.13 Regras e biblioteca no celular** | OPEN | Regras: todas menos ameaças (marcação "visível para jogadores"); Biblioteca: rituais/itens SIM, ameaças NÃO |

---

## Arquitetura Compartilhada (Desktop → Mobile)

### Código Reutilizável (puro TypeScript, sem Electron/Node)
| Arquivo | Conteúdo | Uso no Mobile |
|---------|----------|---------------|
| `shared/ordem/regras.ts` | Cálculos PV/PE/SAN, defesa, patente, carga, rolagens, dano | **100%** - lógica pura |
| `shared/ordem/esquemas.ts` | Zod schemas: ficha, ameaça, item, ritual, rolagem, iniciativa | **100%** - validação + tipos |
| `shared/ordem/textoFicha.ts` | Gera texto formatado da ficha | **100%** - exibição |
| `shared/types.ts` | Contratos IPC, tipos de entidade, campanha, biblioteca | **Parcial** - tipos de ficha, biblioteca, rolagem |
| `shared/ordem/regras.test.ts` | Testes das regras | **100%** - roda no mobile |
| `shared/ordem/esquemas.test.ts` | Testes dos schemas | **100%** - roda no mobile |

### Código NÃO Reutilizável (Electron/Node)
| Arquivo | Motivo | Substituto Mobile |
|---------|--------|-------------------|
| `main/*` | Processo principal, IPC, SQLite (better-sqlite3), fs, auto-updater | Expo SQLite / op-sqlite + HTTP sync |
| `preload/*` | Bridge IPC `window.api` | API HTTP/WebSocket própria |
| `renderer/src/lib/data.ts` | Hooks `useLoad`, `useAutosave` ligados ao IPC | Hooks próprios com `fetch` + SQLite local |
| `renderer/src/*` (UI) | React DOM + CSS desktop | React Native + Expo (StyleSheet/NativeWind) |

## Dados que o Mobile Precisa (subset do desktop - do Issue #2, #15)

### Da Campanha (pull do desktop → mobile)
- **Agente do jogador**: `Entity` com `sheetData: FichaAgente` (ficha completa)
- **Biblioteca liberada**: `LibraryEntry<'ritual'>[]` + `LibraryEntry<'item'>[]` (NÃO ameaças - Issue #15)
- **Regras**: JSON da tela Regras filtrado por `visivelParaJogadores: true` (sem regras de ameaças - Issue #15)
- **Cartões "Para os jogadores"**: NPCs/lugares que o mestre liberou (Issue #5)
- **Rolagens do jogador**: `Roll[]` (histórico)
- **Interlúdios/histórico**: do arquivo do agente

### Para o Desktop (push do mobile → desktop)
- `EntityInput` com `sheetData: FichaAgente` (PV/PE/SAN atuais, condições, inventário equipado)
- `RollInput[]` (rolagens da sessão)
- **Anotações do jogador** (arquivo do agente - Issue #5)
- **Fila offline**: ações pendentes quando sem conexão (Issue #2)

---

## Sync WiFi Local - Especificação (Issue #2, #3)

### Arquitetura
```
┌─────────────────┐     HTTPS/WSS      ┌─────────────────┐
│   Celular       │ ◄─────────────────► │  PC do Mestre   │
│   (PWA)         │   Sync em tempo    │  (Electron)     │
│   op-sqlite     │   real + fila      │  ws + DuckDNS   │
└─────────────────┘   offline          └─────────────────┘
```

### Protocolo (Issue #3)
- **Versionamento**: app e servidor trocam versão do protocolo; aviso se incompatível
- **Multi-campanha**: cada campanha no celular guarda próprio endereço + login
- **Multi-mestre**: um app junta campanhas de PCs diferentes

### Descoberta e Conexão
1. Mestre clica **"Abrir para jogadores"** no desktop
2. Desktop: sobe servidor HTTPS (DuckDNS) + WebSocket; mostra **QR code** com URL + token
3. Jogador: abre PWA (GitHub Pages) → escaneia QR → login usuário/senha
4. Desktop: valida, envia apenas dados liberados para aquele jogador
5. Conexão mantida: **sync em tempo real** (Issue #2: "sincronização em tempo real quando conectado")
6. Offline: ações na fila local → sobem ao reconectar (sem duplicar/perder)

### Segurança (Issue #2)
- **Filtro no servidor**: celular NUNCA recebe campo não liberado (teste automatizado)
- **HTTPS obrigatório**: DuckDNS + assistente no Magistrado (2 min uma vez)
- **Tailscale opcional**: para jogar fora da Wi-Fi do mestre
- **Usuário/senha**: jogador troca de celular sem novo QR

---

## Banco Local no Mobile (Expo)

| Opção | Plataformas | Tamanho | Complexidade |
|-------|-------------|---------|--------------|
| **op-sqlite** (recomendado) | iOS, Android, Web (WASM) | ~500KB | Baixa - API SQLite padrão |
| **expo-sqlite** (legacy) | iOS, Android, Web | ~200KB | Baixa - deprecated |
| **Dexie.js** (IndexedDB) | Web apenas | ~50KB | Baixa - só PWA web |
| **WatermelonDB** | iOS, Android, Web | ~200KB | Média - ORM reativo |

**Recomendação:** `op-sqlite` (suporta tudo, API síncrona no native, async no web via WASM).

---

## Estrutura de Pastas (Mobile - Expo Router)

```
hermes-app-celular/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout + providers (auth, sync, theme)
│   ├── index.tsx                 # Home / Dashboard (campanhas do jogador)
│   ├── campanha/
│   │   ├── _layout.tsx           # Shell da campanha (tabs)
│   │   ├── index.tsx             # Resumo da campanha
│   │   ├── ficha/
│   │   │   ├── _layout.tsx       # Abas da ficha
│   │   │   ├── index.tsx         # Resumo (PV/PE/SAN, patente, NEX, carga)
│   │   │   ├── atributos.tsx     # Atributos + Perícias (treino/extra editável)
│   │   │   ├── inventario.tsx    # Lista, equipar/des equipar, espaços, categoria
│   │   │   ├── condicoes.tsx     # Checkboxes das 57 condições do livro
│   │   │   ├── ataques.tsx       # Ataques da ficha
│   │   │   ├── habilidades.tsx   # Habilidades/poderes
│   │   │   └── rituais.tsx       # Rituais da ficha
│   │   ├── rolagem/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Seletor: Teste | Ataque | Dano | Ritual | Iniciativa
│   │   │   ├── teste.tsx         # Seleciona perícia/atributo → rola d20
│   │   │   ├── ataque.tsx        # Seleciona ataque → rola d20 + dano
│   │   │   ├── dano.tsx          # Digita expressão '2d6+3' → rola
│   │   │   ├── ritual.tsx        # Seleciona ritual → teste + resistência
│   │   │   ├── iniciativa.tsx    # 1d20+AGI
│   │   │   └── historico.tsx     # Histórico local da sessão
│   │   ├── regras/
│   │   │   ├── _layout.tsx       # Sumário lateral fixo
│   │   │   ├── index.tsx         # Busca + capítulos
│   │   │   └── [capitulo].tsx    # Conteúdo com páginas do livro
│   │   ├── biblioteca/
│   │   │   ├── _layout.tsx       # Abas: Rituais | Itens
│   │   │   ├── rituais.tsx       # Filtra elemento/círculo; vê execução/alcance/alvo/dano
│   │   │   ├── itens.tsx         # Filtra tipo/categoria; vê dano/crítico/alcance/proficiência
│   │   │   ├── busca.tsx         # Busca unificada nome/texto
│   │   │   └── [id].tsx          # Detalhe completo
│   │   ├── arquivo/              # Issue #5 - Arquivo do Agente
│   │   │   ├── _layout.tsx       # Tabs: Pessoas | Lugares | Anotações | Histórico
│   │   │   ├── pessoas.tsx       # Cartões "Para os jogadores" NPCs
│   │   │   ├── lugares.tsx       # Cartões "Para os jogadores" Locais
│   │   │   ├── anotacoes.tsx     # Anotações livres do jogador (sobrevivem a updates)
│   │   │   └── historico.tsx     # Versões antigas dos cartões + interlúdios
│   │   └── sync.tsx              # Status conexão, botão sincronizar, fila offline
│   ├── login.tsx                 # Login usuário/senha + QR code scanner
│   └── settings.tsx              # Campanhas salvas, versões, logout
├── shared/                       # Symlink para ../app/src/shared (ou copy)
│   ├── ordem/
│   ├── types.ts
│   └── ...
├── src/
│   ├── db/                       # op-sqlite schema + migrations
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── index.ts
│   ├── api/                      # HTTP/WS client + sync logic
│   │   ├── client.ts             # fetch + WS wrapper
│   │   ├── sync.ts               # Pull/push + fila offline + conflitos
│   │   └── protocol.ts           # Versionamento + tipos de mensagem
│   ├── hooks/                    # React hooks
│   │   ├── useFicha.ts
│   │   ├── useRolagens.ts
│   │   ├── useBiblioteca.ts
│   │   ├── useRegras.ts
│   │   ├── useArquivo.ts
│   │   ├── useSync.ts
│   │   └── useAuth.ts
│   ├── components/               # UI components
│   │   ├── ui/                   # Button, Card, Input, Select, Checkbox, Modal
│   │   ├── ficha/                # PVPECard, AtributoRow, PericiaRow, ItemCard
│   │   ├── rolagem/              # DiceRoller, DiceInput, ResultadoCard
│   │   ├── biblioteca/           # RitualCard, ItemCard, Filtros
│   │   ├── arquivo/              # CartaoNPC, CartaoLocal, AnotacaoEditor
│   │   └── sync/                 # StatusBadge, QRScanner, FilaOffline
│   ├── theme/                    # Cores, espaçamento, tipografia
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── cssVars.ts            # Para compartilhar com desktop se possível
│   └── utils/
│       ├── dice.ts               # Wrappers de regras.ts para UI
│       ├── storage.ts            # AsyncStorage wrappers
│       └── network.ts            # Detecção online/offline
├── assets/                       # Ícones, splash, fontes
├── package.json
├── app.json / expo.config.js
├── tsconfig.json
├── metro.config.js
└── eas.json                      # Para build nativo futuro
```

---

## PWA Checklist (Expo + GitHub Pages - Issue #3)
- [ ] `expo.web.output: 'static'` para export estático
- [ ] `expo.pwa.manifest` configurado (name, icons, start_url, display: 'standalone')
- [ ] Service Worker automático (`expo-service-worker` ou Workbox)
- [ ] Ícones: 192x192, 512x512, maskable
- [ ] Splash screen
- [ ] `theme-color` no HTML
- [ ] Offline-first: cache `regras.json`, biblioteca, ficha, cartões
- [ ] `beforeinstallprompt` handling
- [ ] **Deploy GitHub Pages**: `gh-pages` branch ou GitHub Actions
- [ ] **Teste iOS Safari + Android Chrome** (Issue #3: "metade usa iPhone")

---

## Desktop Changes Necessários (Issue #2)
1. **Servidor HTTPS + WebSocket** em `main/` (porta configurável, ex: 3443)
2. **Certificado DuckDNS**: assistente no app (subdomínio + token + teste)
3. **Botão "Abrir para jogadores"** → sobe servidor + mostra QR code
4. **API de autenticação**: usuários/senha por campanha (bcrypt + JWT/session)
5. **API de pull filtrada**: só dados liberados para aquele `userId`
   - Ficha do agente (com `sheetData`)
   - Rituais/Itens liberados (NÃO ameaças)
   - Regras com `visivelParaJogadores: true`
   - Cartões "Para os jogadores" de NPCs/lugares conhecidos
6. **API de push**: recebe `EntityInput` (PV/PE/SAN, condições, inventário) + `RollInput[]` + anotações
7. **Fila offline no servidor**: reordena/merge ao reconectar (sem duplicar)
8. **Versionamento de protocolo**: header `X-Protocol-Version` em toda request
9. **Logs de auditoria**: o que foi enviado para cada jogador (para debug)

---

## Estimativa de Esforço (1 semana = ~5 dias úteis)

| Fase | Descrição | Dias | Paralelizável? | Prioridade |
|------|-----------|------|----------------|------------|
| 1 | Setup Expo + PWA + GitHub Pages deploy | 1 | Não | **MVP** |
| 2 | DB local (op-sqlite) + Schema (ficha, biblioteca, regras, arquivo, sync) | 0.5 | Não | **MVP** |
| 3 | API client (HTTP/WS) + Auth (login/QR) + Sync engine (pull/push/fila) | 1 | Não | **MVP** |
| 4 | Tela Ficha (abas: Resumo, Atributos, Inventário, Condições) | 1 | Não | **MVP** |
| 5 | Tela Rolagem (Teste, Ataque, Dano, Ritual, Iniciativa, Histórico) | 0.5 | Sim (c/ Ficha) | **MVP** |
| 6 | Tela Regras (sumário lateral, busca, páginas livro) | 0.5 | Sim (c/ Ficha) | **MVP** |
| 7 | Tela Biblioteca (Rituais/Itens com filtros + busca) | 0.5 | Sim | Pós-MVP |
| 8 | Tela Arquivo (Pessoas, Lugares, Anotações, Histórico) | 0.5 | Sim | Pós-MVP |
| 9 | Desktop: Servidor HTTPS/WS + DuckDNS + QR + Filtro liberado | 1.5 | Não | **MVP** |
| 10 | Integração ponta-a-ponta + Testes offline + Polimento PWA | 1 | Não | **MVP** |
| **Total** | | **~8** | | Buffer: cortar 7,8 para MVP |

**MVP (4-5 dias):** Fases 1-6 + 9,10 → Ficha + Rolagem + Regras + Sync WiFi funcionando offline + PWA instalável
**Completo (1 semana):** + Fases 7,8 → Biblioteca + Arquivo do Agente

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Expo + Electron sharing `shared/` paths | Symlink `shared/` no mobile → `../app/src/shared`; testar build web cedo |
| SQLite no Expo Web (PWA) | `op-sqlite` suporta web via WASM; fallback: IndexedDB (Dexie) se travar |
| HTTPS no desktop (DuckDNS) | Assistente no app; testar com `localhost` + `mkcert` primeiro |
| Descoberta WiFi no navegador | QR code com URL completa (HTTPS + token); sem mDNS |
| Sync tempo real + offline | WebSocket com reconexão automática; fila local com timestamps + ID único |
| iOS Safari PWA quirks | Testar no device real desde dia 1; `apple-mobile-web-app-*` meta tags |
| Prazo 1 semana | MVP = Fases 1-6,9,10; Biblioteca e Arquivo = pós-MVP |