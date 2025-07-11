<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-gray-900 dark:text-gray-100 font-bold">文章导出 <span class="text-sm text-gray-600 dark:text-gray-400">导出本地已缓存的文章</span>
      </h1>
    </Teleport>
    <div class="flex flex-1 overflow-hidden">

      <!-- 公众号列表 -->
      <ul class="flex flex-col h-full w-fit overflow-y-scroll divide-y divide-gray-200 dark:divide-gray-700">
        <li v-for="accountInfo in sortedAccountInfos" :key="accountInfo.fakeid"
            class="relative px-4 pr-16 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 hover:cursor-pointer transition text-gray-900 dark:text-gray-100"
            :class="{'bg-gray-100 dark:bg-gray-800': selectedAccount === accountInfo.fakeid}" @click="toggleSelectedAccount(accountInfo)">
          <p>公众号:
            <span v-if="accountInfo.nickname" class="text-xl font-medium">{{ accountInfo.nickname }}</span>
          </p>
          <p>ID: <span class="font-mono">{{ accountInfo.fakeid }}</span></p>
          <UBadge variant="subtle" color="green" class="absolute top-4 right-2">{{ accountInfo.articles }}</UBadge>
        </li>
      </ul>

      <!-- 文章列表 -->
      <main class="flex-1 h-full overflow-y-scroll">
        <div v-if="loading" class="flex justify-center items-center mt-5">
          <Loader :size="28" class="animate-spin text-slate-500"/>
        </div>
        <div class="relative" v-else-if="selectedAccount">
          <div class="sticky top-0 z-50 bg-white dark:bg-gray-900 flex justify-between items-center px-4 h-[40px] text-gray-900 dark:text-gray-100">
            <div class="flex items-center space-x-4">
              <span>过滤条件:</span>
              <UInput v-model="query.title" placeholder="请输入标题过滤" color="blue"/>

              <UPopover :popper="{ placement: 'bottom-start' }">
                <UButton icon="i-heroicons-calendar-days-20-solid" color="gray">
                  {{ format(query.dateRange.start, 'yyyy-MM-dd') }} - {{ format(query.dateRange.end, 'yyyy-MM-dd') }}
                </UButton>

                <template #panel="{ close }">
                  <div class="flex items-center sm:divide-x divide-gray-200 dark:divide-gray-800">
                    <div class="hidden sm:flex flex-col py-4">
                      <UButton
                          v-for="(range, index) in ranges"
                          :key="index"
                          :label="range.label"
                          color="gray"
                          variant="ghost"
                          class="rounded-none px-6"
                          :class="[isRangeSelected(range.duration) ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50']"
                          truncate
                          @click="selectRange(range.duration)"
                      />
                    </div>

                    <DatePicker v-model="query.dateRange" @close="close"/>
                  </div>
                </template>
              </UPopover>

              <USelectMenu class="w-40" color="blue" v-model="query.authors" :options="articleAuthors" multiple
                           placeholder="选择作者"/>

              <USelect v-model="query.isOriginal" :options="originalOptions" color="blue"/>

              <USelectMenu class="w-40" color="blue" v-model="query.albums" :options="articleAlbums" multiple
                           placeholder="选择合集"/>

              <UButton color="gray" variant="solid" @click="search">搜索</UButton>
            </div>
            <div class="space-x-2">
              <UButton color="black" variant="solid" class="disabled:bg-slate-4 disabled:text-slate-12"
                       :disabled="selectedArticles.length === 0 || excelBtnLoading" @click="excelExport">导出Excel
              </UButton>
              <UButton color="black" variant="solid" class="disabled:bg-slate-4 disabled:text-slate-12"
                       :disabled="selectedArticles.length === 0 || batchDownloadLoading" @click="doBatchDownload">
                <Loader v-if="batchDownloadLoading" :size="20" class="animate-spin"/>
                <span v-if="batchDownloadLoading">{{ batchDownloadPhase }}:
                  <span
                      v-if="batchDownloadPhase === '下载文章内容'">{{ batchDownloadedCount }}/{{
                      selectedArticleCount
                    }}</span>
                  <span
                      v-if="batchDownloadPhase === '打包'">{{ batchPackedCount }}/{{ batchDownloadedCount }}</span>
                </span>
                <span v-else>普通批量下载</span>
              </UButton>
              <UButton color="blue" variant="solid" @click="showAutoBatchDownloader = !showAutoBatchDownloader">
                <UIcon name="i-heroicons-cpu-chip" class="w-4 h-4 mr-2"/>
                <span>智能分批下载</span>
              </UButton>
            </div>
          </div>
          <table class="w-full border-collapse">
            <thead class="sticky top-[40px] z-10 h-[40px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <tr>
              <th>
                <UCheckbox class="justify-center" :indeterminate="isIndeterminate" v-model="checkAll"
                           @change="onCheckAllChange" color="blue"/>
              </th>
              <th class="w-14">序号</th>
              <th>标题</th>
              <th class="w-52">发布日期</th>
              <th>作者</th>
              <th class="w-24">是否原创</th>
              <th class="w-36">所属合集</th>
              <th class="w-12">原文</th>
            </tr>
            </thead>
            <tbody class="text-gray-900 dark:text-gray-100">
            <tr v-for="(article, index) in displayedArticles" :key="article.aid" class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="text-center" @click="toggleArticleCheck(article)">
                <UCheckbox class="justify-center" v-model="article.checked" color="blue"/>
              </td>
              <td class="text-center font-mono">{{ index + 1 }}</td>
              <td class="px-4 font-mono">{{ maxLen(article.title) }}</td>
              <td class="text-center font-mono">{{ formatTimeStamp(article.update_time) }}</td>
              <td class="text-center">{{ article.author_name }}</td>
              <td class="text-center">{{ article.copyright_stat === 1 && article.copyright_type === 1 ? '原创' : '' }}
              </td>
              <td>
                <p class="flex flex-wrap">
                  <span v-for="album in article.appmsg_album_infos" :key="album.id"
                        class="text-blue-600 dark:text-blue-400 mr-2">#{{ album.title }}</span>
                </p>
              </td>
              <td class="text-center">
                <a class="text-blue-500 dark:text-blue-400 underline" :href="article.link" target="_blank">
                  <UIcon name="i-heroicons-link-16-solid" class="w-5 h-5"/>
                </a>
              </td>
            </tr>
            </tbody>
          </table>
          <!-- 状态栏 -->
          <div class="sticky bottom-0 h-[40px] bg-white dark:bg-gray-900 flex items-center px-4 space-x-10 border-t-2 border-gray-200 dark:border-gray-700 font-mono">
            <span class="text-green-500 dark:text-green-400">已选 {{ selectedArticles.length }} / {{ displayedArticles.length }}</span>
            <span class="text-rose-400 dark:text-rose-400"
                  v-if="deletedArticlesCount > 0">已隐藏 {{ deletedArticlesCount }} 条删除文章</span>
          </div>
        </div>
      </main>

      <!-- 智能分批下载组件 -->
      <div v-if="showAutoBatchDownloader" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div class="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">智能分批下载管理器</h2>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="showAutoBatchDownloader = false"
            />
          </div>

          <div class="p-6">
            <AutoBatchDownloader
              :selected-articles="downloadableSelectedArticles"
              :filename="selectedAccountName"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import {getAllInfo, type Info} from '../../store/info'
