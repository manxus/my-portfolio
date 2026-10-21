import { useState, useContext, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../stores/adminStore';
import { schemas } from './schemas';
import { applyAutoId } from './autoId';
import { findDuplicate } from './duplicates';
import { notifyAdminCollectionSaved } from './adminEvents';
import ConfirmDialog from './ConfirmDialog';
import { EditableItemsContext } from './editableItemsContext';
import {
  flattenPersonalInfoForEditor,
  nestPersonalInfoFromEditor,
} from '../utils/availability';
import styles from './EditableSection.module.css';
import { ADMIN_ENABLED } from './adminEnabled';

// Admin-only, and it pulls in the Steam game picker with the whole library
// snapshot. EditableSection sits under the main menu, so a static import put
// that snapshot in the boot chunk for every visitor.
const ContentEditor = lazy(() => import('./ContentEditor'));



export default function EditableSection({
  collection,
  dataKey,
  children,
  /** Single object in JSON (not an array) — toolbar shows Edit instead of Add */
  singleton = false,
}) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);

  const [editState, setEditState] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const schemaKey = `${collection}.${dataKey}`;
  const schema = schemas[schemaKey];
  const isPersonalInfo = collection === 'resume' && dataKey === 'personalInfo';

  if (!ADMIN_ENABLED || !schema) {
    return children;
  }

  // Logging in or out must not change the element tree around `children`: a
  // bare `children` here and a wrapped one below would make React remount the
  // whole section, replaying every entrance animation on the page. So the
  // wrapper and provider always render in dev, and the wrapper collapses out
  // of layout (display: contents) while logged out.
  const isAdminUi = isAuthenticated;

  const openAdd = async () => {
    let existingItems = [];
    try {
      const items = (await getData(collection))[dataKey];
      if (Array.isArray(items)) existingItems = items;
    } catch (err) {
      console.error('Failed to load existing items:', err);
    }
    setEditState({ mode: 'add', index: -1, data: null, existingItems });
  };

  const openEditSingleton = async () => {
    try {
      const fileData = await getData(collection);
      const item = fileData[dataKey];
      setEditState({
        mode: 'edit',
        index: -1,
        data: isPersonalInfo ? flattenPersonalInfoForEditor(item) : item,
      });
    } catch (err) {
      console.error('Failed to load data for editing:', err);
    }
  };

  const openEdit = async (index) => {
    try {
      const fileData = await getData(collection);
      const items = fileData[dataKey];
      if (Array.isArray(items)) {
        setEditState({
          mode: 'edit',
          index,
          data: items[index],
          existingItems: items.filter((_, i) => i !== index),
        });
      } else {
        setEditState({ mode: 'edit', index: -1, data: items });
      }
    } catch (err) {
      console.error('Failed to load data for editing:', err);
    }
  };

  const handleDelete = (index, itemId) => {
    setPendingDelete({ index, itemId, error: '', busy: false });
  };

  const confirmDelete = async () => {
    const { index, itemId } = pendingDelete;
    setPendingDelete((prev) => ({ ...prev, busy: true, error: '' }));
    try {
      const fileData = await getData(collection);
      const items = fileData[dataKey];
      if (Array.isArray(items)) {
        // The index came from the page's in-memory copy, which can be behind the
        // file (second tab, hand-edited JSON, restored backup). Re-locate by id
        // so a stale index never deletes the wrong row.
        const target =
          itemId == null ? index : items.findIndex((it) => it?.id === itemId);
        if (target < 0) {
          setPendingDelete((prev) => ({
            ...prev,
            busy: false,
            error: 'That item is no longer in the file. Reload the page and try again.',
          }));
          return;
        }
        items.splice(target, 1);
        await saveData(collection, { ...fileData, [dataKey]: items });
        notifyAdminCollectionSaved(collection);
      }
      setPendingDelete(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
      // Keep the dialog open so the reason is visible instead of the click
      // looking like it did nothing.
      setPendingDelete((prev) => ({ ...prev, busy: false, error: err.message }));
    }
  };

  const handleSave = async (formData) => {
    const fileData = await getData(collection);
    const items = fileData[dataKey];

    if (Array.isArray(items)) {
      const others =
        editState.mode === 'add' ? items : items.filter((_, i) => i !== editState.index);
      const duplicate = findDuplicate(schemaKey, formData, others);
      if (duplicate) {
        throw new Error(`"${duplicate.title ?? 'This item'}" is already in the list.`);
      }
      const payload = applyAutoId(schema, formData, items, editState.mode);
      if (editState.mode === 'add') {
        items.push(payload);
      } else {
        items[editState.index] = payload;
      }
      await saveData(collection, { ...fileData, [dataKey]: items });
    } else {
      const payload = isPersonalInfo ? nestPersonalInfoFromEditor(formData) : formData;
      await saveData(collection, { ...fileData, [dataKey]: payload });
    }
    notifyAdminCollectionSaved(collection);
  };

  /** Merge `patch` into one item and save, without opening the editor. */
  const handlePatch = async (index, itemId, patch) => {
    const fileData = await getData(collection);
    const items = fileData[dataKey];
    if (!Array.isArray(items)) throw new Error('This collection is not a list.');
    // Same stale-index guard as delete: find the row by id when there is one.
    const target = itemId == null ? index : items.findIndex((it) => it?.id === itemId);
    if (target < 0 || !items[target]) {
      throw new Error('That item is no longer in the file. Reload the page and try again.');
    }
    items[target] = { ...items[target], ...patch };
    await saveData(collection, { ...fileData, [dataKey]: items });
    notifyAdminCollectionSaved(collection);
  };

  /** Swap two items in the file. Move arrows pass the on-screen neighbour, which
      is not always index ± 1 when a view filters or reverses the list. */
  const handleSwap = async (index, other) => {
    const fileData = await getData(collection);
    const items = fileData[dataKey];
    if (!Array.isArray(items)) return;
    if (other == null || other < 0 || other >= items.length || other === index) return;
    [items[index], items[other]] = [items[other], items[index]];
    await saveData(collection, { ...fileData, [dataKey]: items });
    notifyAdminCollectionSaved(collection);
  };

  return (
    <div className={isAdminUi ? styles.wrapper : styles.passthrough}>
      {isAdminUi && (
        <div className={styles.toolbar}>
          <span className={styles.tag}>{dataKey}</span>
          {singleton ? (
            <button
              type="button"
              className={styles.addBtn}
              onClick={openEditSingleton}
              title="Edit"
            >
              &#9998;
            </button>
          ) : (
            <button type="button" className={styles.addBtn} onClick={openAdd} title="Add item">
              +
            </button>
          )}
        </div>
      )}

      <EditableItemsContext.Provider
        value={
          isAdminUi
            ? {
                onEdit: openEdit,
                onDelete: handleDelete,
                onPatch: handlePatch,
                onSwap: handleSwap,
              }
            : null
        }
      >
        {children}
      </EditableItemsContext.Provider>

      <AnimatePresence>
        {pendingDelete && (
          <ConfirmDialog
            message="Delete this item?"
            error={pendingDelete.error}
            busy={pendingDelete.busy}
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AnimatePresence>
          {editState && (
            <ContentEditor
              title={editState.mode === 'add' ? `Add ${dataKey}` : `Edit ${dataKey}`}
              schema={schema}
              initialData={editState.data}
              existingItems={editState.existingItems}
              schemaKey={schemaKey}
              onSave={handleSave}
              onClose={() => setEditState(null)}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export function EditableItemControls({
  index,
  /** Stable id of this item, when the collection has one — guards the delete
      against an index that no longer matches the file on disk. */
  itemId,
  hideDelete = false,
  hideEdit = false,
  /** Views that impose their own sort order, where reordering the file is invisible. */
  hideMove = false,
  /** File indexes of the items shown before/after this one. Default to the
      array neighbours; views that filter or reverse the list pass their own. */
  prevIndex = index - 1,
  nextIndex = index + 1,
}) {
  const ctx = useContext(EditableItemsContext);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);

  if (!ADMIN_ENABLED || !isAuthenticated || !ctx) return null;

  return (
    <div className={styles.itemControls}>
      {!hideMove && (
        <>
          <button
            className={styles.itemBtn}
            onClick={(e) => { e.stopPropagation(); ctx.onSwap(index, prevIndex); }}
            title="Move up"
          >
            &#9650;
          </button>
          <button
            className={styles.itemBtn}
            onClick={(e) => { e.stopPropagation(); ctx.onSwap(index, nextIndex); }}
            title="Move down"
          >
            &#9660;
          </button>
        </>
      )}
      {!hideEdit && (
        <button
          className={styles.itemBtn}
          onClick={(e) => { e.stopPropagation(); ctx.onEdit(index); }}
          title="Edit"
        >
          &#9998;
        </button>
      )}
      {!hideDelete && (
        <button
          className={`${styles.itemBtn} ${styles.deleteBtn}`}
          onClick={(e) => { e.stopPropagation(); ctx.onDelete(index, itemId); }}
          title="Delete"
        >
          &times;
        </button>
      )}
    </div>
  );
}
