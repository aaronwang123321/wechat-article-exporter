<template>
  <div>
    <header class="sticky top-0 z-20 flex-none px-5 py-2 border-b flex items-center justify-between antialiased">
      <div class="flex-auto flex flex-col sm:flex-row sm:items-center min-w-0">
        <div class="text-md mr-2 text-gray-900 dark:text-gray-100">当前选择公众号:</div>
        <div class="flex items-center">
          <span class="text-sky-400 font-semibold">{{ activeAccount?.nickname }}</span>
          <button @click="openSwitcher" title="切换"
                  class="flex rounded text-sm leading-6 py-1 px-3 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
            <span class="sr-only">切换</span>
            <ArrowRightLeft :size="20" />
          </button>
        </div>
<!--        <input type="file" @change="fileChange">-->
      </div>
      <div class="hidden space-x-5 lg:flex lg:items-center">
        <NuxtLink to="/dashboard/download"
                  class="font-semibold inline-flex items-center justify-center border select-none border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm h-8 px-3 rounded-md gap-1">
          数据导出
        </NuxtLink>
        <span class="text-gray-700 dark:text-gray-300 text-sm font-medium">隐藏已删除文章: </span>
        <UToggle v-model="hideDeleted" @change="toggleHideDeleted" />
        <BaseSearch v-model="articleQuery" @search="searchArticle" placeholder="搜索文章标题"/>
        <a href="https://github.com/jooooock/wechat-article-exporter" class="ml-6 block text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200" title="goto github">
          <span class="sr-only">Wechat Article Exporter on GitHub</span>
          <svg viewBox="0 0 16 16" class="size-8" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
        </a>
      </div>
      <div v-if="loginAccount" class="flex flex-col sm:flex-row items-center sm:space-x-2 ml-5">
        <img v-if="loginAccount.avatar" :src="loginAccount.avatar" alt="" class="rounded-full size-10">
        <span v-if="loginAccount.nickname" class="text-gray-900 dark:text-gray-100">{{loginAccount.nickname}}</span>
      </div>
    </header>

    <USlideover v-model="isOpen" side="left" :ui="{overlay: {background: 'bg-zinc-400/75'}}">
    <div
        class="rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow bg-white dark:bg-gray-900 flex flex-col flex-1 overflow-y-scroll">
      <div class="sticky top-0 bg-white py-4 px-2 shadow">
        <BaseSearch v-model="accountQuery" @search="searchAccount" required placeholder="搜索公众号名称或biz号码"/>
      </div>
      <div class="flex-1">
        <ul class="divide-y antialiased">
          <li v-for="account in accountList"
              :key="account.fakeid"
              class="flex items-center px-2 py-4 hover:bg-slate-50 hover:cursor-pointer"
              :class="{active: account.fakeid === activeAccount?.fakeid}"
              @click="selectAccount(account)"
          >
            <img v-if="account.type !== 'author'" class="size-20 mr-2" :src="account.round_head_img" alt="">
            <div class="flex-1">
              <div class="flex justify-between">
                <p class="font-semibold">{{ account.nickname }}</p>
                <p v-if="account.type !== 'author'" class="text-sky-500 font-medium">{{ ACCOUNT_TYPE[account.service_type] }}</p>
              </div>
              <p v-if="account.type !== 'author'" class="text-gray-500 text-sm">微信号: {{ account.alias || '未设置' }}</p>
              <p v-if="account.type !== 'author'" class="text-sm mt-2">{{ account.signature }}</p>
            </div>
          </li>
        </ul>

        <p v-if="loading" class="flex justify-center items-center my-2 py-2">
          <Loader :size="28" class="animate-spin text-slate-500"/>
        </p>
        <p v-else-if="noMoreData" class="text-center mt-2 py-2 text-slate-400">已全部加载完毕</p>
        <button
            v-else-if="accountList.length > 0"
            @click="loadData"
            class="block mx-auto my-2 h-10 px-6 font-semibold rounded-md border border-slate-200 text-slate-900 hover:border-slate-400"
            type="button"
        >
          下一页
        </button>
      </div>
    </div>
  </USlideover>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue';
import type {AccountInfo, AuthorInfo} from "../types/types";
import {Loader, ArrowRightLeft} from "lucide-vue-next";
import {packHTMLAssets} from "../utils";
import {ACCOUNT_LIST_PAGE_SIZE, ACCOUNT_TYPE} from "../config";
import {getAccountList} from "../apis";

// 声明 Nuxt 全局函数的类型
declare const useLoginAccount: () => any;
declare const useActiveAccount: () => any;
declare const navigateTo: (to: string) => void;


const loginAccount = useLoginAccount()
const activeAccount = useActiveAccount()

const emit = defineEmits(['select:account', 'search:article', 'toggle:deleted'])

const hideDeleted = ref(false)
const isOpen = ref(false)

function openSwitcher() {
  isOpen.value = true
  if (activeAccount.value?.type === 'author') {
    accountQuery.value = activeAccount.value?.fakeid!
  } else {
    accountQuery.value = activeAccount.value?.nickname!
  }
}

const accountQuery = ref('')
const accountList = reactive<(AccountInfo | AuthorInfo)[]>([])
let begin = 0

/**
 * 搜索公众号
 */
async function searchAccount() {
  begin = 0
  accountList.length = 0
  noMoreData.value = false

  await loadData()
}

const loading = ref(false)
const noMoreData = ref(false)

/**
 * 加载公众号数据
 */
async function loadData() {
  loading.value = true

  try {
    const [accounts, completed] = await getAccountList(loginAccount.value.token, begin, accountQuery.value)
    accountList.push(...accounts)
    begin += ACCOUNT_LIST_PAGE_SIZE
    noMoreData.value = completed
  } catch (e: any) {
    alert(e.message)
    console.error(e)
    if (e.message === 'session expired') {
      navigateTo('/login')
    }
  } finally {
    loading.value = false
  }
}


/**
 * 选择公众号
 * @param account
 */
function selectAccount(account: AccountInfo | AuthorInfo) {
  isOpen.value = false
  activeAccount.value = account

  nextTick(() => {
    emit('select:account', account)
  })
}


const articleQuery = ref('')

/**
 * 搜索文章
 */
function searchArticle() {
  if (!activeAccount.value) {
    alert('请先选择公众号')
    return
  }

  emit('search:article', articleQuery.value)
}

function toggleHideDeleted(value: boolean) {
  emit('toggle:deleted', value)
}

// 为了调试
function fileChange(evt: Event) {
  const files = (evt.target as HTMLInputElement).files!
  if (files.length > 0) {
    const file = files[0]

    const reader = new FileReader()
    reader.addEventListener('load', async (event: Event) => {
      const html = reader.result as string

      debugger

      await packHTMLAssets(html, 'title')
    })
    reader.readAsText(file)
  }
}
</script>
