import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import type { DriverHomeCarouselSettings } from '@/hooks/useDriverHomeBanners';
import type { DriverAppBanner } from '@/types/driverBanners';
import { normalize } from '@/lib/responsive';
import type { DriverHomeStyles } from '@/theme/screens/driverHomeStyles';

type Props = {
  banners: DriverAppBanner[];
  carouselSettings: DriverHomeCarouselSettings;
  styles: DriverHomeStyles;
};

async function openBannerTarget(b: DriverAppBanner): Promise<void> {
  const url = b.target_url?.trim();
  if (url) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fallback abaixo */
    }
  }
  const screen = b.target_screen?.trim();
  if (screen && screen.startsWith('/')) {
    router.push(screen as never);
  }
}

export function DriverHomeBannerCarousel({ banners, carouselSettings, styles }: Props) {
  const { width: winW } = useWindowDimensions();
  const listRef = useRef<FlatList<DriverAppBanner>>(null);
  const slideIndexRef = useRef(0);

  /**
   * Largura do slide = mesma regra que `promoWrap` / `card`: 90% da área útil
   * (`approvedRoot` com padding horizontal igual a `normalize(20)`).
   */
  const slideW = useMemo(() => {
    const pad = normalize(20, winW);
    const inner = Math.max(1, winW - 2 * pad);
    return Math.max(1, Math.round(inner * 0.9));
  }, [winW]);

  const { auto_slide_enabled, slide_interval_seconds } = carouselSettings;

  const scrollToIndex = useCallback(
    (i: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(i, banners.length - 1));
      listRef.current?.scrollToOffset({ offset: clamped * slideW, animated });
    },
    [banners.length, slideW],
  );

  useEffect(() => {
    if (!auto_slide_enabled || banners.length <= 1) return;
    const ms = slide_interval_seconds * 1000;
    const t = setInterval(() => {
      const next = (slideIndexRef.current + 1) % banners.length;
      slideIndexRef.current = next;
      scrollToIndex(next, true);
    }, ms);
    return () => clearInterval(t);
  }, [auto_slide_enabled, slide_interval_seconds, banners.length, scrollToIndex]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / slideW);
      if (i >= 0 && i < banners.length) slideIndexRef.current = i;
    },
    [banners.length, slideW],
  );

  const bannerIdsKey = useMemo(() => banners.map((b) => b.id).join(','), [banners]);

  useEffect(() => {
    slideIndexRef.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [bannerIdsKey]);

  if (banners.length === 0) return null;

  return (
    <View style={styles.promoWrap}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideW}
        snapToAlignment="start"
        disableIntervalMomentum
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void openBannerTarget(item)}
            style={[styles.promoSlide, { width: slideW }]}
            accessibilityRole="button"
            accessibilityLabel={item.title?.trim() || 'Banner promocional'}
          >
            <View style={styles.promoImageBox}>
              <Image
                source={{ uri: item.image_url! }}
                style={styles.promoImage}
                contentFit="contain"
                contentPosition="center"
                transition={200}
                accessibilityIgnoresInvertColors
              />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
