import { Component, EventEmitter, Output } from '@angular/core';
import applications from '../../../data/applications.json';
import { Window } from '../../interfaces/window.interface';
import { WindowManagerService } from '../../services/window-manager.service';

@Component({
  selector: 'app-start-menu',
  templateUrl: './start-menu.component.html',
  styleUrls: ['./start-menu.component.css'],
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
}