import {getArticleCache} from "../../store/article";
import type {AppMsgEx, DownloadableArticle} from "../../types/types";
import {formatTimeStamp} from "../../utils";
import {Loader} from "lucide-vue-next";
import {sleep} from "@antfu/utils";
import {type Duration, format, isSameDay, sub} from 'date-fns'
import {useBatchDownload} from "../../composables/useBatchDownload";
import ExcelJS from "exceljs";
import {saveAs} from 'file-saver'


interface Article {
  checked: boolean
  display: boolean
  title: string
  link: string
  update_time: number
  author_name: string
  copyright_stat?: number
  copyright_type?: number
  appmsg_album_infos: Array<{ id: string; title: string }>
  aid: string
  digest: string
  cover_img?: string
  cover?: string
  pic_cdn_url_235_1?: string
  pic_cdn_url_16_9?: string
  pic_cdn_url_3_4?: string
  pic_cdn_url_1_1?: string
  is_deleted?: boolean
}

useHead({
  title: '数据导出 | 微信公众号文章导出'
})

// 已缓存的公众号信息
const cachedAccountInfos = ref<Info[]>([])
const sortedAccountInfos = computed(() => {
  const sorted = [...cachedAccountInfos.value]
  sorted.sort((a, b) => {
    return a.articles > b.articles ? -1 : 1
  })
  return sorted
})

