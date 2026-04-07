import { AfterViewInit, Component, ElementRef, Input } from '@angular/core';
import interact from 'interactjs';
import { FileNode, FileNodeType } from '../../interfaces/file.interface';
import { WindowManagerService } from '../../services/window-manager.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { FilesStoreService } from '../../services/files-store.service';
import { fileDisplayName } from '../../utils/file-utils';

@Component({
  selector: 'app-desktop-application',
  imports: [],
  templateUrl: './desktop-application.component.html',
  styleUrl: './desktop-application.component.css',
})
export class DesktopApplicationComponent implements AfterViewInit {
  @Input() application!: FileNode;
  @Input() initialPosition: { x: number; y: number } = { x: 0, y: 0 };
  @Input() deletable = true;

  shouldAnimate = true;
  private gridSize = 100;

  deleted = false;

  constructor(
    private elRef: ElementRef,
    private windowManagerService: WindowManagerService,
    private contextMenuService: ContextMenuService,
    private filesStore: FilesStoreService,
  ) {}

  ngAfterViewInit() {
    const application = this.elRef.nativeElement.querySelector('.application');

    const { x, y } = this.initialPosition;
    const gridX = x * this.gridSize;
    const gridY = y * this.gridSize;

    application.style.transform = `translate(${gridX}px, ${gridY}px)`;
    application.setAttribute('data-x', gridX.toString());
    application.setAttribute('data-y', gridY.toString());

    interact(application)
      .draggable({
        listeners: {
          move: (event) => {
            this.shouldAnimate = false;
            const application = event.target;

            let x =
              (parseFloat(application.getAttribute('data-x')) || 0) + event.dx;
            let y =
              (parseFloat(application.getAttribute('data-y')) || 0) + event.dy;

            application.style.transform = `translate(${x}px, ${y}px)`;
            application.setAttribute('data-x', x);
            application.setAttribute('data-y', y);
          },
          end: (event) => {
            setTimeout(() => {
              this.shouldAnimate = true;
              const application = event.target;
              let x = parseFloat(application.getAttribute('data-x')) || 0;
              let y = parseFloat(application.getAttribute('data-y')) || 0;

              x = Math.round(x / this.gridSize) * this.gridSize;
              y = Math.round(y / this.gridSize) * this.gridSize;
              const screenWidth = window.innerWidth;
              const screenHeight = window.innerHeight;

              if (x < 0) x = 0;
              if (y < 0) y = 0;

              if (window.innerWidth < 992) {
                if (x > screenWidth - application.offsetWidth)
                  x = screenWidth - application.offsetWidth - 56;
                if (y > screenHeight - application.offsetHeight)
                  y = screenHeight - application.offsetHeight;
              } else {
                if (x > screenWidth - application.offsetWidth)
                  x = screenWidth - application.offsetWidth;
                if (y > screenHeight - application.offsetHeight)
                  y = screenHeight - application.offsetHeight - 56;
              }

              const step = this.gridSize;
              let isOverlapping: boolean;
              const directions = [
                { dx: 0, dy: step },
                { dx: step, dy: 0 },
                { dx: -step, dy: 0 },
                { dx: 0, dy: -step },
              ];
              let directionIndex = 0;
              let iterationCount = 0;
              const maxIterations = 100;

              do {
                isOverlapping = false;

                const allApplications = Array.from(
                  document.querySelectorAll('.application'),
                ) as HTMLElement[];

                for (const sibling of allApplications) {
                  if (sibling === application) continue;

                  const siblingX =
                    parseFloat(sibling.getAttribute('data-x')!) ?? '0';
                  const siblingY =
                    parseFloat(sibling.getAttribute('data-y')!) ?? '0';

                  if (siblingX === x && siblingY === y) {
                    isOverlapping = true;

                    const direction = directions[directionIndex];
                    x += direction.dx;
                    y += direction.dy;

                    directionIndex = (directionIndex + 1) % directions.length;
                    break;
                  }
                }

                iterationCount++;
                if (iterationCount > maxIterations) {
                  console.error(
                    'Failed to resolve overlap after maximum attempts.',
                  );
                  break;
                }
              } while (isOverlapping);

              application.style.transform = `translate(${x}px, ${y}px)`;
              application.setAttribute('data-x', x.toString());
              application.setAttribute('data-y', y.toString());
            }, 0);
          },
        },
      })
      .styleCursor(false);
  }

  displayName(): string {
    return fileDisplayName(this.application);
  }

  iconClass(): string {
    const node = this.getEffectiveNode();

    if (node.type === 'url') {
      const name = (node.name || '').toLowerCase();
      if (name === 'github') return 'bi-github';
      if (name === 'linkedin') return 'bi-linkedin';
      return 'bi-link-45deg';
    }

    return this.getFileIcon(node.type);
  }

  thumbnailKind(): 'image' | 'video' | null {
    const node = this.getEffectiveNode();
    if (node.type === 'png' && this.thumbnailUrl()) return 'image';
    if (node.type === 'mp4' && this.thumbnailUrl()) return 'video';
    return null;
  }

