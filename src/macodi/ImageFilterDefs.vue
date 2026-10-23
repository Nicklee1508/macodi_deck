<template>
  <!-- 그림 서식의 선명도·색 온도용 SVG 필터 — 화면·썸네일·슬라이드쇼·PDF·PPTX 굽기에서 url(#id) 로 참조 -->
  <svg id="mcd-image-filter-defs" width="0" height="0" style="position: absolute; width: 0; height: 0; overflow: hidden" aria-hidden="true">
    <defs>
      <filter v-for="s in SHARP_STEPS" :id="sharpId(s)" :key="'s' + s" color-interpolation-filters="sRGB">
        <feConvolveMatrix order="3" :kernelMatrix="sharpKernel(s)" preserveAlpha="true" edgeMode="duplicate" />
      </filter>
      <filter v-for="t in TEMP_STEPS" :id="tempId(t)" :key="'t' + t" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" :values="tempMatrix(t)" />
      </filter>
    </defs>
  </svg>
</template>

<script lang="ts" setup>
import { SHARP_STEPS, TEMP_STEPS, sharpId, sharpKernel, tempId, tempMatrix } from './imageEffects'
</script>
