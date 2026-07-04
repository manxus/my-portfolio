export function nextNumericId(items) {
  let max = 0;
  for (const item of items) {
    const n = Number(item?.id);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return max + 1;
}

export function schemaHasAutoId(schema) {
  return schema.some((f) => f.key === 'id' && f.autoId && f.type === 'number');
}

export function applyAutoId(schema, formData, items, mode) {
  if (mode !== 'add' || !Array.isArray(items) || !schemaHasAutoId(schema)) {
    return formData;
  }

  const id = formData.id;
  const missing = id === '' || id == null || Number.isNaN(Number(id));
  if (!missing) return formData;

  return { ...formData, id: nextNumericId(items) };
}

export function visibleSchemaFields(schema) {
  return schema.filter((field) => !field.autoId);
}
