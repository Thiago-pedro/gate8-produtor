import { Image, StyleSheet } from 'react-native';

export function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <Image
      accessibilityLabel="Gate8"
      source={require('../assets/images/logo-gate8.png')}
      style={[styles.logo, { height, width: height * 5.4 }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});
