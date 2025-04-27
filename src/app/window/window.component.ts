import { AfterViewInit, Component, ElementRef, Input } from '@angular/core';
import interact from 'interactjs';
import { Window } from '../interfaces/window.interface';
import { WindowManagerService } from '../services/window-manager.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-window',
  imports: [],
  templateUrl: './window.component.html',
  styleUrl: './window.component.css',
})
export class WindowComponent implements AfterViewInit {
  @Input() windowData!: Window;

  isMaximized = false;
  lastPosition = { x: 0, y: 0 };
  lastSize = { width: 400, height: 300 };

  static currentZIndex = 1;

  private focusSub!: Subscription;
  private minimizeSub!: Subscription;

  constructor(
    private el: ElementRef,
    private windowManagerService: WindowManagerService
  ) {}

  ngAfterViewInit() {
    const windowEl = this.el.nativeElement.querySelector('.window');

    this.focusSub = this.windowManagerService.focus$.subscribe((focusedApp) => {
      if (focusedApp === this.windowData.application) {
        WindowComponent.currentZIndex++;
        windowEl.style.zIndex = WindowComponent.currentZIndex.toString();
        this.windowData.minimized = false;
      }
    });

    this.minimizeSub = this.windowManagerService.minimize$.subscribe(
      (minimizeApp) => {
        if (minimizeApp === this.windowData.application) {
          this.windowData.minimized = true;
        }
      }
    );
    windowEl.addEventListener('mousedown', () => {
      this.windowManagerService.focusWindow(this.windowData.application);
    });

    interact(windowEl)
      .draggable({
        allowFrom: '.window-header',
        listeners: {
          move: (event) => {
            const target = event.target;
            const x =
              (parseFloat(target.getAttribute('data-x')!) || 0) + event.dx;
            const y =
              (parseFloat(target.getAttribute('data-y')!) || 0) + event.dy;

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
  }

  minimizeWindow() {
    this.windowManagerService.minimizeWindow(this.windowData.application);
  }

  maximizeWindow() {
    if (!this.isMaximized) {
      const windowEl = this.el.nativeElement.querySelector('.window');
      // Save last position and size
      this.lastPosition = {
        x: parseFloat(windowEl.getAttribute('data-x')!) || 0,
        y: parseFloat(windowEl.getAttribute('data-y')!) || 0,
      };
      this.lastSize = {
        width: windowEl.offsetWidth,
        height: windowEl.offsetHeight,
      };
      interact(windowEl).draggable(false);
      interact(windowEl).resizable({ enabled: false });

      windowEl.style.transform = `translate(0px, 0px)`;
      windowEl.style.width = '100vw';
      windowEl.style.height = 'calc(100vh - 3.5rem)';

      this.isMaximized = true;
    }
  }

  unmaximizeWindow() {
    if (this.isMaximized) {
      const windowEl = this.el.nativeElement.querySelector('.window');

      windowEl.style.transform = `translate(${this.lastPosition.x}px, ${this.lastPosition.y}px)`;
      windowEl.style.width = `${this.lastSize.width}px`;
      windowEl.style.height = `${this.lastSize.height}px`;

      interact(windowEl).draggable(true);
      interact(windowEl).resizable({ enabled: true });

      this.isMaximized = false;
    }
  }

  closeWindow() {
    this.focusSub.unsubscribe();
    this.windowManagerService.closeWindow(this.windowData.application);
  }
}
