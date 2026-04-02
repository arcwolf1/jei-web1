import type {
  ItemDef,
  ItemId,
  ItemKey,
  PackManifest,
  PackTags,
  TagDef,
  ParamSchemaEntry,
  Recipe,
  RecipeTypeDef,
  SlotContent,
  SlotDef,
  Stack,
  StackFluid,
  StackKind,
  StackItem,
  StackTag,
} from 'src/jei/types';
import {
  PackValidationError,
  assertArray,
  assertNumber,
  assertOptionalArray,
  assertOptionalRecord,
  assertOptionalString,
  assertRecord,
  assertString,
  isRecord,
} from 'src/jei/utils/assert';

const ITEM_ID_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function assertItemId(value: unknown, jsonPath: string): ItemId {
  const id = assertString(value, jsonPath);
  if (!ITEM_ID_RE.test(id)) {
    throw new PackValidationError(jsonPath, 'expected ItemId "game.namespace.item"');
  }
  return id;
}

export function assertFluidId(value: unknown, jsonPath: string): string {
  const id = assertString(value, jsonPath);
  if (!ITEM_ID_RE.test(id)) {
    throw new PackValidationError(jsonPath, 'expected FluidId "game.namespace.fluid"');
  }
  return id;
}

function assertStackKind(value: unknown, jsonPath: string): StackKind {
  const kind = assertString(value, jsonPath);
  if (kind !== 'item' && kind !== 'tag' && kind !== 'fluid') {
    throw new PackValidationError(jsonPath, 'expected one of: item, tag, fluid');
  }
  return kind;
}

function assertSlotIO(value: unknown, jsonPath: string): 'input' | 'output' | 'catalyst' {
  const io = assertString(value, jsonPath);
  if (io !== 'input' && io !== 'output' && io !== 'catalyst') {
    throw new PackValidationError(jsonPath, 'expected one of: input, output, catalyst');
  }
  return io;
}

export function assertItemKey(value: unknown, jsonPath: string): ItemKey {
  const obj = assertRecord(value, jsonPath);
  const id = assertItemId(obj.id, `${jsonPath}.id`);
  const meta = obj.meta;
  if (meta !== undefined && typeof meta !== 'number' && typeof meta !== 'string') {
    throw new PackValidationError(`${jsonPath}.meta`, 'expected number or string');
  }
  const key: ItemKey = { id };
  if (meta !== undefined) key.meta = meta;
  if (obj.nbt !== undefined) key.nbt = obj.nbt;
  return key;
}

