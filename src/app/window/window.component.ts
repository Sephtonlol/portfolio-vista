import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import interact from 'interactjs';
import { Window } from '../interfaces/window.interface';
import { WindowManagerService } from '../services/window-manager.service';
import { Subscription } from 'rxjs';
import { TerminalComponent } from '../components/windows/terminal/terminal.component';
import { ExplorerComponent } from '../components/windows/explorer/explorer.component';

@Component({
  selector: 'app-window',
  imports: [TerminalComponent, ExplorerComponent],
  templateUrl: './window.component.html',
  styleUrl: './window.component.css',
})
export class WindowComponent implements OnInit {
  @ViewChild('windowContent') container!: ElementRef;
  @Input() windowData!: Window;

  isMaximized = false;
  lastPosition = { x: 100, y: 50 };
  lastSize = { width: 500, height: 350 };
  shouldAnimate = true;

  transitionDelay = 200;

  windowEl!: HTMLElement;

  static currentZIndex = 1;

  private focusSub!: Subscription;
  private minimizeSub!: Subscription;

  constructor(
    private el: ElementRef,
    private windowManagerService: WindowManagerService
  ) {}

  ngOnInit() {
    this.windowEl = this.el.nativeElement.querySelector('.window');
    this.focusSub = this.windowManagerService.focus$.subscribe((focusedApp) => {
      if (focusedApp?.application === this.windowData.application) {
        WindowComponent.currentZIndex++;
        this.windowEl.style.zIndex = WindowComponent.currentZIndex.toString();
        this.shouldAnimate = true;
        if (focusedApp.unminimize) {
          if (this.isMaximized) {
            this.windowEl.style.transform = `translate(0px, 0px)`;
            this.windowEl.style.width = '100vw';
            this.windowEl.style.height = 'calc(100vh - 3.5rem)';
          } else this.applyLast();
          this.windowData.minimized = false;
        }
        this.shouldAnimate = !focusedApp.drag;
        setTimeout(() => {
          this.shouldAnimate = false;
        }, this.transitionDelay);
      }
    });

    this.minimizeSub = this.windowManagerService.minimize$.subscribe(
      (minimizeApp) => {
        if (minimizeApp === this.windowData.application) {
          if (!this.isMaximized) this.saveLast();
          this.shouldAnimate = true;
          this.windowEl.style.transform = `translate(50vw, 100vh)`;
          this.windowEl.style.width = `100px`;
          this.windowEl.style.height = `50px`;
          this.windowData.minimized = true;
          setTimeout(() => {
            this.shouldAnimate = false;
          }, this.transitionDelay);
        }
      }
    );
    this.windowEl.addEventListener('mousedown', (event: MouseEvent) => {
      const header = this.windowEl.querySelector('.window-header');
      const controls = this.windowEl.querySelector('.window-controls');

      const isHeader = header?.contains(event.target as Node) ?? false;
      const isControlButton = controls?.contains(event.target as Node) ?? false;

      this.windowManagerService.focusWindow(
        this.windowData.application,
        false,
        isHeader && !isControlButton
      );
    });

    interact(this.windowEl)
      .draggable({
        allowFrom: '.window-header',
        ignoreFrom: '.window-controls, .window-controls *, .window-header i',
        listeners: {
          move: (event) => {
            const target = event.target;
            const x =
              (parseFloat(target.getAttribute('data-x')!) || 100) + event.dx;
            const y =
              (parseFloat(target.getAttribute('data-y')!) || 50) + event.dy;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x.toString());
            target.setAttribute('data-y', y.toString());
          },
        },
        cursorChecker: () => '',
      })
      .resizable({
        edges: { top: true, left: true, bottom: true, right: true },
        margin: 4,
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 300, height: 75 },
          }),
        ],
        listeners: {
          move: (event) => {
            const target = event.target;
            let x = parseFloat(target.getAttribute('data-x')!) || 0;
            let y = parseFloat(target.getAttribute('data-y')!) || 0;

            target.style.width = `${event.rect.width}px`;
            target.style.height = `${event.rect.height}px`;

            x += event.deltaRect.left;
            y += event.deltaRect.top;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x.toString());
            target.setAttribute('data-y', y.toString());
          },
        },
      });

    this.windowManagerService.focusWindow(this.windowData.application, true);
  }

  minimizeWindow() {
    this.windowManagerService.minimizeWindow(this.windowData.application);
  }

  maximizeWindow() {
    this.shouldAnimate = true;
    this.saveLast();
    interact(this.windowEl).draggable(false);
    interact(this.windowEl).resizable({ enabled: false });

    this.windowEl.style.transform = `translate(0px, 0px)`;
    this.windowEl.style.width = '100vw';
    this.windowEl.style.height = 'calc(100vh - 3.5rem)';

    this.isMaximized = true;
    setTimeout(() => {
      this.shouldAnimate = false;
    }, this.transitionDelay);
  }

  unmaximizeWindow() {
    this.applyLast();

    interact(this.windowEl).draggable(true);
    interact(this.windowEl).resizable({ enabled: true });

    this.isMaximized = false;
  }

  closeWindow() {
    this.windowManagerService.closeWindow(this.windowData.application);
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
    this.windowEl.style.transform = `translate(${this.lastPosition.x}px, ${this.lastPosition.y}px)`;
    this.windowEl.style.width = `${this.lastSize.width}px`;
    this.windowEl.style.height = `${this.lastSize.height}px`;
  }
}
