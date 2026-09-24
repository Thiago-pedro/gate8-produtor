import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

const PRESSKIT = require('../assets/presskit/presskit.png');
const KIT_BLUE = '#738FC1';

const LOGOS = [
  { id: 'original', label: 'Original', source: require('../assets/presskit/logo-original.png') },
  { id: 'preto', label: 'Preto', source: require('../assets/presskit/logo-preto.png') },
  { id: 'branco', label: 'Branco', source: require('../assets/presskit/logo-branco.png') },
  { id: 'azul', label: 'Azul', source: require('../assets/presskit/logo-azul.png') },
] as const;

type PressKitModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PressKitModal({ visible, onClose }: PressKitModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState<string | null>(null);

  const pageSize = useMemo(() => {
    const asset = Image.resolveAssetSource(PRESSKIT);
    const pageWidth = windowWidth;
    const pageHeight = pageWidth * (asset.height / asset.width);
    const tileWidth = (windowWidth - 48) / 2;
    return { pageWidth, pageHeight, tileWidth };
  }, [windowWidth]);

  async function shareLogo(logo: (typeof LOGOS)[number]) {
    if (downloading) return;
    setDownloading(logo.id);
    try {
      const asset = Asset.fromModule(logo.source);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Download indisponível', 'Não foi possível abrir o logo neste aparelho.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Logo Gate8 ${logo.label}`,
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('Não foi possível baixar o logo', 'Tente de novo em instantes.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.toolbar}>
            <Text style={styles.toolbarTitle}>Kit divulgação</Text>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons name="close" size={26} color="#111111" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
            showsVerticalScrollIndicator
            bounces={false}
          >
            <Image
              source={PRESSKIT}
              accessibilityLabel="Kit divulgação Gate8"
              resizeMode="contain"
              style={{ width: pageSize.pageWidth, height: pageSize.pageHeight }}
            />

            <View style={styles.downloadBlock}>
              <Text style={styles.downloadTitle}>Fazer Download</Text>
              <Text style={styles.downloadHint}>Escolha a cor do logo oficial.</Text>
              <View style={styles.grid}>
                {LOGOS.map((logo) => {
                  const busy = downloading === logo.id;
                  return (
                    <Pressable
                      key={logo.id}
                      onPress={() => void shareLogo(logo)}
                      disabled={Boolean(downloading)}
                      accessibilityLabel={`Download logo ${logo.label}`}
                      style={({ pressed }) => [{ width: pageSize.tileWidth }, pressed && styles.pressed]}
                    >
                      <View style={styles.shadow}>
                        <LinearGradient
                          colors={['#4da3ff', '#007BFF', '#0056b3', '#007BFF', '#4da3ff']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.border}
                        >
                          <View style={styles.inner}>
                            {busy ? (
                              <ActivityIndicator color={colors.blue} />
                            ) : (
                              <Image source={logo.source} resizeMode="contain" style={styles.tileLogo} />
                            )}
                          </View>
                        </LinearGradient>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: KIT_BLUE,
  },
  safe: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolbarTitle: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 0,
  },
  downloadBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  downloadTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  downloadHint: {
    color: '#1a1a1a',
    fontSize: 13,
    marginBottom: 14,
    opacity: 0.78,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  shadow: {
    shadowColor: colors.blue,
    shadowOpacity: 0.85,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  border: {
    borderRadius: 22,
    padding: 1.6,
  },
  inner: {
    backgroundColor: KIT_BLUE,
    borderRadius: 20.5,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 22,
  },
  tileLogo: {
    width: '100%',
    height: 34,
  },
  pressed: {
    opacity: 0.86,
  },
});
