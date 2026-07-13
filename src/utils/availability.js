export const AVAILABILITY_STATUSES = ['open', 'limited', 'busy', 'hidden'];

export const STATUS_META = {
  open: { label: 'OPEN TO QA ROLES', dotClass: 'dotOpen' },
  limited: { label: 'LIMITED AVAILABILITY', dotClass: 'dotLimited' },
  busy: { label: 'CURRENTLY UNAVAILABLE', dotClass: 'dotBusy' },
  hidden: { label: '', dotClass: 'dotHidden' },
};

export function resolveAvailability(availability) {
  if (!availability?.enabled || availability.status === 'hidden') return null;
  const meta = STATUS_META[availability.status] || STATUS_META.open;
  const label = (availability.label || '').trim() || meta.label;
  const note = (availability.note || '').trim();
  return { label, dotClass: meta.dotClass, note };
}

export function flattenPersonalInfoForEditor(personalInfo) {
  const availability = personalInfo?.availability || {};
  return {
    ...personalInfo,
    availabilityEnabled: availability.enabled ?? true,
    availabilityStatus: availability.status ?? 'open',
    availabilityLabel: availability.label ?? '',
    availabilityNote: availability.note ?? '',
  };
}

export function nestPersonalInfoFromEditor(formData) {
  const {
    availabilityEnabled,
    availabilityStatus,
    availabilityLabel,
    availabilityNote,
    availability: _availability,
    ...rest
  } = formData;
  return {
    ...rest,
    availability: {
      enabled: !!availabilityEnabled,
      status: availabilityStatus || 'open',
      label: availabilityLabel || '',
      note: availabilityNote || '',
    },
  };
}
