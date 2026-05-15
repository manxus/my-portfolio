import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import techData from '../data/tech.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import ContentEditor from '../admin/ContentEditor';
import {
  getTechItemSchemaForCategoryId,
  TECH_BUILDS_CATEGORY_ID,
  TECH_COMPONENT_INVENTORY_CATEGORY_ID,
  TECH_HARDWARE_TAG_OPTIONS,
  TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_HARDWARE,
  TECH_INVENTORY_SUBGROUP_ROW_SCHEMA_OTHER,
} from '../admin/schemas';
import { useAdminStore } from '../stores/adminStore';
import editableStyles from '../admin/EditableSection.module.css';
import styles from './Tech.module.css';

const { techCategories } = techData;

const BUILD_SPEC_KEYS = [
  ['cpu', 'CPU'],
  ['gpu', 'GPU'],
  ['ram', 'RAM'],
  ['storage', 'Storage'],
  ['motherboard', 'Motherboard'],
  ['psu', 'PSU'],
  ['case', 'Case'],
  ['cooling', 'Cooling'],
];

function buildSpecLines(item) {
  const lines = [];
  for (const [key, label] of BUILD_SPEC_KEYS) {
    const v = item[key];
    if (v != null && String(v).trim()) lines.push({ key, label, value: String(v).trim() });
  }
  if (item.extras != null && String(item.extras).trim()) {
    lines.push({ key: 'extras', label: 'Other', value: String(item.extras).trim() });
  }
  return lines;
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
  if (categoryId !== TECH_BUILDS_CATEGORY_ID) return null;
  const lines = buildSpecLines(item);
  const legacy = item.specs && String(item.specs).trim();
  if (lines.length === 0 && !legacy) return null;
  return (
    <>
      {lines.length > 0 && (
        <dl className={styles.specsList}>
          {lines.map(({ key, label, value }) => (
            <div key={key} className={styles.specRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
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
      {item.proficiency ? (
        <span className={styles.proficiency}>{item.proficiency}</span>
      ) : null}
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
    return base;
  }, [byCat, uncategorized]);

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

  const handleItemDelete = useCallback(
    async (ci, ii) => {
      if (!confirm('Delete this entry?')) return;
      try {
        const fileData = await getData('tech');
        fileData.techCategories[ci].items.splice(ii, 1);
        await saveData('tech', fileData);
      } catch (e) {
        console.error(e);
      }
    },
    [getData, saveData],
  );

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

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <EditableSection collection="tech" dataKey="techCategories">
        <div>
          {techCategories.map((cat, ci) => (
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
              ) : (
                <div
                  className={
                    cat.id === TECH_BUILDS_CATEGORY_ID
                      ? `${styles.itemList} ${styles.itemListBuilds}`
                      : styles.itemList
                  }
                >
                  {cat.items.map((item, i) => (
                    <div
                      key={`${cat.id}-${i}`}
                      className={`${styles.item} ${showItemChrome ? styles.itemWithAdmin : ''}`}
                    >
                      <TechItemToolbar
                        itemIndex={i}
                        itemCount={cat.items.length}
                        onEdit={() => openItemEdit(ci, i)}
                        onDelete={() => handleItemDelete(ci, i)}
                        onMoveUp={() => handleItemMove(ci, i, -1)}
                        onMoveDown={() => handleItemMove(ci, i, 1)}
                      />
                      <h4 className={styles.itemName}>{item.name}</h4>
                      <div className={styles.tags}>
                        {(item.tags || []).map((tag) => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                      {item.proficiency && (
                        <span className={styles.proficiency}>{item.proficiency}</span>
                      )}
                      <TechItemSpecs item={item} categoryId={cat.id} />
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          ))}
        </div>
      </EditableSection>

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
    </motion.div>
  );
}
