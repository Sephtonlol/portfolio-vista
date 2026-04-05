import { Component, Input, OnDestroy, OnInit } from '@angular/core';

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

    this.currentProgressPct = 0;
    this.progressBarText = this.renderProgressBar(this.currentProgressPct);

    const total = Math.max(700, this.totalDurationMs);
    const tail = Math.max(0, Math.min(5000, this.tailHoldMs));
    const effectiveTotal = Math.max(
      700,
      total - tail - Math.max(0, preDelayMs),
    );
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
          this.pushLine('Portfolio Vista login:');
        }

        const timeoutId = window.setTimeout(() => {
          this.setProgress(100);
          this.statusText =
            this.mode === 'resume' ? 'Ready.' : 'Launching desktop...';
        }, tail);
        this.scheduledTimeoutIds.push(timeoutId);
        return;
      }

      const step = steps[index];
      if (step.statusText != null) {
        this.statusText = step.statusText;
      }

      this.pushLine(step.text);
      this.setProgress(this.progressPlan[index] ?? 100);

      const base = Math.max(
        step.minDelayMs ?? 70,
        Math.round(step.baseDelayMs * scale),
      );
      const jitter = this.jitterMs(base);
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

  private buildBootSteps(): BootStep[] {
    if (this.mode === 'resume') {
      return [
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
    }

    const steps: BootStep[] = [
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

    if (!this.errorMode) {
      return steps;
    }

    const errorInsertAt = 10;
    steps.splice(
      errorInsertAt,
      0,
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
      { text: 'Recovering journal... done', baseDelayMs: 520, minDelayMs: 240 },
    );

    return steps;
  }
}
