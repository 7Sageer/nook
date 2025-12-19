export const UNCATEGORIZED_CONTAINER_ID = 'uncategorized';

const FOLDER_PREFIX = 'folder:';
const DOC_PREFIX = 'doc:';
const DOC_CONTAINER_PREFIX = 'doc-container:';

export function folderDndId(folderId: string) {
  return `${FOLDER_PREFIX}${folderId}`;
}

export function docDndId(docId: string) {
  return `${DOC_PREFIX}${docId}`;
}

export function docContainerDndId(containerId: string) {
  return `${DOC_CONTAINER_PREFIX}${containerId}`;
}

export function isFolderDndId(id: string) {
  return id.startsWith(FOLDER_PREFIX);
}

export function isDocDndId(id: string) {
  return id.startsWith(DOC_PREFIX);
}

export function isDocContainerDndId(id: string) {
  return id.startsWith(DOC_CONTAINER_PREFIX);
}

export function parseFolderId(id: string) {
  if (!isFolderDndId(id)) return null;
  return id.slice(FOLDER_PREFIX.length);
}

export function parseDocId(id: string) {
  if (!isDocDndId(id)) return null;
  return id.slice(DOC_PREFIX.length);
}

export function parseDocContainerId(id: string) {
  if (!isDocContainerDndId(id)) return null;
  return id.slice(DOC_CONTAINER_PREFIX.length);
}

