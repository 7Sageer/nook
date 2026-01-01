export const UNCATEGORIZED_CONTAINER_ID = 'uncategorized';

const FOLDER_PREFIX = 'folder:';
const DOC_PREFIX = 'doc:';
const DOC_CONTAINER_PREFIX = 'doc-container:';
const DOC_INSTANCE_PREFIX = 'doc-instance:';

export function folderDndId(folderId: string) {
  return `${FOLDER_PREFIX}${folderId}`;
}

export function docDndId(docId: string) {
  return `${DOC_PREFIX}${docId}`;
}

export function docInstanceDndId(containerId: string, docId: string) {
  return `${DOC_INSTANCE_PREFIX}${encodeURIComponent(containerId)}|${encodeURIComponent(docId)}`;
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

export function isDocInstanceDndId(id: string) {
  return id.startsWith(DOC_INSTANCE_PREFIX);
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

export function parseDocInstanceId(id: string) {
  if (!isDocInstanceDndId(id)) return null;
  const rest = id.slice(DOC_INSTANCE_PREFIX.length);
  const separatorIndex = rest.indexOf('|');
  if (separatorIndex === -1) return null;
  const containerPart = rest.slice(0, separatorIndex);
  const docPart = rest.slice(separatorIndex + 1);
  if (!containerPart || !docPart) return null;
  try {
    return {
      containerId: decodeURIComponent(containerPart),
      docId: decodeURIComponent(docPart),
    };
  } catch {
    return null;
  }
}

export function parseDocContainerId(id: string) {
  if (!isDocContainerDndId(id)) return null;
  return id.slice(DOC_CONTAINER_PREFIX.length);
}
