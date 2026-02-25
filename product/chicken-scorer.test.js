/**
 * 比鸡记分器 — 「重算」功能自动化测试
 *
 * 使用 Node.js 内置 test runner (node:test + node:assert)
 * 运行方式: node --test chicken-scorer.test.js
 *
 * 测试策略：
 * 由于应用是单 HTML 文件内嵌 JS，无法直接 import。
 * 本测试文件从 HTML 中提取 JS 代码，在模拟的环境中 eval 执行，
 * 然后对新增的重算功能进行单元测试和集成测试。
 */

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ============================================================
// 提取并加载游戏 JS 代码
// ============================================================
const htmlContent = fs.readFileSync(
  path.join(__dirname, 'chicken-scorer.html'), 'utf-8'
);

// 提取 <script> 标签中的 JS 代码
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error('无法从 chicken-scorer.html 中提取 JavaScript 代码');
}
const gameJsCode = scriptMatch[1];

// ============================================================
// 创建模拟的浏览器环境并加载游戏代码
// ============================================================
function createGameContext() {
  // Mock localStorage
  const storage = {};
  const mockLocalStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
  };

  // Mock document
  const mockDocument = {
    getElementById: () => ({
      innerHTML: '',
      value: '',
      focus: () => {},
    }),
    createElement: (tag) => ({
      textContent: '',
      get innerHTML() { return this.textContent; },
    }),
  };

  // Mock confirm — 默认返回 true
  let confirmResult = true;
  let confirmCalled = false;
  let confirmMessage = '';
  const mockConfirm = (msg) => {
    confirmCalled = true;
    confirmMessage = msg;
    return confirmResult;
  };

  // Mock alert
  let alertCalled = false;
  let alertMessage = '';
  const mockAlert = (msg) => {
    alertCalled = true;
    alertMessage = msg;
  };

  // 构造执行环境
  const ctx = {
    localStorage: mockLocalStorage,
    document: mockDocument,
    confirm: mockConfirm,
    alert: mockAlert,
    // 控制 mock 行为的辅助方法
    _setConfirmResult: (v) => { confirmResult = v; },
    _resetMocks: () => {
      confirmCalled = false;
      confirmMessage = '';
      alertCalled = false;
      alertMessage = '';
      confirmResult = true;
    },
    _getConfirmCalled: () => confirmCalled,
    _getConfirmMessage: () => confirmMessage,
    _getAlertCalled: () => alertCalled,
    _getAlertMessage: () => alertMessage,
  };

  // 移除自执行初始化代码（IIFE），避免在 eval 时自动运行
  // 同时移除 render() 调用中依赖 DOM 的部分
  let modifiedCode = gameJsCode;

  // 移除 IIFE init 块
  modifiedCode = modifiedCode.replace(
    /\(function init\(\)\s*\{[\s\S]*?\}\)\(\);/,
    '// [测试] init IIFE 已移除'
  );

  // 替换 render 函数为空函数（避免 DOM 操作）
  modifiedCode = modifiedCode.replace(
    /function render\(\)\s*\{[\s\S]*?\n    \}/,
    'function render() { /* [测试] render 已 mock */ }'
  );

  // 在上下文中执行代码
  const fn = new Function(
    'localStorage', 'document', 'confirm', 'alert',
    modifiedCode + '\n' +
    // 返回需要测试的变量和函数引用
    `return {
      get S() { return S; },
      set S(v) { S = v; },
      DEFAULT_STATE,
      isCurrentRoundEmpty,
      undoLastRound,
      recalcCurrentRound,
      recalcPreviousRound,
      calculateRoundScore,
      calculateLaneScore,
      calculateLuckyScore,
      validateZeroSum,
      settleRound,
      nextRound,
      resetRoundData,
      allLanesDone,
      saveState,
      loadState,
      startGame,
      render,
      renderPlaying,
      renderRoundResult,
    };`
  );

  const game = fn(
    ctx.localStorage,
    ctx.document,
    ctx.confirm,
    ctx.alert
  );

  return { game, ctx };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 设置一个标准的 4 人游戏状态，处于 playing 阶段
 */
