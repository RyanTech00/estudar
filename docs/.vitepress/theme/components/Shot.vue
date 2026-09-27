<script setup lang="ts">
// Screenshot with a caption. Phone shots render narrow and centred; desktop shots fill the column.
import { withBase } from 'vitepress'

defineProps<{ src: string; alt: string; caption?: string; wide?: boolean }>()
</script>

<template>
  <figure class="shot" :class="{ wide }">
    <img :src="withBase(src)" :alt="alt" loading="lazy" />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>
