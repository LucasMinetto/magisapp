// Formulário do bloco de ameaça. O nome fica com quem usa:
// na biblioteca é um campo do registro, na campanha é o nome da ficha.
import { Plus, X } from 'lucide-react'
import { Button, IconButton } from '@/ui'
import { AreaTexto, Escolha, Numero, Secao, Texto } from '@/ficha/partes'
import { ELEMENTOS, TIPOS_ACAO, type Acao, type BlocoAmeaca } from '@shared/ordem/esquemas'
import { GRUPOS_DANO, GRUPOS_IMUNIDADE, GRUPOS_TIPO_DANO, SeletorTags } from './SeletorTags'

type CampoNumero = { [K in keyof BlocoAmeaca]: BlocoAmeaca[K] extends number ? K : never }[keyof BlocoAmeaca]
type CampoTexto = { [K in keyof BlocoAmeaca]: BlocoAmeaca[K] extends string ? K : never }[keyof BlocoAmeaca]

export function EditorAmeaca({ a, aoMudar }: { a: BlocoAmeaca; aoMudar: (patch: Partial<BlocoAmeaca>) => void }) {
  const n = (campo: CampoNumero, rotulo: string) => <Numero rotulo={rotulo} valor={a[campo]} aoMudar={(v) => aoMudar({ [campo]: v })} />
  const t = (campo: CampoTexto, rotulo: string, placeholder?: string, className?: string) => (
    <Texto rotulo={rotulo} valor={a[campo]} placeholder={placeholder} className={className} aoMudar={(v) => aoMudar({ [campo]: v })} />
  )

  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Identidade">
        <div className="grid gap-3 sm:grid-cols-4">
          <Escolha rotulo="Elemento" valor={a.elemento} opcoes={['', ...ELEMENTOS]} aoMudar={(elemento) => aoMudar({ elemento })} />
          {n('vd', 'VD')}
          {t('tipo', 'Tipo', 'Criatura, Pessoa…')}
          {t('tamanho', 'Tamanho', 'Médio, Grande…')}
          {t('deslocamento', 'Deslocamento', '9m')}
        </div>
      </Secao>

      <Secao titulo="Presença Perturbadora">
        <div className="grid gap-3 sm:grid-cols-3">
          {n('presencaDt', 'DT')}
          {t('presencaDano', 'Dano mental', '3d6 mental')}
          {t('presencaNexImune', 'NEX imune', '30%+')}
        </div>
      </Secao>

      <Secao titulo="Defesas e vida">
        <div className="grid gap-3 sm:grid-cols-4">
          {n('defesa', 'Defesa')}
          {n('pv', 'Pontos de Vida')}
          {n('pvMachucado', 'Machucado')}
          <div />
          {t('fortitude', 'Fortitude', '3O+10')}
          {t('reflexos', 'Reflexos', 'O')}
          {t('vontade', 'Vontade', 'O')}
          <div />
          {t('percepcao', 'Percepção', 'O+5')}
          {t('iniciativa', 'Iniciativa', 'O')}
          {t('sentidos', 'Outros sentidos', 'Percepção às cegas', 'sm:col-span-2')}
        </div>
        <SeletorTags rotulo="Resistências (RD)" comValor grupos={GRUPOS_DANO} valor={a.resistencias} aoMudar={(resistencias) => aoMudar({ resistencias })} />
        <SeletorTags rotulo="Vulnerabilidades" grupos={GRUPOS_TIPO_DANO} valor={a.vulnerabilidades} aoMudar={(vulnerabilidades) => aoMudar({ vulnerabilidades })} />
        <SeletorTags rotulo="Imunidades" grupos={GRUPOS_IMUNIDADE} valor={a.imunidades} aoMudar={(imunidades) => aoMudar({ imunidades })} />
      </Secao>

      <Secao titulo="Atributos e perícias">
        <div className="grid grid-cols-5 gap-3">
          {n('agi', 'AGI')}
          {n('for', 'FOR')}
          {n('int', 'INT')}
          {n('pre', 'PRE')}
          {n('vig', 'VIG')}
        </div>
        {t('pericias', 'Perícias', 'Atletismo 2O+5, Furtividade O+10')}
      </Secao>

      <EditorAcoes titulo="Habilidades" acoes={a.habilidades} aoMudar={(habilidades) => aoMudar({ habilidades })} />
      <EditorAcoes titulo="Ações" comTipo acoes={a.acoes} aoMudar={(acoes) => aoMudar({ acoes })} />

      <Secao titulo="Mistério">
        <AreaTexto rotulo="Enigma de Medo" valor={a.enigma} linhas={2} aoMudar={(enigma) => aoMudar({ enigma })} />
        <AreaTexto rotulo="Descrição" valor={a.descricao} linhas={4} aoMudar={(descricao) => aoMudar({ descricao })} />
      </Secao>
    </div>
  )
}

function EditorAcoes({ titulo, acoes, comTipo, aoMudar }: { titulo: string; acoes: Acao[]; comTipo?: boolean; aoMudar: (a: Acao[]) => void }) {
  const mudar = (i: number, patch: Partial<Acao>) => aoMudar(acoes.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const um = titulo === 'Ações' ? 'ação' : 'habilidade'
  return (
    <Secao
      titulo={titulo}
      acoes={
        <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => aoMudar([...acoes, { tipo: comTipo ? 'Padrão' : '', nome: '', descricao: '' }])}>
          {comTipo ? 'Nova ação' : 'Nova habilidade'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {acoes.map((ac, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex items-end gap-2">
              {comTipo && <Escolha rotulo="Tipo" valor={ac.tipo} opcoes={['', ...TIPOS_ACAO]} aoMudar={(tipo) => mudar(i, { tipo })} className="w-36" />}
              <Texto
                rotulo={`Nome da ${um} ${i + 1}`}
                valor={ac.nome}
                placeholder={comTipo ? 'Agredir — Pancada' : 'Nome da habilidade'}
                className="flex-1"
                aoMudar={(nome) => mudar(i, { nome })}
              />
              <IconButton label={`Tirar ${ac.nome || `${um} ${i + 1}`}`} onClick={() => aoMudar(acoes.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </IconButton>
            </div>
            <AreaTexto
              rotulo={`Descrição da ${um} ${i + 1}`}
              valor={ac.descricao}
              linhas={2}
              placeholder={comTipo ? 'Corpo a corpo x2. Teste 3O+10, dano 2d6+6 impacto.' : 'O que ela faz…'}
              aoMudar={(descricao) => mudar(i, { descricao })}
            />
          </div>
        ))}
      </div>
    </Secao>
  )
}
