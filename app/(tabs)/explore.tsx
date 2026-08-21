import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatFileSize } from '@/utils/formatters';
import { getTrashedAssets, getTrashStats, restoreAsset } from '@/utils/trash-service';
import { TrashedAsset } from '@/types/media';

export default function TrashScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [items, setItems] = useState<TrashedAsset[]>([]);
  const [stats, setStats] = useState({ count: 0, totalSize: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTrash = useCallback(async () => {
    try {
      const [trashedAssets, trashStats] = await Promise.all([
        getTrashedAssets(),
        getTrashStats(),
      ]);
      setItems(trashedAssets);
      setStats(trashStats);
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
      </View>
      <TouchableOpacity onPress={() => handleRestore(item)} style={styles.restoreButton} activeOpacity={0.8}>
        <MaterialIcons name="restore" size={21} color="#0a7ea4" />
        <ThemedText style={styles.restoreText}>Restore</ThemedText>
      </TouchableOpacity>
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
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { flexGrow: 1, paddingHorizontal: 20 },
  row: { minHeight: 92, marginBottom: 10, padding: 10, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.15)', flexDirection: 'row', alignItems: 'center' },
  rowDark: { backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' },
  thumbnail: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#E5E5EA' },
  details: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  fileName: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 3 },
  restoreButton: { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(10, 126, 164, 0.10)', alignItems: 'center' },
  restoreText: { fontSize: 10, fontWeight: '700', color: '#0a7ea4', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontSize: 19, fontWeight: '700', marginTop: 14 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6 },
});
