import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppSettings } from '../interfaces/settings.interface';

const SETTINGS_KEY = 'app_settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private defaultSettings: AppSettings = {
    theme: 'dark',
    animations: true,
    backgroundImage: null,
    backgroundFit: 'cover',
  };

  private settingsSubject: BehaviorSubject<AppSettings>;
  settings$: ReturnType<BehaviorSubject<AppSettings>['asObservable']>;

  constructor() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const initial = saved
      ? { ...this.defaultSettings, ...JSON.parse(saved) }
      : this.defaultSettings;
    this.settingsSubject = new BehaviorSubject<AppSettings>(initial);
    this.settings$ = this.settingsSubject.asObservable();

    this.applyTheme(initial.theme);
    this.applyAnimations(initial.animations);
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

  setTheme(theme: string) {
    const current = this.settingsSubject.value;
    const updated = { ...current, theme };
    this.settingsSubject.next(updated);
    this.saveSettings(updated);
    this.applyTheme(theme);
  }

  private applyTheme(theme: string) {
    const root = document.documentElement;
    switch (theme) {
      case 'light':
        root.style.setProperty('--background-color', '#f2f2f2');
        root.style.setProperty('--primary-color', '#f0f0f0');
        root.style.setProperty('--secondary-color', '#e0e0e0');
        root.style.setProperty('--hover-color', '#00000010');
        root.style.setProperty('--text-color', '#000');
        root.style.setProperty('--terminal-color', '#fff');
        break;
      case 'red':
        root.style.setProperty('--background-color', '#c96160');
        root.style.setProperty('--primary-color', '#bd4041');
        root.style.setProperty('--secondary-color', '#d58081');
        root.style.setProperty('--hover-color', '#df9fa030');
        root.style.setProperty('--text-color', '#fff');
        root.style.setProperty('--terminal-color', '#7a1f1f');
        break;
      case 'green':
        root.style.setProperty('--background-color', '#54a254');
        root.style.setProperty('--primary-color', '#4d754d');
        root.style.setProperty('--secondary-color', '#70c470');
        root.style.setProperty('--hover-color', '#9ad39a30');
        root.style.setProperty('--text-color', '#fff');
        root.style.setProperty('--terminal-color', '#1f7a3a');
        break;
      case 'blue':
        root.style.setProperty('--background-color', '#c2d6f6');
        root.style.setProperty('--primary-color', '#92b6f0');
        root.style.setProperty('--secondary-color', '#b2cbf2');
        root.style.setProperty('--hover-color', '#698ceb30');
        root.style.setProperty('--text-color', '#000');
        root.style.setProperty('--terminal-color', '#1f3a7a');
        break;
      case 'pink':
        root.style.setProperty('--background-color', '#ead0d9');
        root.style.setProperty('--primary-color', '#ffd6e4');
        root.style.setProperty('--secondary-color', '#ffc4da');
        root.style.setProperty('--hover-color', '#fff0f030');
        root.style.setProperty('--text-color', '#000');
        root.style.setProperty('--terminal-color', '#7a1f4d');
        break;
      default:
        root.style.setProperty('--background-color', '#1e1e1e');
        root.style.setProperty('--primary-color', '#202020');
        root.style.setProperty('--secondary-color', '#212123');
        root.style.setProperty('--hover-color', '#ffffff0b');
        root.style.setProperty('--text-color', '#fff');
        root.style.setProperty('--terminal-color', '#fff');
        break;
    }
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
    this.settingsSubject.next(this.defaultSettings);
    this.saveSettings(this.defaultSettings);
    this.applyTheme(this.defaultSettings.theme);
    this.applyAnimations(this.defaultSettings.animations);
  }
}
