import { app, globalShortcut } from "electron";
import type { AppSettings, ShortcutSettings } from "../../src/shared/desktop";
import type { JsonStore } from "./store";
import { validAccelerator } from "./validation";

const DEFAULT_SHORTCUTS: ShortcutSettings = {
  inspect: "Alt+CommandOrControl+P",
  capture: "Alt+CommandOrControl+S",
  lens: "Alt+CommandOrControl+L",
};

export const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: DEFAULT_SHORTCUTS,
  launchAtLogin: false,
  appearance: "light",
  reduceMotion: false,
  captureHighDpi: true,
};

function normalize(input: unknown): AppSettings {
  if (!input || typeof input !== "object") return structuredClone(DEFAULT_SETTINGS);
  const value = input as Partial<AppSettings>;
  const shortcuts = value.shortcuts ?? DEFAULT_SHORTCUTS;
  return {
    shortcuts: {
      inspect: validAccelerator(shortcuts.inspect) ? shortcuts.inspect : DEFAULT_SHORTCUTS.inspect,
      capture: validAccelerator(shortcuts.capture) ? shortcuts.capture : DEFAULT_SHORTCUTS.capture,
      lens: validAccelerator(shortcuts.lens) ? shortcuts.lens : DEFAULT_SHORTCUTS.lens,
    },
    launchAtLogin: Boolean(value.launchAtLogin),
    appearance: "light",
    reduceMotion: Boolean(value.reduceMotion),
    captureHighDpi: value.captureHighDpi !== false,
  };
}

export class SettingsService {
  constructor(
    private readonly store: JsonStore,
    private readonly actions: Record<keyof ShortcutSettings, () => void>,
    private readonly onFailure: (action: keyof ShortcutSettings, accelerator: string) => void,
    private readonly onChanged: (settings: AppSettings) => void = () => undefined,
  ) {}

  async get(): Promise<AppSettings> {
    return normalize(await this.store.get("settings", DEFAULT_SETTINGS));
  }

  async save(input: unknown): Promise<AppSettings> {
    const settings = normalize(input);
    const accelerators = Object.values(settings.shortcuts);
    if (new Set(accelerators.map((value) => value.toLowerCase())).size !== accelerators.length) {
      throw new Error("Each global shortcut must be unique");
    }
    await this.store.set("settings", settings);
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
    this.applyShortcuts(settings.shortcuts);
    this.onChanged(settings);
    return settings;
  }

  async reset(): Promise<AppSettings> {
    return this.save(DEFAULT_SETTINGS);
  }

  async initialize(): Promise<AppSettings> {
    const settings = await this.get();
    // Avoid touching the OS login-item database for the default-off state.
    // This also keeps unsigned development builds quiet on macOS.
    if (settings.launchAtLogin) app.setLoginItemSettings({ openAtLogin: true });
    this.applyShortcuts(settings.shortcuts);
    this.onChanged(settings);
    return settings;
  }

  dispose(): void {
    globalShortcut.unregisterAll();
  }

  private applyShortcuts(shortcuts: ShortcutSettings): void {
    globalShortcut.unregisterAll();
    for (const action of Object.keys(shortcuts) as Array<keyof ShortcutSettings>) {
      const accelerator = shortcuts[action];
      if (!globalShortcut.register(accelerator, this.actions[action])) this.onFailure(action, accelerator);
    }
  }
}
