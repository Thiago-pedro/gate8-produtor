import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';

const LOGO = require('../assets/images/logo-gate8.png');
const LOGO_RATIO = 5.4;

type PressKitModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PressKitModal({ visible, onClose }: PressKitModalProps) {
  const [downloading, setDownloading] = useState(false);

  async function downloadLogo() {
    if (downloading) return;
    setDownloading(true);
    try {
      const asset = Asset.fromModule(LOGO);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Logo oficial Gate8',
          UTI: 'public.png',
        });
        return;
      }
      Alert.alert('Download indisponível', 'Não foi possível abrir o logo neste aparelho.');
    } catch {
      Alert.alert('Não foi possível baixar o logo', 'Tente de novo em instantes.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <LinearGradient colors={['#007BFF', '#0056b3']} style={styles.hero}>
              <View style={styles.heroTitleRow}>
                <Ionicons name="ticket-outline" size={26} color="#fff" />
                <Text style={styles.heroTitle}>Presskit</Text>
              </View>
              <Text style={styles.heroSubtitle}>Manual de uso da marca</Text>
              <Text style={styles.heroCopy}>
                Utilize nosso logo no seu material para promover seu evento!
              </Text>
            </LinearGradient>

            <View style={styles.section}>
              <Text style={styles.heading}>Uso de cores</Text>
              <Text style={styles.body}>
                Nunca altere a cor do logo, sempre use as cores oficiais da Gate8.
              </Text>
              <Text style={styles.caption}>Uso de cores permitido</Text>
              <View style={styles.colorRows}>
                <AllowedColorRow bg="#000000" />
                <AllowedColorRow bg={colors.blue} />
                <AllowedColorRow bg="#050d1f" />
              </View>
              <View style={styles.compareRow}>
                <ExampleBlock ok label="Certo">
                  <BrandLogo width={118} height={22} />
                </ExampleBlock>
                <ExampleBlock ok={false} label="Errado">
                  <BrandLogo width={118} height={22} tint="#e53935" />
                </ExampleBlock>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.heading}>Redimensionamento</Text>
              <Text style={styles.body}>
                Cuidado ao aumentar ou diminuir de tamanho para não distorcer o logo.
              </Text>
              <View style={styles.resizeRow}>
                <ExampleBlock ok={false} label="Errado">
                  <BrandLogo width={92} height={28} resizeMode="stretch" />
                </ExampleBlock>
                <ExampleBlock ok={false} label="Errado">
                  <BrandLogo width={64} height={32} resizeMode="stretch" />
                </ExampleBlock>
                <ExampleBlock ok={false} label="Errado">
                  <BrandLogo width={88} height={10} resizeMode="stretch" />
                </ExampleBlock>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.heading}>Logo legível</Text>
              <Text style={styles.body}>
                Sempre confira se o logo da Gate8 está com boa qualidade e legível.
              </Text>
              <View style={styles.compareRow}>
                <ExampleBlock ok label="Certo">
                  <BrandLogo width={124} height={23} />
                </ExampleBlock>
                <ExampleBlock ok={false} label="Errado">
                  <Image
                    source={LOGO}
                    accessibilityLabel="Logo ilegível"
                    resizeMode="contain"
                    style={styles.blurryLogo}
                  />
                </ExampleBlock>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.heading}>Download logo Gate8</Text>
              <Text style={styles.body}>Clique no botão para obter nosso logo oficial.</Text>
              <Pressable
                onPress={() => void downloadLogo()}
                disabled={downloading}
                style={({ pressed }) => [styles.downloadBtn, pressed && styles.pressed]}
              >
                {downloading ? (
                  <ActivityIndicator color={colors.loginText} />
                ) : (
                  <Text style={styles.downloadText}>Fazer Download</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>

          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function BrandLogo({
  width,
  height = width / LOGO_RATIO,
  tint,
  resizeMode = 'contain',
}: {
  width: number;
  height?: number;
  tint?: string;
  resizeMode?: 'contain' | 'stretch';
}) {
  return (
    <Image
      source={LOGO}
      accessibilityLabel="Gate8"
      resizeMode={resizeMode}
      style={{ width, height, tintColor: tint }}
    />
  );
}

function AllowedColorRow({ bg }: { bg: string }) {
  return (
    <View style={styles.allowedRow}>
      <View style={[styles.allowedCell, styles.allowedLight]}>
        <BrandLogo width={108} height={20} />
      </View>
      <View style={[styles.allowedCell, { backgroundColor: bg }]}>
        <BrandLogo width={108} height={20} />
      </View>
    </View>
  );
}

function ExampleBlock({
  ok,
  label,
  children,
}: {
  ok: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.example}>
      <View style={styles.exampleLabelRow}>
        <Ionicons
          name={ok ? 'checkmark' : 'close'}
          size={14}
          color={ok ? '#1aa05a' : '#e53935'}
        />
        <Text style={[styles.exampleLabel, { color: ok ? '#1aa05a' : '#e53935' }]}>{label}</Text>
      </View>
      <View style={styles.exampleBox}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,13,31,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: Dimensions.get('window').height * 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  scroll: {
    maxHeight: Dimensions.get('window').height * 0.74,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  heroCopy: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  heading: {
    color: '#1a1a1a',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    color: '#5b5b5b',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  caption: {
    color: '#8a8a8a',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  colorRows: {
    gap: 8,
    marginBottom: 16,
  },
  allowedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  allowedCell: {
    flex: 1,
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  allowedLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 16,
  },
  resizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  example: {
    flex: 1,
    alignItems: 'flex-start',
  },
  exampleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  exampleBox: {
    minHeight: 36,
    justifyContent: 'center',
  },
  blurryLogo: {
    width: 90,
    height: 16,
    opacity: 0.38,
    transform: [{ scale: 0.72 }],
  },
  divider: {
    height: 1,
    backgroundColor: '#ececec',
    marginHorizontal: 20,
    marginTop: 10,
  },
  downloadBtn: {
    alignSelf: 'flex-start',
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
    marginTop: 4,
    marginBottom: 8,
  },
  downloadText: {
    color: colors.loginText,
    fontWeight: '800',
    fontSize: 14,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 6,
  },
  closeText: {
    color: '#6b6b6b',
    fontWeight: '600',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.86,
  },
});
