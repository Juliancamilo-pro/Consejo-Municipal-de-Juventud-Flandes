import { useEffect, useState } from 'react';

const dirtyKeys = new Set<string>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

export function setUnsavedChangesFlag(key: string, isDirty: boolean): void {
  const normalized = key.trim();
  if (!normalized) return;
  const alreadyHas = dirtyKeys.has(normalized);
  if (isDirty && !alreadyHas) {
    dirtyKeys.add(normalized);
    notifyListeners();
  } else if (!isDirty && alreadyHas) {
    dirtyKeys.delete(normalized);
    notifyListeners();
  }
}

export function hasUnsavedChanges(): boolean {
  return dirtyKeys.size > 0;
}

export function getUnsavedKeys(): string[] {
  return Array.from(dirtyKeys);
}

export function subscribeUnsavedChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUnsavedChangesFlag(): boolean {
  const [dirty, setDirty] = useState<boolean>(() => hasUnsavedChanges());
  useEffect(() => {
    setDirty(hasUnsavedChanges());
    return subscribeUnsavedChanges(() => {
      setDirty(hasUnsavedChanges());
    });
  }, []);
  return dirty;
}

export function useUnsavedChangesGuard(key: string, isDirty: boolean): void {
  useEffect(() => {
    setUnsavedChangesFlag(key, isDirty);
    return () => {
      setUnsavedChangesFlag(key, false);
    };
  }, [key, isDirty]);
}
