import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';

type BootLine = {
  id: number;
  text: string;
};

type BootStep = {
  text: string;
  baseDelayMs: number;
  minDelayMs?: number;
  statusText?: string;
};

@Component({
  selector: 'app-boot-screen',
  standalone: true,
  templateUrl: './boot-screen.component.html',
  styleUrl: './boot-screen.component.css',
})
export class BootScreenComponent implements OnInit, OnDestroy {
  @Input() exiting = false;

  @Output() finished = new EventEmitter<void>();

  @Input() totalDurationMs = 2000;

  // Black screen before any text/spinner is shown.
  @Input() preDelayMs = 0;

  @Input() mode: 'boot' | 'resume' = 'boot';

  // Keep the final messages visible before reaching 100%.
  @Input() tailHoldMs = 2500;

  @Input() errorMode = false;

  renderedLines: BootLine[] = [];
  spinnerChar = '-';
  progressBarText = '[----------------------------]   0%';
  statusText = 'Starting system...';

  contentVisible = false;

  @ViewChild('bootLog') private bootLogRef?: ElementRef<HTMLElement>;

  private readonly spinnerFrames = ['-', '\\', '|', '/'];
  private readonly maxLines = 22;
  private nextLineId = 1;

  private readonly barWidth = 28;
  private currentProgressPct = 0;
  private progressPlan: number[] = [];

  private systemInfo = {
    cpuText: 'CPU: (generic)',
    memoryText: 'Memory: unknown',
    platformText: 'Platform: unknown',
  };

  private spinnerIntervalId?: number;
  private scheduledTimeoutIds: number[] = [];
  private preDelayTimeoutId?: number;
  private hasFinished = false;

  ngOnInit(): void {
    this.statusText =
      this.mode === 'resume'
        ? 'Resuming from sleep...'
        : this.errorMode
          ? 'Recovering from startup errors...'
          : 'Starting system...';

    this.systemInfo = this.readSystemInfo();

    const pre = Math.max(0, Math.min(10000, this.preDelayMs));
    this.contentVisible = false;

    const begin = () => {
      this.contentVisible = true;
      this.startSpinner();
      this.runBootSequence(pre);
    };

    if (pre > 0) {
      this.preDelayTimeoutId = window.setTimeout(() => begin(), pre);
    } else {
      begin();
    }
  }

  private readSystemInfo(): {
    cpuText: string;
    memoryText: string;
    platformText: string;
  } {
    const nav = window.navigator as Navigator & {
      deviceMemory?: number;
      userAgentData?: { platform?: string };
    };

    const cores =
      typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0
        ? nav.hardwareConcurrency
        : undefined;

    const ramGb =
      typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0
        ? nav.deviceMemory
        : undefined;

    const platform =
      nav.userAgentData?.platform ||
      (typeof nav.platform === 'string' && nav.platform.trim().length > 0
        ? nav.platform
        : undefined);

    return {
      cpuText:
        cores != null
          ? `Detected CPU: ${cores}-core (generic)`
          : 'Detected CPU: (generic)',
      memoryText:
        ramGb != null
          ? `System RAM: ~${ramGb}GB available`
          : 'System RAM: unknown',
      platformText:
        platform != null ? `Platform: ${platform}` : 'Platform: unknown',
    };
  }

  ngOnDestroy(): void {
    if (this.preDelayTimeoutId != null) {
      window.clearTimeout(this.preDelayTimeoutId);
    }
    if (this.spinnerIntervalId != null) {
      window.clearInterval(this.spinnerIntervalId);
    }
    for (const timeoutId of this.scheduledTimeoutIds) {
      window.clearTimeout(timeoutId);
    }
    this.scheduledTimeoutIds = [];
  }

  private startSpinner(): void {
    let index = 0;
    this.spinnerIntervalId = window.setInterval(() => {
      this.spinnerChar = this.spinnerFrames[index];
      index = (index + 1) % this.spinnerFrames.length;
    }, 90);
  }

