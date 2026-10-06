import { ImageBackground, StyleSheet, View, type ViewProps } from 'react-native';

const source = require('../assets/images/app-bg.png');

export function AppBackground({ children, style, ...rest }: ViewProps) {
  return (
    <ImageBackground source={source} resizeMode="cover" style={[styles.root, style]} {...rest}>
      <View style={styles.content} collapsable={false}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    elevation: 8,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});
