import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  ViewChild,
  SimpleChanges,
} from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import { FormsModule } from '@angular/forms';
import MarkdownIt from 'markdown-it';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FileNode } from '../../../interfaces/file.interface';

import hljs from 'highlight.js';
import csharp from 'highlight.js/lib/languages/csharp';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import { FilesStoreService } from '../../../services/files-store.service';
import { AuthenticationService } from '../../../services/api/authentication/authentication.service';
import { fileDisplayName, logoutOn401 } from '../../../utils/file-utils';
import { WindowManagerService } from '../../../services/window-manager.service';

@Component({
  selector: 'app-notepad',
  imports: [FormsModule],
  templateUrl: './notepad.component.html',
  styleUrls: ['./notepad.component.css'],
  standalone: true,
})
export class NotepadComponent
  implements OnChanges, OnInit, AfterViewInit, OnDestroy
{
  @Input() id!: string | undefined;
  @Input() data!: Data | undefined;

  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;

  private focusSub?: Subscription;

  preview = false;
  contentValue: string = '';
  sanitizedHtml: SafeHtml = '';

  private itemId?: string;
  private parentId: string | null = null;
  private currentName: string = '';

  showSaveDialog = false;
  saveFolderNames: string[] = [];
  private saveFolderIdStack: (string | null)[] = [null];
  saveFolders: { id: string; name: string }[] = [];
  saveFileName = '';

  showAttachmentDialog = false;
  attachmentFolderNames: string[] = [];
  private attachmentFolderIdStack: (string | null)[] = [null];
  attachmentFolders: { id: string; name: string }[] = [];
  attachmentFiles: FileNode[] = [];

  /**
   * Local Markdown file references.
   *
   * This allows syntax like:
   * ![image](original_plan.png)
   * ![image](./new_plan.png)
   * [Technisch ontwerp](./technisch_ontwerp.docx)
   *
   * Files are resolved relative to the current note's parent folder.
   */
  private markdownReferenceFiles = new Map<string, FileNode>();

  md: MarkdownIt;

  constructor(
    private sanitizer: DomSanitizer,
    private filesStore: FilesStoreService,
    public authenticationService: AuthenticationService,
    private windowManagerService: WindowManagerService,
    private elementRef: ElementRef<HTMLElement>,
  ) {
    hljs.registerLanguage('csharp', csharp);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('java', java);
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('html', html);

    this.md = new MarkdownIt({
      breaks: true,
      highlight: (code: any, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        } else {
          return hljs.highlightAuto(code).value;
        }
      },
    });

    /**
     * Images:
     *
     * Default:
     * ![image](original_plan.png)
     *
     * Also supported:
     * ![image](./original_plan.png)
     * ![image](attachment://fileId)
     */
    this.md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const srcIndex = token.attrIndex('src');

      if (srcIndex >= 0 && token.attrs) {
        token.attrs[srcIndex][1] = this.resolveMarkdownImageSource(
          token.attrs[srcIndex][1],
        );
      }

      const imageStyle =
        'display: block; max-width: 600px; width: 100%; height: auto; object-fit: contain; margin: 1rem 0;';
      const existingStyle = token.attrGet('style');

      token.attrSet(
        'style',
        existingStyle ? `${existingStyle}; ${imageStyle}` : imageStyle,
      );

      return self.renderToken(tokens, idx, options);
    };

    /**
     * Links:
     *
     * Default:
     * [Technisch ontwerp](./technisch_ontwerp.docx)
     *
     * If the link points to a file in the same folder as the note,
     * it gets converted internally to attachment://fileId so your
     * existing click/open system can handle it.
     */
    this.md.renderer.rules['link_open'] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const hrefIndex = token.attrIndex('href');

      if (hrefIndex >= 0 && token.attrs) {
        token.attrs[hrefIndex][1] = this.resolveMarkdownLinkHref(
          token.attrs[hrefIndex][1],
        );
      }

      return self.renderToken(tokens, idx, options);
    };
  }

  ngOnInit(): void {
    this.preview = !!this.contentValue;

    this.focusSub = this.windowManagerService.focusedWindow$.subscribe(
      (win) => {
        if (!win || !this.id) return;
        if (win.id !== this.id) return;
        this.focusEditor();
      },
    );
  }

  ngAfterViewInit(): void {
    this.focusEditor();
  }

  ngOnDestroy(): void {
    this.focusSub?.unsubscribe();
  }

  private focusEditor(): void {
    if (window.innerWidth < 922) return;
    if (this.preview) return;
    if (this.showSaveDialog) return;

    setTimeout(() => {
      const textarea =
        this.editorTextarea?.nativeElement ??
        (this.elementRef.nativeElement.querySelector(
          'textarea',
        ) as HTMLTextAreaElement | null);

      if (!textarea) return;
      if (document.activeElement === textarea) return;

      textarea.focus({ preventScroll: true });

      try {
        textarea.setSelectionRange(
          textarea.value.length,
          textarea.value.length,
        );
      } catch {
        // ignore
      }
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data?.content) {
      this.contentValue = this.data.content;
      this.itemId = this.data.itemId;
      this.parentId = this.data.parentId ?? null;
      this.currentName = this.data.title ?? '';
      void this.refreshMarkdownPreview();
    }

    if (changes['data'] && this.data && !this.data.content) {
      this.contentValue = '';
      this.itemId = this.data.itemId;
      this.parentId = this.data.parentId ?? null;
      this.currentName = this.data.title ?? '';
      void this.refreshMarkdownPreview();
    }
  }

  private async refreshMarkdownPreview(): Promise<void> {
    await this.loadMarkdownReferenceFiles();
    this.updateMarkdown();
  }

  private async loadMarkdownReferenceFiles(): Promise<void> {
    this.markdownReferenceFiles.clear();

    try {
      const children = await this.filesStore.list(this.parentId);

      for (const child of children) {
        if (child.type === 'directory') continue;

        this.registerMarkdownReferenceFile(child);
      }
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  private registerMarkdownReferenceFile(file: FileNode): void {
    const aliases = new Set<string>();

    const rawName = file.name;
    const displayName = fileDisplayName(file);
    const fileType = file.type?.toLowerCase();

    aliases.add(rawName);
    aliases.add(displayName);

    if (fileType && !rawName.toLowerCase().endsWith(`.${fileType}`)) {
      aliases.add(`${rawName}.${fileType}`);
    }

    if (fileType && !displayName.toLowerCase().endsWith(`.${fileType}`)) {
      aliases.add(`${displayName}.${fileType}`);
    }

    for (const alias of aliases) {
      const normalized = this.normalizeMarkdownPath(alias);

      this.markdownReferenceFiles.set(normalized, file);
      this.markdownReferenceFiles.set(`./${normalized}`, file);
    }
  }

  updateMarkdown() {
    const rawHtml = this.md.render(this.contentValue || '');
    this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }

  onContentChange() {
    this.updateMarkdown();
  }

  get canSave(): boolean {
    return true;
  }

  private get saveFolderId(): string | null {
    return this.saveFolderIdStack[this.saveFolderIdStack.length - 1] ?? null;
  }

  async save() {
    if (!this.canSave) return;
    await this.openSaveDialog();
  }

  private async openSaveDialog() {
    this.showSaveDialog = true;
    this.saveFileName = this.currentName || this.data?.title || 'notes.md';

    this.saveFolderNames = [];
    this.saveFolderIdStack = [null];

    if (this.parentId) {
      this.saveFolderIdStack.push(this.parentId);

      const parentFolder = this.filesStore.getById(this.parentId);
      if (parentFolder) {
        this.saveFolderNames.push(parentFolder.name);
      }
    }

    await this.loadSaveFolders();
  }

  async closeSaveDialog() {
    this.showSaveDialog = false;
  }

  openAttachmentPicker() {
    void this.openAttachmentDialog();
  }

  async openAttachmentDialog() {
    this.showAttachmentDialog = true;
    this.attachmentFolderNames = [];
    this.attachmentFolderIdStack = [null];

    if (this.parentId) {
      this.attachmentFolderIdStack.push(this.parentId);

      const parentFolder = this.filesStore.getById(this.parentId);
      if (parentFolder) {
        this.attachmentFolderNames.push(parentFolder.name);
      }
    }

    await this.loadAttachmentFolders();
  }

  closeAttachmentDialog() {
    this.showAttachmentDialog = false;
  }

  private get attachmentFolderId(): string | null {
    return (
      this.attachmentFolderIdStack[this.attachmentFolderIdStack.length - 1] ??
      null
    );
  }

  async loadAttachmentFolders() {
    try {
      const children = await this.filesStore.list(this.attachmentFolderId);

      this.attachmentFolders = children
        .filter((c) => c.type === 'directory' && !!c._id)
        .map((c) => ({ id: c._id!, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      this.attachmentFiles = children
        .filter((c) => c.type !== 'directory')
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      this.attachmentFolders = [];
      this.attachmentFiles = [];
      this.handleAuthError(err);
    }
  }

  async enterAttachmentFolder(folder: { id: string; name: string }) {
    this.attachmentFolderIdStack.push(folder.id);
    this.attachmentFolderNames.push(folder.name);
    await this.loadAttachmentFolders();
  }

  async upAttachmentFolder() {
    if (this.attachmentFolderIdStack.length <= 1) return;

    this.attachmentFolderIdStack.pop();
    this.attachmentFolderNames.pop();

    await this.loadAttachmentFolders();
  }

  chooseAttachmentFile(file: FileNode) {
    this.insertAttachmentReference(file);
    this.closeAttachmentDialog();
  }

  attachmentDisplayName(file: FileNode): string {
    return fileDisplayName(file);
  }

  isAttachmentPreviewable(file: FileNode): boolean {
    return file.type === 'png' || file.type === 'mp4';
  }

  attachmentThumbnail(file: FileNode): string {
    return file.url ?? file.content ?? '';
  }

  attachmentGlyph(file: FileNode): string {
    switch (file.type) {
      case 'png':
        return 'bi-image';
      case 'mp4':
        return 'bi-film';
      case 'mp3':
        return 'bi-music-note';
      case 'md':
        return 'bi-file-earmark-text';
      case 'shortcut':
        return 'bi-arrow-up-right-square-fill';
      case 'url':
        return 'bi-link-45deg';
      default:
        return 'bi-file-earmark';
    }
  }

  async loadSaveFolders() {
    try {
      const children = await this.filesStore.list(this.saveFolderId);

      this.saveFolders = children
        .filter((c) => c.type === 'directory' && !!c._id)
        .map((c) => ({ id: c._id!, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      this.saveFolders = [];
      this.handleAuthError(err);
    }
  }

  async enterSaveFolder(folder: { id: string; name: string }) {
    this.saveFolderIdStack.push(folder.id);
    this.saveFolderNames.push(folder.name);

    await this.loadSaveFolders();
  }

  async upSaveFolder() {
    if (this.saveFolderIdStack.length <= 1) return;

    this.saveFolderIdStack.pop();
    this.saveFolderNames.pop();

    await this.loadSaveFolders();
  }

  async confirmSaveToFolder() {
    if (!this.canSave) return;

    const name = this.saveFileName.trim();
    if (!name) return;

    const targetParentId = this.saveFolderId;

    try {
      if (!this.itemId) {
        const created = await this.filesStore.create({
          name,
          type: 'md',
          parentId: targetParentId,
          content: this.contentValue,
        });

        this.itemId = created._id;
        this.parentId = created.parentId ?? targetParentId;
        this.currentName = created.name;

        if (this.data) {
          this.data.title = created.name;
          this.data.parentId = this.parentId;
          this.data.itemId = this.itemId;
        }

        this.showSaveDialog = false;
        await this.refreshMarkdownPreview();
        return;
      }

      await this.filesStore.update(this.itemId, {
        name: name !== this.currentName ? name : undefined,
        content: this.contentValue,
      });

      if ((this.parentId ?? null) !== targetParentId) {
        await this.filesStore.move(this.itemId, targetParentId);
        this.parentId = targetParentId;
      }

      this.currentName = name;

      if (this.data) {
        this.data.title = name;
        this.data.parentId = this.parentId;
        this.data.itemId = this.itemId;
      }

      this.showSaveDialog = false;
      await this.refreshMarkdownPreview();
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  onPreviewClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('attachment://')) return;

    event.preventDefault();

    const attachmentId = href.slice('attachment://'.length);
    const node = this.resolveAttachmentNodeById(attachmentId);
    if (!node) return;

    this.openFileNode(node);
  }

  /**
   * Insert references using normal Markdown relative-path syntax by default.
   *
   * Images:
   * ![image](original_plan.png)
   *
   * Files:
   * [Technisch ontwerp](technisch_ontwerp.docx)
   */
  private insertAttachmentReference(file: FileNode): void {
    const displayName = fileDisplayName(file);
    const fileName = fileDisplayName(file);

    const reference =
      file.type === 'png'
        ? `![${displayName}](${fileName})`
        : `[${displayName}](${fileName})`;

    const prefix =
      this.contentValue && !this.contentValue.endsWith('\n') ? '\n\n' : '';

    this.insertTextAtCursor(`${prefix}${reference}`);
  }

  private insertTextAtCursor(text: string): void {
    const textarea = this.editorTextarea?.nativeElement;
    const currentValue = this.contentValue ?? '';

    if (!textarea) {
      this.contentValue = `${currentValue}${text}`;
      this.updateMarkdown();
      return;
    }

    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;

    this.contentValue = `${currentValue.slice(0, start)}${text}${currentValue.slice(end)}`;
    this.updateMarkdown();

    window.setTimeout(() => {
      textarea.focus({ preventScroll: true });

      const caret = start + text.length;
      textarea.setSelectionRange(caret, caret);
    }, 0);
  }

  /**
   * Resolves Markdown image sources.
   *
   * Main supported syntax:
   * ![image](original_plan.png)
   * ![image](./original_plan.png)
   *
   * Backwards-compatible syntax:
   * ![image](attachment://fileId)
   */
  private resolveMarkdownImageSource(src: string): string {
    if (this.isExternalOrSpecialHref(src)) return src;

    if (src.startsWith('attachment://')) {
      const attachmentId = src.slice('attachment://'.length);
      const node = this.resolveAttachmentNodeById(attachmentId);
      return node?.url ?? node?.content ?? src;
    }

    const file = this.resolveMarkdownFileReference(src);
    if (!file) return src;

    const resolved = this.resolveAttachmentNode(file);

    return resolved.url ?? resolved.content ?? src;
  }

  /**
   * Resolves Markdown links.
   *
   * Main supported syntax:
   * [Technisch ontwerp](technisch_ontwerp.docx)
   * [Technisch ontwerp](./technisch_ontwerp.docx)
   *
   * These are internally converted to attachment://fileId so onPreviewClick()
   * can open the file with your existing window system.
   */
  private resolveMarkdownLinkHref(href: string): string {
    if (href.startsWith('attachment://')) return href;
    if (this.isExternalOrSpecialHref(href)) return href;

    const file = this.resolveMarkdownFileReference(href);
    if (!file?._id) return href;

    return `attachment://${file._id}`;
  }

  private resolveMarkdownFileReference(path: string): FileNode | null {
    const normalizedPath = this.normalizeMarkdownPath(path);

    return (
      this.markdownReferenceFiles.get(normalizedPath) ??
      this.markdownReferenceFiles.get(`./${normalizedPath}`) ??
      null
    );
  }

  private normalizeMarkdownPath(path: string): string {
    let normalized = path.trim();

    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Keep original if decoding fails.
    }

    normalized = normalized.replace(/\\/g, '/');

    while (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    return normalized;
  }

  private isExternalOrSpecialHref(href: string): boolean {
    return (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#') ||
      href.startsWith('data:') ||
      href.startsWith('blob:')
    );
  }

  private resolveAttachmentNodeById(id: string): FileNode | null {
    const node = this.filesStore.getById(id);
    return node ? this.resolveAttachmentNode(node) : null;
  }

  resolveAttachmentNode(file: FileNode): FileNode {
    if (file.type !== 'shortcut') return file;

    const visited = new Set<string>();
    let current: FileNode = file;

    for (let depth = 0; depth < 25; depth++) {
      if (current.type !== 'shortcut') return current;

      const target = current.shortcutTo ?? current.content;
      if (!target) return current;

      if (target.startsWith('/')) {
        return { name: current.name, type: 'directory' } as FileNode;
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

  private openFileNode(file: FileNode): void {
    const resolved = this.resolveAttachmentNode(file);

    switch (resolved.type) {
      case 'directory':
        if (!resolved._id) return;

        this.windowManagerService.addWindow({
          application: 'Explorer',
          icon: 'bi-folder2-open',
          data: {
            title: resolved.name,
            content: '',
            type: 'directory',
            folderId: resolved._id,
          },
        });
        return;

      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: resolved.name,
            content: resolved.url ?? resolved.content ?? '',
            type: 'image',
            folderId: resolved.parentId ?? null,
            selectedId: resolved._id,
            url: resolved.url,
          },
        });
        return;

      case 'mp4':
      case 'mp3':
        this.windowManagerService.addWindow({
          application: 'Media player',
          icon: 'bi-play-circle',
          data: {
            title: resolved.name,
            content: resolved.url ?? resolved.content ?? '',
            type: 'media',
            folderId: resolved.parentId ?? null,
            selectedId: resolved._id,
            url: resolved.url,
          },
        });
        return;

      case 'url':
        window.open(resolved.url ?? resolved.content ?? '', '_blank');
        return;

      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: resolved.name,
            content: resolved.content || '',
            type: 'text',
            itemId: resolved._id,
            parentId: resolved.parentId ?? null,
          },
        });
    }
  }

  private handleAuthError(err: unknown) {
    logoutOn401(this.authenticationService, err);
  }
}
