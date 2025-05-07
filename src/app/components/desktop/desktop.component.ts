import { Component, OnInit } from '@angular/core';
import { WindowManagerService } from '../../services/window-manager.service';
import { WindowComponent } from '../../window/window.component';
import { Window } from '../../interfaces/window.interface';
import { DesktopApplicationComponent } from '../desktop-application/desktop-application.component';

@Component({
  selector: 'app-desktop',
  imports: [WindowComponent, DesktopApplicationComponent],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.css',
})
export class DesktopComponent {
  windows: Window[] = [];

  constructor(private windowManagerService: WindowManagerService) {
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
    });
  }
}
