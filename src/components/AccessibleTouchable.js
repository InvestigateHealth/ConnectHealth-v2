// src/components/AccessibleTouchable.js
// Accessible touchable component with enhanced accessibility features

import React, { useState } from 'react';
import { 
  TouchableOpacity, 
  TouchableNativeFeedback, 
  View, 
  Platform, 
  StyleSheet,
  AccessibilityInfo
} from 'react-native';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * AccessibleTouchable component that respects accessibility settings
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Content to render inside touchable
 * @param {Object} props.style - Container style
 * @param {Function} props.onPress - Function to call when pressed
 * @param {Function} props.onLongPress - Function to call when long-pressed
 * @param {string} props.accessibilityLabel - Accessibility label for screen readers
 * @param {string} props.accessibilityHint - Accessibility hint
 * @param {string} props.testID - Test ID for testing
 * @param {boolean} props.useFeedback - Whether to use native feedback on Android (ripple effect)
 * @param {boolean} props.disableAnimation - Whether to disable animations for reduced motion
 * @param {number} props.activeOpacity - Active opacity when touched (default: 0.7)
 * @param {boolean} props.disabled - Whether the touchable is disabled
 */
const AccessibleTouchable = ({
  children,
  style,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  useFeedback = Platform.OS === 'android',
  disableAnimation = false,
  activeOpacity = 0.7,
  disabled = false,
  ...props
}) => {
  const { reducedMotion, screenReaderEnabled } = useAccessibility();
  const [isPressed, setIsPressed] = useState(false);
  
  // Determine appropriate active opacity based on accessibility settings
  const getActiveOpacity = () => {
    if (disableAnimation || reducedMotion) {
      return 0.9; // Less animation when reduced motion is enabled
    }
    return activeOpacity;
  };
  
  // Handle press in
  const handlePressIn = () => {
    setIsPressed(true);
    if (screenReaderEnabled) {
      // Announce to screen reader that button is pressed
      AccessibilityInfo.announceForAccessibility(
        `${accessibilityLabel || 'Button'} pressed`
      );
    }
  };
  
  // Handle press out
  const handlePressOut = () => {
    setIsPressed(false);
  };
  
  // Accessibility props
  const accessibilityProps = {
    accessible: true,
    accessibilityRole: 'button',
    accessibilityLabel,
    accessibilityHint,
    accessibilityState: {
      disabled,
      pressed: isPressed,
    },
  };
  
  // Use TouchableNativeFeedback on Android if useFeedback is true
  if (Platform.OS === 'android' && useFeedback && !disableAnimation && !reducedMotion) {
    return (
      <TouchableNativeFeedback
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        background={TouchableNativeFeedback.Ripple(
          'rgba(0, 0, 0, 0.1)',
          false
        )}
        useForeground={true}
        testID={testID || 'accessible-touchable'}
        {...accessibilityProps}
        {...props}
      >
        <View style={[styles.container, style, disabled && styles.disabledContainer]}>
          {children}
        </View>
      </TouchableNativeFeedback>
    );
  }
  
  // Use TouchableOpacity on iOS or when useFeedback is false
  return (
    <TouchableOpacity
      style={[styles.container, style, disabled && styles.disabledContainer]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={getActiveOpacity()}
      disabled={disabled}
      testID={testID || 'accessible-touchable'}
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      {...accessibilityProps}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  disabledContainer: {
    opacity: 0.5,
  },
});

export default AccessibleTouchable;
