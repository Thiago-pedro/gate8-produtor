import {
  Sora_400Regular,
  Sora_600SemiBold,
  Sora_700Bold,
  useFonts,
} from '@expo-google-fonts/sora';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  biometricsAvailable,
  confirmDeviceOwner,
  readBiometricPreference,
  writeBiometricPreference,
} from '@/lib/biometric';

const biometricMark = require('../assets/images/biometria-digital.png');
const offered = new Set<string>();

export function BiometricGate() {
  const { user, locked, unlock, signOut } = useAuth();
  const [offerUserId, setOfferUserId] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const prompting = useRef(false);
  const deciding = useRef(false);

  useEffect(() => {
    if (!locked) {
      setShowFallback(false);
      return;
    }
    if (prompting.current) return;
    prompting.current = true;
    setShowFallback(false);
    void unlock().finally(() => {
      prompting.current = false;
      setShowFallback(true);
    });
  }, [locked, unlock]);

  async function retryUnlock() {
    if (prompting.current) return;
    prompting.current = true;
    setShowFallback(false);
    try {
      await unlock();
    } finally {
      prompting.current = false;
      setShowFallback(true);
    }
  }

  useEffect(() => {
    if (!user) {
      setOfferUserId(null);
      return;
    }
    if (offered.has(user.id)) return;
    let cancelled = false;
    void (async () => {
      const preference = await readBiometricPreference(user.id);
      if (cancelled || preference !== 'unset' || offered.has(user.id)) return;
      if (!(await biometricsAvailable())) return;
      if (cancelled || offered.has(user.id)) return;
      offered.add(user.id);
      setOfferUserId(user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function dismissOffer() {
    if (!user || deciding.current) return;
    deciding.current = true;
    setOfferUserId(null);
    try {
      await writeBiometricPreference(user.id, 'off');
    } finally {
      deciding.current = false;
    }
  }

  async function activateOffer() {
    if (!user || deciding.current) return;
    deciding.current = true;
    setOfferUserId(null);
    try {
      const accepted = await confirmDeviceOwner();
      await writeBiometricPreference(user.id, accepted ? 'on' : 'off');
    } finally {
      deciding.current = false;
    }
  }

  return (
    <>
      {locked ? (
        <View style={styles.blocker} pointerEvents="auto">
          {showFallback ? (
            <View style={styles.fallback}>
              <Text style={styles.unlockTitle}>Desbloquear</Text>
              <Text style={styles.lead}>Use a digital ou o rosto deste celular.</Text>
              <Pressable onPress={() => void retryUnlock()} style={styles.unlockButton}>
                <Text style={styles.unlockButtonText}>Desbloquear</Text>
              </Pressable>
              <Pressable onPress={() => void signOut()} style={styles.password}>
                <Text style={styles.passwordText}>Entrar com e-mail e senha</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
      {offerUserId ? (
        <BiometricOffer onActivate={() => void activateOffer()} onDismiss={() => void dismissOffer()} />
      ) : null}
    </>
  );
}

function BiometricOffer({ onActivate, onDismiss }: { onActivate: () => void; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 740;
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_600SemiBold,
    Sora_700Bold,
  });
  const titleFont = fontsLoaded ? 'Sora_700Bold' : undefined;
  const bodyFont = fontsLoaded ? 'Sora_400Regular' : undefined;
  const buttonFont = fontsLoaded ? 'Sora_600SemiBold' : undefined;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12),
            paddingHorizontal: 24,
          },
        ]}
      >
        <View style={[styles.card, { maxWidth: Math.min(width - 48, 420), maxHeight: height - insets.top - insets.bottom - 24 }]}>
          <Image source={biometricMark} style={compact ? styles.markCompact : styles.mark} resizeMode="contain" />
          <Text style={[styles.title, compact && styles.titleCompact, titleFont ? { fontFamily: titleFont } : null]}>
            Acesso rápido e seguro
          </Text>
          <Text style={[styles.body, compact && styles.bodyCompact, bodyFont ? { fontFamily: bodyFont } : null]}>
            Use a digital ou o reconhecimento facial do seu aparelho para acessar sua conta com mais praticidade.
          </Text>
          <Pressable
            onPress={onActivate}
            style={({ pressed }) => [styles.primary, compact && styles.primaryCompact, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryText, buttonFont ? { fontFamily: buttonFont } : null]}>Ativar autenticação</Text>
          </Pressable>
          <Pressable onPress={onDismiss} hitSlop={8} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={[styles.secondaryText, buttonFont ? { fontFamily: buttonFont } : null]}>Agora não</Text>
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.footer}>
            <PrivacyShield />
            <View style={styles.footerBar} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.footerText, bodyFont ? { fontFamily: bodyFont } : null]}
            >
              Seus dados biométricos permanecem no aparelho.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PrivacyShield() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M12 2.8l7 2.6v6.4c0 4.6-2.9 7.6-7 9.4-4.1-1.8-7-4.8-7-9.4V5.4l7-2.6z"
        stroke="#9AABC4"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <Path d="M8.6 12.1l2.3 2.3 4.6-5" stroke="#9AABC4" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  blocker: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  unlockTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  lead: {
    color: colors.muted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  unlockButton: {
    marginTop: 28,
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  unlockButtonText: {
    color: colors.loginText,
    fontSize: 16,
    fontWeight: '700',
  },
  password: {
    marginTop: 18,
    padding: 8,
  },
  passwordText: {
    color: colors.muted,
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 22, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#071329',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#0066FF',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  mark: {
    width: 84,
    height: 78,
  },
  markCompact: {
    width: 72,
    height: 67,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  titleCompact: {
    fontSize: 18,
    marginTop: 6,
  },
  body: {
    color: '#B8C4D9',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  bodyCompact: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 6,
  },
  primary: {
    alignSelf: 'stretch',
    height: 48,
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: '#087BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCompact: {
    height: 44,
    marginTop: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondary: {
    minHeight: 36,
    marginTop: 2,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#0784FF',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  divider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(120, 156, 196, 0.45)',
    marginTop: 8,
  },
  footer: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  footerBar: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(154, 171, 196, 0.55)',
    marginHorizontal: 8,
  },
  footerText: {
    flex: 1,
    color: '#A9B7CC',
    fontSize: 11,
    lineHeight: 14,
  },
});
