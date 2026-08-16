import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { formatFileSize } from '../utils/formatters';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface StorageSummaryProps {
  reviewableSize: number; // Current total size of remaining files to review
  reviewableCount: number; // Current count of files to review
}

export function StorageSummary({ reviewableSize, reviewableCount }: StorageSummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Constant static local device specifications
  const TOTAL_CAPACITY = 128 * 1024 * 1024 * 1024; // 128 GB
  const SYSTEM_USED = 75.2 * 1024 * 1024 * 1024; // 75.2 GB already used

  const systemUsedPercent = (SYSTEM_USED / TOTAL_CAPACITY) * 100;
  // Represent reviewable items as a tiny slice of storage space
  const reviewablePercent = Math.max(1, (reviewableSize / TOTAL_CAPACITY) * 100);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <ThemedText type="defaultSemiBold" style={styles.title}>Device Storage</ThemedText>
          <ThemedText style={styles.subtitle} lightColor="#687076" darkColor="#9BA1A6">
            {formatFileSize(SYSTEM_USED)} of {formatFileSize(TOTAL_CAPACITY)} used
          </ThemedText>
        </View>
        <View style={styles.badgeContainer}>
          <ThemedText style={styles.badgeLabel}>
            {reviewableCount} {reviewableCount === 1 ? 'file' : 'files'} left
          </ThemedText>
        </View>
      </View>

      {/* Stacked Progress Bar */}
      <View style={[styles.progressBarContainer, isDark ? styles.barDark : styles.barLight]}>
        {/* Already Used Storage Segment */}
        <View style={[styles.barSegment, styles.barUsed, { width: `${systemUsedPercent}%` }]} />
        {/* Space to Review Segment */}
        <View style={[styles.barSegment, styles.barReview, { width: `${reviewablePercent}%` }]} />
      </View>

      {/* Space to Review Summary Box */}
      <View style={[styles.reviewBox, isDark ? styles.boxDark : styles.boxLight]}>
        <View style={styles.indicatorContainer}>
          <View style={styles.reviewIndicator} />
          <ThemedText type="defaultSemiBold" style={styles.reviewTitle}>
            Space to review
          </ThemedText>
        </View>
        <ThemedText type="subtitle" style={styles.reviewAmount} lightColor="#0a7ea4" darkColor="#fff">
          {formatFileSize(reviewableSize)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  barLight: {
    backgroundColor: '#E5E5EA',
  },
  barDark: {
    backgroundColor: '#3A3A3C',
  },
  barSegment: {
    height: '100%',
  },
  barUsed: {
    backgroundColor: '#8E8E93',
  },
  barReview: {
    backgroundColor: '#FF9500', // Warning yellow-orange representing files to review
    borderLeftWidth: 1,
    borderLeftColor: '#fff',
  },
  reviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  boxLight: {
    backgroundColor: '#F2F2F7',
  },
  boxDark: {
    backgroundColor: '#1C1C1E',
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF9500',
    marginRight: 8,
  },
  reviewTitle: {
    fontSize: 14,
  },
  reviewAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
