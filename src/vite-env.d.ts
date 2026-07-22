/// <reference types="vite/client" />

// 允许以 `?url` 方式导入静态资源（构建时自动拷贝到 dist 并返回最终 URL）
declare module '*?url' {
  const src: string;
  export default src;
}
