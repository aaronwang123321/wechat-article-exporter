<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-gray-900 dark:text-gray-100 font-bold">设置</h1>
    </Teleport>
    <div class="flex-1 overflow-scroll">
      <CredentialSetting />
      <ProxySetting />
      <DownloadSetting />
      <div class="h-[30vh]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
  title: '设置 | 微信公众号文章导出'
});
</script>
