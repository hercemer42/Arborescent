export interface HotkeyConfig {
  navigation: {
    moveUp: string;
    moveDown: string;
    moveLeft: string;
    moveRight: string;
    expandCollapse: string;
  };
  editing: {
    startEdit: string;
    cancelEdit: string;
    saveEdit: string;
    deleteLine: string;
    newSiblingAfter: string;
    newChildNode: string;
    indent: string;
    outdent: string;
  };
  actions: {
    toggleTaskStatus: string;
    deleteNode: string;
    undo: string;
    redo: string;
  };
  file: {
    save: string;
    saveAs: string;
    open: string;
    closeTab: string;
  };
}
