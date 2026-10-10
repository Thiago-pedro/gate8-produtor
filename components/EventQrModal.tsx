import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { eventQrPngBase64 } from '@/lib/event-qr';

const FILE_NAME = 'gate8-evento-qrcode.png';

type EventQrModalProps = {
  visible: boolean;
  url: string;
  eventName: string;
  onClose: () => void;
  onToast: (message: string) => void;
};

export function EventQrModal({ visible, url, eventName, onClose, onToast }: EventQrModalProps) {
  const [busy, setBusy] = useState<'copy' | 'share' | 'download' | null>(null);
  const image = useMemo(() => {
    if (!visible || !url) return null;
    try {
      return eventQrPngBase64(url);
    } catch {
      return null;
    }
  }, [visible, url]);

  async function fileUri() {
    if (!image) return null;
    const directory = FileSystem.cacheDirectory;
    if (!directory) return null;
    const uri = `${directory}${FILE_NAME}`;
    await FileSystem.writeAsStringAsync(uri, image, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  }

  async function copyImage() {
    if (!image || busy) return;
    setBusy('copy');
    try {
      await Clipboard.setImageAsync(image);
      onToast('QR Code copiado');
    } catch {
      onToast('Não foi possível copiar a imagem. Use Baixar QR Code.');
    } finally {
      setBusy(null);
    }
  }

  async function shareImage(download: boolean) {
    if (!image || busy) return;
    setBusy(download ? 'download' : 'share');
    try {
      const uri = await fileUri();
      if (!uri || !(await Sharing.isAvailableAsync())) {
        onToast('Não foi possível abrir o QR Code neste aparelho.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: download ? 'Baixar QR Code' : eventName,
        UTI: 'public.png',
      });
    } catch {
      onToast(download ? 'Não foi possível baixar o QR Code.' : 'Não foi possível compartilhar o QR Code.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="qr-code" size={18} color={colors.blue} />
              <Text style={styles.title}>QR Code do evento</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.name}>{eventName}</Text>
          <View style={styles.frame}>
            {image ? (
              <Image
                source={{ uri: `data:image/png;base64,${image}` }}
                style={styles.qr}
                resizeMode="contain"
                accessibilityLabel={`QR Code do link de ${eventName}`}
              />
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.fallbackText}>Não foi possível gerar o QR Code.</Text>
              </View>
            )}
          </View>
          <View style={styles.actions}>
            <Pressable
              disabled={!image || Boolean(busy)}
              onPress={() => void copyImage()}
              style={({ pressed }) => [styles.primary, (!image || busy) && styles.disabled, pressed && styles.pressed]}
            >
              <Ionicons name="copy-outline" size={16} color={colors.loginText} />
              <Text style={styles.primaryText}>{busy === 'copy' ? 'Copiando...' : 'Copiar QR Code'}</Text>
            </Pressable>
            <Pressable
              disabled={!image || Boolean(busy)}
              onPress={() => void shareImage(false)}
              style={({ pressed }) => [styles.outline, (!image || busy) && styles.disabled, pressed && styles.pressed]}
            >
              <Ionicons name="share-social-outline" size={16} color={colors.text} />
              <Text style={styles.outlineText}>{busy === 'share' ? 'Abrindo...' : 'Compartilhar'}</Text>
            </Pressable>
          </View>
          <Pressable
            disabled={!image || Boolean(busy)}
            onPress={() => void shareImage(true)}
            style={({ pressed }) => [styles.download, pressed && styles.pressed]}
          >
            <Ionicons name="download-outline" size={16} color={colors.text} />
            <Text style={styles.downloadText}>{busy === 'download' ? 'Abrindo...' : 'Baixar QR Code'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,16,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#071426',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  name: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  frame: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 288,
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  qr: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  fallbackText: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  primaryText: {
    color: colors.loginText,
    fontSize: 13,
    fontWeight: '700',
  },
  outline: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  outlineText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  download: {
    marginTop: 12,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
});
