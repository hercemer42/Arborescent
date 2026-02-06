export const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  editing: 'Editing',
  actions: 'Actions',
  file: 'File',
  view: 'View',
  search: 'Search',
};

export const ACTION_LABELS: Record<string, string> = {
  // Navigation
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  expandCollapse: 'Expand/Collapse',
  moveNodeUp: 'Move Node Up',
  moveNodeDown: 'Move Node Down',
  // Editing
  cancelEdit: 'Cancel Edit',
  newSiblingAfter: 'Split Node at Cursor',
  newSiblingNoSplit: 'New Sibling (No Split)',
  indent: 'Indent',
  outdent: 'Outdent',
  // Actions
  toggleTaskStatus: 'Toggle Task Status',
  deleteNode: 'Delete Node',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select All',
  execute: 'Execute in Terminal',
  executeInBrowser: 'Execute in Browser',
  collaborate: 'Collaborate in Browser',
  collaborateInTerminal: 'Collaborate in Terminal',
  // File
  new: 'New File',
  save: 'Save',
  saveAs: 'Save As',
  open: 'Open',
  closeTab: 'Close Tab',
  reload: 'Reload',
  quit: 'Quit',
  // View
  toggleTerminal: 'Toggle Terminal',
  toggleBrowser: 'Toggle Browser',
  toggleBlueprintMode: 'Toggle Blueprint Mode',
  toggleSummaryMode: 'Toggle Summary Mode',
  // Search
  openSearch: 'Open Search',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
