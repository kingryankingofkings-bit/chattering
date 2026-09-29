/**
 * Tiny IndexedDB wrapper for local persistence: cached characters, chats,
 * messages, feed pages and an outbox of messages composed while offline.
 */
const DB_NAME = "chattering";
const DB_VERSION = 1;
export const STORES = ["characters", "chats", "messages", "feeds", "outbox", "kv"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function hasIDB() {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) {
        const store = db.createObjectStore(s, { keyPath: "id" });
        if (s === "messages") store.createIndex("chatId", "chatId", { unique: false });
        if (s === "outbox") store.createIndex("chatId", "chatId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  if (!hasIDB()) return Promise.reject(new Error("IndexedDB unavailable"));
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const r = fn(s);
        t.oncomplete = () => resolve((r as IDBRequest<T> | undefined)?.result as T);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, id: string) => tx<T | undefined>(store, "readonly", (s) => s.get(id) as IDBRequest<T | undefined>).catch(() => undefined),
  put: <T extends { id: string }>(store: StoreName, value: T) => tx<IDBValidKey>(store, "readwrite", (s) => s.put(value)).catch(() => undefined),
  putMany: <T extends { id: string }>(store: StoreName, values: T[]) => tx<void>(store, "readwrite", (s) => { for (const v of values) s.put(v); }).catch(() => undefined),
  del: (store: StoreName, id: string) => tx<undefined>(store, "readwrite", (s) => s.delete(id)).catch(() => undefined),
  all: <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>).catch(() => [] as T[]),
  byIndex: <T>(store: StoreName, index: string, key: string) => tx<T[]>(store, "readonly", (s) => s.index(index).getAll(key) as IDBRequest<T[]>).catch(() => [] as T[]),
  clear: (store: StoreName) => tx<undefined>(store, "readwrite", (s) => s.clear()).catch(() => undefined),
  clearAll: async () => { for (const s of STORES) await idb.clear(s); },
};

export type OutboxItem = { id: string; chatId: string; content: string; createdAt: number; attempts: number };
