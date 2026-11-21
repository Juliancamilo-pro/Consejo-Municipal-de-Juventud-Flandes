export type ThemeMode = 'light' | 'dark';
export type FontScale = 'normal' | 'large' | 'xlarge';

export interface AccessibilitySettings {
  theme: ThemeMode;
  fontScale: FontScale;
  highContrast: boolean;
  reduceMotion: boolean;
  hideSeasonalOrnaments?: boolean;
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  theme: 'light',
  fontScale: 'normal',
  highContrast: false,
  reduceMotion: false,
  hideSeasonalOrnaments: false,
};
