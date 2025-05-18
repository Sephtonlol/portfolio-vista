import { Component, OnInit } from '@angular/core';
import { WindowManagerService } from '../../services/window-manager.service';
import { WindowComponent } from '../../window/window.component';
import { Window } from '../../interfaces/window.interface';
import { DesktopApplicationComponent } from '../desktop-application/desktop-application.component';
import { SettingsService } from '../../services/settings.service';
import { AppSettings } from '../../interfaces/settings.interface';

@Component({
  selector: 'app-desktop',
  imports: [WindowComponent, DesktopApplicationComponent],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.css',
})
export class DesktopComponent {
  windows: Window[] = [];
  settings: AppSettings | null = null;

  constructor(
    private windowManagerService: WindowManagerService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
    });

    this.settingsService.settings$.subscribe((settings) => {
      this.settings = settings;
    });
  }
}
