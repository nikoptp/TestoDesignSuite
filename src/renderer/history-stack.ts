export type HistoryStack<TSnapshot> = {
  push: (snapshot: TSnapshot) => void;
  clear: () => void;
  undo: (currentSnapshot: TSnapshot) => TSnapshot | null;
  redo: (currentSnapshot: TSnapshot) => TSnapshot | null;
};

export const createHistoryStack = <TSnapshot>(
  maxEntries: number,
): HistoryStack<TSnapshot> => {
  const undoStack: TSnapshot[] = [];
  const redoStack: TSnapshot[] = [];

  return {
    push: (snapshot: TSnapshot) => {
      undoStack.push(snapshot);
      if (undoStack.length > maxEntries) {
        undoStack.shift();
      }
      redoStack.length = 0;
    },
    clear: () => {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    undo: (currentSnapshot: TSnapshot): TSnapshot | null => {
      const previous = undoStack.pop();
      if (!previous) {
        return null;
      }

      redoStack.push(currentSnapshot);
      return previous;
    },
    redo: (currentSnapshot: TSnapshot): TSnapshot | null => {
      const next = redoStack.pop();
      if (!next) {
        return null;
      }

      undoStack.push(currentSnapshot);
      return next;
    },
  };
};