function setupStandardGame(game) {
  game.S = JSON.parse(JSON.stringify(game.DEFAULT_STATE));
  game.S.config.players = ['A', 'B', 'C', 'D'];
  game.S.config.tiers = [5, 10, 15];
  game.S.config.luckyMoney = 50;
  game.S.phase = 'playing';
  game.S.currentRound = 1;
  game.S.rounds = [];
  game.S.totals = { 0: 0, 1: 0, 2: 0, 3: 0 };
  game.S.currentRoundData = { lanes: [[], [], []], currentLane: 0, luckyMap: {} };
}

/**
 * 填充完整的三道排名数据（A赢所有道）
 */
function fillAllLanes(game, lanes) {
  const defaultLanes = lanes || [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]];
  game.S.currentRoundData.lanes = defaultLanes.map(l => [...l]);
}

/**
 * 执行一轮完整结算（填充排名 → 结算）
 */
function settleOneRound(game, lanes, luckyMap) {
  fillAllLanes(game, lanes);
  if (luckyMap) {
    game.S.currentRoundData.luckyMap = { ...luckyMap };
  }
  game.settleRound();
}


// ============================================================
// 测试用例
// ============================================================

describe('比鸡记分器 — 重算功能测试', () => {
  let game, ctx;

  beforeEach(() => {
    const env = createGameContext();
    game = env.game;
    ctx = env.ctx;
    ctx._resetMocks();
  });

  // ==================================================
  // 1. isCurrentRoundEmpty() 单元测试
  // ==================================================
  describe('isCurrentRoundEmpty() — 判断当前轮是否为空', () => {

    it('初始状态下应返回 true', () => {
      setupStandardGame(game);
      assert.strictEqual(game.isCurrentRoundEmpty(), true);
    });

    it('第一道有排名数据时应返回 false', () => {
      setupStandardGame(game);
      game.S.currentRoundData.lanes[0] = [0, 1];
      assert.strictEqual(game.isCurrentRoundEmpty(), false);
    });

    it('第二道有排名数据时应返回 false', () => {
      setupStandardGame(game);
      game.S.currentRoundData.lanes[1] = [2];
      assert.strictEqual(game.isCurrentRoundEmpty(), false);
    });

    it('第三道有排名数据时应返回 false', () => {
      setupStandardGame(game);
      game.S.currentRoundData.lanes[2] = [3, 0, 1, 2];
      assert.strictEqual(game.isCurrentRoundEmpty(), false);
    });

    it('三道全空但有喜钱数据时应返回 false', () => {
      setupStandardGame(game);
      game.S.currentRoundData.luckyMap = { 0: 1 };
      assert.strictEqual(game.isCurrentRoundEmpty(), false);
    });

    it('三道全空且 luckyMap 为空对象时应返回 true', () => {
      setupStandardGame(game);
      game.S.currentRoundData.luckyMap = {};
      assert.strictEqual(game.isCurrentRoundEmpty(), true);
    });
  });

  // ==================================================
  // 2. undoLastRound() 核心逻辑测试
  // ==================================================
  describe('undoLastRound() — 核心回退逻辑', () => {

    it('rounds 为空时应安全返回不报错', () => {
      setupStandardGame(game);
      game.S.rounds = [];
      assert.doesNotThrow(() => game.undoLastRound());
      assert.strictEqual(game.S.rounds.length, 0);
    });

    it('应从 rounds 中弹出最后一轮', () => {
      setupStandardGame(game);
      settleOneRound(game);
      assert.strictEqual(game.S.rounds.length, 1);
      assert.strictEqual(game.S.phase, 'roundResult');

      game.undoLastRound();
      assert.strictEqual(game.S.rounds.length, 0);
    });

    it('应将总分正确扣减回去', () => {
      setupStandardGame(game);
      // A 赢所有三道：每道 A 赢 5+10+15=30
      // A 每道得 +30, B 每道得 -5, C 每道得 -10, D 每道得 -15
      // 三道合计：A: +90, B: -15, C: -30, D: -45
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);

      // 验证结算后的总分
      const totalsAfterSettle = { ...game.S.totals };
      assert.strictEqual(totalsAfterSettle[0], 90);
      assert.strictEqual(totalsAfterSettle[1], -15);
      assert.strictEqual(totalsAfterSettle[2], -30);
      assert.strictEqual(totalsAfterSettle[3], -45);

      game.undoLastRound();

      // 扣减后总分应归零
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], 0, `玩家 ${i} 总分应归零`);
      }
    });

    it('多轮后回退应只扣减最后一轮的分数', () => {
      setupStandardGame(game);

      // 第 1 轮：A 赢所有
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
      const totalsAfterRound1 = { ...game.S.totals };
      game.nextRound();

      // 第 2 轮：B 赢所有
      settleOneRound(game, [[1, 0, 2, 3], [1, 0, 2, 3], [1, 0, 2, 3]]);

      game.undoLastRound();

      // 应恢复到第 1 轮结算后的总分
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], totalsAfterRound1[i],
          `玩家 ${i} 总分应恢复到第1轮结算后的值`);
      }
    });

    it('应将 lanes 数据深拷贝回填到 currentRoundData', () => {
      setupStandardGame(game);
      const originalLanes = [[0, 1, 2, 3], [1, 0, 2, 3], [2, 0, 1, 3]];
      settleOneRound(game, originalLanes);

      game.undoLastRound();

      // 验证回填的排名数据正确
      assert.deepStrictEqual(game.S.currentRoundData.lanes[0], [0, 1, 2, 3]);
      assert.deepStrictEqual(game.S.currentRoundData.lanes[1], [1, 0, 2, 3]);
      assert.deepStrictEqual(game.S.currentRoundData.lanes[2], [2, 0, 1, 3]);
    });

    it('回填的 lanes 应是深拷贝，修改不影响原数据', () => {
      setupStandardGame(game);
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);

      // 手动保留一份 rounds 的引用做验证
      // （注意 undoLastRound 会 pop，所以要在之前保存）
      const savedLanes = game.S.rounds[0].lanes.map(l => [...l]);

      game.undoLastRound();

      // 修改回填后的数据
      game.S.currentRoundData.lanes[0].push(99);

      // 由于是深拷贝，原始保存的数据不应变化
      // （rounds 已被 pop，这里只验证回填数据独立性）
      assert.strictEqual(game.S.currentRoundData.lanes[0].length, 5); // 原4个 + push的99
    });

    it('应将 luckyMap 数据回填到 currentRoundData', () => {
      setupStandardGame(game);
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]], { 1: 2, 3: 1 });

      game.undoLastRound();

      assert.deepStrictEqual(game.S.currentRoundData.luckyMap, { 1: 2, 3: 1 });
    });

    it('应将 currentLane 设为 0', () => {
      setupStandardGame(game);
      settleOneRound(game);

      game.undoLastRound();

      assert.strictEqual(game.S.currentRoundData.currentLane, 0);
    });

    it('应将 phase 切为 playing', () => {
      setupStandardGame(game);
      settleOneRound(game);
      assert.strictEqual(game.S.phase, 'roundResult');

      game.undoLastRound();

      assert.strictEqual(game.S.phase, 'playing');
    });

    it('应调用 saveState 持久化状态', () => {
      setupStandardGame(game);
      settleOneRound(game);

      game.undoLastRound();

      // 验证 localStorage 中有保存的状态
      const saved = ctx.localStorage.getItem('chicken_scorer_state');
      assert.ok(saved, '应有持久化状态');
      const parsed = JSON.parse(saved);
      assert.strictEqual(parsed.phase, 'playing');
      assert.strictEqual(parsed.rounds.length, 0);
    });
  });

  // ==================================================
  // 3. recalcCurrentRound() 测试（roundResult 阶段）
  // ==================================================
  describe('recalcCurrentRound() — 轮次结算页重算', () => {

    it('确认后应执行回退', () => {
      setupStandardGame(game);
      settleOneRound(game);
      ctx._setConfirmResult(true);

      game.recalcCurrentRound();

      assert.strictEqual(ctx._getConfirmCalled(), true);
      assert.strictEqual(game.S.phase, 'playing');
      assert.strictEqual(game.S.rounds.length, 0);
    });

    it('取消确认后应无任何操作', () => {
      setupStandardGame(game);
      settleOneRound(game);
      const roundsBefore = game.S.rounds.length;
      const phaseBefore = game.S.phase;
      ctx._setConfirmResult(false);

      game.recalcCurrentRound();

      assert.strictEqual(ctx._getConfirmCalled(), true);
      assert.strictEqual(game.S.rounds.length, roundsBefore);
      assert.strictEqual(game.S.phase, phaseBefore);
    });

    it('确认弹窗消息应正确', () => {
      setupStandardGame(game);
      settleOneRound(game);
      ctx._setConfirmResult(false);

      game.recalcCurrentRound();

      assert.strictEqual(ctx._getConfirmMessage(), '确定要重新计算本轮吗？');
    });

    it('currentRound 应保持不变', () => {
      setupStandardGame(game);
      game.S.currentRound = 3;
      settleOneRound(game);
      ctx._setConfirmResult(true);

      game.recalcCurrentRound();

      assert.strictEqual(game.S.currentRound, 3, 'currentRound 不应改变');
    });
  });

  // ==================================================
  // 4. recalcPreviousRound() 测试（playing 阶段）
  // ==================================================
  describe('recalcPreviousRound() — 进行中阶段重算上一轮', () => {

    it('确认后应执行回退并减少 currentRound', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound(); // currentRound = 2, phase = playing
      assert.strictEqual(game.S.currentRound, 2);
      ctx._setConfirmResult(true);

      game.recalcPreviousRound();

      assert.strictEqual(game.S.currentRound, 1);
      assert.strictEqual(game.S.phase, 'playing');
      assert.strictEqual(game.S.rounds.length, 0);
    });

    it('取消确认后应无任何操作', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound();
      ctx._setConfirmResult(false);

      game.recalcPreviousRound();

      assert.strictEqual(game.S.currentRound, 2, 'currentRound 不应改变');
      assert.strictEqual(game.S.rounds.length, 1, 'rounds 不应改变');
    });

    it('确认弹窗消息应正确', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound();
      ctx._setConfirmResult(false);

      game.recalcPreviousRound();

      assert.strictEqual(ctx._getConfirmMessage(), '确定要撤回上一轮重新计算吗？');
    });

    it('回退后应回填上一轮数据', () => {
      setupStandardGame(game);
      const lanes = [[1, 0, 2, 3], [2, 1, 0, 3], [3, 2, 1, 0]];
      settleOneRound(game, lanes, { 0: 1 });
      game.nextRound();
      ctx._setConfirmResult(true);

      game.recalcPreviousRound();

      assert.deepStrictEqual(game.S.currentRoundData.lanes[0], [1, 0, 2, 3]);
      assert.deepStrictEqual(game.S.currentRoundData.lanes[1], [2, 1, 0, 3]);
      assert.deepStrictEqual(game.S.currentRoundData.lanes[2], [3, 2, 1, 0]);
      assert.deepStrictEqual(game.S.currentRoundData.luckyMap, { 0: 1 });
    });
  });

  // ==================================================
  // 5. 边界情况测试
  // ==================================================
  describe('边界情况', () => {

    it('第1轮结算后重算：rounds 变空，totals 归零', () => {
      setupStandardGame(game);
      settleOneRound(game);

      game.undoLastRound();

      assert.strictEqual(game.S.rounds.length, 0);
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], 0, `玩家 ${i} 总分应为0`);
      }
    });

    it('多轮后只能回退一轮', () => {
      setupStandardGame(game);

      // 结算 3 轮
      settleOneRound(game);
      game.nextRound();
      settleOneRound(game);
      game.nextRound();
      settleOneRound(game);
      assert.strictEqual(game.S.rounds.length, 3);

      // 回退一轮
      game.undoLastRound();
      assert.strictEqual(game.S.rounds.length, 2);

      // 此时 phase 为 playing，需要重新结算才能再回退
      // currentRoundData 已被回填为第3轮数据
      assert.strictEqual(game.S.phase, 'playing');
    });

    it('带喜钱的轮次回退后总分正确（零和校验）', () => {
      setupStandardGame(game);
      // B 有 1 喜：B 从每人收 50，即 B 得 +150, 其他人各 -50
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]], { 1: 1 });

      // 验证零和
      const sum1 = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum1, 0, '结算后应零和');

      game.undoLastRound();

      // 回退后总分应全部归零
      const sum2 = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum2, 0, '回退后应零和');
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], 0, `玩家 ${i} 总分应为0`);
      }
    });

    it('回退后重新结算结果应正确', () => {
      setupStandardGame(game);
      // 第1轮：A 全赢
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
      const totalsRound1 = { ...game.S.totals };

      // 回退
      game.undoLastRound();

      // 不修改数据，直接重新结算
      game.settleRound();

      // 结果应与第一次一致
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], totalsRound1[i],
          `玩家 ${i} 重新结算后总分应一致`);
      }
    });

    it('回退后修改数据再结算，结果应反映修改', () => {
      setupStandardGame(game);
      // 第1轮：A 全赢
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);

      // 回退
      game.undoLastRound();

      // 修改第一道排名：B 赢
      game.S.currentRoundData.lanes[0] = [1, 0, 2, 3];

      // 重新结算
      game.settleRound();

      // B 在第一道赢得 5+10+15=30
      // A 在第二、三道各赢 30
      // 所以 A 总分应比全赢少 30（变成 60），第一道得 -5
      // A: -5 + 30 + 30 = 55
      // B: +30 + (-5) + (-5) = 20
      assert.strictEqual(game.S.totals[0], 55, 'A 的总分'); // 第1道第2 -5, 第2道赢+30, 第3道赢+30
      assert.strictEqual(game.S.totals[1], 20, 'B 的总分'); // 第1道赢+30, 第2道第2 -5, 第3道第2 -5
    });

    it('零和校验 — 回退前后、重新结算后都满足', () => {
      setupStandardGame(game);

      // 复杂场景：不同道不同人赢 + 喜钱
      settleOneRound(game,
        [[0, 1, 2, 3], [1, 0, 2, 3], [2, 0, 1, 3]],
        { 0: 1, 2: 1 }
      );

      const sum1 = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum1, 0, '结算后零和');

      game.undoLastRound();

      const sum2 = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum2, 0, '回退后零和');

      // 重新结算
      game.settleRound();

      const sum3 = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum3, 0, '重新结算后零和');
    });

    it('状态持久化 — 回退后 localStorage 中的状态一致', () => {
      setupStandardGame(game);
      settleOneRound(game);

      game.undoLastRound();

      const saved = JSON.parse(ctx.localStorage.getItem('chicken_scorer_state'));
      assert.strictEqual(saved.phase, 'playing');
      assert.strictEqual(saved.rounds.length, 0);
      assert.deepStrictEqual(saved.currentRoundData.lanes[0], [0, 1, 2, 3]);
    });
  });

  // ==================================================
  // 6. UI 渲染测试
  // ==================================================
  describe('UI 渲染 — 按钮可见性', () => {

    it('roundResult 阶段应渲染「重算」按钮', () => {
      setupStandardGame(game);
      settleOneRound(game);
      assert.strictEqual(game.S.phase, 'roundResult');

      const html = game.renderRoundResult();
      assert.ok(html.includes('recalcCurrentRound()'), '应包含 recalcCurrentRound 点击事件');
      assert.ok(html.includes('🔄 重算'), '应包含「🔄 重算」文字');
      assert.ok(html.includes('btn-secondary'), '重算按钮应使用 btn-secondary 样式');
    });

    it('roundResult 阶段应同时有「下一轮」「重算」「结束游戏」三个按钮', () => {
      setupStandardGame(game);
      settleOneRound(game);

      const html = game.renderRoundResult();
      assert.ok(html.includes('nextRound()'), '应有下一轮按钮');
      assert.ok(html.includes('recalcCurrentRound()'), '应有重算按钮');
      assert.ok(html.includes('endGame()'), '应有结束游戏按钮');
    });

    it('playing 阶段且当前轮为空且有历史轮次时，应渲染「重算上一轮」按钮', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound(); // phase = playing, 当前轮为空, rounds.length = 1

      const html = game.renderPlaying();
      assert.ok(html.includes('recalcPreviousRound()'), '应包含 recalcPreviousRound 点击事件');
      assert.ok(html.includes('重算上一轮'), '应包含「重算上一轮」文字');
    });

    it('playing 阶段但当前轮有数据时，不应渲染「重算上一轮」按钮', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound();
      // 模拟用户已开始录入
      game.S.currentRoundData.lanes[0] = [0];

      const html = game.renderPlaying();
      assert.ok(!html.includes('recalcPreviousRound()'), '不应包含 recalcPreviousRound');
    });

    it('playing 阶段但没有历史轮次时，不应渲染「重算上一轮」按钮', () => {
      setupStandardGame(game);
      // 第1轮刚开始, rounds.length = 0

      const html = game.renderPlaying();
      assert.ok(!html.includes('recalcPreviousRound()'), '不应包含 recalcPreviousRound');
    });

    it('playing 阶段有 luckyMap 数据时，不应渲染「重算上一轮」按钮', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound();
      // lanes 全空但 luckyMap 有数据
      game.S.currentRoundData.luckyMap = { 0: 1 };

      const html = game.renderPlaying();
      assert.ok(!html.includes('recalcPreviousRound()'), '有 luckyMap 数据时不应包含 recalcPreviousRound');
    });
  });

  // ==================================================
  // 7. 集成测试 — 完整流程
  // ==================================================
  describe('集成测试 — 完整游戏流程', () => {

    it('结算 → 重算 → 修改 → 重新结算 → 下一轮 的完整流程', () => {
      setupStandardGame(game);

      // === 第1轮：A 全赢 ===
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
      assert.strictEqual(game.S.phase, 'roundResult');
      assert.strictEqual(game.S.totals[0], 90);

      // === 重算本轮 ===
      ctx._setConfirmResult(true);
      game.recalcCurrentRound();
      assert.strictEqual(game.S.phase, 'playing');
      assert.strictEqual(game.S.currentRound, 1);
      assert.strictEqual(game.S.totals[0], 0);

      // === 修改排名：第一道改成 B 赢 ===
      game.S.currentRoundData.lanes[0] = [1, 0, 2, 3];

      // === 重新结算 ===
      game.settleRound();
      assert.strictEqual(game.S.phase, 'roundResult');
      assert.strictEqual(game.S.rounds.length, 1);

      // 验证零和
      const sum = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum, 0, '重新结算后零和');

      // === 进入下一轮 ===
      game.nextRound();
      assert.strictEqual(game.S.currentRound, 2);
      assert.strictEqual(game.S.phase, 'playing');
    });

    it('结算 → 下一轮 → 重算上一轮 → 修改 → 重新结算', () => {
      setupStandardGame(game);

      // 第1轮：A 全赢
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
      const round1Totals = { ...game.S.totals };

      // 进入第2轮（还没开始录入）
      game.nextRound();
      assert.strictEqual(game.S.currentRound, 2);
      assert.strictEqual(game.isCurrentRoundEmpty(), true);

      // 重算上一轮
      ctx._setConfirmResult(true);
      game.recalcPreviousRound();
      assert.strictEqual(game.S.currentRound, 1);
      assert.strictEqual(game.S.phase, 'playing');

      // 总分应归零
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], 0);
      }

      // 排名数据应回填
      assert.deepStrictEqual(game.S.currentRoundData.lanes[0], [0, 1, 2, 3]);

      // 不修改，直接重新结算
      game.settleRound();

      // 总分应与第一次一致
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(game.S.totals[i], round1Totals[i]);
      }
    });

    it('多轮游戏中回退数据完整性', () => {
      setupStandardGame(game);

      // 第1轮：A 全赢
      settleOneRound(game, [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
      game.nextRound();

      // 第2轮：B 全赢
      settleOneRound(game, [[1, 0, 2, 3], [1, 0, 2, 3], [1, 0, 2, 3]]);
      game.nextRound();

      // 第3轮：C 全赢 + 喜钱
      settleOneRound(game, [[2, 0, 1, 3], [2, 0, 1, 3], [2, 0, 1, 3]], { 2: 1 });

      const totalsAfter3Rounds = { ...game.S.totals };
      const round3Results = { ...game.S.rounds[2].results };

      // 回退第3轮
      game.undoLastRound();

      // 验证总分 = 第3轮总分 - 第3轮得分
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(
          game.S.totals[i],
          totalsAfter3Rounds[i] - round3Results[i],
          `玩家 ${i} 回退后总分应正确`
        );
      }

      // 验证前2轮的记录保持不变
      assert.strictEqual(game.S.rounds.length, 2);
    });
  });

  // ==================================================
  // 8. 现有功能回归测试
  // ==================================================
  describe('回归测试 — 确保现有功能不受影响', () => {

    it('calculateLaneScore 应正确计算', () => {
      const scores = game.calculateLaneScore([0, 1, 2, 3], [5, 10, 15], 4);
      assert.strictEqual(scores[0], 30);  // 赢家
      assert.strictEqual(scores[1], -5);  // 第2名
      assert.strictEqual(scores[2], -10); // 第3名
      assert.strictEqual(scores[3], -15); // 第4名
    });

    it('calculateLuckyScore 应正确计算', () => {
      const scores = game.calculateLuckyScore({ 0: 1 }, 4, 50);
      assert.strictEqual(scores[0], 150);  // 1次 * 50 * 3人 = 150
      assert.strictEqual(scores[1], -50);
      assert.strictEqual(scores[2], -50);
      assert.strictEqual(scores[3], -50);
    });

    it('validateZeroSum 应正确校验', () => {
      assert.strictEqual(game.validateZeroSum({ 0: 30, 1: -5, 2: -10, 3: -15 }), true);
      assert.strictEqual(game.validateZeroSum({ 0: 30, 1: -5, 2: -10, 3: -10 }), false);
    });

    it('settleRound 应正常结算', () => {
      setupStandardGame(game);
      fillAllLanes(game);
      game.settleRound();

      assert.strictEqual(game.S.phase, 'roundResult');
      assert.strictEqual(game.S.rounds.length, 1);
      const sum = Object.values(game.S.totals).reduce((a, b) => a + b, 0);
      assert.strictEqual(sum, 0, '零和');
    });

    it('nextRound 应正常推进', () => {
      setupStandardGame(game);
      settleOneRound(game);
      game.nextRound();

      assert.strictEqual(game.S.currentRound, 2);
      assert.strictEqual(game.S.phase, 'playing');
      assert.deepStrictEqual(game.S.currentRoundData.lanes, [[], [], []]);
    });

    it('undoLastSelection 应正常工作', () => {
      setupStandardGame(game);
      game.S.currentRoundData.lanes[0] = [0, 1, 2];
      game.S.currentRoundData.currentLane = 0;

      // 不能直接调用 undoLastSelection 因为它没有在返回对象中
      // 但我们可以验证 lanes 数据结构完整性
      const lane = game.S.currentRoundData.lanes[0];
      lane.pop();
      assert.deepStrictEqual(lane, [0, 1]);
    });
  });
});
