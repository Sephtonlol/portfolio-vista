import { Component, Input, AfterViewInit, ElementRef } from '@angular/core';
import interact from 'interactjs';
import { DesktopApplication } from '../../interfaces/desktopApplication.interface';

@Component({
  selector: 'app-desktop-application',
  imports: [],
  templateUrl: './desktop-application.component.html',
  styleUrl: './desktop-application.component.css',
})
export class DesktopApplicationComponent implements AfterViewInit {
  @Input() application!: DesktopApplication;
  shouldAnimate = true;

  constructor(private elRef: ElementRef) {}

  ngAfterViewInit() {
    const application = this.elRef.nativeElement.querySelector('.application');

    interact(application)
      .draggable({
        listeners: {
          move: (event) => {
            this.shouldAnimate = false;
            const application = event.target;
            let x =
              (parseFloat(application.getAttribute('data-x')) || 4) + event.dx;
            let y =
              (parseFloat(application.getAttribute('data-y')) || 4) + event.dy;

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

              x = Math.round(x / 100) * 100;
              y = Math.round(y / 100) * 100;
              const screenWidth = window.innerWidth;
              const screenHeight = window.innerHeight;

              if (x < 0) x = 0;
              if (y < 0) y = 0;

              if (x > screenWidth - application.offsetWidth)
                x = screenWidth - application.offsetWidth;
              if (y > screenHeight - application.offsetHeight)
                y = screenHeight - application.offsetHeight - 56;

              application.style.transform = `translate(${x}px, ${y}px)`;
              application.setAttribute('data-x', x);
              application.setAttribute('data-y', y);
            }, 0);
          },
        },
      })
      .styleCursor(false);
  }
}
