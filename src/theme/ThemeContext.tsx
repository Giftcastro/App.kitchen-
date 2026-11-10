import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, BrandTheme, ThemeColors } from '../types';
import { darkColors, lightColors, pantryLightColors, pantryDarkColors, BRAND_THEMES } from './index';

const THEME_STORAGE_KEY = '@kitchen_co_theme_preference';
const BRAND_THEME_STORAGE_KEY = '@kitchen_co_brand_theme_preference';

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  brandTheme: BrandTheme;
  setBrandTheme: (brand: BrandTheme) => Promise<void>;
  isDark: boolean;
  brandThemes: typeof BRAND_THEMES;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [brandTheme, setBrandThemeState] = useState<BrandTheme>('Current');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Restore saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode === 'system' || storedMode === 'dark' || storedMode === 'light') {
          setThemeModeState(storedMode as ThemeMode);
        }
        const storedBrand = await AsyncStorage.getItem(BRAND_THEME_STORAGE_KEY);
        if (storedBrand === 'Current' || storedBrand === 'MediterraneanPantry') {
          setBrandThemeState(storedBrand as BrandTheme);
        }
      } catch (e) {
        console.warn('Error loading theme preference:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Error saving theme preference:', e);
    }
  };

  const setBrandTheme = async (brand: BrandTheme) => {
    setBrandThemeState(brand);
    try {
      await AsyncStorage.setItem(BRAND_THEME_STORAGE_KEY, brand);
    } catch (e) {
      console.warn('Error saving brand theme preference:', e);
    }
  };

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme !== 'light';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const theme = useMemo(() => {
    if (brandTheme === 'MediterraneanPantry') {
      return isDark ? pantryDarkColors : pantryLightColors;
    }
    return isDark ? darkColors : lightColors;
  }, [brandTheme, isDark]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        brandTheme,
        setBrandTheme,
        isDark,
        brandThemes: BRAND_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
