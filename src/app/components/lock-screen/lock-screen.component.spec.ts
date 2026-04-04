import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LockScreenComponent } from './lock-screen.component';
import { AuthenticationService } from '../../services/api/authentication/authentication.service';

describe('LockScreenComponent', () => {
  let component: LockScreenComponent;
  let fixture: ComponentFixture<LockScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LockScreenComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            login: () => Promise.resolve({ status: 401 }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LockScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
