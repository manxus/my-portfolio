import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import styles from './ContentEditor.module.css';

function FieldInput({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className={styles.textarea}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <input
        className={styles.input}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{value ? 'Yes' : 'No'}</span>
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className={styles.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Select --</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'list') {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className={styles.listField}>
        {items.map((item, i) => (
          <div key={i} className={styles.listRow}>
            <input
              className={styles.input}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addListBtn}
          onClick={() => onChange([...items, ''])}
        >
          + Add item
        </button>
      </div>
    );
  }

  if (field.type === 'objectList') {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className={styles.objectListField}>
        {items.map((obj, i) => (
          <div key={i} className={styles.objectListItem}>
            <div className={styles.objectListHeader}>
              <span className={styles.objectListIndex}>#{i + 1}</span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                &times;
              </button>
            </div>
            {field.schema.map((subField) => (
              <label key={subField.key} className={styles.label}>
                <span className={styles.labelText}>
                  {subField.label}
                  {subField.required && <span className={styles.required}>*</span>}
                </span>
                <FieldInput
                  field={subField}
                  value={obj[subField.key]}
                  onChange={(v) => {
                    const next = [...items];
                    next[i] = { ...next[i], [subField.key]: v };
                    onChange(next);
                  }}
                />
              </label>
            ))}
          </div>
        ))}
        <button
          type="button"
          className={styles.addListBtn}
          onClick={() => {
            const empty = {};
            for (const sf of field.schema) empty[sf.key] = sf.type === 'boolean' ? false : sf.type === 'list' ? [] : '';
            onChange([...items, empty]);
          }}
        >
          + Add entry
        </button>
      </div>
    );
  }

  if (field.type === 'tiers') {
    const tierOrder = ['S', 'A', 'B', 'C', 'D', 'F'];
    const tiers = value || {};
    return (
      <div className={styles.tiersField}>
        {tierOrder.map((tier) => {
          const ids = tiers[tier] || [];
          return (
            <div key={tier} className={styles.tierRow}>
              <span className={styles.tierLabel}>{tier}</span>
              <input
                className={styles.input}
                value={ids.join(', ')}
                onChange={(e) => {
                  const next = { ...tiers };
                  next[tier] = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map(Number)
                    .filter((n) => !isNaN(n));
                  onChange(next);
                }}
                placeholder="App IDs (comma separated)"
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <input
      className={styles.input}
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function ContentEditor({
  title,
  schema,
  initialData,
  onSave,
  onClose,
}) {
  const [formData, setFormData] = useState(() => {
    if (initialData != null) return structuredClone(initialData);
    const empty = {};
    for (const field of schema) {
      if (field.key === '_value') {
        return '';
      }
      if (field.type === 'boolean') empty[field.key] = false;
      else if (field.type === 'list' || field.type === 'objectList') empty[field.key] = [];
      else if (field.type === 'tiers') empty[field.key] = { S: [], A: [], B: [], C: [], D: [], F: [] };
      else empty[field.key] = '';
    }
    return empty;
  });
  const [saving, setSaving] = useState(false);

  const isPrimitive = schema.length === 1 && schema[0].key === '_value';

  const handleChange = useCallback((key, value) => {
    if (isPrimitive) {
      setFormData(value);
    } else {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  }, [isPrimitive]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className={styles.modal}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className={styles.title}>{title}</h2>

        <div className={styles.fields}>
          {isPrimitive ? (
            <label className={styles.label}>
              <span className={styles.labelText}>{schema[0].label}</span>
              <FieldInput
                field={schema[0]}
                value={formData}
                onChange={(v) => handleChange('_value', v)}
              />
            </label>
          ) : (
            schema.map((field) => (
              <label key={field.key} className={styles.label}>
                <span className={styles.labelText}>
                  {field.label}
                  {field.required && <span className={styles.required}>*</span>}
                </span>
                <FieldInput
                  field={field}
                  value={formData[field.key]}
                  onChange={(v) => handleChange(field.key, v)}
                />
              </label>
            ))
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            CANCEL
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
