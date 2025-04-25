import { Component } from '@angular/core';
import { StartMenuComponent } from '../start-menu/start-menu.component';
import { TerminalComponent } from '../windows/terminal/terminal.component';

@Component({
  selector: 'app-taskbar',
  imports: [StartMenuComponent],
  templateUrl: './taskbar.component.html',
  styleUrl: './taskbar.component.css',
})
export class TaskbarComponent {
  showStartMenu = false;
  constructor() {}

  toggleStartMenu() {
    this.showStartMenu = !this.showStartMenu;
  }
}
