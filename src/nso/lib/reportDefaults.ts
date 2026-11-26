import {
  BEHAVIOR_METRICS,
  DEFAULT_STORE_PIN,
  CREW_LEVELS,
  GROUP_MODES,
  GroupMode,
  GroupRole,
  ProductLine,
  ProductMasterItem,
  ReportData,
  SPEED_METRICS,
  CrewBehaviorRow,
  CrewMember,
  CrewSpeedRow,
  SpeedAccuracyGroup,
  TransactionSet
} from './types';
import { normalizeStoreName, uid } from './normalize';
import { DEFAULT_PRODUCT_MASTER, findProductMaster } from './productMaster';
import { DEFAULT_READINESS_ITEMS } from './preparationChecklist';

export function emptyBehaviorRow(crewId: string): CrewBehaviorRow {
  return {
    crewId,
    values: Object.fromEntries(BEHAVIOR_METRICS.map((m) => [m, 'N'])) as CrewBehaviorRow['values'],
    gapLearning: '-',
    gapNonLearning: '-',
    correction: '-'
  };
}

export function normalizeBehaviorRow(row: Partial<CrewBehaviorRow> & { crewId: string }): CrewBehaviorRow {
  const defaults = emptyBehaviorRow(row.crewId);
  return {
    ...defaults,
    ...row,
    values: { ...defaults.values, ...(row.values ?? {}) }
  };
}

export function emptySpeedRow(crewId: string): CrewSpeedRow {
  return {
    crewId,
    values: Object.fromEntries(SPEED_METRICS.map((m) => [m, 'N'])) as CrewSpeedRow['values'],
    kskTime: '',
    iceTeaTime: '',
    gapLearning: '-',
    gapNonLearning: '-',
    correction: '-',
    suggestPosition: ''
  };
}

export function normalizeSpeedRow(row: Partial<CrewSpeedRow> & { crewId: string }): CrewSpeedRow {
  const defaults = emptySpeedRow(row.crewId);
  return {
    ...defaults,
    ...row,
    iceTeaTime: row.iceTeaTime ?? '',
    values: { ...defaults.values, ...(row.values ?? {}) }
  };
}

export function makeCrew(seed?: Partial<CrewMember>): CrewMember {
  return {
    id: seed?.id ?? uid('crew'),
    name: seed?.name ?? '',
    nik: seed?.nik ?? '',
    level: seed?.level ?? CREW_LEVELS[0],
    photoUrl: seed?.photoUrl,
    groomingPhotoUrl: seed?.groomingPhotoUrl,
    createdSource: seed?.createdSource ?? 'facilitator'
  };
}

export function roleSlotsForMode(mode: string): GroupRole[] {
  if (mode === GROUP_MODES[0]) return ['Cashier', 'Support'];
  if (mode === GROUP_MODES[1]) return ['Cashier', 'Barista', 'Support'];
  if (mode === GROUP_MODES[2]) return ['Cashier', 'Barista', 'Support', 'Support'];
  if (mode === GROUP_MODES[3]) return ['Cashier', 'Cashier', 'Barista', 'Support', 'Support'];
  return ['Cashier', 'Barista', 'Support'];
}

export function buildRoleComposition(mode: string, assignments?: SpeedAccuracyGroup['roleAssignments']) {
  const slots = roleSlotsForMode(mode);
  const counts = slots.reduce<Record<string, number>>((acc, role) => ({ ...acc, [role]: (acc[role] ?? 0) + 1 }), {});
  const label = Object.entries(counts).map(([role, count]) => `${count} ${role}`).join(' + ');
  const names = assignments
    ? (Object.entries(assignments) as [GroupRole, string[]][])
        .flatMap(([role, values]) => values.map((name, index) => name ? `${role} ${index + 1}: ${name}` : ''))
        .filter(Boolean)
    : [];
  return names.length ? `${label}\n${names.join('\n')}` : label;
}

function defaultProductByName(name: string, qty = 1): ProductLine {
  const found = findProductMaster(DEFAULT_PRODUCT_MASTER, name);
  return {
    id: uid('prd'),
    product: found?.name ?? name,
    qty,
    article: found?.article ?? '',
    category: found?.category ?? (name.toLowerCase().includes('ice') ? 'Beverage' : 'Kitchen')
  };
}

