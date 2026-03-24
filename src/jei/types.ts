export type ItemId = string;
export type FluidId = string;

export type SlotIO = 'input' | 'output' | 'catalyst';
export type StackKind = 'item' | 'tag' | 'fluid';

export interface ItemKey {
  id: ItemId;
  meta?: number | string;
  nbt?: unknown;
}

export interface ItemRarity {
  stars: number;
  label?: string;
  color?: string;
  token?: string;
  tagId?: string;
}

export interface JeiWebWikiRendererDef {
  id?: string;
  type: string;
  source?: string;
  order?: number;
  enabled?: boolean;
  title?: string;
  data?: unknown;
}

export interface ItemExtensions {
  jeiweb?: {
    wiki?: {
      renderers?: JeiWebWikiRendererDef[];
      sources?: Record<string, unknown>;
      meta?: Record<string, unknown>;
    };
    i18n?: Record<string, Record<string, unknown>>;
    meta?: Record<string, unknown>;
  };
  [extensionId: string]: unknown;
}

export interface ItemDef {
  key: ItemKey;
  name: string;
  icon?: string;
  iconSprite?: {
    url: string;
    position: string;
    size?: number;
    color?: string;
  };
  tags?: string[];
  source?: string;
  description?: string;
  rarity?: ItemRarity;
  belt?: {
    speed: number;
  };
  detailPath?: string;
  detailLoaded?: boolean;
}

export interface StackItem {
  kind: 'item';
  id: ItemId;
  amount: number;
  unit?: string;
  meta?: number | string;
  nbt?: unknown;
}

export interface StackTag {
  kind: 'tag';
  id: string;
  amount: number;
  unit?: string;
}

export interface StackFluid {
  kind: 'fluid';
  id: FluidId;
  amount: number;
  unit?: string;
}

export type Stack = StackItem | StackTag | StackFluid;
export type SlotContent = Stack | Stack[];

export interface SlotDef {
  slotId: string;
  io: SlotIO;
  accept: StackKind[];
  x: number;
  y: number;
  label?: string;
}

export interface RecipeTypeMachine {
  id: string;
  name: string;
  icon?: string;
}

export interface ParamSchemaEntry {
  displayName: string;
  unit?: string;
  default?: unknown;
  format?: 'number' | 'integer' | 'percent' | 'duration';
}

export interface RecipeTypeDef {
  key: string;
  displayName: string;
  renderer: string;
  plannerPriority?: number;
  machine?: RecipeTypeMachine | RecipeTypeMachine[];
  slots?: SlotDef[];
  paramSchema?: Record<string, ParamSchemaEntry>;
  defaults?: Record<string, unknown>;
}

export interface Recipe {
  id: string;
  type: string;
  slotContents: Record<string, SlotContent>;
  params?: Record<string, unknown>;
  inlineItems?: ItemDef[];
  detailPath?: string;
  detailLoaded?: boolean;
}

export interface InlineRecipe {
  id: string;
  type: string;
  slotContents: Record<string, SlotContent>;
  params?: Record<string, unknown>;
  inlineItems?: ItemDef[];
}

export interface ItemDef {
  key: ItemKey;
  name: string;
  icon?: string;
  iconSprite?: {
    url: string;
    position: string;
    size?: number;
    color?: string;
  };
  tags?: string[];
  source?: string;
  description?: string;
  rarity?: ItemRarity;
  belt?: {
    speed: number;
  };
  detailPath?: string;
  detailLoaded?: boolean;
  recipes?: InlineRecipe[];
  wiki?: Record<string, unknown>;
  extensions?: ItemExtensions;
}

export interface TagValueObject {
  id: string;
  required?: boolean;
}

export type TagValue = string | TagValueObject;

export interface TagDef {
  replace?: boolean;
  values: TagValue[];
}

export interface PackTags {
  item?: Record<string, TagDef>;
}

export interface PackManifest {
  packId: string;
  gameId: string;
  displayName: string;
  version: string;
  files: {
    items?: string;
    itemsIndex?: string;
    itemsLite?: string;
    tags?: string;
    recipeTypes: string;
    recipes: string;
  };
  startupDialog?: {
    id: string;
    message: string;
    confirmText?: string;
    title?: string;
  };
  imageProxy?: {
    enabled?: boolean;
    urlTemplate: string;
    devUrlTemplate?: string;
    domains?: string[];
    tokenQuery?: {
      enabled?: boolean;
      accessTokenStorageKey?: string;
      anonymousTokenStorageKey?: string;
      frameworkTokenStorageKey?: string;
      accessTokenParam?: string;
      anonymousTokenParam?: string;
      frameworkTokenParam?: string;
      anonymousTokenEndpoint?: string;
      anonymousTokenMethod?: 'GET' | 'POST';
      anonymousTokenHeaders?: Record<string, string>;
      anonymousTokenRequestBody?: Record<string, unknown>;
      anonymousTokenResponsePath?: string;
    };
  };
  planner?: {
    targetRatePresets?: {
      halfPerMinute?: number;
      fullPerMinute?: number;
    };
  };
}

export interface PackData {
  manifest: PackManifest;
  items: ItemDef[];
  tags?: PackTags;
  recipeTypes: RecipeTypeDef[];
  recipes: Recipe[];
  wiki?: Record<string, Record<string, unknown>>;
}
