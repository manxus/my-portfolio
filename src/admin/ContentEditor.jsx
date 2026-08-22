import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { visibleSchemaFields } from './autoId';
import TravelLocationPicker from './TravelLocationPicker';
import CinemaTitlePicker from './CinemaTitlePicker';
import CinemaEpisodePicker from './CinemaEpisodePicker';
import { useAdminStore } from '../stores/adminStore';
import { setAdminEditorOpen } from './editorLock';
import styles from './ContentEditor.module.css';

const ADMIN_PORTAL = () => document.getElementById('admin-portal') ?? document.body;

async function readClipboardText(event) {
  const fromEvent =
    event?.clipboardData?.getData('text/plain') ||
    event?.clipboardData?.getData('text') ||
    '';
  if (fromEvent) return fromEvent;
  if (navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }
  return '';
}

function insertTextAtSelection(el, current, text, onCommit) {
  const start = el?.selectionStart ?? current.length;
  const end = el?.selectionEnd ?? start;
  const next = current.slice(0, start) + text + current.slice(end);
  onCommit(next);
  requestAnimationFrame(() => {
    try {
      el.setSelectionRange(start + text.length, start + text.length);
    } catch {
      /* ignore */
    }
  });
}

function TextInput({ value, onChange, className, placeholder }) {
  const [draft, setDraft] = useState(() => String(value ?? ''));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(String(value ?? ''));
    }
  }, [value]);

  const commit = (next) => {
    setDraft(next);
    onChange(next);
  };

  const applyPaste = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = await readClipboardText(e);
    if (!text) return;
    insertTextAtSelection(e.target, draft, text, commit);
  };

  const handlePasteShortcut = async (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v')) return;
    e.stopPropagation();
    e.preventDefault();
    const text = await readClipboardText();
    if (!text) return;
    insertTextAtSelection(e.target, draft, text, commit);
  };

  return (
    <input
      className={className}
      type="text"
      value={draft}
      placeholder={placeholder}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        onChange(draft);
      }}
      onChange={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        void handlePasteShortcut(e);
      }}
      onPaste={(e) => {
        void applyPaste(e);
      }}
    />
  );
}

function TextAreaInput({ value, onChange, className, rows = 3 }) {
  const [draft, setDraft] = useState(() => String(value ?? ''));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(String(value ?? ''));
    }
  }, [value]);

  const commit = (next) => {
    setDraft(next);
    onChange(next);
  };

  const applyPaste = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = await readClipboardText(e);
    if (!text) return;
    insertTextAtSelection(e.target, draft, text, commit);
  };

  const handlePasteShortcut = async (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v')) return;
    e.stopPropagation();
    e.preventDefault();
    const text = await readClipboardText();
    if (!text) return;
    insertTextAtSelection(e.target, draft, text, commit);
  };

  return (
    <textarea
      className={className}
      value={draft}
      rows={rows}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        onChange(draft);
      }}
      onChange={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        void handlePasteShortcut(e);
      }}
      onPaste={(e) => {
        void applyPaste(e);
      }}
    />
  );
}

async function pasteClipboardValue(onChange) {
  const text = await readClipboardText();
  if (text) onChange(text.trim());
}

function parseTierIdsFromInput(s) {
  return String(s)
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '')
    .map(Number)
    .filter((n) => !isNaN(n));
}

/** Controlled by a local draft so trailing commas and spacing survive while typing. */
function TierAppIdsInput({ ids, onChange }) {
  const idsSerialized = JSON.stringify(ids ?? []);
  const [draft, setDraft] = useState(() => (ids ?? []).join(', '));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft((ids ?? []).join(', '));
    }
  }, [idsSerialized]);

  return (
    <input
      className={styles.input}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        const parsed = parseTierIdsFromInput(draft);
        onChange(parsed);
        setDraft(parsed.join(', '));
      }}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        onChange(parseTierIdsFromInput(v));
      }}
      placeholder="App IDs (comma separated)"
    />
  );
}

