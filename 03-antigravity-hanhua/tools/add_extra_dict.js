/**
 * 向已打过补丁的 app_test/dist/preload.js 词典追加补充词条。
 * 幂等：用 ANTIGRAVITY_CN_EXTRA_V1 标记，重复运行不会叠加。
 */
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'dist/preload.js';
const MARKER = 'ANTIGRAVITY_CN_EXTRA_V1';

// 真实界面扫描出来 + 高频界面词（品牌名/模型名/用户数据不在其中）
const EXTRA = {
  // —— 侧栏与主区（CDP 实测残留） ——
  Conversations: '对话',
  Conversation: '对话',
  Sidebar: '侧边栏',
  'Toggle Sidebar': '切换侧边栏',
  'More options': '更多选项',
  'More actions': '更多操作',
  'Add context': '添加上下文',
  'Pin conversation': '置顶对话',
  'Unpin conversation': '取消置顶',
  'Archive conversation': '归档对话',
  'Delete conversation': '删除对话',
  'Rename conversation': '重命名对话',
  'Record voice memo': '录制语音备忘',
  'Send message': '发送消息',
  'Message input': '消息输入',
  'Go Back': '后退',
  'Go Forward': '前进',
  'Install IDE': '安装 IDE',
  'Create New Project': '新建项目',
  'Display Options': '显示选项',
  'Typeahead menu': '候选菜单',

  // —— 常见导航 / 项目 / 任务 ——
  'Open the Editor': '打开编辑器',
  'Agent Manager': 'Agent 管理器',
  Artifacts: '产物',
  Rules: '规则',
  Manage: '管理',
  Task: '任务',
  'New Task': '新建任务',
  Run: '运行',
  Overview: '概览',
  Inbox: '收件箱',

  // —— 状态 ——
  'In Progress': '进行中',
  Completed: '已完成',
  Failed: '失败',
  Pending: '待处理',
  Queued: '排队中',
  Today: '今天',
  Yesterday: '昨天',
  'This Week': '本周',
  Older: '更早',

  // —— 通用操作 ——
  Clear: '清空',
  'Clear all': '全部清空',
  Expand: '展开',
  Collapse: '折叠',
  'Full Screen': '全屏',
  'Exit Full Screen': '退出全屏',
  'Zoom In': '放大',
  'Zoom Out': '缩小',
  'Actual Size': '实际大小',
};

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes(MARKER)) {
  console.log('⚠️ 已存在补充词条，先执行 cleanup 再重新注入');
  // 整块移除（含首尾换行），保证重复运行字节数完全稳定
  src = src.replace(new RegExp('\\n\\s*// ' + MARKER + '_START[\\s\\S]*?// ' + MARKER + '_END\\n', 'g'), '');
}

const needle = 'const dict = {';
const i = src.indexOf(needle);
if (i < 0) throw new Error('未找到词典起始 `const dict = {`');

// 统计哪些 key 已存在，避免重复（重复无害，但输出要清楚）
const dictRegion = src.slice(i, src.indexOf('\n  };', i));
const dup = Object.keys(EXTRA).filter((k) => dictRegion.includes(JSON.stringify(k) + ':'));
if (dup.length) console.log('ℹ️ 以下 key 原词典已有，将跳过: ' + dup.join(', '));

const entries = Object.entries(EXTRA)
  .filter(([k]) => !dup.includes(k))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join('\n');

const block =
  `\n  // ${MARKER}_START (补充词条 ${Object.keys(EXTRA).length - dup.length} 条，实测界面残留下发)\n` +
  entries +
  `\n  // ${MARKER}_END\n`;

src = src.slice(0, i + needle.length) + block + src.slice(i + needle.length);
fs.writeFileSync(FILE, src, 'utf8');

console.log(`✅ 已注入 ${Object.keys(EXTRA).length - dup.length} 条补充词条 -> ${FILE}`);
console.log('   文件大小: ' + fs.statSync(FILE).size.toLocaleString('en-US') + ' B');
