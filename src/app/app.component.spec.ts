import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AuthenticationService } from './services/api/authentication/authentication.service';
import { signal } from '@angular/core';
import { SettingsService } from './services/settings.service';
import { BehaviorSubject } from 'rxjs';
import { AppSettings } from './interfaces/settings.interface';

describe('AppComponent', () => {
  beforeEach(async () => {
    const settings: AppSettings = {
      colorMode: 'dark',
      accent: 'default',
      animations: true,
      bootAnimation: false,
      backgroundImage: null,
      backgroundFit: 'cover',
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            signedIn: signal(false),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            settings,
            settings$: new BehaviorSubject<AppSettings>(
              settings,
            ).asObservable(),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'portfolio-vista' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('portfolio-vista');
  });

  it('should render lock screen when signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-lock-screen')).toBeTruthy();
  });
});
