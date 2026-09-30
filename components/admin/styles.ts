/** 后台列表 / 编辑器里逐字节重复的类名串。只做字面量搬家，渲染结果与产物 CSS 均不变。 */

/** 表格外壳（书签 / 分类 / 说说 / 文章 / 标签共用）。 */
export const TABLE_SHELL =
  "rounded-lg border border-admin-border bg-admin-surface overflow-hidden";

/** 表头单元格（列宽与表头行由各表自带）。 */
export const TABLE_HEAD_CELL =
  "flex h-11 overflow-hidden items-center justify-center px-4";

/** 列表页筛选条，用在 `<Card className={…}>` 上。 */
export const FILTER_BAR = "mb-4 flex flex-wrap items-center gap-3 px-4 py-3";

/** 编辑器区块，用在 `<Card className={…}>` 上。 */
export const EDITOR_SECTION = "space-y-4 p-5";
