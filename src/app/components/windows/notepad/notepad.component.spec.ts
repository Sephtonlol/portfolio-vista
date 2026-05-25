import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NotepadComponent } from './notepad.component';
import { FilesStoreService } from '../../../services/files-store.service';
import { WindowManagerService } from '../../../services/window-manager.service';
import { AuthenticationService } from '../../../services/api/authentication/authentication.service';
import { DomSanitizer } from '@angular/platform-browser';

describe('NotepadComponent', () => {
  let component: NotepadComponent;
  let fixture: ComponentFixture<NotepadComponent>;
  let windowManagerService: jasmine.SpyObj<WindowManagerService>;
  let filesStoreService: jasmine.SpyObj<FilesStoreService>;

  beforeEach(async () => {
    windowManagerService = jasmine.createSpyObj<WindowManagerService>(
      'WindowManagerService',
      ['addWindow'],
      { focusedWindow$: of(null) },
    );
    filesStoreService = jasmine.createSpyObj<FilesStoreService>(
      'FilesStoreService',
      ['getById', 'list'],
    );
    filesStoreService.getById.and.returnValue({
      _id: 'image-1',
      name: 'sample.png',
      type: 'png',
      content: 'https://example.com/sample.png',
    } as any);

    await TestBed.configureTestingModule({
      imports: [NotepadComponent],
      providers: [
        { provide: FilesStoreService, useValue: filesStoreService },
        { provide: WindowManagerService, useValue: windowManagerService },
        { provide: AuthenticationService, useValue: {} },
        {
          provide: DomSanitizer,
          useValue: {
            bypassSecurityTrustHtml: (value: string) => value,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotepadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens Photos when clicking a rendered image', () => {
    const image = document.createElement('img');
    image.setAttribute('data-file-id', 'image-1');

    const event = {
      target: image,
      preventDefault: jasmine.createSpy('preventDefault'),
    } as unknown as MouseEvent;

    component.onPreviewClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(windowManagerService.addWindow).toHaveBeenCalledWith(
      jasmine.objectContaining({
        application: 'Photos',
        icon: 'bi-image',
        data: jasmine.objectContaining({
          title: 'sample.png',
          content: 'https://example.com/sample.png',
          type: 'image',
          url: 'https://example.com/sample.png',
          selectedId: 'image-1',
        }),
      }),
    );
  });
});
