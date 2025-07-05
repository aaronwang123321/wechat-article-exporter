<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-gray-900 dark:text-gray-100 font-bold">缓存分析</h1>
    </Teleport>
    <div class="flex flex-1 p-6 overflow-scroll">
      <p>本地数据库占用约为 <span class="text-rose-500">{{usage}}</span></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHead } from '@unhead/vue'

useHead({
  title: '缓存分析 | 微信公众号文章导出'
});

const usage = ref('')

async function init() {
  const storageUsage = await navigator.storage.estimate()
  const indexedSize = (storageUsage.usage! / 1024 / 1024).toFixed(2)
  usage.value = indexedSize + 'M'
}

onMounted(() => {
  init()
})
</script>
