import { HttpErrorResponse } from '@angular/common/http';
import type { FileNode } from '../interfaces/file.interface';

export function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

export function mimeToFileNodeType(mime: string): 'png' | 'mp4' | 'mp3' | null {
  const safe = mime || '';
  return safe.startsWith('image/')
    ? 'png'
    : safe.startsWith('video/')
      ? 'mp4'
      : safe.startsWith('audio/')
        ? 'mp3'
        : null;
}

export function fileDisplayName(node: Pick<FileNode, 'name' | 'type'>): string {
  if (
    node.type === 'directory' ||
    node.type === 'shortcut' ||
    node.type === 'url'
  ) {
    return node.name;
  }

  if (node.name.toLowerCase().endsWith(`.${node.type}`)) return node.name;
  return `${node.name}.${node.type}`;
}

export function logoutOn401(auth: { logout: () => void }, err: unknown): void {
  if (err instanceof HttpErrorResponse && err.status === 401) {
    auth.logout();
  }
}
