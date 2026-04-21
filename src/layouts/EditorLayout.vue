<template>
  <q-layout view="hHh Lpr lff">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title :class="$q.dark.isActive ? 'text-white' : 'text-grey-9'"
          >JEI Web Editor</q-toolbar-title
        >

        <q-chip
          v-if="packStore.currentEntry"
          dense
          square
          color="grey-8"
          text-color="white"
          class="q-ml-sm"
        >
          {{ packStore.currentEntry.name }}
        </q-chip>

        <q-space />

        <q-btn flat dense icon="inventory_2" to="/editor/packs" label="Packs" />
        <q-btn
          flat
          dense
          icon="save"
          label="Save"
          :disable="!packStore.currentId || !hasChanges"
          @click="saveToExisting"
        />
        <q-btn flat dense icon="save_as" label="Save As" @click="saveAs" />
        <q-btn
          flat
          dense
          icon="difference"
          :disable="!hasChanges"
          :label="`Diff ${changedCount}`"
          @click="showChanges = true"
        >
          <q-badge v-if="stagedCount" color="positive" floating>{{ stagedCount }}</q-badge>
        </q-btn>

        <q-btn flat dense round icon="home" to="/" label="Back to App" />

        <q-btn
          flat
          dense
          no-caps
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          @click="showQQGroupDialog"
        >
          <q-icon name="group" class="q-mr-xs" />
          <span>官方QQ群：1080814651</span>
        </q-btn>

        <q-btn
          flat
          dense
          round
          :class="$q.dark.isActive ? 'text-white' : 'text-grey-8'"
          aria-label="Theme"
        >
          <q-icon :name="themeIcon" />
          <q-menu>
            <q-list style="min-width: 120px">
              <q-item
                clickable
                :active="settingsStore.darkMode === 'auto'"
                @click="setTheme('auto')"
              >
                <q-item-section avatar>
                  <q-icon name="brightness_4" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>自动</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                :active="settingsStore.darkMode === 'light'"
                @click="setTheme('light')"
              >
                <q-item-section avatar>
                  <q-icon name="light_mode" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>亮色</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                :active="settingsStore.darkMode === 'dark'"
                @click="setTheme('dark')"
              >
                <q-item-section avatar>
                  <q-icon name="dark_mode" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>暗色</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header>Editor</q-item-label>

        <q-item to="/editor" exact clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="dashboard" />
          </q-item-section>
          <q-item-section>Dashboard</q-item-section>
        </q-item>

        <q-item to="/editor/items" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="category" />
          </q-item-section>
          <q-item-section>Items</q-item-section>
        </q-item>

        <q-item to="/editor/types" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="build" />
          </q-item-section>
          <q-item-section>Recipe Types</q-item-section>
        </q-item>

        <q-item to="/editor/recipes" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="receipt" />
          </q-item-section>
          <q-item-section>Recipes</q-item-section>
        </q-item>

        <q-item to="/editor/tags" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="label" />
          </q-item-section>
          <q-item-section>Tags</q-item-section>
        </q-item>

        <q-item to="/editor/assets" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="image" />
          </q-item-section>
          <q-item-section>Assets</q-item-section>
        </q-item>

        <q-item to="/editor/packs" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="inventory_2" />
          </q-item-section>
          <q-item-section>Packs</q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <q-item-label header>Routes</q-item-label>

        <q-item to="/" exact clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="home" />
          </q-item-section>
          <q-item-section>Home</q-item-section>
        </q-item>

        <q-item to="/editor" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="edit" />
          </q-item-section>
          <q-item-section>Editor</q-item-section>
        </q-item>

        <q-item to="/readme" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="description" />
          </q-item-section>
          <q-item-section>README</q-item-section>
        </q-item>

        <q-item to="/about" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="info" />
          </q-item-section>
          <q-item-section>About</q-item-section>
        </q-item>

        <q-item
          clickable
          tag="a"
          target="_blank"
          href="https://github.com/AndreaFrederica/jei-web"
          v-ripple
        >
          <q-item-section avatar>
            <q-icon name="code" />
          </q-item-section>
          <q-item-section>GitHub</q-item-section>
        </q-item>

        <q-item clickable tag="a" target="_blank" href="https://blog.sirrus.cc" v-ripple>
          <q-item-section avatar>
            <q-icon name="article" />
          </q-item-section>
          <q-item-section>Blog</q-item-section>
        </q-item>

        <q-item clickable tag="a" target="_blank" href="https://wiki.sirrus.cc" v-ripple>
          <q-item-section avatar>
            <q-icon name="menu_book" />
          </q-item-section>
          <q-item-section>Wiki</q-item-section>
        </q-item>

        <q-item clickable tag="a" target="_blank" href="https://anh.sirrus.cc" v-ripple>
          <q-item-section avatar>
            <q-icon name="auto_stories" />
          </q-item-section>
          <q-item-section>小说助手</q-item-section>
        </q-item>

        <q-item to="/license" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="gavel" />
          </q-item-section>
          <q-item-section>License</q-item-section>
        </q-item>

        <q-item to="/third-party-licenses" clickable v-ripple>
          <q-item-section avatar>
            <q-icon name="assignment" />
          </q-item-section>
          <q-item-section>Third-Party Licenses</q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <q-item-label header>资料链接</q-item-label>

        <q-item clickable tag="a" target="_blank" href="https://warfarin.wiki" v-ripple>
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Warfarin Wiki</q-item-label>
            <q-item-label caption>第三方 Wiki</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable tag="a" target="_blank" href="https://wiki.skland.com/endfield" v-ripple>
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Skland Wiki</q-item-label>
            <q-item-label caption>Hypergryph</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <q-item-label header>友情链接</q-item-label>

        <q-item clickable tag="a" target="_blank" href="https://www.gamekee.com/zmd" v-ripple>
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>明日方舟:终末地非官方Wiki</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable tag="a" target="_blank" href="https://end.shallow.ink/">
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>终末地-协议终端</q-item-label>
            <q-item-label caption>熵增项目组</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable tag="a" target="_blank" href="https://bot.perlica.tech/" v-ripple>
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Perlica Bot</q-item-label>
            <q-item-label caption>Origin Technology</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <q-item-label header>工具链接</q-item-label>

        <q-item clickable tag="a" target="_blank" href="https://end.canmoe.com/" v-ripple>
          <q-item-section avatar>
            <q-icon name="link" />
          </q-item-section>
          <q-item-section>
            <q-item-label>终末地基质规划器</q-item-label>
            <q-item-label caption>璨梦踏月</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator class="q-my-sm" />

        <q-item-label header>官方QQ群</q-item-label>

        <q-item
          clickable
          tag="a"
          target="_blank"
          href="https://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=zqJY9RCCW3Hs2dH_745AoKSGkd6ME0qM&authKey=f5TTWw4D3XWrz%2B3y%2FB%2BDntQY4gRUOgNz9fsIQ5umYUzXZdAyg7rqIm2z%2B2tU39RB&noverify=0&group_code=1080814651"
          v-ripple
        >
          <q-item-section avatar>
            <q-icon name="group" />
          </q-item-section>
          <q-item-section>
            <q-item-label>官方QQ群:1080814651</q-item-label>
            <q-item-label caption>JEI Web官方群</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <QQGroupDialog v-model:visible="qqGroupDialogVisible" />

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-dialog v-model="showChanges">
      <q-card style="min-width: min(1100px, 95vw); max-width: 95vw">
        <q-toolbar>
          <q-toolbar-title>Changes</q-toolbar-title>
          <q-space />
          <q-btn flat dense icon="checklist" label="Accept All" @click="editorStore.acceptAll" />
          <q-btn
            flat
            dense
            icon="undo"
            label="Undo All"
            color="negative"
            @click="editorStore.undoAll"
          />
          <q-btn flat dense icon="close" v-close-popup />
        </q-toolbar>
        <q-separator />

        <q-card-section v-if="!hasChanges" class="text-grey">No changes</q-card-section>
        <q-list v-else bordered separator>
          <q-expansion-item
            v-for="block in editorStore.changeBlocks"
            :key="block.key"
            expand-separator
          >
            <template #header>
              <q-item-section>
                <q-item-label>{{ block.title }}</q-item-label>
                <q-item-label v-if="block.accepted" caption>Staged</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-sm">
                  <q-btn
                    size="sm"
                    flat
                    color="positive"
                    icon="check"
                    :disable="block.accepted"
                    @click.stop="editorStore.acceptBlock(block.key)"
                  />
                  <q-btn
                    size="sm"
                    flat
                    color="negative"
                    icon="undo"
                    @click.stop="editorStore.undoBlock(block.key)"
                  />
                </div>
              </q-item-section>
            </template>

            <q-card>
              <q-card-section>
                <div class="diff-head text-caption text-grey">
                  <div class="diff-head__left">Before</div>
                  <div class="diff-head__right">After</div>
                </div>
                <div class="diff-scroll">
                  <div class="diff-grid">
                    <template v-for="row in diffRowsByKey.get(block.key) || []" :key="row.key">
                      <div class="diff-ln diff-ln--left" :class="row.leftClass">
                        {{ row.leftNoText }}
                      </div>
                      <div class="diff-code diff-code--left" :class="row.leftClass">
                        <span class="diff-text">{{ row.leftLine }}</span>
                      </div>
                      <div class="diff-divider"></div>
                      <div class="diff-ln diff-ln--right" :class="row.rightClass">
                        {{ row.rightNoText }}
                      </div>
                      <div class="diff-code diff-code--right" :class="row.rightClass">
                        <span class="diff-text">{{ row.rightLine }}</span>
                      </div>
                    </template>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>
        </q-list>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore, type DarkMode } from 'src/stores/settings';
