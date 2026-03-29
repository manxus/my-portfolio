import { useState, createContext, useContext } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../stores/adminStore';
import { schemas } from './schemas';
import ContentEditor from './ContentEditor';
import styles from './EditableSection.module.css';

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

  const schemaKey = `${collection}.${dataKey}`;
  const schema = schemas[schemaKey];

  if (!import.meta.env.DEV || !isAuthenticated || !schema) {
    return children;
  }

  const openAdd = async () => {
    setEditState({ mode: 'add', index: -1, data: null });
  };

  const openEditSingleton = async () => {
    try {
      const fileData = await getData(collection);
      const item = fileData[dataKey];
      setEditState({ mode: 'edit', index: -1, data: item });
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

  const handleDelete = async (index) => {
    if (!confirm('Delete this item?')) return;
    try {
      const fileData = await getData(collection);
      const items = fileData[dataKey];
      if (Array.isArray(items)) {
        items.splice(index, 1);
        await saveData(collection, { ...fileData, [dataKey]: items });
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleSave = async (formData) => {
    const fileData = await getData(collection);
    const items = fileData[dataKey];

    if (Array.isArray(items)) {
      if (editState.mode === 'add') {
        items.push(formData);
      } else {
        items[editState.index] = formData;
      }
      await saveData(collection, { ...fileData, [dataKey]: items });
    } else {
      await saveData(collection, { ...fileData, [dataKey]: formData });
    }
  };

  const handleMoveUp = async (index) => {
    if (index <= 0) return;
    const fileData = await getData(collection);
    const items = fileData[dataKey];
    if (!Array.isArray(items)) return;
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    await saveData(collection, { ...fileData, [dataKey]: items });
  };

  const handleMoveDown = async (index) => {
    const fileData = await getData(collection);
    const items = fileData[dataKey];
    if (!Array.isArray(items) || index >= items.length - 1) return;
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    await saveData(collection, { ...fileData, [dataKey]: items });
  };

  return (
    <div className={styles.wrapper}>
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

      <EditableItemsContext.Provider
        value={{
          onEdit: openEdit,
          onDelete: handleDelete,
          onMoveUp: handleMoveUp,
          onMoveDown: handleMoveDown,
        }}
      >
        {children}
      </EditableItemsContext.Provider>

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
    </div>
  );
}

export function useEditableItem() {
  return useContext(EditableItemsContext);
}

export function EditableItemControls({ index, hideDelete = false }) {
  const ctx = useContext(EditableItemsContext);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);

  if (!import.meta.env.DEV || !isAuthenticated || !ctx) return null;

  return (
    <div className={styles.itemControls}>
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
      <button
        className={styles.itemBtn}
        onClick={(e) => { e.stopPropagation(); ctx.onEdit(index); }}
        title="Edit"
      >
        &#9998;
      </button>
      {!hideDelete && (
        <button
          className={`${styles.itemBtn} ${styles.deleteBtn}`}
          onClick={(e) => { e.stopPropagation(); ctx.onDelete(index); }}
          title="Delete"
        >
          &times;
        </button>
      )}
    </div>
  );
}
