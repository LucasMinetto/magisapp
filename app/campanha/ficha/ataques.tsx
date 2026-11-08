import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Ionicons } from '@expo/vector-icons';

const TIPOS_ATAQUE = ['Corpo a Corpo', 'Distância', 'Poder', 'Ritual'];
const ATRIBUTOS = ['AGI', 'FOR', 'INT', 'PRE', 'VIG'];

export default function FichaAtaquesScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error, upsert } = useFicha(campaignId || '', 'user-1');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAtaque, setNewAtaque] = useState({
    nome: '', tipo: 'Corpo a Corpo', atributo: 'FOR', pericia: 'Luta',
    dano: '1d6', alcance: 'Pessoal', municao: '', especial: '', equipado: false,
  });

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const ataques = ficha.sheet_data.ataques || [];

  const handleAddAtaque = () => {
    if (!newAtaque.nome.trim()) return;
    const novos = [...ataques, { ...newAtaque, id: Date.now().toString() }];
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, ataques: novos }, updated_at: new Date().toISOString() });
    setShowAddModal(false);
    setNewAtaque({ nome: '', tipo: 'Corpo a Corpo', atributo: 'FOR', pericia: 'Luta', dano: '1d6', alcance: 'Pessoal', municao: '', especial: '', equipado: false });
  };

  const handleRemoveAtaque = (id: string) => {
    Alert.alert('Remover Ataque', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        const novos = ataques.filter((a: any) => a.id !== id);
        upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, ataques: novos }, updated_at: new Date().toISOString() });
      }},
    ]);
  };

  const handleToggleEquipado = (id: string) => {
    const novos = ataques.map((a: any) => a.id === id ? { ...a, equipado: !a.equipado } : a);
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, ataques: novos }, updated_at: new Date().toISOString() });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Ataques</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {ataques.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="flash-outline" size={48} color="#555570" />
          <Text style={styles.emptyText}>Nenhum ataque cadastrado</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButtonSmall}>
            <Text style={styles.addButtonText}>Adicionar Ataque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        ataques.map((atk: any) => <AtaqueCard key={atk.id} ataque={atk} onRemove={() => handleRemoveAtaque(atk.id)} onToggleEquipado={() => handleToggleEquipado(atk.id)} />)
      )}

      {showAddModal && (
        <AddAtaqueModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          ataque={newAtaque}
          onChange={setNewAtaque}
          onSubmit={handleAddAtaque}
        />
      )}
    </ScrollView>
  );
}

function AtaqueCard({ ataque, onRemove, onToggleEquipado }: { ataque: any; onRemove: () => void; onToggleEquipado: () => void }) {
  return (
    <View style={styles.ataqueCard}>
      <View style={styles.ataqueMain}>
        <View style={styles.ataqueInfo}>
          <View style={styles.ataqueHeader}>
            <Text style={styles.ataqueNome}>{ataque.nome}</Text>
            <Text style={[styles.ataqueTipo, { backgroundColor: getTipoColor(ataque.tipo) }]}>{ataque.tipo}</Text>
          </View>
          <Text style={styles.ataqueDetails}>
            {ataque.atributo} + {ataque.pericia} | Dano: {ataque.dano} | Alcance: {ataque.alcance}
          </Text>
          {ataque.municao && <Text style={styles.ataqueDetails}>Munição: {ataque.municao}</Text>}
          {ataque.especial && <Text style={styles.ataqueEspecial}>Especial: {ataque.especial}</Text>}
        </View>
        <View style={styles.ataqueActions}>
          <TouchableOpacity onPress={onToggleEquipado} style={[styles.actionButton, ataque.equipado && styles.actionButtonActive]}>
            <Ionicons name={ataque.equipado ? 'checkmark-circle' : 'checkmark-circle-outline'} size={24} color={ataque.equipado ? '#22c55e' : '#8888a0'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function AddAtaqueModal({ visible, onClose, ataque, onChange, onSubmit }: any) {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Novo Ataque</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={28} color="#8888a0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalFields}>
          <Input label="Nome" value={ataque.nome} onChange={(v) => onChange({ ...ataque, nome: v })} />
          <Select
            label="Tipo"
            value={ataque.tipo}
            options={TIPOS_ATAQUE.map(t => ({ label: t, value: t }))}
            onChange={(v) => onChange({ ...ataque, tipo: v })}
          />
          <Select
            label="Atributo"
            value={ataque.atributo}
            options={ATRIBUTOS.map(t => ({ label: t, value: t }))}
            onChange={(v) => onChange({ ...ataque, atributo: v })}
          />
          <Input label="Perícia" value={ataque.pericia} onChange={(v) => onChange({ ...ataque, pericia: v })} />
          <Input label="Dano" value={ataque.dano} onChange={(v) => onChange({ ...ataque, dano: v })} />
          <Input label="Alcance" value={ataque.alcance} onChange={(v) => onChange({ ...ataque, alcance: v })} />
          <Input label="Munição" value={ataque.municao} onChange={(v) => onChange({ ...ataque, municao: v })} />
          <Input label="Especial" value={ataque.especial} onChange={(v) => onChange({ ...ataque, especial: v })} multiline />
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
function EmptyView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha encontrada.</Text></View>; }

function getTipoColor(tipo: string) {
  switch (tipo) {
    case 'Corpo a Corpo': return '#ef4444';
    case 'Distância': return '#3b82f6';
    case 'Poder': return '#a855f7';
    case 'Ritual': return '#f59e0b';
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
  ataqueCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 12 },
  ataqueMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ataqueInfo: { flex: 1 },
  ataqueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ataqueNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  ataqueTipo: { fontSize: 11, color: 'white', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  ataqueDetails: { fontSize: 12, color: '#8888a0', marginBottom: 2 },
  ataqueEspecial: { fontSize: 11, color: '#a855f7', marginTop: 4 },
  ataqueActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 8 },
  actionButtonActive: { backgroundColor: '#22c55e30', borderRadius: 8 },
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