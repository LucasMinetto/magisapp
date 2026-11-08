import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { derivados } from '@/shared/ordem/regras';
import { Card, CardContent } from '@/components/ui/Card';
import { PVPECard } from '@/components/ficha/PVPECard';

export default function FichaResumoScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error } = useFicha(campaignId || '', 'user-1');

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const derived = derivados({
    classe: ficha.sheet_data.classe,
    nex: ficha.sheet_data.nex,
    atributos: ficha.sheet_data.atributos,
    pericias: ficha.sheet_data.pericias,
    bonus: ficha.sheet_data.bonus,
    prestigio: ficha.sheet_data.prestigio,
    inventario: ficha.sheet_data.inventario,
    estagio: ficha.sheet_data.estagio,
  });

  const { pv, pe, san, defesa, patente, carga, cargaMax, deslocamento, iniciativa, nivel } = derived;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <PVPECard label="PV" current={ficha.sheet_data.pvAtual} max={pv.total} color="pv" />
        <PVPECard label="PE" current={ficha.sheet_data.peAtual} max={pe.total} color="pe" />
        <PVPECard label="SAN" current={ficha.sheet_data.sanAtual} max={san.total} color="san" />
      </View>

      <Card style={styles.card}>
        <CardContent>
          <View style={styles.statRow}>
            <StatBox label="Patente" value={patente.nome} icon="🎖" />
            <StatBox label="NEX" value={`${ficha.sheet_data.nex}%`} icon="⚡" />
            <StatBox label="Nível" value={nivel} icon="⬆" />
            <StatBox label="Deslocamento" value={`${deslocamento}m`} icon="🏃" />
            <StatBox label="Iniciativa" value={`1d20+${iniciativa}`} icon="🎲" />
            <StatBox label="Carga" value={`${carga}/${cargaMax}`} icon="🎒" />
            <StatBox label="Defesa" value={defesa.total} icon="🛡" />
            <StatBox label="Esquiva" value={defesa.total + (ficha.sheet_data.pericias.Reflexos?.treino || 0) + (ficha.sheet_data.pericias.Reflexos?.extra || 0)} icon="💨" />
            <StatBox label="Bloqueio" value={(ficha.sheet_data.pericias.Fortitude?.treino || 0) + (ficha.sheet_data.pericias.Fortitude?.extra || 0)} icon="🛡" />
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Atributos</Text>
          <View style={styles.attrRow}>
            {(['agi', 'for', 'int', 'pre', 'vig'] as const).map((attr) => (
              <AttrBox key={attr} label={attr.toUpperCase()} value={ficha.sheet_data.atributos[attr]} />
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Perícias Principais</Text>
          <View style={styles.periciaList}>
            {Object.entries(ficha.sheet_data.pericias)
              .sort((a, b) => b[1].treino + b[1].extra - (a[1].treino + a[1].extra))
              .slice(0, 10)
              .map(([nome, data]) => (
                <PericiaRow key={nome} nome={nome} treino={data.treino} extra={data.extra} attr={getAttrForPericia(nome)} />
              ))}
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function LoadingView() {
  return (
    <View style={styles.centerContainer}>
      <Text style={{ color: '#8888a0' }}>Carregando ficha...</Text>
    </View>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <View style={styles.centerContainer}>
      <Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

function EmptyView() {
  return (
    <View style={styles.centerContainer}>
      <Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha encontrada para esta campanha.</Text>
    </View>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AttrBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.attrBox}>
      <Text style={styles.attrValue}>{value}</Text>
      <Text style={styles.attrLabel}>{label}</Text>
    </View>
  );
}

function PericiaRow({ nome, treino, extra, attr }: { nome: string; treino: number; extra: number; attr: string }) {
  const total = treino + extra;
  return (
    <View style={styles.periciaRow}>
      <View style={styles.periciaInfo}>
        <Text style={styles.periciaNome}>{nome}</Text>
        <Text style={styles.periciaMeta}>{attr} | Treino: {treino} | Extra: {extra}</Text>
      </View>
      <View style={styles.periciaTotal}>
        <Text style={[
          styles.periciaTotal,
          total >= 15 ? { color: '#22c55e' } : total >= 10 ? { color: '#f59e0b' } : {}
        ]}>
          {total}
        </Text>
      </View>
    </View>
  );
}

function getAttrForPericia(nome: string): string {
  const map: Record<string, string> = {
    Acrobacia: 'AGI', Adestramento: 'PRE', Artes: 'PRE', Atletismo: 'FOR',
    Atualidades: 'INT', Ciências: 'INT', Crime: 'AGI', Diplomacia: 'PRE',
    Enganação: 'PRE', Fortitude: 'VIG', Furtividade: 'AGI', Iniciativa: 'AGI',
    Intimidação: 'PRE', Intuição: 'PRE', Investigação: 'INT', Luta: 'FOR',
    Medicina: 'INT', Ocultismo: 'INT', Percepção: 'PRE', Pilotagem: 'AGI',
    Pontaria: 'AGI', Profissão: 'INT', Reflexos: 'AGI', Religião: 'PRE',
    Sobrevivência: 'INT', Tática: 'INT', Tecnologia: 'INT', Vontade: 'PRE',
  };
  return map[nome] || '?';
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e8e8f0',
  },
  statLabel: {
    fontSize: 10,
    color: '#8888a0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  attrRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attrBox: {
    flex: 1,
    minWidth: 60,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  attrValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  attrLabel: {
    fontSize: 10,
    color: '#8888a0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8e8f0',
    marginBottom: 12,
  },
  periciaList: {
    gap: 8,
  },
  periciaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
  },
  periciaInfo: {
    flex: 1,
  },
  periciaNome: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e8e8f0',
  },
  periciaMeta: {
    fontSize: 10,
    color: '#8888a0',
    marginTop: 2,
  },
  periciaTotal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});