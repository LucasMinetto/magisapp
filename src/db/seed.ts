import type { DB } from '@op-engineering/op-sqlite';
import { DB_TABLES } from './index';
import type { FichaAgente } from '../../app/src/shared/ordem/esquemas';
import type { RitualBiblioteca, ItemBiblioteca } from '../../app/src/shared/ordem/esquemas';

const SAMPLE_CAMPAIGN_ID = 'campaign-seed-001';
const SAMPLE_USER_ID = 'user-seed-001';
const SAMPLE_SOURCE_ID = 'source-oficial-001';

function generateUUID(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

const SAMPLE_FICHA: FichaAgente = {
  jogador: 'Jogador Exemplo',
  origem: 'Acadêmico',
  classe: 'Especialista',
  trilha: 'Investigação',
  nex: 15,
  estagio: 1,
  prestigio: 10,
  atributos: { agi: 2, for: 1, int: 3, pre: 2, vig: 2 },
  pericias: {
    Investigação: { treino: 2, extra: 1 },
    Luta: { treino: 1, extra: 0 },
    Ocultismo: { treino: 2, extra: 1 },
    Tecnologia: { treino: 1, extra: 0 },
  },
  bonus: { pv: 0, pe: 0, san: 0, defesaEquip: 0, defesaOutros: 0, deslocamento: 0 },
  pvMax: 18,
  peMax: 14,
  sanMax: 20,
  defesa: 14,
  pvAtual: 18,
  peAtual: 14,
  sanAtual: 20,
  pvTemp: 0,
  peTemp: 0,
  sanTemp: 0,
  condicoes: [],
  dadosFisicos: false,
  ataques: [],
  rituais: [],
  habilidades: [],
  inventario: [],
  investigacao: {
    aparencia: 'Cabelos castanhos, olhos verdes, 1,75m. Usa óculos de armação fina.',
    personalidade: 'Metódico, curioso, evita conflitos diretos. Prefere planejar.',
    historico: 'Ex-pesquisador universitário recrutado pela Ordem após descobrir um artefato amaldiçoado no acervo da biblioteca.',
    objetivo: 'Entender a verdade por trás do Outro Lado sem perder a sanidade.',
    anotacoes: 'Não confio no Dr. Aurélio. A Vigia aparece à meia-noite.',
  },
};

const SAMPLE_RITUAIS: Omit<RitualBiblioteca, 'id'>[] = [
  {
    nome: 'Tocha',
    elemento: 'Energia',
    circulo: 1,
    execucao: 'Padrão',
    alcance: 'Toque',
    alvo: 'Objeto tocado',
    duracao: '1 hora',
    resistencia: 'Nenhuma',
    efeito: 'O objeto tocado emite luz forte em raio de 9m e luz fraca por mais 9m. Não gera calor nem consome o objeto.',
    discente: 'A luz torna-se forte em raio de 18m e fraca por mais 18m.',
    verdadeiro: 'A luz torna-se forte em raio de 36m e fraca por mais 36m. Inimigos na luz forte ficam ofuscados (–2 em testes de Percepção) por 1 rodada.',
    danoNormal: '',
    danoDiscente: '',
    danoVerdadeiro: '',
    tipoDano: '',
    alvoTipo: 'Alvo',
    pagina: 142,
  },
  {
    nome: 'Projétil de Sangue',
    elemento: 'Sangue',
    circulo: 2,
    execucao: 'Padrão',
    alcance: 'Médio (30m)',
    alvo: '1 criatura',
    duracao: 'Instantânea',
    resistencia: 'Reflexos reduz a metade',
    efeito: 'Você conjura uma lança de sangue coagulado e a arremessa. Faça um teste de Ocultismo contra a Defesa do alvo. Se acertar, causa 2d6 de dano de Sangue.',
    discente: 'O dano aumenta para 3d6. Se o alvo falhar a resistência, fica Sangrando (1d6 no início do turno).',
    verdadeiro: 'O dano aumenta para 4d6. Se o alvo falhar a resistência, fica Sangrando (2d6 no início do turno) e você cura PV iguais à metade do dano causado.',
    danoNormal: '2d6',
    danoDiscente: '3d6',
    danoVerdadeiro: '4d6',
    tipoDano: 'Sangue',
    alvoTipo: 'Alvo',
    pagina: 156,
  },
  {
    nome: 'Véu do Medo',
    elemento: 'Medo',
    circulo: 3,
    execucao: 'Padrão',
    alcance: 'Pessoal',
    alvo: 'Você',
    duracao: '1 minuto',
    resistencia: 'Nenhuma',
    efeito: 'Você se envolve em uma aura de terror sobrenatural. Criaturas que terminarem o turno a até 3m de você devem fazer um teste de Vontade (CD = seu teste de Ocultismo) ou ficam Amedrontadas por 1 rodada. Você ganha +2 em testes de Intimidação.',
    discente: 'O raio aumenta para 6m. Criaturas Amedrontadas pela aura têm –2 em testes de ataque contra você.',
    verdadeiro: 'O raio aumenta para 9m. Criaturas que falharem a resistência ficam Amedrontadas por 1d4 rodadas. Enquanto o ritual durar, você é imune à condição Amedrontado.',
    danoNormal: '',
    danoDiscente: '',
    danoVerdadeiro: '',
    tipoDano: '',
    alvoTipo: 'Efeito',
    pagina: 178,
  },
];

const SAMPLE_ITENS: Omit<ItemBiblioteca, 'id'>[] = [
  {
    nome: 'Pistola .38',
    tipo: 'Arma',
    categoria: 1,
    espacos: 1,
    defesa: 0,
    dano: '1d8',
    tipoDano: 'Físico',
    critico: '20/x2',
    alcance: 'Curto (15m)',
    proficiencia: 'Armas de Fogo',
    empunhadura: 'Leve',
    elemento: '',
    descricao: 'Revólver padrão de agentes da Ordem. Confiável e de fácil manutenção.',
    pagina: 89,
  },
  {
    nome: 'Colete à Prova de Balas Leve',
    tipo: 'Proteção',
    categoria: 2,
    espacos: 2,
    defesa: 2,
    dano: '',
    tipoDano: '',
    critico: '',
    alcance: '',
    proficiencia: '',
    empunhadura: '',
    elemento: '',
    descricao: 'Colete discreto que pode ser usado sob roupas comuns. Oferece proteção contra armas de fogo de calibre baixo.',
    pagina: 92,
  },
  {
    nome: 'Kit de Primeiros Socorros',
    tipo: 'Equipamento',
    categoria: 0,
    espacos: 1,
    defesa: 0,
    dano: '',
    tipoDano: '',
    critico: '',
    alcance: '',
    proficiencia: '',
    empunhadura: '',
    elemento: '',
    descricao: 'Contém bandagens, antissépticos, analgésicos e ferramentas básicas. Permite tratar ferimentos (ação padrão, cura 1d6 PV, 1x por cena).',
    pagina: 95,
  },
];

const SAMPLE_REGRA = {
  id: 'regra-cap-3',
  capitulo: 3,
  titulo: 'Combate',
  conteudo: `# Capítulo 3: Combate

## Iniciativa
No início do combate, cada participante rola **1d20 + AGI**. A ordem de turnos vai do maior para o menor resultado.

## Ações no Combate
Cada turno, um personagem pode realizar:
- **1 Ação Padrão**: Atacar, usar ritual, usar habilidade, etc.
- **1 Ação de Movimento**: Mover-se até seu deslocamento.
- **1 Ação Livre**: Falar, soltar algo, mudar empunhadura.
- **1 Reação**: Resposta a gatilho (ex.: ataque de oportunidade).

## Ataque
Para atacar, role **1d20 + bônus de ataque** contra a **Defesa** do alvo.
- **Acerto**: Role o dano da arma.
- **Crítico Natural 20**: Acerto automático + role dados de dano extras (margem de crítico).
- **Erro Natural 1**: Erro automático.

## Dano e PV
- Dano reduz **PV Atual**.
- A **0 PV**: Inconsciente, morrendo (teste de VIG CD 15 a cada turno).
- **PV Negativo = –(PV Max)**: Morte instantânea.

## Condições de Combate
- **Amedrontado**: –2 em testes, não pode se aproximar da fonte do medo.
- **Sangrando**: Perde PV no início do turno (valor varia).
- **Desprevenido**: –2 na Defesa, inimigos têm vantagem.
- **Agarrado**: Deslocamento 0, –2 em testes de Reflexos.

## Cura
- **Descanso Curto (1h)**: Recupera 1d6 + VIG PV e 1d6 PE.
- **Descanso Longo (8h)**: Recupera todos PV, PE, SAN. Remove condições temporárias.`,
  pagina_livro: 45,
  visivel_para_jogadores: 1,
  updated_at: nowIso(),
};

export async function seedDatabase(db: DB): Promise<void> {
  const now = nowIso();
  const fichaId = generateUUID();

  // Check if already seeded (idempotent)
  const existingFicha = await db.execute(
    `SELECT id FROM ${DB_TABLES.FICHA} WHERE campaign_id = ? AND user_id = ?`,
    [SAMPLE_CAMPAIGN_ID, SAMPLE_USER_ID]
  );
  if (existingFicha.rows.length > 0) {
    return; // Already seeded
  }

  // Insert ficha
  const sheetData = escapeSql(JSON.stringify(SAMPLE_FICHA));
  await db.execute(
    `INSERT INTO ${DB_TABLES.FICHA} (id, campaign_id, user_id, sheet_data, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [fichaId, SAMPLE_CAMPAIGN_ID, SAMPLE_USER_ID, sheetData, now]
  );

  // Insert rituais
  for (const ritual of SAMPLE_RITUAIS) {
    const ritualId = generateUUID();
    await db.execute(
      `INSERT INTO ${DB_TABLES.BIBLIOTECA_RITUAL} 
       (id, source_id, nome, elemento, circulo, execucao, alcance, alvo, duracao, resistencia, efeito, discente, verdadeiro, dano_normal, dano_discente, dano_verdadeiro, tipo_dano, alvo_tipo, pagina, data, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ritualId,
        SAMPLE_SOURCE_ID,
        ritual.nome,
        ritual.elemento,
        ritual.circulo,
        ritual.execucao,
        ritual.alcance,
        ritual.alvo,
        ritual.duracao,
        ritual.resistencia,
        ritual.efeito,
        ritual.discente,
        ritual.verdadeiro,
        ritual.danoNormal,
        ritual.danoDiscente,
        ritual.danoVerdadeiro,
        ritual.tipoDano,
        ritual.alvoTipo,
        ritual.pagina ?? null,
        now,
        null,
      ]
    );
  }

  // Insert itens
  for (const item of SAMPLE_ITENS) {
    const itemId = generateUUID();
    await db.execute(
      `INSERT INTO ${DB_TABLES.BIBLIOTECA_ITEM} 
       (id, source_id, nome, tipo, categoria, espacos, defesa, dano, tipo_dano, critico, alcance, proficiencia, empunhadura, elemento, descricao, pagina, data, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        SAMPLE_SOURCE_ID,
        item.nome,
        item.tipo,
        item.categoria,
        item.espacos,
        item.defesa,
        item.dano ?? null,
        item.tipoDano ?? null,
        item.critico ?? null,
        item.alcance ?? null,
        item.proficiencia ?? null,
        item.empunhadura ?? null,
        item.elemento ?? null,
        item.descricao ?? null,
        item.pagina ?? null,
        now,
        null,
      ]
    );
  }

  // Insert regra
  await db.execute(
    `INSERT INTO ${DB_TABLES.REGRAS} (id, capitulo, titulo, conteudo, pagina_livro, visivel_para_jogadores, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      SAMPLE_REGRA.id,
      SAMPLE_REGRA.capitulo,
      SAMPLE_REGRA.titulo,
      SAMPLE_REGRA.conteudo,
      SAMPLE_REGRA.pagina_livro,
      SAMPLE_REGRA.visivel_para_jogadores,
      SAMPLE_REGRA.updated_at,
    ]
  );

  // Add to sync queue for ficha
  const syncId = generateUUID();
  const syncPayload = escapeSql(JSON.stringify({ fichaId }));
  await db.execute(
    `INSERT INTO ${DB_TABLES.SYNC_QUEUE} (id, campaign_id, user_id, operacao, payload, status, tentativas, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [syncId, SAMPLE_CAMPAIGN_ID, SAMPLE_USER_ID, 'push_ficha', syncPayload, 'pending', 0, now]
  );
}

export { SAMPLE_FICHA, SAMPLE_RITUAIS, SAMPLE_ITENS, SAMPLE_REGRA, SAMPLE_CAMPAIGN_ID, SAMPLE_USER_ID, SAMPLE_SOURCE_ID };