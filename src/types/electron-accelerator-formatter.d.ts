declare module 'electron-accelerator-formatter' {
  /**
   * Formats an Electron accelerator string for display with platform-specific symbols.
   * On macOS: Uses symbols like ⌘, ⌥, ⌃, ⇧
   * On Windows/Linux: Uses "Ctrl+", "Alt+", "Shift+"
   *
   * @param accelerator - Standard Electron accelerator string (e.g., "CmdOrCtrl+S")
   * @returns Formatted display string
   */
  function acceleratorFormatter(accelerator: string): string;
  export default acceleratorFormatter;
}
