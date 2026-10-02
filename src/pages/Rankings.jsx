import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import defaultData from '../data/tierlists.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import ConfirmDialog from '../admin/ConfirmDialog';
import { notifyAdminCollectionSaved } from '../admin/adminEvents';
import TierBoard, { TierCategoryBar } from '../components/TierBoard/TierBoard';
import { useAdminStore } from '../stores/adminStore';
import { useAdminCollection } from '../hooks/useAdminCollection';
import boardStyles from '../components/TierBoard/TierBoard.module.css';
import styles from './Rankings.module.css';

const COLLECTION = 'tierlists';

const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D', 'F', '?'];

const DEFAULT_HINTS = {
  S: 'Favorites',
  A: 'Excellent',
  B: 'Solid',
  C: 'Fine',
  D: 'Weak',
  E: 'Barely',
  F: "Didn't enjoy",
  '?': 'Not ranked yet',
};

function tierOrderOf(list) {
  const tiers = Array.isArray(list.tiers) ? list.tiers.filter(Boolean) : [];
  return tiers.length > 0 ? tiers : DEFAULT_TIERS;
}

/** The bottom tier is where new and orphaned items wait to be ranked. */
const unrankedTierOf = (order) => order[order.length - 1];

/**
 * Placement as stored, cleaned up for display: ids with no item are dropped,
 * and items left out of every tier (new ones, or ones under a tier that was
 * since renamed) fall to the bottom tier instead of vanishing.
 */
