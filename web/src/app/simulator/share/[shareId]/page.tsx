/**
 * 分享页（公开） — /simulator/share/[shareId]
 *
 * 服务端组件：直接读 DB 渲染人设卡，不需要客户端再发请求。
 * 失败时展示"链接已失效"友好提示。
 */

import Link from "next/link";
import { handleGetShare } from "@/lib/future/simulator-server";
import { getSimulatorShare } from "@/lib/future/simulator-client";
import { FuturePanel, FutureShell, SectionHeading } from "../../../future/FutureShell";
import type { SimulatorEnding } from "@/lib/future/simulator-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ shareId: string }>;
}

export default async function SharedEndingPage({ params }: PageProps) {
  const { shareId } = await params;
  const share = await loadShare(shareId);

  return (
    <FutureShell
      title="大学人设卡"
      backHref="/simulator"
      backLabel="我也试试"
      mainClassName="pb-10"
    >
      <div className="mx-auto max-w-[1100px] space-y-5">
        {share ? (
          <SharedEndingCard school={share.school} major={share.major} ending={share.ending} />
        ) : (
          <NotFoundPanel />
        )}
      </div>
    </FutureShell>
  );
}

async function loadShare(shareId: string) {
  try {
    return await handleGetShare(shareId);
  } catch {
    // 服务端直连失败时（开发态/无 DB 部署）尝试走 API
    try {
      return await getSimulatorShare(shareId);
    } catch {
      return null;
    }
  }
}

function SharedEndingCard({
  school,
  major,
  ending,
}: {
  school: string;
  major?: string;
  ending: SimulatorEnding | Record<string, unknown>;
}) {
  const e = ending as SimulatorEnding;
  return (
    <>
      <FuturePanel className="overflow-hidden p-0">
        <div className="grid gap-5 bg-gradient-to-br from-brand-50/55 via-surface-elevated to-accent-50/35 px-5 py-6 sm:px-7 sm:py-8">
          <div className="text-xs font-medium text-accent">
            {school}
            {major ? ` · ${major}` : ""} · 大学人设卡
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-4xl">
            {e.archetype || "我的人设卡"}
          </h1>
          {e.summary && (
            <p className="max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">{e.summary}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {e.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-brand-200/40 bg-brand-50/50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-2 border-t border-border bg-surface-elevated/85 p-5 sm:grid-cols-2 sm:p-6">
          {e.gpa_estimate && (
            <SharedMetric label="GPA 估计" value={e.gpa_estimate} />
          )}
          {e.social_circle && (
            <SharedMetric label="社交圈" value={e.social_circle} />
          )}
        </div>
      </FuturePanel>

      {Array.isArray(e.turning_moments) && e.turning_moments.length > 0 && (
        <FuturePanel className="p-5 sm:p-6">
          <SectionHeading title="关键转折" description="这几次选择塑造了这条轨迹。" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {e.turning_moments.map((tm) => (
              <div key={tm.round} className="rounded-xl border border-border bg-surface-subtle/65 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent/12 font-mono text-[11px] font-semibold text-accent">
                    {tm.round}
                  </span>
                  <p className="min-w-0 truncate text-sm font-semibold text-text">「{tm.choice_label}」</p>
                </div>
                <p className="text-xs leading-6 text-text-secondary">{tm.consequence}</p>
              </div>
            ))}
          </div>
        </FuturePanel>
      )}

      {e.closing_message && (
        <FuturePanel className="p-5 sm:p-6">
          <SectionHeading title="寄语" description="给这条轨迹的一句话。" />
          <p className="mt-4 max-w-2xl text-sm italic leading-7 text-text-secondary">
            &ldquo;{e.closing_message}&rdquo;
          </p>
        </FuturePanel>
      )}

      <FuturePanel className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-text">看完 TA 的人设卡，想不想看看自己的？</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            选一所学校、一个专业，8 轮选择生成你的大学人设卡。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/simulator"
            className="inline-flex items-center justify-center rounded-xl border border-accent/35 bg-accent px-5 py-2.5 text-sm font-medium text-text-inverse transition hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          >
            我也来模拟
          </Link>
        </div>
      </FuturePanel>
    </>
  );
}

function SharedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated/85 p-3">
      <div className="text-[11px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-5 text-text">{value}</div>
    </div>
  );
}

function NotFoundPanel() {
  return (
    <FuturePanel className="p-8 text-center">
      <div className="text-4xl">🔗</div>
      <p className="mt-3 text-sm font-semibold text-text">这条分享链接已经失效</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        可能服务器重启过，或分享已被撤销。重新玩一局，生成你自己的吧。
      </p>
      <Link
        href="/simulator"
        className="mt-5 inline-flex items-center justify-center rounded-xl border border-accent/35 bg-accent px-5 py-2.5 text-sm font-medium text-text-inverse transition hover:bg-accent-500"
      >
        开始新的一局
      </Link>
    </FuturePanel>
  );
}
