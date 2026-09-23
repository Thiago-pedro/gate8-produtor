import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type AuthKeyboardValue = {
  keyboardOpen: boolean;
  ensureVisible: (node: View | null) => void;
};

const AuthKeyboardContext = createContext<AuthKeyboardValue>({
  keyboardOpen: false,
  ensureVisible: () => undefined,
});

export function useAuthKeyboard() {
  return useContext(AuthKeyboardContext);
}

export function AuthScreenShell({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const keyboardHeight = useRef(0);
  const pending = useRef<View | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  function reveal(node: View | null) {
    if (!node || keyboardHeight.current <= 0) return;

    setTimeout(() => {
      node.measureInWindow((_x, y, _w, h) => {
        const visibleBottom = Dimensions.get('window').height - keyboardHeight.current - 20;
        const overflow = y + h - visibleBottom;
        if (overflow > 0) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, offsetY.current + overflow),
            animated: true,
          });
        }
      });
    }, 60);
  }

  function ensureVisible(node: View | null) {
    pending.current = node;
    reveal(node);
  }

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        keyboardHeight.current = event.endCoordinates.height;
        setKeyboardOpen(true);
        reveal(pending.current);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardHeight.current = 0;
        pending.current = null;
        setKeyboardOpen(false);
      }
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <AuthKeyboardContext.Provider value={{ keyboardOpen, ensureVisible }}>
      <View style={styles.root}>
        <LinearGradient
          colors={['rgba(0, 123, 255, 0.22)', colors.bg, colors.bg]}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <SafeAreaView style={styles.root} edges={['top']}>
            {header}
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                offsetY.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.content,
                keyboardOpen && { paddingBottom: Math.max(24, keyboardHeight.current * 0.12) },
              ]}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </AuthKeyboardContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
});
