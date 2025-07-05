import JSZip from "jszip";
import {saveAs} from "file-saver";
import {format} from 'date-fns';
import {downloadArticleHTMLs, packHTMLAssets} from "~/utils";
import type {DownloadableArticle} from "~/types/types";

/**
 * 下载任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',      // 等待中
  RUNNING = 'running',      // 运行中
  PAUSED = 'paused',        // 暂停
  COMPLETED = 'completed',  // 已完成
  FAILED = 'failed',        // 失败
  CANCELLED = 'cancelled'   // 已取消
}

/**
 * 下载任务配置
 */
export interface BatchTaskConfig {
  // 基本配置
  batchSize: number;           // 批次大小（默认：5）
  maxRetries: number;          // 最大重试次数（默认：3）
  retryDelay: number;          // 重试延迟（毫秒，默认：5000）
  downloadDelay: number;       // 下载间隔（毫秒，默认：2000）

  // 智能调节
  autoAdjustBatchSize: boolean; // 是否自动调节批次大小（默认：true）
  minBatchSize: number;         // 最小批次大小（默认：1）
  maxBatchSize: number;         // 最大批次大小（默认：20）

  // 网络监控
  networkTimeoutThreshold: number; // 网络超时阈值（毫秒，默认：30000）
  successRateThreshold: number;    // 成功率阈值（默认：0.8）
}

/**
 * 批次任务信息
 */
