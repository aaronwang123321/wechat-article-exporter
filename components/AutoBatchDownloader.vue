<template>
  <div class="auto-batch-downloader bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
    <!-- 头部标题 -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
        🚀 智能分批下载管理器
      </h2>
      <div class="flex items-center space-x-2">
        <UBadge
          :color="getStatusColor(overallState.status)"
          :variant="overallState.status === 'running' ? 'solid' : 'subtle'"
          class="text-sm"
        >
          {{ getStatusText(overallState.status) }}
        </UBadge>
      </div>
    </div>

    <!-- 任务配置区域 -->
    <div v-if="!isRunning" class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">⚙️ 任务配置</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- 批次大小 -->
        <div>
          <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">批次大小</label>
          <URange
            v-model="config.batchSize"
            :min="1"
            :max="20"
            :step="1"
            class="w-full"
          />
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">当前: {{ config.batchSize }} 篇/批次</div>
        </div>

        <!-- 下载间隔 -->
        <div>
          <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">下载间隔 (秒)</label>
          <URange
            v-model="downloadDelaySeconds"
            :min="1"
            :max="30"
            :step="1"
            class="w-full"
          />
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">当前: {{ downloadDelaySeconds }} 秒</div>
        </div>

        <!-- 最大重试次数 -->
        <div>
          <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">最大重试次数</label>
          <URange
            v-model="config.maxRetries"
            :min="1"
            :max="10"
            :step="1"
            class="w-full"
          />
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">当前: {{ config.maxRetries }} 次</div>
        </div>

        <!-- 智能调节开关 -->
        <div class="flex items-center space-x-2">
          <UToggle v-model="config.autoAdjustBatchSize" />
          <span class="text-sm text-gray-600 dark:text-gray-300">智能调节批次大小</span>
        </div>

        <!-- 成功率阈值 -->
        <div v-if="config.autoAdjustBatchSize">
          <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">成功率阈值 (%)</label>
          <URange
            v-model="successRatePercent"
            :min="50"
            :max="100"
            :step="5"
            class="w-full"
          />
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">当前: {{ successRatePercent }}%</div>
        </div>
      </div>
    </div>

    <!-- 整体进度显示 -->
    <div v-if="isRunning || overallState.status === 'completed'" class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200">📊 下载进度</h3>
        <div class="text-sm text-gray-600 dark:text-gray-300">
          {{ overallState.completedArticles }}/{{ overallState.totalArticles }} 篇文章
        </div>
      </div>

      <!-- 进度条 -->
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
        <div
          class="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-300"
          :style="{ width: `${overallState.overallProgress}%` }"
        ></div>
      </div>

      <!-- 详细信息 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div class="text-blue-600 dark:text-blue-400 font-semibold">当前批次</div>
          <div class="text-lg text-gray-900 dark:text-gray-100">{{ overallState.currentBatchIndex + 1 }}/{{ overallState.totalBatches }}</div>
        </div>

        <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div class="text-green-600 dark:text-green-400 font-semibold">成功下载</div>
          <div class="text-lg text-gray-900 dark:text-gray-100">{{ overallState.completedArticles }}</div>
        </div>

        <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <div class="text-red-600 dark:text-red-400 font-semibold">失败文章</div>
          <div class="text-lg text-gray-900 dark:text-gray-100">{{ overallState.failedArticles }}</div>
        </div>

        <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <div class="text-purple-600 dark:text-purple-400 font-semibold">下载速度</div>
          <div class="text-lg text-gray-900 dark:text-gray-100">{{ formatDownloadSpeed(overallState.downloadSpeed) }}</div>
        </div>
      </div>

      <!-- 预估剩余时间 -->
      <div v-if="overallState.estimatedTimeRemaining" class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <div class="text-yellow-800 dark:text-yellow-200">
          🕒 预估剩余时间: {{ formatTime(overallState.estimatedTimeRemaining) }}
        </div>
      </div>

      <!-- 打包进度 -->
      <div v-if="overallState.packingProgress !== undefined" class="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
        <div class="flex items-center justify-between mb-2">
          <div class="text-indigo-800 dark:text-indigo-200 font-semibold">📦 正在打包文件</div>
          <div class="text-sm text-indigo-600 dark:text-indigo-400">
            {{ overallState.packingCount || 0 }}/{{ overallState.completedArticles }} 篇文章
          </div>
        </div>
        <div class="w-full bg-indigo-200 dark:bg-indigo-700 rounded-full h-2">
          <div
            class="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${overallState.packingProgress}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 批次详情 -->
    <div v-if="tasks.length > 0" class="mb-6">
      <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">📦 批次详情</h3>

      <div class="max-h-80 overflow-y-auto space-y-2">
        <div
          v-for="(task, index) in tasks"
          :key="task.id"
          class="flex items-center justify-between p-3 rounded-lg border"
          :class="getTaskBgClass(task.status)"
        >
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              <UIcon
                :name="getTaskIcon(task.status)"
                :class="getTaskIconClass(task.status)"
                class="w-5 h-5"
              />
            </div>

            <div>
              <div class="font-medium text-sm text-gray-900 dark:text-gray-100">
                批次 {{ index + 1 }} ({{ task.articles.length }} 篇文章)
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ getTaskStatusText(task) }}
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <!-- 进度显示 -->
            <div v-if="task.status === 'running'" class="text-xs text-blue-600 dark:text-blue-400">
              {{ task.completedCount }}/{{ task.articles.length }}
            </div>

            <!-- 重试次数 -->
            <div v-if="task.retryCount > 0" class="text-xs text-orange-600 dark:text-orange-400">
              重试 {{ task.retryCount }}
            </div>

            <!-- 错误信息 -->
            <UTooltip v-if="task.error" :text="task.error">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-500 dark:text-red-400" />
            </UTooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div v-if="tasks.length > 0" class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-200">📈 统计信息</h3>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ downloadStats.completedBatches }}</div>
          <div class="text-gray-600 dark:text-gray-300">完成批次</div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">{{ downloadStats.failedBatches }}</div>
          <div class="text-gray-600 dark:text-gray-300">失败批次</div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ downloadStats.batchSuccessRate.toFixed(1) }}%</div>
          <div class="text-gray-600 dark:text-gray-300">成功率</div>
        </div>

        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ downloadStats.totalRetries }}</div>
          <div class="text-gray-600 dark:text-gray-300">总重试次数</div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex flex-wrap gap-3">
      <!-- 开始下载 -->
      <UButton
        v-if="!isRunning && selectedArticles.length > 0"
        color="blue"
        variant="solid"
        @click="startDownload"
        class="flex items-center space-x-2"
      >
        <UIcon name="i-heroicons-play" class="w-4 h-4" />
        <span>开始智能下载 ({{ selectedArticles.length }} 篇)</span>
      </UButton>

      <!-- 暂停/恢复 -->
      <UButton
        v-if="isRunning && !isPaused"
        color="orange"
        variant="solid"
        @click="pauseDownload"
        class="flex items-center space-x-2"
      >
        <UIcon name="i-heroicons-pause" class="w-4 h-4" />
        <span>暂停下载</span>
      </UButton>

      <UButton
        v-if="isRunning && isPaused"
        color="green"
        variant="solid"
        @click="resumeDownload"
        class="flex items-center space-x-2"
      >
        <UIcon name="i-heroicons-play" class="w-4 h-4" />
        <span>恢复下载</span>
      </UButton>

      <!-- 取消 -->
      <UButton
        v-if="isRunning"
        color="red"
        variant="outline"
        @click="cancelDownload"
        class="flex items-center space-x-2"
      >
        <UIcon name="i-heroicons-stop" class="w-4 h-4" />
        <span>取消下载</span>
      </UButton>

      <!-- 重试失败的文章 -->
      <UButton
        v-if="getFailedArticles().length > 0"
        color="yellow"
        variant="solid"
        @click="retryFailed"
        class="flex items-center space-x-2"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
        <span>重试失败 ({{ getFailedArticles().length }} 篇)</span>
      </UButton>

      <!-- 清除任务 -->
      <UButton
        v-if="!isRunning && tasks.length > 0"
        color="gray"
        variant="outline"
        @click="clearTasks"
        class="flex items-center space-x-2"
      >
        <UIcon name="i-heroicons-trash" class="w-4 h-4" />
        <span>清除任务</span>
      </UButton>
    </div>

    <!-- 已完成的ZIP文件列表 -->
    <div v-if="completedZipFiles.length > 0" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <h3 class="text-lg font-semibold mb-3 text-green-700 dark:text-green-300">📁 已完成的ZIP文件</h3>

      <div class="space-y-2">
        <div
          v-for="(zipFile, index) in completedZipFiles"
          :key="index"
          class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700"
        >
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-archive-box" class="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <div class="font-medium text-sm text-gray-900 dark:text-gray-100">{{ zipFile.filename }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                批次 {{ zipFile.batchIndex + 1 }} • {{ zipFile.articleCount }} 篇文章 •
                {{ formatTime(Date.now() - zipFile.createdAt) }}前
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <UButton
              size="sm"
              color="green"
              variant="outline"
              @click="downloadZipFile(zipFile)"
              class="flex items-center space-x-1"
            >
              <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
              <span>重新下载</span>
            </UButton>
          </div>
        </div>
      </div>

      <div class="mt-3 text-sm text-green-600 dark:text-green-400">
        💡 共 {{ completedZipFiles.length }} 个ZIP文件，包含 {{ completedZipFiles.reduce((sum, zip) => sum + zip.articleCount, 0) }} 篇文章
      </div>
    </div>

    <!-- 提示信息 -->
    <div v-if="!selectedArticles.length && !isRunning" class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <div class="text-blue-800 dark:text-blue-200 text-sm">
        💡 请先在文章列表中选择要下载的文章，然后使用智能分批下载功能。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAutoBatchDownload, TaskStatus, type BatchTaskConfig } from '../composables/useAutoBatchDownload';