// 异步加载数据
onMounted(async () => {
  cachedAccountInfos.value = await getAllInfo()
})

const selectedAccount = ref('')
const selectedAccountName = ref('')

// 智能分批下载器状态
const showAutoBatchDownloader = ref(false)

async function toggleSelectedAccount(info: Info) {
  if (info.fakeid !== selectedAccount.value) {
    selectedAccount.value = info.fakeid
    selectedAccountName.value = info.nickname || info.fakeid
    switchTableData(info.fakeid).catch(() => {
    })
  }
}

const articles = reactive<Article[]>([])
const loading = ref(false)

const checkAll = ref(false)
const isIndeterminate = ref(false)

const displayedArticles = computed(() => {
  return articles.filter(article => article.display)
})
const selectedArticles = computed(() => {
  return articles.filter(article => article.checked && article.display)
})

// 转换为可下载的文章格式
const downloadableSelectedArticles = computed(() => {
  return selectedArticles.value.map(article => ({
    title: article.title,
    url: article.link,
    date: +article.update_time
  }))
})
const deletedArticlesCount = ref(0)

async function switchTableData(fakeid: string) {
  checkAll.value = false
  isIndeterminate.value = false

  loading.value = true
  articles.length = 0
  const data = await getArticleCache(fakeid, Date.now())
  deletedArticlesCount.value = data.filter(article => article.is_deleted).length
  articles.push(...data.filter(article => !article.is_deleted).map(article => ({
    ...article,
    checked: false,
    display: true,
    author_name: article.author_name || '--',
  })))
  await sleep(500)
  loading.value = false

  query.title = ''
  query.authors = []
  query.isOriginal = '所有'
  query.dateRange = {
    start: new Date(articles[articles.length - 1].update_time * 1000),
    end: new Date(),
  }
}

function maxLen(text: string, max = 35): string {
  if (text.length > max) {
    return text.slice(0, max) + '...'
  }
  return text
}

function toggleArticleCheck(article: Article) {
  article.checked = !article.checked

  if (articles.every(article => article.checked)) {
    // 全部选中
    checkAll.value = true
    isIndeterminate.value = false
  } else if (articles.every(article => !article.checked)) {
    // 全部取消选中
    checkAll.value = false
    isIndeterminate.value = false
  } else {
    //
    isIndeterminate.value = true
    checkAll.value = false
  }
}

function onCheckAllChange() {
  if (checkAll.value) {
    articles.forEach(article => {
      article.checked = true
      isIndeterminate.value = false
    })
  } else {
    articles.forEach(article => {
      article.checked = false
      isIndeterminate.value = false
    })
  }
}

const articleAuthors = computed(() => {
  return [...new Set(articles.map(article => article.author_name).filter(author => !!author))]
})
const articleAlbums = computed(() => {
  return [...new Set(articles.flatMap((article: Article) => article.appmsg_album_infos).map(album => album.title))]
})

function isRangeSelected(duration: Duration) {
  return isSameDay(query.dateRange.start, sub(new Date(), duration)) && isSameDay(query.dateRange.end, new Date())
}

function selectRange(duration: Duration) {
  query.dateRange = {start: sub(new Date(), duration), end: new Date()}
}

const ranges = [
  {label: '最近7天', duration: {days: 7}},
  {label: '最近14天', duration: {days: 14}},
  {label: '最近30天', duration: {days: 30}},
  {label: '最近3个月', duration: {months: 3}},
  {label: '最近6个月', duration: {months: 6}},
  {label: '最近1年', duration: {years: 1}},
  {label: '最近3年', duration: {years: 3}},
  {label: '最近5年', duration: {years: 5}},
  {label: '所有', duration: {years: 20}},
]
const originalOptions = ['原创', '非原创', '所有']

interface ArticleQuery {
  title: string
  dateRange: { start: Date, end: Date }
  authors: string[]
  isOriginal: '原创' | '非原创' | '所有'
  albums: string[]
}

const query = reactive<ArticleQuery>({
  title: '',
  dateRange: {start: sub(new Date(), {days: 14}), end: new Date()},
  authors: [],
  isOriginal: '所有',
  albums: [],
})

