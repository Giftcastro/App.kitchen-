import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { DropoffFloor } from '../types';
import { DROPOFF_FLOORS } from '../data/mockData';

interface FloorPickerModalProps {
  visible: boolean;
  selectedFloor: string;
  availableFloors?: string[];
  companyName?: string;
  onSelectFloor: (floorLabel: string) => void;
  onClose: () => void;
}

export const FloorPickerModal: React.FC<FloorPickerModalProps> = ({
  visible,
  selectedFloor,
  availableFloors,
  companyName,
  onSelectFloor,
  onClose,
}) => {
  const { theme, isDark } = useTheme();

  if (!visible) return null;

  // If company specific locations available, format them; otherwise fallback to DROPOFF_FLOORS
  const floorItems = availableFloors && availableFloors.length > 0
    ? availableFloors.map((loc, idx) => {
        // Extract floor part or use full location
        const parts = loc.split(', ');
        const floorPart = parts[parts.length - 1] || loc;
        return {
          id: `floor_${idx}`,
          label: floorPart,
          fullLocation: loc,
          description: parts.length > 1 ? parts.slice(0, -1).join(', ') : 'Kitchen Co. designated corporate drop point',
        };
      })
    : DROPOFF_FLOORS.map(f => ({ id: f.id, label: f.label, fullLocation: f.label, description: f.description }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceBorderLight }]}>
          <View style={[styles.handleBar, { backgroundColor: theme.surfaceBorderLight }]} />

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Select Drop-off Floor
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {companyName || 'Corporate Partner Designated Pantry Floors'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {floorItems.map((floor) => {
              const isSelected = selectedFloor.toLowerCase().includes(floor.label.toLowerCase()) || selectedFloor === floor.label;

              return (
                <TouchableOpacity
                  key={floor.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    onSelectFloor(floor.label);
                    onClose();
                  }}
                  style={[
                    styles.floorOption,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    isSelected && { borderColor: theme.primary, backgroundColor:theme.chipBg},
                  ]}
                >
                  <View style={styles.floorLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: theme.surfaceHighlight },
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <Ionicons
                        name="business"
                        size={18}
                        color={isSelected ? theme.onPrimary : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.floorTextContainer}>
                      <Text style={[styles.floorLabel, { color: theme.textPrimary }]}>
                        {floor.label}
                      </Text>
                      <Text style={[styles.floorDesc, { color: theme.textSecondary }]}>
                        {floor.description}
                      </Text>
                    </View>
                  </View>

                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? theme.primary : theme.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '80%',
    borderTopWidth: 1,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 16,
    gap: 10,
  },
  floorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  floorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorTextContainer: {
    flex: 1,
  },
  floorLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  floorDesc: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
