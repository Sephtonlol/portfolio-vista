import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesktopApplicationComponent } from './desktop-application.component';
import { FilesStoreService } from '../../services/files-store.service';
import type { FileNode } from '../../interfaces/file.interface';

describe('DesktopApplicationComponent', () => {
  let component: DesktopApplicationComponent;
  let fixture: ComponentFixture<DesktopApplicationComponent>;

  beforeEach(async () => {
    const filesStoreStub: Pick<FilesStoreService, 'getById' | 'delete'> = {
      getById: () => null,
      delete: async () => {},
    };

    await TestBed.configureTestingModule({
      imports: [DesktopApplicationComponent],
      providers: [{ provide: FilesStoreService, useValue: filesStoreStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopApplicationComponent);
    component = fixture.componentInstance;

    const app: FileNode = {
      _id: 'local:1',
      name: 'Test',
      type: 'directory',
      parentId: null,
    };
    component.application = app;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
