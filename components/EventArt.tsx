import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

const GRAYSCALE = [
  0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0,
];

export function EventArt({
  uri,
  ended,
  height,
  style,
}: {
  uri: string | null;
  ended: boolean;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const skiaImage = useImage(uri);

  return (
    <View
      style={[styles.wrap, { height }, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {uri && ended && skiaImage && width > 0 ? (
        <Canvas style={{ width, height }}>
          <SkiaImage image={skiaImage} x={0} y={0} width={width} height={height} fit="cover">
            <ColorMatrix matrix={GRAYSCALE} />
          </SkiaImage>
        </Canvas>
      ) : uri && !ended ? (
        <Image source={{ uri }} style={[styles.banner, { height }]} />
      ) : (
        <View style={[styles.banner, { height }, uri && ended ? styles.waiting : styles.empty]} />
      )}
      {ended ? <View pointerEvents="none" style={styles.shade} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
  },
  banner: {
    width: '100%',
    backgroundColor: colors.bgElevated,
  },
  empty: {
    backgroundColor: colors.bgElevated,
  },
  waiting: {
    backgroundColor: '#2a2a2a',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.22)',
  },
});
