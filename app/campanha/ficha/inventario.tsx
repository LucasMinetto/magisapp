import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Ionicons } from '@expo/vector-icons';

const TIPOS_ITEM = ['Arma', 'Armadura', 'Consumível', 'Equipamento', 'Outro'];
const SLOTS = ['Mão Principal', 'Mão Secundária', 'Corpo', 'Cabeça', 'Pés', 'Acessório', 'Cinto', 'Bolsa', 'Outro'];

export default function FichaInventarioScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error, upsert } = useFicha(campaignId || '', 'user-1');
  const { data: itens } = useBiblioteca(campaignId || '', 'item');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ nome: '', tipo: 'Equipamento', slot: 'Outro', quantidade: 1, descricao: '', bonus: {}, equipado: false });

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const handleAddItem = () => {
    const inventario = [...(ficha.sheet_data.inventario || []), { ...newItem, id: Date.now().toString() }];
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, inventario }, updated_at: new Date().toISOString() });
    setShowAddModal(false);
    setNewItem({ nome: '', tipo: 'Equipamento', slot: 'Outro', quantidade: 1, descricao: '', bonus: {}, equipado: false });
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Remover Item', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        const inventario = (ficha.sheet_data.inventario || []).filter((i: any) => i.id !== itemId);
        upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, inventario }, updated_at: new Date().toISOString() });
      }},
    ]);
  };

  const handleToggleEquipado = (itemId: string) => {
    const inventario = (ficha.sheet_data.inventario || []).map((i: any) =>
      i.id === itemId ? { ...i, equipado: !i.equipado } : i
    );
    upsert({ id: ficha.id, sheet_data: { ...ficha.sheet_data, inventario }, updated_at: new Date().toISOString() });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Inventário</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {(ficha.sheet_data.inventario || []).length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="backpack-outline" size={48} color="#555570" />
          <Text style={styles.emptyText}>Nenhum item no inventário</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButtonSmall}>
            <Text style={styles.addButtonText}>Adicionar Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        (ficha.sheet_data.inventario || []).map((item: any) => (
          <ItemCard key={item.id} item={item} onRemove={() => handleRemoveItem(item.id)} onToggleEquipado={() => handleToggleEquipado(item.id)} />
        ))
      )}

      {showAddModal && (
        <AddItemModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          item={newItem}
          onChange={setNewItem}
          onSubmit={handleAddItem}
          itensBiblioteca={itens || []}
        />
      )}
    </ScrollView>
  );
}

function ItemCard({ item, onRemove, onToggleEquipado }: { item: any; onRemove: () => void; onToggleEquipado: () => void }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemMain}>
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemNome}>{item.nome}</Text>
            <Text style={[styles.itemTipo, { backgroundColor: getTipoColor(item.tipo) }]}>{item.tipo}</Text>
          </View>
          <Text style={styles.itemDetails}>{item.slot} | Qtd: {item.quantidade}</Text>
          {item.descricao && <Text style={styles.itemDesc}>{item.descricao}</Text>}
          {Object.keys(item.bonus || {}).length > 0 && (
            <Text style={styles.itemBonus}>Bônus: {JSON.stringify(item.bonus)}</Text>
          )}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={onToggleEquipado} style={[styles.actionButton, item.equipado && styles.actionButtonActive]}>
            <Ionicons name={item.equipado ? 'checkmark-circle' : 'checkmark-circle-outline'} size={24} color={item.equipado ? '#22c55e' : '#8888a0'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function AddItemModal({ visible, onClose, item, onChange, onSubmit, itensBiblioteca }: any) {
  if (!visible) return null;

  const handleSubmit = () => {
    if (!item.nome.trim()) return;
    onSubmit();
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Novo Item</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={28} color="#8888a0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalFields}>
          <Input label="Nome" value={item.nome} onChange={(v) => onChange({ ...item, nome: v })} />
          <Select label="Tipo" value={item.tipo} options={TIPOS_ITEM} onChange={(v) => onChange({ ...item, tipo: v })} />
          <Select label="Slot" value={item.slot} options={SLOTS} onChange={(v) => onChange({ ...item, slot: v })} />
          <Input label="Quantidade" value={String(item.quantidade)} onChange={(v) => onChange({ ...item, quantidade: Number(v) })} keyboardType="numeric" />
          <Input label="Descrição" value={item.descricao} onChange={(v) => onChange({ ...item, descricao: v })} multiline />
          <View style={styles.modalBiblioteca}>
            <Text style={styles.modalSectionTitle}>Da Biblioteca</Text>
            {itensBiblioteca.map((bib: any) => (
              <TouchableOpacity key={bib.id} onPress={() => onChange({ ...item, nome: bib.name, tipo: bib.dados.tipo || 'Equipamento', descricao: bib.dados.descricao || '' })} style={styles.bibItem}>
                <Text style={styles.bibItemName}>{bib.name}</Text>
                <Text style={styles.bibItemType}>{bib.dados.tipo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={handleSubmit} style={styles.modalSubmit}>
          <Text style={styles.modalSubmitText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
    </View>
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

function getTipoColor(tipo: string) {
  switch (tipo) {
    case 'Arma': return '#ef4444';
    case 'Armadura': return '#3b82f6';
    case 'Consumível': return '#22c55e';
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
  itemCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 12 },
  itemMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemInfo: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemTipo: { fontSize: 11, color: 'white', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  itemDetails: { fontSize: 12, color: '#8888a0', marginBottom: 4 },
  itemDesc: { fontSize: 12, color: '#aaaaaa', marginBottom: 4 },
  itemBonus: { fontSize: 11, color: '#3b82f6', fontFamily: 'monospace' },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 8 },
  actionButtonActive: { backgroundColor: '#22c55e30', borderRadius: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16, zIndex: 1000 },
  modalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#e8e8f0' },
  modalClose: { padding: 4 },
  modalFields: { gap: 12, paddingBottom: 16 },
  modalSectionTitle: { fontSize: 14, fontWeight: '600', color: '#8888a0', marginBottom: 8, marginTop: 8 },
  bibItem: { backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 8 },
  bibItemName: { fontSize: 14, fontWeight: '500', color: '#e8e8f0' },
  bibItemType: { fontSize: 11, color: '#8888a0' },
  modalSubmit: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  modalSubmitText: { color: 'white', fontWeight: '600', fontSize: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});