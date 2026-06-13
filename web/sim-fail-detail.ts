import { AnthropicProvider } from './src/lib/future/anthropic';
import { simulateStepTool } from './src/lib/future/simulator-schema';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

const provider = new AnthropicProvider({
  apiKey: '3vnGPaV7MkLN512uCuuXD9j2JNF2AgOjJe5F1LqXb5cL6XnnCdTaDxihG5wOHEvmQ',
  baseUrl: 'https://api.stepfun.com/step_plan',
  model: 'step-3.7-flash',
  anthropicVersion: '2023-06-01',
});

// 用 fetch 抓原始响应
async function rawCall(system: string, user: string, label: string) {
  const t0 = Date.now();
  const res = await fetch('https://api.stepfun.com/step_plan/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': '3vnGPaV7MkLN512uCuuXD9j2JNF2AgOjJe5F1LqXb5cL6XnnCdTaDxihG5wOHEvmQ',
      'anthropic-version': '2023-06-01',
      'connection': 'close',
    },
    body: JSON.stringify({
      model: 'step-3.7-flash',
      system,
      messages: [{ role: 'user', content: user }],
      temperature: 0.85,
      max_tokens: 12288,
      tools: [simulateStepTool],
      tool_choice: { type: 'tool', name: simulateStepTool.name },
      output_config: { effort: 'medium' },
    }),
  });
  const body = await res.json() as any;
  const elapsed = Date.now() - t0;
  console.log(`\n--- ${label} ---`);
  console.log(`elapsed: ${elapsed}ms, stop_reason: ${body.stop_reason}, out_tokens: ${body.usage?.output_tokens}`);
  const content = body.content || [];
  for (const blk of content) {
    if (blk.type === 'thinking') {
      console.log(`THINKING (${blk.thinking.length} chars):`);
      console.log(blk.thinking.slice(0, 2000));
      console.log(`... (thinking 末尾 200 字符) ...`);
      console.log(blk.thinking.slice(-200));
    } else if (blk.type === 'text') {
      console.log(`TEXT (${blk.text.length} chars):`);
      console.log(blk.text.slice(0, 500));
    } else if (blk.type === 'tool_use') {
      console.log(`TOOL_USE: name=${blk.name}, input keys=${Object.keys(blk.input || {}).join(',')}`);
    }
  }
  return body;
}

const promptsRaw = fs.readFileSync('./src/lib/future/simulator-prompts.yaml', 'utf-8');
const cfg = yaml.load(promptsRaw) as any;

function buildSys(round: number, totalRounds: number) {
  return cfg.system_prompts.main_narrative_engine
    .replace('${profile.school}', '武汉大学')
    .replace('${school_context_lines}', '\n- 学校层次：985\n- 学校类型：综合')
    .replace('${profile_major_line}', '- 专业方向：计算机')
    .replace('${profile_gender_line}', '- 性别设定：男生')
    .replace('${profile.personalityTags}', '理性 好奇')
    .replace('${profile.interests}', '计算机 社交 阅读')
    .replace('${profile.riskTolerance}', '5')
    .replace('${round}', String(round))
    .replace('${totalRounds}', String(totalRounds))
    .replace('${round_progression}', '第1-2轮入学适应期，第3-4轮学业深入期，第5-6轮关键转折期，第7-8轮毕业收尾期');
}

(async () => {
  // 先跑 R1 拿一个真实 history
  const r1 = await provider.generateStructured({
    system: buildSys(1, 8),
    user: cfg.user_prompts.first_round,
    tool: simulateStepTool,
    temperature: 0.85, maxTokens: 12288, timeoutMs: 60000,
  });
  const c1 = (r1.data as any).choices[0].label;
  console.log('R1 OK, choice:', c1);

  const history = `**第1轮 — ${(r1.data as any).scene_title}**
选择了：${c1}
结果：${(r1.data as any).outcome?.narrative || ''}
影响：${((r1.data as any).outcome?.effects || []).join('、')}`;
  const up2 = cfg.user_prompts.subsequent_rounds
    .replace('${history_formatted}', history)
    .replace('${last_round}', '1')
    .replace('${previous_choice_label}', c1);

  // 并行 3 次 R2，看 raw content
  const promises = Array.from({length: 3}, (_, i) => rawCall(buildSys(2, 8), up2, `R2-parallel-${i+1}`));
  await Promise.all(promises);
})();