  private runBootSequence(preDelayMs: number): void {
    const steps = this.buildBootSteps();

    const errorLinesShown: string[] = [];

    this.currentProgressPct = 0;
    this.progressBarText = this.renderProgressBar(this.currentProgressPct);

    // `totalDurationMs` is intended to represent the *entire* boot screen lifetime
    // (including the initial black pre-delay). Since the sequence starts *after*
    // `preDelayMs` has elapsed, we compute the available time for the sequence
    // by subtracting `preDelayMs` once (not twice).
    const total = Math.max(700, this.totalDurationMs);
    const pre = Math.max(0, preDelayMs);
    const sequenceTotal = Math.max(700, total - pre);

    // Keep the ending on screen for a bit (but don't force it to be multiple seconds).
    const tail = Math.max(300, Math.min(8000, this.tailHoldMs));

    const effectiveTotal = Math.max(700, sequenceTotal - tail);
    const sumBase = steps.reduce((acc, s) => acc + s.baseDelayMs, 0);
    const scale = sumBase > 0 ? effectiveTotal / sumBase : 1;

    this.progressPlan = this.buildProgressPlan(steps.length);

    let index = 0;
    const runNext = () => {
      if (index >= steps.length) {
        // Keep logs readable: show final lines, hold, then hit 100%.
        if (this.currentProgressPct < 99) {
          this.setProgress(99);
        }
        this.statusText =
          this.mode === 'resume'
            ? 'Restoring session state...'
            : 'Finalizing boot sequence...';

        if (this.mode === 'resume') {
          this.pushLine('[ OK ] Restored device state');
          this.pushLine('Applying power management policies...');
          this.pushLine('[ OK ] Resume complete (code=0x5L33PY)');
          this.pushLine('Returning to lock screen...');
        } else {
          this.pushLine('Starting GNOME Display Manager...');
          this.pushLine('[ OK ] Started GNOME Display Manager');
          this.pushLine('Portfolio login:');
        }

        const extraTail = this.extraTailHoldForErrors(errorLinesShown);

        const timeoutId = window.setTimeout(() => {
          this.setProgress(100);
          this.statusText =
            this.mode === 'resume' ? 'Ready.' : 'Launching desktop...';

          if (!this.hasFinished) {
            this.hasFinished = true;
            if (this.spinnerIntervalId != null) {
              window.clearInterval(this.spinnerIntervalId);
              this.spinnerIntervalId = undefined;
            }
            this.finished.emit();
          }
        }, tail + extraTail);
        this.scheduledTimeoutIds.push(timeoutId);
        return;
      }

      const step = steps[index];
      if (step.statusText != null) {
        this.statusText = step.statusText;
      }

      this.pushLine(step.text);
      if (this.isErrorLine(step.text)) {
        errorLinesShown.push(step.text);
      }
      this.setProgress(this.progressPlan[index] ?? 100);

      const base = Math.max(
        step.minDelayMs ?? 70,
        Math.round(step.baseDelayMs * scale),
      );
      const jitter = this.jitterMs(base + this.extraDelayForLine(step.text));
      const timeoutId = window.setTimeout(() => runNext(), jitter);
      this.scheduledTimeoutIds.push(timeoutId);
      index += 1;
    };

    runNext();
  }

  private pushLine(text: string): void {
    this.renderedLines.push({ id: this.nextLineId++, text });
    if (this.renderedLines.length > this.maxLines) {
      this.renderedLines.splice(0, this.renderedLines.length - this.maxLines);
    }
    this.scrollBootLogToBottom();
  }

