import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuService } from '../../services/context-menu.service';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.css',
})
export class ContextMenuComponent {
  @ViewChild('menuEl') private menuEl?: ElementRef<HTMLElement>;

  x = 0;
  y = 0;

  constructor(public contextMenu: ContextMenuService) {
    effect(() => {
      const state = this.contextMenu.state();
      if (!state.isOpen) return;

      this.x = state.x;
      this.y = state.y;

      // After render, clamp inside viewport.
      window.setTimeout(() => this.clampToViewport(), 0);
    });
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent) {
    // Only close on left click. Right-click often fires extra events on some
    // devices (trackpads), which would otherwise instantly close the menu.
    if (event.button !== 0) return;

    const menu = this.menuEl?.nativeElement;
    const target = event.target;
    if (menu && target instanceof Node && menu.contains(target)) return;

    this.contextMenu.close();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.contextMenu.close();
  }

  onMenuClick(event: MouseEvent) {
    event.stopPropagation();
  }

  onMenuMouseDown(event: MouseEvent) {
    event.stopPropagation();
  }

  run(item: { action: () => void; disabled?: boolean }) {
    if (item.disabled) return;
    this.contextMenu.close();
    item.action();
  }

  private clampToViewport() {
    const menu = this.menuEl?.nativeElement;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const margin = 8;

    let nextX = this.x;
    let nextY = this.y;

    if (nextX + rect.width + margin > window.innerWidth) {
      nextX = Math.max(margin, window.innerWidth - rect.width - margin);
    }

    if (nextY + rect.height + margin > window.innerHeight) {
      nextY = Math.max(margin, window.innerHeight - rect.height - margin);
    }

    if (nextX < margin) nextX = margin;
    if (nextY < margin) nextY = margin;

    this.x = Math.round(nextX);
    this.y = Math.round(nextY);
  }
}
