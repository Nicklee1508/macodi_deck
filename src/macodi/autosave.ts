/**
 * 로그인 없이 임시 저장 — 이 브라우저(IndexedDB)에 작업 중인 제안서를 자동 보관하고, 다시 열면 이어서 편집.
 *  - localStorage 는 5MB 한도라 그림(dataURL)이 들어가면 넘친다 → IndexedDB
 *  - 저장 대상: 제목·테마·비율·슬라이드 전체. 편집이 멈추고 1초 뒤 저장
 *  - 다른 브라우저·PC 로는 안 넘어감(서버 저장 아님)
 *  + 내 파일: Ctrl+S / 다른 이름으로 저장한 제안서 목록(files 저장소) — 열기에서 골라 이어서 편집
 */
import { reactive } from 'vue'

/** 화면 표시용 — 마지막 저장 시각(0=아직 없음) */
export const draftState = reactive({ savedAt: 0, error: false })

const DB = 'macodi-deck'
const STORE = 'autosave'
const KEY = 'current'
const FILES = 'files'

export interface DeckDraft {
  title: string
  theme: unknown
  viewportRatio: number
  slides: unknown[]
  savedAt: number
  /** 지금 열린 내 파일(새로고침해도 Ctrl+S 가 같은 파일에 저장되게) */
  fileId?: string
  fileName?: string
}

/** 내 파일 한 개 */
export interface DeckFile extends DeckDraft {
  id: string
  name: string
}

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, 2)
  req.onupgradeneeded = () => {
    const db = req.result
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' })
  }
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE) => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }).finally(() => db.close())
}

export const loadDraft = (): Promise<DeckDraft | null> =>
  tx<DeckDraft | undefined>('readonly', s => s.get(KEY)).then(d => (d && Array.isArray(d.slides) && d.slides.length ? d : null)).catch(() => null)

export const saveDraft = (d: Omit<DeckDraft, 'savedAt'>) =>
  tx('readwrite', s => s.put({ ...JSON.parse(JSON.stringify(d)), savedAt: Date.now() }, KEY)).then(() => Date.now())

export const clearDraft = () => tx('readwrite', s => s.delete(KEY)).catch(() => undefined)

/* ===================== 내 파일 ===================== */

/** 지금 열린 파일 + 저장 안 한 변경 여부 + 대화상자 */
export const fileState = reactive({
  id: '',
  name: '',
  savedAt: 0,
  dirty: false,
  /** 다음 한 번의 변경은 '변경됨'으로 치지 않음(파일 열기·새 제안서처럼 통째로 바꿀 때) */
  suppressDirty: false,
  dialog: '' as '' | 'saveAs' | 'open',
})

export const listFiles = () =>
  tx<DeckFile[]>('readonly', s => s.getAll(), FILES).then(l => l.sort((a, b) => b.savedAt - a.savedAt))

export const putFile = (f: Omit<DeckFile, 'savedAt'>) => {
  const savedAt = Date.now()
  return tx('readwrite', s => s.put({ ...JSON.parse(JSON.stringify(f)), savedAt }), FILES).then(() => savedAt)
}

export const getFile = (id: string) => tx<DeckFile | undefined>('readonly', s => s.get(id), FILES).catch(() => undefined)

export const deleteFile = (id: string) => tx('readwrite', s => s.delete(id), FILES)
