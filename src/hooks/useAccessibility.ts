import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilitySettings,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  FontScale,
  ThemeMode,
} from '../types/accessibility';

const STORAGE_KEY = 'cmj_flandes_accessibility_v1';

const FONT_SCALE_PX: Record<FontScale, string> = {
  normal: '16px',
  large: '18px',
  xlarge: '20px',
};

function readInitialSettings(): AccessibilitySettings {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
      return {
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        fontScale:
          parsed.fontScale === 'large' || parsed.fontScale === 'xlarge'
            ? parsed.fontScale
            : 'normal',
        highContrast: Boolean(parsed.highContrast),
        reduceMotion: Boolean(parsed.reduceMotion),
        hideSeasonalOrnaments: Boolean(parsed.hideSeasonalOrnaments),
      };
    }
  } catch {
    // Ignorar errores de almacenamiento privado
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return {
    theme: prefersDark ? 'dark' : 'light',
    fontScale: 'normal',
    highContrast: false,
    reduceMotion: Boolean(prefersReduced),
    hideSeasonalOrnaments: false,
  };
}

export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(readInitialSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('reduce-motion', settings.reduceMotion);
    root.style.fontSize = FONT_SCALE_PX[settings.fontScale];

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, [settings]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setSettings((prev) => ({ ...prev, fontScale }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setSettings((prev) => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleReduceMotion = useCallback(() => {
    setSettings((prev) => ({ ...prev, reduceMotion: !prev.reduceMotion }));
  }, []);

  const toggleHideSeasonalOrnaments = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      hideSeasonalOrnaments: !prev.hideSeasonalOrnaments,
    }));
  }, []);

  const resetAccessibility = useCallback(() => {
    setSettings(DEFAULT_ACCESSIBILITY_SETTINGS);
  }, []);

  return {
    settings,
    setTheme,
    toggleTheme,
    setFontScale,
    toggleHighContrast,
    toggleReduceMotion,
    toggleHideSeasonalOrnaments,
    resetAccessibility,
  };
}
