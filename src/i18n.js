export const LANGUAGE_KEY = "inkstone.language.v1";
export const zhCN = {
  "Changes queued · refreshing after typing stops…":
    "修改已合并 · 停止输入后刷新预览…",
  "Preview is paused for safety. Review the source, then choose Run preview to render the complete document.":
    "为安全起见，预览尚未运行。检查源码后，点击“运行预览”即可渲染完整文档。",
  "Compiling full document · up to 120 s…": "正在编译完整文档 · 最长 120 秒…",
  "Rendering full document…": "正在渲染完整文档…",
  "Rendering timed out. Last successful preview is preserved; source is safe.":
    "渲染超时，已保留上次成功预览，源码不受影响。",
  "Preview source exceeds 5 MiB. Source can still be edited and saved.":
    "预览源码超过 5 MiB，仍可编辑和保存源码。",
  "Project compilation timed out after 120 seconds.":
    "项目编译超过 120 秒，已中止。",

  "Large file · background syntax highlighting": "大文件模式 · 后台语法高亮",
  "Background highlighting failed. Reopen the document to retry; editing and saving are unaffected.":
    "后台高亮失败。重新打开文档可重试；编辑和保存不受影响。",
  "File is not valid UTF-8. Source was not replaced.":
    "文件不是有效的 UTF-8 编码，当前源码未被替换。",
  "Recovery pending…": "恢复草稿待保存…",
  "Invalid language": "无效的语言选项",
  "Inkstone home": "Inkstone 首页",
  WORKSPACE: "工作区",
  Workspace: "工作区",
  "＋ Open a document": "＋ 打开文档",
  "A place for your next idea.": "为下一个灵感留一处空间。",
  "Plain text. Live components.": "纯文本，交互组件。",
  "A little room to think.": "留一点思考的空间。",
  "Components & help ↗": "组件与帮助 ↗",
  "Local workspace": "本地工作区",
  Open: "打开",
  "Save a copy": "另存为",
  Save: "保存",
  "MAKE ROOM FOR YOUR IDEAS": "给灵感留一点空间",
  "Your words, with possibility.": "让文字，拥有更多可能。",
  "Workspace view": "工作区视图",
  Source: "源码",
  Split: "分栏",
  Preview: "预览",
  SOURCE: "源码",
  "LIVE PREVIEW": "实时预览",
  "Preparing…": "准备中…",
  Pause: "暂停",
  "Sandboxed preview": "隔离预览",
  "Close help": "关闭帮助",
  "A LITTLE MORE POSSIBILITY": "多一点可能",
  "Markdown meets components.": "让 Markdown 遇见组件。",
  "Use Markdown, GFM tables, JSX, and JavaScript expressions. Built-in components require no imports:":
    "支持 Markdown、GFM 表格、JSX 和 JavaScript 表达式。内置组件无需导入：",
  "Browser mode rejects imports and exports. Desktop mode supports local components and installed browser-compatible dependencies after workspace trust. Preview resets component state after each compile. Remote assets are blocked; data images work.":
    "网页版不支持 import/export。桌面版信任工作区后支持本地组件和已安装的浏览器兼容依赖。每次编译会重置组件状态；远程资源被阻止，可使用 data 图片。",
  "The preview has an opaque origin with no file handles or app bridge. Executable MDX can still hang its browser tab or navigate its own frame: only run code you trust. Pause stops previews while you edit.":
    "预览使用不透明来源，无法访问文件句柄或应用接口。MDX 中的代码仍可能使页面卡死或导航自己的框架，请只运行可信代码。编辑时可暂停预览。",
  "Save overwrites only a file you selected, with a conflict check. Unsupported browsers download a copy. Recovery drafts are stored in this browser; they are not a backup. Avoid simultaneous editing in multiple tabs.":
    "保存仅覆盖你选择的文件，并检查磁盘冲突。不支持直接保存的浏览器会下载副本。恢复草稿保存在当前应用/浏览器中，不等于备份。请避免同时在多个标签页编辑。",
  "{words} words  ·  {lines} lines": "{words} 词（按空白分隔） · {lines} 行",
  "Recovery draft saved locally": "恢复草稿已保存到本地",
  "Recovery unavailable — save your file": "无法恢复草稿，请保存文件",
  "Browser storage is unavailable or full. Save a copy now to protect your work.":
    "本地存储不可用或已满。请立即另存为，保护你的内容。",
  "Run preview": "运行预览",
  "Paused · untrusted document": "已暂停 · 尚未信任文档",
  "Waiting…": "等待中…",
  "MDX preview": "MDX 预览",
  "{ms} ms compile": "编译 {ms} 毫秒",
  "Compiling…": "编译中…",
  "Compilation timed out. Source is safe; shorten the document or pause preview.":
    "编译超时，源码已保留。请缩短文档或暂停预览。",
  "Compiler failed. Edit to retry; source is safe.":
    "编译失败，源码已保留。修改内容后可重试。",
  "Preview error · last good view": "预览错误 · 保留上次成功画面",
  "MDX source editor": "MDX 源码编辑器",
  "Replace this document? Save a copy first if you need to keep your current changes.":
    "要替换当前文档吗？如需保留修改，请先另存为。",
  "Files larger than 5 MB are not supported.":
    "打开上限为 5 MiB。这是资源保护限制，不是 MDX 格式限制。",
  "Opened locally. Preview is paused: MDX can execute JavaScript. Inspect the source before choosing Run preview.":
    "已打开本地文件。MDX 可执行 JavaScript，预览暂时暂停；请检查源码后再选择“运行预览”。",
  "MDX documents": "MDX 文档",
  "MDX document": "MDX 文档",
  "Could not open: {error}": "无法打开：{error}",
  "Saved snapshot; newer edits still need saving.":
    "已保存操作开始时的内容，后续修改仍需保存。",
  "Saved to disk.": "已保存到磁盘。",
  "Download requested. Verify the downloaded copy before closing.":
    "已请求下载。关闭前请确认下载的副本完整。",
  "Save failed: {error} Your source remains in the editor.":
    "保存失败：{error} 源码仍保留在编辑器中。",
  "Run this document's JavaScript? Only continue for trusted MDX. The sandbox blocks app access but cannot prevent the document from freezing this tab or navigating its own frame.":
    "是否运行此文档中的 JavaScript？请仅运行可信 MDX。隔离预览阻止访问应用，但不能保证代码不会使页面卡死或导航自己的框架。",
  Resume: "继续预览",
  "Preview is running trusted JavaScript. Pause to stop subsequent execution.":
    "正在运行已信任的 JavaScript。暂停可阻止后续执行。",
  Paused: "已暂停",
  "Another tab changed the recovery draft. Save your document to disk to keep this version.":
    "其他标签页修改了恢复草稿。请保存到磁盘以保留当前版本。",
  "Open project": "打开项目",
  Rebuild: "重新编译",
  "Revoke trust": "撤销信任",
  "No trusted workspace": "尚未信任工作区",
  "Trusted this session: {project}": "本次会话已信任：{project}",
  "Workspace trusted for this session. Open an MDX file inside it, then choose Run preview. Installed browser dependencies are supported; no install scripts are run.":
    "已在本次会话中信任工作区。请打开其中的 MDX 文件，再选择“运行预览”。支持已安装的浏览器兼容依赖，不会运行安装脚本。",
  "Workspace trust revoked. Source is preserved; project imports no longer compile.":
    "已撤销工作区信任，源码保留；不再编译项目导入。",
  "Choose Run preview to compile this trusted document.":
    "请选择“运行预览”来编译此可信文档。",
  "Recovered your last browser draft. Preview is paused until you choose Run preview. Save a copy to reconnect it to a file.":
    "已恢复上次的草稿。预览保持暂停，直到你选择“运行预览”。请另存为以重新关联磁盘文件。",
  "Interface language": "界面语言",
  "Language preference could not be saved. This selection applies until reload.":
    "无法保存语言偏好。本次选择将在重载后失效。",
  "Preview error: {error}": "预览错误：{error}",
  "Only the application main frame may use this operation.":
    "仅应用主框架可执行此操作。",
  "Invalid source or document exceeds 5 MiB.":
    "源码无效或超过 5 MiB 保护上限。",
  "Keep editing": "继续编辑",
  "Discard and continue": "放弃修改并继续",
  "This document has unsaved changes.": "当前文档有未保存的修改。",
  "Save your file or keep editing. A browser recovery draft is not a backup.":
    "请保存文件或继续编辑，恢复草稿不能替代备份。",
  Cancel: "取消",
  "Trust for this session": "仅本次会话信任",
  "Trust this workspace and its dependencies?": "是否信任此工作区及其依赖？",
  "Imports may read files anywhere inside this folder, including installed dependencies, and execute JavaScript in the preview. Only trust code you reviewed. No install scripts or project build plugins are run. Preview code may consume CPU/memory. Trust ends when you revoke it or close the app.":
    "导入可能读取此文件夹内的文件（含已安装依赖），并在预览中执行 JavaScript。请只信任已检查的代码。不会运行安装脚本或项目构建插件。预览代码可能大量占用 CPU/内存。撤销信任、重载或关闭应用后，信任即失效。",
  "Trust a workspace and open its MDX file first.":
    "请先信任工作区并打开其中的 MDX 文件。",
  "Project compilation timed out after 15 seconds.":
    "项目编译超过 15 秒，已中止。",
  "Compilation was superseded or workspace trust was revoked.":
    "编译已被新任务替代，或工作区信任已撤销。",
  "Project compilation cancelled.": "项目编译已取消。",
  "Invalid preview": "预览内容无效",
  "Import escapes the trusted workspace (including symlinks).":
    "导入超出受信任工作区（包括符号链接）。",
  "Choose a text file smaller than 5 MiB.":
    "请选择不超过 5 MiB 的文本文件（资源保护上限）。",
  "Save target became a symbolic link. Choose Save a copy.":
    "保存目标变成了符号链接，请选择“另存为”。",
  "File changed on disk. Use Save a copy to preserve both versions.":
    "文件已被其他程序修改，请另存为以保留两个版本。",
  "File changed during save. Use Save a copy.":
    "保存期间文件发生变化，请另存为。",
  "Imports and exports are not supported. Use built-in components or inline JSX.":
    "网页版不支持 import/export。请使用内置组件/内联 JSX，或在桌面版中信任项目后导入。",
  "Preview limit is 500 KB. Your source can still be edited and saved.":
    "预览源码上限为 512,000 UTF-8 字节（保护阈值）。仍可编辑和保存源码。",
  "Project preview limit is 500 KB. Source can still be saved.":
    "项目预览源码上限为 512,000 UTF-8 字节（保护阈值）。仍可保存源码。",
  "Remote URLs and Node built-ins are unsupported in project previews.":
    "项目预览不支持远程 URL 或 Node 内置模块。",
  "External modules are unsupported; install browser-compatible dependencies inside the workspace.":
    "不支持外部模块，请在工作区内安装浏览器兼容依赖。",
  "Bundler produced no preview.": "打包器未生成预览。",
  "Preview bundle exceeds 10 MiB.": "预览产物超过 10 MiB 上限。",
  File: "文件",
  Edit: "编辑",
  View: "视图",
  Window: "窗口",
  Help: "帮助",
  Undo: "撤销",
  Redo: "重做",
  Cut: "剪切",
  Copy: "复制",
  Paste: "粘贴",
  "Select all": "全选",
  Reload: "重载",
  "Reset zoom": "重置缩放",
  "Zoom in": "放大",
  "Zoom out": "缩小",
  "Toggle fullscreen": "切换全屏",
  Minimize: "最小化",
  "Close window": "关闭窗口",
  Quit: "退出",
  "About Inkstone MDX": "关于 Inkstone MDX",
  "Hide Inkstone MDX": "隐藏 Inkstone MDX",
  "Hide others": "隐藏其他应用",
  "Show all": "显示全部",
};
export const editorPhrases = {
  Completions: "补全建议",
  "Unfolded lines": "已展开的行",
  "folded code": "已折叠代码",
  unfold: "展开",
  "replaced match on line $": "已替换第 $ 行的匹配项",
  "replaced $ matches": "已替换 $ 个匹配项",
  "current match": "当前匹配项",
  "on line": "位于行",
  "Control character": "控制字符",
  Find: "查找",
  Replace: "替换",
  next: "下一个",
  previous: "上一个",
  all: "全部",
  "match case": "区分大小写",
  "by word": "全词匹配",
  regexp: "正则表达式",
  replace: "替换",
  "replace all": "全部替换",
  close: "关闭",
  "Go to line": "跳转到行",
  go: "跳转",
  "Selection deleted": "已删除选区",
  "Fold line": "折叠行",
  "Unfold line": "展开行",
  "Folded lines": "已折叠的行",
  Unfold: "展开",
  to: "至",
  "No diagnostics": "没有诊断信息",
};
export function normalizeLanguage(value) {
  return /^zh(?:-|$)/i.test(value || "") ? "zh-CN" : "en";
}
export function initialLanguage(storage, browserLanguage) {
  try {
    const saved = storage?.getItem(LANGUAGE_KEY);
    if (saved === "zh-CN" || saved === "en") return saved;
  } catch {}
  return normalizeLanguage(browserLanguage);
}
export function translate(language, key, values = {}) {
  const template = language === "zh-CN" ? (zhCN[key] ?? key) : key;
  return template.replace(/\{(\w+)\}/g, (all, name) =>
    String(values[name] ?? all),
  );
}
const diagnosticPairs = Object.entries(zhCN).filter(
  ([en]) => !en.includes("{") && en.length > 20,
);
const englishDiagnostics = [...diagnosticPairs].sort(
  (a, b) => b[0].length - a[0].length,
);
const chineseDiagnostics = [...diagnosticPairs].sort(
  (a, b) => b[1].length - a[1].length,
);
// App-owned messages are translated; third-party compiler/OS diagnostics are retained verbatim.
export function translateError(language, error) {
  let text = String(error);
  if (language === "zh-CN" && zhCN[text]) return zhCN[text];
  if (language !== "zh-CN") {
    for (const [en, zh] of chineseDiagnostics) text = text.replaceAll(zh, en);
    return text;
  }
  for (const [en, zh] of englishDiagnostics) {
    if (en.length > 20) text = text.replaceAll(en, zh);
  }
  return text;
}
export function createUITranslations(root, getLanguage) {
  const staticNodes = new Map(),
    attributes = new Map(),
    dynamic = new Map();
  const skip = (el) => el?.closest("#editor,#preview,pre,option");
  function register(container = root) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!skip(node.parentElement) && !staticNodes.has(node))
        staticNodes.set(node, node.nodeValue);
    }
    for (const el of container.querySelectorAll(
      "[aria-label],[title],[placeholder]",
    )) {
      if (skip(el) || attributes.has(el)) continue;
      attributes.set(
        el,
        ["aria-label", "title", "placeholder"]
          .filter((a) => el.hasAttribute(a))
          .map((a) => [a, el.getAttribute(a)]),
      );
    }
  }
  function text(el, key, values = {}) {
    dynamic.set(el, { key, values });
    el.textContent = translateError(
      getLanguage(),
      translate(getLanguage(), key, values),
    );
  }
  function render() {
    for (const [node, original] of staticNodes)
      if (node.isConnected) {
        const trimmed = original.trim();
        node.nodeValue = original.replace(
          trimmed,
          translate(getLanguage(), trimmed),
        );
      }
    for (const [el, attrs] of attributes)
      if (el.isConnected)
        for (const [attr, key] of attrs)
          el.setAttribute(attr, translate(getLanguage(), key));
    for (const [el, { key, values }] of dynamic)
      if (el.isConnected)
        el.textContent = translateError(
          getLanguage(),
          translate(getLanguage(), key, values),
        );
  }
  return { register, text, render };
}
