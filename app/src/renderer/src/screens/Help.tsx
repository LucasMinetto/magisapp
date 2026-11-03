// Ajuda: um guia curto do app e os atalhos. Texto escrito para o Magistrado.
import { Link } from 'react-router'
import { Card } from '@/ui'

const SHORTCUTS: [string, string][] = [
  ['Ctrl+K', 'Buscar qualquer coisa: fichas, cenas, pistas, eventos, textos, sessões. Enter abre o primeiro.'],
  ['Ctrl+Z / Ctrl+Y', 'Desfazer e refazer a última ação (fora dos campos de texto). Dentro de um campo, desfaz o que você digitou.'],
  ['Alt+→ / Alt+←', 'Avançar ou voltar 10 minutos no relógio do jogo.'],
  ['Alt+Shift+→', 'Avançar 1 hora no jogo.'],
  ['Ctrl+clique num nome', 'No texto, abre a ficha daquele nome.'],
  ['Ctrl+Shift+F', 'Modo foco: esconde o menu e a barra de cima. Esc sai.'],
  ['Delete', 'No quadro, tira o item selecionado (Ctrl+Z traz de volta).'],
  ['Esc', 'Fecha a busca, uma janela ou o modo foco.']
]

const STEPS: [string, string, string][] = [
  ['Campanha', '/', 'Crie com a data em que o caso começa. Tudo na linha do tempo conta a partir dela.'],
  ['Fichas', '/fichas', 'Personagens, ameaças, locais, grupos e lore, com o modelo de Ordem Paranormal. Escreva apelidos para o app achar o nome nos textos.'],
  ['Cenas', '/cenas', 'Cada cena tem hora no jogo e lugar. Nomes de fichas no texto viram ligação sozinhos. O corkboard e os modelos ajudam a montar a aventura.'],
  ['Linha do tempo', '/linha-do-tempo', 'O relógio do jogo, os eventos que acontecem mesmo sem os jogadores, e as lacunas onde nada está marcado.'],
  ['Pistas', '/pistas', 'Imagem, onde está, quando e quem achou. "O que revela" fica escondido até você pedir.'],
  ['Quadros', '/quadros', 'O mapa mental: fichas, pistas e cenas ligadas com setas.'],
  ['Arquivos', '/arquivos', 'O PDF da aventura, tokens e mapas. Ligue o PDF à cena com a página e abra na hora certa.'],
  ['Sessão', '/sessao', 'A tela da mesa: cena atual, PV e SAN à mão, pistas da cena e as notas do dia.']
]

export function Help() {
  return (
    <div className="mx-auto flex max-w-(--layout-reading-max) flex-col gap-6 px-6 py-6">
      <h1 className="type-xl">Ajuda</h1>

      <section aria-labelledby="help-steps" className="flex flex-col gap-2">
        <h2 id="help-steps" className="type-label text-muted">
          Como o Magistrado se organiza
        </h2>
        <ol className="flex flex-col gap-2">
          {STEPS.map(([title, to, text], i) => (
            <li key={title}>
              <Link to={to} className="flex gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-border-input">
                <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="help-keys" className="flex flex-col gap-2">
        <h2 id="help-keys" className="type-label text-muted">
          Atalhos
        </h2>
        <Card className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUTS.map(([keys, what]) => (
                <tr key={keys} className="border-b border-border last:border-0">
                  <th scope="row" className="w-44 px-4 py-2 text-left align-top font-mono text-xs font-medium whitespace-nowrap text-fg">
                    {keys}
                  </th>
                  <td className="px-4 py-2 text-muted">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="help-files" className="flex flex-col gap-2">
        <h2 id="help-files" className="type-label text-muted">
          Onde ficam as coisas
        </h2>
        <Card className="flex flex-col gap-2 text-sm text-muted">
          <p>
            Cada campanha é uma pasta em <span className="font-mono text-xs text-fg">Documentos\Campanhas Magistrado</span>, com o banco (
            <span className="font-mono text-xs">campanha.sqlite</span>) e a pasta <span className="font-mono text-xs">anexos</span>.
          </p>
          <p>
            Os backups ficam em <span className="font-mono text-xs text-fg">Documentos\Backups de campanhas</span> (dá para trocar em{' '}
            <Link to="/ajustes" className="text-fg underline underline-offset-2">
              Ajustes
            </Link>
            ). Cada um é um zip: se o app não abrir, abra a pasta do backup no Obsidian e está tudo lá, com links e imagens.
          </p>
          <p>Nada sai do seu computador. O app não usa internet.</p>
        </Card>
      </section>
    </div>
  )
}