  thumbnailUrl(): string | null {
    const node = this.getEffectiveNode();
    if (node.type === 'png' || node.type === 'mp4') {
      const url = node.url ?? node.content ?? '';
      return url ? url : null;
    }
    return null;
  }

  private getEffectiveNode(): FileNode {
    const visited = new Set<string>();
    let current: FileNode = this.application;

    for (let depth = 0; depth < 25; depth++) {
      if (current.type !== 'shortcut') return current;

      const target = current.shortcutTo ?? current.content;
      if (!target) return current;

      // Path shortcuts open in Explorer; treat as a directory for display.
      if (target.startsWith('/')) {
        return { name: current.name, type: 'directory', content: target };
      }

      if (visited.has(target)) return current;
      visited.add(target);

      const resolved = this.filesStore.getById(target);
      if (!resolved || !resolved._id) return current;
      if (current._id && resolved._id === current._id) return current;

      current = resolved;
    }

    return current;
  }

  openApplication(): void {
    const node = this.application;

    if (node.type === 'directory') {
      if (!node._id) return;
      this.windowManagerService.addWindow({
        application: 'Explorer',
        icon: 'bi-folder',
        data: {
          title: node.name,
          content: '',
          type: 'directory',
          folderId: node._id,
        },
      });
      return;
    }

    if (node.type === 'shortcut') {
      const target = node.shortcutTo ?? node.content;
      if (!target) return;

      if (target.startsWith('/')) {
        this.windowManagerService.addWindow({
          application: 'Explorer',
          icon: 'bi-folder',
          data: {
            title: node.name,
            content: target,
            type: 'directory',
          },
        });
        return;
      }

      const resolved = this.filesStore.getById(target);
      if (resolved && resolved._id && resolved._id !== node._id) {
        this.openResolvedNode(resolved);
        return;
      }

      // Best effort: treat as a folder id.
      this.windowManagerService.addWindow({
        application: 'Explorer',
        icon: 'bi-folder',
        data: {
          title: node.name,
          content: '',
          type: 'directory',
          folderId: target,
        },
      });
      return;
    }

    if (node.type === 'url') {
      const url = node.url ?? node.content ?? '';
      if (!url) return;
      window.open(url, '_blank');
      return;
    }

    if (node.type === 'png') {
      this.windowManagerService.addWindow({
        application: 'Photos',
        icon: 'bi-image',
        data: {
          title: node.name,
          content: node.url ?? node.content ?? '',
          type: 'image',
          folderId: node.parentId ?? null,
          selectedId: node._id,
          url: node.url,
        },
      });
      return;
    }

    if (node.type === 'mp4' || node.type === 'mp3') {
      this.windowManagerService.addWindow({
        application: 'Media player',
        icon: 'bi-play-circle',
        data: {
          title: node.name,
          content: node.url ?? node.content ?? '',
          type: 'media',
          folderId: node.parentId ?? null,
          selectedId: node._id,
          url: node.url,
        },
      });
      return;
    }

    // Default: treat as a text file.
    this.windowManagerService.addWindow({
      application: 'Notepad',
      icon: 'bi-file-earmark-text',
      data: {
        title: node.name,
        content: node.content || '',
        type: 'text',
        itemId: node._id,
        parentId: node.parentId ?? null,
      },
    });
  }

  private openResolvedNode(node: FileNode): void {
    if (node.type === 'directory') {
      if (!node._id) return;
      this.windowManagerService.addWindow({
        application: 'Explorer',
        icon: 'bi-folder',
        data: {
          title: node.name,
          content: '',
          type: 'directory',
          folderId: node._id,
        },
      });
      return;
    }

    // For non-directories, just reuse the main handler.
    const previous = this.application;
    this.application = node;
    try {
      this.openApplication();
    } finally {
      this.application = previous;
    }
  }

  async deleteApplication(): Promise<void> {
    if (!this.deletable) return;
    const id = this.application._id;
    if (!id) {
      this.deleted = true;
      return;
    }

    this.deleted = true;
    await this.filesStore.delete(id);
  }

  contextMenu(event: MouseEvent) {
    event.preventDefault();

    const entries = [
      {
        label: 'Open',
        action: () => this.openApplication(),
      },
    ];

    if (this.deletable) {
      entries.push({
        label: 'Delete',
        action: () => void this.deleteApplication(),
      });
    }

    this.contextMenuService.openAt(
      event.clientX + 2,
      event.clientY + 2,
      entries,
    );
  }

  private getFileIcon(type: FileNodeType): string {
    switch (type) {
      case 'directory':
      case 'shortcut':
        return 'bi-folder';
      case 'md':
        return 'bi-file-earmark-text';
      case 'png':
        return 'bi-image';
      case 'mp3':
        return 'bi-music-note';
      case 'mp4':
        return 'bi-film';
      case 'url':
        return 'bi-link-45deg';
      default:
        return 'bi-file-earmark';
    }
  }
}
