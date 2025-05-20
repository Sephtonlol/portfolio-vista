import { Component, OnInit } from '@angular/core';
import { SettingsService } from '../../../services/settings.service';
import { CommonModule } from '@angular/common';
import { AppSettings } from '../../../interfaces/settings.interface';

@Component({
  selector: 'app-settings',
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  settings!: AppSettings;
  constructor(private settingsService: SettingsService) {}
  ngOnInit(): void {
    this.settingsService.settings$.subscribe((settings) => {
      this.settings = settings;
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.settingsService.updateImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      this.settingsService.updateImage(null);
    }
  }

  onBackgroundFitChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.settingsService.setBackgroundFit(select.value as any);
  }

  setTheme(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.settingsService.setTheme(select.value);
  }

  toggleAnimations() {
    this.settingsService.toggleAnimations();
  }

  resetSettings() {
    this.settingsService.resetSettings();
  }
}
