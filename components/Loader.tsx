import { type StyleProp, type ViewStyle } from 'react-native';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';

import { colors } from '@/constants/theme';

const source = require('../assets/lottie/loading.json');

export function Loader({
  size = 48,
  color = colors.blue,
  style,
  screen = false,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  screen?: boolean;
}) {
  const dim = screen ? 176 : size;
  const tint =
    color.toLowerCase() !== colors.blue.toLowerCase()
      ? [{ keypath: '**', color }]
      : undefined;

  const spin = (
    <LottieView
      source={source}
      autoPlay
      loop
      style={[{ width: dim, height: dim }, screen ? undefined : style]}
      colorFilters={tint}
    />
  );

  if (!screen) return spin;

  return (
    <View style={[{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }, style]}>
      {spin}
    </View>
  );
}
