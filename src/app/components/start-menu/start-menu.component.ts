import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import applications from '../../../data/applications.json';
import { Window } from '../../interfaces/window.interface';
import { WindowManagerService } from '../../services/window-manager.service';
import portfolio from '../../../data/portfolioData.json';
import { FileNode } from '../../interfaces/file.interface';
import { ShutDownService } from '../../services/shut-down.service';

@Component({
  selector: 'app-start-menu',
  templateUrl: './start-menu.component.html',
  styleUrls: ['./start-menu.component.css'],
})
export class StartMenuComponent implements OnInit, OnDestroy {
  @Input() searchQuery: string = '';
  applications: Window[] = applications as Window[];
  fileTree: FileNode = portfolio as FileNode;

  filteredApplications: Window[] = [];
  filteredFiles: FileNode[] = [];

  showShutDownPopup = false;
  private globalClickUnlistener!: () => void;

  @Output() closeStartMenu = new EventEmitter<null>();

  constructor(
    public windowManagerService: WindowManagerService,
    private shutdownService: ShutDownService,
    private elRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.addPaths(this.fileTree, '');

    this.globalClickUnlistener = this.renderer.listen(
      'document',
      'click',
      (event: MouseEvent) => {
        const clickedInside = this.elRef.nativeElement.contains(event.target);
        const clickedOnPopup = (event.target as HTMLElement).closest(
          '.show-shut-down'
        );
        if (!clickedInside || !clickedOnPopup) {
          this.showShutDownPopup = false;
        }
      }
    );
  }
  ngOnDestroy(): void {
    if (this.globalClickUnlistener) {
      this.globalClickUnlistener();
    }
  }

  toggleShutDownPopup() {
    this.showShutDownPopup = !this.showShutDownPopup;
  }

  shutDown(message: string) {
    this.shutdownService.shutDown(true, message);
  }

  addPaths(node: FileNode, currentPath: string): void {
    node.path = currentPath ? `${currentPath}/${node.name}` : node.name;

    if (node.children) {
      for (const child of node.children) {
        this.addPaths(child, node.path);
      }
    }
  }

  newWindow(application: string, icon: string) {
    this.windowManagerService.addWindow({
      application,
      icon,
      opened: true,
      minimized: false,
    });
    this.closeStartMenu.emit();
  }

  getFileIcon(file: FileNode): string {
    if (file.type === 'directory') return 'bi-folder';
    if (file.type === 'md') return 'bi-file-earmark-text';
    if (file.type === 'png') return 'bi-image';
    if (file.type === 'mp3') return 'bi-music-note';
    if (file.type === 'mp4') return 'bi-film';
    return 'bi-file-earmark';
  }

  searchFiles(node: FileNode, query: string): FileNode[] {
    let results: FileNode[] = [];

    if (node.name.toLowerCase().includes(query)) {
      results.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        results = results.concat(this.searchFiles(child, query));
      }
    }

    return results;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchQuery']) {
      const query = this.searchQuery.trim().toLowerCase();
      if (query !== '') {
        this.filteredApplications = this.applications.filter((app) =>
          app.application.toLowerCase().includes(query)
        );

        this.filteredFiles = this.searchFiles(this.fileTree, query);
      } else {
        this.filteredApplications = [];
        this.filteredFiles = [];
      }
    }
  }

  openFile(item: FileNode) {
    this.closeStartMenu.emit();
    switch (item.type) {
      case 'directory':
        this.windowManagerService.addWindow({
          application: 'Explorer',
          icon: 'bi-folder',
          data: {
            title: item.name,
            content: item.path || '',
            type: 'directory',
          },
        });
        break;
      case 'md':
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: item.name,
            content: item.content || '',
            type: 'text',
          },
        });
        break;
      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: item.name,
            content: item.path || '',
            type: 'image',
          },
        });
        break;
      case 'mp3':
        this.windowManagerService.addWindow({
          application: 'Music',
          icon: 'bi-music-note',
          data: {
            title: item.name,
            content: item.path || '',
            type: 'audio',
          },
        });
        break;
      case 'mp4':
        this.windowManagerService.addWindow({
          application: 'Video player',
          icon: 'bi-film',
          data: {
            title: item.name,
            content: item.path || '',
            type: 'video',
          },
        });
        break;
      default:
        console.error('File type is unsupported.');
    }
  }
}
