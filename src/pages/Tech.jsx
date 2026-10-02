import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import techData from '../data/tech.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import ConfirmDialog from '../admin/ConfirmDialog';
import {
  getTechItemSchemaForCategoryId,
  TECH_BUILDS_CATEGORY_ID,
  TECH_COMPONENT_INVENTORY_CATEGORY_ID,
  TECH_HARDWARE_TAG_OPTIONS,
  TECH_PROFICIENCY_LEVELS,
  TECH_SETUP_CATEGORY_ID,
  TECH_SOFTWARE_CATEGORY_ID,
  TECH_SOFTWARE_GROUPS,
  TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_HARDWARE,
  TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_OTHER,
} from '../admin/schemas';
import { useAdminStore } from '../stores/adminStore';
import editableStyles from '../admin/EditableSection.module.css';
import styles from './Tech.module.css';

// Admin-only, and it pulls in the Steam game picker with the whole library
// snapshot; a static import made every visitor to this page download it.
const ContentEditor = lazy(() => import('../admin/ContentEditor'));

const { techCategories } = techData;

/** Spec-list fields per category; cards in these categories get the wide layout. */
const SPEC_KEYS_BY_CATEGORY = {
  [TECH_BUILDS_CATEGORY_ID]: [
    ['cpu', 'CPU'],
    ['gpu', 'GPU'],
    ['ram', 'RAM'],
    ['storage', 'Storage'],
    ['motherboard', 'Motherboard'],
    ['psu', 'PSU'],
    ['case', 'Case'],
    ['cooling', 'Cooling'],
  ],
  [TECH_SETUP_CATEGORY_ID]: [
    ['monitor', 'Monitor'],
    ['keyboard', 'Keyboard'],
    ['mouse', 'Mouse'],
    ['headset', 'Headset'],
    ['microphone', 'Mic'],
    ['webcam', 'Webcam'],
    ['chair', 'Chair'],
    ['desk', 'Desk'],
  ],
};

