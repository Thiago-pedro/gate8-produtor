import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { LEGAL_DOCS, type LegalDocId } from '@/lib/legal';

export function LegalModal({ doc, onClose }: { doc: LegalDocId | null; onClose: () => void }) {
  const content = doc ? LEGAL_DOCS[doc] : null;

  return (
    <Modal visible={Boolean(content)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {content ? (
            <>
              <Text style={styles.title}>{content.title}</Text>
              <Text style={styles.updated}>Última atualização: {content.updated}</Text>
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.body}>{content.intro}</Text>
                {content.sections.map((section) => (
                  <View key={section.heading} style={styles.section}>
                    <Text style={styles.heading}>{section.heading}</Text>
                    {section.body ? <Text style={styles.body}>{section.body}</Text> : null}
                    {section.bullets?.map((item) => (
                      <Text key={item} style={styles.bullet}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
                <Text style={styles.btnText}>Fechar</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,13,31,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: Dimensions.get('window').height * 0.86,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.35)',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  updated: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  scroll: {
    maxHeight: Dimensions.get('window').height * 0.58,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 14,
  },
  section: {
    gap: 6,
  },
  heading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  bullet: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 4,
  },
  btn: {
    marginTop: 14,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  btnText: {
    color: colors.loginText,
    fontWeight: '800',
    fontSize: 15,
  },
});