import type { DownloadableArticle } from '../types/types';

interface Props {
  selectedArticles: DownloadableArticle[];
  filename: string;
}

const props = defineProps<Props>();

// 使用自动分批下载管理器
const {
  isRunning,
  isPaused,
  tasks,
  overallState,
  downloadStats,
  completedZipFiles,
  startAutoBatchDownload,
  pauseDownload: pause,
  resumeDownload: resume,
  cancelDownload: cancel,
  retryFailedArticles,
  getFailedArticles,
  clearTasks: clearAllTasks,
  defaultConfig
} = useAutoBatchDownload();

// 配置状态
const config = ref<BatchTaskConfig>({ ...defaultConfig });

// 计算属性：将秒转换为毫秒
const downloadDelaySeconds = computed({
  get: () => Math.round(config.value.downloadDelay / 1000),
  set: (value: number) => {
    config.value.downloadDelay = value * 1000;
  }
});

const successRatePercent = computed({
  get: () => Math.round(config.value.successRateThreshold * 100),
  set: (value: number) => {
    config.value.successRateThreshold = value / 100;
  }
});

// 方法
async function startDownload() {
  try {
    await startAutoBatchDownload(props.selectedArticles, props.filename, config.value);
  } catch (error: any) {
    console.error('启动下载失败:', error.message);
    alert(`启动下载失败: ${error.message}`);
  }
}

