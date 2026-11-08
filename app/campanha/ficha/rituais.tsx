import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';

export default function FichaRituaisScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error, upsert } = useFicha(campaignId || '', 'user-1');
  const { data: rituais } = useBiblioteca(campaignId || '', 'ritual');

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const rituaisConhecidos = ficha.sheet_data.rituais || [];

  const toggleRitual = (ritualId: string) => {
    const novos = rituaisConhecidos.includes(ritualId)
      ? rituaisConhecidos.filter((id: string) => id !== ritualId)
      : [...rituaisConhecidos, ritualId];
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, rituais: novos }, updated_at: new Date().toISOString() });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Meus Rituais ({rituaisConhecidos.length})</Text>
          {rituaisConhecidos.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum ritual aprendido ainda</Text>
          ) : (
            rituaisConhecidos.map((ritualId: string) => {
              const ritual = (rituais || []).find((r: any) => r.id === ritualId);
              return ritual ? <RitualCard key={ritual.id} ritual={ritual} onRemove={() => toggleRitual(ritual.id)} /> : null;
            })
          )}
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Biblioteca de Rituais</Text>
          {rituais?.map((ritual: any) => (
            <RitualBibCard
              key={ritual.id}
              ritual={ritual}
              conhecido={rituaisConhecidos.includes(ritual.id)}
              onToggle={() => toggleRitual(ritual.id)}
            />
          ))}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function RitualCard({ ritual, onRemove }: { ritual: any; onRemove: () => void }) {
  return (
    <View style={styles.ritualCard}>
      <View style={styles.ritualInfo}>
        <Text style={styles.ritualNome}>{ritual.name}</Text>
        <Text style={styles.ritualMeta}>
          Custo: {ritual.dados?.custoPE || '?'} PE | {ritual.dados?.tipo || 'Ritual'}
        </Text>
        {ritual.dados?.descricao && <Text style={styles.ritualDesc}>{ritual.dados.descricao}</Text>}
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Ionicons name="trash-outline" size={24} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

function RitualBibCard({ ritual, conhecido, onToggle }: { ritual: any; conhecido: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} style={[styles.ritualBibCard, conhecido && styles.ritualBibCardKnown]}>
      <View style={styles.ritualBibInfo}>
        <Text style={styles.ritualBibNome}>{ritual.name}</Text>
        <Text style={styles.ritualBibMeta}>
          {ritual.dados?.custoPE || '?'} PE | {ritual.dados?.tipo || 'Ritual'} | Nível {ritual.dados?.nivel || '?'}
        </Text>
      </View>
      <View style={styles.ritualBibStatus}>
        <Text style={[styles.statusText, conhecido && styles.statusTextKnown]}>
          {conhecido ? '✓ Conhecido' : '+ Aprender'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function LoadingView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>; }
function ErrorView({ message }: { message: string }) { return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>; }
function EmptyView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha.</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  emptyText: { color: '#8888a0', textAlign: 'center', padding: 20 },
  ritualCard: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  ritualInfo: { flex: 1 },
  ritualNome: { fontSize: 15, fontWeight: '600', color: '#e8e8f0', marginBottom: 2 },
  ritualMeta: { fontSize: 11, color: '#8888a0', marginBottom: 4 },
  ritualDesc: { fontSize: 12, color: '#aaaaaa' },
  removeButton: { padding: 8 },
  ritualBibCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginBottom: 8 },
  ritualBibCardKnown: { borderWidth: 1, borderColor: '#22c55e' },
  ritualBibInfo: { flex: 1 },
  ritualBibNome: { fontSize: 15, fontWeight: '600', color: '#e8e8f0', marginBottom: 2 },
  ritualBibMeta: { fontSize: 11, color: '#8888a0' },
  ritualBibStatus: { alignItems: 'flex-end' },
  statusText: { fontSize: 12, color: '#8888a0' },
  statusTextKnown: { color: '#22c55e', fontWeight: '600' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});