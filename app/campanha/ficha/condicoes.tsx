import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

const CONDICOES = [
  'Sangrando', 'Envenenado', 'Queimando', 'Congelado', 'Atordoado',
  'Caído', 'Apanhado', 'Imobilizado', 'Lento', 'Silenciado',
  'Cego', 'Surdo', 'Medo', 'Louco', 'Inconsciente', 'Morrendo', 'Morto',
];

export default function FichaCondicoesScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error, upsert } = useFicha(campaignId || '', 'user-1');
  const [customCondicao, setCustomCondicao] = React.useState('');

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const condicoesAtivas = ficha.sheet_data.condicoes || [];

  const toggleCondicao = (condicao: string) => {
    const novas = condicoesAtivas.includes(condicao)
      ? condicoesAtivas.filter((c: string) => c !== condicao)
      : [...condicoesAtivas, condicao];
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, condicoes: novas }, updated_at: new Date().toISOString() });
  };

  const addCustomCondicao = () => {
    if (!customCondicao.trim()) return;
    const novas = [...condicoesAtivas, customCondicao.trim()];
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, condicoes: novas }, updated_at: new Date().toISOString() });
    setCustomCondicao('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Condições Padrão</Text>
          <View style={styles.condicoesGrid}>
            {CONDICOES.map((cond) => (
              <CondicaoChip
                key={cond}
                label={cond}
                active={condicoesAtivas.includes(cond)}
                onPress={() => toggleCondicao(cond)}
              />
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Condições Personalizadas</Text>
          <View style={styles.customRow}>
            <Input
              value={customCondicao}
              onChange={setCustomCondicao}
              placeholder="Nova condição..."
              style={styles.customInput}
            />
            <TouchableOpacity onPress={addCustomCondicao} style={styles.addButton}>
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
          {condicoesAtivas.filter((c: string) => !CONDICOES.includes(c)).map((cond) => (
            <CustomCondicaoChip key={cond} label={cond} onRemove={() => toggleCondicao(cond)} />
          ))}
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>PV / PE / SAN Atuais</Text>
          <View style={styles.pvpeRow}>
            <PVPEInput
              label="PV Atual"
              value={ficha.sheet_data.pvAtual}
              onChange={(v) => upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, pvAtual: Number(v) }, updated_at: new Date().toISOString() })}
            />
            <PVPEInput
              label="PE Atual"
              value={ficha.sheet_data.peAtual}
              onChange={(v) => upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, peAtual: Number(v) }, updated_at: new Date().toISOString() })}
            />
            <PVPEInput
              label="SAN Atual"
              value={ficha.sheet_data.sanAtual}
              onChange={(v) => upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, sanAtual: Number(v) }, updated_at: new Date().toISOString() })}
            />
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function LoadingView() {
  return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>;
}
function ErrorView({ message }: { message: string }) {
  return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>;
}
function EmptyView() {
  return <View style={styles.centerContainer}><Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha encontrada.</Text></View>;
}

function CondicaoChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.condicaoChip, active && styles.condicaoChipActive]}>
      <Text style={[styles.condicaoChipText, active && styles.condicaoChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CustomCondicaoChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.customCondicaoChip}>
      <Text style={styles.customCondicaoChipText}>{label}</Text>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function PVPEInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <View style={styles.pvpeInputWrapper}>
      <Text style={styles.pvpeInputLabel}>{label}</Text>
      <Input value={String(value)} onChange={onChange} keyboardType="numeric" style={styles.pvpeInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  condicoesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  condicaoChip: { backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  condicaoChipActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  condicaoChipText: { color: '#e8e8f0', fontSize: 13 },
  condicaoChipTextActive: { color: 'white', fontWeight: '600' },
  customRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  customInput: { flex: 1 },
  addButton: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  customCondicaoChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginBottom: 8 },
  customCondicaoChipText: { color: '#e8e8f0', fontSize: 14 },
  removeButton: { padding: 4 },
  removeButtonText: { color: '#ef4444', fontSize: 18 },
  pvpeRow: { flexDirection: 'row', gap: 8 },
  pvpeInputWrapper: { flex: 1 },
  pvpeInputLabel: { fontSize: 12, color: '#8888a0', marginBottom: 4 },
  pvpeInput: { width: '100%' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});