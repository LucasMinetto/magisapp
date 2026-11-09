import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { derivados } from 'shared/ordem/regras';
import { Card, CardContent } from '@/components/ui/Card';

const ATRIBUTOS = ['agi', 'for', 'int', 'pre', 'vig'] as const;

export default function FichaResumoScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? useAuth.getState().campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';

  const { ficha, loading, error } = useFicha(campanha, userId);

  if (loading) return <Centered text="Carregando ficha..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const d = derivados({
    classe: ficha.classe,
    nex: ficha.nex,
    atributos: ficha.atributos,
    pericias: ficha.pericias,
    bonus: ficha.bonus,
    prestigio: ficha.prestigio,
    inventario: ficha.inventario.map((i) => ({
      categoria: i.categoria,
      espacos: i.espacos,
      quantidade: i.quantidade,
      defesa: i.defesa,
      equipado: i.equipado,
    })),
    estagio: ficha.estagio,
  });

  const pericias = Object.entries(ficha.pericias)
    .map(([nome, p]) => ({ nome, total: (p.treino || 0) + (p.extra || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Recurso label="PV" atual={ficha.pvAtual} max={d.pv.total} cor="#22c55e" />
        <Recurso label="PE" atual={ficha.peAtual} max={d.pe.total} cor="#3b82f6" />
        <Recurso label="SAN" atual={ficha.sanAtual} max={d.san.total} cor="#f43f5e" />
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.nome}>{ficha.jogador || 'Agente'}</Text>
          <Text style={styles.sub}>
            {[ficha.classe, ficha.trilha, ficha.origem].filter(Boolean).join(' · ') || 'Sem classe'}
          </Text>
          <View style={styles.statRow}>
            <Stat label="NEX" value={String(ficha.nex) + '%'} />
            <Stat label="Nível" value={String(d.nivel)} />
            <Stat label="Patente" value={d.patente.nome} />
            <Stat label="Defesa" value={String(d.defesa.total)} />
            <Stat label="Esquiva" value={String(d.esquiva)} />
            <Stat label="Bloqueio" value={String(d.bloqueio)} />
            <Stat label="Deslocamento" value={String(d.deslocamento) + 'm'} />
            <Stat label="Carga" value={String(d.carga) + '/' + String(d.cargaMax)} />
            <Stat label="DT Ritual" value={String(d.dtRitual)} />
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Atributos</Text>
          <View style={styles.attrRow}>
            {ATRIBUTOS.map((a) => (
              <View key={a} style={styles.attrBox}>
                <Text style={styles.attrValor}>{ficha.atributos[a]}</Text>
                <Text style={styles.attrLabel}>{a.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Perícias treinadas</Text>
          {pericias.length === 0 ? (
            <Text style={styles.vazio}>Nenhuma perícia cadastrada.</Text>
          ) : (
            pericias.map((p) => (
              <View key={p.nome} style={styles.periciaRow}>
                <Text style={styles.periciaNome}>{p.nome}</Text>
                <Text style={styles.periciaTotal}>{p.total}</Text>
              </View>
            ))
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function Centered({ text, error }: { text: string; error?: boolean }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.centeredText, error ? styles.erro : null]}>{text}</Text>
    </View>
  );
}

function Recurso({ label, atual, max, cor }: { label: string; atual: number; max: number; cor: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((atual / max) * 100)) : 0;
  return (
    <View style={styles.recurso}>
      <Text style={styles.recursoLabel}>{label}</Text>
      <Text style={styles.recursoValor}>{atual}/{max}</Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: String(pct) + '%', backgroundColor: cor }]} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValor}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  card: { marginBottom: 12 },
  nome: { fontSize: 20, fontWeight: 'bold', color: '#e8e8f0' },
  sub: { fontSize: 13, color: '#8888a0', marginTop: 2, marginBottom: 12 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { flexGrow: 1, minWidth: 84, backgroundColor: '#0f0f1a', borderRadius: 10, padding: 10, alignItems: 'center' },
  statValor: { fontSize: 16, fontWeight: 'bold', color: '#e8e8f0' },
  statLabel: { fontSize: 10, color: '#8888a0', textTransform: 'uppercase', marginTop: 2 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  attrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attrBox: { flexGrow: 1, minWidth: 60, backgroundColor: '#0f0f1a', borderRadius: 12, padding: 12, alignItems: 'center' },
  attrValor: { fontSize: 26, fontWeight: 'bold', color: '#3b82f6' },
  attrLabel: { fontSize: 10, color: '#8888a0', textTransform: 'uppercase' },
  periciaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 8 },
  periciaNome: { fontSize: 14, color: '#e8e8f0' },
  periciaTotal: { fontSize: 16, fontWeight: 'bold', color: '#3b82f6' },
  vazio: { color: '#8888a0' },
  recurso: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12 },
  recursoLabel: { fontSize: 11, color: '#8888a0', textTransform: 'uppercase' },
  recursoValor: { fontSize: 16, fontWeight: 'bold', color: '#e8e8f0', marginVertical: 4 },
  bar: { height: 6, backgroundColor: '#0f0f1a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
