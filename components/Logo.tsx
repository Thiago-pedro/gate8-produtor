import { Image, StyleSheet } from 'react-native';

export function Logo({ height = 34, centered = false }: { height?: number; centered?: boolean }) {
  return (
    <Image
      source={require('../assets/images/logo-gate8.png')}
      style={[styles.logo, { height, width: height * 5.4 }, centered && styles.centered]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
  centered: {
    alignSelf: 'center',
  },
});