export interface BatchTask {
  id: string;
  articles: DownloadableArticle[];
  status: TaskStatus;
  progress: number;
  completedCount: number;
  failedCount: number;
  retryCount: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * 整体任务状态
 */
export interface OverallTaskState {
  status: TaskStatus;
  totalArticles: number;
  completedArticles: number;
  failedArticles: number;
  currentBatchIndex: number;
  totalBatches: number;
  overallProgress: number;
  estimatedTimeRemaining?: number;
  downloadSpeed?: number; // 文章/分钟
  packingProgress?: number; // 打包进度
  packingCount?: number; // 已打包数量
  completedZipFiles?: CompletedZipFile[]; // 已完成的ZIP文件列表
}

export interface CompletedZipFile {
  filename: string;
  batchIndex: number;
  articleCount: number;
  downloadUrl: string;
  createdAt: number;
}

/**
 * 自动分批下载管理器
 */
export function useAutoBatchDownload() {
  // 响应式状态
  const isRunning = ref(false);
  const isPaused = ref(false);
  const tasks = ref<BatchTask[]>([]);
  const overallState = ref<OverallTaskState>({
    status: TaskStatus.PENDING,
    totalArticles: 0,
    completedArticles: 0,
    failedArticles: 0,
    currentBatchIndex: 0,
    totalBatches: 0,
    overallProgress: 0
  });

  // 默认配置
  const defaultConfig: BatchTaskConfig = {
    batchSize: 5,
    maxRetries: 3,
    retryDelay: 5000,
    downloadDelay: 2000,
    autoAdjustBatchSize: true,
    minBatchSize: 1,
    maxBatchSize: 20,
    networkTimeoutThreshold: 30000,
    successRateThreshold: 0.8
  };

  let currentConfig = { ...defaultConfig };
  let abortController: AbortController | null = null;
  const completedZipFiles = ref<CompletedZipFile[]>([]);

  /**
   * 创建分批任务
   */
  function createBatches(articles: DownloadableArticle[], batchSize: number): BatchTask[] {
    const batches: BatchTask[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batchArticles = articles.slice(i, i + batchSize);
      batches.push({
        id: `batch_${Date.now()}_${i}`,
        articles: batchArticles,
        status: TaskStatus.PENDING,
        progress: 0,
        completedCount: 0,
        failedCount: 0,
        retryCount: 0
      });
    }

    return batches;
  }

  /**
   * 智能调整批次大小
   */
  function adjustBatchSize(successRate: number, avgDownloadTime: number): number {
    if (!currentConfig.autoAdjustBatchSize) {
      return currentConfig.batchSize;
    }

    let newBatchSize = currentConfig.batchSize;

    // 根据成功率调整
    if (successRate < currentConfig.successRateThreshold) {
      // 成功率低，减少批次大小
      newBatchSize = Math.max(currentConfig.minBatchSize, Math.floor(newBatchSize * 0.7));
    } else if (successRate > 0.95 && avgDownloadTime < 10000) {
      // 成功率高且速度快，增加批次大小
      newBatchSize = Math.min(currentConfig.maxBatchSize, Math.floor(newBatchSize * 1.3));
    }

    console.log(`🔧 批次大小调整: ${currentConfig.batchSize} → ${newBatchSize} (成功率: ${(successRate * 100).toFixed(1)}%)`);
    currentConfig.batchSize = newBatchSize;

    return newBatchSize;
  }

  /**
   * 执行单个批次下载并立即打包
   */
  async function executeBatch(task: BatchTask, batchIndex: number, filename: string): Promise<void> {
    if (abortController?.signal.aborted) {
      throw new Error('任务已取消');
    }

    task.status = TaskStatus.RUNNING;
    task.startTime = Date.now();

    try {
      console.log(`📦 开始下载批次 ${task.id}，包含 ${task.articles.length} 篇文章`);

      const results = await downloadArticleHTMLs(task.articles, (count: number) => {
        task.completedCount = count;
        task.progress = (count / task.articles.length) * 100;
        updateOverallProgress();
      });

      task.endTime = Date.now();
      task.completedCount = results.length;
      task.failedCount = task.articles.length - results.length;

      if (results.length > 0) {
        // 立即打包这个批次
        console.log(`📦 开始打包批次 ${batchIndex + 1}，包含 ${results.length} 篇文章`);
        const zipFile = await packBatchAndSave(results, filename, batchIndex);
        completedZipFiles.value.push(zipFile);

        // 更新整体状态
        overallState.value.completedZipFiles = [...completedZipFiles.value];

        console.log(`✅ 批次 ${batchIndex + 1} 完成并已保存: ${zipFile.filename}`);
      }

      task.status = TaskStatus.COMPLETED;
      console.log(`✅ 批次 ${task.id} 完成，成功: ${results.length}，失败: ${task.failedCount}`);

    } catch (error: any) {
      task.status = TaskStatus.FAILED;
      task.error = error.message;
      task.endTime = Date.now();

      console.error(`❌ 批次 ${task.id} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 打包单个批次并保存
   */
  async function packBatchAndSave(articles: DownloadableArticle[], baseFilename: string, batchIndex: number): Promise<CompletedZipFile> {
    const zip = new JSZip();
    const filename = `${baseFilename}_batch_${batchIndex + 1}`;

    for (const article of articles) {
      if (article.html) {
        await packHTMLAssets(
          article.html,
          article.title.replaceAll('.', '_'),
          zip.folder(format(new Date(article.date * 1000), 'yyyy-MM-dd') + ' ' + article.title.replace(/\//g, '_'))!
        );
      }
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });

    // 创建下载URL
    const downloadUrl = URL.createObjectURL(blob);

    // 自动下载这个批次
    saveAs(blob, `${filename}.zip`);

    return {
      filename: `${filename}.zip`,
      batchIndex: batchIndex,
      articleCount: articles.length,
      downloadUrl: downloadUrl,
      createdAt: Date.now()
    };
  }

  /**
   * 重试失败的批次
   */
  async function retryBatch(task: BatchTask, batchIndex: number, filename: string): Promise<void> {
    if (task.retryCount >= currentConfig.maxRetries) {
      throw new Error(`批次 ${task.id} 重试次数已达上限`);
    }

    task.retryCount++;
    task.status = TaskStatus.PENDING;
    task.progress = 0;
    task.completedCount = 0;
    task.error = undefined;

    console.log(`🔄 重试批次 ${task.id}，第 ${task.retryCount} 次重试`);

    // 等待重试延迟
    await new Promise(resolve => setTimeout(resolve, currentConfig.retryDelay));

    await executeBatch(task, batchIndex, filename);
  }

  /**
   * 更新整体进度
   */
  function updateOverallProgress() {
    const completedTasks = tasks.value.filter(t => t.status === TaskStatus.COMPLETED).length;
    const runningTask = tasks.value.find(t => t.status === TaskStatus.RUNNING);

    let totalCompleted = completedTasks * currentConfig.batchSize;
    if (runningTask) {
      totalCompleted += runningTask.completedCount;
    }

    overallState.value.completedArticles = Math.min(totalCompleted, overallState.value.totalArticles);
    overallState.value.currentBatchIndex = completedTasks;
    overallState.value.overallProgress = (overallState.value.completedArticles / overallState.value.totalArticles) * 100;

    // 计算预估剩余时间和下载速度
    const completedTasksWithTime = tasks.value.filter(t => t.status === TaskStatus.COMPLETED && t.startTime && t.endTime);
    if (completedTasksWithTime.length > 0) {
      const avgTimePerBatch = completedTasksWithTime.reduce((sum, t) => sum + (t.endTime! - t.startTime!), 0) / completedTasksWithTime.length;
      const remainingBatches = overallState.value.totalBatches - overallState.value.currentBatchIndex;
      overallState.value.estimatedTimeRemaining = remainingBatches * avgTimePerBatch;

      const avgArticlesPerMinute = (overallState.value.completedArticles / (Date.now() - (tasks.value[0]?.startTime || Date.now()))) * 60000;
      overallState.value.downloadSpeed = avgArticlesPerMinute;
    }
  }

  /**
   * 开始自动分批下载
   */
  async function startAutoBatchDownload(
    articles: DownloadableArticle[],
    filename: string,
    config: Partial<BatchTaskConfig> = {}
  ): Promise<void> {
    if (isRunning.value) {
      throw new Error('下载任务正在进行中');
    }

    // 合并配置
    currentConfig = { ...defaultConfig, ...config };

    // 初始化状态
    isRunning.value = true;
    isPaused.value = false;
    completedZipFiles.value = [];
    abortController = new AbortController();

    overallState.value = {
      status: TaskStatus.RUNNING,
      totalArticles: articles.length,
      completedArticles: 0,
      failedArticles: 0,
      currentBatchIndex: 0,
      totalBatches: Math.ceil(articles.length / currentConfig.batchSize),
      overallProgress: 0
    };

    // 创建批次任务
    tasks.value = createBatches(articles, currentConfig.batchSize);

    console.log(`🚀 开始自动分批下载，共 ${articles.length} 篇文章，分为 ${tasks.value.length} 个批次`);

    try {
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;

      for (let i = 0; i < tasks.value.length; i++) {
        if (abortController.signal.aborted) {
          overallState.value.status = TaskStatus.CANCELLED;
          break;
        }

        // 检查是否暂停
        while (isPaused.value && !abortController.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const task = tasks.value[i];
        let success = false;

        // 尝试执行批次（包含重试逻辑）
        while (!success && task.retryCount <= currentConfig.maxRetries) {
          try {
            await executeBatch(task, i, filename);
            success = true;
            consecutiveFailures = 0;

            // 计算成功率并调整批次大小
            const completedTasks = tasks.value.slice(0, i + 1).filter(t => t.status === TaskStatus.COMPLETED);
            if (completedTasks.length >= 3) {
              const successRate = completedTasks.length / (i + 1);
              const avgTime = completedTasks.reduce((sum, t) => sum + (t.endTime! - t.startTime!), 0) / completedTasks.length;
              adjustBatchSize(successRate, avgTime);
            }

          } catch (error) {
            consecutiveFailures++;

            if (task.retryCount < currentConfig.maxRetries) {
              await retryBatch(task, i, filename);
            } else {
              console.error(`❌ 批次 ${task.id} 最终失败，跳过`);
              task.status = TaskStatus.FAILED;
              overallState.value.failedArticles += task.articles.length;
              break;
            }
          }
        }

        // 如果连续失败次数过多，暂停任务
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.warn(`⚠️ 连续失败 ${maxConsecutiveFailures} 个批次，自动暂停任务`);
          await pauseDownload();
          break;
        }

        // 批次间延迟
        if (i < tasks.value.length - 1 && !abortController.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, currentConfig.downloadDelay));
        }
      }

      // 检查任务完成状态
      if (!abortController.signal.aborted && !isPaused.value) {
        if (completedZipFiles.value.length > 0) {
          overallState.value.status = TaskStatus.COMPLETED;
          const totalArticles = completedZipFiles.value.reduce((sum, zip) => sum + zip.articleCount, 0);
          console.log(`🎉 下载任务完成！共生成 ${completedZipFiles.value.length} 个ZIP文件，包含 ${totalArticles} 篇文章`);
        } else {
          overallState.value.status = TaskStatus.FAILED;
          throw new Error('没有成功下载任何文章');
        }
      }

    } catch (error: any) {
      overallState.value.status = TaskStatus.FAILED;
      console.error('❌ 下载任务失败:', error.message);
      throw error;
    } finally {
      isRunning.value = false;
    }
  }

  /**
   * 打包并下载结果
   */
  async function packAndDownload(articles: DownloadableArticle[], filename: string): Promise<void> {
    console.log('📦 开始打包下载文件...');

    // 更新状态为打包中
    overallState.value.status = TaskStatus.RUNNING;

    try {
      const zip = new JSZip();
      let packedCount = 0;

      for (const article of articles) {
        if (abortController?.signal.aborted) {
          throw new Error('任务已取消');
        }

        if (article.html) {
          try {
            console.log(`📦 正在打包: ${article.title}`);
            await packHTMLAssets(
              article.html,
              article.title.replaceAll('.', '_'),
              zip.folder(format(new Date(article.date * 1000), 'yyyy-MM-dd') + ' ' + article.title.replace(/\//g, '_'))!
            );
            packedCount++;

            // 更新打包进度
            overallState.value.packingCount = packedCount;
            overallState.value.packingProgress = (packedCount / articles.length) * 100;

            console.log(`📦 已打包: ${packedCount}/${articles.length} - ${article.title}`);
          } catch (error: any) {
            console.error(`❌ 打包失败: ${article.title}`, error.message);
            // 继续处理其他文章，不因单个文章失败而中断
          }
        }
      }

      if (packedCount === 0) {
        throw new Error('没有成功打包任何文章');
      }

      console.log('📦 开始生成ZIP文件...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });

      console.log('💾 开始下载文件...');
      saveAs(blob, `${filename}.zip`);
      console.log('✅ 文件下载完成');

    } catch (error: any) {
      console.error('❌ 打包下载失败:', error.message);
      throw error;
    }
  }

  /**
   * 暂停下载
   */
  async function pauseDownload(): Promise<void> {
    if (!isRunning.value) {
      throw new Error('没有正在运行的下载任务');
    }

    isPaused.value = true;
    overallState.value.status = TaskStatus.PAUSED;
    console.log('⏸️ 下载任务已暂停');
  }

  /**
   * 恢复下载
   */
  async function resumeDownload(): Promise<void> {
    if (!isRunning.value || !isPaused.value) {
      throw new Error('没有可恢复的下载任务');
    }

    isPaused.value = false;
    overallState.value.status = TaskStatus.RUNNING;
    console.log('▶️ 下载任务已恢复');
  }

  /**
   * 取消下载
   */
  async function cancelDownload(): Promise<void> {
    if (!isRunning.value) {
      throw new Error('没有正在运行的下载任务');
    }

    abortController?.abort();
    isRunning.value = false;
    isPaused.value = false;
    overallState.value.status = TaskStatus.CANCELLED;
    console.log('🛑 下载任务已取消');
  }

  /**
   * 获取失败的文章列表
   */
  function getFailedArticles(): DownloadableArticle[] {
    const failedArticles: DownloadableArticle[] = [];

    tasks.value
      .filter(task => task.status === TaskStatus.FAILED)
      .forEach(task => failedArticles.push(...task.articles));

    return failedArticles;
  }

  /**
   * 重试失败的文章
   */
  async function retryFailedArticles(filename: string): Promise<void> {
    const failedArticles = getFailedArticles();

    if (failedArticles.length === 0) {
      throw new Error('没有失败的文章需要重试');
    }

    console.log(`🔄 重试 ${failedArticles.length} 篇失败的文章`);
    await startAutoBatchDownload(failedArticles, filename + '_retry');
  }

  /**
   * 获取下载统计信息
   */
  const downloadStats = computed(() => {
    const completedTasks = tasks.value.filter(t => t.status === TaskStatus.COMPLETED).length;
    const failedTasks = tasks.value.filter(t => t.status === TaskStatus.FAILED).length;
    const totalTasks = tasks.value.length;

    return {
      completedBatches: completedTasks,
      failedBatches: failedTasks,
      totalBatches: totalTasks,
      batchSuccessRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      currentBatchSize: currentConfig.batchSize,
      totalRetries: tasks.value.reduce((sum, task) => sum + task.retryCount, 0)
    };
  });

  /**
   * 清除所有任务和ZIP文件
   */
  function clearTasks() {
    if (isRunning.value) {
      throw new Error('无法在下载过程中清除任务');
    }

    // 清理URL对象，释放内存
    completedZipFiles.value.forEach(zipFile => {
      if (zipFile.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(zipFile.downloadUrl);
      }
    });

    // 清空数组
    tasks.value.splice(0);
    completedZipFiles.value.splice(0);

    // 重置状态
    overallState.value = {
      status: TaskStatus.PENDING,
      totalArticles: 0,
      completedArticles: 0,
      failedArticles: 0,
      currentBatchIndex: 0,
      totalBatches: 0,
      overallProgress: 0,
      completedZipFiles: []
    };
  }

  return {
    // 状态
    isRunning: readonly(isRunning),
    isPaused: readonly(isPaused),
    tasks: readonly(tasks),
    overallState: readonly(overallState),
    downloadStats,
    completedZipFiles: readonly(completedZipFiles),

    // 方法
    startAutoBatchDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryFailedArticles,
    getFailedArticles,
    clearTasks,

    // 配置
    defaultConfig,
    currentConfig: readonly(ref(currentConfig))
  };
}