export function assertItemDef(value: unknown, jsonPath: string): ItemDef {
  const obj = assertRecord(value, jsonPath);
  const tagsRaw = assertOptionalArray(obj.tags, `${jsonPath}.tags`);
  const tags = tagsRaw?.map((t, i) => assertString(t, `${jsonPath}.tags[${i}]`));
  const icon = assertOptionalString(obj.icon, `${jsonPath}.icon`);
  const beltRaw = assertOptionalRecord(obj.belt, `${jsonPath}.belt`);
  let belt: ItemDef['belt'];
  if (beltRaw !== undefined) {
    const speed = beltRaw.speed;
    if (typeof speed !== 'number') {
      throw new PackValidationError(`${jsonPath}.belt.speed`, 'expected number');
    }
    belt = { speed };
  }
  const iconSpriteRaw = assertOptionalRecord(obj.iconSprite, `${jsonPath}.iconSprite`);
  let iconSprite: ItemDef['iconSprite'];
  if (iconSpriteRaw !== undefined) {
    const url = assertString(iconSpriteRaw.url, `${jsonPath}.iconSprite.url`);
    const position = assertString(iconSpriteRaw.position, `${jsonPath}.iconSprite.position`);
    const size = iconSpriteRaw.size;
    if (size !== undefined && typeof size !== 'number') {
      throw new PackValidationError(`${jsonPath}.iconSprite.size`, 'expected number');
    }
    const color = iconSpriteRaw.color;
    if (color !== undefined && typeof color !== 'string') {
      throw new PackValidationError(`${jsonPath}.iconSprite.color`, 'expected string');
    }
    iconSprite = {
      url,
      position,
      ...(size !== undefined ? { size } : {}),
      ...(color !== undefined ? { color } : {}),
    };
  }
  const source = assertOptionalString(obj.source, `${jsonPath}.source`);
  const description = assertOptionalString(obj.description, `${jsonPath}.description`);
  const rarityRaw = assertOptionalRecord(obj.rarity, `${jsonPath}.rarity`);
  let rarity: ItemDef['rarity'];
  if (rarityRaw !== undefined) {
    const stars = assertNumber(rarityRaw.stars, `${jsonPath}.rarity.stars`);
    const label = assertOptionalString(rarityRaw.label, `${jsonPath}.rarity.label`);
    const color = assertOptionalString(rarityRaw.color, `${jsonPath}.rarity.color`);
    const token = assertOptionalString(rarityRaw.token, `${jsonPath}.rarity.token`);
    const tagId = assertOptionalString(rarityRaw.tagId, `${jsonPath}.rarity.tagId`);
    rarity = {
      stars,
      ...(label !== undefined ? { label } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(token !== undefined ? { token } : {}),
      ...(tagId !== undefined ? { tagId } : {}),
    };
  }
  const detailPath = assertOptionalString(obj.detailPath, `${jsonPath}.detailPath`);
  const wikiRaw = assertOptionalRecord(obj.wiki, `${jsonPath}.wiki`);
  const wikisRaw = assertOptionalRecord(obj.wikis, `${jsonPath}.wikis`);
  const extensionsRaw = assertOptionalRecord(obj.extensions, `${jsonPath}.extensions`);
  const i18nRaw = assertOptionalRecord(obj.i18n, `${jsonPath}.i18n`);
  const recipesRaw = assertOptionalArray(obj.recipes, `${jsonPath}.recipes`);
  const recipes = recipesRaw?.map((r, i) => assertRecipe(r, `${jsonPath}.recipes[${i}]`));

  const def: ItemDef = {
    key: assertItemKey(obj.key, `${jsonPath}.key`),
    name: assertString(obj.name, `${jsonPath}.name`),
  };
  if (icon !== undefined) def.icon = icon;
  if (iconSprite !== undefined) def.iconSprite = iconSprite;
  if (tags !== undefined) def.tags = tags;
  if (source !== undefined) def.source = source;
  if (description !== undefined) def.description = description;
  if (rarity !== undefined) def.rarity = rarity;
  if (detailPath !== undefined) def.detailPath = detailPath;
  if (belt !== undefined) def.belt = belt;
  if (wikiRaw !== undefined) def.wiki = wikiRaw;
  if (wikisRaw !== undefined) def.wikis = wikisRaw as NonNullable<ItemDef['wikis']>;
  if (i18nRaw !== undefined) {
    def.i18n = i18nRaw as NonNullable<ItemDef['i18n']>;
  }
  if (extensionsRaw !== undefined) {
    def.extensions = extensionsRaw as NonNullable<ItemDef['extensions']>;
  }
  if (recipes !== undefined) def.recipes = recipes;
  return def;
}

export function assertStack(value: unknown, jsonPath: string): Stack {
  const obj = assertRecord(value, jsonPath);
  const kind = assertStackKind(obj.kind, `${jsonPath}.kind`);
  const amount = assertNumber(obj.amount, `${jsonPath}.amount`);
  const unit = assertOptionalString(obj.unit, `${jsonPath}.unit`);

  if (kind === 'item') {
    const id = assertItemId(obj.id, `${jsonPath}.id`);
    const meta = obj.meta;
    if (meta !== undefined && typeof meta !== 'number' && typeof meta !== 'string') {
      throw new PackValidationError(`${jsonPath}.meta`, 'expected number or string');
    }
    const out: StackItem = { kind, id, amount };
    if (unit !== undefined) out.unit = unit;
    if (meta !== undefined) out.meta = meta;
    if (obj.nbt !== undefined) out.nbt = obj.nbt;
    return out;
  }

  if (kind === 'fluid') {
    const id = assertFluidId(obj.id, `${jsonPath}.id`);
    const out: StackFluid = { kind, id, amount };
    if (unit !== undefined) out.unit = unit;
    return out;
  }

  const out: StackTag = { kind, id: assertString(obj.id, `${jsonPath}.id`), amount };
  if (unit !== undefined) out.unit = unit;
  return out;
}

function assertSlotContent(value: unknown, jsonPath: string): SlotContent {
  if (Array.isArray(value)) {
    return value.map((v, i) => assertStack(v, `${jsonPath}[${i}]`));
  }
  return assertStack(value, jsonPath);
}

export function assertSlotDef(value: unknown, jsonPath: string): SlotDef {
  const obj = assertRecord(value, jsonPath);
  const acceptRaw = assertArray(obj.accept, `${jsonPath}.accept`);
  const accept = acceptRaw.map((v, i) => assertStackKind(v, `${jsonPath}.accept[${i}]`));
  const label = assertOptionalString(obj.label, `${jsonPath}.label`);
  const def: SlotDef = {
    slotId: assertString(obj.slotId, `${jsonPath}.slotId`),
    io: assertSlotIO(obj.io, `${jsonPath}.io`),
    accept,
    x: assertNumber(obj.x, `${jsonPath}.x`),
    y: assertNumber(obj.y, `${jsonPath}.y`),
  };
  if (label !== undefined) def.label = label;
  return def;
}

function assertParamSchemaEntry(value: unknown, jsonPath: string): ParamSchemaEntry {
  const obj = assertRecord(value, jsonPath);
  const format = obj.format;
  if (
    format !== undefined &&
    format !== 'number' &&
    format !== 'integer' &&
    format !== 'percent' &&
    format !== 'duration'
  ) {
    throw new PackValidationError(`${jsonPath}.format`, 'expected number|integer|percent|duration');
  }
  const unit = assertOptionalString(obj.unit, `${jsonPath}.unit`);
  const out: ParamSchemaEntry = {
    displayName: assertString(obj.displayName, `${jsonPath}.displayName`),
  };
  if (unit !== undefined) out.unit = unit;
  if (obj.default !== undefined) out.default = obj.default;
  if (format !== undefined) out.format = format;
  return out;
}

export function assertRecipeTypeDef(value: unknown, jsonPath: string): RecipeTypeDef {
  const obj = assertRecord(value, jsonPath);

  const machineRaw = assertOptionalRecord(obj.machine, `${jsonPath}.machine`);
  let machine: RecipeTypeDef['machine'];
  if (machineRaw !== undefined) {
    const icon = assertOptionalString(machineRaw.icon, `${jsonPath}.machine.icon`);
    machine = {
      id: assertString(machineRaw.id, `${jsonPath}.machine.id`),
      name: assertString(machineRaw.name, `${jsonPath}.machine.name`),
      ...(icon !== undefined ? { icon } : {}),
    };
  }

  const slotsRaw = assertOptionalArray(obj.slots, `${jsonPath}.slots`);
  const slots = slotsRaw?.map((s, i) => assertSlotDef(s, `${jsonPath}.slots[${i}]`));

  const paramSchemaRaw = obj.paramSchema;
  let paramSchema: Record<string, ParamSchemaEntry> | undefined;
  if (paramSchemaRaw !== undefined) {
    const ps = assertRecord(paramSchemaRaw, `${jsonPath}.paramSchema`);
    paramSchema = {};
    Object.keys(ps).forEach((k) => {
      paramSchema![k] = assertParamSchemaEntry(ps[k], `${jsonPath}.paramSchema.${k}`);
    });
  }

  const defaultsRaw = obj.defaults;
  let defaults: Record<string, unknown> | undefined;
  if (defaultsRaw !== undefined) {
    defaults = assertRecord(defaultsRaw, `${jsonPath}.defaults`);
  }
  const plannerPriorityRaw = obj.plannerPriority;
  let plannerPriority: number | undefined;
  if (plannerPriorityRaw !== undefined) {
    plannerPriority = assertNumber(plannerPriorityRaw, `${jsonPath}.plannerPriority`);
  }

  const out: RecipeTypeDef = {
    key: assertString(obj.key, `${jsonPath}.key`),
    displayName: assertString(obj.displayName, `${jsonPath}.displayName`),
    renderer: assertString(obj.renderer, `${jsonPath}.renderer`),
  };
  const category = assertOptionalString(obj.category, `${jsonPath}.category`);
  if (category !== undefined) out.category = category;
  if (plannerPriority !== undefined) out.plannerPriority = plannerPriority;
  if (machine !== undefined) out.machine = machine;
  if (slots !== undefined) out.slots = slots;
  if (paramSchema !== undefined) out.paramSchema = paramSchema;
  if (defaults !== undefined) out.defaults = defaults;

  const i18nRaw = obj.i18n;
  if (i18nRaw !== undefined && typeof i18nRaw === 'object' && i18nRaw !== null) {
    out.i18n = i18nRaw as NonNullable<RecipeTypeDef['i18n']>;
  }

  return out;
}

export function assertRecipe(value: unknown, jsonPath: string): Recipe {
  const obj = assertRecord(value, jsonPath);
  const slotContentsRaw = assertRecord(obj.slotContents, `${jsonPath}.slotContents`);
  const slotContents: Record<string, SlotContent> = {};
  Object.keys(slotContentsRaw).forEach((slotId) => {
    slotContents[slotId] = assertSlotContent(
      slotContentsRaw[slotId],
      `${jsonPath}.slotContents.${slotId}`,
    );
  });

  const inlineItemsRaw = assertOptionalArray(obj.inlineItems, `${jsonPath}.inlineItems`);
  const inlineItems = inlineItemsRaw?.map((it, i) =>
    assertItemDef(it, `${jsonPath}.inlineItems[${i}]`),
  );

  const paramsRaw = obj.params;
  let params: Record<string, unknown> | undefined;
  if (paramsRaw !== undefined) {
    if (!isRecord(paramsRaw)) {
      throw new PackValidationError(`${jsonPath}.params`, 'expected object');
    }
    params = paramsRaw;
  }
  const detailPath = assertOptionalString(obj.detailPath, `${jsonPath}.detailPath`);
  const detailLoadedRaw = obj.detailLoaded;
  let detailLoaded: boolean | undefined;
  if (detailLoadedRaw !== undefined) {
    if (typeof detailLoadedRaw !== 'boolean') {
      throw new PackValidationError(`${jsonPath}.detailLoaded`, 'expected boolean');
    }
    detailLoaded = detailLoadedRaw;
  }

  const out: Recipe = {
    id: assertString(obj.id, `${jsonPath}.id`),
    type: assertString(obj.type, `${jsonPath}.type`),
    slotContents,
  };
  if (params !== undefined) out.params = params;
  if (inlineItems !== undefined) out.inlineItems = inlineItems;
  if (detailPath !== undefined) out.detailPath = detailPath;
  if (detailLoaded !== undefined) out.detailLoaded = detailLoaded;
  return out;
}

export function assertPackManifest(value: unknown, jsonPath: string): PackManifest {
  const obj = assertRecord(value, jsonPath);
  const files = assertRecord(obj.files, `${jsonPath}.files`);
  const itemsPath = assertOptionalString(files.items, `${jsonPath}.files.items`);
  const itemsIndexPath = assertOptionalString(files.itemsIndex, `${jsonPath}.files.itemsIndex`);
  const itemsLitePath = assertOptionalString(files.itemsLite, `${jsonPath}.files.itemsLite`);
  const tagsPath = assertOptionalString(files.tags, `${jsonPath}.files.tags`);
  const out: PackManifest = {
    packId: assertString(obj.packId, `${jsonPath}.packId`),
    gameId: assertString(obj.gameId, `${jsonPath}.gameId`),
    displayName: assertString(obj.displayName, `${jsonPath}.displayName`),
    version: assertString(obj.version, `${jsonPath}.version`),
    files: {
      recipeTypes: assertString(files.recipeTypes, `${jsonPath}.files.recipeTypes`),
      recipes: assertString(files.recipes, `${jsonPath}.files.recipes`),
    },
  };
  if (itemsPath !== undefined) out.files.items = itemsPath;
  if (itemsIndexPath !== undefined) out.files.itemsIndex = itemsIndexPath;
  if (itemsLitePath !== undefined) out.files.itemsLite = itemsLitePath;
  if (tagsPath !== undefined) out.files.tags = tagsPath;

  if (isRecord(obj.startupDialog)) {
    const d = obj.startupDialog;
    const confirmText = assertOptionalString(
      d.confirmText,
      `${jsonPath}.startupDialog.confirmText`,
    );
    const title = assertOptionalString(d.title, `${jsonPath}.startupDialog.title`);

    const startupDialog: PackManifest['startupDialog'] = {
      id: assertString(d.id, `${jsonPath}.startupDialog.id`),
      message: assertString(d.message, `${jsonPath}.startupDialog.message`),
      ...(confirmText !== undefined ? { confirmText } : {}),
      ...(title !== undefined ? { title } : {}),
    };

    out.startupDialog = startupDialog;
  }

  if (isRecord(obj.planner)) {
    const planner = obj.planner;
    let targetRatePresets: NonNullable<PackManifest['planner']>['targetRatePresets'];

    if (isRecord(planner.targetRatePresets)) {
      const presets = planner.targetRatePresets;
      const halfPerMinuteRaw = presets.halfPerMinute;
      const fullPerMinuteRaw = presets.fullPerMinute;

      let halfPerMinute: number | undefined;
      if (halfPerMinuteRaw !== undefined) {
        halfPerMinute = assertNumber(
          halfPerMinuteRaw,
          `${jsonPath}.planner.targetRatePresets.halfPerMinute`,
        );
        if (!Number.isFinite(halfPerMinute) || halfPerMinute <= 0) {
          throw new PackValidationError(
            `${jsonPath}.planner.targetRatePresets.halfPerMinute`,
            'expected positive number',
          );
        }
      }

      let fullPerMinute: number | undefined;
      if (fullPerMinuteRaw !== undefined) {
        fullPerMinute = assertNumber(
          fullPerMinuteRaw,
          `${jsonPath}.planner.targetRatePresets.fullPerMinute`,
        );
        if (!Number.isFinite(fullPerMinute) || fullPerMinute <= 0) {
          throw new PackValidationError(
            `${jsonPath}.planner.targetRatePresets.fullPerMinute`,
            'expected positive number',
          );
        }
      }

      if (halfPerMinute !== undefined || fullPerMinute !== undefined) {
        targetRatePresets = {
          ...(halfPerMinute !== undefined ? { halfPerMinute } : {}),
          ...(fullPerMinute !== undefined ? { fullPerMinute } : {}),
        };
      }
    }

    if (targetRatePresets !== undefined) {
      out.planner = { targetRatePresets };
    }
  }

  if (isRecord(obj.imageProxy)) {
    const ip = obj.imageProxy;
    const enabledRaw = ip.enabled;
    if (enabledRaw !== undefined && typeof enabledRaw !== 'boolean') {
      throw new PackValidationError(`${jsonPath}.imageProxy.enabled`, 'expected boolean');
    }
    const urlTemplate = assertString(ip.urlTemplate, `${jsonPath}.imageProxy.urlTemplate`);
    const devUrlTemplate = assertOptionalString(
      ip.devUrlTemplate,
      `${jsonPath}.imageProxy.devUrlTemplate`,
    );
    const domainsRaw = assertOptionalArray(ip.domains, `${jsonPath}.imageProxy.domains`);
    const domains = domainsRaw?.map((v, i) =>
      assertString(v, `${jsonPath}.imageProxy.domains[${i}]`),
    );

    let tokenQuery: NonNullable<PackManifest['imageProxy']>['tokenQuery'];
    if (isRecord(ip.tokenQuery)) {
      const tq = ip.tokenQuery;
      const tqEnabledRaw = tq.enabled;
      if (tqEnabledRaw !== undefined && typeof tqEnabledRaw !== 'boolean') {
        throw new PackValidationError(
          `${jsonPath}.imageProxy.tokenQuery.enabled`,
          'expected boolean',
        );
      }
      const accessTokenStorageKey = assertOptionalString(
        tq.accessTokenStorageKey,
        `${jsonPath}.imageProxy.tokenQuery.accessTokenStorageKey`,
      );
      const anonymousTokenStorageKey = assertOptionalString(
        tq.anonymousTokenStorageKey,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenStorageKey`,
      );
      const frameworkTokenStorageKey = assertOptionalString(
        tq.frameworkTokenStorageKey,
        `${jsonPath}.imageProxy.tokenQuery.frameworkTokenStorageKey`,
      );
      const accessTokenParam = assertOptionalString(
        tq.accessTokenParam,
        `${jsonPath}.imageProxy.tokenQuery.accessTokenParam`,
      );
      const anonymousTokenParam = assertOptionalString(
        tq.anonymousTokenParam,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenParam`,
      );
      const frameworkTokenParam = assertOptionalString(
        tq.frameworkTokenParam,
        `${jsonPath}.imageProxy.tokenQuery.frameworkTokenParam`,
      );
      const anonymousTokenEndpoint = assertOptionalString(
        tq.anonymousTokenEndpoint,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenEndpoint`,
      );
      const anonymousTokenMethodRaw = assertOptionalString(
        tq.anonymousTokenMethod,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenMethod`,
      );
      const anonymousTokenMethod =
        anonymousTokenMethodRaw?.toUpperCase() === 'POST' ? 'POST' : 'GET';

      const headersRaw = assertOptionalRecord(
        tq.anonymousTokenHeaders,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenHeaders`,
      );
      let anonymousTokenHeaders: Record<string, string> | undefined;
      if (headersRaw !== undefined) {
        anonymousTokenHeaders = {};
        Object.keys(headersRaw).forEach((k) => {
          anonymousTokenHeaders![k] = assertString(
            headersRaw[k],
            `${jsonPath}.imageProxy.tokenQuery.anonymousTokenHeaders.${k}`,
          );
        });
      }

      const anonymousTokenRequestBody = assertOptionalRecord(
        tq.anonymousTokenRequestBody,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenRequestBody`,
      );
      const anonymousTokenResponsePath = assertOptionalString(
        tq.anonymousTokenResponsePath,
        `${jsonPath}.imageProxy.tokenQuery.anonymousTokenResponsePath`,
      );

      tokenQuery = {
        ...(tqEnabledRaw !== undefined ? { enabled: tqEnabledRaw } : {}),
        ...(accessTokenStorageKey !== undefined ? { accessTokenStorageKey } : {}),
        ...(anonymousTokenStorageKey !== undefined ? { anonymousTokenStorageKey } : {}),
        ...(frameworkTokenStorageKey !== undefined ? { frameworkTokenStorageKey } : {}),
        ...(accessTokenParam !== undefined ? { accessTokenParam } : {}),
        ...(anonymousTokenParam !== undefined ? { anonymousTokenParam } : {}),
        ...(frameworkTokenParam !== undefined ? { frameworkTokenParam } : {}),
        ...(anonymousTokenEndpoint !== undefined ? { anonymousTokenEndpoint } : {}),
        ...(anonymousTokenMethodRaw !== undefined ? { anonymousTokenMethod } : {}),
        ...(anonymousTokenHeaders !== undefined ? { anonymousTokenHeaders } : {}),
        ...(anonymousTokenRequestBody !== undefined ? { anonymousTokenRequestBody } : {}),
        ...(anonymousTokenResponsePath !== undefined ? { anonymousTokenResponsePath } : {}),
      };
    }

    out.imageProxy = {
      ...(enabledRaw !== undefined ? { enabled: enabledRaw } : {}),
      urlTemplate,
      ...(devUrlTemplate !== undefined ? { devUrlTemplate } : {}),
      ...(domains !== undefined ? { domains } : {}),
      ...(tokenQuery !== undefined ? { tokenQuery } : {}),
    };
  }

  return out;
}

function assertTagValue(
  value: unknown,
  jsonPath: string,
): string | { id: string; required?: boolean } {
  if (typeof value === 'string') return value;
  const obj = assertRecord(value, jsonPath);
  const id = assertString(obj.id, `${jsonPath}.id`);
  const required = obj.required;
  if (required !== undefined && typeof required !== 'boolean') {
    throw new PackValidationError(`${jsonPath}.required`, 'expected boolean');
  }
  return required === undefined ? { id } : { id, required };
}

function assertTagDef(value: unknown, jsonPath: string) {
  const obj = assertRecord(value, jsonPath);
  const replace = obj.replace;
  if (replace !== undefined && typeof replace !== 'boolean') {
    throw new PackValidationError(`${jsonPath}.replace`, 'expected boolean');
  }
  const valuesRaw = assertArray(obj.values, `${jsonPath}.values`);
  const values = valuesRaw.map((v, i) => assertTagValue(v, `${jsonPath}.values[${i}]`));
  const i18nRaw = obj.i18n;
  const result: Record<string, unknown> = { values };
  if (replace !== undefined) result.replace = replace;
  if (i18nRaw !== undefined && typeof i18nRaw === 'object' && i18nRaw !== null) {
    result.i18n = i18nRaw;
  }
  return result;
}

export function assertPackTags(value: unknown, jsonPath: string): PackTags {
  const obj = assertRecord(value, jsonPath);
  const itemRaw = obj.item;
  let item: Record<string, unknown> | undefined;
  if (itemRaw !== undefined) {
    const rec = assertRecord(itemRaw, `${jsonPath}.item`);
    item = {};
    Object.keys(rec).forEach((k) => {
      item![k] = assertTagDef(rec[k], `${jsonPath}.item.${k}`);
    });
  }
  const out: PackTags = {};
  if (item !== undefined) out.item = item as Record<string, TagDef>;
  return out;
}
