import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // API 数据转换处大量 any，降为警告便于逐步收敛。
      "@typescript-eslint/no-explicit-any": "warn",
      // 后台表单从请求结果初始化 state 会命中这条，降为警告。
      "react-hooks/set-state-in-effect": "warn",
      // 未使用变量：允许用 `_` 前缀显式标记「就是不用」。
      // 主要服务「解构丢弃」这一写法，例如 SafeImage 里把 next/image 专有属性摘掉：
      //   const { unoptimized: _u, loader: _l, ...domAttrs } = rest;
      // 不配这条时，ignoreRestSiblings 不生效，四个 `_x` 会各报一条警告。
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // .workbuddy 是项目数据目录（记忆、临时快照），里面的源码副本不参与 lint
    ".workbuddy/**",
  ]),
]);

export default eslintConfig;
