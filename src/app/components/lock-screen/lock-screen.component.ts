import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../services/api/authentication/authentication.service';
import { SettingsService } from '../../services/settings.service';
import { AppSettings } from '../../interfaces/settings.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lock-screen',
  imports: [FormsModule],
  templateUrl: './lock-screen.component.html',
  styleUrl: './lock-screen.component.css',
})
export class LockScreenComponent implements OnInit, OnDestroy {
  constructor(
    private authenticationService: AuthenticationService,
    private settingsService: SettingsService,
  ) {}

  private settingsSubscription?: Subscription;
  private clockIntervalId?: number;

  private clickActivationArmed = false;

  ngOnInit(): void {
    this.isSignInActive = false;
    this.password = '';
    this.passwordHidden = false;

    this.settingsSubscription = this.settingsService.settings$.subscribe(
      (settings) => {
        this.settings = settings;
      },
    );

    this.updateClock();
    this.clockIntervalId = window.setInterval(() => this.updateClock(), 1000);

    // Avoid immediately activating sign-in due to the same click
    // that triggered a logout/lock action elsewhere in the UI.
    this.clickActivationArmed = false;
    window.setTimeout(() => {
      this.clickActivationArmed = true;
    }, 0);
  }

  ngOnDestroy(): void {
    this.settingsSubscription?.unsubscribe();
    if (this.clockIntervalId != null) {
      window.clearInterval(this.clockIntervalId);
    }
  }

  passwordHidden = false;
  password = '';
  settings: AppSettings | null = null;
  public width = window.innerWidth;

  @ViewChild('passwordInput')
  private passwordInput?: ElementRef<HTMLInputElement>;

  isSignInActive = false;
  timeText = '';
  dateText = '';

  private updateClock() {
    const now = new Date();
    this.timeText = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    this.dateText = now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private isIgnorableKey(event: KeyboardEvent): boolean {
    return (
      event.key === 'Shift' ||
      event.key === 'Control' ||
      event.key === 'Alt' ||
      event.key === 'Meta' ||
      event.key === 'CapsLock' ||
      event.key === 'NumLock' ||
      event.key === 'ScrollLock' ||
      event.key === 'F11'
    );
  }

  private activateSignIn() {
    if (this.isSignInActive) return;
    this.isSignInActive = true;

    window.setTimeout(() => {
      this.passwordInput?.nativeElement.focus();
    }, 0);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (!this.isSignInActive && !this.isIgnorableKey(event)) {
      this.activateSignIn();
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (!this.clickActivationArmed) return;
    if (!this.isSignInActive) {
      this.activateSignIn();
    }
  }

  togglePasswordHidden() {
    this.passwordHidden = !this.passwordHidden;
  }

  async signIn() {
    if (this.password.length <= 0) return;

    try {
      await this.authenticationService.login(this.password);
    } catch {
      // Wrong password (or backend down) still unlocks as guest.
      this.authenticationService.enterGuest();
    }
  }
}
