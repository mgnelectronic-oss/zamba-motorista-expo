import React from 'react';
import { Text, View } from 'react-native';
import type { ThemeColors } from '@/theme/types';

export function SoundSelectionSavedAck({ visible, colors }: { visible: boolean; colors: ThemeColors }) {
  if (!visible) return null;
  return (
    <View
      style={{
        alignSelf: 'center',
        marginBottom: 14,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: colors.successBg,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.success }}>✓ Guardado</Text>
    </View>
  );
}
