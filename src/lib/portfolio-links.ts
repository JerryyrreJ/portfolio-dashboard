import { applyPortfolioSelectionToSearchParams, parsePortfolioIdList } from '@/lib/portfolio-selection';

export function toPortfolioSelectionQuery(portfolioIds: string[]) {
  const params = new URLSearchParams();
  applyPortfolioSelectionToSearchParams(params, portfolioIds);
  return params.toString();
}

export function toPortfolioSelectionHref(pathname: string, portfolioIds: string[], extraParams?: URLSearchParams) {
  const params = new URLSearchParams(extraParams?.toString() ?? '');
  applyPortfolioSelectionToSearchParams(params, portfolioIds);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function readPortfolioIdsFromSearchParams(searchParams: URLSearchParams) {
  const rawPids = searchParams.get('pids');
  const parsed = parsePortfolioIdList(rawPids);
  if (parsed.length > 0) {
    return parsed;
  }

  const pid = searchParams.get('pid');
  return pid ? [pid] : [];
}
