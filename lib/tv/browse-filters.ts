/**
 * The filter vocabulary behind `/browse`, and the one function that turns a
 * selection into a `/api/douban/filter` query string.
 *
 * Kept out of the component so the query building - the only part with real
 * branching - can be tested without a DOM.
 */

/** One pill in a filter row. `value` is what the API wants; the empty string
 *  is the 全部 option, which clears that dimension entirely. */
export interface BrowseFilterOption {
  label: string;
  value: string;
}

export type BrowseContentType = 'movie' | 'tv';

export interface BrowseSelection {
  type: BrowseContentType;
  /** Douban genre facet name, or '' for 全部. */
  genre: string;
  /** Douban country/region facet name, or '' for 全部. */
  country: string;
  /** `YYYY,YYYY` as the filter route's year_range pattern requires, or '' for 全部. */
  yearRange: string;
  /** One of the four sort keys the filter route accepts. */
  sort: string;
}

export const BROWSE_TYPES: readonly BrowseFilterOption[] = [
  { label: '电影', value: 'movie' },
  { label: '电视剧', value: 'tv' },
];

// 全部 leads every dimension so clearing a filter is always the leftmost
// press, reachable by holding left rather than by counting steps.
export const BROWSE_GENRES: readonly BrowseFilterOption[] = [
  '全部', '剧情', '喜剧', '动作', '爱情', '科幻', '动画', '悬疑', '惊悚', '恐怖',
  '犯罪', '纪录片', '战争', '奇幻', '冒险', '历史', '音乐', '家庭', '传记', '武侠',
].map((label) => ({ label, value: label === '全部' ? '' : label }));

export const BROWSE_COUNTRIES: readonly BrowseFilterOption[] = [
  '全部', '华语', '中国大陆', '香港', '台湾', '美国', '日本', '韩国',
  '英国', '法国', '德国', '印度', '泰国',
].map((label) => ({ label, value: label === '全部' ? '' : label }));

// Recent years get their own entry because that is how people actually ask
// for new titles; anything older is only worth a decade's granularity.
export const BROWSE_YEARS: readonly BrowseFilterOption[] = [
  { label: '全部', value: '' },
  { label: '2026', value: '2026,2026' },
  { label: '2025', value: '2025,2025' },
  { label: '2024', value: '2024,2024' },
  { label: '2023', value: '2023,2023' },
  { label: '2020年代', value: '2020,2029' },
  { label: '2010年代', value: '2010,2019' },
  { label: '2000年代', value: '2000,2009' },
  { label: '90年代', value: '1990,1999' },
  { label: '80年代', value: '1980,1989' },
];

/** Sort has no 全部: something always orders the list. 热度 is the route's
 *  own default, so it is also the default here. */
export const BROWSE_SORTS: readonly BrowseFilterOption[] = [
  { label: '综合', value: 'U' },
  { label: '热度', value: 'T' },
  { label: '评分', value: 'S' },
  { label: '最新', value: 'R' },
];

export const DEFAULT_BROWSE_SELECTION: BrowseSelection = {
  type: 'movie',
  genre: '',
  country: '',
  yearRange: '',
  sort: 'T',
};

/** Douban's explore endpoint returns exactly this many items per page. A short
 *  page is therefore the end of the list. */
export const BROWSE_PAGE_SIZE = 20;

/**
 * Build the query string for one page of `/api/douban/filter`.
 *
 * A dimension set to 全部 is omitted rather than sent empty: `genres=` is not
 * how the upstream expresses "no genre filter", and leaving the key out keeps
 * the URL - and therefore the route's fetch cache key - identical to the one a
 * user who never touched that row produces.
 */
export function buildBrowseQuery(selection: BrowseSelection, start: number): string {
  const params = new URLSearchParams({ type: selection.type, sort: selection.sort });

  if (selection.genre) params.set('genres', selection.genre);
  if (selection.country) params.set('countries', selection.country);
  if (selection.yearRange) params.set('year_range', selection.yearRange);
  if (start > 0) params.set('start', String(start));

  return params.toString();
}