import { Dark, useQuasar } from 'quasar';
import { useEditorStore } from 'src/stores/editor';
import { usePackManagerStore } from 'src/stores/packManager';
import QQGroupDialog from 'components/QQGroupDialog.vue';

const settingsStore = useSettingsStore();
const editorStore = useEditorStore();
const packStore = usePackManagerStore();
const $q = useQuasar();
const leftDrawerOpen = ref(false);
const showChanges = ref(false);
const qqGroupDialogVisible = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function showQQGroupDialog() {
  qqGroupDialogVisible.value = true;
}

const hasChanges = computed(() => editorStore.changeBlocks.length > 0);
const changedCount = computed(() => editorStore.changeBlocks.length);
const stagedCount = computed(() => editorStore.changeBlocks.filter((b) => b.accepted).length);

type DiffOp = { kind: 'equal' | 'insert' | 'delete'; line: string };
type DiffRow = {
  key: string;
  leftNoText: string;
  rightNoText: string;
  leftLine: string;
  rightLine: string;
  leftClass: string;
  rightClass: string;
};

function splitLines(text: string): string[] {
  return text.split('\n');
}

function myersDiffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  let v = new Array<number>(2 * max + 1).fill(0);
  const trace: number[][] = [];

  for (let d = 0; d <= max; d += 1) {
    const vNext = v.slice();
    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + offset;
      const x =
        k === -d || (k !== d && v[kIdx - 1]! < v[kIdx + 1]!) ? v[kIdx + 1]! : v[kIdx - 1]! + 1;
      let x2 = x;
      let y2 = x2 - k;
      while (x2 < n && y2 < m && a[x2] === b[y2]) {
        x2 += 1;
        y2 += 1;
      }
      vNext[kIdx] = x2;
      if (x2 >= n && y2 >= m) {
        trace.push(vNext);
        let backX = n;
        let backY = m;
        const ops: DiffOp[] = [];
        for (let bt = trace.length - 1; bt > 0; bt -= 1) {
          const d2 = bt;
          const vPrev = trace[bt - 1]!;
          const kk = backX - backY;
          const kkIdx = kk + offset;
          const prevK =
            kk === -d2 || (kk !== d2 && vPrev[kkIdx - 1]! < vPrev[kkIdx + 1]!) ? kk + 1 : kk - 1;
          const prevX = vPrev[prevK + offset]!;
          const prevY = prevX - prevK;

          while (backX > prevX && backY > prevY) {
            ops.unshift({ kind: 'equal', line: a[backX - 1]! });
            backX -= 1;
            backY -= 1;
          }

          if (backX === prevX) {
            ops.unshift({ kind: 'insert', line: b[prevY]! });
          } else {
            ops.unshift({ kind: 'delete', line: a[prevX]! });
          }
          backX = prevX;
          backY = prevY;
        }

        while (backX > 0 && backY > 0 && a[backX - 1] === b[backY - 1]) {
          ops.unshift({ kind: 'equal', line: a[backX - 1]! });
          backX -= 1;
          backY -= 1;
        }
        while (backX > 0) {
          ops.unshift({ kind: 'delete', line: a[backX - 1]! });
          backX -= 1;
        }
        while (backY > 0) {
          ops.unshift({ kind: 'insert', line: b[backY - 1]! });
          backY -= 1;
        }

        return ops;
      }
    }
    trace.push(vNext);
    v = vNext;
  }

  return [
    ...a.map((line): DiffOp => ({ kind: 'delete', line })),
    ...b.map((line): DiffOp => ({ kind: 'insert', line })),
  ];
}

