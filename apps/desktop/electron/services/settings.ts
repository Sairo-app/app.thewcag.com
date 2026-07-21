import { app, globalShortcut } from "electron";
import type {
  AppSettings,
  ChecklistShortcutSettings,
  ShortcutSettings,
} from "../../src/shared/desktop";
import type { JsonStore } from "./store";
import { validAccelerator } from "./validation";

const DEFAULT_SHORTCUTS: ShortcutSettings = {
  inspect: "Alt+CommandOrControl+P",
  capture: "Alt+CommandOrControl+S",
  lens: "Alt+CommandOrControl+L",
};

const DEFAULT_CHECKLIST_SHORTCUTS: ChecklistShortcutSettings = {
  pass: "p",
  fail: "f",
  notApplicable: "n",
  next: "j",
  previous: "k",
  expand: "Enter",
};

export const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: DEFAULT_SHORTCUTS,
  checklistShortcuts: DEFAULT_CHECKLIST_SHORTCUTS,
  launchAtLogin: false,
  appearance: "light",
  reduceMotion: false,
  captureHighDpi: true,
};

function normalize(input: unknown): AppSettings {
  if (!input || typeof input !== "object") return structuredClone(DEFAULT_SETTINGS);
  const value = input as Partial<AppSettings>;
  const shortcuts = value.shortcuts ?? DEFAULT_SHORTCUTS;
  const checklist = value.checklistShortcuts ?? DEFAULT_CHECKLIST_SHORTCUTS;
  const validChecklistKey = (input: unknown, fallback: string) => {
    if (typeof input !== "string") return fallback;
    const next = input.trim();
    return (/^[\p{L}\p{N}]$/u.test(next) || ["Enter", "Space", "ArrowDown", "ArrowUp"].includes(next))
      ? next
      : fallback;
  };
  return {
    shortcuts: {
      inspect: validAccelerator(shortcuts.inspect) ? shortcuts.inspect : DEFAULT_SHORTCUTS.inspect,
      capture: validAccelerator(shortcuts.capture) ? shortcuts.capture : DEFAULT_SHORTCUTS.capture,
      lens: validAccelerator(shortcuts.lens) ? shortcuts.lens : DEFAULT_SHORTCUTS.lens,
    },
    checklistShortcuts: {
      pass: validChecklistKey(checklist.pass, DEFAULT_CHECKLIST_SHORTCUTS.pass),
      fail: validChecklistKey(checklist.fail, DEFAULT_CHECKLIST_SHORTCUTS.fail),
      notApplicable: validChecklistKey(checklist.notApplicable, DEFAULT_CHECKLIST_SHORTCUTS.notApplicable),
      next: validChecklistKey(checklist.next, DEFAULT_CHECKLIST_SHORTCUTS.next),
      previous: validChecklistKey(checklist.previous, DEFAULT_CHECKLIST_SHORTCUTS.previous),
      expand: validChecklistKey(checklist.expand, DEFAULT_CHECKLIST_SHORTCUTS.expand),
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
    const checklistKeys = Object.values(settings.checklistShortcuts).map((value) => value.toLowerCase());
    if (new Set(checklistKeys).size !== checklistKeys.length) {
      throw new Error("Each checklist shortcut must be unique");
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
