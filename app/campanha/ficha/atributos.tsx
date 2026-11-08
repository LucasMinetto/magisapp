import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const CLASSES = ['Combatente', 'Especialista', 'Ocultista'];
const TRACOS = ['Armadilhas', 'Armas Brancas', 'Armas de Fogo', 'Computadores', 'Corpo a Corpo', 'Demolição', 'Direção', 'Disfarces', 'Furtividade', 'Interrogação', 'Investigação', 'Lábia', 'Medicina', 'Ocultismo', 'Ofício', 'Percepção', 'Pilotagem', 'Pontaria', 'Reflexos', 'Sobrevivência', 'Tática', 'Tecnologia', 'Vontade'];

export default function FichaAtributosScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error, upsert } = useFicha(campaignId || '', 'user-1');

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const handleChange = (field: string, value: any) => {
    const newData = { ...ficha.sheet_data, [field]: value };
    upsert({ id: ficha.id, sheet_data: newData, updated_at: new Date().toISOString() });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Classe e NEX</Text>
          <View style={styles.fieldRow}>
            <Select
              label="Classe"
              value={ficha.sheet_data.classe}
              options={CLASSES}
              onChange={(v) => handleChange('classe', v)}
            />
            <Input
              label="NEX %"
              value={String(ficha.sheet_data.nex)}
              onChange={(v) => handleChange('nex', Number(v))}
              keyboardType="numeric"
              style={styles.smallInput}
            />
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Atributos</Text>
          <View style={styles.attrGrid}>
            {(['agi', 'for', 'int', 'pre', 'vig'] as const).map((attr) => (
              <AttrInput
                key={attr}
                label={attr.toUpperCase()}
                value={ficha.sheet_data.atributos[attr]}
                onChange={(v) => {
                  const newAttrs = { ...ficha.sheet_data.atributos, [attr]: Number(v) };
                  handleChange('atributos', newAttrs);
                }}
              />
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Perícias</Text>
          <View style={styles.periciaGrid}>
            {Object.entries(ficha.sheet_data.pericias).map(([nome, data]) => (
              <PericiaInput
                key={nome}
                nome={nome}
                treino={data.treino}
                extra={data.extra}
                onTreinoChange={(v) => {
                  const newPericias = { ...ficha.sheet_data.pericias, [nome]: { ...data, treino: Number(v) } };
                  handleChange('pericias', newPericias);
                }}
                onExtraChange={(v) => {
                  const newPericias = { ...ficha.sheet_data.pericias, [nome]: { ...data, extra: Number(v) } };
                  handleChange('pericias', newPericias);
                }}
              />
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Traços</Text>
          <View style={styles.tracosGrid}>
            {TRACOS.map((traco) => (
              <TracoInput
                key={traco}
                label={traco}
                value={ficha.sheet_data.tracos?.[traco] || 0}
                onChange={(v) => {
                  const newTracos = { ...(ficha.sheet_data.tracos || {}), [traco]: Number(v) };
                  handleChange('tracos', newTracos);
                }}
              />
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
      <Text style={{ color: '#8888a0' }}>Carregando...</Text>
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
      <Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha encontrada.</Text>
    </View>
  );
}

function AttrInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <View style={styles.attrInputWrapper}>
      <Text style={styles.attrInputLabel}>{label}</Text>
      <Input
        value={String(value)}
        onChange={onChange}
        keyboardType="numeric"
        style={styles.attrInput}
      />
    </View>
  );
}

function PericiaInput({ nome, treino, extra, onTreinoChange, onExtraChange }: { nome: string; treino: number; extra: number; onTreinoChange: (v: string) => void; onExtraChange: (v: string) => void }) {
  return (
    <View style={styles.periciaInputWrapper}>
      <Text style={styles.periciaInputNome}>{nome}</Text>
      <View style={styles.periciaInputRow}>
        <Input label="Treino" value={String(treino)} onChange={onTreinoChange} keyboardType="numeric" style={styles.periciaInput} />
        <Input label="Extra" value={String(extra)} onChange={onExtraChange} keyboardType="numeric" style={styles.periciaInput} />
      </View>
    </View>
  );
}

function TracoInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <View style={styles.tracoInputWrapper}>
      <Text style={styles.tracoInputLabel}>{label}</Text>
      <Input
        value={String(value)}
        onChange={onChange}
        keyboardType="numeric"
        style={styles.tracoInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8e8f0',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallInput: {
    flex: 1,
    maxWidth: 100,
  },
  attrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attrInputWrapper: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  attrInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8888a0',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  attrInput: {
    width: 80,
  },
  periciaGrid: {
    gap: 8,
  },
  periciaInputWrapper: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
  },
  periciaInputNome: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e8e8f0',
    marginBottom: 8,
  },
  periciaInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  periciaInput: {
    flex: 1,
  },
  tracosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tracoInputWrapper: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 8,
  },
  tracoInputLabel: {
    fontSize: 11,
    color: '#8888a0',
    marginBottom: 4,
  },
  tracoInput: {
    width: '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});