function isAutoDefaultEligible(item: ProductMasterItem) {
  const name = item.name.toLowerCase();
  return !name.includes('add on')
    && !name.includes('add-on')
    && !name.startsWith('sfg')
    && !name.includes('sfg -')
    && !name.includes('(gr')
    && !name.includes(' gram')
    && !name.includes('gramasi')
    && !name.includes('sauce tray');
}

function shuffleProducts(items: ProductMasterItem[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function productLineFromMaster(item: ProductMasterItem, qty = 1): ProductLine {
  return {
    id: uid('prd'),
    product: item.name,
    qty: Math.max(1, qty),
    article: item.article,
    category: item.category
  };
}

function defaultProducts(master: ProductMasterItem[] = DEFAULT_PRODUCT_MASTER) {
  const eligible = master.filter(isAutoDefaultEligible);
  const kitchen = shuffleProducts(eligible.filter((item) => item.category === 'Kitchen'));
  const beverage = shuffleProducts(eligible.filter((item) => item.category === 'Beverage'));
  const beverageMajor = Math.random() > 0.5;
  const kitchenCount = beverageMajor ? 2 : 3;
  const beverageCount = beverageMajor ? 3 : 2;
  const selected = [
    ...kitchen.slice(0, kitchenCount),
    ...beverage.slice(0, beverageCount)
  ];
  const fallback = selected.length >= 5 ? selected : shuffleProducts(eligible).slice(0, 5);
  return fallback.slice(0, 5).map((item) => productLineFromMaster(item, 1));
}

function normalizeProductLine(product: Partial<ProductLine> | undefined, master: ProductMasterItem[]): ProductLine {
  const name = product?.product || master[0]?.name || '';
  const found = findProductMaster(master, name);
  return {
    id: product?.id ?? uid('prd'),
    product: found?.name ?? master[0]?.name ?? name,
    qty: Math.max(1, Number(product?.qty || 1)),
    article: found?.article ?? master[0]?.article ?? "",
    category: (found?.category ?? master[0]?.category ?? "Kitchen") as ProductLine["category"]
  };
}

export function makeTransaction(index: number, seed?: Partial<TransactionSet>, master: ProductMasterItem[] = DEFAULT_PRODUCT_MASTER): TransactionSet {
  return {
    id: seed?.id ?? uid('trx'),
    label: seed?.label ?? String(index),
    targetTime: seed?.targetTime ?? '05:00',
    actualTime: seed?.actualTime ?? '',
    products: seed?.products?.length ? seed.products.map((item) => normalizeProductLine(item, master)) : defaultProducts(master),
    keterangan: seed?.keterangan === '-' ? '' : (seed?.keterangan ?? ''),
    gapFinding: seed?.gapFinding === '-' ? '' : (seed?.gapFinding ?? ''),
    correction: seed?.correction === '-' ? '' : (seed?.correction ?? ''),
    capturedAt: seed?.capturedAt,
    capturedByDeviceId: seed?.capturedByDeviceId,
    lockedByDeviceId: seed?.lockedByDeviceId,
    lockedAt: seed?.lockedAt,
    noteUpdatedAt: seed?.noteUpdatedAt,
    customerName: seed?.customerName ?? '',
    cashierCrewId: seed?.cashierCrewId ?? '',
    cashierCrewName: seed?.cashierCrewName ?? ''
  };
}

export function normalizeSpeedGroup(group: SpeedAccuracyGroup, index = 1, master: ProductMasterItem[] = DEFAULT_PRODUCT_MASTER): SpeedAccuracyGroup {
  const mode = (group.modeLabel || GROUP_MODES[Math.min(index - 1, GROUP_MODES.length - 1)] || GROUP_MODES[1]) as GroupMode;
  const assignments = group.roleAssignments ?? {};
  const sourceTransactions = Array.isArray(group.transactions) ? group.transactions : [];
  const transactions = sourceTransactions.length
    ? sourceTransactions.map((trx, trxIndex) => makeTransaction(trxIndex + 1, trx, master))
    : Array.from({ length: 4 }).map((_, trxIndex) => makeTransaction(trxIndex + 1, undefined, master));
  const roleComposition = group.roleComposition && !group.roleComposition.includes('OPEN')
    ? group.roleComposition
    : buildRoleComposition(mode, assignments);
  return {
    id: group.id ?? uid('grp'),
    title: `KELOMPOK ${index}`,
    modeLabel: mode,
    roleComposition,
    roleAssignments: assignments,
    teamMembers: group.teamMembers || Object.values(assignments).flat().filter(Boolean).join('\n'),
    transactions,
    timerEnabled: Boolean(group.timerEnabled),
    keterangan: group.keterangan,
    gapFinding: group.gapFinding,
    correction: group.correction
  };
}

export function makeSpeedGroup(index = 1): SpeedAccuracyGroup {
  const mode = GROUP_MODES[Math.min(index - 1, GROUP_MODES.length - 1)] || GROUP_MODES[1];
  return normalizeSpeedGroup({
    id: uid('grp'),
    title: `KELOMPOK ${index}`,
    modeLabel: mode,
    roleComposition: buildRoleComposition(mode, {}),
    roleAssignments: {},
    teamMembers: '',
    transactions: [],
    keterangan: '',
    gapFinding: '',
    correction: ''
  }, index);
}

export function createBlankReport(storeName = 'New Store'): ReportData {
  const now = new Date().toISOString();
    let speedGroups = [makeSpeedGroup(1), makeSpeedGroup(2), makeSpeedGroup(3), makeSpeedGroup(4)];
  let productMaster = DEFAULT_PRODUCT_MASTER;

  try {
    const localTemplate = typeof window !== 'undefined' ? localStorage.getItem('nso_global_template') : null;
    if (localTemplate) {
      const data = JSON.parse(localTemplate);
      if (data.speedGroups && Array.isArray(data.speedGroups)) {
        speedGroups = data.speedGroups.map((group: any) => ({
          ...group,
          id: uid('grp'),
          transactions: group.transactions.map((trx: any) => ({
            ...trx,
            id: uid('trx'),
            products: trx.products.map((p: any) => ({ ...p, id: uid('prd') }))
          }))
        }));
      }
      if (data.productMaster && Array.isArray(data.productMaster)) {
        productMaster = data.productMaster;
      }
    }
  } catch (e) {
    console.error('Failed to parse global template', e);
  }
  return {
    id: uid('nso'),
    storeName,
    storeKey: normalizeStoreName(storeName),
    audienceToken: uid('aud').replace('aud_', ''),
    accessCode: '',
    updatedAt: now,
    general: {
      title: 'SIMULATION & REFRESHMENT',
      subtitle: 'NEW STORE OPENING',
      storeLeader: '',
      storeCode: '',
      areaManager: '',
      regionalManager: '',
      storeType: 'CVS',
      mpaMps: '',
      date: new Date().toISOString().slice(0, 10),
      facilitator: '',
      facilitator2: '',
      coverPhotoUrl: '',
      closingNote: '"Thank You"'
    },
    crews: [],
    behaviorRows: [],
    speedRows: [],
    speedGroups,
    activeSpeedGroupId: '',
    timerSessionActive: false,
    productMaster,
    readinessChecklist: DEFAULT_READINESS_ITEMS,
    readinessChecklistEnabled: false,
    leftoverProducts: [],
    leftoverInputEnabled: false,
    summaryItems: [
      { id: uid('sum'), jenis: 'Layout', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Tools', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Equipments', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Alat Cleaning', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Crew', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Grooming', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Condiment', keterangan: '-', koreksi: '-' },
      { id: uid('sum'), jenis: 'Raw Material', keterangan: '-', koreksi: '-' }
    ],
    actionPlanCrew: '',
    actionPlanTeam: '',
    documentationPhotos: [],
    layoutCounterPhotos: [],
    planogramPhotos: [],
    timers: []
  };
}

function normalizeReadinessItems(items: ReportData['readinessChecklist']): ReportData['readinessChecklist'] {
  const existing = new Map((items ?? []).map((item) => [item.id, item]));
  const defaults = DEFAULT_READINESS_ITEMS.map((item) => ({ ...item, ...(existing.get(item.id) ?? {}) }));
  const defaultIds = new Set(DEFAULT_READINESS_ITEMS.map((item) => item.id));
  const custom = (items ?? []).filter((item) => !defaultIds.has(item.id)).map((item) => ({
    ...item,
    checked: Boolean(item.checked),
    status: item.status || 'Pending',
    action: item.action || '',
    note: item.note || ''
  }));
  return [...defaults, ...custom];
}

function normalizeLeftoverProducts(items: ReportData['leftoverProducts']): ReportData['leftoverProducts'] {
  const source = items ?? [];
  return source.map((item) => ({
    ...item,
    id: item.id || uid('leftover'),
    qty: Math.max(0, Number(item.qty || 0)),
    source: item.source ?? 'facilitator'
  }));
}

export function syncCrewDependentRows(report: ReportData): ReportData {
  const source = (report ?? {}) as Partial<ReportData>;
  const fallback = createBlankReport(source.storeName || 'New Store');
  const crews = Array.isArray(source.crews) ? source.crews.map((crew) => makeCrew(crew)) : [];
  const existingMaster = source.productMaster?.length ? source.productMaster : DEFAULT_PRODUCT_MASTER;
  const missingMaster = DEFAULT_PRODUCT_MASTER.filter(p => !existingMaster.find(e => e.id === p.id));
  const master = [...existingMaster, ...missingMaster];
  const rawSpeedGroups = Array.isArray(source.speedGroups) && source.speedGroups.length ? source.speedGroups : fallback.speedGroups;
  const rawBehaviorRows = Array.isArray(source.behaviorRows) ? source.behaviorRows : [];
  const rawSpeedRows = Array.isArray(source.speedRows) ? source.speedRows : [];

  const normalizedReport: ReportData = {
    ...fallback,
    ...source,
    id: source.id || fallback.id,
    storeName: source.storeName || fallback.storeName,
    storeKey: source.storeKey || normalizeStoreName(source.storeName || fallback.storeName),
    audienceToken: source.audienceToken || fallback.audienceToken,
    accessCode: source.accessCode ? String(source.accessCode).replace(/\D/g, '') : DEFAULT_STORE_PIN,
    updatedAt: source.updatedAt || fallback.updatedAt,
    general: {
      ...fallback.general,
      ...(source.general ?? {}),
      storeCode: source.general?.storeCode ?? source.storeKey ?? fallback.general.storeCode,
      regionalManager: source.general?.regionalManager ?? '',
      facilitator2: source.general?.facilitator2 ?? ''
    },
    crews,
    behaviorRows: rawBehaviorRows,
    speedRows: rawSpeedRows,
    speedGroups: rawSpeedGroups.map((group, index) => normalizeSpeedGroup(group, index + 1, master)),
    productMaster: master,
    readinessChecklist: normalizeReadinessItems(source.readinessChecklist ?? fallback.readinessChecklist),
    readinessChecklistEnabled: Boolean(source.readinessChecklistEnabled),
    leftoverProducts: normalizeLeftoverProducts(source.leftoverProducts ?? []),
    leftoverInputEnabled: Boolean(source.leftoverInputEnabled),
    summaryItems: Array.isArray(source.summaryItems) ? source.summaryItems : fallback.summaryItems,
    documentationPhotos: Array.isArray(source.documentationPhotos) ? source.documentationPhotos : [],
    layoutCounterPhotos: Array.isArray(source.layoutCounterPhotos) ? source.layoutCounterPhotos : [],
    planogramPhotos: Array.isArray(source.planogramPhotos) ? source.planogramPhotos : [],
    timers: Array.isArray(source.timers) ? source.timers : [],
    deletedCrewIds: Array.isArray(source.deletedCrewIds) ? source.deletedCrewIds : []
  };

  const crewIds = new Set(normalizedReport.crews.map((c) => c.id));
  const existingBehavior = new Map(normalizedReport.behaviorRows.map((r) => [r.crewId, r]));
  const existingSpeed = new Map(normalizedReport.speedRows.map((r) => [r.crewId, r]));
  const behaviorRows = normalizedReport.crews.map((crew) => normalizeBehaviorRow(existingBehavior.get(crew.id) ?? { crewId: crew.id }));
  const speedRows = normalizedReport.crews.map((crew) => normalizeSpeedRow(existingSpeed.get(crew.id) ?? { crewId: crew.id }));

  return {
    ...normalizedReport,
    behaviorRows: behaviorRows.filter((row) => crewIds.has(row.crewId)),
    speedRows: speedRows.filter((row) => crewIds.has(row.crewId))
  };
}
