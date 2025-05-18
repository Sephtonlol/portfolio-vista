import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppSettings } from '../interfaces/settings.interface';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private defaultSettings: AppSettings = {
    theme: 'dark',
    animations: true,
    backgroundImage: null,
    backgroundFit: 'cover',
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(
    this.defaultSettings
  );
  settings$ = this.settingsSubject.asObservable();

  updateImage(image: string | ArrayBuffer | null) {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({ ...current, backgroundImage: image });
  }

  setBackgroundFit(fit: AppSettings['backgroundFit']) {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({ ...current, backgroundFit: fit });
  }

  toggleTheme() {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({
      ...current,
      theme: current.theme === 'light' ? 'dark' : 'light',
    });
  }

  toggleAnimations() {
    const current = this.settingsSubject.value;
    this.settingsSubject.next({
      ...current,
      animations: !current.animations,
    });
  }

  resetSettings() {
    this.settingsSubject.next(this.defaultSettings);
  }
}