async function pauseDownload() {
  try {
    await pause();
  } catch (error: any) {
    alert(`暂停下载失败: ${error.message}`);
  }
}

async function resumeDownload() {
  try {
    await resume();
  } catch (error: any) {
    alert(`恢复下载失败: ${error.message}`);
  }
}

async function cancelDownload() {
  if (confirm('确定要取消当前下载任务吗？')) {
    try {
      await cancel();
    } catch (error: any) {
      alert(`取消下载失败: ${error.message}`);
    }
  }
}

async function retryFailed() {
  try {
    await retryFailedArticles(props.filename);
  } catch (error: any) {
    alert(`重试失败: ${error.message}`);
  }
}

function clearTasks() {
  if (confirm('确定要清除所有任务历史和ZIP文件吗？这将释放所有下载链接。')) {
    try {
      clearAllTasks();
    } catch (error: any) {
      alert(`清除任务失败: ${error.message}`);
    }
  }
}

function downloadZipFile(zipFile: any) {
  // 创建一个临时链接来下载文件
  const link = document.createElement('a');
  link.href = zipFile.downloadUrl;
  link.download = zipFile.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 辅助方法
function getStatusColor(status: string) {
  const colors = {
    pending: 'gray',
    running: 'blue',
    paused: 'orange',
    completed: 'green',
    failed: 'red',
    cancelled: 'gray'
  } as const;
  return colors[status as keyof typeof colors] || 'gray';
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };
  return texts[status] || '未知';
}

function getTaskBgClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    running: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
    paused: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
    completed: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    failed: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    cancelled: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  };
  return classes[status] || 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
}

function getTaskIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: 'i-heroicons-clock',
    running: 'i-heroicons-arrow-path',
    paused: 'i-heroicons-pause',
    completed: 'i-heroicons-check-circle',
    failed: 'i-heroicons-x-circle',
    cancelled: 'i-heroicons-stop-circle'
  };
  return icons[status] || 'i-heroicons-question-mark-circle';
}

function getTaskIconClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'text-gray-500 dark:text-gray-400',
    running: 'text-blue-500 dark:text-blue-400 animate-spin',
    paused: 'text-orange-500 dark:text-orange-400',
    completed: 'text-green-500 dark:text-green-400',
    failed: 'text-red-500 dark:text-red-400',
    cancelled: 'text-gray-500 dark:text-gray-400'
  };
  return classes[status] || 'text-gray-500 dark:text-gray-400';
}

function getTaskStatusText(task: any): string {
  if (task.status === 'running') {
    return `正在下载... ${task.completedCount}/${task.articles.length}`;
  } else if (task.status === 'completed') {
    const duration = task.endTime - task.startTime;
    return `完成 (耗时 ${formatTime(duration)})`;
  } else if (task.status === 'failed') {
    return `失败: ${task.error || '未知错误'}`;
  } else if (task.retryCount > 0) {
    return `等待重试... (第 ${task.retryCount} 次)`;
  } else {
    return getStatusText(task.status);
  }
}

function formatTime(ms: number): string {
  if (!ms) return '--';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

function formatDownloadSpeed(speed?: number): string {
  if (!speed) return '--';

  if (speed < 1) {
    return `${(speed * 60).toFixed(1)} 篇/小时`;
  } else {
    return `${speed.toFixed(1)} 篇/分钟`;
  }
}
</script>

<style scoped>
.auto-batch-downloader {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 自定义滚动条 */
.max-h-80::-webkit-scrollbar {
  width: 6px;
}

.max-h-80::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.max-h-80::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.max-h-80::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 暗色模式下的滚动条 */
@media (prefers-color-scheme: dark) {
  .max-h-80::-webkit-scrollbar-track {
    background: #374151;
  }

  .max-h-80::-webkit-scrollbar-thumb {
    background: #6b7280;
  }

  .max-h-80::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
}
</style>