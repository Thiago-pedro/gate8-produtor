import { ActivityIndicator, Platform } from 'react-native';

import { colors } from '@/constants/theme';

export function Spinner({
  size = 20,
  color = colors.blue,
}: {
  size?: number;
  color?: string;
}) {
  const iosSize = size <= 24 ? 'small' : 'large';
  return (
    <ActivityIndicator
      size={Platform.OS === 'ios' ? iosSize : size}
      color={color}
    />
  );
}
