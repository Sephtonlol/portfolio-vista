import { Component, OnDestroy, OnInit } from '@angular/core';
import { TaskbarComponent } from './components/taskbar/taskbar.component';
import { DesktopComponent } from './components/desktop/desktop.component';
import { Subscription } from 'rxjs';
import { ShutDownService } from './services/shut-down.service';
import { WindowManagerService } from './services/window-manager.service';

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
  sleepPointerDelay = false;
  shutDownMessage = '';

  constructor(
    private shutDownService: ShutDownService,
    private windowManagerService: WindowManagerService
  ) {}

  ngOnInit(): void {
    this.shutDownSubscription = this.shutDownService
      .onShutDown()
      .subscribe(
        (isShuttingDown: { isShuttingDown: boolean; message: string }) => {
          this.shutDown = isShuttingDown.isShuttingDown;
          this.shutDownMessage = isShuttingDown.message;
          setTimeout(() => {
            if (this.shutDown) {
              if (isShuttingDown.message === 'Shutting down')
                window.location.href = 'https://google.com';
              else this.windowManagerService.closeAllWindows();
            }
          }, 2000);
          if (this.shutDown && this.shutDownMessage === 'Sleep')
            setTimeout(() => {
              this.sleepPointerDelay = true;
            }, 0);
          else {
            this.sleepPointerDelay = false;
          }
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