function effectivePlacement(list) {
  const order = tierOrderOf(list);
  const items = list.items || {};
  const stored = list.placement || {};
  const seen = new Set();
  const placement = {};
  for (const tier of order) {
    placement[tier] = (stored[tier] || []).filter((id) => {
      if (!items[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  const bottom = unrankedTierOf(order);
  for (const id of Object.keys(items)) {
    if (!seen.has(id)) placement[bottom].push(id);
  }
  return placement;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function uniqueId(base, items) {
  let id = base;
  for (let n = 2; items[id]; n += 1) id = `${base}-${n}`;
  return id;
}

function extensionOf(file) {
  const match = /\.[a-z0-9]+$/i.exec(file.name);
  return match ? match[0].toLowerCase() : '.png';
}

/** Admin-only: add a new item, or rename / re-image an existing one. */
function ItemForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give it a name.');
      return;
    }
    if (!initial && !file) {
      setError('Pick an image.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), file });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className={styles.itemForm} onSubmit={submit}>
      <span className={styles.formTitle}>
        {initial ? `EDIT // ${initial.name}` : 'ADD ITEM'}
      </span>
      <input
        className={styles.formInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        autoFocus
      />
      <input
        className={styles.formFile}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.gif"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button type="submit" className={styles.formBtn} disabled={busy}>
        {busy ? 'SAVING…' : 'SAVE'}
      </button>
      <button type="button" className={styles.formBtnGhost} onClick={onCancel}>
        CANCEL
      </button>
      {initial && <span className={styles.formHint}>Leave the image empty to keep the current one.</span>}
      {error && <span className={styles.formError}>{error}</span>}
    </form>
  );
}

export default function Rankings() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);
  const uploadFile = useAdminStore((s) => s.uploadFile);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminData, reload] = useAdminCollection(COLLECTION, isAdminUi);
  // A drag shows its result at once rather than waiting on the file round
  // trip; it is only trusted while the admin copy it was made from is current.
  const [optimistic, setOptimistic] = useState(null);
  const [activeCategory, setActiveCategory] = useState(
    defaultData.tierLists[0]?.category || '',
  );
  const [form, setForm] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const baseLists = adminData?.tierLists ?? defaultData.tierLists;
  const tierLists =
    optimistic && optimistic.base === adminData ? optimistic.lists : baseLists;
  const dndReady = isAdminUi && adminData !== null;

  const activeList =
    tierLists.find((t) => t.category === activeCategory) ?? tierLists[0];
  const tierOrder = activeList ? tierOrderOf(activeList) : DEFAULT_TIERS;
  const placement = useMemo(
    () => (activeList ? effectivePlacement(activeList) : {}),
    [activeList],
  );
  const items = useMemo(() => activeList?.items || {}, [activeList]);

  /** Apply `change` to the active list in the file on disk, then refresh. */
  const mutateActiveList = useCallback(
    async (change) => {
      const fileData = await getData(COLLECTION);
      const lists = [...fileData.tierLists];
      const idx = lists.findIndex((t) => t.id === activeList.id);
      if (idx < 0) throw new Error('That list is no longer in the file. Reload the page.');
      lists[idx] = change(lists[idx]);
      await saveData(COLLECTION, { ...fileData, tierLists: lists });
      notifyAdminCollectionSaved(COLLECTION);
    },
    [activeList, getData, saveData],
  );

  const handleMove = useCallback(
    async (nextPlacement) => {
      setOptimistic({
        base: adminData,
        lists: tierLists.map((t) =>
          t.id === activeList.id ? { ...t, placement: nextPlacement } : t,
        ),
      });
      try {
        await mutateActiveList((list) => ({ ...list, placement: nextPlacement }));
      } catch (err) {
        console.error('Failed to save tier list:', err);
        setOptimistic(null);
        reload();
      }
    },
    [activeList, adminData, mutateActiveList, reload, tierLists],
  );

  const uploadImage = async (file, id) => {
    const named = new File(
      [file],
      `tier-${slugify(activeList.category)}-${id}${extensionOf(file)}`,
      { type: file.type },
    );
    const { url } = await uploadFile(named);
    // Re-uploading under the same name would otherwise show the cached image.
    return `${url}?v=${Date.now()}`;
  };

  const submitForm = async ({ name, file }) => {
    if (form.mode === 'add') {
      const id = uniqueId(slugify(name), items);
      const image = await uploadImage(file, id);
      await mutateActiveList((list) => {
        const order = tierOrderOf(list);
        const bottom = unrankedTierOf(order);
        const stored = list.placement || {};
        return {
          ...list,
          items: { ...(list.items || {}), [id]: { name, image } },
          placement: { ...stored, [bottom]: [...(stored[bottom] || []), id] },
        };
      });
    } else {
      const { id } = form;
      const image = file ? await uploadImage(file, id) : undefined;
      await mutateActiveList((list) => ({
        ...list,
        items: {
          ...list.items,
          [id]: { ...list.items[id], name, ...(image ? { image } : {}) },
        },
      }));
    }
    setForm(null);
  };

  const confirmDelete = async () => {
    const { id } = pendingDelete;
    setPendingDelete((prev) => ({ ...prev, busy: true, error: '' }));
    try {
      await mutateActiveList((list) => {
        const { [id]: _removed, ...rest } = list.items || {};
        const nextPlacement = {};
        for (const [tier, ids] of Object.entries(list.placement || {})) {
          nextPlacement[tier] = ids.filter((x) => x !== id);
        }
        return { ...list, items: rest, placement: nextPlacement };
      });
      setPendingDelete(null);
    } catch (err) {
      setPendingDelete((prev) => ({ ...prev, busy: false, error: err.message }));
    }
  };

  const resolveItem = (id) => {
    const item = items[id];
    if (!item) return null;
    return {
      title: item.name,
      node: (
        <>
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className={styles.itemImg}
              loading="lazy"
              draggable={false}
            />
          ) : (
            <span className={styles.itemFallback}>{item.name}</span>
          )}
          {dndReady && (
            <span className={styles.itemControls}>
              <button
                type="button"
                className={styles.itemBtn}
                onClick={() => setForm({ mode: 'edit', id })}
                title="Edit"
              >
                &#9998;
              </button>
              <button
                type="button"
                className={`${styles.itemBtn} ${styles.itemBtnDanger}`}
                onClick={() => setPendingDelete({ id, name: item.name, busy: false, error: '' })}
                title="Delete"
              >
                &times;
              </button>
            </span>
          )}
        </>
      ),
    };
  };

  const itemCount = Object.keys(items).length;

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className={styles.intro}>
        Tier lists for everything that isn&apos;t a game. The games live on the Steam page.
      </p>

      <EditableSection collection={COLLECTION} dataKey="tierLists">
        {tierLists.length === 0 || !activeList ? (
          <p className={boardStyles.empty}>No tier lists yet. Check back soon.</p>
        ) : (
          <div className={boardStyles.container}>
            <TierCategoryBar
              categories={tierLists.map((tl) => tl.category)}
              active={activeList.category}
              onSelect={(category) => {
                setActiveCategory(category);
                setForm(null);
              }}
              renderControls={(i) => <EditableItemControls index={i} itemId={tierLists[i].id} />}
            />

            {dndReady && (
              <div className={styles.adminBar}>
                <span className={styles.adminMeta}>
                  {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'} · DRAG TO RANK · NEW ITEMS LAND IN{' '}
                  {unrankedTierOf(tierOrder)}
                </span>
                {!form && (
                  <button
                    type="button"
                    className={styles.formBtn}
                    onClick={() => setForm({ mode: 'add' })}
                  >
                    + ADD ITEM
                  </button>
                )}
              </div>
            )}

            {dndReady && form && (
              <ItemForm
                key={form.mode === 'add' ? 'add' : form.id}
                initial={form.mode === 'edit' ? items[form.id] : null}
                onSubmit={submitForm}
                onCancel={() => setForm(null)}
              />
            )}

            {itemCount === 0 && !dndReady ? (
              <p className={boardStyles.empty}>Nothing ranked here yet.</p>
            ) : (
              <TierBoard
                boardKey={activeList.category}
                tierOrder={tierOrder}
                tiers={placement}
                resolveItem={resolveItem}
                hintFor={(tier) => activeList.hints?.[tier] ?? DEFAULT_HINTS[tier]}
                hiddenWhenEmpty={[unrankedTierOf(tierOrder)]}
                aspect={activeList.aspect || 'cover'}
                dndReady={dndReady}
                onMove={handleMove}
              />
            )}
          </div>
        )}
      </EditableSection>

      <AnimatePresence>
        {pendingDelete && (
          <ConfirmDialog
            message={`Delete "${pendingDelete.name}"?`}
            error={pendingDelete.error}
            busy={pendingDelete.busy}
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
