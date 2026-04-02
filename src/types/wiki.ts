/**
 * Wiki 文档数据结构类型定义
 */

// ===== 根数据结构 =====
export interface WikiData {
  code: number;
  message: string;
  timestamp: string;
  data?: {
    item?: WikiItem;
  };
}

// ===== Catalog 数据结构（用于物品名/图标还原） =====
export interface CatalogData {
  data?: {
    catalog?: CatalogCategory[];
  };
}

export interface CatalogCategory {
  typeSub?: CatalogSubType[];
}

export interface CatalogSubType {
  items?: CatalogItem[];
}

export interface CatalogItem {
  itemId: string;
  name?: string;
  brief?: {
    cover?: string;
    name?: string;
  };
}

export interface CatalogItemSummary {
  itemId: string;
  name: string;
  cover?: string;
  fullId?: string;
}

export type CatalogItemMap = Record<string, CatalogItemSummary>;

export interface WikiItem {
  itemId: string;
  name?: string;
  mainType?: ItemType;
  subType?: ItemSubType;
  brief?: ItemBrief;
  caption?: CaptionItem[];
  document?: WikiDocument;
}

/** document 对象包含所有文档内容和布局配置 */
export interface WikiDocument {
  documentMap: Record<string, Document>;
  chapterGroup?: ChapterGroup[];
  widgetCommonMap?: Record<string, WidgetCommon>;
  extraInfo?: ExtraInfo;
}

export interface ItemType {
  id: string;
  name: string;
  status?: number;
  position?: number;
}

export interface ItemSubType extends ItemType {
  fatherTypeId?: string;
  style?: number;
  icon?: string;
  filterTagTree?: TagNode[];
}

export interface TagNode {
  id: string;
  name: string;
  type?: number;
  value?: string;
  children?: TagNode[];
}

export interface ItemBrief {
  cover?: string;
  name?: string;
  description?: Document | string | null;
  associate?: {
    id: string;
    name: string;
    type: string;
    dotType?: string;
  } | null;
  subTypeList?: SubType[];
  composite?: unknown;
}

export interface SubType {
  subTypeId: string;
  value: string;
}

export interface CaptionItem {
  kind: string;
  text?: {
    text: string;
  };
}

export interface ExtraInfo {
  showType?: string;
  illustration?: string;
  composite?: string;
}

export interface ChapterGroup {
  title: string;
  widgets: WidgetRef[];
}

export type WidgetSize = 'small' | 'middle' | 'large';

export interface WidgetRef {
  id: string;
  title: string;
  size: WidgetSize;
}

export type WidgetType = 'table' | 'common' | 'unknown';

export interface WidgetCommon {
  type: WidgetType;
  tableList: WidgetTableItem[];
  tabList: WidgetTab[];
  tabDataMap: Record<string, WidgetTabData>;
}

export interface WidgetTableItem {
  label: string;
  value: string;
}

export interface WidgetTab {
  tabId: string;
  title: string;
  icon: string;
}

export interface WidgetTabData {
  intro?: WidgetIntro | null;
  content?: string;
  audioList?: unknown[];
}

export interface WidgetIntro {
  name: string;
  type: string;
  imgUrl: string;
  description?: string;
}

// ===== 文档结构 =====
export interface Document {
  id: string;
  blockIds: string[];
  blockMap: Record<string, Block>;
  authorMap?: Record<string, unknown>;
  version?: string;
}

// ===== Block 类型 =====
export type Block =
  | TextBlock
  | TableBlock
  | ListBlock
  | ImageBlock
  | QuoteBlock
  | HorizontalLineBlock;

export interface BaseBlock {
  id: string;
  parentId: string;
}

// ===== Text Block =====
export interface TextBlock extends BaseBlock {
  kind: 'text';
  align?: 'left' | 'center' | 'right';
  text: {
    inlineElements: InlineElement[];
    kind: string; // 'body', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', etc.
  };
}

