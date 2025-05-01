import { Component, ElementRef, HostListener } from '@angular/core';
import { StartMenuComponent } from '../start-menu/start-menu.component';
import { WindowManagerService } from '../../services/window-manager.service';
import { Window } from '../../interfaces/window.interface';
import applications from '../../../data/applications.json';

@Component({
  selector: 'app-taskbar',
  imports: [StartMenuComponent],
  templateUrl: './taskbar.component.html',
  styleUrl: './taskbar.component.css',
})
export class TaskbarComponent {
  time = '';
  date = '';

  showStartMenu = false;
  windows: Window[] = [];
  applications: Window[] = applications as Window[];
  constructor(
    public windowManagerService: WindowManagerService,
    private eRef: ElementRef
  ) {
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
    });
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const clickedInsideStartMenu = target.closest('.start-menu');
    const clickedStartButton = target.closest('.start-button');

    if (!clickedInsideStartMenu && !clickedStartButton && this.showStartMenu) {
      this.showStartMenu = false;
    }
  }

  private updateDateTime() {
    const now = new Date();
    this.time = now.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    this.date = now.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  toggleStartMenu() {
    this.showStartMenu = !this.showStartMenu;
  }

  newWindow(application: string, icon: string) {
    this.windowManagerService.addWindow({
      application,
      icon,
      opened: true,
      minimized: false,
    });
  }
  toggleWindow(application: string) {
    if (this.windowManagerService.isMinized(application)) {
      setTimeout(() => {
        this.windowManagerService.focusWindow(application, true);
      }, 50);
    } else {
      setTimeout(() => {
        this.windowManagerService.minimizeWindow(application);
      }, 50);
    }
  }
}