function search() {
  checkAll.value = false
  isIndeterminate.value = false

  articles.forEach(article => {
    article.display = true
    article.checked = false

    if (query.title && !article.title.includes(query.title)) {
      article.display = false
    }
    if (query.authors.length > 0 && !query.authors.includes(article.author_name)) {
      article.display = false
    }
    if (query.isOriginal === '原创' && (article.copyright_stat !== 1 || article.copyright_type !== 1)) {
      article.display = false
    }
    if (query.isOriginal === '非原创' && (article.copyright_stat === 1 && article.copyright_type === 1)) {
      article.display = false
    }
    if (new Date(article.update_time * 1000) < query.dateRange.start || new Date(article.update_time * 1000) > query.dateRange.end) {
      article.display = false
    }
    if (query.albums.length > 0 && article.appmsg_album_infos.every(album => !query.albums.includes(album.title))) {
      article.display = false
    }
  })
}

const {
  loading: batchDownloadLoading,
  phase: batchDownloadPhase,
  downloadedCount: batchDownloadedCount,
  packedCount: batchPackedCount,
  download: batchDownload,
} = useBatchDownload()
const selectedArticleCount = ref(0)

function doBatchDownload() {
  const articles: DownloadableArticle[] = selectedArticles.value.map(article => ({
    title: article.title,
    url: article.link,
    date: +article.update_time,
  }))
  selectedArticleCount.value = articles.length
  const filename = selectedAccountName.value
  batchDownload(articles, filename)
}

const excelBtnLoading = ref(false)

function excelExport() {
  excelBtnLoading.value = true

  const articles = selectedArticles.value.map(article => ({...article}))
  setTimeout(() => {
    exportToExcel(articles)
    excelBtnLoading.value = false
  }, 0)
}

async function exportToExcel(data: Article[]) {
  // 创建工作簿和工作表
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  // 设置表头
  worksheet.columns = [
    {header: '标题', key: 'title', width: 80},
    {header: '发布日期', key: 'update_time', width: 20},
    {header: '作者', key: 'author_name', width: 20},
    {header: '是否原创', key: 'copyright', width: 10},
    {header: '所属合集', key: 'album', width: 50},
    {header: '摘要', key: 'digest', width: 100},
    {header: '原文链接', key: 'link', width: 200},
    {header: '封面图链接', key: 'cover_img', width: 200},
    {header: '封面图链接(235_1)', key: 'cover_img_235_1', width: 200},
    {header: '封面图链接(16_9)', key: 'cover_img_16_9', width: 200},
    {header: '封面图链接(3_4)', key: 'cover_img_3_4', width: 200},
    {header: '封面图链接(1_1)', key: 'cover_img_1_1', width: 200},
  ];

  // 添加数据
  data.forEach(item => {
    worksheet.addRow({
      title: item.title,
      update_time: formatTimeStamp(item.update_time),
      author_name: item.author_name,
      copyright: item.copyright_stat === 1 && item.copyright_type === 1 ? '原创' : '',
      album: item.appmsg_album_infos.map(album => '#'+album.title).join(' '),
      digest: item.digest,
      link: item.link,
      cover_img: item.pic_cdn_url_235_1 || item.pic_cdn_url_16_9 || item.cover_img || item.cover,
      cover_img_235_1: item.pic_cdn_url_235_1,
      cover_img_16_9: item.pic_cdn_url_16_9,
      cover_img_3_4: item.pic_cdn_url_3_4,
      cover_img_1_1: item.pic_cdn_url_1_1,
    });
  });

  // 导出为 Excel 文件
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {type: 'application/octet-stream'});
  saveAs(blob, `${selectedAccountName.value}.xlsx`);
}
</script>

<style scoped>
table th {
  padding: 0.5rem 0.25rem;
}

table td {
  border: 1px solid rgba(0, 0, 45, 0.1);
  padding: 0.25rem 0.5rem;
}

@media (prefers-color-scheme: dark) {
  table td {
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  th {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: none;
  }

  tr:nth-child(even) {
    background-color: rgba(255, 255, 255, 0.02);
  }

  tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

td:first-child,
th:first-child {
  border-left: none;
}

td:last-child,
th:last-child {
  border-right: none;
}

th {
  border: 1px solid rgba(0, 0, 45, 0.1);
  border-top: none;
}

tr:nth-child(even) {
  background-color: rgba(0, 0, 85, 0.02);
}

tr:hover {
  background-color: rgba(0, 0, 85, 0.02);
}
</style>
