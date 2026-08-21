import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatFileSize } from '@/utils/formatters';
import {
  cleanupExpiredTrash,
  DEFAULT_RETENTION_DAYS,
  getRetentionDays,
  getTrashedAssets,
  getTrashStats,
  initialize,
  permanentlyDeleteAsset,
  RETENTION_OPTIONS,
  restoreAsset,
  RetentionDays,
  setRetentionDays,
} from '@/utils/trash-service';
import { TrashedAsset } from '@/types/media';

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Never auto-deletes';
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'Expires today';
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return `Auto-deletes in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
}

function retentionLabel(days: RetentionDays): string {
  if (days === 0) return 'Never';
  return `${days} days`;
}

export default function TrashScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [items, setItems] = useState<TrashedAsset[]>([]);
  const [stats, setStats] = useState({ count: 0, totalSize: 0 });
  const [retentionDays, setRetentionDaysState] = useState<RetentionDays>(DEFAULT_RETENTION_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTrash = useCallback(async () => {
    try {
      await initialize();
      await cleanupExpiredTrash();
      const [trashedAssets, trashStats, currentRetention] = await Promise.all([
        getTrashedAssets(),
        getTrashStats(),
        getRetentionDays(),
      ]);
      setItems(trashedAssets);
      setStats(trashStats);
      setRetentionDaysState(currentRetention);
    } catch (error) {
      console.error('[TrashScreen] Error loading Trash:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTrash();
  };

  const handleRetentionChange = (nextRetention: RetentionDays) => {
    if (nextRetention === retentionDays) return;
    Alert.alert(
      'Change Trash retention?',
      nextRetention === 0
        ? 'New Trash items will be kept until you restore or permanently delete them.'
        : `New Trash items will automatically delete after ${nextRetention} days. Existing items keep their current expiration date.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await setRetentionDays(nextRetention);
              setRetentionDaysState(nextRetention);
              await loadTrash();
            } catch (error) {
              console.error('[TrashScreen] Error changing retention:', error);
              Alert.alert('Could not save', 'The Trash retention setting could not be changed.');
            }
          },
        },
      ]
    );
  };

  const handleRestore = (item: TrashedAsset) => {
    Alert.alert(
      'Restore item?',
      `${item.fileName} will be returned to the review deck.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await restoreAsset(item.id);
              await loadTrash();
            } catch (error) {
              console.error('[TrashScreen] Error restoring item:', error);
              Alert.alert('Restore failed', 'The item could not be restored.');
            }
          },
        },
      ]
    );
  };

  const handlePermanentDelete = (item: TrashedAsset) => {
    Alert.alert(
      'Delete permanently?',
      `${item.fileName} will be permanently deleted from your device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await permanentlyDeleteAsset(item.id);
              await loadTrash();
            } catch (error) {
              console.error('[TrashScreen] Error permanently deleting item:', error);
              Alert.alert('Delete failed', 'The file could not be permanently deleted.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: TrashedAsset }) => (
    <View style={[styles.row, isDark && styles.rowDark]}>
      <Image source={{ uri: item.uri }} style={styles.thumbnail} contentFit="cover" />
      <View style={styles.details}>
        <ThemedText numberOfLines={1} style={styles.fileName}>{item.fileName}</ThemedText>
        <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.meta}>
          {item.fileType.toUpperCase()} · {formatFileSize(item.fileSize)}
        </ThemedText>
        <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.meta}>
          Deleted {new Date(item.deletedAt).toLocaleDateString()}
        </ThemedText>
        <ThemedText lightColor="#0a7ea4" darkColor="#64D2FF" style={styles.expiry}>
          {formatExpiry(item.expiresAt)}
        </ThemedText>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => handleRestore(item)} style={styles.restoreButton} activeOpacity={0.8}>
            <MaterialIcons name="restore" size={18} color="#0a7ea4" />
            <ThemedText style={styles.restoreText}>Restore</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handlePermanentDelete(item)} style={styles.deleteButton} activeOpacity={0.8}>
            <MaterialIcons name="delete-forever" size={18} color="#FF3B30" />
            <ThemedText style={styles.deleteText}>Delete</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <ThemedText type="title" style={styles.title}>Trash</ThemedText>
          <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.subtitle}>
            Items you swipe left are kept here.
          </ThemedText>
        </View>
        <View style={styles.countBadge}>
          <ThemedText style={styles.countText}>{stats.count}</ThemedText>
        </View>
      </View>

      <View style={[styles.summary, isDark && styles.summaryDark]}>
        <View>
          <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.summaryLabel}>Trash size</ThemedText>
          <ThemedText style={styles.summaryValue}>{formatFileSize(stats.totalSize)}</ThemedText>
        </View>
        <MaterialIcons name="delete-outline" size={34} color="#FF3B30" />
      </View>

      <View style={[styles.retentionCard, isDark && styles.retentionCardDark]}>
        <View style={styles.retentionHeader}>
          <View style={styles.retentionTitleRow}>
            <MaterialIcons name="schedule" size={20} color="#0a7ea4" />
            <ThemedText style={styles.retentionTitle}>Automatic deletion</ThemedText>
          </View>
          <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.retentionCurrent}>
            {retentionLabel(retentionDays)}
          </ThemedText>
        </View>
        <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.retentionDescription}>
          New Trash items use this retention period. Default is 30 days.
        </ThemedText>
        <View style={styles.retentionOptions}>
          {RETENTION_OPTIONS.map(option => {
            const selected = option === retentionDays;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => handleRetentionChange(option)}
                style={[styles.retentionOption, selected && styles.retentionOptionSelected]}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.retentionOptionText, selected && styles.retentionOptionTextSelected]}>
                  {retentionLabel(option)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0a7ea4" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="delete-sweep" size={58} color={isDark ? '#636366' : '#AEAEB2'} />
              <ThemedText style={styles.emptyTitle}>Trash is empty</ThemedText>
              <ThemedText lightColor="#687076" darkColor="#9BA1A6" style={styles.emptyText}>
                Items you swipe left will appear here.
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 56 },
  header: { paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 4 },
  countBadge: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: 20, backgroundColor: 'rgba(255, 59, 48, 0.12)', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FF3B30', fontWeight: '800', fontSize: 16 },
  summary: { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: '#F2F2F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryDark: { backgroundColor: '#1C1C1E' },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  retentionCard: { marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: '#F2F2F7' },
  retentionCardDark: { backgroundColor: '#1C1C1E' },
  retentionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  retentionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  retentionTitle: { fontSize: 14, fontWeight: '700' },
  retentionCurrent: { fontSize: 12, fontWeight: '700' },
  retentionDescription: { fontSize: 11, marginTop: 5, marginBottom: 10 },
  retentionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  retentionOption: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.15)' },
  retentionOptionSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  retentionOptionText: { fontSize: 11, fontWeight: '600' },
  retentionOptionTextSelected: { color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { flexGrow: 1, paddingHorizontal: 20 },
  row: { minHeight: 120, marginBottom: 10, padding: 10, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.15)', flexDirection: 'row', alignItems: 'center' },
  rowDark: { backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' },
  thumbnail: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#E5E5EA' },
  details: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  fileName: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 3 },
  expiry: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 8 },
  restoreButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: 'rgba(10, 126, 164, 0.10)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  restoreText: { fontSize: 10, fontWeight: '700', color: '#0a7ea4' },
  deleteButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: 'rgba(255, 59, 48, 0.10)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteText: { fontSize: 10, fontWeight: '700', color: '#FF3B30' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontSize: 19, fontWeight: '700', marginTop: 14 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6 },
});
