const ACCELERATOR = /^(?=.*(?:CommandOrControl|Command|Control|Alt|Option|Shift|Super))(?:(?:CommandOrControl|Command|Control|Alt|Option|Shift|Super)\+){1,4}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/i;

export function validAccelerator(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && ACCELERATOR.test(value);
}
