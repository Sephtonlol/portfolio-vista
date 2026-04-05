import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { DesktopComponent } from './desktop.component';
import { FilesStoreService } from '../../services/files-store.service';
import type { FileNode } from '../../interfaces/file.interface';

describe('DesktopComponent', () => {
  let component: DesktopComponent;
  let fixture: ComponentFixture<DesktopComponent>;

  beforeEach(async () => {
    const roots$ = new BehaviorSubject<FileNode[]>([]);
    const desktop$ = new BehaviorSubject<FileNode[]>([]);
    const filesStoreStub: Pick<
      FilesStoreService,
      'children$' | 'list' | 'create' | 'refresh' | 'getById' | 'delete'
    > = {
      children$: (parentId: string | null) =>
        (parentId === null ? roots$ : desktop$) as any,
      list: async () => [],
      create: async (input: any) => ({ _id: 'local:desktop', ...input }),
      refresh: async () => {},
      getById: () => null,
      delete: async () => {},
    };

    await TestBed.configureTestingModule({
      imports: [DesktopComponent],
      providers: [{ provide: FilesStoreService, useValue: filesStoreStub }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DesktopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
