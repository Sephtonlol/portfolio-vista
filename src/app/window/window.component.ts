import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChild,
} from '@angular/core';
import interact from 'interactjs';
import { Window } from '../interfaces/window.interface';
import { WindowManagerService } from '../services/window-manager.service';
import { Subscription } from 'rxjs';
import { TerminalComponent } from '../components/windows/terminal/terminal.component';
import { ExplorerComponent } from '../components/windows/explorer/explorer.component';
import { CalculatorComponent } from '../components/windows/calculator/calculator.component';
import { NotepadComponent } from '../components/windows/notepad/notepad.component';
import { PhotosComponent } from '../components/windows/photos/photos.component';
import { PlayerComponent } from '../components/windows/player/player.component';

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
  ],
  templateUrl: './window.component.html',
  styleUrl: './window.component.css',
})
export class WindowComponent implements AfterViewInit {
  @ViewChild('windowContent') container!: ElementRef;
  @Input() windowData!: Window;
  @Input() id!: string | undefined;

  maximizing = false;
  isMaximized = false;
  minimumSize = { width: 300, height: 175 };
  initialSize = { width: 450, height: 300 };
  lastPosition = { x: 100, y: 50 };
  lastSize = this.initialSize;
  shouldAnimate = true;

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

  constructor(
    private el: ElementRef,
    private windowManagerService: WindowManagerService
  ) {}

  ngAfterViewInit() {
    this.screenWidth = window.innerWidth;
    this.screeHeight = window.innerHeight;
    this.windowEl = this.el.nativeElement.querySelector(`.window-${this.id}`);
    const size =
      this.windowData.application === 'Calculator'
        ? (this.minimumSize = this.lastSize = { width: 375, height: 400 })
        : this.initialSize;

    setTimeout(() => {
      this.windowEl.style.width = `${size.width}px`;
      this.windowEl.style.height = `${size.height}px`;
    }, 0);

    this.focusSub = this.windowManagerService.focus$.subscribe((focused) => {
      if (focused?.id === this.id) {
        WindowComponent.currentZIndex++;
        this.windowEl.style.zIndex = WindowComponent.currentZIndex.toString();

        if (focused && focused.unminimize) {
          if (this.isMaximized) {
            this.windowEl.style.transform = `translate(0px, 0px) scale(1, 1)`;
            this.windowEl.style.width = '100vw';
            this.windowEl.style.height = 'calc(100vh - 3.5rem)';
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
      }
    );

    this.windowEl.addEventListener('mousedown', (event: MouseEvent) => {
      if (this.windowData.id)
        this.windowManagerService.focusWindow(this.windowData.id);
      const header = this.windowEl.querySelector('.window-header');
      const controls = this.windowEl.querySelector('.window-controls');
      const isHeader = header?.contains(event.target as Node) ?? false;
      const isControlButton = controls?.contains(event.target as Node) ?? false;

      this.windowManagerService.focusWindow(
        this.id || '',
        false,
        isHeader && !isControlButton
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
              const x = event.client.x - this.lastSize.width / 2;
              const y = event.client.y - 15;

              target.style.transform = `translate(${x}px, ${y}px)`;
              target.setAttribute('data-x', x.toString());
              target.setAttribute('data-y', y.toString());
              this.windowEl.style.width = `${this.lastSize.width}px`;
              this.windowEl.style.height = `${this.lastSize.height}px`;
            } else {
              const x =
                (parseFloat(target.getAttribute('data-x')!) || 100) + event.dx;
              const y =
                (parseFloat(target.getAttribute('data-y')!) || 50) + event.dy;

              target.style.transform = `translate(${x}px, ${y}px)`;
              target.setAttribute('data-x', x.toString());
              target.setAttribute('data-y', y.toString());
            }
            if (!dragStarted) dragStarted = true;

            this.shouldAnimate = false;
            this.isLeftSnap = event.client.x < this.snapMargin;
            this.isRightSnap =
              event.client.x > this.screenWidth - this.snapMargin;
            this.maximizing =
              !this.isMaximized &&
              event.client.y < 25 &&
              !this.isLeftSnap &&
              !this.isRightSnap;
          },
          end: (event) => {
            this.saveLast();
            dragStarted = false;
            setTimeout(() => {
              this.shouldAnimate = true;
              if (!this.isMaximized && event.client.y < 25) {
                this.maximizeWindow(false);
                this.maximizing = false;
              }
              if (this.isLeftSnap || this.isRightSnap) {
                this.snapWindow();
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

            target.style.width = `${event.rect.width}px`;
            target.style.height = `${event.rect.height}px`;

            x += event.deltaRect.left;
            y += event.deltaRect.top;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x.toString());
            target.setAttribute('data-y', y.toString());
          },
          end: () => {
            this.saveLast();
            setTimeout(() => {
              this.shouldAnimate = true;
            }, 0);
          },
        },
      });

    this.windowManagerService.focusWindow(this.id || '', true);
  }

  get currentZIndex() {
    return WindowComponent.currentZIndex;
  }

  minimizeWindow() {
    this.windowManagerService.minimizeWindow(this.id || '');
  }

  maximizeWindow(saveLast = true) {
    if (saveLast) this.saveLast();
    interact(this.windowEl).resizable({ enabled: false });
    this.windowEl.style.transform = `translate(0px, 0px)`;
    this.windowEl.style.width = '100vw';
    this.windowEl.style.height = 'calc(100vh - 3.5rem)';
    this.isMaximized = true;
  }

  unmaximizeWindow() {
    this.applyLast();
    interact(this.windowEl).draggable(true);
    interact(this.windowEl).resizable({ enabled: true });
    this.isMaximized = false;
  }

  snapWindow() {
    this.saveLast();
    this.isSnapped = true;

    switch (true) {
      case this.isLeftSnap:
        this.windowEl.style.transform = `translate(0px, 0px)`;
        this.windowEl.style.width = '50vw';
        this.windowEl.style.height = 'calc(100vh - 3.5rem)';
        this.windowEl.setAttribute('data-x', '0.1');
        this.windowEl.setAttribute('data-y', '0.1');
        break;
      case this.isRightSnap:
        this.windowEl.style.transform = `translate(50vw, 0px)`;
        this.windowEl.style.width = '50vw';
        this.windowEl.style.height = 'calc(100vh - 3.5rem)';
        this.windowEl.setAttribute(
          'data-x',
          (this.screenWidth / 2).toString() + '.1'
        );
        this.windowEl.setAttribute('data-y', '0.1');
        break;
      default:
        console.error('Failed to snap window.');
        break;
    }
  }

  closeWindow() {
    this.windowManagerService.closeWindow(this.id || '');
  }

  scrollToBottom(): void {
    const scrollContainer = this.container.nativeElement;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  saveLast() {
    this.lastPosition = {
      x: parseFloat(this.windowEl.getAttribute('data-x')!) || 100,
      y: parseFloat(this.windowEl.getAttribute('data-y')!) || 50,
    };
    this.lastSize = {
      width: this.windowEl.offsetWidth,
      height: this.windowEl.offsetHeight,
    };
  }

  applyLast() {
    if (this.lastPosition.y < 0) this.lastPosition.y = 0;
    this.windowEl.style.transform = `translate(${this.lastPosition.x}px, ${this.lastPosition.y}px)`;
    this.windowEl.style.width = `${this.lastSize.width}px`;
    this.windowEl.style.height = `${this.lastSize.height}px`;
    this.windowEl.setAttribute('data-x', this.lastPosition.x.toString());
    this.windowEl.setAttribute('data-y', this.lastPosition.y.toString());
  }
}
