"use client";

import { Avatar } from "./Avatar";
import type { CommentDTO } from "@/lib/types";

type CheckinCommentThreadsProps = {
  comments: CommentDTO[];
  onReply: (root: CommentDTO) => void;
};

const commentDateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

/**
 * Signature: `function CheckinCommentThreads({ comments, onReply }: CheckinCommentThreadsProps): React.JSX.Element`
 * Purpose: Share avatar, timestamp, threaded replies and root-discussion reply actions across footprint feeds.
 */
export function CheckinCommentThreads({ comments, onReply }: CheckinCommentThreadsProps) {
  const repliesByRoot = new Map<string, CommentDTO[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const replies = repliesByRoot.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByRoot.set(comment.parentId, replies);
  }
  const roots = comments.filter((comment) => !comment.parentId);
  if (!roots.length) return <p className="py-1 text-xs text-neutral-500">还没有评论。</p>;

  return (
    <div className="space-y-3">
      {roots.map((root) => (
        <div key={root.id}>
          {[root, ...(repliesByRoot.get(root.id) ?? [])].map((comment) => {
            const isReply = comment.id !== root.id;
            const date = new Date(comment.createdAt);
            return (
              <div key={comment.id} className={`flex gap-2 ${isReply ? "ml-5 mt-2 border-l border-neutral-200 pl-3" : ""}`}>
                <Avatar user={comment.author} size={isReply ? 24 : 28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                    <span className="font-semibold text-neutral-800">{comment.author?.username ?? "用户"}</span>
                    <time dateTime={comment.createdAt} className="text-neutral-500">
                      {Number.isNaN(date.getTime()) ? "" : commentDateFormat.format(date)}
                    </time>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-neutral-700">{comment.text}</p>
                  <button type="button" onClick={() => onReply(root)} className="py-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900">
                    {isReply ? "回复此讨论" : "回复"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
