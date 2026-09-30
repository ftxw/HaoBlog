/**
 * 正文排版样式 `.post-body` 的**唯一**定义处。
 *
 * ⚠️ 三处（文章详情、关于页、后台预览）都必须引这一份：分开维护会让
 * 「后台预览」与「发布后的正文」排版不一致。
 *
 * 为什么是「注入 <style>」而不是写进 globals.css：
 *   这些规则只在「渲染 Markdown 正文」时用得上，属于该内容的局部样式；
 *   放进全局样式表会让每个页面（首页、相册、说说…）都背上这几十条规则。
 *   写成字符串由使用方 <style> 注入，Tailwind 不会 purge 掉，也不会进主 CSS。
 *
 * 约定：颜色一律走语义 token（var(--app-*)，浅色/深色自动切），不写死 hex；
 * 唯一例外是代码高亮的 One Dark 色板 —— 那是「固定内容色」，与主题无关。
 */
export const POST_BODY_STYLE = `
  /* ── 正文排版 ──────────────────────────────────────────────
     逐条对齐母版 posts/[id].astro 与 about/index.astro 的 .post-body 规则集
     ⚠️ 不用 @tailwindcss/typography 的 .prose，且该插件已于 2026-09-28 从
     globals.css 的 @plugin 指令里移除（它一加载就会无条件输出整套 prose 基础规则，
     实测 91 条 / 16434 字节全是死重量）。不用的理由：本项目从未覆盖插件的
     --tw-prose-* 变量，于是 strong / h4 / figcaption / thead / tbody 落到插件内置的
     **硬编码灰色**（深色主题下加粗文字几乎不可见）；插件还会给 h2 + * / hr + * 清零
     上边距、给 tbody tr 加第二道边框。改名 .post-body 后这些默认值一概不存在——
     没有写规则的标签（strong/em/h4…）直接继承 body 的 color: var(--app-ink)。
     母版无 !important，这里同样不写。 */
  /* ⚠️ 以下版式是**本项目的刻意调整**，按需求参考
     http://ceoedu-pro.ceotheme.com/501.html 的文章模块重排为：
       h1 → 底色块 + 左侧竖条；h2 → 左侧竖条；h3 → 左侧圆点；
       引用 → 圆角底色卡 + 左上/右下角实心引号；无序列表 → 主题色圆点 + 虚线分隔；
       代码块 → 左侧色条；图片 → 居中。
     竖条 / 圆点 / 色条一律用 --app-accent
     （= 目录光点 li.toc-active .toc-dot 的颜色），
     于是正文的小节标记与右侧目录的激活点读作同一套视觉语言。
     h1 底色块与引用卡共用 --app-content-block（白色，浅色 12% / 深色 14%）。
     引用的角引号是例外：它按参考站的雪碧图复刻、颜色也向它看齐（灰色而非 accent）。 */
  /* 一级标题：**底色块 + 左侧竖条**（参考 .single-content h1）。
     参考站原写法：
       .single-content h1 { position:relative; margin:20px 0; font-size:20px;
                            font-weight:900; background:#f9f9f9; padding:10px 10px 10px 20px; }
       .single-content h1:after { left:0; top:9px; height:25px; width:5px; ... }
     两点改动：字号沿用本站刻度（1.375rem，见下）；底色用 --app-accent-soft 而非
     写死的 #f9f9f9 —— 那种近白灰在本站玻璃卡上几乎看不出来，而 accent 浅底
     两套主题都读得出来，也和竖条/圆点同族。
     竖条的 top 用 calc 精确落在「上内边距 + 首行中线」上：上内边距 0.625rem，
     行高 1.4em、竖条高 1.25em，故再下移 (1.4em-1.25em)/2。
     ⚠️ 这里刻意不加整行下横线：参考站的 h1 是底色块形态，两者叠加会堆砌。
     要加下横线就把 border-bottom 加回来。 */
  .post-body h1 {
    position: relative;
    margin: 3rem 0 1.25rem;
    padding: 0.625rem 0.75rem 0.625rem 1.25rem;
    background: var(--app-content-block);
    border-radius: 0.5rem;
    /* 1.25rem = 20px：与参考站 h1 一致（它 h1/h2 同为 20px，靠底色块 + 竖条区分）。
       必须明显低于页面标题的 text-2xl(24px)，否则移动端会与之同字号。 */
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.4;
    color: var(--app-ink);
  }
  .post-body h1::before {
    content: "";
    position: absolute;
    left: 0;
    top: calc(0.625rem + (1.4em - 1.25em) / 2);
    width: 5px;
    height: 1.25em;
    border-radius: 2px;
    background: var(--app-accent);
    box-shadow: 3px 0 10px -1px var(--app-accent);
  }
  /* 二级标题：不画整行下横线，改为**左侧竖条**（参考 ceo-edu 主题 .single-content h2）。
     参考实现的原始写法（关键几何逐条对齐，颜色换成项目的语义 token）：
       .single-content h2 { position:relative; padding-left:20px; font-size:20px; }
       .single-content h2:after { left:0; top:0; height:25px; width:5px;
                                  background:var(--primary-color);
                                  box-shadow:3px 0 10px -1px var(--primary-color);
                                  border-radius:2px; }
     两处刻意的偏差：
       ① 竖条高度写成 1.25em 而不是固定 25px —— 参考里 25px 是「字号 20px 的 1.25 倍」，
          写成 em 才在字号变化时仍保持同比例；
       ② 竖条对齐**首行中线**而不是 top:0 —— 参考靠 line-height≈25px 恰好贴齐，
          而本项目 h2 没定行高（会继承 1.75，竖条会明显偏上）。这里显式定
          line-height:1.5 并取 top:(1.5-1.25)/2 = 0.125em，几何就完全确定了；
          折行时竖条留在首行，与参考一致。
     颜色用 --app-accent —— 与**目录光点**同一个色（globals.css 的
     li.toc-active .toc-dot 就是 background: var(--app-accent)），
     所以正文的小节标记与右侧目录的激活点读作同一套视觉语言。 */
  .post-body h2 {
    position: relative;
    margin: 2.5rem 0 1rem;
    padding-left: 1.25rem;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.5;
    color: var(--app-ink);
  }
  .post-body h2::before {
    content: "";
    position: absolute;
    left: 0;
    top: calc((1.5em - 1.25em) / 2);
    width: 5px;
    height: 1.25em;
    border-radius: 2px;
    background: var(--app-accent);
    box-shadow: 3px 0 10px -1px var(--app-accent);
  }
  /* 三级标题：同一套标记的「降一级」形态 —— 参考站是 5px 实心圆点
     （.single-content h3:after{width:5px;height:5px;border-radius:50px}）。
     于是标题家族读作一个尺度：h1 整行下横线 → h2 竖条 → h3 圆点。 */
  .post-body h3 {
    position: relative;
    margin: 2rem 0 0.75rem;
    padding-left: 1.25rem;
    font-size: 1.125rem;
    font-weight: 700;
    line-height: 1.5;
    color: var(--app-ink);
  }
  .post-body h3::before {
    content: "";
    position: absolute;
    left: 0;
    top: calc((1.5em - 5px) / 2);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--app-accent);
    box-shadow: 3px 0 10px -1px var(--app-accent);
  }
  .post-body p {
    margin: 1rem 0;
    line-height: 1.75;
    text-align: justify; /* 两端对齐；末行默认保持左对齐 */
    color: var(--app-ink-2);
  }
  .post-body a {
    color: var(--app-accent);
    /* 参考站全文是 a{text-decoration:none} —— 正文链接不带下划线。
       本站采纳其观感，但**保留悬停出下划线**：正文里链接若只靠颜色区分，
       对色觉障碍读者不友好，这一条不全照抄。 */
    text-decoration: none;
    text-underline-offset: 4px;
  }
  .post-body a:hover {
    text-decoration: underline;
    text-decoration-color: var(--app-accent-hairline);
  }
  .post-body ul,
  .post-body ol {
    margin: 1rem 0;
    padding-left: 1.5rem;
    color: var(--app-ink-2);
  }
  .post-body ul { list-style: none; }
  .post-body ol { list-style: decimal; }
  .post-body li {
    /* 参考站每条 li 带一道虚线分隔（li{border-bottom:1px dashed #f4f4f4}），
       本站采纳，换成发丝色（#f4f4f4 在浅底上基本看不见）。
       **不采纳**它的 line-height:46px —— 中文长列表会把行距撑到读不下去。 */
    margin: 0.5rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed var(--app-hairline-soft);
    line-height: 1.7;
  }
  .post-body li::marker { color: var(--app-ink-4); }
  /* 无序列表换成自绘圆点（参考 .single-content li{list-style:none} +
     li:after 的 6px 实心圆），与正文标题标记、目录光点同色。
     只取「无序号 + 主题色圆点」，**不取**参考站的 line-height:46px 与
     border-bottom:1px dashed：那套间距在中文长列表里行距会撑到很难读，
     与本站紧凑的正文节奏也不搭。
     圆点用 left:-1rem 落进 ul 的 padding-left(1.5rem) 区里，即距 ul 左缘 8px。
     ⚠️ list-style:none 会让 Safari/VoiceOver 不再播报列表语义（已知取舍，
     要兼顾就得给 ul 补 role="list"，而 ul 由 Markdown 渲染生成、改不了属性）。 */
  .post-body ul > li { position: relative; }
  .post-body ul > li::before {
    content: "";
    position: absolute;
    left: -1rem;
    top: calc((1.7em - 6px) / 2);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--app-accent);
  }
  /* 引用：参考站是**整块圆角卡 + 左上/右下角一对实心引号**
     （.single-content blockquote{border-radius:10px;padding:30px 40px;background:#f8f8f8}
       + blockquote:before/:after 各一个 16×13 的角标）。
     ⚠️ 参考站的角标**不是文字引号**，是 static/images/ceo-sy.png 这张 32×13 的
     雪碧图里的两个实心字形（取样色 #c0c6cc，不透明）。这里按那张图的像素形状
     1:1 复刻成 data-URI SVG（每个字形 = 底部方块 + 一条斜向笔画，两个字形左右对称），
     再用 mask 上色 —— 这样形状与原站一致，颜色却仍能走本站的语义 token
     （SVG 里 fill 写死白色只当 mask 用，不参与配色）。
     参考站的位置是四角内缩 20px、卡片内边距 30/40px；这里按本站版心缩到
     内缩 0.75rem / 内边距 1.875rem 2rem，比例关系不变。 */
  .post-body blockquote {
    position: relative;
    margin: 1.5rem 0;
    padding: 1.875rem 2rem;
    border-radius: 0.625rem;
    background: var(--app-content-block);
    color: var(--app-ink-2);
  }
  .post-body blockquote::before,
  .post-body blockquote::after {
    content: "";
    position: absolute;
    width: 16px;
    height: 13px;
    background-color: var(--app-ink-4);
    opacity: 0.45;
    pointer-events: none;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='13' viewBox='0 0 32 13'%3E%3Cpath fill='%23fff' d='M0 13V6L3.5 0H6.5L3.5 6H7V13ZM9 13V6L12.5 0H15.5L12.5 6H16V13Z'/%3E%3Cg transform='translate(32 13) scale(-1 -1)'%3E%3Cpath fill='%23fff' d='M0 13V6L3.5 0H6.5L3.5 6H7V13ZM9 13V6L12.5 0H15.5L12.5 6H16V13Z'/%3E%3C/g%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='13' viewBox='0 0 32 13'%3E%3Cpath fill='%23fff' d='M0 13V6L3.5 0H6.5L3.5 6H7V13ZM9 13V6L12.5 0H15.5L12.5 6H16V13Z'/%3E%3Cg transform='translate(32 13) scale(-1 -1)'%3E%3Cpath fill='%23fff' d='M0 13V6L3.5 0H6.5L3.5 6H7V13ZM9 13V6L12.5 0H15.5L12.5 6H16V13Z'/%3E%3C/g%3E%3C/svg%3E");
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 32px 13px;
    mask-size: 32px 13px;
  }
  .post-body blockquote::before {
    top: 0.75rem;
    left: 0.75rem;
    -webkit-mask-position: 0 0;
    mask-position: 0 0;
  }
  .post-body blockquote::after {
    right: 0.75rem;
    bottom: 0.75rem;
    -webkit-mask-position: -16px 0;
    mask-position: -16px 0;
  }
  .post-body blockquote p { margin: 0.25rem 0; }
  .post-body code {
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
  .post-body :not(pre) > code {
    border: 1px solid var(--app-hairline-soft);
    border-radius: 0.375rem;
    background: var(--app-surface-strong);
    padding: 0.125rem 0.375rem;
    color: var(--app-accent);
  }
  .post-body pre {
    margin: 1.25rem 0;
    overflow-x: auto;
    border: 1px solid var(--app-hairline-soft);
    border-left: 5px solid var(--app-accent);
    border-radius: var(--radius-card-sm);
    background: var(--app-stage);
    padding: 1rem;
    font-size: 0.875rem;
    line-height: 1.7;
  }
  /* background: transparent 是本项目独有的一行补丁：母版不带 highlight.js 主题，
     而本项目引了 highlight.js/styles/vs2015.css（其 .hljs 自带 #1e1e1e 底色），
     不清掉就会在 --app-stage 的 pre 里再叠一层浅灰方块。 */
  .post-body pre code {
    background: transparent;
    color: var(--app-stage-ink);
  }
  .post-body img {
    display: block;
    margin: 1.25rem auto;
    border: 1px solid var(--app-hairline-soft);
    border-radius: var(--radius-card);
    max-width: 100%;
    height: auto;
  }
  .post-body hr {
    margin: 2rem 0;
    border: 0;
    border-top: 1px solid var(--app-hairline-soft);
  }
  .post-body table {
    margin: 1.25rem 0;
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--app-hairline-soft);
    font-size: 0.875rem;
  }
  .post-body th {
    border-bottom: 1px solid var(--app-hairline);
    border-right: 1px solid var(--app-hairline-soft);
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 700;
    color: var(--app-ink);
  }
  .post-body td {
    border-bottom: 1px solid var(--app-hairline-soft);
    border-right: 1px solid var(--app-hairline-soft);
    padding: 0.5rem 0.75rem;
    color: var(--app-ink-2);
  }
  .post-body pre code .hljs-comment, .post-body pre code .hljs-quote { color: #5c6370; font-style: italic; }
  .post-body pre code .hljs-keyword, .post-body pre code .hljs-selector-tag, .post-body pre code .hljs-doctag, .post-body pre code .hljs-name, .post-body pre code .hljs-formula, .post-body pre code .hljs-keyword.type_ { color: #c678dd; }
  .post-body pre code .hljs-string, .post-body pre code .hljs-regexp, .post-body pre code .hljs-addition, .post-body pre code .hljs-meta .hljs-string, .post-body pre code .hljs-meta-string { color: #98c379; }
  .post-body pre code .hljs-number, .post-body pre code .hljs-literal, .post-body pre code .hljs-symbol, .post-body pre code .hljs-attr, .post-body pre code .hljs-variable.constant_, .post-body pre code .hljs-selector-attr, .post-body pre code .hljs-selector-pseudo { color: #d19a66; }
  .post-body pre code .hljs-title, .post-body pre code .hljs-title.function_, .post-body pre code .hljs-section, .post-body pre code .hljs-bullet, .post-body pre code .hljs-link, .post-body pre code .hljs-selector-id { color: #61afef; }
  .post-body pre code .hljs-built_in, .post-body pre code .hljs-deletion, .post-body pre code .hljs-variable, .post-body pre code .hljs-template-variable, .post-body pre code .hljs-subst { color: #e06c75; }
  .post-body pre code .hljs-type, .post-body pre code .hljs-class .hljs-title, .post-body pre code .hljs-title.class_, .post-body pre code .hljs-selector-class, .post-body pre code .hljs-attribute { color: #e5c07b; }
  .post-body pre code .hljs-meta, .post-body pre code .hljs-keyword.control-flow, .post-body pre code .hljs-meta .hljs-keyword { color: #61afef; }
  .post-body pre code .hljs-params, .post-body pre code .hljs-operator, .post-body pre code .hljs-punctuation { color: #abb2bf; }
  .search-highlight {
    background-color: var(--app-tones-warn-soft);
    color: var(--app-tones-warn);
    border-radius: 3px;
    padding: 0 2px;
    font-weight: 700;
  }
`;
