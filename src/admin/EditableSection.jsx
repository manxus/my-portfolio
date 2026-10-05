import { useState, createContext, useContext, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../stores/adminStore';
import { schemas } from './schemas';
import { applyAutoId } from './autoId';
import { notifyAdminCollectionSaved } from './adminEvents';
import ConfirmDialog from './ConfirmDialog';
import {
  flattenPersonalInfoForEditor,
  nestPersonalInfoFromEditor,
} from '../utils/availability';
import styles from './EditableSection.module.css';

// Admin-only, and it pulls in the Steam game picker with the whole library
// snapshot. EditableSection sits under the main menu, so a static import put
// that snapshot in the boot chunk for every visitor.
const ContentEditor = lazy(() => import('./ContentEditor'));

const EditableItemsContext = createContext(null);


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

  if (!import.meta.env.DEV || !schema) {
    return children;
  }

  // Logging in or out must not change the element tree around `children`: a
  // bare `children` here and a wrapped one below would make React remount the
  // whole section, replaying every entrance animation on the page. So the
  // wrapper and provider always render in dev, and the wrapper collapses out
  // of layout (display: contents) while logged out.
  const isAdminUi = isAuthenticated;

  const openAdd = async () => {
    setEditState({ mode: 'add', index: -1, data: null });
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
        setEditState({ mode: 'edit', index, data: items[index] });
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

  const handleMoveUp = async (index) => {
    if (index <= 0) return;
    const fileData = await getData(collection);
    const items = fileData[dataKey];
    if (!Array.isArray(items)) return;
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    await saveData(collection, { ...fileData, [dataKey]: items });
    notifyAdminCollectionSaved(collection);
  };

  const handleMoveDown = async (index) => {
    const fileData = await getData(collection);
    const items = fileData[dataKey];
    if (!Array.isArray(items) || index >= items.length - 1) return;
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
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
                onMoveUp: handleMoveUp,
                onMoveDown: handleMoveDown,
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
}) {
  const ctx = useContext(EditableItemsContext);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);

  if (!import.meta.env.DEV || !isAuthenticated || !ctx) return null;

  return (
    <div className={styles.itemControls}>
      {!hideMove && (
        <>
          <button
            className={styles.itemBtn}
            onClick={(e) => { e.stopPropagation(); ctx.onMoveUp(index); }}
            title="Move up"
          >
            &#9650;
          </button>
          <button
            className={styles.itemBtn}
            onClick={(e) => { e.stopPropagation(); ctx.onMoveDown(index); }}
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
