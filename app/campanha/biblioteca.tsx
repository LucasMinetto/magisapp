import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Ionicons } from '@expo/vector-icons';

type TipoBiblioteca = 'ritual' | 'item' | 'ameaca' | 'poder';

const TIPOS: { key: TipoBiblioteca; label: string; icon: string; color: string }[] = [
  { key: 'ritual', label: 'Rituais', icon: 'flame', color: '#f59e0b' },
  { key: 'item', label: 'Itens', icon: 'cube', color: '#3b82f6' },
  { key: 'ameaca', label: 'Ameaças', icon: 'skull', color: '#ef4444' },
  { key: 'poder', label: 'Poderes', icon: 'flash', color: '#a855f7' },
];

export default function BibliotecaScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const [tipo, setTipo] = useState<TipoBiblioteca>('ritual');
  const { data: itens, loading, error, upsert, remove } = useBiblioteca(campaignId || '', tipo);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', dados: {} as any });

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;

  const filtered = (itens || []).filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const tipoConfig = TIPOS.find(t => t.key === tipo)!;

  const handleAdd = () => {
    if (!newItem.name.trim()) return;
    upsert({ name: newItem.name.trim(), dados: newItem.dados });
    setShowAddModal(false);
    setNewItem({ name: '', dados: {} });
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remover', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.tipoSelector}>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => { setTipo(t.key); setSearch(''); }}
              style={[styles.tipoButton, tipo === t.key && styles.tipoButtonActive, { borderColor: t.color }]}
            >
              <Ionicons name={t.icon} size={20} color={tipo === t.key ? t.color : '#8888a0'} />
              <Text style={[styles.tipoButtonText, tipo === t.key && { color: t.color }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <View style={styles.searchRow}>
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Buscar..."
              style={styles.searchInput}
              leftIcon={<Ionicons name="search" size={20} color="#8888a0" />}
            />
            <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addButton, { backgroundColor: tipoConfig.color }]}>
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name={tipoConfig.icon} size={48} color="#555570" />
          <Text style={styles.emptyText}>Nenhum {tipoConfig.label.toLowerCase()} cadastrado</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addButtonSmall, { backgroundColor: tipoConfig.color }]}>
            <Text style={styles.addButtonText}>Adicionar {tipoConfig.label.slice(0, -1)}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filtered.map((item) => <BibliotecaItem key={item.id} item={item} tipo={tipo} onRemove={() => handleRemove(item.id)} />)
      )}

      {showAddModal && (
        <AddItemModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          item={newItem}
          onChange={setNewItem}
          onSubmit={handleAdd}
          tipo={tipo}
        />
      )}
    </ScrollView>
  );
}

function BibliotecaItem({ item, tipo, onRemove }: { item: any; tipo: TipoBiblioteca; onRemove: () => void }) {
  const tipoConfig = TIPOS.find(t => t.key === tipo)!;
  return (
    <TouchableOpacity style={styles.itemCard} onPress={() => {}}>
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemNome}>{item.name}</Text>
          <Text style={[styles.itemTipo, { backgroundColor: tipoConfig.color }]}>{tipoConfig.label.slice(0, -1)}</Text>
        </View>
        {item.dados.descricao && <Text style={styles.itemDesc} numberOfLines={2}>{item.dados.descricao}</Text>}
        <View style={styles.itemMeta}>
          {item.dados.custoPE && <Text style={styles.itemMetaText}>Custo: {item.dados.custoPE} PE</Text>}
          {item.dados.tipo && <Text style={styles.itemMetaText}>{item.dados.tipo}</Text>}
          {item.dados.nivel && <Text style={styles.itemMetaText}>Nível {item.dados.nivel}</Text>}
          {item.dados.dano && <Text style={styles.itemMetaText}>Dano: {item.dados.dano}</Text>}
          {item.dados.alcance && <Text style={styles.itemMetaText}>Alcance: {item.dados.alcance}</Text>}
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Ionicons name="trash-outline" size={24} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function AddItemModal({ visible, onClose, item, onChange, onSubmit, tipo }: any) {
  if (!visible) return null;
  const tipoConfig = TIPOS.find(t => t.key === tipo)!;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Novo {tipoConfig.label.slice(0, -1)}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={28} color="#8888a0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalFields}>
          <Input label="Nome" value={item.name} onChange={(v) => onChange({ ...item, name: v })} />
          {tipo === 'ritual' && (
            <>
              <Input label="Custo PE" value={String(item.dados.custoPE || '')} onChange={(v) => onChange({ ...item, dados: { ...item.dados, custoPE: Number(v) } })} keyboardType="numeric" />
              <Input label="Tipo" value={item.dados.tipo || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, tipo: v }})} />
              <Input label="Nível" value={String(item.dados.nivel || '')} onChange={(v) => onChange({ ...item, dados: { ...item.dados, nivel: Number(v) } })} keyboardType="numeric" />
              <Input label="Descrição" value={item.dados.descricao || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, descricao: v }})} multiline />
            </>
          )}
          {tipo === 'item' && (
            <>
              <Input label="Tipo" value={item.dados.tipo || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, tipo: v }})} />
              <Input label="Dano" value={item.dados.dano || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, dano: v }})} />
              <Input label="Alcance" value={item.dados.alcance || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, alcance: v }})} />
              <Input label="Descrição" value={item.dados.descricao || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, descricao: v }})} multiline />
            </>
          )}
          {tipo === 'ameaca' && (
            <>
              <Input label="Nível" value={String(item.dados.nivel || '')} onChange={(v) => onChange({ ...item, dados: { ...item.dados, nivel: Number(v) } })} keyboardType="numeric" />
              <Input label="PV" value={String(item.dados.pv || '')} onChange={(v) => onChange({ ...item, dados: { ...item.dados, pv: Number(v) } })} keyboardType="numeric" />
              <Input label="Descrição" value={item.dados.descricao || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, descricao: v }})} multiline />
            </>
          )}
          {tipo === 'poder' && (
            <>
              <Input label="Custo" value={item.dados.custo || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, custo: v }})} />
              <Input label="Descrição" value={item.dados.descricao || ''} onChange={(v) => onChange({ ...item, dados: { ...item.dados, descricao: v }})} multiline />
            </>
          )}
        </ScrollView>
        <TouchableOpacity onPress={onSubmit} style={[styles.modalSubmit, { backgroundColor: tipoConfig.color }]}>
          <Text style={styles.modalSubmitText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LoadingView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>; }
function ErrorView({ message }: { message: string }) { return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 16 },
  tipoSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1a1a2e', borderRadius: 20, borderWidth: 2, borderColor: '#2a2a3e' },
  tipoButtonActive: { backgroundColor: 'rgba(59,130,246,0.1)' },
  tipoButtonText: { fontSize: 13, fontWeight: '600', color: '#aaaaaa' },
  card: { marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1 },
  addButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 16, color: '#8888a0' },
  addButtonSmall: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  addButtonText: { color: 'white', fontWeight: '600' },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 12 },
  itemInfo: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemTipo: { fontSize: 11, color: 'white', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  itemDesc: { fontSize: 12, color: '#aaaaaa', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemMetaText: { fontSize: 11, color: '#8888a0', backgroundColor: '#0f0f1a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  removeButton: { padding: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16, zIndex: 1000 },
  modalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e', paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#e8e8f0' },
  modalClose: { padding: 4 },
  modalFields: { gap: 12, paddingBottom: 16 },
  modalSubmit: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  modalSubmitText: { color: 'white', fontWeight: '600', fontSize: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});