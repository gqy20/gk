import { AnthropicProvider } from './src/lib/future/anthropic';
import type { GenerateStructuredInput } from './src/lib/future/anthropic';
import { simulateStepTool, generateEndingTool } from './src/lib/future/simulator-schema';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

const PROVIDER_CFG = {
  apiKey: '3vnGPaV7MkLN512uCuuXD9j2JNF2AgOjJe5F1LqXb5cL6XnnCdTaDxihG5wOHEvmQ',
  baseUrl: 'https://api.stepfun.com/step_plan',
  model: 'step-3.7-flash',
  anthropicVersion: '2023-06-01',
};

const promptsRaw = fs.readFileSync('./src/lib/future/simulator-prompts.yaml', 'utf-8');
const cfg = yaml.load(promptsRaw) as any;

async function generateStructuredWithRetry<T extends import('./src/lib/future/anthropic').StructuredToolShape>(
  provider: AnthropicProvider,
  args: GenerateStructuredInput<T>,
) {
  const baseMax = args.maxTokens ?? 4096;
  const baseTemp = args.temperature ?? 0.75;
  const attempts = [
    { label: 'primary', maxTokens: baseMax, temperature: baseTemp },
    { label: 'retry-same', maxTokens: baseMax, temperature: baseTemp },
    { label: 'retry-loose', maxTokens: Math.min(baseMax * 2, 16384), temperature: Math.max(0.3, baseTemp - 0.3) },
  ];
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]!;
    try {
      const r = await provider.generateStructured<T>({ ...args, maxTokens: a.maxTokens, temperature: a.temperature });
      if (i > 0) console.log(`    [retry:${a.label}] recovered after ${i} failure(s)`);
      return r;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      const isRetryable = /missing tool_use|max_tokens|Failed to parse streamed tool_use JSON/i.test(msg);
      const isClientError = /\b(4\d\d)\b/.test(msg);
      if (!isRetryable || isClientError) throw lastErr;
      console.log(`    [retry:${a.label}] ${msg.slice(0, 120)} → try ${attempts[i+1]?.label ?? 'NONE'}`);
    }
  }
  throw lastErr;
}

interface Profile {
  school: string;
  context: string;
  major: string;
  gender: string;
  tags: string;
  interests: string;
  risk: number;
}

// 10 个差异化档案，覆盖：性别(3) / 层次(2 类) / 类型(4 类) / 文理工 / 风险偏好(3)
// 设计目标：测试各种 profile 组合下的逻辑稳定性
const PROFILES: Profile[] = [
  { school: '武汉大学', context: '\n- 学校层次：985\n- 学校类型：综合', major: '- 专业方向：计算机', gender: '- 性别设定：男生', tags: '理性 好奇', interests: '计算机 社交 阅读', risk: 5 },
  { school: '北京师范大学', context: '\n- 学校层次：985\n- 学校类型：师范', major: '- 专业方向：汉语言文学', gender: '- 性别设定：女生', tags: '安静 内向', interests: '写作 阅读 文学', risk: 3 },
  { school: '西安交通大学', context: '\n- 学校层次：985\n- 学校类型：理工', major: '- 专业方向：能源与动力工程', gender: '- 性别设定：男生', tags: '踏实 勤奋', interests: '工程 篮球 物理', risk: 4 },
  { school: '上海财经大学', context: '\n- 学校类型：财经', major: '- 专业方向：金融学', gender: '- 性别设定：女生', tags: '精明 进取', interests: '金融 投资 社交', risk: 8 },
  { school: '北京航空航天大学', context: '\n- 学校层次：985\n- 学校类型：理工', major: '- 专业方向：航空航天工程', gender: '- 性别设定：未指定', tags: '理性 好奇', interests: '航空 编程 阅读', risk: 6 },
  { school: '复旦大学', context: '\n- 学校层次：985\n- 学校类型：综合', major: '- 专业方向：新闻传播', gender: '- 性别设定：女生', tags: '外向 表达欲强', interests: '写作 摄影 社交', risk: 7 },
  { school: '中国政法大学', context: '\n- 学校层次：211\n- 学校类型：政法', major: '- 专业方向：法学', gender: '- 性别设定：女生', tags: '严谨 好辩', interests: '辩论 读书 时事', risk: 4 },
  { school: '同济大学', context: '\n- 学校层次：985\n- 学校类型：理工', major: '- 专业方向：建筑学', gender: '- 性别设定：男生', tags: '审美 慢热', interests: '设计 美术 旅行', risk: 5 },
  { school: '中山大学', context: '\n- 学校层次：985\n- 学校类型：综合', major: '- 专业方向：临床医学', gender: '- 性别设定：女生', tags: '细致 抗压', interests: '生物 公益 跑步', risk: 3 },
  { school: '南京大学', context: '\n- 学校层次：985\n- 学校类型：综合', major: '- 专业方向：物理学', gender: '- 性别设定：未指定', tags: '内敛 求知', interests: '物理 数学 哲学', risk: 4 },
];