function FileField({ field, value, onChange }) {
  const uploadFile = useAdminStore((s) => s.uploadFile);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      onChange(url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.fileField}>
      <TextInput
        className={styles.input}
        value={value}
        onChange={onChange}
        placeholder="/uploads/your-cv.pdf"
      />
      <div className={styles.fileActions}>
        <button
          type="button"
          className={styles.filePickerBtn}
          onClick={() => {
            void pasteClipboardValue(onChange);
          }}
        >
          PASTE URL
        </button>
        <label className={styles.filePickerBtn}>
          <input
            type="file"
            accept={field.accept || 'application/pdf,.pdf'}
            onChange={handleFile}
            disabled={uploading}
            hidden
          />
          {uploading ? 'UPLOADING…' : 'CHOOSE PDF'}
        </label>
      </div>
      {value ? (
        <a className={styles.fileLink} href={value} target="_blank" rel="noopener noreferrer">
          Open current file
        </a>
      ) : null}
      {error ? <span className={styles.fileError}>{error}</span> : null}
    </div>
  );
}

function FieldInput({ field, value, onChange, formData }) {
  if (field.type === 'file') {
    return <FileField field={field} value={value} onChange={onChange} />;
  }

  if (field.type === 'textarea') {
    return (
      <TextAreaInput
        className={styles.textarea}
        value={value}
        onChange={onChange}
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
    const displayValue = field.tagSingleton
      ? (Array.isArray(value) && value.length
          ? String(
              (field.options || []).find((opt) => value.includes(opt)) ?? value[0],
            )
          : '')
      : (value ?? '');
    return (
      <select
        className={styles.input}
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value;
          if (field.tagSingleton) {
            onChange(v ? [v] : []);
          } else {
            onChange(v);
          }
        }}
      >
        <option value="">{field.tagSingleton ? '-- Category --' : '-- Select --'}</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'list') {
    const items = Array.isArray(value) ? value : [];

    if (Array.isArray(field.options) && field.options.length > 0) {
      const optionSet = new Set(field.options);
      const orphans = items.filter((t) => !optionSet.has(String(t)));
      const setFromHardwareSelection = (selectedInOrder) => {
        onChange([...selectedInOrder, ...orphans]);
      };
      return (
        <div className={styles.listField}>
          <div className={styles.hardwareTagGrid} role="group" aria-label={field.label}>
            {field.options.map((opt) => {
              const checked = items.includes(opt);
              return (
                <label key={opt} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const selected = new Set(
                        field.options.filter((o) => items.includes(o)),
                      );
                      if (e.target.checked) selected.add(opt);
                      else selected.delete(opt);
                      const ordered = field.options.filter((o) => selected.has(o));
                      setFromHardwareSelection(ordered);
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
          {orphans.length > 0 ? (
            <div className={styles.orphanTagsBlock}>
              <span className={styles.orphanTagsLabel}>Other tags</span>
              {orphans.map((tag) => (
                <div key={tag} className={styles.listRow}>
                  <input className={styles.input} value={String(tag)} readOnly />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(items.filter((t) => String(t) !== String(tag)));
                    }}
                    title="Remove tag"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className={styles.listField}>
        {items.map((item, i) => (
          <div key={i} className={styles.listRow}>
            <TextInput
              className={styles.input}
              value={item}
              onChange={(v) => {
                const next = [...items];
                next[i] = v;
                onChange(next);
              }}
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(items.filter((_, j) => j !== i));
              }}
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
    const subSchema =
      typeof field.getItemSchema === 'function'
        ? field.getItemSchema(formData)
        : field.schema;
    return (
      <div className={styles.objectListField}>
        {items.map((obj, i) => (
          <div key={i} className={styles.objectListItem}>
            <div className={styles.objectListHeader}>
              <span className={styles.objectListIndex}>#{i + 1}</span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(items.filter((_, j) => j !== i));
                }}
              >
                &times;
              </button>
            </div>
            {subSchema.map((subField) => (
              <div key={subField.key} className={styles.label}>
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
                  formData={formData}
                />
              </div>
            ))}
          </div>
        ))}
        <button
          type="button"
          className={styles.addListBtn}
          onClick={() => {
            const empty = {};
            for (const sf of subSchema) {
              empty[sf.key] =
                sf.type === 'boolean'
                  ? false
                  : sf.type === 'list'
                    ? []
                    : sf.type === 'select' && sf.tagSingleton
                      ? []
                      : '';
            }
            onChange([...items, empty]);
          }}
        >
          + Add entry
        </button>
      </div>
    );
  }

  if (field.type === 'tiers') {
    const tierOrder = ['S', 'A', 'B', 'C', 'D', 'F', 'unplayed'];
    const tiers = value || {};
    return (
      <div className={styles.tiersField}>
        {tierOrder.map((tier) => {
          const ids = tiers[tier] || [];
          return (
            <div key={tier} className={styles.tierRow}>
              <span className={styles.tierLabel}>
                {tier === 'unplayed' ? '?' : tier}
              </span>
              <TierAppIdsInput
                ids={ids}
                onChange={(parsed) => {
                  const next = { ...tiers };
                  next[tier] = parsed;
                  onChange(next);
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <TextInput
      className={styles.input}
      value={value}
      onChange={onChange}
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
      if (field.autoId) continue;
      if (field.key === '_value') {
        return '';
      }
      if (field.type === 'mapLocation') {
        empty.lat = '';
        empty.lng = '';
        continue;
      }
      // These pickers write their own keys — no placeholder key of their own.
      if (field.type === 'tmdbLookup' || field.type === 'episodeTracker') continue;
      if (field.type === 'boolean') empty[field.key] = false;
      else if (field.type === 'list' || field.type === 'objectList') empty[field.key] = [];
      else if (field.type === 'tiers') empty[field.key] = { S: [], A: [], B: [], C: [], D: [], F: [], unplayed: [] };
      else if (field.type === 'select' && field.tagSingleton) empty[field.key] = [];
      else empty[field.key] = '';
    }
    return empty;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAdminEditorOpen(true);
    return () => setAdminEditorOpen(false);
  }, []);

  const fields = visibleSchemaFields(schema);
  const isPrimitive = fields.length === 1 && fields[0].key === '_value';
  const hasMapLocation = fields.some((f) => f.type === 'mapLocation');
  const hasTmdbLookup = fields.some(
    (f) => f.type === 'tmdbLookup' || f.type === 'episodeTracker',
  );

  const handleChange = useCallback((key, value) => {
    if (isPrimitive) {
      setFormData(value);
    } else {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  }, [isPrimitive]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasMapLocation) {
      const lat = formData.lat;
      const lng = formData.lng;
      if (
        lat === '' ||
        lng === '' ||
        lat == null ||
        lng == null ||
        Number.isNaN(Number(lat)) ||
        Number.isNaN(Number(lng))
      ) {
        alert('Place a pin on the map before saving.');
        return;
      }
    }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className={styles.backdropFill} aria-hidden="true" />
      <motion.form
        className={`${styles.modal}${hasMapLocation || hasTmdbLookup ? ` ${styles.modalWide}` : ''}`}
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
            <div className={styles.label}>
              <span className={styles.labelText}>{fields[0].label}</span>
              <FieldInput
                field={fields[0]}
                value={formData}
                onChange={(v) => handleChange('_value', v)}
                formData={formData}
              />
            </div>
          ) : (
            fields.map((field) => (
              <div key={field.key} className={styles.label}>
                <span className={styles.labelText}>
                  {field.label}
                  {field.required && <span className={styles.required}>*</span>}
                </span>
                {field.type === 'mapLocation' ? (
                  <TravelLocationPicker
                    lat={formData.lat}
                    lng={formData.lng}
                    onChange={(nextLat, nextLng, locationLabel) => {
                      setFormData((prev) => ({
                        ...prev,
                        lat: nextLat,
                        lng: nextLng,
                        ...(locationLabel ? { location: locationLabel } : {}),
                      }));
                    }}
                  />
                ) : field.type === 'tmdbLookup' ? (
                  <CinemaTitlePicker
                    value={formData}
                    onChange={(patch) => {
                      setFormData((prev) => ({ ...prev, ...patch }));
                    }}
                  />
                ) : field.type === 'episodeTracker' ? (
                  <CinemaEpisodePicker
                    value={formData}
                    onChange={(patch) => {
                      setFormData((prev) => ({ ...prev, ...patch }));
                    }}
                  />
                ) : (
                  <FieldInput
                    field={field}
                    value={formData[field.key]}
                    onChange={(v) => handleChange(field.key, v)}
                    formData={formData}
                  />
                )}
              </div>
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
    </motion.div>,
    ADMIN_PORTAL(),
  );
}
