<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-8 text-center">🚀 智能分批下载测试页面</h1>

      <!-- 测试数据生成 -->
      <div class="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 class="text-xl font-semibold mb-4">📝 生成测试数据</h2>

        <div class="flex items-center space-x-4 mb-4">
          <label class="text-sm font-medium">文章数量:</label>
          <input
            v-model.number="testArticleCount"
            type="number"
            min="1"
            max="500"
            class="border rounded px-2 py-1 w-20"
          />

          <button
            @click="generateTestArticles"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            生成测试文章
          </button>

          <button
            @click="clearTestArticles"
            class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            清除数据
          </button>
        </div>

        <div v-if="testArticles.length > 0" class="text-sm text-gray-600">
          已生成 {{ testArticles.length }} 篇测试文章
        </div>
      </div>

      <!-- 文章列表预览 -->
      <div v-if="testArticles.length > 0" class="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 class="text-xl font-semibold mb-4">📋 测试文章列表</h2>

        <div class="mb-4">
          <button
            @click="selectAllArticles"
            class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mr-2"
          >
            全选
          </button>
          <button
            @click="clearSelection"
            class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            清除选择
          </button>
          <span class="ml-4 text-sm text-gray-600">
            已选择: {{ selectedTestArticles.length }} / {{ testArticles.length }}
          </span>
        </div>

        <div class="max-h-60 overflow-y-auto space-y-2">
          <div
            v-for="article in testArticles"
            :key="article.id"
            class="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
          >
            <input
              type="checkbox"
              v-model="article.selected"
              class="w-4 h-4"
            />
            <div class="flex-1">
              <div class="font-medium text-sm">{{ article.title }}</div>
              <div class="text-xs text-gray-500">{{ new Date(article.date * 1000).toLocaleDateString() }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 智能分批下载器 -->
      <div v-if="selectedTestArticles.length > 0" class="bg-white rounded-lg shadow-md p-6">
        <AutoBatchDownloader
          :selected-articles="selectedTestArticles"
          :filename="'测试下载_' + new Date().toISOString().slice(0, 10)"
        />
      </div>

      <!-- 使用说明 -->
      <div class="bg-blue-50 rounded-lg p-6 mt-8">
        <h2 class="text-xl font-semibold mb-4 text-blue-800">💡 使用说明</h2>
        <div class="text-blue-700 space-y-2">
          <p>1. 生成测试文章数据（建议先用少量文章测试）</p>
          <p>2. 选择要下载的文章</p>
          <p>3. 在智能分批下载器中配置参数</p>
          <p>4. 点击"开始智能下载"开始测试</p>
          <p class="text-red-600 font-medium">⚠️ 注意：这是测试页面，生成的是模拟数据，不会真正下载文章内容</p>
        </div>
      </div>

      <!-- 功能特性展示 -->
      <div class="bg-gray-50 rounded-lg p-6 mt-8">
        <h2 class="text-xl font-semibold mb-4">✨ 智能分批下载特性</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <div class="flex items-start space-x-2">
              <span class="text-green-500 font-bold">✓</span>
              <div>
                <div class="font-medium">自动分批处理</div>
                <div class="text-sm text-gray-600">智能将大量文章分成合适的批次</div>
              </div>
            </div>

            <div class="flex items-start space-x-2">
              <span class="text-green-500 font-bold">✓</span>
              <div>
                <div class="font-medium">实时进度监控</div>
                <div class="text-sm text-gray-600">详细显示每个批次的下载状态</div>
              </div>
            </div>

            <div class="flex items-start space-x-2">
              <span class="text-green-500 font-bold">✓</span>
              <div>
                <div class="font-medium">智能重试机制</div>
                <div class="text-sm text-gray-600">失败的批次自动重试，提高成功率</div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-start space-x-2">
              <span class="text-green-500 font-bold">✓</span>
              <div>
                <div class="font-medium">暂停和恢复</div>
                <div class="text-sm text-gray-600">支持暂停下载，网络恢复后继续</div>
              </div>
            </div>

            <div class="flex items-start space-x-2">
              <span class="text-green-500 font-bold">✓</span>
              <div>
                <div class="font-medium">自适应调节</div>
                <div class="text-sm text-gray-600">根据成功率自动调整批次大小</div>
              </div>
            </div>

            <div class="flex items-start space-x-2">
              <span class="text-green-500 font-bold">✓</span>
              <div>
                <div class="font-medium">失败文章重试</div>
                <div class="text-sm text-gray-600">单独重试失败的文章，不影响已成功的</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AutoBatchDownloader from '~/components/AutoBatchDownloader.vue';

useHead({
  title: '智能分批下载测试 | 微信公众号文章导出'
});

// 测试数据
const testArticleCount = ref(20);
const testArticles = ref([]);

// 生成测试文章
function generateTestArticles() {
  const articles = [];
  const titles = [
    '人工智能的发展趋势与未来展望',
    '区块链技术在金融行业的应用探索',
    '云计算服务架构设计与优化实践',
    '大数据分析在商业决策中的价值',
    '物联网技术发展现状与挑战分析',
    '移动互联网时代的用户体验设计',
    '网络安全威胁与防护策略研究',
    '5G技术对产业数字化转型的影响',
    '机器学习算法在推荐系统中的应用',
    '软件工程最佳实践与项目管理经验',
    '前端开发技术栈演进与选择指南',
    '后端架构设计模式与性能优化',
    '数据库设计原则与性能调优技巧',
    'DevOps实践中的持续集成与部署',
    '微服务架构设计与治理策略分析',
    '容器化技术在企业级应用中的实践',
    '开源软件许可证选择与合规管理',
    '技术团队建设与人才培养方案',
    '产品设计思维与用户需求分析',
    '创业公司技术选型与发展策略'
  ];

  for (let i = 0; i < testArticleCount.value; i++) {
    articles.push({
      id: `test_article_${i + 1}`,
      title: titles[i % titles.length] + ` (${i + 1})`,
      url: `https://mp.weixin.qq.com/s/test_article_${i + 1}`,
      date: Math.floor(Date.now() / 1000) - Math.random() * 365 * 24 * 3600, // 随机日期（过去一年内）
      selected: false
    });
  }

  testArticles.value = articles;
}

// 清除测试文章
function clearTestArticles() {
  testArticles.value = [];
}

// 全选文章
function selectAllArticles() {
  testArticles.value.forEach(article => {
    article.selected = true;
  });
}

// 清除选择
function clearSelection() {
  testArticles.value.forEach(article => {
    article.selected = false;
  });
}

// 已选择的测试文章
const selectedTestArticles = computed(() => {
  return testArticles.value
    .filter(article => article.selected)
    .map(article => ({
      title: article.title,
      url: article.url,
      date: article.date
    }));
});

// 初始化时生成一些测试数据
onMounted(() => {
  generateTestArticles();
});
</script>

<style scoped>
/* 自定义滚动条 */
.max-h-60::-webkit-scrollbar {
  width: 6px;
}

.max-h-60::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.max-h-60::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.max-h-60::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>