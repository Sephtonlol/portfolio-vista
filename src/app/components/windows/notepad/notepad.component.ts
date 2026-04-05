import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import { FormsModule } from '@angular/forms';
import MarkdownIt from 'markdown-it';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

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
import { logoutOn401 } from '../../../utils/file-utils';
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

    this.md.renderer.rules['heading_open'] = (tokens, idx) => {
      const token = tokens[idx];
      const level = Number(token.tag.slice(1));

      const newTag = level === 1 ? 'h5' : level === 2 ? 'h6' : token.tag;
      return `<${newTag}>`;
    };

    this.md.renderer.rules['heading_close'] = (tokens, idx) => {
      const token = tokens[idx];
      const level = Number(token.tag.slice(1));

      const newTag = level === 1 ? 'h5' : level === 2 ? 'h6' : token.tag;
      return `</${newTag}>`;
    };
  }

  ngOnInit(): void {
    this.preview = !!this.contentValue;

    this.focusSub = this.windowManagerService.focus$.subscribe((evt) => {
      if (!evt || !this.id) return;
      if (evt.id !== this.id) return;
      this.focusEditor();
    });
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
      textarea.focus();
      try {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
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
      this.updateMarkdown();
    }

    if (changes['data'] && this.data && !this.data.content) {
      this.contentValue = '';
      this.itemId = this.data.itemId;
      this.parentId = this.data.parentId ?? null;
      this.currentName = this.data.title ?? '';
      this.updateMarkdown();
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

    // If we have a known parent folder id, start there (path can't be reconstructed).
    if (this.parentId) {
      this.saveFolderIdStack.push(this.parentId);
    }

    await this.loadSaveFolders();
  }

  async closeSaveDialog() {
    this.showSaveDialog = false;
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
        if (this.data) this.data.title = created.name;

        this.showSaveDialog = false;
        return;
      }

      // Existing item: save content, and apply rename/move based on picker.
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
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  private handleAuthError(err: unknown) {
    logoutOn401(this.authenticationService, err);
  }
}
