// Clica na fatia vertical de ponta a ponta e salva capturas para o /replica-diff.
//   npm run build && node e2e/slice.mjs
// Usa pastas temporárias: não toca nas suas campanhas nem nas configurações do app.
import { strFromU8, unzipSync } from 'fflate'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = join(here, '..')
const shots = join(appDir, '..', 'replica', 'clone-screens')
mkdirSync(shots, { recursive: true })
const tmp = mkdtempSync(join(tmpdir(), 'magistrado-e2e-'))

// Imagem de teste feita aqui mesmo: um PNG liso com uma faixa, sem depender de arquivo de fora.
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function png(width, height) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const rows = []
  for (let y = 0; y < height; y++) {
    const row = [0]
    for (let x = 0; x < width; x++) row.push(...(y > height * 0.45 && y < height * 0.55 ? [120, 30, 30] : [214, 196, 160]))
    rows.push(Buffer.from(row))
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ])
}
const keyImage = join(tmp, 'chave de latão.png')
writeFileSync(keyImage, png(160, 120))

/** PDF de verdade, com N páginas e o número escrito em cada uma (xref com offsets certos). */
function pdf(pages) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`]
  pages.forEach((text, i) => {
    const stream = `BT /F1 36 Tf 72 700 Td (${text}) Tj ET`
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> >>`)
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
const adventurePdf = join(tmp, 'O Hospital Esquecido.pdf')
writeFileSync(adventurePdf, pdf(['Capa', 'Pagina 2: a ala fechada', 'Pagina 3: o porao']))
const cultistToken = join(tmp, 'token-cultista.png')
writeFileSync(cultistToken, png(64, 64))
const hospitalMap = join(tmp, 'planta do hospital.png')
writeFileSync(hospitalMap, png(200, 140))

