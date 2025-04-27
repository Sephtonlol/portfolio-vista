import { Component, EventEmitter, Output } from '@angular/core';
import applications from '../../../data/applications.json';
import { Window } from '../../interfaces/window.interface';
import { WindowManagerService } from '../../services/window-manager.service';

@Component({
  selector: 'app-start-menu',
  imports: [],
  templateUrl: './start-menu.component.html',
  styleUrl: './start-menu.component.css',
})
export class StartMenuComponent {
  applications: Window[] = applications as Window[];

  @Output() closeStartMenu = new EventEmitter<null>();

  constructor(public windowManagerService: WindowManagerService) {}

  newWindow(application: string, icon: string) {
    this.windowManagerService.addWindow({
      application,
      icon,
      opened: true,
      minimized: false,
    });
    this.closeStartMenu.emit();
  }
  toggleWindow(application: string) {
    if (this.windowManagerService.isMinized(application))
      this.windowManagerService.focusWindow(application);
    else this.windowManagerService.minimizeWindow(application);
    this.closeStartMenu.emit();
  }
}
