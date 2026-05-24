import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoaderProps {
  size?: number;
  color?: string;
}

export default function Loader({ size = 40, color = '#006b59' }: LoaderProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringSize = size * 2.4;
  const iconSize = size * 0.9;
  const borderW = Math.max(3, size * 0.12);

  return (
    <View style={[styles.wrap, { width: ringSize, height: ringSize }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: borderW,
            borderColor: color + '18',
            borderTopColor: color,
            borderRightColor: color + '70',
            transform: [{ rotate: spin }],
          },
        ]}
      />
      <View
        style={[
          styles.iconWrap,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
            backgroundColor: color + '0c',
          },
        ]}
      >
        <Ionicons name="storefront-outline" size={iconSize * 0.5} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