function toDiffRows(before: string, after: string): DiffRow[] {
  const ops = myersDiffLines(splitLines(before), splitLines(after));
  let leftNo = 0;
  let rightNo = 0;
  const rows: DiffRow[] = [];

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i]!;
    const key = `${i}`;
    if (op.kind === 'equal') {
      leftNo += 1;
      rightNo += 1;
      rows.push({
        key,
        leftNoText: String(leftNo),
        rightNoText: String(rightNo),
        leftLine: op.line,
        rightLine: op.line,
        leftClass: '',
        rightClass: '',
      });
    } else if (op.kind === 'delete') {
      leftNo += 1;
      rows.push({
        key,
        leftNoText: String(leftNo),
        rightNoText: '',
        leftLine: op.line,
        rightLine: '',
        leftClass: 'diff-del',
        rightClass: '',
      });
    } else {
      rightNo += 1;
      rows.push({
        key,
        leftNoText: '',
        rightNoText: String(rightNo),
        leftLine: '',
        rightLine: op.line,
        leftClass: '',
        rightClass: 'diff-ins',
      });
    }
  }

  return rows;
}

const diffRowsByKey = computed(() => {
  const out = new Map<string, DiffRow[]>();
  editorStore.changeBlocks.forEach((b) => {
    out.set(b.key, toDiffRows(b.before, b.after));
  });
  return out;
});