const results = []
/** Espera o campo chegar ao valor (o editor pode já estar aberto com o item anterior). */
const hasValue = async (locator, value, timeout = 5000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if ((await locator.inputValue().catch(() => null)) === value) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return false
}
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const app = await electron.launch({
  args: [appDir],
  env: { ...process.env, MAGISTRADO_USER_DATA: join(tmp, 'user'), MAGISTRADO_CAMPAIGNS_DIR: join(tmp, 'campanhas'), MAGISTRADO_BACKUP_DIR: join(tmp, 'backups') }
})
const errors = []
try {
  const page = await app.firstWindow()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1360, height: 768 })
  const shot = (name) => page.screenshot({ path: join(shots, `${name}.png`) })

  // Biblioteca vazia
  await page.getByRole('heading', { name: 'Campanhas' }).waitFor()
  check('biblioteca vazia mostra o estado vazio', await page.getByText('Nenhuma campanha ainda').isVisible())
  await shot('S01-biblioteca-vazia')

  // Diálogo de nova campanha: dia da semana da data do caso
  await page.getByRole('button', { name: 'Nova campanha' }).first().click()
  await page.getByLabel('Data do caso').fill('2026-07-22')
  check('nova campanha mostra o dia da semana', await page.getByText('Cai numa quarta.').isVisible())
  await shot('S15-nova-campanha')
  await page.keyboard.press('Escape')

  // Campanha de exemplo
  await page.getByRole('button', { name: 'Campanha de exemplo' }).click()
  await page.getByRole('navigation', { name: 'Principal' }).waitFor()
  check('relógio mostra a data do caso', await page.getByText('qua 22/07 · 19h00').isVisible())
  await page.getByText('Próximas cenas').waitFor()
  await page.waitForTimeout(300)
  await shot('S01-inicio')

  // Fichas
  await page.getByRole('link', { name: 'Fichas' }).click()
  await page.getByText('Dr. Aurélio Bastos').waitFor()
  check('lista de personagens mostra PJs e NPCs', (await page.getByText('PJ', { exact: true }).count()) === 2)
  await shot('S03-fichas')

  await page.getByText('Dr. Aurélio Bastos').click()
  await page.getByRole('heading', { name: 'Aparece em' }).waitFor()
  await page.getByRole('link', { name: /Ala fechada/ }).waitFor()
  check('ficha do NPC lista a cena em que ele aparece', true)
  check('ficha tem os campos de Ordem Paranormal', await page.getByText('Ficha · Ordem Paranormal').isVisible())
  await shot('S04-ficha-npc')

  // Cena com menções
  await page.getByRole('link', { name: /Ala fechada/ }).click()
  await page.locator('.mention').first().waitFor()
  const mentionCount = await page.locator('.mention').count()
  check('texto da cena sublinha NPC e ameaça', mentionCount >= 2, `${mentionCount} menções`)
  await shot('S05-cena')

  // Criar NPC pela busca (Ctrl+K), só teclado
  await page.keyboard.press('Control+k')
  await page.keyboard.type('Enfermeiro Caio')
  await page.getByRole('option', { name: /Personagem «Enfermeiro Caio»/ }).waitFor()
  await page.getByRole('option', { name: /Personagem «Enfermeiro Caio»/ }).click()
  await page.getByLabel('Nome', { exact: true }).waitFor()
  check('NPC criado pela busca já vem com o nome', (await page.getByLabel('Nome', { exact: true }).inputValue()) === 'Enfermeiro Caio')
  await page.getByText('Salvo').waitFor({ timeout: 5000 }).catch(() => {})

  // Escrever o nome numa cena: a ligação aparece sozinha
  await page.getByRole('link', { name: 'Cenas' }).click()
  await page.getByRole('link', { name: /Ala fechada/ }).click()
  const editor = page.getByRole('textbox', { name: /Texto da cena/ })
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('O enfermeiro Caio sumiu no domingo.')
  await page.waitForTimeout(1200) // autosave com debounce
  check('nome novo vira menção no editor', (await page.locator('.mention', { hasText: 'enfermeiro Caio' }).count()) === 1)
  await page.getByRole('link', { name: 'Enfermeiro Caio' }).waitFor({ timeout: 5000 })
  check('cena lista o NPC novo em "Fichas nesta cena"', true)

  // Menu "/": encontra fichas e transforma o bloco sem tirar o foco do editor.
  await page.keyboard.press('Enter')
  await page.keyboard.type('/aure')
  await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).waitFor()
  await page.keyboard.press('Enter')
  check('menu / insere a ficha selecionada', (await editor.innerText()).includes('Dr. Aurélio Bastos'))
  await page.keyboard.press('Enter')
  await page.keyboard.type('/título')
  await page.getByRole('option', { name: 'Título', exact: true }).click()
  check('menu / formata o bloco como título', (await editor.locator('h2').count()) >= 1)

  // Hora no jogo: fim antes do início é recusado
  await page.getByLabel('Termina: hora').fill('22:00')
  check('fim antes do início mostra erro', await page.getByText('O fim não pode ser antes do início.').isVisible())
  await page.getByLabel('Termina: hora').fill('23:59')

  // Busca sem acento
  await page.keyboard.press('Control+k')
  await page.keyboard.type('aurel')
  await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).first().waitFor()
  const options = await page.getByRole('option').allInnerTexts()
  check('busca "aurel" acha Dr. Aurélio primeiro', options[0]?.startsWith('Dr. Aurélio Bastos'))
  check('busca também acha a cena que cita o nome', options.some((o) => o.startsWith('Ala fechada')))
  await shot('S11-busca')
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'Aparece em' }).waitFor()
  check('Enter na busca abre a ficha', (await page.getByLabel('Nome', { exact: true }).inputValue()) === 'Dr. Aurélio Bastos')

  // Ficha do NPC novo: aparece em Ala fechada (refeito no processo principal)
  await page.keyboard.press('Control+k')
  await page.keyboard.type('caio')
  await page.getByRole('option', { name: /Enfermeiro Caio/ }).first().click()
  await page.getByRole('link', { name: /Ala fechada/ }).waitFor({ timeout: 5000 })
  check('ficha nova mostra "Aparece em: Ala fechada"', true)

  // Linha do tempo: lacunas, relógio, eventos
  await page.getByRole('link', { name: 'Linha do tempo' }).click()
  await page.getByText('Agora no jogo', { exact: true }).waitFor()
  await page.getByText('3h10 sem nada marcado').waitFor({ timeout: 5000 })
  check('linha do tempo mostra a lacuna entre as cenas', true)
  check('linha do tempo inclui o evento antes do caso', await page.getByText('domingo, 19/07').isVisible())
  check('relógio mostra o próximo evento com contagem', await page.getByText('em 5h', { exact: true }).isVisible())

  await page.getByRole('button', { name: 'Até a próxima cena' }).click()
  await page.getByText('qua 22/07 · 23h10').waitFor({ timeout: 3000 })
  check('"até a próxima cena" pula o relógio para 23h10', true)
  await page.locator('body').click({ position: { x: 5, y: 700 } })
  await page.keyboard.press('Alt+ArrowRight')
  await page.getByText('qua 22/07 · 23h20').waitFor({ timeout: 3000 })
  check('Alt+→ avança 10 minutos', true)
  await page.keyboard.press('Alt+Shift+ArrowRight')
  await page.getByRole('button', { name: '+1 h' }).first().click()
  await page.getByText('qui 23/07 · 01h20').waitFor({ timeout: 3000 })
  check('relógio vira a meia-noite e o dia da semana', true)
  check('evento que passou sem resolução fica marcado', await page.getByText('1 evento passou sem resolução').isVisible())

  await page.getByRole('button', { name: /A Vigia cruza a porta da ala/ }).click()
  await page.getByLabel('Situação').selectOption('evitado')
  const resolved = await page.getByText('1 evento passou sem resolução').waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false)
  check('marcar o evento como evitado tira o alerta', resolved)
  await page.getByRole('button', { name: 'Fechar o evento' }).click()

  await page.getByRole('button', { name: 'Evento aqui' }).nth(1).click()
  await page.getByLabel('Título do evento').fill('Agentes interrogam o porteiro do Hospital Santa Clara')
  await page.getByRole('complementary', { name: 'Evento' }).getByRole('link', { name: /Hospital Santa Clara/ }).waitFor({ timeout: 5000 })
  check('evento criado na lacuna liga a ficha citada no título', true)
  check('evento criado no passado já vem como "aconteceu"', (await page.getByLabel('Situação').inputValue()) === 'aconteceu')
  await shot('N02-linha-do-tempo')

  await page.getByRole('button', { name: 'Calendário' }).click()
  const day23 = page.getByRole('button', { name: '23 de julho: 0 cenas, 2 eventos' })
  check('calendário conta cenas e eventos por dia', await day23.waitFor({ timeout: 5000 }).then(() => true, () => false))
  await shot('N02-calendario')
  await day23.click()
  const backToList = await page.getByRole('list', { name: 'Linha do tempo' }).waitFor({ timeout: 5000 }).then(() => true, () => false)
  check('clicar no dia volta para a lista', backToList)

  await page.keyboard.press('Control+k')
  await page.keyboard.type('caldeira')
  await page.getByRole('option', { name: /O diretor queima o livro de ponto/ }).waitFor()
  await page.keyboard.press('Enter')
  await page.getByLabel('Título do evento').waitFor()
  check('busca acha o evento pela descrição e abre o editor', await hasValue(page.getByLabel('Título do evento'), 'O diretor queima o livro de ponto'))

  // Pistas: portfólio, imagem, achada agora, sessão nova
  await page.getByRole('link', { name: 'Pistas' }).click()
  await page.getByText('Cópia do livro de ponto').waitFor()
  const cards = page.getByRole('list', { name: 'Pistas' }).getByRole('listitem')
  check('portfólio mostra as 3 pistas', (await cards.count()) === 3)
  const firstCard = page.getByRole('button', { name: /Cópia do livro de ponto/ })
  check('pista achada mostra hora no jogo e sessão', /qua 22\/07 · 19h40\s*Sessão 1/.test(await firstCard.innerText()))
  await page.getByRole('button', { name: /^Achadas/ }).click()
  check('filtro "Achadas" deixa só a achada', (await cards.count()) === 1)
  await page.getByRole('button', { name: /^Todas/ }).click()
  await shot('N01-pistas')

  await page.getByRole('button', { name: /Chave da ala fechada/ }).click()
  await page.getByLabel('Título da pista').waitFor()
  check('"o que revela" fica escondido até pedir', (await page.getByLabel('O que revela').count()) === 0)
  await page.getByRole('button', { name: 'O que ela revela (só você)' }).click()
  check('botão mostra o que a pista revela', (await page.getByLabel('O que revela').inputValue()).startsWith('O diretor entra'))

  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, keyImage)
  await page.getByRole('button', { name: 'Escolher imagem' }).click()
  const editorImg = page.getByRole('complementary', { name: 'Pista' }).getByRole('img', { name: 'Chave da ala fechada' })
  await editorImg.waitFor({ timeout: 5000 })
  const loadedImg = await editorImg.evaluate((img) => img.complete && img.naturalWidth === 160)
  check('imagem importada aparece pelo protocolo magistrado://', loadedImg)

  await page.getByRole('button', { name: 'Achada agora' }).click()
  await page.getByLabel('Tomás Andrade').check()
  await page.getByLabel('Sessão', { exact: true }).last().selectOption('__new')
  await page.getByRole('option', { name: /^Sessão 2/ }).first().waitFor({ state: 'attached', timeout: 5000 })
  await page.getByText('Salvo').last().waitFor({ timeout: 5000 })
  await page.waitForTimeout(900)
  const keyCard = page.getByRole('list', { name: 'Pistas' }).getByRole('button', { name: /Chave da ala fechada/ })
  check('achada agora usa a hora do relógio e a sessão nova', /qui 23\/07 · 01h20\s*Sessão 2/.test(await keyCard.innerText()))
  check('cartão mostra a imagem nova', await page.getByRole('list', { name: 'Pistas' }).getByRole('img', { name: 'Chave da ala fechada' }).isVisible())
  check('contagem de achadas sobe para 2', (await page.getByRole('button', { name: /^Achadas/ }).innerText()).includes('2'))
  await shot('N01-pista-editor')

  await page.keyboard.press('Control+k')
  await page.keyboard.type('arranhoes')
  await page.getByRole('option', { name: /Arranhões na porta da ala/ }).waitFor()
  await page.keyboard.press('Enter')
  await page.getByLabel('Título da pista').waitFor()
  check('busca sem acento acha a pista e abre o editor', await hasValue(page.getByLabel('Título da pista'), 'Arranhões na porta da ala'))

  // Quadro (canvas): exemplo, card, ficha, ligar, desfazer, arranjar, salvar
  await page.getByRole('link', { name: 'Quadros' }).click()
  const flowNodes = page.locator('.react-flow__node')
  const flowEdges = page.locator('.react-flow__edge')
  await flowNodes.nth(6).waitFor({ timeout: 5000 })
  check('quadro de exemplo abre com 7 itens e 6 ligações', (await flowNodes.count()) === 7 && (await flowEdges.count()) === 6)
  check('ligação mostra o rótulo', await page.locator('.react-flow__edge-text', { hasText: 'suspeito' }).isVisible())
  check('nó de pista mostra a imagem da pista', await page.locator('.react-flow__node-clue img[alt="Chave da ala fechada"]').isVisible())

  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await page.getByLabel('Escreva no card').last().fill('Por que o diretor mente?')
  await page.getByRole('button', { name: 'Ficha', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Filtrar').fill('lia')
  await page.keyboard.press('Enter')
  const liaNode = page.locator('.react-flow__node', { hasText: 'Lia Moraes' })
  await liaNode.waitFor()
  check('ficha escolhida entra no quadro', (await flowNodes.count()) === 9)

  const dragTo = async (from, to) => {
    const a = await from.boundingBox()
    const b = await to.boundingBox()
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
    await page.mouse.up()
  }
  const cardNode = page.locator('.react-flow__node-card', { has: page.locator('textarea') }).last()
  await liaNode.hover()
  await dragTo(liaNode.locator('.react-flow__handle-right'), cardNode.locator('.react-flow__handle-left'))
  await page.waitForTimeout(200)
  check('arrastar de uma alça a outra cria a ligação', (await flowEdges.count()) === 7)

  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 500 } })
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(100)
  const undone = await flowEdges.count()
  await page.keyboard.press('Control+y')
  await page.waitForTimeout(100)
  check('Ctrl+Z desfaz a ligação e Ctrl+Y refaz', undone === 6 && (await flowEdges.count()) === 7)

  await liaNode.click()
  await page.keyboard.press('Delete')
  await page.waitForTimeout(100)
  const afterDelete = await flowNodes.count()
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(100)
  check('Delete tira o item e Ctrl+Z traz de volta', afterDelete === 8 && (await flowNodes.count()) === 9)

  const before = await flowNodes.first().getAttribute('style')
  await page.getByRole('button', { name: 'Arranjar' }).click()
  await page.waitForTimeout(600)
  check('Arranjar reorganiza o quadro', (await flowNodes.first().getAttribute('style')) !== before)

  await page.getByLabel('Nome do quadro').fill('Mapa do hospital')
  await page.locator('.react-flow__pane').click({ position: { x: 600, y: 500 } })
  await page.getByRole('complementary', { name: 'Quadros' }).getByRole('link', { name: /Mapa do hospital/ }).waitFor({ timeout: 5000 })
  check('renomear o quadro atualiza a lista', true)
  await page.waitForTimeout(1200) // autosave
  await shot('S06-quadro')

  await page.getByRole('link', { name: 'Fichas' }).click()
  await page.getByRole('link', { name: 'Quadros' }).click()
  await flowNodes.nth(8).waitFor({ timeout: 5000 })
  const cardText = await page.getByLabel('Escreva no card').evaluateAll((els) => els.map((e) => e.value))
  check('quadro volta salvo: itens, ligações e texto do card', (await flowNodes.count()) === 9 && (await flowEdges.count()) === 7 && cardText.includes('Por que o diretor mente?'))

  await page.getByRole('button', { name: 'Novo quadro' }).click()
  check('quadro novo mostra o estado vazio', await page.getByText('Quadro vazio').waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Ficha: atributos próprios e retrato (o diálogo de arquivo continua simulado com a imagem de teste)
  await page.keyboard.press('Control+k')
  await page.keyboard.type('aurelio')
  await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).first().waitFor()
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: 'Seus atributos' }).waitFor()
  check('ficha mostra os atributos próprios', (await page.getByLabel('Nome do atributo 1').inputValue()) === 'Deve favor a')
  await page.getByRole('button', { name: 'Adicionar atributo' }).click()
  await page.getByLabel('Nome do atributo 3').fill('Arma')
  await page.getByLabel('Valor de Arma').fill('bisturi')
  await page.getByRole('button', { name: 'Escolher um retrato' }).click()
  await page.getByRole('button', { name: 'Trocar o retrato' }).waitFor({ timeout: 5000 })
  await page.getByText('Salvo').waitFor({ timeout: 5000 })
  await page.waitForTimeout(800)
  await shot('S04-ficha-npc')
  await page.keyboard.press('Control+k')
  await page.keyboard.type('bisturi')
  check('busca acha a ficha pelo atributo próprio', await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).first().waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Fichas' }).click()
  await page.getByText('Dr. Aurélio Bastos').waitFor()
  check('lista de fichas mostra o retrato', (await page.locator('img[src^="magistrado://anexo/"]').count()) >= 1)

  // Ficha completa (T6): o agente abre nela; os derivados recalculam; o NPC vira vilão e volta
  const waitAttr = (loc, name, value) =>
    loc.evaluate(
      (el, [n, v]) =>
        new Promise((ok) => {
          const t0 = Date.now()
          const tick = () => (el.getAttribute(n) === v || Date.now() - t0 > 5000 ? ok(el.getAttribute(n) === v) : setTimeout(tick, 50))
          tick()
        }),
      [name, value]
    )
  await page.getByText('Lia Moraes').first().click()
  await page.getByRole('list', { name: 'Lista de perícias' }).waitFor()
  check('agente abre direto na ficha completa', (await page.getByRole('button', { name: 'Usar ficha completa' }).count()) === 0)
  const vida = page.getByRole('meter', { name: 'Vida' })
  check('PV máximo vem da classe e do NEX', (await vida.getAttribute('aria-valuemax')) === '19', await vida.getAttribute('aria-valuemax'))
  check('PV atual veio da ficha compacta', (await page.getByLabel('Vida atual').inputValue()) === '14')
  await page.getByLabel('Vigor', { exact: true }).fill('2')
  check('mudar o Vigor recalcula o PV máximo', await waitAttr(vida, 'aria-valuemax', '22'))
  await page.getByRole('tab', { name: 'Só treinadas' }).click()
  check('"Só treinadas" esconde as destreinadas', await page.getByText('Nenhuma perícia encontrada.').isVisible())
  await page.getByRole('tab', { name: 'Todas' }).click()
  await page.getByLabel('Buscar perícias').fill('ocult')
  check('busca de perícias filtra a lista', (await page.getByRole('list', { name: 'Lista de perícias' }).getByRole('listitem').count()) === 1)
  await page.getByLabel('Treino em Ocultismo').selectOption('5')
  check('treino soma no total da perícia', (await page.getByLabel('Total de Ocultismo').innerText()) === '+5')
  await page.getByRole('tab', { name: 'Combate' }).click()
  check('aba Combate mostra a Defesa', await page.getByText('Defesa: ').isVisible())
  await page.getByText('Salvo').waitFor({ timeout: 5000 })
  await page.getByLabel('Buscar perícias').fill('')
  await page.getByLabel('Nome', { exact: true }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot('S05-ficha-completa')
  await page.getByRole('link', { name: 'Fichas' }).click()
  await page.getByText('Lia Moraes').first().click()
  await page.getByRole('list', { name: 'Lista de perícias' }).waitFor()
  check('ficha completa volta salva', (await page.getByLabel('Vigor', { exact: true }).inputValue()) === '2' && (await page.getByLabel('Treino em Ocultismo').inputValue()) === '5')

  // Rolagem (T7): agente abre em "digitar"; teste pede só o d20 que ficou; dano sai por tipo; desfazer
  const fisicos = page.getByLabel('Rola dados físicos')
  check('agente começa rolando dados físicos', await fisicos.isChecked())
  await page.getByRole('button', { name: 'Rolar teste de Vigor' }).click()
  let janela = page.getByRole('dialog')
  await janela.waitFor()
  check('janela abre em "digitar"', (await janela.getByRole('button', { name: 'Digitar dados físicos' }).getAttribute('aria-pressed')) === 'true')
  await janela.getByLabel('Maior d20').fill('25')
  check('d20 acima de 20 é recusado', (await janela.getByLabel('Maior d20').getAttribute('aria-invalid')) === 'true' && (await janela.getByRole('button', { name: 'Registrar' }).isDisabled()))
  await janela.getByLabel('Maior d20').fill('17')
  await janela.getByRole('button', { name: 'Registrar' }).click()
  check('teste digitado registra o total', (await janela.getByRole('status', { name: 'Resultado' }).innerText()).startsWith('17'))
  await janela.getByRole('button', { name: 'Pronto' }).click()

  await page.getByRole('tab', { name: 'Combate' }).click()
  await page.getByRole('button', { name: 'Ataque', exact: true }).click()
  await page.getByRole('button', { name: 'Outro tipo de dano' }).click()
  await page.getByLabel('Dano extra').fill('2d6')
  await page.getByLabel('Tipo do extra').selectOption('Energia')
  await page.getByRole('button', { name: 'Pronto' }).click()
  await page.getByRole('button', { name: 'Rolar dano de Novo ataque' }).click()
  janela = page.getByRole('dialog')
  await janela.getByLabel('Soma de Impacto').fill('9')
  check('soma fora da faixa dos dados é recusada', (await janela.getByLabel('Soma de Impacto').getAttribute('aria-invalid')) === 'true')
  await janela.getByLabel('Soma de Impacto').fill('4')
  await janela.getByLabel('Soma de Energia').fill('7')
  await janela.getByRole('button', { name: 'Registrar' }).click()
  const danoTxt = await janela.getByRole('status', { name: 'Resultado' }).innerText()
  check('dano sai separado por tipo', /Impacto/.test(danoTxt) && /7\s*Energia/.test(danoTxt), danoTxt.replace(/\s+/g, ' '))
  await shot('S05-rolagem-dano')
  await janela.getByRole('button', { name: 'Pronto' }).click()

  await page.getByRole('button', { name: 'Rolar teste de Agilidade' }).click()
  janela = page.getByRole('dialog')
  await janela.getByRole('button', { name: 'O Magistrado rola' }).click()
  await janela.getByRole('button', { name: /^Rolar \dd20/ }).click()
  check('o Magistrado rola o teste', await janela.getByRole('status', { name: 'Resultado' }).isVisible())
  await janela.getByRole('button', { name: 'Desfazer Agilidade' }).click()
  check('desfazer na janela tira a rolagem', (await janela.getByRole('list', { name: 'Registradas' }).count()) === 0)
  await janela.getByRole('button', { name: 'Fechar' }).last().click()

  await page.getByRole('tab', { name: 'Histórico' }).click()
  const historico = page.getByRole('list', { name: 'Rolagens' }).getByRole('listitem')
  await historico.first().waitFor()
  check('rolagens aparecem no histórico da ficha', (await historico.count()) === 2, String(await historico.count()))
  await page.getByRole('button', { name: 'Desfazer Vigor' }).click()
  await page.waitForTimeout(300)
  check('desfazer no histórico apaga a rolagem', (await historico.count()) === 1)
  await fisicos.uncheck()
  await page.getByRole('button', { name: 'Rolar teste de Vigor' }).click()
  janela = page.getByRole('dialog')
  check('sem a caixa, a janela abre com o Magistrado rolando', (await janela.getByRole('button', { name: 'O Magistrado rola' }).getAttribute('aria-pressed')) === 'true')
  await page.keyboard.press('Escape')
  await fisicos.check()
  await page.getByText('Salvo').waitFor({ timeout: 5000 })

  await page.getByRole('link', { name: 'Fichas' }).click()
  await page.getByText('Dr. Aurélio Bastos').first().click()
  await page.getByRole('button', { name: 'Usar ficha completa' }).click()
  await page.getByRole('list', { name: 'Lista de perícias' }).waitFor({ timeout: 5000 })
  check('NPC vira vilão com a ficha completa', true)
  check('classe da ficha compacta continua na completa', (await page.getByLabel('Classe').inputValue()) === 'Mundano')
  await page.getByRole('tab', { name: 'Notas' }).click()
  check('atributos próprios continuam na aba Notas', (await page.getByLabel('Nome do atributo 1').inputValue()) === 'Deve favor a')
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Voltar à ficha compacta' }).click()
  check('vilão volta à ficha compacta', await page.getByText('Ficha · Ordem Paranormal').waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Textos: página livre com menção e barra flutuante de formatação
  await page.getByRole('link', { name: 'Textos' }).click()
  await page.getByText('Nenhum texto ainda').waitFor()
  await page.getByRole('button', { name: 'Novo texto' }).last().click()
  await page.getByLabel('Título do texto').fill('Regras da casa')
  const docEditor = page.getByRole('textbox', { name: /^Texto Regras da casa/ })
  await docEditor.click()
  await page.keyboard.type('Sanidade a zero perto da Vigia: a cena para.')
  await page.locator('.mention', { hasText: 'Vigia' }).waitFor({ timeout: 5000 })
  check('texto livre liga a ficha citada', true)
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  const bar = page.getByRole('toolbar', { name: 'Formatação' })
  await bar.waitFor({ timeout: 3000 })
  await shot('S02-texto-barra')
  await bar.getByRole('button', { name: 'Negrito' }).click()
  check('barra flutuante aparece na seleção e aplica negrito', (await docEditor.locator('strong').count()) === 1)
  await page.getByRole('link', { name: 'A Vigia' }).waitFor({ timeout: 5000 })
  check('texto lista "Fichas neste texto"', true)

  // Lixeira: tirar, restaurar, apagar de vez
  await page.getByRole('button', { name: 'Mover para a lixeira' }).click()
  await page.getByText('Nenhum texto ainda').waitFor()
  await page.getByRole('link', { name: 'Lixeira' }).click()
  await page.getByRole('heading', { name: 'Lixeira', level: 1 }).waitFor()
  await page.getByText('Regras da casa', { exact: true }).waitFor()
  check('item tirado aparece na lixeira com o prazo', await page.getByText(/some em 60 dias/).first().isVisible())
  await shot('S14-lixeira')
  await page.getByRole('button', { name: 'Restaurar Regras da casa' }).click()
  await page.getByText('Lixeira vazia').waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: 'Textos' }).click()
  check('restaurar devolve o texto', await page.getByRole('link', { name: 'Regras da casa' }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Control+k')
  await page.keyboard.type('sanidade')
  check('texto restaurado volta para a busca', await page.getByRole('option', { name: /Regras da casa/ }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Regras da casa' }).click()
  await page.getByRole('button', { name: 'Mover para a lixeira' }).click()
  await page.getByText('Nenhum texto ainda').waitFor()
  await page.getByRole('link', { name: 'Lixeira' }).click()
  await page.getByRole('button', { name: 'Apagar Regras da casa de vez' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Apagar de vez' }).click()
  check('apagar de vez esvazia a lixeira', await page.getByText('Lixeira vazia').waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Início: capa e frase; biblioteca mostra as duas
  await page.getByRole('link', { name: 'Início' }).click()
  await page.getByLabel('Frase da campanha').fill('Um enfermeiro sumiu e ninguém deu queixa.')
  await page.getByRole('button', { name: 'Escolher capa' }).click()
  await page.getByRole('img', { name: /Capa de/ }).waitFor({ timeout: 5000 })
  await page.getByText('Salvo').waitFor({ timeout: 5000 })
  await page.waitForTimeout(800)
  await shot('S01-inicio')
  await page.getByRole('button', { name: 'Fechar campanha' }).click()
  await page.getByRole('heading', { name: 'Campanhas' }).waitFor()
  const libCard = page.getByRole('button', { name: /^Caso do Hospital/ })
  const libText = await libCard.innerText()
  check('biblioteca mostra frase, data do caso e contadores', libText.includes('Um enfermeiro sumiu') && libText.includes('caso: qua 22/07/2026') && /\d+ fichas · \d+ cenas · \d+ pistas/.test(libText))
  const coverOk = await libCard.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false)
  check('biblioteca mostra a capa da campanha fechada', coverOk)
  await shot('S01-biblioteca')
  await libCard.click()
  await page.getByRole('navigation', { name: 'Principal' }).waitFor()

  // Modelo Ordem Paranormal: campos do livro básico e de Sobrevivendo ao Horror
  await page.keyboard.press('Control+k')
  await page.keyboard.type('a vigia')
  await page.getByRole('option', { name: /A Vigia/ }).first().waitFor()
  await page.keyboard.press('Enter')
  check('ficha de ameaça tem tamanho e resistências do livro', await page.getByLabel('Tamanho').waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Control+k')
  // Agente abre na ficha completa (T6); a regra opcional é da ficha compacta, então vale para o NPC.
  await page.keyboard.type('aurelio')
  await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).first().waitFor()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Mostrar regras opcionais/ }).click()
  check('regra opcional de Determinação aparece quando pedida', await page.getByLabel('PD (Determinação) atual').isVisible())

  // Sessão: cena atual, PV à mão, pista achada, notas na busca
  await page.getByRole('link', { name: 'Sessão' }).click()
  await page.getByRole('heading', { name: 'Cena atual' }).waitFor()
  check('sessão abre na última sessão', (await page.getByLabel('Sessão', { exact: true }).locator('option:checked').innerText()).startsWith('Sessão 2'))
  check('cena atual é escolhida pela hora do jogo', (await page.getByLabel('Escolher a cena').locator('option:checked').innerText()).includes('Ala fechada'))
  const aurelioPv = page.getByRole('group', { name: 'PV de Dr. Aurélio Bastos' })
  await aurelioPv.waitFor()
  await aurelioPv.getByRole('button', { name: 'Tirar 1 de PV' }).click()
  check('−1 PV no NPC durante a sessão', (await aurelioPv.innerText()).includes('17/24'))
  await page.getByRole('button', { name: 'Achada agora: Arranhões na porta da ala' }).click()
  const scratches = page.getByRole('list', { name: 'Pistas desta cena' }).getByRole('listitem').filter({ hasText: 'Arranhões na porta da ala' })
  check('pista marcada achada na tela de sessão', await scratches.getByRole('button', { name: /^Desfazer/ }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  check('a pista guarda a hora e a sessão', /qui 23\/07 · 01h20\s*sessão 2/.test(await scratches.innerText()))
  await page.getByRole('textbox', { name: 'Notas da sessão 2' }).click()
  await page.keyboard.type('Tomás Andrade arrombou a porta da ala.')
  await page.locator('.mention', { hasText: 'Tomás Andrade' }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(1200)
  await shot('N03-sessao')
  await page.keyboard.press('Control+k')
  await page.keyboard.type('arrombou')
  check('notas da sessão entram na busca', await page.getByRole('option', { name: /Sessão 2/ }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Começar sessão 3/ }).click()
  check('começar sessão nova troca as notas', await page.getByRole('heading', { name: 'Notas da sessão 3' }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Control+k')
  await page.keyboard.type('aurelio')
  await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).first().waitFor()
  await page.keyboard.press('Enter')
  check('PV mudado na sessão fica na ficha', await hasValue(page.getByLabel('PV atual'), '17'))

  // Backup: automático ao fechar, manual, cofre legível dentro do zip, restaurar como campanha nova
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await page.getByRole('heading', { name: 'Backup', exact: true }).waitFor()
  const backupItems = page.getByRole('list', { name: 'Backups' }).getByRole('listitem')
  check('fechar a campanha fez um backup automático', (await backupItems.filter({ hasText: 'automático' }).count()) >= 1)
  const beforeCount = await backupItems.count()
  await page.getByRole('button', { name: 'Fazer backup agora' }).click()
  await page.getByRole('status').filter({ hasText: 'Backup feito' }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  check('backup manual entra na lista', (await backupItems.count()) === beforeCount + 1)
  const manual = (await backupItems.allInnerTexts()).find((t) => !t.includes('automático'))?.split('\n')[0]
  const backupFile = join(tmp, 'backups', manual ?? '')
  const zip = unzipSync(readFileSync(backupFile))
  const aurelioMd = zip['legivel/Personagens/Dr. Aurélio Bastos.md'] ? strFromU8(zip['legivel/Personagens/Dr. Aurélio Bastos.md']) : ''
  check('zip tem o cofre do Obsidian com a ficha atualizada', aurelioMd.includes('**PV:** 17/24'))
  check('zip tem banco, json e a imagem da pista', !!zip['campanha.sqlite'] && !!zip['campanha.json'] && Object.keys(zip).some((k) => k.startsWith('anexos/chave-de-latao-')))
  await shot('S17-ajustes')

  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, backupFile)
  await page.getByRole('button', { name: 'Restaurar um backup…' }).click()
  await page.getByText('(restaurada').first().waitFor({ timeout: 15000 }).catch(() => {})
  await page.getByRole('link', { name: 'Ajustes' }).click()
  check('backup restaurado abre como campanha nova', (await page.getByText(/\(restaurada \d{4}-\d{2}-\d{2}\)\.magistrado/).count()) >= 1)
  await page.keyboard.press('Control+k')
  await page.keyboard.type('arrombou')
  check('campanha restaurada tem as notas e a busca', await page.getByRole('option', { name: /Sessão 2/ }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')

  // Importar aventura: PDF + token (+ uma imagem repetida), ligar à cena na página, ficha a partir do token
  await app.evaluate(({ dialog }, files) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files })
  }, [adventurePdf, cultistToken, keyImage])
  await page.getByRole('link', { name: 'Arquivos' }).click()
  await page.getByRole('button', { name: 'Importar arquivos…' }).first().click()
  const importNote = page.getByRole('status').filter({ hasText: 'importados' })
  await importNote.waitFor({ timeout: 10000 })
  const noteText = await importNote.innerText()
  check('importa vários arquivos e avisa o repetido', noteText.includes('2 arquivos importados') && noteText.includes('1 já estava'), noteText)
  await page.getByRole('group', { name: 'Filtrar por tipo' }).getByRole('button', { name: /^Token/ }).click()
  const fileCards = page.getByRole('list', { name: 'Arquivos' }).getByRole('listitem')
  check('token é reconhecido pelo nome do arquivo', (await fileCards.count()) === 1 && (await fileCards.first().innerText()).includes('token-cultista.png'))
  await page.getByRole('group', { name: 'Filtrar por tipo' }).getByRole('button', { name: /^Todos/ }).click()
  await shot('S19-arquivos')

  await page.getByRole('button', { name: /O Hospital Esquecido\.pdf/ }).click()
  const fileSceneSelect = page.getByRole('complementary', { name: 'Arquivo' }).getByLabel('Cena', { exact: true })
  await fileSceneSelect.locator('option', { hasText: 'Ala fechada' }).waitFor({ state: 'attached' })
  const alaOption = (await fileSceneSelect.locator('option').allInnerTexts()).find((t) => t.includes('Ala fechada'))
  await fileSceneSelect.selectOption({ label: alaOption })
  await page.getByRole('complementary', { name: 'Arquivo' }).getByLabel('Página do PDF').fill('2')
  await page.getByRole('button', { name: 'Ligar à cena' }).click()
  await page.getByText('Ligado a Ala fechada.').waitFor({ timeout: 5000 })
  const usedIn = page.getByRole('complementary', { name: 'Arquivo' }).getByRole('link', { name: /Ala fechada/ })
  check('PDF ligado à cena na página 2 aparece em "Usado em"', (await usedIn.innerText()).includes('p. 2'))

  await page.getByRole('button', { name: /token-cultista\.png/ }).click()
  await page.getByLabel('Ficha nova de').selectOption('ameaca')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  check('token vira ficha de ameaça com retrato', await page.getByText('Ficha criada: cultista.').waitFor({ timeout: 5000 }).then(() => true, () => false))

  await page.getByRole('link', { name: 'Cenas' }).click()
  await page.getByRole('link', { name: /Ala fechada/ }).click()
  const pdfButton = page.getByRole('button', { name: 'Abrir O Hospital Esquecido.pdf na página 2' })
  await pdfButton.waitFor({ timeout: 5000 })
  await pdfButton.click()
  const frame = page.getByTitle('PDF O Hospital Esquecido.pdf')
  await frame.waitFor({ timeout: 5000 })
  const frameSrc = await frame.getAttribute('src')
  // A página não pode buscar magistrado:// (a CSP só deixa em <img> e <iframe>); quem confere é o processo principal.
  const served = await app.evaluate(async ({ net }, src) => {
    const r = await net.fetch(src.split('#')[0])
    return { type: r.headers.get('content-type'), head: (await r.text()).slice(0, 5) }
  }, frameSrc)
  check('abre o PDF da cena na página certa', frameSrc.endsWith('#page=2') && served.type === 'application/pdf' && served.head === '%PDF-', JSON.stringify(served))
  await page.waitForTimeout(1500)
  await shot('S05-cena-pdf')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Sessão' }).click()
  check('tela de sessão mostra o material da cena', await page.getByRole('button', { name: 'Abrir O Hospital Esquecido.pdf na página 2' }).waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Exportar: PDF pela busca, Word para os jogadores, pasta do Obsidian
  const outDir = join(tmp, 'exportados')
  mkdirSync(outDir, { recursive: true })
  const saveTo = (file) =>
    app.evaluate(({ dialog }, f) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: f })
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] })
    }, file)
  const exportDialog = page.getByRole('dialog', { name: 'Exportar a campanha' })
  await page.keyboard.press('Control+k')
  await page.getByRole('option', { name: 'Exportar campanha…' }).click()
  await exportDialog.waitFor()
  await shot('S18-exportar')
  await saveTo(join(outDir, 'caso.pdf'))
  await exportDialog.getByRole('button', { name: 'Exportar' }).click()
  await exportDialog.getByRole('status').waitFor({ timeout: 20000 })
  const pdf = readFileSync(join(outDir, 'caso.pdf'))
  check('exporta PDF de verdade', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 5000, `${pdf.length} bytes`)
  await exportDialog.getByRole('button', { name: 'Pronto' }).click()

  await page.getByRole('link', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Exportar a campanha…' }).click()
  await exportDialog.getByLabel('Word (.docx)').check()
  await exportDialog.getByLabel(/Para os jogadores/).check()
  await saveTo(join(outDir, 'jogadores.docx'))
  await exportDialog.getByRole('button', { name: 'Exportar' }).click()
  await exportDialog.getByRole('status').waitFor({ timeout: 20000 })
  const docXml = strFromU8(unzipSync(readFileSync(join(outDir, 'jogadores.docx')))['word/document.xml'])
  check('Word para os jogadores tem as pistas achadas e nenhum segredo', docXml.includes('Cópia do livro de ponto') && !docXml.includes('O que revela') && !docXml.includes('Personalidade e segredos'))
  await exportDialog.getByRole('button', { name: 'Pronto' }).click()

  await page.getByRole('button', { name: 'Exportar a campanha…' }).click()
  await exportDialog.getByLabel('Pasta do Obsidian').check()
  await saveTo(outDir)
  await exportDialog.getByRole('button', { name: 'Exportar' }).click()
  await exportDialog.getByRole('status').waitFor({ timeout: 20000 })
  const vault = join(outDir, 'Caso do Hospital (exemplo) (Obsidian)')
  check('pasta do Obsidian com textos, quadro e imagens', existsSync(join(vault, 'legivel', 'Linha do tempo.md')) && existsSync(join(vault, 'legivel', 'Quadros', 'Mapa do hospital.canvas')) && existsSync(join(vault, 'anexos')))
  await exportDialog.getByRole('button', { name: 'Pronto' }).click()

  // A busca não criou fichas por engano (Enter pegava o comando "criar" em vez do resultado)
  await page.getByRole('link', { name: 'Fichas' }).click()
  await page.getByText('Dr. Aurélio Bastos').waitFor()
  check('nenhuma ficha "aurel" criada por engano', (await page.getByText('aurel', { exact: true }).count()) === 0)

  // Lugar com mapa e notas da ficha (com menção)
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, hospitalMap)
  await page.keyboard.press('Control+k')
  await page.keyboard.type('santa clara')
  await page.getByRole('option', { name: /^Hospital Santa Clara/ }).filter({ hasText: 'Local' }).first().click()
  await page.getByRole('button', { name: 'Escolher mapa' }).click()
  check('lugar ganha mapa', await page.getByRole('img', { name: 'Mapa de Hospital Santa Clara' }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.getByRole('textbox', { name: 'Notas de Hospital Santa Clara' }).click()
  await page.keyboard.type('O Dr. Aurélio Bastos guarda a chave na sala da caldeira.')
  await page.locator('.mention', { hasText: 'Dr. Aurélio Bastos' }).last().waitFor({ timeout: 5000 })
  await page.getByText('Salvo').first().waitFor({ timeout: 5000 })
  await page.waitForTimeout(900)
  await page.keyboard.press('Control+k')
  await page.keyboard.type('aurelio')
  await page.getByRole('option', { name: /Dr\. Aurélio Bastos/ }).first().waitFor()
  await page.keyboard.press('Enter')
  check('nota de uma ficha aparece no "Aparece em" da outra', await page.getByRole('complementary').getByRole('link', { name: /Hospital Santa Clara/ }).waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Bloco de notas da cena, visto também na sessão
  await page.getByRole('link', { name: 'Cenas' }).click()
  await page.getByRole('link', { name: /Ala fechada/ }).click()
  await page.getByRole('button', { name: 'Novo bloco' }).click()
  await page.getByLabel('Título do bloco').last().fill('Se forem ao porão')
  await page.getByLabel('Texto do bloco Se forem ao porão').fill('A Vigia ainda não acordou; dá para passar em silêncio.')
  await page.waitForTimeout(1200)
  await page.getByRole('link', { name: 'Sessão' }).click()
  check('bloco de notas da cena aparece na tela de sessão', await page.getByText('dá para passar em silêncio').waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Corkboard e modelos de estrutura
  await page.getByRole('link', { name: 'Cenas' }).click()
  await page.getByRole('button', { name: 'Ver como corkboard' }).click()
  const corkCards = page.getByRole('list', { name: 'Corkboard de cenas' }).getByRole('listitem')
  await corkCards.first().waitFor()
  const firstBefore = (await corkCards.nth(0).innerText()).split('\n').find((l) => l.length > 3 && !/^\d\d$/.test(l))
  const second = await corkCards.nth(1).getByRole('button', { name: /para antes/ }).getAttribute('aria-label')
  await corkCards.nth(1).getByRole('button', { name: /para antes/ }).click()
  await page.waitForTimeout(500)
  check('corkboard reordena pelos botões', !(await corkCards.nth(0).innerText()).includes(firstBefore ?? '§') && !!second)
  await shot('S05-corkboard')
  await page.getByRole('button', { name: 'Modelos…' }).click()
  await page.getByRole('button', { name: 'Aplicar o modelo One-shot de terror' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Criar', exact: true }).click()
  check('modelo cria as cenas', await page.getByText('6 cenas criadas com o modelo "One-shot de terror".').waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.getByLabel('Salvar as cenas desta campanha como modelo').fill('Meu hospital')
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
  await page.getByText(/Modelo "Meu hospital" salvo/).waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'Apagar o modelo Meu hospital' }).click()
  check('modelo próprio salva e apaga', await page.getByText('Modelo "Meu hospital" apagado.').waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')
  check('corkboard mostra as cenas novas', (await corkCards.count()) === 8)

  // Desfazer e refazer de qualquer ação (fora dos campos de texto)
  const blur = () => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  const clockChip = page.getByRole('link', { name: /Agora no jogo/ })
  const clockBefore = await clockChip.innerText()
  await page.getByRole('button', { name: '+1 h' }).first().click()
  await page.waitForFunction((t) => !document.body.innerText.includes(t), clockBefore.trim(), { timeout: 5000 }).catch(() => {})
  await blur()
  await page.keyboard.press('Control+z')
  await page.getByRole('status').filter({ hasText: 'Desfeito: avançar o relógio' }).waitFor({ timeout: 5000 })
  check('Ctrl+Z desfaz o relógio', (await clockChip.innerText()) === clockBefore)
  await page.keyboard.press('Control+y')
  await page.getByRole('status').filter({ hasText: 'Refeito: avançar o relógio' }).waitFor({ timeout: 5000 })
  check('Ctrl+Y refaz', (await clockChip.innerText()) !== clockBefore)

  await page.getByRole('link', { name: 'Pistas' }).click()
  await page.getByRole('button', { name: /Arranhões na porta da ala/ }).click()
  await page.getByRole('complementary', { name: 'Pista' }).getByRole('button', { name: 'Mover para a lixeira' }).click()
  await page.getByRole('button', { name: /Arranhões na porta da ala/ }).waitFor({ state: 'detached', timeout: 5000 })
  await blur()
  await page.getByRole('button', { name: /^Desfazer: pista para a lixeira/ }).click()
  check('desfazer traz a pista de volta da lixeira', await page.getByRole('button', { name: /Arranhões na porta da ala/ }).waitFor({ timeout: 5000 }).then(() => true, () => false))

  await page.getByRole('link', { name: 'Cenas' }).click()
  await page.getByRole('link', { name: /Ala fechada/ }).first().click()
  await page.getByLabel('Título da cena').fill('Ala trancada')
  await page.getByRole('complementary', { name: 'Cenas' }).getByText('Ala trancada').waitFor({ timeout: 5000 })
  await blur()
  await page.keyboard.press('Control+z')
  await page.getByRole('status').filter({ hasText: 'Desfeito: editar cena' }).waitFor({ timeout: 5000 })
  check('Ctrl+Z desfaz a edição da cena e a tela relê', (await page.getByLabel('Título da cena').inputValue()) === 'Ala fechada')
  await shot('S05-desfazer')

  // Contagem de palavras, modo foco, tema claro, ajuda
  check('editor mostra a contagem de palavras', await page.getByText(/^\d+ palavras$/).first().isVisible())
  await blur()
  await page.keyboard.press('Control+Shift+F')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.waitFor({ state: 'hidden', timeout: 3000 })
  check('modo foco esconde o menu', !(await nav.isVisible()))
  await page.keyboard.press('Escape')
  await nav.waitFor({ state: 'visible', timeout: 3000 })
  check('Esc sai do modo foco', await nav.isVisible())

  await page.getByRole('link', { name: 'Ajustes' }).click()
  await page.getByLabel('Tema').selectOption('claro')
  const bg = await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor])
  check('tema claro troca as cores', bg[0] === 'light' && bg[1] === 'rgb(246, 243, 236)', bg.join(' '))
  await page.getByRole('link', { name: 'Linha do tempo' }).click()
  await page.getByText('Agora no jogo', { exact: true }).waitFor()
  await shot('N02-tema-claro')
  await page.keyboard.press('Control+k')
  await page.keyboard.type('lia moraes')
  await page.getByRole('option', { name: /Lia Moraes/ }).first().waitFor()
  await page.keyboard.press('Enter')
  check('ficha completa abre pela busca', await page.getByRole('list', { name: 'Lista de perícias' }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.waitForTimeout(300)
  await shot('N03-ficha-completa-clara')
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await page.getByLabel('Tema').selectOption('escuro')
  check('volta ao tema escuro', (await page.evaluate(() => document.documentElement.dataset.theme)) === undefined)

  await page.getByRole('link', { name: 'Ajuda' }).click()
  check('página de ajuda com os atalhos', await page.getByRole('rowheader', { name: 'Ctrl+K' }).waitFor({ timeout: 5000 }).then(() => true, () => false))

  // Acervo: trazer fichas de outra campanha (a que já existe aqui não duplica)
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Fichas' }).click()
  await page.getByRole('button', { name: 'Trazer de outra campanha…' }).click()
  const bringDialog = page.getByRole('dialog', { name: 'Trazer fichas de outra campanha' })
  const otherOption = (await bringDialog.getByLabel('Campanha').locator('option').allInnerTexts()).find((t) => t.startsWith('Caso do Hospital'))
  await bringDialog.getByLabel('Campanha').selectOption({ label: otherOption })
  await bringDialog.getByRole('list', { name: 'Fichas da outra campanha' }).getByText('Lia Moraes').click()
  await bringDialog.getByRole('button', { name: /^Trazer 1 ficha/ }).click()
  check('acervo não duplica ficha que já existe', await bringDialog.getByText('já existiam aqui: Lia Moraes').waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')

  // Biblioteca: renomear, backup e excluir uma campanha fechada
  await app.evaluate(({ shell }) => {
    shell.trashItem = async () => {} // não encher a Lixeira do Windows de quem roda o teste
  })
  await page.getByRole('button', { name: 'Fechar campanha' }).click()
  await page.getByRole('heading', { name: 'Campanhas' }).waitFor()
  const editsBefore = await page.getByRole('button', { name: /^Editar / }).count()
  await page.getByRole('button', { name: /^Editar / }).first().click()
  const editDialog = page.getByRole('dialog', { name: 'Editar campanha' })
  await editDialog.getByLabel('Nome').fill('Hospital renomeado')
  await editDialog.getByRole('button', { name: 'Renomear' }).click()
  await editDialog.getByText('Nome salvo.').waitFor({ timeout: 5000 })
  await editDialog.getByRole('button', { name: 'Fazer backup' }).click()
  check('backup de campanha fechada pela biblioteca', await editDialog.getByText(/Backup feito: Hospital renomeado/).waitFor({ timeout: 15000 }).then(() => true, () => false))
  await editDialog.getByRole('button', { name: 'Excluir campanha…' }).click()
  await editDialog.getByRole('button', { name: 'Excluir Hospital renomeado' }).click()
  await editDialog.waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(300)
  check('renomear e excluir pela biblioteca', (await page.getByRole('button', { name: /^Editar / }).count()) === editsBefore - 1 && (await page.getByText('Hospital renomeado').count()) === 0)
} catch (err) {
  // A linha "Call log" do Playwright diz qual elemento ele estava esperando.
  check('roteiro completo', false, err.message.split('\n').slice(0, 4).join(' | '))
} finally {
  check('sem erros no console', errors.length === 0, errors.slice(0, 3).join(' | '))
  await app.close()
  rmSync(tmp, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} ok`)
process.exit(failed ? 1 : 0)
