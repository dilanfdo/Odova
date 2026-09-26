// Free-tier banner ad. Renders nothing for Pro users — this is the one and
// only gate that needs to change if that ever needs to move (e.g. a screen
// that should stay ad-free even for free users).
import React, { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useEntitlement } from '../context/EntitlementContext';

// Real banner ad unit, created in AdMob under the Odova app. Never requested
// in a __DEV__ build (see below) — Google's own policy requires test ads
// during development, since real impressions/clicks from a dev device count
// as invalid traffic and can get an AdMob account suspended.
const REAL_BANNER_UNIT_ID = 'ca-app-pub-4607423166762045/6440739040';

// __DEV__ is true for any debug/dev-client build (like the one this app is
// currently running as), false only for a real release build — so this
// dev client will keep showing Google's generic test ad even now that the
// real ID above is wired in, which is expected, not a bug. The real ID only
// actually gets requested starting with the next production build.
const adUnitId = __DEV__ ? TestIds.BANNER : REAL_BANNER_UNIT_ID;

// Standard fixed banner (320x50 @ down-scaled density) rather than the
// large adaptive format — deliberately chosen over the taller adaptive
// banners to stay unobtrusive on a small utility-app screen, at the cost of
// somewhat lower ad revenue per impression. Height is still measured via
// onHeightChange rather than hardcoded, since it still varies slightly by
// device density/rounding.
export function AdBanner({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const { isPro } = useEntitlement();

  useEffect(() => {
    if (isPro) onHeightChange?.(0);
  }, [isPro, onHeightChange]);

  if (isPro) return null;

  function handleLayout(e: LayoutChangeEvent) {
    onHeightChange?.(e.nativeEvent.layout.height);
  }

  return (
    <View onLayout={handleLayout}>
      <BannerAd unitId={adUnitId} size={BannerAdSize.BANNER} />
    </View>
  );
}
