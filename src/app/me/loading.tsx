// 个人页加载态：切到本 tab 时立即显示，消除"卡住"感。
export default function Loading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-blue-600 animate-spin" />
    </div>
  );
}
