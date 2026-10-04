/** 正文排版样式 .post-body 的唯一定义处。 */
export const POST_BODY_STYLE = `
  /* 正文排版：刻意不用 .prose（深色下不可见）；标记体系与目录光点同用 --app-accent。 */
  /* 一级标题：底色块 + 左侧竖条，竖条用 calc 落在首行中线。 */
  .post-body h1 {
    position: relative;
    margin: 3rem 0 1.25rem;
    padding: 0.625rem 0.75rem 0.625rem 1.25rem;
    background: var(--app-content-block);
    border-radius: 0.5rem;
    /* 1.25rem：必须明显低于页面标题的 text-2xl(24px)。 */
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
  /* 二级标题：左侧竖条。高度写 1.25em 以便随字号缩放，top 对齐首行中线（故须显式定 line-height）。 */
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
  /* 三级标题：同套标记降一级 —— 5px 实心圆点。 */
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
    /* 去掉下划线，但保留悬停出下划线 —— 只靠颜色区分对色觉障碍读者不友好。 */
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
    /* 每条 li 一道虚线分隔（用发丝色）。 */
    margin: 0.5rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed var(--app-hairline-soft);
    line-height: 1.7;
  }
  .post-body li::marker { color: var(--app-ink-4); }
  /* 无序列表自绘主题色圆点；list-style:none 会让 Safari/VoiceOver 不再播报列表语义（已知取舍）。 */
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
  /* 引用整块圆角卡 + 角引号：角引号为 data-URI SVG 复刻，用 mask 上色以走本站 token。 */
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
  /* 清掉 highlight.js 主题自带的 .hljs 底色，否则会在 pre 上再叠一层灰块。 */
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
