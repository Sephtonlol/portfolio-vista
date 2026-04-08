import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import interact from 'interactjs';
import { TerminalComponent } from '../windows/terminal/terminal.component';
import { ExplorerComponent } from '../windows/explorer/explorer.component';
import { CalculatorComponent } from '../windows/calculator/calculator.component';
import { NotepadComponent } from '../windows/notepad/notepad.component';
import { PhotosComponent } from '../windows/photos/photos.component';
import { PlayerComponent } from '../windows/player/player.component';
import { SettingsComponent } from '../windows/settings/settings.component';
import { Subscription } from 'rxjs';
import { WindowManagerService } from '../../services/window-manager.service';
import {
  Window,
  WindowBounds,
  WindowLayout,
  WindowLayoutMode,
} from '../../interfaces/window.interface';
import { BrowserComponent } from '../windows/browser/browser.component';
import { ContextMenuService } from '../../services/context-menu.service';

@Component({
  selector: 'app-window',
  standalone: true,
  imports: [
    TerminalComponent,
    ExplorerComponent,
    CalculatorComponent,
    NotepadComponent,
    PhotosComponent,
    PlayerComponent,
    SettingsComponent,
    BrowserComponent,
  ],
  templateUrl: './window.component.html',
  styleUrl: './window.component.css',
})
export class WindowComponent implements AfterViewInit, OnInit {
  @ViewChild('windowContent') container!: ElementRef;
  @Input() windowData!: Window;
  @Input() id!: string | undefined;

  maximizing = false;
  isMaximized = false;
  minimumSize = { width: 300, height: 175 };
  initialSize = { width: 600, height: 400 };
  lastPosition = { x: 100, y: 50 };
  lastSize = this.initialSize;
  shouldAnimate = true;

  zIndex = 0;

  snapMargin = 20;
  screenWidth!: number;
  screeHeight!: number;

  isLeftSnap = false;
  isRightSnap = false;
  isSnapped = false;

  windowEl!: HTMLElement;

  static currentZIndex = 1;

  private focusSub!: Subscription;
  private minimizeSub!: Subscription;

  private readonly desktopTaskbarHeightRem = 3.5;

  constructor(
    private el: ElementRef,
    private windowManagerService: WindowManagerService,
    private cdr: ChangeDetectorRef,
    private contextMenu: ContextMenuService,
  ) {}

  onHeaderContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Right-clicking a header should also focus that window.
    // Don't use "unminimize" here; the focus subscription uses that signal
    // to restore/apply the last position, which would break snapped state.
    this.windowManagerService.focusWindow(this.id || '', false);

    const minimized = !!this.windowData.minimized;

