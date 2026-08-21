import React, { useState, useRef, useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { MOCK_MEDIA_ITEMS } from '@/constants/mock-media';
import { StorageSummary } from '@/components/storage-summary';
import { MediaReviewCard, MediaReviewCardRef } from '@/components/media-review-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatFileSize } from '@/utils/formatters';
import { MockMediaItem } from '@/types/media';
import { checkAndRequestPermissions, fetchDeviceMediaPage } from '@/utils/device-media';

interface SwipeHistory {
  item: MockMediaItem;
  direction: 'left' | 'right';
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // State of remaining items to review
  const [items, setItems] = useState<MockMediaItem[]>([]);
  // State for session history to support Undo
  const [history, setHistory] = useState<SwipeHistory[]>([]);
  // Tracking kept and deleted items for statistics in empty state
  const [deletedItems, setDeletedItems] = useState<MockMediaItem[]>([]);
  const [keptItems, setKeptItems] = useState<MockMediaItem[]>([]);

  // Permission and pagination states
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [isLoadingDeviceMedia, setIsLoadingDeviceMedia] = useState<boolean>(false);

  // Initial permission check and media fetch on mount
  useEffect(() => {
    async function init() {
      const granted = await checkAndRequestPermissions();
      setHasPermission(granted);
      
      if (granted) {
        setIsLoadingDeviceMedia(true);
        try {
          const result = await fetchDeviceMediaPage(20);
          setItems(result.items);
          setEndCursor(result.endCursor);
          setHasNextPage(result.hasNextPage);
        } catch (err) {
          console.error('[HomeScreen] Error loading initial device media:', err);
          setItems([]);
        } finally {
          setIsLoadingDeviceMedia(false);
        }
      } else {
        // Fallback to mock media when permission is denied or unavailable
        setItems(MOCK_MEDIA_ITEMS);
      }
    }
    
    init();
  }, []);

  // Fetch the next page of device media when the user review stack runs low
  useEffect(() => {
    if (!hasPermission || !hasNextPage || isLoadingDeviceMedia || items.length > 5) {
      return;
    }

    async function loadMore() {
      setIsLoadingDeviceMedia(true);
      try {
        const result = await fetchDeviceMediaPage(20, endCursor);
        
        setItems(prev => {
          // Prevent duplicates (including already reviewed items in the current session)
          const existingIds = new Set(prev.map(i => i.id));
          deletedItems.forEach(i => existingIds.add(i.id));
          keptItems.forEach(i => existingIds.add(i.id));
          
          const filteredNewItems = result.items.filter(i => !existingIds.has(i.id));
          return [...prev, ...filteredNewItems];
        });
        
        setEndCursor(result.endCursor);
        setHasNextPage(result.hasNextPage);
      } catch (err) {
        console.error('[HomeScreen] Error loading more device media:', err);
      } finally {
        setIsLoadingDeviceMedia(false);
      }
    }

    loadMore();
  }, [items.length, hasPermission, hasNextPage, isLoadingDeviceMedia, endCursor, deletedItems, keptItems]);

  // Ref to programmatically trigger swiping on the top card via buttons
  const cardRef = useRef<MediaReviewCardRef>(null);

  // Compute total size and count dynamically based on remaining items
  const reviewableSize = useMemo(() => {
    return items.reduce((sum, item) => sum + item.fileSize, 0);
  }, [items]);

  const reviewableCount = items.length;

  // Compute space saved from deleted items
  const spaceSaved = useMemo(() => {
    return deletedItems.reduce((sum, item) => sum + item.fileSize, 0);
  }, [deletedItems]);

  const handleSwipeLeft = (item: MockMediaItem) => {
    setItems(prev => {
      // 1. When an item is deleted, remove it from the active swipe stack exactly once.
      if (prev.length === 0 || prev[0].id !== item.id) {
        return prev;
      }
      
      setHistory(h => {
        if (h.some(entry => entry.item.id === item.id)) return h;
        return [...h, { item, direction: 'left' }];
      });
      
      setDeletedItems(d => {
        if (d.some(i => i.id === item.id)) return d;
        return [...d, item];
      });
      
      return prev.slice(1);
    });
  };

  const handleSwipeRight = (item: MockMediaItem) => {
    setItems(prev => {
      if (prev.length === 0 || prev[0].id !== item.id) {
        return prev;
      }
      
      setHistory(h => {
        if (h.some(entry => entry.item.id === item.id)) return h;
        return [...h, { item, direction: 'right' }];
      });
      
      setKeptItems(k => {
        if (k.some(i => i.id === item.id)) return k;
        return [...k, item];
      });
      
      return prev.slice(1);
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;

    const lastSwipe = history[history.length - 1];

    setItems(prev => {
      // 3. Before restoring an item, ensure it is not already present in the active items array.
      if (prev.some(i => i.id === lastSwipe.item.id)) {
        return prev;
      }
      
      // 2. When Undo is pressed, restore that exact item exactly once.
      setHistory(h => h.slice(0, -1));
      
      if (lastSwipe.direction === 'left') {
        setDeletedItems(d => d.filter(i => i.id !== lastSwipe.item.id));
      } else {
        setKeptItems(k => k.filter(i => i.id !== lastSwipe.item.id));
      }
      
      return [lastSwipe.item, ...prev];
    });
  };

  const handleReset = async () => {
    setHistory([]);
    setDeletedItems([]);
    setKeptItems([]);

    if (hasPermission) {
      setIsLoadingDeviceMedia(true);
      try {
        const result = await fetchDeviceMediaPage(20);
        setItems(result.items);
        setEndCursor(result.endCursor);
        setHasNextPage(result.hasNextPage);
      } catch (err) {
        console.error('[HomeScreen] Error resetting device media:', err);
        setItems([]);
      } finally {
        setIsLoadingDeviceMedia(false);
      }
    } else {
      setItems(MOCK_MEDIA_ITEMS);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemedView style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom || 16 }]}>
        {/* Header Block */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="auto-awesome" size={24} color="#0a7ea4" />
            <ThemedText style={styles.headerTitle} type="title">Swipely</ThemedText>
          </View>
          <ThemedText style={styles.headerSubtitle} lightColor="#687076" darkColor="#9BA1A6">
            Clean up your storage
          </ThemedText>
        </View>

        {/* Device Storage Summary Section */}
        <StorageSummary reviewableSize={reviewableSize} reviewableCount={reviewableCount} cleanedSize={spaceSaved} />

        {/* Card Stack / Review Workspace Area */}
        <View style={styles.cardContainer}>
          {isLoadingDeviceMedia && items.length === 0 ? (
            <ActivityIndicator size="large" color="#0a7ea4" />
          ) : items.length > 0 ? (
            /* Render only top 2 cards for performance; reverse so the top-most card is rendered last in JSX and stays on top */
            items.slice(0, 2).reverse().map((item, index) => {
              const isTop = index === (items.slice(0, 2).length - 1);
              return (
                <MediaReviewCard
                  key={item.id}
                  item={item}
                  isTop={isTop}
                  onSwipeLeft={() => handleSwipeLeft(item)}
                  onSwipeRight={() => handleSwipeRight(item)}
                  ref={isTop ? cardRef : null}
                />
              );
            })
          ) : (
            /* Elegant Empty State with Review Statistics */
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyCard, isDark ? styles.emptyCardDark : styles.emptyCardLight]}>
                <View style={styles.emptyIconContainer}>
                  <MaterialIcons name="celebration" size={44} color="#34C759" />
                </View>
                <ThemedText style={styles.emptyTitle}>All Caught Up!</ThemedText>
                <ThemedText style={styles.emptyDescription} lightColor="#687076" darkColor="#9BA1A6">
                  Great job! You have finished reviewing all mock media files on your device.
                </ThemedText>

                {/* Statistics Box */}
                <View style={styles.statsContainer}>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel} lightColor="#687076" darkColor="#9BA1A6">
                      Space Cleaned
                    </ThemedText>
                    <ThemedText style={styles.statValue} lightColor="#34C759" darkColor="#30D158">
                      {formatFileSize(spaceSaved)}
                    </ThemedText>
                  </View>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel} lightColor="#687076" darkColor="#9BA1A6">
                      Files Deleted
                    </ThemedText>
                    <ThemedText style={styles.statValue}>
                      {deletedItems.length}
                    </ThemedText>
                  </View>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel} lightColor="#687076" darkColor="#9BA1A6">
                      Files Kept
                    </ThemedText>
                    <ThemedText style={styles.statValue}>
                      {keptItems.length}
                    </ThemedText>
                  </View>
                </View>

                {/* Reset Review Button */}
                <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.8}>
                  <MaterialIcons name="replay" size={20} color="#FFF" />
                  <Text style={styles.resetButtonText}>Reset and Restart</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Action Button Controls (Footer Panel) */}
        {items.length > 0 && (
          <View style={styles.buttonsContainer}>
            {/* Programmatic Undo Button */}
            <TouchableOpacity
              onPress={handleUndo}
              disabled={history.length === 0}
              style={[
                styles.roundButton,
                isDark && styles.roundButtonDark,
                styles.undoButton,
                history.length === 0 && styles.disabledButton,
              ]}
              activeOpacity={0.7}
            >
              <MaterialIcons name="undo" size={22} color={history.length === 0 ? (isDark ? '#48484A' : '#AEAEB2') : '#FF9500'} />
            </TouchableOpacity>

            {/* Swipe Left/Delete Trigger Button */}
            <TouchableOpacity
              onPress={() => cardRef.current?.swipeLeft()}
              style={[styles.roundButton, isDark && styles.roundButtonDark, styles.deleteButton]}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={32} color="#FF3B30" />
            </TouchableOpacity>

            {/* Swipe Right/Keep Trigger Button */}
            <TouchableOpacity
              onPress={() => cardRef.current?.swipeRight()}
              style={[styles.roundButton, isDark && styles.roundButtonDark, styles.keepButton]}
              activeOpacity={0.7}
            >
              <MaterialIcons name="check" size={32} color="#34C759" />
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  cardContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  roundButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
    // Shadow Styling
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  roundButtonDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
  },
  undoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  deleteButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  keepButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  disabledButton: {
    opacity: 0.4,
  },
  emptyContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  emptyCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyCardLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
  },
  emptyCardDark: {
    backgroundColor: '#1C1C1E',
    shadowColor: '#000000',
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  statsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0a7ea4',
    gap: 8,
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
