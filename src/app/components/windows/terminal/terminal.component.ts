import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FileNode } from '../../../interfaces/file.interface';
import portfolio from '../../../../data/portfolioData.json';
import { FormsModule } from '@angular/forms';
import { WindowManagerService } from '../../../services/window-manager.service';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.css',
  imports: [FormsModule],
})
export class TerminalComponent {
  @Output() requestScrollToBottom = new EventEmitter<void>();
  @Input() id!: string | undefined;

  fileSystem: FileNode = portfolio as FileNode;

  currentPath: string[] = [];
  output: string[] = [];
  command: string = '';

  commandHistory: string[] = [];
  historyIndex: number = -1;

  constructor(private windowManagerService: WindowManagerService) {}

  get currentDir(): FileNode {
    let dir = this.fileSystem;
    for (const part of this.currentPath) {
      const next = dir.children?.find(
        (child) => child.name === part && child.type === 'directory'
      );
      if (next) {
        dir = next;
      } else {
        throw new Error(`Path not found: ${this.currentPath.join('/')}`);
      }
    }
    return dir;
  }

  handleCommand() {
    const input = this.command.trim();
    if (!input) return;

    this.commandHistory.push(input);
    this.historyIndex = this.commandHistory.length;

    this.output.push(
      `portfolio@user:~${
        this.currentPath.length ? '/' + this.currentPath.join('/') : ''
      }$ ${input}`
    );

    const [cmd, ...args] = input.split(' ');

    switch (cmd) {
      case 'ls':
        this.list();
        break;
      case 'cd':
        this.changeDirectory(args[0]);
        break;
      case 'pwd':
        this.output.push('/' + this.currentPath.join('/'));
        break;
      case 'echo':
        this.output.push(args.join(' '));
        break;
      case 'open':
        this.openFile(args[0]);
        break;
      case 'cat':
        this.cat(args[0]);
        break;
      case 'help':
        this.showHelp();
        break;
      case 'clear':
        this.output = [];
        break;
      case 'exit':
        this.windowManagerService.closeWindow(this.id || '');

        break;
      default:
        this.output.push(
          `Unknown command: ${cmd}. Type "help" for a list of commands.`
        );
    }

    this.command = '';
    this.scrollToBottom();
  }

  list() {
    const items =
      this.currentDir.children?.map((child) =>
        child.type === 'directory' ? child.name : `${child.name}.${child.type}`
      ) || [];
    this.output.push(items.length ? items.join(' | ') : '(empty)');
  }

  changeDirectory(path: string) {
    if (!path) {
      this.output.push('cd: missing folder name');
      return;
    }

    let tempPath: string[] = [];

    if (
      path.startsWith('./') ||
      path.startsWith('../') ||
      path.startsWith('.')
    ) {
      tempPath = [...this.currentPath];
    } else if (path.startsWith('/')) {
      path = path.slice(1);
      tempPath = [];
    } else {
      tempPath = [];
    }

    const parts = path.split('/').filter(Boolean);
    let dir: FileNode = this.fileSystem;

    for (const segment of tempPath) {
      const next = dir.children?.find(
        (child) => child.name === segment && child.type === 'directory'
      );
      if (!next) {
        this.output.push(`Broken path at: ${segment}`);
        return;
      }
      dir = next;
    }

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (tempPath.length > 0) {
          tempPath.pop();
          dir = this.fileSystem;
          for (const seg of tempPath) {
            const next = dir.children?.find(
              (child) => child.name === seg && child.type === 'directory'
            );
            if (!next) {
              this.output.push(`Broken path at: ${seg}`);
              return;
            }
            dir = next;
          }
        } else {
          this.output.push('Already at root.');
          return;
        }
      } else {
        const found = dir.children?.find(
          (child) => child.name === part && child.type === 'directory'
        );
        if (!found) {
          this.output.push(`No such directory: ${part}`);
          return;
        }
        tempPath.push(part);
        dir = found;
      }
    }

    this.currentPath = tempPath;
  }

  openFile(fileName: string) {
    if (!fileName) {
      this.output.push('open: missing file name');
      return;
    }

    const file = this.currentDir.children?.find(
      (child) => `${child.name}.${child.type}` === fileName
    );
    if (!file) {
      this.output.push(`open: file "${fileName}" not found`);
      return;
    }

    switch (file.type) {
      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: file.name,
            content: '/' + this.currentPath.join('/') + '/' + file.name || '',
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
            title: file.name,
            content: '/' + this.currentPath.join('/') + '/' + file.name || '',
            type: 'media',
          },
        });
        break;
      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: file.name,
            content: file.content || 'No content available.',
            type: 'text',
          },
        });
    }
  }

  cat(fileName: string) {
    if (!fileName) {
      this.output.push('cat: missing file name');
      return;
    }

    const file = this.currentDir.children?.find(
      (child) => `${child.name}.${child.type}` === fileName
    );
    if (!file) {
      this.output.push(`cat: file "${fileName}" not found`);
      return;
    }

    if (file.type === 'md') {
      this.output.push(file.content || 'No content available.');
    } else {
      this.output.push(`cat: "${fileName}" is not a text file`);
    }
  }

  showHelp() {
    this.output.push('Available commands:');
    this.output.push('- ls: List directory contents');
    this.output.push('- cd <folder>: Change directory');
    this.output.push('- pwd: Show current path');
    this.output.push('- echo <text>: Print text');
    this.output.push('- open <file>: Open md, image, or media file');
    this.output.push('- cat <textFiles>: Preview text files');
    this.output.push('- help: Show this help');
    this.output.push('- clear: Clear terminal output');
    this.output.push('- exit: Close terminal session');
  }

  handleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.command = this.commandHistory[this.historyIndex];
        event.preventDefault();
      }
    } else if (event.key === 'ArrowDown') {
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.command = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        this.command = '';
      }
      event.preventDefault();
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.requestScrollToBottom.emit();
    }, 1);
  }
}