  private scrollBootLogToBottom(): void {
    const el = this.bootLogRef?.nativeElement;
    if (!el) return;

    // Ensure we scroll after Angular has rendered the new line.
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  private setProgress(pct: number): void {
    const next = Math.max(0, Math.min(100, pct));
    if (next === this.currentProgressPct) {
      return;
    }
    this.currentProgressPct = next;
    this.progressBarText = this.renderProgressBar(this.currentProgressPct);
  }

  private renderProgressBar(pct: number): string {
    const filled = Math.max(
      0,
      Math.min(this.barWidth, Math.round((pct / 100) * this.barWidth)),
    );
    const bar = `${'='.repeat(filled)}${'-'.repeat(this.barWidth - filled)}`;
    const pctText = pct.toString().padStart(3, ' ');
    return `[${bar}] ${pctText}%`;
  }

  private buildProgressPlan(stepCount: number): number[] {
    // Random “bursty” progress that still reaches 100% at the end.
    if (stepCount <= 0) {
      return [];
    }

    const pctAfter: number[] = [];
    let current = 0;

    for (let i = 0; i < stepCount; i += 1) {
      const stepsLeft = stepCount - i;

      if (stepsLeft === 1) {
        // Reserve 100% for the tail-hold completion.
        pctAfter.push(99);
        break;
      }

      const phase = i / stepCount; // 0..1
      const maxInc = phase < 0.35 ? 8 : phase < 0.75 ? 16 : 26;
      const minInc = phase < 0.2 ? 0 : 1;

      const remaining = 100 - current;

      // Keep at least 1% for each remaining step (except we already handle last step).
      const mustLeave = Math.max(0, stepsLeft - 1);
      const incCeiling = Math.max(0, Math.min(maxInc, remaining - mustLeave));
      const incFloor = Math.max(0, Math.min(minInc, incCeiling));

      const inc = incCeiling <= 0 ? 0 : this.randomInt(incFloor, incCeiling);

      current = Math.min(99, current + inc);

      // Avoid sitting at 0% for too long.
      if (i >= 2 && current === 0) {
        current = 1;
      }

      // Keep it chunky by rounding to whole percent (already whole) and clamping.
      pctAfter.push(Math.max(0, Math.min(99, current)));
    }

    return pctAfter;
  }

  private randomInt(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  }

  private jitterMs(baseDelayMs: number): number {
    const wiggle = Math.min(110, Math.max(14, Math.round(baseDelayMs * 0.25)));
    const delta = Math.floor((Math.random() * 2 - 1) * wiggle);
    return Math.max(30, baseDelayMs + delta);
  }

  private getLineSeverity(text: string): 'ok' | 'warn' | 'fail' {
    const t = text ?? '';

    // Treat dependency failures as failures (reads like a hard error).
    if (/(\[\s*FAILED\s*\])|\bFAILED\b|\bERROR\b|\[\s*DEPEND\s*\]/i.test(t)) {
      return 'fail';
    }

    if (/(\[\s*(?:WARN|WARNING)\s*\])|\bWARNING\b|\bWARN\b/i.test(t)) {
      return 'warn';
    }

    return 'ok';
  }

  isErrorLine(text: string): boolean {
    // Any boot “problem” should pop in red.
    // Includes bracketed levels and common kernel wording.
    return this.getLineSeverity(text) !== 'ok';
  }

  private extraDelayForLine(text: string): number {
    // Make errors feel like they “hang” on screen.
    const severity = this.getLineSeverity(text);
    if (severity === 'fail') return 1200;
    if (severity === 'warn') return 600;
    return 0;
  }

  private extraTailHoldForErrors(errorTexts: string[]): number {
    let extra = 0;

    for (const t of errorTexts) {
      const sev = this.getLineSeverity(t);
      extra += sev === 'fail' ? 1600 : 800;
    }

    // Prevent absurdly long boots if randomness goes wild.
    return Math.max(0, Math.min(12000, extra));
  }

  private sample<T>(items: readonly T[]): T {
    return items[this.randomInt(0, Math.max(0, items.length - 1))]!;
  }

  private insertNoise(
    steps: BootStep[],
    opts: {
      // Number of injected lines.
      count: number;
      // Chance a noise line is a hard failure (vs warning).
      failureChance: number;
      // Ensure at least one hard failure.
      forceFailure?: boolean;
    },
  ): BootStep[] {
    if (steps.length === 0 || opts.count <= 0) return steps;

    const warningPool: BootStep[] = [
      {
        text: '[ WARN ] CPU fan speed exceeded vibes threshold (code=0xV1B3S)',
        baseDelayMs: 160,
      },
      {
        text: 'kernel: WARNING: /dev/coffee0: beans not found; using instant (code=0x1N5T4NT)',
        baseDelayMs: 190,
      },
      {
        text: '[ WARN ] Time drift detected: NTP argues with the sun (code=0x5UND14L)',
        baseDelayMs: 180,
      },
      {
        text: '[ WARN ] Bluetooth: discovered 12 devices named "Toaster" (code=0xBREAD)',
        baseDelayMs: 180,
      },
      {
        text: 'systemd[1]: WARNING: unit "motivation.service" is masked (code=0xN0P3)',
        baseDelayMs: 210,
      },
      {
        text: '[ WARN ] GPU driver requested a hug; denied (code=0xS4D)',
        baseDelayMs: 170,
      },
      {
        text: '[ WARN ] Low disk space in /var/log/complaints (code=0xWH1N3)',
        baseDelayMs: 170,
      },
      {
        text: 'kernel: WARNING: entropy pool is feeling shy today (code=0x5HYY)',
        baseDelayMs: 190,
      },
      {
        text: '[ WARN ] DNS temporarily replaced with "ask a friend" (code=0xBUDDY)',
        baseDelayMs: 190,
      },
      {
        text: '[ WARN ] Detected rogue semicolon; attempting negotiation (code=0x3B1C0L0N)',
        baseDelayMs: 190,
      },
    ];

    const failurePool: BootStep[] = [
      {
        text: '[FAILED] Failed to mount /mnt/usb-stick (code=E_B0RK_0007)',
        baseDelayMs: 420,
        minDelayMs: 220,
        statusText: 'Handling startup errors...',
      },
      {
        text: 'systemd[1]: Job dev-sdb1.device/start timed out. (code=E_TIM3_0UT)',
        baseDelayMs: 780,
        minDelayMs: 280,
      },
      {
        text: '[DEPEND] Dependency failed for Bluetooth service',
        baseDelayMs: 280,
      },
      {
        text: '[FAILED] NetworkManager: could not negotiate with the router (it said "no") (code=E_N0P3)',
        baseDelayMs: 520,
        minDelayMs: 240,
      },
      {
        text: '[FAILED] Kernel panic averted: rebooted the panic (code=E_P4N1C_N0W)',
        baseDelayMs: 460,
        minDelayMs: 220,
      },
      {
        text: '[FAILED] Printer daemon started printing feelings (code=E_M00D)',
        baseDelayMs: 360,
        minDelayMs: 200,
      },
      {
        text: '[FAILED] /dev/null is full (please delete something) (code=E_NU11)',
        baseDelayMs: 340,
        minDelayMs: 190,
      },
      {
        text: '[FAILED] Service "make-it-work.service" exited with status 42 (code=E_L1F3)',
        baseDelayMs: 400,
        minDelayMs: 210,
      },
    ];

    const result = [...steps];

    // Avoid injecting at index 0 (looks odd before kernel load line).
    const minIndex = Math.min(2, Math.max(1, result.length));
    const maxIndex = Math.max(minIndex, result.length - 1);

    let injectedFailures = 0;
    const total = Math.min(opts.count, 10);

    for (let i = 0; i < total; i += 1) {
      const shouldFail =
        Math.random() < opts.failureChance ||
        (opts.forceFailure && i === total - 1 && injectedFailures === 0);

      const step = shouldFail
        ? (injectedFailures++, this.sample(failurePool))
        : this.sample(warningPool);

      const at = this.randomInt(minIndex, maxIndex);
      result.splice(at, 0, step);
    }

    return result;
  }

  private buildBootSteps(): BootStep[] {
    if (this.mode === 'resume') {
      const steps: BootStep[] = [
        {
          text: 'PM: resume from S3 (sleep) initiated',
          baseDelayMs: 160,
          minDelayMs: 120,
          statusText: 'Resuming from sleep...',
        },
        {
          text: 'Restoring PCI devices...',
          baseDelayMs: 240,
          minDelayMs: 160,
        },
        { text: '[ OK ] Reinitialized input devices', baseDelayMs: 180 },
        {
          text: 'Reconnecting network interfaces...',
          baseDelayMs: 360,
          minDelayMs: 220,
        },
        {
          text: '[ WARN ] Wake reason: mysterious keyboard gremlin (code=0xBEEF)',
          baseDelayMs: 220,
        },
        { text: '[ OK ] Reached target User Login', baseDelayMs: 190 },
      ];

      // Increase frequency/variety of errors a bit, even in normal resume.
      const count = this.errorMode
        ? this.randomInt(3, 6)
        : this.randomInt(1, 3);
      const failureChance = this.errorMode ? 0.55 : 0.2;
      return this.insertNoise(steps, {
        count,
        failureChance,
        forceFailure: this.errorMode,
      });
    }

    let steps: BootStep[] = [
      {
        text: 'Loading Linux kernel...',
        baseDelayMs: 120,
        minDelayMs: 120,
        statusText: 'Booting kernel...',
      },
      { text: 'Initializing cgroup subsys cpuset', baseDelayMs: 120 },
      { text: this.systemInfo.cpuText, baseDelayMs: 160 },
      { text: this.systemInfo.memoryText, baseDelayMs: 150 },
      { text: this.systemInfo.platformText, baseDelayMs: 120 },
      { text: 'ACPI: Power Button [PWRF]', baseDelayMs: 120 },
      {
        text: 'kernel: [    0.42] WARNING: /dev/coffee0: brew timeout (code=0xC0FFEE)',
        baseDelayMs: 190,
        statusText: 'Starting system...',
      },
      {
        text: 'PCI: Probing PCI hardware',
        baseDelayMs: 220,
        statusText: 'Probing hardware...',
      },
      { text: 'usb 1-1: new high-speed USB device detected', baseDelayMs: 210 },
      { text: ':: running early hook [udev]', baseDelayMs: 160 },
      { text: ':: Triggering uevents...', baseDelayMs: 240, minDelayMs: 180 },
      {
        text: 'EXT4-fs (sda1): mounted filesystem with ordered data mode',
        baseDelayMs: 300,
        minDelayMs: 200,
        statusText: 'Mounting file systems...',
      },
      {
        text: 'Checking root file system...',
        baseDelayMs: 520,
        minDelayMs: 260,
      },
      {
        text: '[ OK ] Started File System Check on /dev/sda1',
        baseDelayMs: 240,
      },
      { text: '[ OK ] Reached target Local File Systems', baseDelayMs: 210 },
      {
        text: '[ OK ] Started Load Kernel Modules',
        baseDelayMs: 190,
        statusText: 'Starting services...',
      },
      { text: '[ OK ] Started udev Kernel Device Manager', baseDelayMs: 180 },
      {
        text: '[ OK ] Started Network Manager',
        baseDelayMs: 220,
        statusText: 'Starting networking...',
      },
      {
        text: 'Configuring network interfaces...',
        baseDelayMs: 520,
        minDelayMs: 250,
      },
      { text: 'DHCPDISCOVER on eth0', baseDelayMs: 180 },
      { text: 'DHCPACK received from 192.168.1.1', baseDelayMs: 280 },
      { text: 'Connected to WiFi network', baseDelayMs: 190 },
      { text: '[ OK ] Started User Login Management', baseDelayMs: 260 },
      { text: '[ OK ] Reached target Graphical Interface', baseDelayMs: 230 },
    ];

    // Inject a higher chance of funny warnings/errors.
    // - In normal mode: usually 1-2 warnings, occasional failure.
    // - In errorMode: always several lines, with at least one hard failure.
    if (this.errorMode) {
      steps = this.insertNoise(steps, {
        count: this.randomInt(4, 8),
        failureChance: 0.6,
        forceFailure: true,
      });
    } else {
      const shouldAdd = Math.random() < 0.75;
      steps = shouldAdd
        ? this.insertNoise(steps, {
            count: this.randomInt(1, 3),
            failureChance: 0.15,
          })
        : steps;
    }

    return steps;
  }
}