// 8 轮的细粒度时间锚点（与 simulator-prompts.ts 中 buildRoundProgression 一致）
const ROUND_TIME_ANCHORS: Record<number, string> = {
  1: '9 月·入学第一周',
  2: '9 月底~10 月初·社团招新周',
  3: '10 月中·学业与社团撞期',
  4: '11 月·期中考试前后',
  5: '次年 3 月·大一下开学',
  6: '次年 5-6 月·大一下期末',
  7: '大二上 10 月·专业深入',
  8: '大三 9-10 月·方向定型',
};

function buildSys(p: Profile, round: number, totalRounds: number) {
  return cfg.system_prompts.main_narrative_engine
    .replace('${profile.school}', p.school)
    .replace('${school_context_lines}', p.context)
    .replace('${profile_major_line}', p.major)
    .replace('${profile_gender_line}', p.gender)
    .replace('${profile.personalityTags}', p.tags)
    .replace('${profile.interests}', p.interests)
    .replace('${profile.riskTolerance}', String(p.risk))
    .replace('${round}', String(round))
    .replace('${totalRounds}', String(totalRounds))
    .replace('${round_progression}', '第 1 轮（9 月·入学第一周）：报到、宿舍初见、新生班会\n       - **第 2 轮（9 月底~10 月初·社团招新周）**：百团大战、第一次选课、兴趣试探\n       - **第 3 轮（10 月中·学业与社团撞期）**：第一次月考/小测、社团任务进入日常、室友/同学关系定型\n       - **第 4 轮（11 月·期中考试前后）**：第一次大考、人际小摩擦或加深、寒冬前的小决策\n       - **第 5 轮（次年 3 月·大一下开学）**：新学期定位、分流/方向初步选择、寒假后的节奏调整\n       - **第 6 轮（次年 5-6 月·大一下期末）**：期末季、暑期规划（实习/科研/竞赛/旅行）\n       - **第 7 轮（大二上 10 月·专业深入）**：核心专业课、初步科研/竞赛/学生组织角色\n       - **第 8 轮（大三 9-10 月·方向定型）**：保研/考研/就业的第一次明确岔路口、关键 mentor 关系');
}

// ── 复读检测：拿一段 outcome 文字，和历史里所有前序 outcome 比，提取 6 字以上公共子串 ──
function detectRepetition(currOutcome: string, priorOutcomes: string[]): string | null {
  if (!currOutcome || priorOutcomes.length === 0) return null;
  // 切片为长度 8+ 的连续中文字符片段
  const len = 8;
  for (const prior of priorOutcomes) {
    if (!prior) continue;
    for (let i = 0; i + len <= prior.length; i++) {
      const snippet = prior.slice(i, i + len);
      if (currOutcome.includes(snippet) && !/^(你|他|她|的|了|是|在|和|有|跟)/.test(snippet)) {
        return `"${snippet}" (引自前轮 outcome)`;
      }
    }
  }
  return null;
}