/** A value may hold several entries, one per line (each drive, each monitor). */
function specValues(v) {
  if (v == null) return [];
  return String(v)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSpecLines(item, categoryId) {
  const lines = [];
  for (const [key, label] of SPEC_KEYS_BY_CATEGORY[categoryId] || []) {
    const values = specValues(item[key]);
    if (values.length > 0) lines.push({ key, label, values });
  }
  const extras = specValues(item.extras);
  if (extras.length > 0) lines.push({ key: 'extras', label: 'Other', values: extras });
  return lines;
}

/**
 * Proficiency as filled pips: Daily use 3, Comfortable 2, Familiar 1. A value
 * outside the scale (older free text) shows as plain text, without pips.
 */
function ProficiencyMeter({ value }) {
  const text = value != null ? String(value).trim() : '';
  if (!text) return null;
  const rank = TECH_PROFICIENCY_LEVELS.findIndex(
    (level) => level.toLowerCase() === text.toLowerCase(),
  );
  if (rank < 0) return <span className={styles.proficiency}>{text}</span>;
  const filled = TECH_PROFICIENCY_LEVELS.length - rank;
  return (
    <span className={styles.proficiency}>
      <span className={styles.pips} aria-hidden>
        {TECH_PROFICIENCY_LEVELS.map((level, i) => (
          <span key={level} className={`${styles.pip} ${i < filled ? styles.pipOn : ''}`} />
        ))}
      </span>
      {TECH_PROFICIENCY_LEVELS[rank]}
    </span>
  );
}

function TechItemToolbar({
  itemIndex,
  itemCount,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);

  if (!import.meta.env.DEV || !isAuthenticated) return null;

  return (
    <div className={`${editableStyles.itemControls} ${styles.itemToolbar}`}>
      <button
        type="button"
        className={editableStyles.itemBtn}
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        disabled={itemIndex <= 0}
        title="Move up"
      >
        &#9650;
      </button>
      <button
        type="button"
        className={editableStyles.itemBtn}
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        disabled={itemIndex >= itemCount - 1}
        title="Move down"
      >
        &#9660;
      </button>
      <button
        type="button"
        className={editableStyles.itemBtn}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Edit"
      >
        &#9998;
      </button>
      <button
        type="button"
        className={`${editableStyles.itemBtn} ${editableStyles.deleteBtn}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete"
      >
        &times;
      </button>
    </div>
  );
}

function TechItemSpecs({ item, categoryId }) {
  if (!SPEC_KEYS_BY_CATEGORY[categoryId]) return null;
  const lines = buildSpecLines(item, categoryId);
  const legacy = item.specs && String(item.specs).trim();
  if (lines.length === 0 && !legacy) return null;
  return (
    <>
      {lines.length > 0 && (
        <dl className={styles.specsList}>
          {lines.map(({ key, label, values }) => (
            <div key={key} className={styles.specRow}>
              <dt>{label}</dt>
              <dd>
                {values.map((v, i) => (
                  <span key={i} className={styles.specValue}>{v}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {legacy ? <p className={styles.specs}>{item.specs}</p> : null}
    </>
  );
}

function inventorySubgroupSchemaForRowLabel(rowLabel) {
  const rowSchema =
    rowLabel === 'Other'
      ? TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_OTHER
      : TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_HARDWARE;
  return [
    {
      key: 'items',
      label: 'Parts',
      type: 'objectList',
      schema: rowSchema,
    },
  ];
}

function groupInventoryItemsByCategory(items) {
  /** @type {Record<string, { item: object; idx: number }[]>} */
  const byCat = Object.fromEntries(
    TECH_HARDWARE_TAG_OPTIONS.map((k) => [k, []]),
  );
  const uncategorized = [];
  items.forEach((item, idx) => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const bucket =
      TECH_HARDWARE_TAG_OPTIONS.find((opt) => tags.includes(opt)) ?? null;
    if (bucket == null) uncategorized.push({ item, idx });
    else byCat[bucket].push({ item, idx });
  });
  return { byCat, uncategorized };
}

function getSubgroupEntries(items, rowLabel) {
  const { byCat, uncategorized } = groupInventoryItemsByCategory(items);
  const raw = rowLabel === 'Other' ? uncategorized : (byCat[rowLabel] || []);
  return [...raw].sort((a, b) => a.idx - b.idx);
}

function normalizeSubgroupRow(row, rowLabel) {
  if (rowLabel !== 'Other' && TECH_HARDWARE_TAG_OPTIONS.includes(rowLabel)) {
    const { tags: _ignored, ...rest } = row;
    return { ...rest, tags: [rowLabel] };
  }
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const pick = TECH_HARDWARE_TAG_OPTIONS.find((opt) => tags.includes(opt));
  return { ...row, tags: pick ? [pick] : [] };
}

function mergeInventorySubgroup(items, rowLabel, editedRows) {
  const rows = Array.isArray(editedRows) ? editedRows : [];
  let itemsMut = [...items];
  let entries = getSubgroupEntries(itemsMut, rowLabel);

  const removeCount = entries.length - rows.length;
  if (removeCount > 0) {
    const toRemove = [...entries].sort((a, b) => b.idx - a.idx).slice(0, removeCount);
    for (const { idx } of toRemove) {
      itemsMut.splice(idx, 1);
    }
    entries = getSubgroupEntries(itemsMut, rowLabel);
  }

  const updateCount = Math.min(rows.length, entries.length);
  for (let i = 0; i < updateCount; i++) {
    itemsMut[entries[i].idx] = normalizeSubgroupRow(rows[i], rowLabel);
  }

  for (let i = entries.length; i < rows.length; i++) {
    itemsMut.push(normalizeSubgroupRow(rows[i], rowLabel));
  }

  return itemsMut;
}

function TechInventoryDetails({ item }) {
  const rawQty = item.quantity;
  const hasQty =
    rawQty !== '' &&
    rawQty != null &&
    Number.isFinite(Number(rawQty));
  const notes = item.extras != null && String(item.extras).trim();

  if (!hasQty && !notes) return null;

  return (
    <>
      {hasQty ? (
        <span className={styles.inventoryQty}>
          Qty: {Number(rawQty)}
        </span>
      ) : null}
      {notes ? (
        <p className={`${styles.specs} ${styles.inventoryNotes}`}>{String(item.extras).trim()}</p>
      ) : null}
    </>
  );
}

function TechInventoryItemCard({
  item,
  idx,
  ci,
  itemCount,
  showItemChrome,
  openItemEdit,
  handleItemDelete,
  handleItemMove,
}) {
  return (
    <div
      id={`inv-card-${ci}-${idx}`}
      className={`${styles.item} ${showItemChrome ? styles.itemWithAdmin : ''}`}
    >
      <TechItemToolbar
        itemIndex={idx}
        itemCount={itemCount}
        onEdit={() => openItemEdit(ci, idx)}
        onDelete={() => handleItemDelete(ci, idx)}
        onMoveUp={() => handleItemMove(ci, idx, -1)}
        onMoveDown={() => handleItemMove(ci, idx, 1)}
      />
      <h4 className={styles.itemName}>{item.name}</h4>
      <div className={styles.tags}>
        {(item.tags || []).map((tag) => (
          <span key={`${idx}-${tag}`} className={styles.tag}>{tag}</span>
        ))}
      </div>
      <ProficiencyMeter value={item.proficiency} />
      <TechInventoryDetails item={item} />
    </div>
  );
}

function InventoryCategoryAccordion({
  rowLabel,
  entries,
  items,
  ci,
  showItemChrome,
  onEditSubgroup,
  openItemEdit,
  handleItemDelete,
  handleItemMove,
}) {
  const count = entries.length;

  return (
    <details className={styles.inventoryDetails}>
      <summary className={styles.inventorySummary}>
        <span className={styles.inventorySummaryLabel}>{rowLabel}</span>
        <span className={styles.inventorySummaryCount}>
          {count === 0 ? 'No parts' : `${count} part${count === 1 ? '' : 's'}`}
        </span>
        {showItemChrome ? (
          <button
            type="button"
            className={`${editableStyles.itemBtn} ${styles.inventorySubgroupEditBtn}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditSubgroup();
            }}
            title={`Edit ${rowLabel} inventory list`}
          >
            &#9998;
          </button>
        ) : null}
        <span className={styles.inventoryChevron} aria-hidden />
      </summary>
      <div className={styles.inventoryDetailsBody}>
        {count === 0 ? (
          <p className={styles.inventoryEmpty}>No parts in this category.</p>
        ) : (
          <div className={`${styles.itemList} ${styles.itemListBuilds}`}>
            {entries.map(({ item, idx }) => (
              <TechInventoryItemCard
                key={`${rowLabel}-${idx}`}
                item={item}
                idx={idx}
                ci={ci}
                itemCount={items.length}
                showItemChrome={showItemChrome}
                openItemEdit={openItemEdit}
                handleItemDelete={handleItemDelete}
                handleItemMove={handleItemMove}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function TechInventoryDropdownPanel({
  items,
  ci,
  showItemChrome,
  openInventorySubgroupEdit,
  openItemEdit,
  handleItemDelete,
  handleItemMove,
}) {
  const { byCat, uncategorized } = useMemo(
    () => groupInventoryItemsByCategory(items),
    [items],
  );

  const rows = useMemo(() => {
    const base = TECH_HARDWARE_TAG_OPTIONS.map((label) => ({
      label,
      entries: byCat[label],
    }));
    if (uncategorized.length > 0) {
      base.push({ label: 'Other', entries: uncategorized });
    }
    // Admin keeps the empty buckets: their edit button is how parts get added.
    return showItemChrome ? base : base.filter((r) => r.entries.length > 0);
  }, [byCat, uncategorized, showItemChrome]);

  return (
    <div className={styles.inventoryAccordionPanel}>
      {rows.map(({ label, entries }) => (
        <InventoryCategoryAccordion
          key={label}
          rowLabel={label}
          entries={entries}
          items={items}
          ci={ci}
          showItemChrome={showItemChrome}
          onEditSubgroup={() => openInventorySubgroupEdit(ci, label)}
          openItemEdit={openItemEdit}
          handleItemDelete={handleItemDelete}
          handleItemMove={handleItemMove}
        />
      ))}
    </div>
  );
}

function TechItemCard({ item, i, ci, categoryId, itemCount, showItemChrome, actions }) {
  return (
    <div className={`${styles.item} ${showItemChrome ? styles.itemWithAdmin : ''}`}>
      <TechItemToolbar
        itemIndex={i}
        itemCount={itemCount}
        onEdit={() => actions.openItemEdit(ci, i)}
        onDelete={() => actions.handleItemDelete(ci, i)}
        onMoveUp={() => actions.handleItemMove(ci, i, -1)}
        onMoveDown={() => actions.handleItemMove(ci, i, 1)}
      />
      <h4 className={styles.itemName}>{item.name}</h4>
      <div className={styles.tags}>
        {(item.tags || []).map((tag) => (
          <span key={tag} className={styles.tag}>{tag}</span>
        ))}
      </div>
      <ProficiencyMeter value={item.proficiency} />
      <TechItemSpecs item={item} categoryId={categoryId} />
    </div>
  );
}

/**
 * Software split into purpose groups, in TECH_SOFTWARE_GROUPS order; anything
 * without a known group lands under Other. Cards keep their index in the full
 * list, which is what the admin move/edit/delete buttons act on.
 */
function SoftwareGroups({ cat, ci, showItemChrome, actions }) {
  const groups = useMemo(() => {
    const byGroup = new Map([...TECH_SOFTWARE_GROUPS, 'Other'].map((g) => [g, []]));
    cat.items.forEach((item, i) => {
      const key = TECH_SOFTWARE_GROUPS.includes(item.group) ? item.group : 'Other';
      byGroup.get(key).push({ item, i });
    });
    return [...byGroup].filter(([, entries]) => entries.length > 0);
  }, [cat.items]);

  return (
    <div className={styles.groups}>
      {groups.map(([group, entries]) => (
        <div key={group} className={styles.group}>
          <h3 className={styles.groupTitle}>{group}</h3>
          <div className={styles.itemList}>
            {entries.map(({ item, i }) => (
              <TechItemCard
                key={`${cat.id}-${i}`}
                item={item}
                i={i}
                ci={ci}
                categoryId={cat.id}
                itemCount={cat.items.length}
                showItemChrome={showItemChrome}
                actions={actions}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function Tech() {
  const [itemEdit, setItemEdit] = useState(null);
  const [inventorySubgroupEdit, setInventorySubgroupEdit] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const itemEditPosRef = useRef({ ci: -1, ii: -1 });
  const inventorySubgroupEditRef = useRef({ ci: -1, rowLabel: '' });
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const showItemChrome = import.meta.env.DEV && isAuthenticated;

  useEffect(() => {
    if (itemEdit) {
      itemEditPosRef.current = { ci: itemEdit.ci, ii: itemEdit.ii };
    }
  }, [itemEdit]);

  useEffect(() => {
    if (inventorySubgroupEdit) {
      inventorySubgroupEditRef.current = {
        ci: inventorySubgroupEdit.ci,
        rowLabel: inventorySubgroupEdit.rowLabel,
      };
    }
  }, [inventorySubgroupEdit]);

  const openItemEdit = useCallback(
    async (ci, ii) => {
      try {
        const fileData = await getData('tech');
        const row = fileData.techCategories[ci].items[ii];
        setItemEdit({
          ci,
          ii,
          categoryId: fileData.techCategories[ci].id,
          data: structuredClone(row),
        });
      } catch (e) {
        console.error(e);
      }
    },
    [getData],
  );

  const handleItemSave = useCallback(
    async (formData) => {
      const { ci, ii } = itemEditPosRef.current;
      if (ci < 0 || ii < 0) return;
      const fileData = await getData('tech');
      fileData.techCategories[ci].items[ii] = formData;
      await saveData('tech', fileData);
      setItemEdit(null);
    },
    [getData, saveData],
  );

  const handleItemDelete = useCallback((ci, ii) => {
    setPendingDelete({ ci, ii, name: techCategories[ci]?.items[ii]?.name, busy: false, error: '' });
  }, []);

  const confirmDelete = async () => {
    const { ci, ii, name } = pendingDelete;
    setPendingDelete((prev) => ({ ...prev, busy: true, error: '' }));
    try {
      const fileData = await getData('tech');
      const items = fileData.techCategories[ci]?.items;
      // The index came from the bundled copy, which can trail the file; only
      // delete when it still points at the same entry.
      if (!items || items[ii]?.name !== name) {
        setPendingDelete((prev) => ({
          ...prev,
          busy: false,
          error: 'That entry has moved in the file. Reload the page and try again.',
        }));
        return;
      }
      items.splice(ii, 1);
      await saveData('tech', fileData);
      setPendingDelete(null);
    } catch (e) {
      console.error(e);
      setPendingDelete((prev) => ({ ...prev, busy: false, error: e.message }));
    }
  };

  const handleItemMove = useCallback(
    async (ci, fromIdx, delta) => {
      try {
        const fileData = await getData('tech');
        const items = fileData.techCategories[ci].items;
        const toIdx = fromIdx + delta;
        if (toIdx < 0 || toIdx >= items.length) return;
        [items[fromIdx], items[toIdx]] = [items[toIdx], items[fromIdx]];
        await saveData('tech', fileData);
      } catch (e) {
        console.error(e);
      }
    },
    [getData, saveData],
  );

  const openInventorySubgroupEdit = useCallback(
    async (ci, rowLabel) => {
      try {
        const fileData = await getData('tech');
        const items = fileData.techCategories[ci].items;
        const subgroupItems = getSubgroupEntries(items, rowLabel).map((e) => {
          const c = structuredClone(e.item);
          if (rowLabel !== 'Other') delete c.tags;
          return c;
        });
        inventorySubgroupEditRef.current = { ci, rowLabel };
        setInventorySubgroupEdit({
          ci,
          rowLabel,
          data: { items: subgroupItems },
        });
      } catch (e) {
        console.error(e);
      }
    },
    [getData],
  );

  const handleInventorySubgroupSave = useCallback(
    async (formData) => {
      const { ci, rowLabel } = inventorySubgroupEditRef.current;
      if (ci < 0 || !rowLabel) return;
      const fileData = await getData('tech');
      const list = fileData.techCategories[ci].items;
      fileData.techCategories[ci].items = mergeInventorySubgroup(
        list,
        rowLabel,
        formData.items,
      );
      await saveData('tech', fileData);
      window.dispatchEvent(
        new CustomEvent('admin-collection-saved', { detail: { collection: 'tech' } }),
      );
      inventorySubgroupEditRef.current = { ci: -1, rowLabel: '' };
      setInventorySubgroupEdit(null);
    },
    [getData, saveData],
  );

  const actions = { openItemEdit, handleItemDelete, handleItemMove };

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <EditableSection collection="tech" dataKey="techCategories">
        <div>
          {techCategories.map((cat, ci) => {
            // Empty sections stay visible to admin, so they can be filled in.
            if (cat.items.length === 0 && !showItemChrome) return null;
            return (
            <motion.section key={cat.id} variants={fadeUp} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>&gt;</span> {cat.title}
                <EditableItemControls
                  index={ci}
                  hideDelete
                  hideEdit={cat.id === TECH_COMPONENT_INVENTORY_CATEGORY_ID}
                />
              </h2>
              {cat.id === TECH_COMPONENT_INVENTORY_CATEGORY_ID ? (
                <TechInventoryDropdownPanel
                  items={cat.items}
                  ci={ci}
                  showItemChrome={showItemChrome}
                  openInventorySubgroupEdit={openInventorySubgroupEdit}
                  openItemEdit={openItemEdit}
                  handleItemDelete={handleItemDelete}
                  handleItemMove={handleItemMove}
                />
              ) : cat.id === TECH_SOFTWARE_CATEGORY_ID ? (
                <SoftwareGroups
                  cat={cat}
                  ci={ci}
                  showItemChrome={showItemChrome}
                  actions={actions}
                />
              ) : cat.items.length === 0 ? (
                <p className={styles.inventoryEmpty}>
                  Nothing here yet. Add entries with the section&apos;s edit button.
                </p>
              ) : (
                <div
                  className={
                    SPEC_KEYS_BY_CATEGORY[cat.id]
                      ? `${styles.itemList} ${styles.itemListBuilds}`
                      : styles.itemList
                  }
                >
                  {cat.items.map((item, i) => (
                    <TechItemCard
                      key={`${cat.id}-${i}`}
                      item={item}
                      i={i}
                      ci={ci}
                      categoryId={cat.id}
                      itemCount={cat.items.length}
                      showItemChrome={showItemChrome}
                      actions={actions}
                    />
                  ))}
                </div>
              )}
            </motion.section>
            );
          })}
        </div>
      </EditableSection>

      <Suspense fallback={null}>
      <AnimatePresence>
        {itemEdit && (
          <ContentEditor
            key={`${itemEdit.ci}-${itemEdit.ii}`}
            title="Edit tech item"
            schema={getTechItemSchemaForCategoryId(itemEdit.categoryId)}
            initialData={itemEdit.data}
            onSave={handleItemSave}
            onClose={() => setItemEdit(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {inventorySubgroupEdit ? (
          <ContentEditor
            key={`inv-sub-${inventorySubgroupEdit.ci}-${inventorySubgroupEdit.rowLabel}`}
            title={`Edit ${inventorySubgroupEdit.rowLabel} inventory`}
            schema={inventorySubgroupSchemaForRowLabel(inventorySubgroupEdit.rowLabel)}
            initialData={inventorySubgroupEdit.data}
            onSave={handleInventorySubgroupSave}
            onClose={() => {
              inventorySubgroupEditRef.current = { ci: -1, rowLabel: '' };
              setInventorySubgroupEdit(null);
            }}
          />
        ) : null}
      </AnimatePresence>
      </Suspense>

      <AnimatePresence>
        {pendingDelete && (
          <ConfirmDialog
            message={pendingDelete.name ? `Delete "${pendingDelete.name}"?` : 'Delete this entry?'}
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
