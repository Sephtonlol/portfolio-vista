import { Component, Input, AfterViewInit, ElementRef } from '@angular/core';
import interact from 'interactjs';
import { FileNode } from '../../interfaces/file.interface';
import { WindowManagerService } from '../../services/window-manager.service';

@Component({
  selector: 'app-desktop-application',
  imports: [],
  templateUrl: './desktop-application.component.html',
  styleUrl: './desktop-application.component.css',
})
export class DesktopApplicationComponent implements AfterViewInit {
  @Input() application!: FileNode;
  @Input() initialPosition: { x: number; y: number } = { x: 0, y: 0 };
  shouldAnimate = true;
  private gridSize = 80;
  constructor(
    private elRef: ElementRef,
    private windowManagerService: WindowManagerService
  ) {}

  ngAfterViewInit() {
    const application = this.elRef.nativeElement.querySelector('.application');

    const { x, y } = this.initialPosition;
    const gridX = x * this.gridSize;
    const gridY = y * this.gridSize;

    application.style.transform = `translate(${gridX}px, ${gridY}px)`;
    application.setAttribute('data-x', gridX.toString());
    application.setAttribute('data-y', gridY.toString());

    interact(application)
      .draggable({
        listeners: {
          move: (event) => {
            this.shouldAnimate = false;
            const application = event.target;

            let x =
              (parseFloat(application.getAttribute('data-x')) || 0) + event.dx;
            let y =
              (parseFloat(application.getAttribute('data-y')) || 0) + event.dy;

            application.style.transform = `translate(${x}px, ${y}px)`;
            application.setAttribute('data-x', x);
            application.setAttribute('data-y', y);
          },
          end: (event) => {
            setTimeout(() => {
              this.shouldAnimate = true;
              const application = event.target;
              let x = parseFloat(application.getAttribute('data-x')) || 0;
              let y = parseFloat(application.getAttribute('data-y')) || 0;

              x = Math.round(x / this.gridSize) * this.gridSize;
              y = Math.round(y / this.gridSize) * this.gridSize;
              const screenWidth = window.innerWidth;
              const screenHeight = window.innerHeight;

              if (x < 0) x = 0;
              if (y < 0) y = 0;

              if (x > screenWidth - application.offsetWidth)
                x = screenWidth - application.offsetWidth;
              if (y > screenHeight - application.offsetHeight)
                y = screenHeight - application.offsetHeight - 56;

              // Check for overlap with sibling components
              const step = this.gridSize;
              let isOverlapping: boolean;
              const directions = [
                { dx: 0, dy: step }, // Down
                { dx: step, dy: 0 }, // Right
                { dx: -step, dy: 0 }, // Left
                { dx: 0, dy: -step }, // Up
              ];
              let directionIndex = 0;
              let iterationCount = 0; // Safeguard to prevent infinite loop
              const maxIterations = 100; // Maximum number of attempts to resolve overlap

              do {
                isOverlapping = false;

                const allApplications = Array.from(
                  document.querySelectorAll('.application')
                ) as HTMLElement[];

                for (const sibling of allApplications) {
                  if (sibling === application) continue; // Exclude the current application

                  const siblingX =
                    parseFloat(sibling.getAttribute('data-x')!) ?? '0';
                  const siblingY =
                    parseFloat(sibling.getAttribute('data-y')!) ?? '0';

                  if (siblingX === x && siblingY === y) {
                    isOverlapping = true;

                    // Try the next direction
                    const direction = directions[directionIndex];
                    x += direction.dx;
                    y += direction.dy;

                    directionIndex = (directionIndex + 1) % directions.length; // Cycle through directions
                    break;
                  }
                }

                iterationCount++;
                if (iterationCount > maxIterations) {
                  console.error(
                    'Failed to resolve overlap after maximum attempts.'
                  );
                  break; // Exit the loop if the maximum number of iterations is reached
                }
              } while (isOverlapping);

              application.style.transform = `translate(${x}px, ${y}px)`;
              application.setAttribute('data-x', x.toString());
              application.setAttribute('data-y', y.toString());
            }, 0);
          },
        },
      })
      .styleCursor(false);
  }

  clickAction() {
    if (this.application.type === 'shortcut') {
      this.windowManagerService.addWindow({
        application: 'Explorer',
        icon: 'bi-folder',
        data: {
          title: this.application.name,
          content: [this.application.name].join('/'),
          type: 'directory',
        },
      });
    } else {
      window.open(this.application.content, '_blank');
    }
  }
}
