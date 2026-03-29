import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import techData from '../data/tech.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import ContentEditor from '../admin/ContentEditor';
import {
  getTechItemSchemaForCategoryId,
  TECH_BUILDS_CATEGORY_ID,
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
  const itemEditPosRef = useRef({ ci: -1, ii: -1 });
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const showItemChrome = import.meta.env.DEV && isAuthenticated;

  useEffect(() => {
    if (itemEdit) {
      itemEditPosRef.current = { ci: itemEdit.ci, ii: itemEdit.ii };
    }
  }, [itemEdit]);

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
                <EditableItemControls index={ci} hideDelete />
              </h2>
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
                      {item.tags.map((tag) => (
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
    </motion.div>
  );
}
