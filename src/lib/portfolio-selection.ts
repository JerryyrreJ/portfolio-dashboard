export interface PortfolioSelectionParams {
  pid?: string | null;
  pids?: string | null;
}

export interface PortfolioSelectionOption {
  id: string;
  name?: string;
}

export interface PortfolioSelection {
  portfolioIds: string[];
  primaryPortfolioId: string | null;
  mode: 'single' | 'multi';
  isAllSelected: boolean;
  canWrite: boolean;
  selectedCount: number;
  rawRequestedIds: string[];
}

function normalizePortfolioId(value: string) {
  return value.trim();
}

export function parsePortfolioIdList(raw?: string | null) {
  if (!raw) return [];

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(',')) {
    const id = normalizePortfolioId(part);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export function getRequestedPortfolioIds(params: PortfolioSelectionParams) {
  const parsedPids = parsePortfolioIdList(params.pids);
  if (parsedPids.length > 0) {
    return parsedPids;
  }

  const pid = typeof params.pid === 'string' ? normalizePortfolioId(params.pid) : '';
  return pid ? [pid] : [];
}

export function resolvePortfolioSelection<T extends { id: string }>(
  portfolios: T[],
  params: PortfolioSelectionParams,
): PortfolioSelection {
  const rawRequestedIds = getRequestedPortfolioIds(params);
  const availableIds = new Set(portfolios.map((portfolio) => portfolio.id));
  const requestedIds = rawRequestedIds.filter((id) => availableIds.has(id));

  const fallbackIds = requestedIds.length > 0
    ? requestedIds
    : (portfolios[0] ? [portfolios[0].id] : []);

  const selectedSet = new Set(fallbackIds);
  const orderedIds = portfolios
    .map((portfolio) => portfolio.id)
    .filter((id) => selectedSet.has(id));

  const portfolioIds = orderedIds.length > 0
    ? orderedIds
    : (portfolios[0] ? [portfolios[0].id] : []);

  return {
    portfolioIds,
    primaryPortfolioId: portfolioIds[0] ?? null,
    mode: portfolioIds.length > 1 ? 'multi' : 'single',
    isAllSelected: portfolios.length > 0 && portfolioIds.length === portfolios.length,
    canWrite: portfolioIds.length === 1,
    selectedCount: portfolioIds.length,
    rawRequestedIds,
  };
}

export function applyPortfolioSelectionToSearchParams(
  searchParams: URLSearchParams,
  portfolioIds: string[],
) {
  searchParams.delete('pid');
  searchParams.delete('pids');

  const normalized = parsePortfolioIdList(portfolioIds.join(','));
  if (normalized.length > 0) {
    searchParams.set('pids', normalized.join(','));
  }
}

export function getPortfolioSelectionQuery(portfolioIds: string[]) {
  const searchParams = new URLSearchParams();
  applyPortfolioSelectionToSearchParams(searchParams, portfolioIds);
  return searchParams.toString();
}

export function buildPortfolioSelectionLabel(
  selection: PortfolioSelection,
  portfolios: PortfolioSelectionOption[],
  options?: {
    allLabel?: string;
    countLabel?: (count: number) => string;
  },
) {
  const namesById = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio.name?.trim() || portfolio.id]));
  const selectedNames = selection.portfolioIds
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name));

  if (selection.selectedCount <= 1) {
    return selectedNames[0] ?? options?.allLabel ?? 'Portfolio';
  }

  if (selection.isAllSelected) {
    return options?.allLabel ?? 'All Portfolios';
  }

  if (selection.selectedCount <= 2 && selectedNames.length === selection.selectedCount) {
    return selectedNames.join(', ');
  }

  if (options?.countLabel) {
    return options.countLabel(selection.selectedCount);
  }

  return `${selection.selectedCount} Portfolios`;
}
