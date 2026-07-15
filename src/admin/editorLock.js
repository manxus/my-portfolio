export function setAdminEditorOpen(open) {
  if (open) {
    document.body.dataset.adminEditorOpen = 'true';
  } else {
    delete document.body.dataset.adminEditorOpen;
  }
}

export function isAdminEditorOpen() {
  return document.body.dataset.adminEditorOpen === 'true';
}
