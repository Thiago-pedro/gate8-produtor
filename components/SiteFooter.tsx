import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalModal } from '@/components/LegalModal';
import { PressKitModal } from '@/components/PressKitModal';
import { colors } from '@/constants/theme';
import type { LegalDocId } from '@/lib/legal';

export function SiteFooter() {
  const [kitOpen, setKitOpen] = useState(false);
  const [legal, setLegal] = useState<LegalDocId | null>(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Text style={styles.copy}>© {new Date().getFullYear()} Gate8 Tickets</Text>

      <View style={styles.links}>
        <Text style={styles.link} onPress={() => setLegal('privacy')}>
          Política de privacidade
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => setLegal('terms')}>
          Termos de uso
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => setKitOpen(true)}>
          Kit divulgação
        </Text>
      </View>

      <Text style={styles.company}>
        GATE8 INTERMEDIAÇÃO E TECNOLOGIA LTDA{'\n'}CNPJ 00.000.000/0000-00
      </Text>

      <LegalModal doc={legal} onClose={() => setLegal(null)} />
      <PressKitModal visible={kitOpen} onClose={() => setKitOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 'auto',
    paddingHorizontal: 0,
    paddingTop: 20,
    alignItems: 'center',
  },
  copy: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 12,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  link: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  dot: {
    color: colors.muted,
    fontSize: 9,
  },
  company: {
    color: colors.muted,
    fontSize: 8,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.85,
  },
});
