import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { MockMediaItem } from '../types/media';
import { formatFileSize, formatDate } from '../utils/formatters';
import { ThemedText } from './themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface MediaPreviewContainerProps {
  item: MockMediaItem;
  isTop?: boolean;
}

export function MediaPreviewContainer({ item, isTop }: MediaPreviewContainerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isVideo = item.fileType === 'video';
  const isDoc = item.fileType === 'pdf';

  // Get color for source badges
  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'Camera':
        return '#007AFF'; // iOS blue
      case 'Screenshots':
        return '#AF52DE'; // iOS purple
      case 'WhatsApp':
        return '#34C759'; // WhatsApp green
      case 'Downloads':
        return '#FF9500'; // iOS orange
      case 'Documents':
        return '#5856D6'; // iOS indigo
      case 'Videos':
        return '#FF2D55'; // iOS pink/rose
      default:
        return '#8E8E93';
    }
  };

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      {/* Media Preview Aspect Area */}
      <View style={styles.previewContainer}>
        {isDoc ? (
          /* Visual Media Image Preview for Documents/PDFs */
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: item.uri }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
            {/* Elegant overlay to indicate it's a PDF */}
            <View style={styles.videoOverlay}>
              <View style={[styles.playButton, { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#FF3B30' }]}>
                <MaterialIcons name="picture-as-pdf" size={36} color="#FF3B30" />
              </View>
            </View>
          </View>
        ) : (
          /* Visual Media Image Preview (Photos, Screenshots, Video covers) */
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: item.uri }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
            
            {/* Play Button Overlay for Videos */}
            {isVideo && (
              <View style={styles.videoOverlay}>
                <View style={styles.playButton}>
                  <MaterialIcons name="play-arrow" size={40} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </View>
                {item.duration && (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.duration}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Source/Category Badge */}
        <View style={[styles.sourceBadge, { backgroundColor: getSourceBadgeColor(item.source) }]}>
          <Text style={styles.sourceText}>{item.source}</Text>
        </View>

        {/* File Type Indicator Icon Overlay */}
        <View style={[styles.typeOverlay, isDark ? styles.typeOverlayDark : styles.typeOverlayLight]}>
          <MaterialIcons 
            name={
              item.fileType === 'video' ? 'videocam' :
              item.fileType === 'pdf' ? 'description' :
              item.fileType === 'screenshot' ? 'phonelink-setup' :
              item.fileType === 'whatsapp' ? 'chat' : 'photo'
            } 
            size={16} 
            color={isDark ? '#FFF' : '#333'} 
          />
        </View>

        {/* Interactive Full Preview Prompter */}
        {isTop && (
          <View style={styles.inspectPrompt}>
            <MaterialIcons name="visibility" size={14} color="#FFF" />
            <Text style={styles.inspectText}>Tap to full inspect</Text>
          </View>
        )}
      </View>

      {/* Info & Metadata Area */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <ThemedText type="defaultSemiBold" style={styles.fileName} numberOfLines={1}>
            {item.fileName}
          </ThemedText>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaColumn}>
            <Text style={[styles.metaLabel, isDark ? styles.labelDark : styles.labelLight]}>
              SIZE
            </Text>
            <ThemedText type="defaultSemiBold" style={styles.metaValue}>
              {formatFileSize(item.fileSize)}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]} />

          <View style={styles.metaColumn}>
            <Text style={[styles.metaLabel, isDark ? styles.labelDark : styles.labelLight]}>
              CREATED
            </Text>
            <ThemedText type="defaultSemiBold" style={styles.metaValue}>
              {formatDate(item.dateCreated)}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    height: '100%',
    width: '100%',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
    shadowColor: '#000000',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  docPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  docIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
  },
  docPlaceholderText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333333',
    marginBottom: 20,
  },
  docLinesContainer: {
    width: '80%',
    alignItems: 'center',
    gap: 8,
  },
  docLine: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 3,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  sourceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  typeOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  typeOverlayLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  typeOverlayDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
  },
  infoContainer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  nameRow: {
    marginBottom: 10,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaColumn: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  labelLight: {
    color: '#8E8E93',
  },
  labelDark: {
    color: '#636366',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 16,
  },
  inspectPrompt: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 20,
  },
  inspectText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
