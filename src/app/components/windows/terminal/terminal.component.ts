import { Component } from '@angular/core';
import { FileNode } from '../../../interfaces/file.interface';
import portfolio from '../../../../data/portfolioData.json';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.css',
  imports: [FormsModule],
})
export class TerminalComponent {
  filesystem: FileNode = portfolio as FileNode;

  currentPath: string[] = [];
  output: string[] = [];
  command: string = '';

  get currentDir(): FileNode {
    let dir = this.filesystem;
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
      case 'start':
        this.startApplication(args[0]);
        break;
      case 'help':
        this.help();
        break;
      case 'clear':
        this.output = [];
        break;
      default:
        this.output.push(
          `Unknown command: ${cmd}. Type "help" for a list of commands.`
        );
    }

    this.command = '';
  }

  list() {
    const items = this.currentDir.children?.map((child) => child.name) || [];
    this.output.push(items.length ? items.join(' | ') : '(empty)');
  }

  changeDirectory(folder: string) {
    if (!folder) {
      this.output.push('cd: missing folder name');
      return;
    }

    if (folder === '..') {
      if (this.currentPath.length > 0) {
        this.currentPath.pop();
      } else {
        this.output.push('Already at root.');
      }
    } else {
      const found = this.currentDir.children?.find(
        (child) => child.name === folder && child.type === 'directory'
      );
      if (found) {
        this.currentPath.push(folder);
      } else {
        this.output.push(`No such directory: ${folder}`);
      }
    }
  }

  startApplication(fileName: string) {
    if (!fileName) {
      this.output.push('start: missing file name');
      return;
    }

    const found = this.currentDir.children?.find(
      (child) => child.name === fileName
    );
    if (found) {
      this.output.push(`Starting ${fileName}...`);
    } else {
      this.output.push(`start: file or directory "${fileName}" not found`);
    }
  }

  help() {
    this.output.push('Available commands:');
    this.output.push('- ls: List files and directories');
    this.output.push('- cd <folder>: Change directory');
    this.output.push('- start <file>: Start a file/application');
    this.output.push('- help: Show this help message');
    this.output.push('- clear: Clear the terminal');
  }
}
