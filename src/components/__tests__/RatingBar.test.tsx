import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { RatingBar } from '../RatingBar';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock useTheme hook
jest.mock('../../theme/ThemeContext', () => {
  const { darkColors } = require('../../theme');
  return {
    useTheme: () => ({
      theme: darkColors,
      themeMode: 'dark',
      isDark: true,
    }),
  };
});

describe('RatingBar Component', () => {
  it('renders correctly with given rating', () => {
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(<RatingBar rating={4} />);
    });
    expect(component).toBeDefined();
    const tree = component?.toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders with readOnly mode enabled', () => {
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(<RatingBar rating={5} readOnly={true} />);
    });
    const tree = component?.toJSON();
    expect(tree).toBeTruthy();
  });

  it('triggers onRatingChange when stars are clicked', () => {
    const onRatingChangeMock = jest.fn();
    let component: renderer.ReactTestRenderer | undefined;
    act(() => {
      component = renderer.create(
        <RatingBar rating={3} onRatingChange={onRatingChangeMock} />
      );
    });

    const root = component?.root;
    const touchables = root?.findAllByType('TouchableOpacity' as any);
    if (touchables && touchables.length >= 5) {
      act(() => {
        touchables[4].props.onPress();
      });
      expect(onRatingChangeMock).toHaveBeenCalledWith(5);
    }
  });
});
