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
import portfolio from '../../../data/data.json';
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
    this.applications = this.applications.filter(
      (app) =>
        app.application !== 'Media player' && app.application !== 'Photos'
    );

    this.fileTree = this.removeShortcuts(this.fileTree)!;
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

  removeShortcuts(node: FileNode): FileNode | null {
    if (node.type === 'shortcut') {
      return null;
    }

    const cleanedNode: FileNode = { ...node };
    if (cleanedNode.children) {
      cleanedNode.children = cleanedNode.children
        .map((child) => this.removeShortcuts(child))
        .filter((child): child is FileNode => child !== null);
    }

    return cleanedNode;
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

  getFileIcon(type: string): string {
    if (type === 'directory' || type === 'shortcut') return 'bi-folder';
    if (type === 'md') return 'bi-file-earmark-text';
    if (type === 'png') return 'bi-image';
    if (type === 'mp3') return 'bi-music-note';
    if (type === 'mp4') return 'bi-film';
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
      case 'mp4':
      case 'mp3':
        this.windowManagerService.addWindow({
          application: 'Media player',
          icon: 'bi-play-circle',
          data: {
            title: item.name,
            content: item.path || '',
            type: 'media',
          },
        });
        break;
      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: item.name,
            content: item.content || '',
            type: 'text',
          },
        });
    }
  }
}
