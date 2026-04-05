import { Injectable, signal } from '@angular/core';

export type ContextMenuItem = {
  label: string;
  action: () => void;
  disabled?: boolean;
};

export type ContextMenuState = {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
};

@Injectable({
  providedIn: 'root',
})
export class ContextMenuService {
  state = signal<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });

  openAt(x: number, y: number, items: ContextMenuItem[]) {
    this.state.set({
      isOpen: true,
      x: Math.round(x),
      y: Math.round(y),
      items,
    });
  }

  close() {
    const current = this.state();
    if (!current.isOpen) return;
    this.state.set({ ...current, isOpen: false, items: [] });
  }
}
