import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { FileNode, FileNodeType } from '../interfaces/file.interface';
import { FilesService } from './api/files/files.service';
import { AuthenticationService } from './api/authentication/authentication.service';

type ParentId = string | null;

type ParentKey = string;

function parentKey(parentId: ParentId): ParentKey {
  return parentId ?? 'null';
}

function fromParentKey(key: ParentKey): ParentId {
  return key === 'null' ? null : key;
}

function isLocalId(id: string | undefined): boolean {
  return !!id && id.startsWith('local:');
}

function nowIso(): string {
  return new Date().toISOString();
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable({
  providedIn: 'root',
})
export class FilesStoreService {
  private readonly serverChildrenByParent = new Map<ParentKey, FileNode[]>();
  private readonly knownServerById = new Map<string, FileNode>();

  private readonly localById = new Map<string, FileNode>();
  private readonly localPatchesById = new Map<string, Partial<FileNode>>();
  private readonly localDeletedIds = new Set<string>();

  private readonly subjectsByParent = new Map<
    ParentKey,
    BehaviorSubject<FileNode[]>
  >();

  constructor(
    private filesApi: FilesService,
    private authenticationService: AuthenticationService,
  ) {}

  private canWriteServer(): boolean {
    return this.authenticationService.admin();
  }

  children$(parentId: ParentId): BehaviorSubject<FileNode[]> {
    const key = parentKey(parentId);
    let subject = this.subjectsByParent.get(key);
    if (!subject) {
      subject = new BehaviorSubject<FileNode[]>(this.computeChildren(parentId));
      this.subjectsByParent.set(key, subject);
      // Fire and forget refresh so first subscribers quickly get server data.
      void this.refresh(parentId);
    }
    return subject;
  }

  snapshot(parentId: ParentId): FileNode[] {
    return this.children$(parentId).value;
  }

  getById(id: string): FileNode | null {
    return this.getEffectiveById(id);
  }

  async list(parentId: ParentId): Promise<FileNode[]> {
    await this.refresh(parentId);
    return this.snapshot(parentId);
  }

  async refresh(parentId: ParentId): Promise<void> {
    try {
      const children = await firstValueFrom(
        this.filesApi.listByParent(parentId),
      );
      this.serverChildrenByParent.set(parentKey(parentId), children);
      for (const item of children) {
        if (item._id) this.knownServerById.set(item._id, item);
      }
    } catch {
      // Keep existing cache if server not reachable.
    }

    this.emitParent(parentId);

    // If any known items are locally moved into/out of another watched folder,
    // those folders need recomputation too.
    this.emitAllWatched();
  }

  async create(input: {
    name: string;
    type: FileNodeType;
    parentId: ParentId;
    content?: string;
    url?: string;
    shortcutTo?: string;
  }): Promise<FileNode> {
    if (this.canWriteServer()) {
      const created = await firstValueFrom(this.filesApi.create(input));
      if (created._id) this.knownServerById.set(created._id, created);
      await this.refresh(created.parentId ?? input.parentId);
      return created;
    }

    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const id = `local:${uuid}`;
    const item: FileNode = {
      _id: id,
      name: input.name,
      type: input.type,
      parentId: input.parentId,
      content: input.content,
      url: input.url,
      shortcutTo: input.shortcutTo,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.localById.set(id, item);
    this.emitAllWatched();
    return item;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<FileNode, 'name' | 'type' | 'content' | 'url' | 'shortcutTo'>
    >,
  ): Promise<FileNode | null> {
    const cleanedPatch = stripUndefined(patch);

    if (isLocalId(id) && this.localById.has(id)) {
      const current = this.localById.get(id)!;
      const updated: FileNode = {
        ...current,
        ...cleanedPatch,
        updatedAt: nowIso(),
      };
      this.localById.set(id, updated);
      this.emitAllWatched();
      return updated;
    }

    if (this.canWriteServer()) {
      const updated = await firstValueFrom(
        this.filesApi.update(id, cleanedPatch),
      );
      if (updated._id) this.knownServerById.set(updated._id, updated);
      await this.refresh(updated.parentId ?? null);
      return updated;
    }

    // Offline: store patch overlay.
    const existing = this.localPatchesById.get(id) ?? {};
    this.localPatchesById.set(id, { ...existing, ...cleanedPatch });
    this.emitAllWatched();
    return this.getEffectiveById(id);
  }

  async move(id: string, newParentId: ParentId): Promise<void> {
    if (isLocalId(id) && this.localById.has(id)) {
      const current = this.localById.get(id)!;
      this.localById.set(id, {
        ...current,
        parentId: newParentId,
        updatedAt: nowIso(),
      });
      this.emitAllWatched();
      return;
    }

    const beforeParentId = this.getEffectiveParentId(id);

    if (this.canWriteServer()) {
      const moved = await firstValueFrom(this.filesApi.move(id, newParentId));
      if (moved._id) this.knownServerById.set(moved._id, moved);
      await this.refresh(beforeParentId);
      await this.refresh(newParentId);
      return;
    }

    const existing = this.localPatchesById.get(id) ?? {};
    this.localPatchesById.set(id, { ...existing, parentId: newParentId });
    this.emitAllWatched();
  }

  async delete(id: string): Promise<void> {
    if (isLocalId(id) && this.localById.has(id)) {
      this.localById.delete(id);
      this.emitAllWatched();
      return;
    }

    const beforeParentId = this.getEffectiveParentId(id);

    if (this.canWriteServer()) {
      await firstValueFrom(this.filesApi.delete(id));
      // Keep it hidden immediately even before a refresh.
      this.localDeletedIds.add(id);
      await this.refresh(beforeParentId);
      return;
    }

    this.localDeletedIds.add(id);
    this.emitAllWatched();
  }

  private emitAllWatched() {
    for (const key of this.subjectsByParent.keys()) {
      this.emitParent(fromParentKey(key));
    }
  }

  private emitParent(parentId: ParentId) {
    const key = parentKey(parentId);
    const subject = this.subjectsByParent.get(key);
    if (!subject) return;
    subject.next(this.computeChildren(parentId));
  }

  private computeChildren(parentId: ParentId): FileNode[] {
    const key = parentKey(parentId);

    const serverChildren = this.serverChildrenByParent.get(key) ?? [];
    const base: FileNode[] = [];

    for (const item of serverChildren) {
      const id = item._id;
      if (id && this.localDeletedIds.has(id)) continue;

      const patched = id ? this.applyPatch(item) : item;

      // Hide moved-away items.
      if ((patched.parentId ?? null) !== parentId) continue;

      base.push(patched);
    }

    // Moved-in server items (patched parentId matches target, but not in server list).
    for (const [id, patch] of this.localPatchesById.entries()) {
      if (this.localDeletedIds.has(id)) continue;
      const patchedParentId = (patch.parentId ??
        this.knownServerById.get(id)?.parentId ??
        null) as ParentId;
      if (patchedParentId !== parentId) continue;

      const alreadyIncluded = base.some((c) => c._id === id);
      if (alreadyIncluded) continue;

      const original = this.knownServerById.get(id);
      if (!original) continue;
      base.push(this.applyPatch(original));
    }

    // Local created items.
    for (const item of this.localById.values()) {
      if (this.localDeletedIds.has(item._id!)) continue;
      if ((item.parentId ?? null) !== parentId) continue;
      base.push(item);
    }

    // Keep stable sorting (directories first, then name).
    return base.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  private applyPatch(item: FileNode): FileNode {
    if (!item._id) return item;
    const patch = this.localPatchesById.get(item._id);
    if (!patch) return item;
    return { ...item, ...patch };
  }

  private getEffectiveById(id: string): FileNode | null {
    if (this.localById.has(id)) return this.localById.get(id)!;
    const base = this.knownServerById.get(id);
    if (!base) return null;
    if (this.localDeletedIds.has(id)) return null;
    return this.applyPatch(base);
  }

  private getEffectiveParentId(id: string): ParentId {
    const local = this.localById.get(id);
    if (local) return local.parentId ?? null;

    const patch = this.localPatchesById.get(id);
    if (patch && 'parentId' in patch) {
      return (patch.parentId ?? null) as ParentId;
    }

    return this.knownServerById.get(id)?.parentId ?? null;
  }
}
