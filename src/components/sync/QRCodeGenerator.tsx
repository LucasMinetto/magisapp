import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import { encodeQRPayload, buildDeepLinkUrl, QRCodePayload } from '@/hooks/useQRCode';

interface QRCodeGeneratorProps {
  payload: QRCodePayload;
  size?: number;
  showDeepLink?: boolean;
  onCopyDeepLink?: () => void;
}

export function QRCodeGenerator({
  payload,
  size = 256,
  showDeepLink = true,
  onCopyDeepLink,
}: QRCodeGeneratorProps) {
  const base64 = encodeQRPayload(payload);
  const deepLinkUrl = buildDeepLinkUrl(base64);
  const qrValue = deepLinkUrl; // QR contains the deep link URL

  const handleCopyDeepLink = () => {
    if (onCopyDeepLink) {
      onCopyDeepLink();
    } else {
      // Fallback: show alert with the link
      Alert.alert(
        'Link de Sincronização',
        `Copie este link para compartilhar:\n\n${deepLinkUrl}`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Card style={styles.card}>
      <CardContent>
        <Text style={styles.title}>QR Code de Sincronização</Text>
        <Text style={styles.subtitle}>
          Escaneie com outro dispositivo ou use o link profundo
        </Text>

        <View style={[styles.qrContainer, { width: size, height: size }]}>
          <QRCode
            value={qrValue}
            size={size}
            level="M"
            includeMargin={true}
            bgColor="#ffffff"
            fgColor="#1a1a2e"
          />
        </View>

        <Text style={styles.caption}>
          magistrado://sync?data={base64}
        </Text>

        {showDeepLink && (
          <TouchableOpacity onPress={handleCopyDeepLink} style={styles.linkButton}>
            <Ionicons name="link-outline" size={20} color="white" style={styles.linkIcon} />
            <Text style={styles.linkText}>Copiar Link Profundo</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Credenciais incluídas:</Text>
          <Text style={styles.infoValue}>{payload.serverUrl}</Text>
          <Text style={styles.infoValue}>@{payload.username}</Text>
          <Text style={styles.infoValue}>Campanha: {payload.campaignId}</Text>
        </View>

        <Text style={styles.warning}>
          ⚠️ Este QR contém senha. Compartilhe apenas com jogadores de confiança.
        </Text>
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e8e8f0',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#8888a0',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  caption: {
    fontSize: 11,
    color: '#8888a0',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  linkIcon: {
    marginTop: 1,
  },
  linkText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e8e8f0',
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 12,
    color: '#a0a0b8',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  warning: {
    fontSize: 11,
    color: '#f59e0b',
    textAlign: 'center',
    fontWeight: '500',
  },
});