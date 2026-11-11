import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type ErrorNotice = {
  title: string;
  message: string;
};

type ErrorNoticeContextValue = {
  showError: (message: string, title?: string) => void;
  clearError: () => void;
};

const ErrorNoticeContext = createContext<ErrorNoticeContextValue | null>(null);

const fallbackNotice: ErrorNoticeContextValue = {
  showError: () => {},
  clearError: () => {},
};

export function useErrorNotice() {
  return useContext(ErrorNoticeContext) ?? fallbackNotice;
}

function messageFromUnknown(value: unknown) {
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return 'Algo deu errado. Tente de novo.';
}

export function ErrorNoticeProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<ErrorNotice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef('');

  const clearError = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setNotice(null);
    lastKey.current = '';
  }, []);

  const showError = useCallback((message: string, title = 'Aviso') => {
    const clean = messageFromUnknown(message);
    const key = `${title}|${clean}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (timer.current) clearTimeout(timer.current);
    setNotice({ title, message: clean });
    timer.current = setTimeout(() => {
      setNotice(null);
      lastKey.current = '';
      timer.current = null;
    }, 5200);
  }, []);

  const value = useMemo(() => ({ showError, clearError }), [showError, clearError]);

  return (
    <ErrorNoticeContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {notice ? (
          <View style={[styles.bannerWrap, { top: Math.max(insets.top, 12) + 8 }]}>
            <View style={styles.banner}>
              <View style={styles.copy}>
                <Text style={styles.title}>{notice.title}</Text>
                <Text style={styles.message}>{notice.message}</Text>
              </View>
              <Pressable onPress={clearError} hitSlop={10} style={styles.close}>
                <Text style={styles.closeText}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ErrorNoticeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bannerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 80,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(28, 10, 18, 0.94)',
    borderColor: 'rgba(255, 92, 122, 0.55)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    paddingTop: 2,
  },
  closeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
