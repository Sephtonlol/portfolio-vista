import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AccentTheme,
  AppSettings,
  ColorMode,
} from '../interfaces/settings.interface';

const SETTINGS_KEY = 'app_settings';

const COLOR_MODES: readonly ColorMode[] = ['dark', 'light'] as const;
const ACCENT_THEMES: readonly AccentTheme[] = [
  'default',
  'red',
  'green',
  'blue',
  'pink',
] as const;
const BACKGROUND_FITS: readonly AppSettings['backgroundFit'][] = [
  'cover',
  'contain',
  'stretch',
  'repeat',
] as const;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private defaultSettings: AppSettings = {
    colorMode: 'dark',
    accent: 'default',
    animations: true,
    backgroundImage: null,
    backgroundFit: 'cover',
  };

  private settingsSubject: BehaviorSubject<AppSettings>;
  settings$: ReturnType<BehaviorSubject<AppSettings>['asObservable']>;

  constructor() {
    const initial = this.loadInitialSettings();
    this.settingsSubject = new BehaviorSubject<AppSettings>(initial);
    this.settings$ = this.settingsSubject.asObservable();

    this.applyColorMode(initial.colorMode);
    this.applyAccent(initial.accent);
    this.applyAnimations(initial.animations);
  }

  private loadInitialSettings(): AppSettings {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return this.defaultSettings;

    try {
      const parsed = JSON.parse(saved) as Partial<AppSettings> & {
        theme?: unknown;
      };
      const normalized = this.normalizeSettings(parsed);
      this.saveSettings(normalized);
      return normalized;
    } catch {
      return this.defaultSettings;
    }
  }

  private normalizeSettings(
    saved: Partial<AppSettings> & { theme?: unknown },
  ): AppSettings {
    const normalized: AppSettings = { ...this.defaultSettings };

    if (saved && typeof saved === 'object') {
      if (COLOR_MODES.includes(saved.colorMode as ColorMode)) {
        normalized.colorMode = saved.colorMode as ColorMode;
      }

      if (ACCENT_THEMES.includes(saved.accent as AccentTheme)) {
        normalized.accent = saved.accent as AccentTheme;
      }

      if (typeof saved.animations === 'boolean') {
        normalized.animations = saved.animations;
      }

      if ('backgroundImage' in saved) {
        normalized.backgroundImage = (saved as any).backgroundImage ?? null;
      }

      if (BACKGROUND_FITS.includes(saved.backgroundFit as any)) {
        normalized.backgroundFit =
          saved.backgroundFit as AppSettings['backgroundFit'];
      }

      // Legacy single "theme" setting migration.
      if (typeof saved.theme === 'string') {
        if (saved.theme === 'light') normalized.colorMode = 'light';
        else if (saved.theme === 'dark') normalized.colorMode = 'dark';
        else if ((ACCENT_THEMES as readonly string[]).includes(saved.theme)) {
          normalized.accent = saved.theme as AccentTheme;
        }
      }
    }

    return normalized;
  }

  private saveSettings(settings: AppSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  updateImage(image: string | ArrayBuffer | null) {
    const current = this.settingsSubject.value;
    const updated = { ...current, backgroundImage: image };
    this.settingsSubject.next(updated);
    this.saveSettings(updated);
  }

  setBackgroundFit(fit: AppSettings['backgroundFit']) {
    const current = this.settingsSubject.value;
    const updated = { ...current, backgroundFit: fit };
    this.settingsSubject.next(updated);
    this.saveSettings(updated);
  }

  setColorMode(mode: ColorMode) {
    const current = this.settingsSubject.value;
    const updated = { ...current, colorMode: mode };
    this.settingsSubject.next(updated);
    this.saveSettings(updated);
    this.applyColorMode(mode);
  }

  setAccent(accent: AccentTheme) {
    const current = this.settingsSubject.value;
    const updated = { ...current, accent };
    this.settingsSubject.next(updated);
    this.saveSettings(updated);
    this.applyAccent(accent);
  }

  // Backward-compatible legacy API (maps old single "theme" to mode/accent).
  setTheme(theme: string) {
    if ((COLOR_MODES as readonly string[]).includes(theme)) {
      this.setColorMode(theme as ColorMode);
      return;
    }
    if ((ACCENT_THEMES as readonly string[]).includes(theme)) {
      this.setAccent(theme as AccentTheme);
    }
  }

  private applyColorMode(mode: ColorMode) {
    const root = document.documentElement;
    root.setAttribute('data-mode', mode);
  }

  private applyAccent(accent: AccentTheme) {
    const root = document.documentElement;
    root.setAttribute('data-accent', accent);
  }

  toggleAnimations() {
    const current = this.settingsSubject.value;
    const updated = { ...current, animations: !current.animations };
    this.settingsSubject.next(updated);
    this.saveSettings(updated);
    this.applyAnimations(updated.animations);
  }

  private applyAnimations(animations: boolean) {
    const root = document.documentElement;
    if (animations) {
      root.style.setProperty('--primary-transition', '0.2s');
      root.style.setProperty('--secondary-transition', '0.1s');
      root.style.setProperty('--tertiary-transition', '0.5s');
    } else {
      root.style.setProperty('--primary-transition', '0s');
      root.style.setProperty('--secondary-transition', '0s');
      root.style.setProperty('--tertiary-transition', '0s');
    }
  }

  resetSettings() {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem('linkedinOpened');
    this.settingsSubject.next(this.defaultSettings);
    this.saveSettings(this.defaultSettings);
    this.applyColorMode(this.defaultSettings.colorMode);
    this.applyAccent(this.defaultSettings.accent);
    this.applyAnimations(this.defaultSettings.animations);
  }
}
