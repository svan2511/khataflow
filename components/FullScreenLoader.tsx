import { View, StyleSheet } from 'react-native';
import Loader from './Loader';

interface FullScreenLoaderProps {
  overlay?: boolean;
}

export default function FullScreenLoader({ overlay = false }: FullScreenLoaderProps) {
  return (
    <View style={[styles.container, overlay && styles.overlay]}>
      <Loader size={48} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8faf7',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 100,
  },
});
