import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

export default function FichaHabilidadesScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error, upsert } = useFicha(campaignId || '', 'user-1');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newHabilidade, setNewHabilidade] = React.useState({ nome: '', descricao: '', tipo: 'Poder', custo: '', requisito: '' });

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const habilidades = ficha.sheet_data.habilidades || [];

  const handleAdd = () => {
    if (!newHabilidade.nome.trim()) return;
    const novas = [...habilidades, { ...newHabilidade, id: Date.now().toString() }];
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, habilidades: novas }, updated_at: new Date().toISOString() });
    setShowAddModal(false);
    setNewHabilidade({ nome: '', descricao: '', tipo: 'Poder', custo: '', requisito: '' });
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remover', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        const novas = habilidades.filter((h: any) => h.id !== id);
        upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, habilidades: novas }, updated_at: new Date().toISOString() });
      }},
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Habilidades</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {habilidades.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={48} color="#555570" />
          <Text style={styles.emptyText}>Nenhuma habilidade</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButtonSmall}>
            <Text style={styles.addButtonText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        habilidades.map((hab: any) => <HabilidadeCard key={hab.id} habilidade={hab} onRemove={() => handleRemove(hab.id)} />)
      )}

      {showAddModal && (
        <HabilidadeModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          habilidade={newHabilidade}
          onChange={setNewHabilidade}
          onSubmit={handleAdd}
        />
      )}
    </ScrollView>
  );
}

function HabilidadeCard({ habilidade, onRemove }: { habilidade: any; onRemove: () => void }) {
  return (
    <View style={styles.habCard}>
      <View style={styles.habMain}>
        <View style={styles.habInfo}>
          <View style={styles.habHeader}>
            <Text style={styles.habNome}>{habilidade.nome}</Text>
            <Text style={[styles.habTipo, { backgroundColor: getTipoColor(habilidade.tipo) }]}>{habilidade.tipo}</Text>
          </View>
          {habilidade.descricao && <Text style={styles.habDesc}>{habilidade.descricao}</Text>}
          <View style={styles.habMeta}>
            {habilidade.custo && <Text style={styles.habMetaText}>Custo: {habilidade.custo}</Text>}
            {habilidade.requisito && <Text style={styles.habMetaText}>Req: {habilidade.requisito}</Text>}
          </View>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <Ionicons name="trash-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HabilidadeModal({ visible, onClose, habilidade, onChange, onSubmit }: any) {
  if (!visible) return null;
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Nova Habilidade</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={28} color="#8888a0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalFields}>
          <Input label="Nome" value={habilidade.nome} onChange={(v) => onChange({ ...habilidade, nome: v })} />
          <Input label="Descrição" value={habilidade.descricao} onChange={(v) => onChange({ ...habilidade, descricao: v })} multiline />
          <Input label="Tipo" value={habilidade.tipo} onChange={(v) => onChange({ ...habilidade, tipo: v })} />
          <Input label="Custo" value={habilidade.custo} onChange={(v) => onChange({ ...habilidade, custo: v })} />
          <Input label="Requisito" value={habilidade.requisito} onChange={(v) => onChange({ ...habilidade, requisito: v })} />
        </ScrollView>
        <TouchableOpacity onPress={onSubmit} style={styles.modalSubmit}>
          <Text style={styles.modalSubmitText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LoadingView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>; }
function ErrorView({ message }: { message: string }) { return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>; }
function EmptyView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha.</Text></View>; }

function getTipoColor(tipo: string) {
  switch (tipo) {
    case 'Poder': return '#a855f7';
    case 'Ritual': return '#f59e0b';
    case 'Traço': return '#3b82f6';
    default: return '#8888a0';
  }
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#e8e8f0' },
  addButton: { padding: 8 },
  emptyState: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 16, color: '#8888a0' },
  addButtonSmall: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  addButtonText: { color: 'white', fontWeight: '600' },
  habCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 12 },
  habMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  habInfo: { flex: 1 },
  habHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  habNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  habTipo: { fontSize: 11, color: 'white', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  habDesc: { fontSize: 13, color: '#aaaaaa', marginBottom: 4 },
  habMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  habMetaText: { fontSize: 11, color: '#8888a0' },
  removeButton: { padding: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16, zIndex: 1000 },
  modalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#e8e8f0' },
  modalClose: { padding: 4 },
  modalFields: { gap: 12, paddingBottom: 16 },
  modalSubmit: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  modalSubmitText: { color: 'white', fontWeight: '600', fontSize: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});