/**
 * 分享功能端到端测试：直连 Neon DB
 *
 * 流程：
 * 1. 调用 handleCreateShare → 触发 lazy init 建表
 * 2. 调用 handleGetShare → 读出
 * 3. 校验字段
 * 4. 调用 handleGetShare（不存在的 id）→ 期望抛错
 * 5. 输出 psql 可验证的 shareId
 *
 * 使用方式：pnpm tsx share-test.ts
 */

import { handleCreateShare, handleGetShare } from './src/lib/future/simulator-server';
import { getPostgresPool } from './src/lib/future/pg-client';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set in env");
  process.exit(1);
}

async function main() {
  console.log("=== 分享功能端到端测试 ===\n");

  // 0. 先看一下表是否存在
  const pool = new Pool({ connectionString: DATABASE_URL });
  console.log("[0] 启动前查 simulator_shares 表…");
  const before = await pool.query("select to_regclass('public.simulator_shares') as exists");
  console.log("  simulator_shares 存在:", before.rows[0].exists ?? "否（会触发 lazy init）");

  // 1. 先创建一个假 session（直接写库）作为分享源
  console.log("\n[1] 写入假 session…");
  const fakeSessionId = `sim_test_${Date.now().toString(36)}`;
  await pool.query(
    `insert into simulator_sessions (id, status, profile_json, total_rounds, current_round, history_json, ending_json)
     values ($1, 'ended', $2::jsonb, 8, 8, '[]'::jsonb, $3::jsonb)`,
    [
      fakeSessionId,
      JSON.stringify({ school: "武汉大学", major: "计算机", gender: "male", personalityTags: ["理性"], interests: ["计算机"], riskTolerance: 5 }),
      JSON.stringify({
        archetype: "小镇学霸型",
        summary: "在武大度过了充实的四年，最终选择了继续深造。",
        tags: ["理性", "踏实", "略内敛", "目标导向"],
        gpa_estimate: "3.6-3.9/4.0",
        social_circle: "有 1 个紧密的实验室小组，认识若干学长",
        closing_message: "找到自己擅长的方向，比什么都重要。",
        turning_moments: [
          { round: 2, choice_label: "加入 ACM 集训队", consequence: "为后来保研打下基础" },
          { round: 6, choice_label: "暑假留校做科创", consequence: "拿下一篇一作论文" },
        ],
      }),
    ],
  );
  console.log(`  ✅ session ${fakeSessionId} 创建`);

  // 2. 调 handleCreateShare（这会触发 lazy init：跑 SIMULATOR_SCHEMA_SQL + 写 share）
  console.log("\n[2] 调 handleCreateShare（这步会触发 lazy init）…");
  const t0 = Date.now();
  const created = await handleCreateShare({
    sessionId: fakeSessionId,
    school: "武汉大学",
    major: "计算机",
    ending: {
      archetype: "小镇学霸型",
      summary: "在武大度过了充实的四年，最终选择了继续深造。",
      tags: ["理性", "踏实", "略内敛", "目标导向"],
      gpa_estimate: "3.6-3.9/4.0",
      social_circle: "有 1 个紧密的实验室小组，认识若干学长",
      closing_message: "找到自己擅长的方向，比什么都重要。",
      turning_moments: [
        { round: 2, choice_label: "加入 ACM 集训队", consequence: "为后来保研打下基础" },
        { round: 6, choice_label: "暑假留校做科创", consequence: "拿下一篇一作论文" },
      ],
    },
  });
  const elapsed = Date.now() - t0;
  console.log(`  ✅ shareId = ${created.shareId}（${elapsed}ms）`);

  // 3. 校验 lazy init 确实建了表
  console.log("\n[3] 校验 simulator_shares 表已被 lazy init 创建…");
  const after = await pool.query("select to_regclass('public.simulator_shares') as exists");
  if (!after.rows[0].exists) {
    console.error("  ❌ simulator_shares 表仍未创建（lazy init 失败）");
    process.exit(1);
  }
  console.log(`  ✅ simulator_shares 表已建`);

  // 4. 用 psql 查一下表结构
  const cols = await pool.query("select column_name, data_type from information_schema.columns where table_name='simulator_shares' order by ordinal_position");
  console.log("  表字段：");
  for (const c of cols.rows) {
    console.log(`    - ${c.column_name} (${c.data_type})`);
  }

  // 5. psql 验证：拿 shareId 直接查
  console.log(`\n[5] psql 验证 shareId=${created.shareId} 真实存在…`);
  const row = await pool.query("select id, session_id, school, major, ending_json->>'archetype' as archetype, created_at from simulator_shares where id=$1", [created.shareId]);
  if (row.rows.length === 0) {
    console.error("  ❌ 写库失败");
    process.exit(1);
  }
  console.log("  真实写入的内容：", row.rows[0]);

  // 6. 调 handleGetShare 验证读出
  console.log("\n[6] 调 handleGetShare 读出…");
  const got = await handleGetShare(created.shareId);
  console.log(`  ✅ 读出 shareId=${got.shareId} school=${got.school} major=${got.major} archetype=${(got.ending as any).archetype}`);

  // 7. 校验字段一致性
  const e = got.ending as any;
  if (e.archetype !== "小镇学霸型") throw new Error("archetype mismatch");
  if (!Array.isArray(e.tags) || e.tags.length !== 4) throw new Error("tags mismatch");
  if (e.turning_moments.length !== 2) throw new Error("turning_moments mismatch");
  console.log("  ✅ 字段一致性校验通过");

  // 8. 测错误路径：shareId 不存在
  console.log("\n[7] 测错误路径：不存在的 shareId…");
  try {
    await handleGetShare("shr_does_not_exist");
    console.error("  ❌ 应当抛错");
    process.exit(1);
  } catch (err) {
    console.log(`  ✅ 正确抛错：${err instanceof Error ? err.message : String(err)}`);
  }

  // 9. 测错误路径：sessionId 不存在
  console.log("\n[8] 测错误路径：不存在的 sessionId…");
  try {
    await handleCreateShare({
      sessionId: "sim_does_not_exist",
      school: "X",
      ending: { archetype: "test" },
    });
    console.error("  ❌ 应当抛错");
    process.exit(1);
  } catch (err) {
    console.log(`  ✅ 正确抛错：${err instanceof Error ? err.message : String(err)}`);
  }

  // 10. 测错误路径：ending 缺 archetype
  console.log("\n[9] 测错误路径：ending 缺 archetype…");
  try {
    await handleCreateShare({
      sessionId: fakeSessionId,
      school: "武汉大学",
      ending: { summary: "no archetype" },
    });
    console.error("  ❌ 应当抛错");
    process.exit(1);
  } catch (err) {
    console.log(`  ✅ 正确抛错：${err instanceof Error ? err.message : String(err)}`);
  }

  // 11. 清理测试数据
  console.log("\n[10] 清理测试数据…");
  await pool.query("delete from simulator_shares where id=$1", [created.shareId]);
  await pool.query("delete from simulator_sessions where id=$1", [fakeSessionId]);
  console.log("  ✅ 清理完成");

  await pool.end();
  console.log("\n=== ✅ 全部通过 ===");
  console.log(`分享链接示例：/simulator/share/${created.shareId}`);
}

main().catch((err) => {
  console.error("❌ 测试失败：", err);
  process.exit(1);
});