export type InlineElement = TextInline | EntryInline | LinkInline;

export interface TextInline {
  kind: 'text';
  text: {
    text: string;
  };
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
}

export interface EntryInline {
  kind: 'entry';
  entry: {
    id: string;
    showType: string; // 'link-imgText', 'card-big', etc.
    count?: string;
  };
}

export interface LinkInline {
  kind: 'link';
  link: {
    link: string;
    text: string;
  };
}

// ===== Table Block =====
export interface TableBlock extends BaseBlock {
  kind: 'table';
  table: {
    id: string;
    rowIds: string[];
    columnIds: string[];
    rowMap: Record<string, TableRow>;
    columnMap: Record<string, TableColumn>;
    cellMap: Record<string, TableCell>;
    description?: string;
    rowHeader?: boolean;
    colHeader?: boolean;
  };
}

export interface TableRow {
  id: string;
}

export interface TableColumn {
  id: string;
  width?: number;
}

export interface TableCell {
  id: string;
  childIds: string[];
  rowSpan?: string;
  colSpan?: string;
  borderKind?: string;
  borderColor?: string;
  backgroundColor?: string;
  verticalAlign?: string;
}

// ===== List Block =====
export interface ListBlock extends BaseBlock {
  kind: 'list';
  list: {
    id: string;
    itemIds: string[];
    itemMap: Record<string, ListItem>;
    kind: 'unordered' | 'ordered';
  };
}

export interface ListItem {
  id: string;
  childIds: string[];
}

// ===== Image Block =====
export interface ImageBlock extends BaseBlock {
  kind: 'image';
  image: {
    id: string;
    url: string;
    width?: string;
    height?: string;
    size?: string;
    format?: string;
    kind?: string;
    description?: string;
    clientWidth?: number;
    status?: string;
    infos?: unknown[];
  };
}

// ===== Quote Block =====
export interface QuoteBlock extends BaseBlock {
  kind: 'quote';
  quote: {
    childIds: string[];
  };
}

// ===== Horizontal Line Block =====
export interface HorizontalLineBlock extends BaseBlock {
  kind: 'horizontalLine';
  horizontalLine: {
    kind: string; // '1', '2', '3', '5', etc.
  };
}

// ===== 颜色映射 =====
export const COLOR_MAP: Record<string, string> = {
  light_text_primary: '#1f1f1f',
  light_text_secondary: '#5f5f5f',
  light_text_tertiary: '#8f8f8f',
  light_text_quaternary: '#afafaf',
  light_function_blue: '#1976d2',
  light_function_blueness: '#2196f3',
  light_function_red: '#e53935',
  light_function_green: '#43a047',
  light_function_yellow: '#f9a825',
  light_rank_blue: '#42a5f5',
  light_rank_yellow: '#ffa726',
  light_rank_orange: '#fb8c00',
  light_rank_purple: '#8e24aa',
  light_rank_gray: '#9e9e9e',
};

export const DARK_COLOR_MAP: Record<string, string> = {
  light_text_primary: '#e6e6e6',
  light_text_secondary: '#c8c8c8',
  light_text_tertiary: '#a8a8a8',
  light_text_quaternary: '#8a8a8a',
  light_function_blue: '#64b5f6',
  light_function_blueness: '#81d4fa',
  light_function_red: '#ef9a9a',
  light_function_green: '#81c784',
  light_function_yellow: '#ffd54f',
  light_function_orange: '#ffb74d',
  light_function_brown: '#bcaaa4',
  light_function_turquoise: '#80deea',
  light_function_violet: '#b39ddb',
  light_function_sandstone: '#d7ccc8',
  light_rank_blue: '#90caf9',
  light_rank_yellow: '#ffcc80',
  light_rank_orange: '#ffb74d',
  light_rank_purple: '#ce93d8',
  light_rank_gray: '#b0bec5',
  light_rank_green: '#a5d6a7',
};
