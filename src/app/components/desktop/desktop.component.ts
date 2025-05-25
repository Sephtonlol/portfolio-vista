import { Component, HostListener, OnInit } from '@angular/core';
import { WindowManagerService } from '../../services/window-manager.service';
import { Window } from '../../interfaces/window.interface';
import { DesktopApplicationComponent } from '../desktop-application/desktop-application.component';
import { SettingsService } from '../../services/settings.service';
import { AppSettings } from '../../interfaces/settings.interface';
import { WindowComponent } from '../window/window.component';

@Component({
  selector: 'app-desktop',
  imports: [WindowComponent, DesktopApplicationComponent],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.css',
})
export class DesktopComponent {
  windows: Window[] = [];
  settings: AppSettings | null = null;

  linkedinOpened = false;
  openContextMenuApp: string | null = null;

  constructor(
    private windowManagerService: WindowManagerService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.linkedinOpened = !!localStorage.getItem('linkedinOpened');
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
    });

    this.settingsService.settings$.subscribe((settings) => {
      this.settings = settings;
    });
  }

  openLinkedin() {
    this.linkedinOpened = true;
    localStorage.setItem('linkedinOpened', 'true');
    const linkedinUrl = 'https://www.linkedin.com/in/alexander-wu-b63038241/';
    window.open(linkedinUrl, '_blank');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      this.openContextMenuApp &&
      !target.closest('.context-menu') &&
      !target.closest('.context-menu-trigger')
    ) {
      this.openContextMenuApp = null;
    }
  }
}