function checkResult(
  data: any,
  round: number,
  prevRound: number,
  prevChoice: string,
  priorOutcomes: string[],
): string[] {
  const issues: string[] = [];
  if (typeof data !== 'object' || data === null) { issues.push('not object'); return issues; }
  if (typeof data.scene_title !== 'string' || !data.scene_title.trim()) issues.push('no scene_title');
  if (data.scene_title && data.scene_title.length > 16) issues.push(`scene_title>16(${data.scene_title.length})`);
  if (typeof data.scene_description !== 'string' || !data.scene_description.trim()) issues.push('no scene_description');
  if (data.scene_description && data.scene_description.length < 80) issues.push(`scene_description<80(${data.scene_description.length})`);
  if (data.scene_description && data.scene_description.length > 250) issues.push(`scene_description>250(${data.scene_description.length})`);

  if (!Array.isArray(data.choices)) { issues.push('choices not array'); return issues; }
  if (data.choices.length !== 3) issues.push(`choices=${data.choices.length}`);
  for (let i = 0; i < data.choices.length; i++) {
    const c = data.choices[i];
    if (!c?.id) issues.push(`c${i} no id`);
    if (typeof c?.label !== 'string' || !c.label) issues.push(`c${i} no label`);
    else if (c.label.length > 30) issues.push(`c${i} label>${c.label.length}`);
  }
  const ids = new Set<string>((data.choices || []).map((c: any) => c.id).filter(Boolean));
  if (ids.size !== (data.choices || []).length) issues.push('choice ids not unique');

  if (round > 1) {
    if (!data.outcome || typeof data.outcome !== 'object') issues.push('no outcome');
    else {
      const nar = data.outcome.narrative;
      if (typeof nar !== 'string' || !nar) issues.push('no outcome.narrative');
      else {
        if (nar.length < 50) issues.push(`outcome.narrative<50(${nar.length})`);
        if (nar.length > 150) issues.push(`outcome.narrative>150(${nar.length})`);
        // 强绑定：outcome 第一句必须呼应 prevChoice 至少一个核心名词
        if (prevChoice) {
          const firstSent = nar.split(/[。!?]/)[0] || '';
          // 提取 prevChoice 的关键词（>=2 字的非停用词）
          const keywords = prevChoice.split('').filter((ch, idx) => /[一-龥]/.test(ch));
          // 用 2-gram 命中检测
          let matched = false;
          for (let i = 0; i < keywords.length - 1; i++) {
            const bigram = keywords[i] + keywords[i + 1];
            if (firstSent.includes(bigram)) { matched = true; break; }
          }
          if (!matched && firstSent.length > 10) {
            issues.push(`outcome-out-of-sync-with-prev-choice(选="${prevChoice.slice(0,15)}" vs 首句="${firstSent.slice(0,30)}")`);
          }
        }
        // 复读检测
        const rep = detectRepetition(nar, priorOutcomes);
        if (rep) issues.push(`outcome-repetition:${rep}`);
      }
      if (!Array.isArray(data.outcome.effects) || data.outcome.effects.length === 0) issues.push('no outcome.effects');
      else if (data.outcome.effects.length > 5) issues.push(`outcome.effects>${data.outcome.effects.length}`);
    }
  }

  // 反结果型反例
  const desc = (data.scene_description || '') + ' ' + (data.choices || []).map((c: any) => c.label).join(' ');
  if (/通过面试|拿到offer|拿到 offer|被录取|获得录取|成功录取|加入成功|获奖|拿到录取/.test(desc)) {
    issues.push('result-type-language-in-options');
  }
  if (data.outcome?.narrative && /最终|决定性|完结撒花|圆满收官|故事的最后|大学四年就此/.test(data.outcome.narrative)) {
    issues.push('premature-ending-in-outcome');
  }

  if (typeof data.is_final !== 'boolean') issues.push('is_final not boolean');
  return issues;
}

interface RoundRecord {
  round: number;
  scene_title: string;
  scene_description: string;
  choices: Array<{ id: string; label: string; detail?: string }>;
  outcome_narrative: string;
  outcome_effects: string[];
  is_final: boolean;
  issues: string[];
  elapsedMs: number;
  outputTokens: number;
  prevChoiceUsed: string;
}