const themeIcon = computed(() => {
  if (settingsStore.darkMode === 'auto') {
    return Dark.isActive ? 'dark_mode' : 'light_mode';
  }
  return settingsStore.darkMode === 'dark' ? 'dark_mode' : 'light_mode';
});

function setTheme(mode: DarkMode) {
  settingsStore.setDarkMode(mode);
}

function saveToExisting() {
  void packStore.saveToExisting().catch((e) => {
    $q.notify({ type: 'negative', message: String(e) });
  });
}

function saveAs() {
  $q.dialog({
    title: 'Save As',
    message: 'Local pack name',
    prompt: { model: editorStore.manifest.displayName || editorStore.manifest.packId || 'Pack' },
    cancel: true,
    persistent: true,
  }).onOk((name) => {
    void packStore.saveAs(String(name)).catch((e) => {
      $q.notify({ type: 'negative', message: String(e) });
    });
  });
}
</script>

<style scoped>
.diff-head {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 1px 52px minmax(0, 1fr);
  margin-bottom: 6px;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  line-height: 18px;
}

.diff-head__left {
  grid-column: 1 / span 2;
  padding: 0 10px;
}

.diff-head__right {
  grid-column: 4 / span 2;
  padding: 0 10px;
}

.diff-scroll {
  max-height: 55vh;
  overflow: auto;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.diff-grid {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 1px 52px minmax(0, 1fr);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  line-height: 18px;
}

.diff-divider {
  background: rgba(0, 0, 0, 0.12);
}

.diff-ln,
.diff-code {
  padding: 0 10px;
  white-space: pre;
}

.diff-ln {
  color: rgba(0, 0, 0, 0.5);
  user-select: none;
  text-align: right;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.diff-code {
  overflow: hidden;
}

.diff-text {
  white-space: pre;
}

.diff-del {
  background: rgba(255, 0, 0, 0.12);
}

.diff-ins {
  background: rgba(0, 200, 83, 0.12);
}
</style>
