import { Component, OnDestroy, OnInit } from '@angular/core';
import { TaskbarComponent } from './components/taskbar/taskbar.component';
import { DesktopComponent } from './components/desktop/desktop.component';
import { Subscription } from 'rxjs';
import { ShutDownService } from './services/shut-down.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TaskbarComponent, DesktopComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'portfolio-vista';
  acceptedWarning = false;
  private shutDownSubscription!: Subscription;

  shutDown = false;
  shutDownMessage = '';

  constructor(private shutDownService: ShutDownService) {}

  ngOnInit(): void {
    this.shutDownSubscription = this.shutDownService
      .onShutDown()
      .subscribe(
        (isShuttingDown: { isShuttingDown: boolean; message: string }) => {
          this.shutDown = isShuttingDown.isShuttingDown;
          this.shutDownMessage = isShuttingDown.message;
        }
      );
  }

  ngOnDestroy(): void {
    if (this.shutDownSubscription) {
      this.shutDownSubscription.unsubscribe();
    }
  }

  disableShutDown() {
    this.shutDownService.shutDown(false, '');
  }
}