async function playFullGame(provider: AnthropicProvider, p: Profile, gameId: number) {
  const tag = `[G${gameId}:${p.school.slice(0,6)}]`;
  const records: RoundRecord[] = [];
  const priorOutcomes: string[] = [];
  let history = '';
  let prevChoice = '';
  let prevRound = 0;
  let totalOut = 0;
  let totalElapsed = 0;
  let ending: any = null;

  for (let round = 1; round <= 8; round++) {
    try {
      const t0 = Date.now();
      const userPrompt = round === 1
        ? cfg.user_prompts.first_round
        : cfg.user_prompts.subsequent_rounds
            .replace('${history_formatted}', history)
            .replace('${last_round}', String(prevRound))
            .replace('${next_round}', String(round))
            .replace('${totalRounds}', '8')
            .replace('${previous_choice_label}', prevChoice);
      const result = await generateStructuredWithRetry(provider, {
        system: buildSys(p, round, 8),
        user: userPrompt,
        tool: simulateStepTool,
        temperature: 0.85,
        maxTokens: 12288,
        timeoutMs: 60000,
      });
      const elapsed = Date.now() - t0;
      totalElapsed += elapsed;
      totalOut += result.usage.outputTokens || 0;
      const data = result.data as any;
      const issues = checkResult(data, round, prevRound, prevChoice, priorOutcomes);
      const rec: RoundRecord = {
        round,
        scene_title: data.scene_title || '',
        scene_description: data.scene_description || '',
        choices: data.choices || [],
        outcome_narrative: data.outcome?.narrative || '',
        outcome_effects: data.outcome?.effects || [],
        is_final: !!data.is_final,
        issues,
        elapsedMs: elapsed,
        outputTokens: result.usage.outputTokens || 0,
        prevChoiceUsed: prevChoice,
      };
      records.push(rec);
      console.log(`${tag} R${round} ${ROUND_TIME_ANCHORS[round]} OK, ${elapsed}ms, out=${rec.outputTokens}, scene='${rec.scene_title.slice(0,12)}', issues=${issues.length ? '['+issues.join('|')+']' : 'none'}`);
      if (data.outcome?.narrative) priorOutcomes.push(data.outcome.narrative);
      prevChoice = data.choices[0].label;
      prevRound = round;
      history += (history ? '\n\n' : '') + `**第${round}轮 — ${data.scene_title}**
选择了：${prevChoice}
结果：${data.outcome?.narrative || ''}
影响：${(data.outcome?.effects || []).join('、')}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : String(err);
      console.log(`${tag} R${round} FAILED: ${msg}`);
      return { gameId, school: p.school, failed: round, totalOut, totalElapsed, error: msg, records };
    }
  }

  try {
    const t0 = Date.now();
    const endUp = cfg.user_prompts.ending_generation
      .replace('${context_summary}', p.school)
      .replace('${history_count}', '7')
      .replace('${history_for_ending}', history);
    const endR = await generateStructuredWithRetry(provider, {
      system: cfg.system_prompts.ending_observer,
      user: endUp,
      tool: generateEndingTool,
      temperature: 0.7,
      maxTokens: 12288,
      timeoutMs: 60000,
    });
    totalElapsed += Date.now() - t0;
    totalOut += endR.usage.outputTokens || 0;
    ending = endR.data;
    console.log(`${tag} ENDING OK, archetype='${(endR.data as any).archetype}'`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err);
    console.log(`${tag} ENDING FAILED: ${msg}`);
    return { gameId, school: p.school, failed: 'ending', totalOut, totalElapsed, error: msg, records };
  }
  return { gameId, school: p.school, profile: p, failed: null, totalOut, totalElapsed, records, ending };
}

async function runBatch(label: string, batch: Profile[], offset: number): Promise<any[]> {
  console.log(`\n=== 批次 ${label} (${batch.length} 局) ===`);
  const provider = new AnthropicProvider(PROVIDER_CFG);
  const results = await Promise.all(batch.map((p, i) => playFullGame(provider, p, offset + i + 1)));
  return results;
}

(async () => {
  console.log('=== 10 局完整游戏测试 (Round 3) — 分 2 批跑，每批 5 局（避免 stepfun 8 并发上限） ===');
  // 10 局分 2 批：前 5 局并行跑 → 后 5 局并行跑
  const batch1 = PROFILES.slice(0, 5);
  const batch2 = PROFILES.slice(5, 10);
  const results1 = await runBatch('A', batch1, 0);
  const results2 = await runBatch('B', batch2, 5);
  const results = [...results1, ...results2];
  console.log('\n=== 汇总 ===');
  for (const r of results) {
    console.log(`G${r.gameId} ${r.school}: ${r.failed ? `失败于 ${r.failed} (${r.error})` : '完整通过'}, 累计 out=${r.totalOut}, 累计耗时 ${(r.totalElapsed/1000).toFixed(1)}s`);
  }
  const failed = results.filter(r => r.failed);
  console.log(`\n失败 ${failed.length}/${results.length}`);

  // 统计每类 issue
  const issueTypes: Record<string, number> = {};
  for (const r of results) {
    for (const rec of (r.records || [])) {
      for (const i of rec.issues) issueTypes[i] = (issueTypes[i] || 0) + 1;
    }
  }
  console.log('\n=== Issue 统计 ===');
  console.log(JSON.stringify(issueTypes, null, 2));

  fs.writeFileSync('./sim-test-r3.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n完整结果写入 sim-test-r3.json');
})();
