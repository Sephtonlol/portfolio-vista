import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  effect,
} from '@angular/core';
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
  shutDownMessage = '';

  sleepOverlayVisible = false;
  sleepOverlayActive = false;
  private sleepWakeArmed = false;
  private sleepArmTimeoutId?: number;
  private sleepHideTimeoutId?: number;

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
  bootScreenPreDelayMs = 0;
  bootScreenTailHoldMs = 1500;
  bootScreenMode: 'boot' | 'resume' = 'boot';
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

  @HostListener('document:contextmenu', ['$event'])
  onDisableBrowserContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  ngOnInit(): void {
    this.startBootAnimation(false);

    this.shutDownSubscription = this.shutDownService
      .onShutDown()
      .subscribe(
        (isShuttingDown: { isShuttingDown: boolean; message: string }) => {
          if (!isShuttingDown.isShuttingDown) {
            this.clearPowerState();
            return;
          }

          if (isShuttingDown.message === 'Sleep') {
            this.enterSleep();
            return;
          }

          if (
            isShuttingDown.message === 'Restart' ||
            isShuttingDown.message === 'Restarting'
          ) {
            this.clearPowerState();
            this.restart();
            return;
          }
        },
      );
  }

  private startBootAnimation(force: boolean): void {
    if (!force && !this.settingsService.settings.bootAnimation) {
      return;
    }

    if (this.bootTimeoutId != null) {
      window.clearTimeout(this.bootTimeoutId);
      this.bootTimeoutId = undefined;
    }

    this.bootScreenMode = 'boot';
    this.bootScreenPreDelayMs = 1000;
    this.bootScreenTailHoldMs = 1500;

    // Boot takes ~3–6s (plus preDelayMs). Sometimes it “hits an issue” and runs longer.
    this.bootScreenErrorMode = Math.random() < 0.22;

    const randomInt = (min: number, max: number) =>
      Math.floor(min + Math.random() * (max - min + 1));

    const baseDurationMs = this.bootScreenErrorMode
      ? randomInt(5200, 5750)
      : randomInt(3800, 5200);

    this.bootScreenTotalDurationMs = baseDurationMs + this.bootScreenPreDelayMs;

    this.bootScreenVisible = true;
    this.bootScreenExiting = false;
    this.bootTimeoutId = window.setTimeout(() => {
      this.bootScreenVisible = false;
    }, this.bootScreenTotalDurationMs + 250);
  }

  private startResumeAnimation(): void {
    if (this.bootTimeoutId != null) {
      window.clearTimeout(this.bootTimeoutId);
      this.bootTimeoutId = undefined;
    }

    this.bootScreenMode = 'resume';
    this.bootScreenPreDelayMs = 0;
    this.bootScreenTailHoldMs = 900;
    this.bootScreenErrorMode = false;
    this.bootScreenTotalDurationMs = 2200;

    this.bootScreenVisible = true;
    this.bootScreenExiting = false;
    this.bootTimeoutId = window.setTimeout(() => {
      this.bootScreenVisible = false;
    }, this.bootScreenTotalDurationMs + 250);
  }

  private enterSleep(): void {
    // Fade to black. Wake shows the lock screen.
    this.shutDownMessage = 'Sleep';

    this.sleepOverlayVisible = true;
    this.sleepOverlayActive = false;
    this.sleepWakeArmed = false;

    if (this.sleepArmTimeoutId != null) {
      window.clearTimeout(this.sleepArmTimeoutId);
      this.sleepArmTimeoutId = undefined;
    }
    if (this.sleepHideTimeoutId != null) {
      window.clearTimeout(this.sleepHideTimeoutId);
      this.sleepHideTimeoutId = undefined;
    }

    // Start CSS transition on next tick.
    window.setTimeout(() => {
      this.sleepOverlayActive = true;
    }, 0);

    // Don't let the same click that selected “Sleep” immediately wake.
    this.sleepArmTimeoutId = window.setTimeout(() => {
      this.sleepWakeArmed = true;
    }, 650);
  }

  wakeFromSleep(): void {
    if (!this.sleepOverlayVisible || !this.sleepWakeArmed) {
      return;
    }

    this.sleepWakeArmed = false;
    this.sleepOverlayActive = false;
    this.shutDownMessage = '';

    // Force lock/login screen.
    this.authenticationService.logout();

    // Show a short “resume” boot animation on wake.
    this.startResumeAnimation();

    this.sleepHideTimeoutId = window.setTimeout(() => {
      this.sleepOverlayVisible = false;
    }, 220);
  }

  private restart(): void {
    // Close all programs, replay boot, then land on the lock screen.
    this.windowManagerService.closeAllWindows();
    this.authenticationService.logout();
    this.startBootAnimation(true);
  }

  private clearPowerState(): void {
    this.shutDown = false;
    this.shutDownMessage = '';

    this.sleepOverlayActive = false;
    this.sleepOverlayVisible = false;
    this.sleepWakeArmed = false;

    if (this.sleepArmTimeoutId != null) {
      window.clearTimeout(this.sleepArmTimeoutId);
      this.sleepArmTimeoutId = undefined;
    }
    if (this.sleepHideTimeoutId != null) {
      window.clearTimeout(this.sleepHideTimeoutId);
      this.sleepHideTimeoutId = undefined;
    }
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

    if (this.sleepArmTimeoutId != null) {
      window.clearTimeout(this.sleepArmTimeoutId);
    }
    if (this.sleepHideTimeoutId != null) {
      window.clearTimeout(this.sleepHideTimeoutId);
    }
  }

  disableShutDown() {
    this.shutDownService.shutDown(false, '');
  }

  @HostListener('document:keydown')
  onAnyKeyDown(): void {
    if (this.sleepOverlayVisible) {
      this.wakeFromSleep();
    }
  }
}
