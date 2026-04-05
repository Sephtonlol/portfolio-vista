import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { TaskbarComponent } from './components/taskbar/taskbar.component';
import { DesktopComponent } from './components/desktop/desktop.component';
import { Subscription } from 'rxjs';
import { ShutDownService } from './services/shut-down.service';
import { WindowManagerService } from './services/window-manager.service';
import { LockScreenComponent } from './components/lock-screen/lock-screen.component';
import { AuthenticationService } from './services/api/authentication/authentication.service';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { BootScreenComponent } from './components/boot-screen/boot-screen.component';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    TaskbarComponent,
    DesktopComponent,
    LockScreenComponent,
    ContextMenuComponent,
    BootScreenComponent,
  ],
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

  lockScreenExiting = false;
  lockScreenHidden = false;
  private lockScreenExitTimeoutId?: number;

  logoutFlash = false;
  private logoutFlashTimeoutId?: number;
  private lastSignedIn = false;

  bootScreenVisible = false;
  bootScreenExiting = false;
  bootScreenErrorMode = false;
  bootScreenTotalDurationMs = 2000;
  private bootExitTimeoutId?: number;
  private bootTimeoutId?: number;

  constructor(
    private shutDownService: ShutDownService,
    private windowManagerService: WindowManagerService,
    public authenticationService: AuthenticationService,
    private settingsService: SettingsService,
  ) {
    effect(() => {
      const signedIn = this.authenticationService.signedIn();

      if (this.lastSignedIn && !signedIn) {
        this.logoutFlash = true;
        if (this.logoutFlashTimeoutId != null) {
          window.clearTimeout(this.logoutFlashTimeoutId);
        }
        this.logoutFlashTimeoutId = window.setTimeout(() => {
          this.logoutFlash = false;
        }, 400);
      }

      this.lastSignedIn = signedIn;

      if (signedIn) {
        if (!this.lockScreenHidden && !this.lockScreenExiting) {
          this.lockScreenExiting = true;
          this.lockScreenExitTimeoutId = window.setTimeout(() => {
            this.lockScreenHidden = true;
            this.lockScreenExiting = false;
          }, 500);
        }
      } else {
        this.lockScreenHidden = false;
        this.lockScreenExiting = false;
        if (this.lockScreenExitTimeoutId != null) {
          window.clearTimeout(this.lockScreenExitTimeoutId);
          this.lockScreenExitTimeoutId = undefined;
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.settingsService.settings.bootAnimation) {
      // Boot takes ~3–6s. Sometimes it “hits an issue” and runs longer.
      this.bootScreenErrorMode = Math.random() < 0.22;

      const randomInt = (min: number, max: number) =>
        Math.floor(min + Math.random() * (max - min + 1));

      this.bootScreenTotalDurationMs = this.bootScreenErrorMode
        ? randomInt(5200, 5750)
        : randomInt(3800, 5200);

      this.bootScreenVisible = true;
      this.bootScreenExiting = false;
      this.bootTimeoutId = window.setTimeout(() => {
        this.bootScreenVisible = false;
      }, this.bootScreenTotalDurationMs + 250);
    }

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
        },
      );
  }

  ngOnDestroy(): void {
    if (this.shutDownSubscription) {
      this.shutDownSubscription.unsubscribe();
    }

    if (this.lockScreenExitTimeoutId != null) {
      window.clearTimeout(this.lockScreenExitTimeoutId);
    }

    if (this.logoutFlashTimeoutId != null) {
      window.clearTimeout(this.logoutFlashTimeoutId);
    }

    if (this.bootTimeoutId != null) {
      window.clearTimeout(this.bootTimeoutId);
    }

    if (this.bootExitTimeoutId != null) {
      window.clearTimeout(this.bootExitTimeoutId);
    }
  }

  disableShutDown() {
    this.shutDownService.shutDown(false, '');
  }
}
