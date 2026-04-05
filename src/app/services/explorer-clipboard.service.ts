import { Injectable } from '@angular/core';
import { FileNode } from '../interfaces/file.interface';

export type ExplorerClipboardMode = 'cut' | 'copy';

export type ExplorerClipboardEntry = {
  mode: ExplorerClipboardMode;
  itemId: string;
  sourceParentId: string | null;
  snapshot: FileNode;
};

@Injectable({
  providedIn: 'root',
})
export class ExplorerClipboardService {
  private entry: ExplorerClipboardEntry | null = null;

  private set(mode: ExplorerClipboardMode, item: FileNode): void {
    if (!item._id) return;
    this.entry = {
      mode,
      itemId: item._id,
      sourceParentId: item.parentId ?? null,
      snapshot: { ...item },
    };
  }

  get(): ExplorerClipboardEntry | null {
    return this.entry;
  }

  clear(): void {
    this.entry = null;
  }

  cut(item: FileNode): void {
    this.set('cut', item);
  }

  copy(item: FileNode): void {
    this.set('copy', item);
  }
}