    this.contextMenu.openAt(event.clientX + 2, event.clientY + 2, [
      {
        label: 'Close',
        action: () => this.closeWindow(),
      },
      {
        label: 'Minimize',
        action: () => this.minimizeWindow(),
        disabled: minimized,
      },
      {
        label: this.isMaximized ? 'Restore' : 'Maximize',
        action: () =>
          this.isMaximized ? this.unmaximizeWindow() : this.maximizeWindow(),
        disabled: minimized,
      },
    ]);
  }
  ngOnInit(): void {
    if (window.innerWidth < 992) {
      this.lastPosition = { x: 0, y: 0 };
    }
  }

  ngAfterViewInit() {
    this.screenWidth = window.innerWidth;
    this.screeHeight = window.innerHeight;
    this.windowEl = this.el.nativeElement.querySelector(`.window-${this.id}`);

    switch (this.windowData.application) {
      case 'Settings':
        this.initialSize =
          this.minimumSize =
          this.lastSize =
            { width: 700, height: 600 };
        break;
      case 'Calculator':
        this.initialSize =
          this.minimumSize =
          this.lastSize =
            { width: 350, height: 400 };
        break;
      case 'Browser':
        this.initialSize =
          this.minimumSize =
          this.lastSize =
            { width: 900, height: 600 };
        break;
    }

    const size = this.initialSize;

    setTimeout(() => {
      const layout = this.windowData.layout;
      if (layout) {
        this.restoreLayout(layout);
        return;
      }

      if (window.innerWidth < 992) {
        this.lastPosition = { x: 25, y: 25 };

        this.windowEl.style.width = 'calc(100vw - 55.2px)';
        this.windowEl.style.height = '100dvh';
      } else {
        this.windowEl.style.width = `${size.width}px`;
        this.windowEl.style.height = `${size.height}px`;
      }
    }, 0);

    this.focusSub = this.windowManagerService.focus$.subscribe((focused) => {
      if (focused?.id === this.id) {
        setTimeout(() => {
          WindowComponent.currentZIndex++;
          this.zIndex = WindowComponent.currentZIndex;
          this.cdr.detectChanges();
        }, 0);

        if (focused && focused.unminimize) {
          if (this.isMaximized) {
            this.screenWidth = window.innerWidth;
            this.windowEl.style.transform = `translate(0px, 0px) scale(1, 1)`;
            if (this.screenWidth < 992) {
              this.windowEl.style.width = `calc(100vw - 55.2px)`;
              this.windowEl.style.height = `100dvh`;
            } else {
              this.windowEl.style.width = '100vw';
              this.windowEl.style.height = 'calc(100dvh - 3.5rem)';
            }
          } else {
            this.applyLast();
          }
          setTimeout(() => {
            this.windowData.minimized = false;
          });
        }
      }
    });

    this.minimizeSub = this.windowManagerService.minimize$.subscribe(
      (minimizedIndex) => {
        if (minimizedIndex === this.id) {
          if (!this.isMaximized) this.saveLast();
          this.windowEl.style.transform = `translate(25vw, 100vh) scale(0, 0)`;
          this.windowData.minimized = true;
        }
      },
    );

    this.windowEl.addEventListener('mousedown', (event: MouseEvent) => {
      const header = this.windowEl.querySelector('.window-header');
      const controls = this.windowEl.querySelector('.window-controls');
      const isHeader = header?.contains(event.target as Node) ?? false;
      const isControlButton = controls?.contains(event.target as Node) ?? false;

      this.windowManagerService.focusWindow(
        this.id || '',
        false,
        isHeader && !isControlButton,
      );
    });

    let dragStarted = false;

    interact(this.windowEl)
      .draggable({
        allowFrom: '.window-header',
        ignoreFrom: '.window-controls, .window-controls *, .window-header i',
        listeners: {
          move: (event) => {
            const target = event.target;
            if (!this.isMaximized && !this.isSnapped && !dragStarted)
              this.saveLast();
            if ((this.isMaximized || this.isSnapped) && !dragStarted) {
              this.isSnapped = false;

              this.unmaximizeWindow();
              let x = event.client.x - this.lastSize.width / 2;
              const y = event.client.y - 15;
              if (window.innerWidth < 992)
                x = event.client.x - this.lastSize.width / 2 - 56;

              target.style.transform = `translate(${x}px, ${y}px)`;
              target.setAttribute('data-x', x.toString());
              target.setAttribute('data-y', y.toString());
              this.windowEl.style.width = `${this.lastSize.width}px`;
              this.windowEl.style.height = `${this.lastSize.height}px`;
            } else {
              const currentX = parseFloat(target.getAttribute('data-x')!);
              let x = (isNaN(currentX) ? 100 : currentX) + event.dx;
              const currentY = parseFloat(target.getAttribute('data-y')!);
              let y = (isNaN(currentY) ? 50 : currentY) + event.dy;

              if (window.innerWidth < 992) {
                x =
                  (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
                y =
                  (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;
              }

              target.style.transform = `translate(${x}px, ${y}px)`;
              target.setAttribute('data-x', x.toString());
              target.setAttribute('data-y', y.toString());
            }
            if (!dragStarted) dragStarted = true;

            this.shouldAnimate = false;
            if (window.innerWidth < 992)
              this.isLeftSnap = event.client.x < this.snapMargin + 56;
            else this.isLeftSnap = event.client.x < this.snapMargin;
            this.isRightSnap =
              event.client.x > this.screenWidth - this.snapMargin;
            this.maximizing =
              !this.isMaximized &&
              event.client.y < 25 &&
              !this.isLeftSnap &&
              !this.isRightSnap;
          },
          end: (event) => {
            dragStarted = false;
            setTimeout(() => {
              this.shouldAnimate = true;
              if (!this.isMaximized && event.client.y < 25) {
                this.maximizeWindow(false);
                this.maximizing = false;
              }
              if (this.isLeftSnap || this.isRightSnap) {
                this.snapWindow();
              } else if (
                !this.maximizing &&
                !this.isSnapped &&
                !this.isMaximized
              ) {
                this.clampWindowToLowestVisibleHeader();
                this.saveLast();
              }
              this.isLeftSnap = false;
              this.isRightSnap = false;
            }, 0);
          },
        },
        cursorChecker: () => '',
      })
      .resizable({
        edges: { top: true, left: true, bottom: true, right: true },
        margin: 4,
        modifiers: [
          interact.modifiers.restrictSize({
            min: this.minimumSize,
          }),
        ],
        listeners: {
          move: (event) => {
            this.shouldAnimate = false;
            const target = event.target;
            let x = parseFloat(target.getAttribute('data-x')!) || 100;
            let y = parseFloat(target.getAttribute('data-y')!) || 50;
            if (window.innerWidth < 992) {
              x = 25;
              y = 25;
            }

            target.style.width = `${event.rect.width}px`;
            target.style.height = `${event.rect.height}px`;

            x += event.deltaRect.left;
            y += event.deltaRect.top;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x.toString());
            target.setAttribute('data-y', y.toString());
          },
          end: () => {
            if (!this.isMaximized && !this.isSnapped) {
              this.clampWindowToLowestVisibleHeader();
            }
            this.saveLast();
            setTimeout(() => {
              this.shouldAnimate = true;
            }, 0);
          },
        },
      });

    setTimeout(() => {
      if (this.windowData.layout) return;

      const step = 30;
      let x = this.lastPosition.x;
      let y = this.lastPosition.y;

      let isOnTop: boolean;
      do {
        isOnTop = false;

        const allWindows = Array.from(
          document.querySelectorAll('.window'),
        ) as HTMLElement[];

        for (const win of allWindows) {
          if (win === this.windowEl) continue;

          const style = window.getComputedStyle(win);
          const transform = style.transform;
          let otherX = 100,
            otherY = 50;
          if (transform && transform !== 'none') {
            const match = transform.match(/matrix.*\((.+)\)/);
            if (match) {
              const values = match[1].split(', ');
              otherX = parseFloat(values[4]);
              otherY = parseFloat(values[5]);
            }
          }

          if (otherX === x && otherY === y) {
            isOnTop = true;
            x += step;
            y += step;
            break;
          }
        }
      } while (isOnTop);

      this.windowEl.style.transform = `translate(${x}px, ${y}px)`;
      this.windowEl.setAttribute('data-x', x.toString());
      this.windowEl.setAttribute('data-y', y.toString());
      this.saveLast();
    }, 250);

    this.windowManagerService.focusWindow(this.id || '', true);
    setTimeout(() => {
      this.handleResponsiveMaximize();
    }, 250);

    window.addEventListener('resize', this.handleResponsiveMaximize.bind(this));
  }

  private getDesktopTaskbarHeightPx(): number {
    const rootFontSizePx = parseFloat(
      window.getComputedStyle(document.documentElement).fontSize || '16',
    );
    return rootFontSizePx * this.desktopTaskbarHeightRem;
  }

  private clampWindowToLowestVisibleHeader(): void {
    if (!this.windowEl) return;

    const header = this.windowEl.querySelector(
      '.window-header',
    ) as HTMLElement | null;
    const headerHeight = header?.offsetHeight ?? 0;

    const reservedBottom =
      window.innerWidth < 992 ? 0 : this.getDesktopTaskbarHeightPx();
    const maxY = Math.max(
      0,
      window.innerHeight - reservedBottom - headerHeight,
    );

    let currentX = parseFloat(this.windowEl.getAttribute('data-x') ?? '');
    let currentY = parseFloat(this.windowEl.getAttribute('data-y') ?? '');
    if (Number.isNaN(currentX)) currentX = this.lastPosition.x ?? 0;
    if (Number.isNaN(currentY)) currentY = this.lastPosition.y ?? 0;

    if (currentY <= maxY) return;

    const clampedY = maxY;
    this.windowEl.style.transform = `translate(${currentX}px, ${clampedY}px)`;
    this.windowEl.setAttribute('data-x', currentX.toString());
    this.windowEl.setAttribute('data-y', clampedY.toString());
  }

  handleResponsiveMaximize() {
    this.screenWidth = window.innerWidth;
    if (this.screenWidth < 992) {
      this.lastPosition = {
        x: 25,
        y: 25,
      };
      if (this.windowData.application === 'Calculator')
        this.lastSize = {
          width: 350,
          height: 400,
        };
      else
        this.lastSize = {
          width: 300,
          height: 300,
        };
      if (!this.isMaximized) this.maximizeWindow(false);
    } else {
      if (this.isMaximized) this.unmaximizeWindow();
    }
  }

  get currentZIndex() {
    return WindowComponent.currentZIndex;
  }

  minimizeWindow() {
    this.windowManagerService.minimizeWindow(this.id || '');
  }

  maximizeWindow(saveLast = true) {
    if (saveLast && !this.isSnapped) this.saveLast();
    interact(this.windowEl).resizable({ enabled: false });
    this.windowEl.style.transform = `translate(0px, 0px)`;
    if (window.innerWidth < 992) {
      this.windowEl.style.width = `calc(100vw - 55.2px)`;
      this.windowEl.style.height = `100dvh`;
    } else {
      this.windowEl.style.width = '100vw';
      this.windowEl.style.height = 'calc(100dvh - 3.5rem)';
    }
    this.isMaximized = true;
    this.cdr.detectChanges();

    this.persistLayout('maximized');
  }

  unmaximizeWindow() {
    this.applyLast();
    interact(this.windowEl).draggable(true);
    interact(this.windowEl).resizable({ enabled: true });
    this.isMaximized = false;
    this.cdr.detectChanges();

    this.persistLayout('normal');
  }

  snapWindow() {
    this.isSnapped = true;

    let mode: WindowLayoutMode = 'normal';

    switch (true) {
      case this.isLeftSnap:
        mode = 'snap-left';
        if (window.innerWidth < 992) {
          this.windowEl.style.height = '100vh';
        } else {
          this.windowEl.style.height = 'calc(100vh - 3.5rem)';
        }
        this.windowEl.style.transform = `translate(0px, 0px)`;
        this.windowEl.style.width = '50%';
        this.windowEl.setAttribute('data-x', '0.1');
        this.windowEl.setAttribute('data-y', '0.1');
        break;
      case this.isRightSnap:
        mode = 'snap-right';
        if (window.innerWidth < 992) {
          this.windowEl.style.transform = `translate(calc(50vw - 29px), 0px)`;
          this.windowEl.style.height = '100vh';
        } else {
          this.windowEl.style.transform = `translate(50vw, 0px)`;
          this.windowEl.style.height = 'calc(100vh - 3.5rem)';
        }
        this.windowEl.style.width = '50%';
        this.windowEl.setAttribute(
          'data-x',
          (this.screenWidth / 2).toString() + '.1',
        );
        this.windowEl.setAttribute('data-y', '0.1');
        break;
      default:
        console.error('Failed to snap window.');
        break;
    }

    this.persistLayout(mode);
  }

  closeWindow() {
    this.windowManagerService.closeWindow(this.id || '');
  }

  scrollToBottom(): void {
    const scrollContainer = this.container.nativeElement;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  saveLast() {
    if (window.innerWidth < 992)
      this.lastPosition = {
        x: parseFloat(this.windowEl.getAttribute('data-x')!) || 25,
        y: parseFloat(this.windowEl.getAttribute('data-y')!) || 25,
      };
    else
      this.lastPosition = {
        x: parseFloat(this.windowEl.getAttribute('data-x')!) || 200,
        y: parseFloat(this.windowEl.getAttribute('data-y')!) || 100,
      };
    this.lastSize = {
      width: this.windowEl.offsetWidth,
      height: this.windowEl.offsetHeight,
    };

    this.persistLayout('normal');
  }

  applyLast() {
    if (this.lastPosition.y < 0) this.lastPosition.y = 0;
    if (window.innerWidth < 992)
      this.windowEl.style.transform = `translate(calc(${this.lastPosition.x}px - 29px), ${this.lastPosition.y}px)`;
    else
      this.windowEl.style.transform = `translate(${this.lastPosition.x}px, ${this.lastPosition.y}px)`;
    this.windowEl.style.width = `${this.lastSize.width}px`;
    this.windowEl.style.height = `${this.lastSize.height}px`;
    this.windowEl.setAttribute('data-x', this.lastPosition.x.toString());
    this.windowEl.setAttribute('data-y', this.lastPosition.y.toString());
  }

  private getBoundsFromLast(): WindowBounds {
    return {
      x: this.lastPosition.x,
      y: this.lastPosition.y,
      width: this.lastSize.width,
      height: this.lastSize.height,
    };
  }

  private persistLayout(mode: WindowLayoutMode): void {
    const id = this.id;
    if (!id) return;

    const normalBounds = this.getBoundsFromLast();
    const layout: WindowLayout = {
      mode,
      bounds: normalBounds,
      normalBounds,
    };

    this.windowManagerService.updateWindow(id, { layout });
  }

  private restoreLayout(layout: WindowLayout): void {
    // Restore the last "normal" bounds first so unmaximize/restore works.
    this.lastPosition = { x: layout.normalBounds.x, y: layout.normalBounds.y };
    this.lastSize = {
      width: layout.normalBounds.width,
      height: layout.normalBounds.height,
    };

    // Clear flags; restore will set them.
    this.isSnapped = false;
    this.isMaximized = false;

    switch (layout.mode) {
      case 'maximized':
        this.maximizeWindow(false);
        return;
      case 'snap-left':
        this.isLeftSnap = true;
        this.isRightSnap = false;
        this.snapWindow();
        this.isLeftSnap = false;
        return;
      case 'snap-right':
        this.isRightSnap = true;
        this.isLeftSnap = false;
        this.snapWindow();
        this.isRightSnap = false;
        return;
      case 'normal':
      default:
        // Use applyLast() so mobile offset math stays consistent.
        this.applyLast();
        return;
    }
  }
}
