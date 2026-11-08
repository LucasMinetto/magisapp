import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { useArquivo } from '@/hooks/useArquivo';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

type ArquivoTipo = 'ficha' | 'handout' | 'mapa' | 'outro';

const TIPOS: { key: ArquivoTipo; label: string; icon: string; color: string }[] = [
  { key: 'ficha', label: 'Fichas', icon: 'document', color: '#3b82f6' },
  { key: 'handout', label: 'Handouts', icon: 'newspaper', color: '#a855f7' },
  { key: 'mapa', label: 'Mapas', icon: 'map', color: '#22c55e' },
  { key: 'outro', label: 'Outros', icon: 'folder', color: '#f59e0b' },
];

export default function ArquivoScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const [tipo, setTipo] = useState<ArquivoTipo>('handout');
  const { data: arquivos, loading, error, upsert, remove } = useArquivo(campaignId || '', tipo);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newArquivo, setNewArquivo] = useState({ titulo: '', descricao: '', uri: '', tags: '' });

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;

  const filtered = (arquivos || []).filter(a =>
    a.titulo.toLowerCase().includes(search.toLowerCase())
  );

  const tipoConfig = TIPOS.find(t => t.key === tipo)!;

  const handleAdd = () => {
    if (!newArquivo.titulo.trim()) return;
    upsert({
      titulo: newArquivo.titulo.trim(),
      descricao: newArquivo.descricao,
      uri: newArquivo.uri,
      tags: newArquivo.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
    });
    setShowAddModal(false);
    setNewArquivo({ titulo: '', descricao: '', uri: '', tags: '' });
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
          <Text style={styles.emptyText}>Nenhum {tipoConfig.label.toLowerCase()} salvo</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addButtonSmall, { backgroundColor: tipoConfig.color }]}>
            <Text style={styles.addButtonText}>Adicionar {tipoConfig.label.slice(0, -1)}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filtered.map((arquivo) => <ArquivoItem key={arquivo.id} arquivo={arquivo} onRemove={() => handleRemove(arquivo.id)} />)
      )}

      {showAddModal && (
        <AddArquivoModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          arquivo={newArquivo}
          onChange={setNewArquivo}
          onSubmit={handleAdd}
        />
      )}
    </ScrollView>
  );
}

function ArquivoItem({ arquivo, onRemove }: { arquivo: any; onRemove: () => void }) {
  const isImage = arquivo.uri && /\.(jpg|jpeg|png|gif|webp)$/i.test(arquivo.uri);

  return (
    <TouchableOpacity style={styles.itemCard} onPress={() => {}}>
      <View style={styles.itemPreview}>
        {isImage && arquivo.uri ? (
          <Image source={{ uri: arquivo.uri }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.itemPlaceholder}>
            <Ionicons name="document-text-outline" size={32} color="#555570" />
          </View>
        )}
      </View>
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitulo}>{arquivo.titulo}</Text>
        </View>
        {arquivo.descricao && <Text style={styles.itemDesc} numberOfLines={2}>{arquivo.descricao}</Text>}
        {arquivo.tags && arquivo.tags.length > 0 && (
          <View style={styles.itemTags}>
            {arquivo.tags.slice(0, 4).map((tag: string) => (
              <Text key={tag} style={styles.itemTag}>{tag}</Text>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Ionicons name="trash-outline" size={24} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function AddArquivoModal({ visible, onClose, arquivo, onChange, onSubmit }: any) {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Novo Arquivo</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={28} color="#8888a0" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalFields}>
          <Input label="Título" value={arquivo.titulo} onChange={(v) => onChange({ ...arquivo, titulo: v })} />
          <Input label="Descrição" value={arquivo.descricao} onChange={(v) => onChange({ ...arquivo, descricao: v })} multiline />
          <Input label="URI (link ou caminho)" value={arquivo.uri} onChange={(v) => onChange({ ...arquivo, uri: v })} />
          <Input label="Tags (separadas por vírgula)" value={arquivo.tags} onChange={(v) => onChange({ ...arquivo, tags: v })} />
        </ScrollView>
        <TouchableOpacity onPress={onSubmit} style={styles.modalSubmit}>
          <Text style={styles.modalSubmitText}>Salvar</Text>
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
  itemCard: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 12 },
  itemPreview: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemImage: { width: '100%', height: '100%', borderRadius: 8 },
  itemPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemHeader: { marginBottom: 4 },
  itemTitulo: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemDesc: { fontSize: 12, color: '#aaaaaa', marginBottom: 8 },
  itemTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemTag: { fontSize: 10, color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  removeButton: { padding: 8, marginLeft: 8 },
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