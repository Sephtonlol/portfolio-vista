import { Component, OnInit } from '@angular/core';
import portfolio from '../../../../data/portfolioData.json';
import { FileNode } from '../../../interfaces/file.interface';
import { FormsModule } from '@angular/forms';
import { WindowManagerService } from '../../../services/window-manager.service';

@Component({
  selector: 'app-explorer',
  imports: [FormsModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css',
})
export class ExplorerComponent implements OnInit {
  filesystem: FileNode = portfolio as FileNode;
  currentPath: string[] = [];
  searchTerm: string = '';
  pathInput: string = '';

  viewList = true;

  constructor(private windowManagerService: WindowManagerService) {}

  ngOnInit(): void {
    this.pathInput = '/' + this.currentPath.join('/');
  }

  get currentDir(): FileNode {
    let dir = this.filesystem;
    for (const part of this.currentPath) {
      const next = dir.children?.find(
        (child) => child.name === part && child.type === 'directory'
      );
      if (next) dir = next;
    }
    return dir;
  }

  get filteredChildren(): FileNode[] {
    const children = this.currentDir.children || [];
    return children
      .filter((child) =>
        child.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
  }

  openItem(item: FileNode) {
    if (item.type === 'directory') {
      this.currentPath.push(item.name);
      this.pathInput = '/' + this.currentPath.join('/');
      this.searchTerm = '';
      return;
    }

    switch (item.type) {
      case 'md':
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: item.name,
            content: item.content || 'No content available.',
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
            content: item.content || 'No content available.',
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
            content: item.content || 'No content available.',
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
            content: item.content || 'No content available.',
            type: 'video',
          },
        });
        break;
      default:
        console.error('File type is unsupported.');
    }
  }

  goUp() {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
      this.pathInput = '/' + this.currentPath.join('/');
    }
  }

  resetPathInput() {
    this.pathInput = '/' + this.currentPath.join('/');
  }

  goToTypedPath() {
    const parts = this.pathInput.split('/').filter(Boolean);
    let dir = this.filesystem;
    for (const part of parts) {
      const next = dir.children?.find(
        (child) => child.name === part && child.type === 'directory'
      );
      if (!next) return alert('Invalid path');
      dir = next;
    }
    this.currentPath = parts;
    this.searchTerm = '';
  }
}
