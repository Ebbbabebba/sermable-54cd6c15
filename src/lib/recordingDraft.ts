export interface RecordingDraft { id: string; blob: Blob; durationSeconds: number; pauses: {start: number; duration: number}[]; originalText: string; language: string; }
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('sermable-recordings', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function saveRecordingDraft(draft: RecordingDraft) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(draft);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function loadRecordingDraft(id: string): Promise<RecordingDraft | undefined> {
  const db = await database();
  try { return await new Promise<RecordingDraft | undefined>((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').get(id);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}