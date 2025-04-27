import { Component } from '@angular/core';
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
  showStartMenu = false;
  windows: Window[] = [];
  applications: Window[] = applications as Window[];
  constructor(public windowManagerService: WindowManagerService) {
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
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
    if (this.windowManagerService.isMinized(application))
      this.windowManagerService.focusWindow(application);
    else this.windowManagerService.minimizeWindow(application);
  }
}
