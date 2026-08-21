import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, Modal, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MockMediaItem } from '../types/media';
import { MediaPreviewContainer } from './media-preview-container';

export interface MediaReviewCardRef {
  swipeLeft: () => void;
  swipeRight: () => void;
}

interface MediaReviewCardProps {
  item: MockMediaItem;
  onSwipeLeft: () => void;  // Delete/Trash trigger
  onSwipeRight: () => void; // Keep/Safe trigger
  isTop: boolean;
  style?: any;
}

interface VideoPlayerViewProps {
  uri: string;
  style?: any;
}

const VideoPlayerView = ({ uri, style }: VideoPlayerViewProps) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      style={style}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};

export const MediaReviewCard = forwardRef<MediaReviewCardRef, MediaReviewCardProps>(
  ({ item, onSwipeLeft, onSwipeRight, isTop, style }, ref) => {
    const { width: screenWidth } = useWindowDimensions();
    const SWIPE_THRESHOLD = screenWidth * 0.35;

    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    // Translation values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    // Dynamic rotation config: slightly angled as they swipe horizontally
    const maxRotation = 12; // max 12 degrees tilt

    // Allow parent to programmatically trigger slide animations (from buttons)
    useImperativeHandle(ref, () => ({
      swipeLeft: () => {
        translateX.value = withTiming(-screenWidth * 1.5, { duration: 300 }, () => {
          runOnJS(onSwipeLeft)();
        });
      },
      swipeRight: () => {
        translateX.value = withTiming(screenWidth * 1.5, { duration: 300 }, () => {
          runOnJS(onSwipeRight)();
        });
      },
    }));

    // Setup drag gesture handler
    const panGesture = Gesture.Pan()
      .enabled(isTop)
      .onUpdate((event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      })
      .onEnd((event) => {
        // Evaluate horizontal swipe intent
        if (event.translationX > SWIPE_THRESHOLD) {
          // Swipe Right (Keep)
          const velocityX = Math.max(event.velocityX, 800); // ensure swift exit
          translateX.value = withSpring(screenWidth * 1.5, { velocity: velocityX }, () => {
            runOnJS(onSwipeRight)();
          });
        } else if (event.translationX < -SWIPE_THRESHOLD) {
          // Swipe Left (Delete)
          const velocityX = Math.min(event.velocityX, -800);
          translateX.value = withSpring(-screenWidth * 1.5, { velocity: velocityX }, () => {
            runOnJS(onSwipeLeft)();
          });
        } else {
          // Snap back to equilibrium
          translateX.value = withSpring(0, { damping: 15 });
          translateY.value = withSpring(0, { damping: 15 });
        }
      });

    // Reanimated animated style mapping
    const animatedCardStyle = useAnimatedStyle(() => {
      const rotate = interpolate(
        translateX.value,
        [-screenWidth, 0, screenWidth],
        [-maxRotation, 0, maxRotation],
        Extrapolation.CLAMP
      ) + 'deg';

      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: rotate },
        ],
      };
    });

    // Badge animation: "KEEP" on right swipe
    const animatedKeepBadgeStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        translateX.value,
        [0, SWIPE_THRESHOLD * 0.7],
        [0, 1],
        Extrapolation.CLAMP
      );
      return { opacity };
    });

    // Badge animation: "DELETE" on left swipe
    const animatedDeleteBadgeStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        translateX.value,
        [-SWIPE_THRESHOLD * 0.7, 0],
        [1, 0],
        Extrapolation.CLAMP
      );
      return { opacity };
    });

    const handlePress = async () => {
      const isRemote = item.uri.startsWith('http://') || item.uri.startsWith('https://');
      if (isRemote) {
        try {
          await WebBrowser.openBrowserAsync(item.uri, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
          });
        } catch (error) {
          console.error('Error opening preview:', error);
        }
      } else {
        setIsPreviewVisible(true);
      }
    };

    const tapGesture = Gesture.Tap()
      .enabled(isTop)
      .onEnd(() => {
        runOnJS(handlePress)();
      });

    const combinedGesture = Gesture.Exclusive(panGesture, tapGesture);

    return (
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[styles.cardWrapper, style, isTop && animatedCardStyle]}>
          <MediaPreviewContainer item={item} isTop={isTop} />

          {/* Swipe Visual Feedback Badges (Floating Overlays) */}
          {isTop && (
            <>
              <Animated.View style={[styles.badgeContainer, styles.keepBadge, animatedKeepBadgeStyle]}>
                <Text style={styles.keepText}>KEEP</Text>
              </Animated.View>

              <Animated.View style={[styles.badgeContainer, styles.deleteBadge, animatedDeleteBadgeStyle]}>
                <Text style={styles.deleteText}>DELETE</Text>
              </Animated.View>
            </>
          )}

          {/* Full Screen Native Media Preview Modal */}
          <Modal
            visible={isPreviewVisible}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setIsPreviewVisible(false)}
          >
            <View style={styles.modalContainer}>
              {/* Header Panel */}
              <View style={styles.modalHeader}>
                <View style={styles.modalMeta}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsPreviewVisible(false)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Media Preview Viewport */}
              <View style={styles.modalContent}>
                {item.fileType === 'video' ? (
                  <VideoPlayerView uri={item.uri} style={styles.fullVideo} />
                ) : (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.fullImage}
                    contentFit="contain"
                  />
                )}
              </View>
            </View>
          </Modal>
        </Animated.View>
      </GestureDetector>
    );
  }
);

MediaReviewCard.displayName = 'MediaReviewCard';

const styles = StyleSheet.create({
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 35,
    borderWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 5,
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  keepBadge: {
    left: 45,
    borderColor: '#34C759', // Green
    transform: [{ rotate: '-15deg' }],
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
  },
  deleteBadge: {
    right: 45,
    borderColor: '#FF3B30', // Red
    transform: [{ rotate: '15deg' }],
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
  },
  keepText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  deleteText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  modalMeta: {
    flex: 1,
    marginRight: 15,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#AAAAAA',
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
  },
});
