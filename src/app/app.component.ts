import { Component } from '@angular/core';
import { TaskbarComponent } from './components/taskbar/taskbar.component';
import { DesktopComponent } from './components/desktop/desktop.component';

@Component({
  selector: 'app-root',
  imports: [TaskbarComponent, DesktopComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'portfolio-vista';
}
