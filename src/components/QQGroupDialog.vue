<template>
  <q-dialog :model-value="visible" @update:model-value="onClose">
    <q-card>
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
      </q-card-section>

      <q-card-section>
        <p>{{ t('qqGroupOfficial') }}</p>
        <p>
          {{ t('qqGroupDescription') }}
        </p>
        <p>
          中国大陆访问镜像由 Mic 提供，地址为https://jei.mic.run
          <br />
          或者您可以通过https://cnjeiweb.sirrus.cc来转跳访问，
          <br />
          CloudFlare源：https://jeiweb.sirrus.cc
          <br />
          EdgeOne亚太源: https://fastjeiweb.sirrus.cc
          <br />
          Edgeone全球版（由Arcwolf提供）：https://jei.arcwolf.top
        </p>
        <p>
          {{ t('downloadClient') }}
          <br />
          https://github.com/AndreaFrederica/JEIWebBrowser/releases
          <br />
          {{ t('findSource') }}
          <br />
          https://github.com/AndreaFrederica/jei-web
          <br />
          {{ t('circuitPuzzleNote') }}
          <br />
          {{ t('puzzleCollectionNote') }}
        </p>
        <p class="text-grey text-caption q-mt-md">
          {{ t('disclaimer') }}
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          v-if="showDontShowAgain"
          flat
          :label="t('dontShowAgain')"
          color="grey"
          @click="handleDontShowAgain"
        />
        <q-btn flat :label="t('close')" color="primary" @click="handleClose" />
        <q-btn flat :label="t('joinGroup')" color="primary" @click="handleJoin" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const QQ_GROUP_JOIN_URL =
  'https://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=zqJY9RCCW3Hs2dH_745AoKSGkd6ME0qM&authKey=f5TTWw4D3XWrz%2B3y%2FB%2BDntQY4gRUOgNz9fsIQ5umYUzXZdAyg7rqIm2z%2B2tU39RB&noverify=0&group_code=1080814651';

interface Props {
  visible?: boolean;
  title?: string;
  showDontShowAgain?: boolean;
  managed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  title: 'JEI Web 官方 QQ 群',
  showDontShowAgain: false,
  managed: false,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  close: [dontShowAgain: boolean];
  join: [];
}>();

function handleClose() {
  emit('close', false);
  if (!props.managed) {
    emit('update:visible', false);
  }
}

function handleDontShowAgain() {
  emit('close', true);
  if (!props.managed) {
    emit('update:visible', false);
  }
}

function handleJoin() {
  window.open(QQ_GROUP_JOIN_URL, '_blank');
  emit('close', false);
  emit('join');
  if (!props.managed) {
    emit('update:visible', false);
  }
}

function onClose(value: boolean) {
  if (!value) {
    emit('close', false);
    if (!props.managed) {
      emit('update:visible', false);
    }
  }
}
</script>
