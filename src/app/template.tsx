// App Router template：与 layout 不同，每次路由切换都会重新挂载。
// 借此给每个 tab 页面一个轻量入场动画（淡入 + 上滑），让切换被用户感知。
// 动画见 globals.css 的 .tem-page-enter。
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="tem-page-enter">{children}</div>;
}
