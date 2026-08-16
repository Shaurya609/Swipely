import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
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

export const MediaReviewCard = forwardRef<MediaReviewCardRef, MediaReviewCardProps>(
  ({ item, onSwipeLeft, onSwipeRight, isTop, style }, ref) => {
    const { width: screenWidth } = useWindowDimensions();
    const SWIPE_THRESHOLD = screenWidth * 0.35;

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

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.cardWrapper, style, isTop && animatedCardStyle]}>
          <MediaPreviewContainer item={item} />

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
});
