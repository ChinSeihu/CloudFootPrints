// 复制文本到剪贴板。优先用异步 Clipboard API，失败则回退到 execCommand
// （兼容非安全上下文 / 老环境）。返回是否成功。仅客户端可用。
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 首选：现代 Clipboard API（需安全上下文 + 用户手势）
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到 fallback */
  }

  // 回退：临时 textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
