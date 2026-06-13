"use client";

/**
 * 分享人设卡弹层（受控组件）
 *
 * 父组件持有 share 状态：open / status / shareId / errorMsg。
 * 本组件只负责 UI 渲染和复制交互。
 *
 * 提供三种分享方式：
 * 1. 复制链接（公开分享页 URL）
 * 2. 复制文案（朋友圈/微博/小红书风格，带 archetype + 学校 + 链接）
 * 3. 复制"我也来模拟"引导文案（拉新用）
 */

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { SimulateSession, SimulatorEnding } from "@/lib/future/simulator-types";

export type ShareStatus = "creating" | "ready" | "error";

interface ShareDialogProps {
  open: boolean;
  status: ShareStatus;
  shareId: string | null;
  errorMsg: string;
  session: SimulateSession;
  ending: SimulatorEnding;
  onClose: () => void;
}

export function ShareDialog({ open, status, shareId, errorMsg, session, ending, onClose }: ShareDialogProps) {
  const [copiedKey, setCopiedKey] = useState<"link" | "text" | "invite" | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !shareId) return "";
    return `${window.location.origin}/simulator/share/${shareId}`;
  }, [shareId]);

  const postText = useMemo(() => buildSharePostText(ending, session.profile.school, shareUrl), [ending, session.profile.school, shareUrl]);
  const inviteText = useMemo(() => buildInviteText(ending, session.profile.school, shareUrl), [ending, session.profile.school, shareUrl]);

  async function copyToClipboard(key: "link" | "text" | "invite", text: string) {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 兜底：textarea + execCommand
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
    } catch {
      // 静默失败，用户会看到按钮没变化
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-t-2xl border border-border bg-surface-elevated p-5 shadow-[0_24px_60px_-20px_rgba(17,24,32,0.5)] sm:rounded-2xl sm:p-6"
            initial={{ y: 30, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="share-dialog-title" className="text-base font-semibold text-text">
                  分享我的人设卡
                </h3>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  把这段大学轨迹分享给同学，看看他们会走出什么样的人设。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="rounded-lg p-1 text-text-muted transition hover:bg-surface-hover hover:text-text-secondary"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {status === "creating" && (
                <div className="rounded-xl border border-border/70 bg-surface-subtle/60 px-4 py-6 text-center text-xs text-text-muted">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent align-middle" />
                  <span className="ml-2">正在生成分享链接…</span>
                </div>
              )}

              {status === "error" && (
                <div className="rounded-xl border border-danger-300/40 bg-danger-soft px-4 py-3 text-xs text-danger">
                  {errorMsg || "创建分享失败，请稍后重试。"}
                </div>
              )}

              {status === "ready" && shareUrl && (
                <>
                  <ShareRow
                    title="复制分享链接"
                    description="任何打开链接的人都可以看到你的人设卡"
                    preview={shareUrl}
                    buttonLabel={copiedKey === "link" ? "已复制" : "复制链接"}
                    copied={copiedKey === "link"}
                    onClick={() => copyToClipboard("link", shareUrl)}
                  />
                  <ShareRow
                    title="复制朋友圈文案"
                    description="适合发朋友圈/微博/小红书"
                    preview={truncate(postText, 96)}
                    buttonLabel={copiedKey === "text" ? "已复制" : "复制文案"}
                    copied={copiedKey === "text"}
                    onClick={() => copyToClipboard("text", postText)}
                    multiline
                  />
                  <ShareRow
                    title="发给同学邀请比一比"
                    description="带邀请口吻的私聊文案"
                    preview={truncate(inviteText, 96)}
                    buttonLabel={copiedKey === "invite" ? "已复制" : "复制邀请"}
                    copied={copiedKey === "invite"}
                    onClick={() => copyToClipboard("invite", inviteText)}
                    multiline
                  />
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-border bg-surface-subtle/40 px-4 py-2.5 text-center text-xs text-text-secondary transition hover:border-accent/40 hover:text-text"
                  >
                    打开分享页预览 →
                  </a>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShareRow({
  title,
  description,
  preview,
  buttonLabel,
  copied,
  onClick,
  multiline = false,
}: {
  title: string;
  description: string;
  preview: string;
  buttonLabel: string;
  copied: boolean;
  onClick: () => void;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-subtle/45 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-0.5 text-[11px] text-text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            copied
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-accent/30 bg-accent/8 text-accent hover:bg-accent/15"
          }`}
        >
          {buttonLabel}
        </button>
      </div>
      <p className={`mt-2 text-[11px] leading-5 text-text-muted ${multiline ? "" : "truncate"}`}>
        {preview}
      </p>
    </div>
  );
}

function truncate(text: string, max: number) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildSharePostText(ending: SimulatorEnding, school: string, url: string): string {
  const tagLine = ending.tags?.slice(0, 3).map((t) => `#${t}`).join(" ") || "";
  const archetype = ending.archetype || "大学人设卡";
  const summary = ending.summary || "";
  const lines = [
    `【${school} · 大学人设卡】${archetype}`,
    summary ? `「${truncate(summary, 80)}」` : "",
    tagLine,
    url,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildInviteText(ending: SimulatorEnding, school: string, url: string): string {
  const archetype = ending.archetype || "这个人";
  return `我刚在「大学人生模拟器」上玩了一局，生成的人设卡是「${archetype}」，太准了哈哈。你也来试试看：${url}（${school}）`;
}
