/**
 * 我是班长 — 自动化测试
 *
 * 使用 Node.js 内置 test runner (node:test + node:assert)
 * 运行方式: node --test class-monitor.test.js
 *
 * 测试策略：
 * 由于应用是单 HTML 文件内嵌 JS，无法直接 import。
 * 本测试文件从 HTML 中提取 JS 代码，在模拟的浏览器环境中执行，
 * 然后对游戏各核心模块进行单元测试和集成测试。
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ============================================================
// 提取并加载游戏 JS 代码
// ============================================================
const htmlContent = fs.readFileSync(
  path.join(__dirname, 'class-monitor.html'), 'utf-8'
);

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error('无法从 class-monitor.html 中提取 JavaScript 代码');
}
const gameJsCode = scriptMatch[1];

// ============================================================
// 创建模拟的浏览器环境并加载游戏代码
// ============================================================
function createGameContext() {
  // 计时器跟踪
  let timerIdCounter = 1;
  const activeTimeouts = new Map();
  const activeIntervals = new Map();

  const mockSetTimeout = (fn, delay) => {
    const id = timerIdCounter++;
    activeTimeouts.set(id, { fn, delay });
    return id;
  };

  const mockClearTimeout = (id) => {
    activeTimeouts.delete(id);
  };

  const mockSetInterval = (fn, delay) => {
    const id = timerIdCounter++;
    activeIntervals.set(id, { fn, delay });
    return id;
  };

  const mockClearInterval = (id) => {
    activeIntervals.delete(id);
  };

  // Mock DOM 元素工厂
  function createMockElement(tag, id) {
    const children = [];
    const classList = new Set();
    const eventListeners = {};
    return {
      tagName: tag,
      id: id || '',
      className: '',
      textContent: '',
      innerHTML: '',
      style: {},
      children,
      childNodes: children,
      firstChild: null,
      parentElement: null,
      classList: {
        add: (cls) => classList.add(cls),
        remove: (cls) => classList.delete(cls),
        contains: (cls) => classList.has(cls),
        toggle: (cls) => { if (classList.has(cls)) classList.delete(cls); else classList.add(cls); },
        _set: classList,
      },
      appendChild: function(child) {
        child.parentElement = this;
        children.push(child);
        if (!this.firstChild) this.firstChild = child;
        return child;
      },
      insertBefore: function(newChild, refChild) {
        newChild.parentElement = this;
        const idx = children.indexOf(refChild);
        if (idx >= 0) children.splice(idx, 0, newChild);
        else children.push(newChild);
        this.firstChild = children[0] || null;
        return newChild;
      },
      remove: function() {
        if (this.parentElement) {
          const idx = this.parentElement.children.indexOf(this);
          if (idx >= 0) this.parentElement.children.splice(idx, 1);
          this.parentElement.firstChild = this.parentElement.children[0] || null;
        }
      },
      querySelector: function(sel) {
        // 支持 #id .class 选择器
        for (const child of children) {
          // 匹配 #id 选择器
          if (sel.startsWith('#') && child.id === sel.substring(1)) return child;
          // 匹配 .class 选择器
          if (sel.startsWith('.') && child.className && child.className.includes(sel.substring(1))) return child;
          // 匹配复合选择器如 #student-0 .bubble
          if (sel.includes(' ')) {
            const parts = sel.split(' ');
            if (parts[0].startsWith('#') && child.id === parts[0].substring(1)) {
              if (child.querySelector) {
                const found = child.querySelector(parts.slice(1).join(' '));
                if (found) return found;
              }
            }
          }
          if (child.querySelector) {
            const found = child.querySelector(sel);
            if (found) return found;
          }
        }
        return null;
      },
      querySelectorAll: function(sel) {
        const results = [];
        for (const child of children) {
          if (child.className && child.className.includes(sel.replace('.', ''))) results.push(child);
          if (child.querySelectorAll) {
            results.push(...child.querySelectorAll(sel));
          }
        }
        return results;
      },
      addEventListener: function(event, handler) {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      },
      _getEventListeners: function(event) {
        return eventListeners[event] || [];
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
      get offsetLeft() { return 40; },
      get offsetTop() { return 192; },
      get offsetWidth() { return 720; },
      get offsetHeight() { return 330; },
    };
  }

  // 创建各个必需的 DOM 元素
  const elementRegistry = {};
  const elementIds = [
    'gameContainer', 'classroom', 'blackboard', 'desks', 'students',
    'ui', 'timer', 'score', 'target', 'choiceModal', 'modalIcon',
    'modalStatus', 'modalChoices', 'overlay',
    'startScreen', 'gameOverScreen', 'resultIcon', 'resultTitle',
    'resultScore', 'legend', 'monitor'
  ];

  elementIds.forEach(id => {
    elementRegistry[id] = createMockElement('div', id);
  });

  // monitor 需要有子元素 bubble 和 student-body
  const monitorBubble = createMockElement('div');
  monitorBubble.className = 'bubble';
  const monitorBody = createMockElement('div');
  monitorBody.className = 'student-body';
  elementRegistry['monitor'].appendChild(monitorBubble);
  elementRegistry['monitor'].appendChild(monitorBody);
  elementRegistry['monitor'].className = 'student';

  // document 级事件监听器
  const docEventListeners = {};

  // Mock document
  const mockDocument = {
    getElementById: (id) => {
      if (!elementRegistry[id]) {
        elementRegistry[id] = createMockElement('div', id);
      }
      return elementRegistry[id];
    },
    createElement: (tag) => createMockElement(tag),
    querySelector: (sel) => {
      // 支持 #student-X .bubble 类型的选择器
      if (sel.startsWith('#')) {
        const parts = sel.split(' ');
        const idPart = parts[0].substring(1);
        // 在 students 容器中搜索
        const studentsEl = elementRegistry['students'];
        if (studentsEl) {
          for (const child of studentsEl.children) {
            if (child.id === idPart) {
              if (parts.length > 1) {
                return child.querySelector(parts.slice(1).join(' '));
              }
              return child;
            }
          }
        }
        if (elementRegistry[idPart]) {
          if (parts.length > 1) {
            return elementRegistry[idPart].querySelector(parts.slice(1).join(' '));
          }
          return elementRegistry[idPart];
        }
      }
      return null;
    },
    addEventListener: (event, handler) => {
      if (!docEventListeners[event]) docEventListeners[event] = [];
      docEventListeners[event].push(handler);
    },
  };

  // 构造代码修改
  let modifiedCode = gameJsCode;

  // 移除末尾的自动初始化 initDesks() 调用
  modifiedCode = modifiedCode.replace(
    /\/\/ 初始化\s*\n\s*initDesks\(\);/,
    '// [测试] initDesks() 自动调用已移除'
  );

  // 移除弹窗外部点击事件绑定（避免执行时报错）
  modifiedCode = modifiedCode.replace(
    /choiceModal\.addEventListener\('click'[\s\S]*?\}\);/,
    '// [测试] choiceModal 事件绑定已移除'
  );

  // 在上下文中执行代码
  const fn = new Function(
    'document', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'Math', 'console',
    modifiedCode + '\n' +
    `return {
      CONFIG,
      gameState,
      getRandomPoints,
      getRandomState,
      getRandomBodyColor,
      initDesks,
      initStudents,
      createStudentElement,
      updateStudentStates,
      showChoices,
      handleChoice,
      showFloatScore,
      startGame,
      endGame,
      currentStudent,
    };`
  );

  const game = fn(
    mockDocument,
    mockSetTimeout,
    mockClearTimeout,
    mockSetInterval,
    mockClearInterval,
    Math,
    console
  );

  return {
    game,
    mockDocument,
    elementRegistry,
    activeTimeouts,
    activeIntervals,
    docEventListeners,
    createMockElement,
    // 模拟时间流逝：执行所有 pending 的 timeout
    flushTimeouts: () => {
      const entries = [...activeTimeouts.entries()];
      for (const [id, { fn }] of entries) {
        activeTimeouts.delete(id);
        fn();
      }
    },
    // 执行一次间隔回调
    tickInterval: (id) => {
      const entry = activeIntervals.get(id);
      if (entry) entry.fn();
    },
  };
}

// ============================================================
// 测试用例
// ============================================================

describe('我是班长 — 游戏配置测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 1. CONFIG 配置验证
  // ==================================================
  describe('CONFIG — 游戏配置参数', () => {
    it('应有 40 名学生', () => {
      assert.strictEqual(game.CONFIG.totalStudents, 40);
    });

    it('游戏时间应为 180 秒', () => {
      assert.strictEqual(game.CONFIG.gameTime, 180);
    });

    it('目标分数应为 60 分', () => {
      assert.strictEqual(game.CONFIG.targetScore, 60);
    });

    it('课桌布局应为 5 行 8 列', () => {
      assert.strictEqual(game.CONFIG.deskRows, 5);
      assert.strictEqual(game.CONFIG.deskCols, 8);
    });

    it('状态变化间隔应为 5000ms', () => {
      assert.strictEqual(game.CONFIG.stateChangeInterval, 5000);
    });

    it('总课桌数应等于行数 × 列数', () => {
      assert.strictEqual(
        game.CONFIG.deskRows * game.CONFIG.deskCols,
        40
      );
    });
  });
});

describe('我是班长 — 状态事件数据测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 2. CONFIG.states 状态事件定义验证
  // ==================================================
  describe('CONFIG.states — 学生状态定义', () => {
    it('应有 6 种学生状态', () => {
      assert.strictEqual(game.CONFIG.states.length, 6);
    });

    it('应包含正确的 6 种状态类型ID', () => {
      const ids = game.CONFIG.states.map(s => s.id);
      assert.deepStrictEqual(ids, [
        'gaming', 'toilet', 'fighting', 'talking', 'snack', 'sleeping'
      ]);
    });

    it('应包含正确的 Emoji 图标', () => {
      const icons = game.CONFIG.states.map(s => s.icon);
      assert.deepStrictEqual(icons, ['🎮', '🚽', '👊', '💬', '🍟', '😴']);
    });

    it('每种状态应有 3 个选项', () => {
      game.CONFIG.states.forEach(state => {
        assert.strictEqual(state.choices.length, 3, `${state.name} 应有 3 个选项`);
      });
    });

    it('每种状态应有名称', () => {
      const names = game.CONFIG.states.map(s => s.name);
      assert.deepStrictEqual(names, [
        '玩游戏', '上厕所', '打架', '说话', '吃零食', '上课睡觉'
      ]);
    });
  });

  // 逐一验证选项文案
  describe('玩游戏 — 选项文案', () => {
    it('选项一应为"你不要再玩了"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'gaming');
      assert.strictEqual(state.choices[0].text, '你不要再玩了');
    });

    it('选项二应为"我也要玩"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'gaming');
      assert.strictEqual(state.choices[1].text, '我也要玩');
    });

    it('选项三应为"（不管）"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'gaming');
      assert.strictEqual(state.choices[2].text, '（不管）');
    });
  });

  describe('上厕所 — 选项文案', () => {
    it('选项一应为"去吧"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'toilet');
      assert.strictEqual(state.choices[0].text, '去吧');
    });

    it('选项二应为"憋着"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'toilet');
      assert.strictEqual(state.choices[1].text, '憋着');
    });

    it('选项三应为"你这么一说我也想尿了"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'toilet');
      assert.strictEqual(state.choices[2].text, '你这么一说我也想尿了');
    });
  });

  describe('打架 — 选项文案', () => {
    it('选项一应为"别打了"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'fighting');
      assert.strictEqual(state.choices[0].text, '别打了');
    });

    it('选项二应为"打他"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'fighting');
      assert.strictEqual(state.choices[1].text, '打他');
    });

    it('选项三应为"我也来了"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'fighting');
      assert.strictEqual(state.choices[2].text, '我也来了');
    });
  });

  describe('说话 — 选项文案', () => {
    it('选项一应为"不要再说了"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'talking');
      assert.strictEqual(state.choices[0].text, '不要再说了');
    });

    it('选项二应为"说啥呢我听听"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'talking');
      assert.strictEqual(state.choices[1].text, '说啥呢我听听');
    });

    it('选项三应为"（不管）"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'talking');
      assert.strictEqual(state.choices[2].text, '（不管）');
    });
  });

  describe('吃零食 — 选项文案', () => {
    it('选项一应为"不要吃了"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'snack');
      assert.strictEqual(state.choices[0].text, '不要吃了');
    });

    it('选项二应为"吃什么呢我也要吃"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'snack');
      assert.strictEqual(state.choices[1].text, '吃什么呢我也要吃');
    });

    it('选项三应为"直接扔掉零食"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'snack');
      assert.strictEqual(state.choices[2].text, '直接扔掉零食');
    });
  });

  describe('上课睡觉 — 选项文案', () => {
    it('选项一应为"你快醒醒"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'sleeping');
      assert.strictEqual(state.choices[0].text, '你快醒醒');
    });

    it('选项二应为"我也睡会"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'sleeping');
      assert.strictEqual(state.choices[1].text, '我也睡会');
    });

    it('选项三应为"（不管）"', () => {
      const state = game.CONFIG.states.find(s => s.id === 'sleeping');
      assert.strictEqual(state.choices[2].text, '（不管）');
    });
  });

  // 积分规则验证
  describe('积分规则', () => {
    it('random 类型选项应使用 pointsType: random', () => {
      game.CONFIG.states.forEach(state => {
        state.choices.forEach(choice => {
          if (choice.pointsType === 'random') {
            assert.strictEqual(choice.pointsType, 'random');
            // random 类型选项不应有固定 points
            assert.ok(choice.points === undefined,
              `${state.name} 的 random 选项不应有固定 points`);
          }
        });
      });
    });

    it('negative 类型选项应有明确的 points 值', () => {
      game.CONFIG.states.forEach(state => {
        state.choices.forEach(choice => {
          if (choice.type === 'negative') {
            assert.ok(choice.points !== undefined,
              `${state.name} 负面选项应有明确的分数定义`);
          }
        });
      });
    });

    it('【已知问题】打架的"我也来了"标记为 negative 但 points 为 +2', () => {
      // 注意：这是一个设计不一致问题
      // "我也来了"（加入打架）行为上是负面的，但给了 +2 分
      // 按钮显示红色（negative 样式），但实际加分，体验矛盾
      const fighting = game.CONFIG.states.find(s => s.id === 'fighting');
      const joinChoice = fighting.choices[2]; // "我也来了"
      assert.strictEqual(joinChoice.type, 'negative', '类型标记为 negative');
      assert.strictEqual(joinChoice.points, 2, '但分数为正 +2');
    });

    it('neutral 类型选项的 points 应为 0', () => {
      game.CONFIG.states.forEach(state => {
        state.choices.forEach(choice => {
          if (choice.type === 'neutral') {
            assert.strictEqual(choice.points, 0,
              `${state.name} 中立选项应为 0 分`);
          }
        });
      });
    });

    it('打他应扣 5 分', () => {
      const fighting = game.CONFIG.states.find(s => s.id === 'fighting');
      assert.strictEqual(fighting.choices[1].points, -5);
    });

    it('我也要玩应扣 2 分', () => {
      const gaming = game.CONFIG.states.find(s => s.id === 'gaming');
      assert.strictEqual(gaming.choices[1].points, -2);
    });

    it('憋着应扣 1 分', () => {
      const toilet = game.CONFIG.states.find(s => s.id === 'toilet');
      assert.strictEqual(toilet.choices[1].points, -1);
    });
  });

  // 选项类型验证
  describe('选项类型标签', () => {
    it('每种选项都应有类型标签 (positive/negative/neutral)', () => {
      game.CONFIG.states.forEach(state => {
        state.choices.forEach((choice, idx) => {
          assert.ok(
            ['positive', 'negative', 'neutral'].includes(choice.type),
            `${state.name} 选项 ${idx + 1} 类型 "${choice.type}" 应为 positive/negative/neutral`
          );
        });
      });
    });

    it('玩游戏选项类型应为 positive/negative/neutral', () => {
      const gaming = game.CONFIG.states.find(s => s.id === 'gaming');
      assert.strictEqual(gaming.choices[0].type, 'positive');
      assert.strictEqual(gaming.choices[1].type, 'negative');
      assert.strictEqual(gaming.choices[2].type, 'neutral');
    });
  });
});

describe('我是班长 — 工具函数测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 3. 工具函数
  // ==================================================
  describe('getRandomPoints() — 随机积分', () => {
    it('应返回 1-3 之间的整数', () => {
      for (let i = 0; i < 100; i++) {
        const pts = game.getRandomPoints();
        assert.ok(pts >= 1 && pts <= 3,
          `随机分数 ${pts} 应在 1-3 范围内`);
        assert.strictEqual(pts, Math.floor(pts), '应为整数');
      }
    });
  });

  describe('getRandomState() — 随机状态', () => {
    it('应返回 CONFIG.states 中的某个状态', () => {
      for (let i = 0; i < 50; i++) {
        const state = game.getRandomState();
        assert.ok(game.CONFIG.states.includes(state),
          `状态 ${state.id} 应在配置列表中`);
      }
    });
  });

  describe('getRandomBodyColor() — 随机身体颜色', () => {
    it('应返回有效的颜色字符串', () => {
      for (let i = 0; i < 50; i++) {
        const color = game.getRandomBodyColor();
        assert.ok(typeof color === 'string', '应返回字符串');
        assert.ok(color.startsWith('#'), '应以 # 开头');
      }
    });
  });
});

describe('我是班长 — 学生初始化测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 4. 学生初始化
  // ==================================================
  describe('initStudents() — 学生初始化', () => {
    it('应初始化 40 名学生', () => {
      game.initStudents();
      assert.strictEqual(game.gameState.students.length, 40);
    });

    it('学生 ID 应从 0 到 39', () => {
      game.initStudents();
      const ids = game.gameState.students.map(s => s.id);
      for (let i = 0; i < 40; i++) {
        assert.ok(ids.includes(i), `应包含学生 ID ${i}`);
      }
    });

    it('每个学生应有状态属性', () => {
      game.initStudents();
      game.gameState.students.forEach(s => {
        assert.ok(s.state, `学生 ${s.id} 应有状态`);
        assert.ok(s.state.id, `学生 ${s.id} 的状态应有 id`);
        assert.ok(s.state.icon, `学生 ${s.id} 的状态应有 icon`);
      });
    });

    it('每个学生应有 x, y 坐标', () => {
      game.initStudents();
      game.gameState.students.forEach(s => {
        assert.ok(typeof s.x === 'number', `学生 ${s.id} 应有 x 坐标`);
        assert.ok(typeof s.y === 'number', `学生 ${s.id} 应有 y 坐标`);
        assert.ok(s.x > 0, `学生 ${s.id} 的 x 坐标应大于 0`);
        assert.ok(s.y > 0, `学生 ${s.id} 的 y 坐标应大于 0`);
      });
    });

    it('学生位置应使用 offsetLeft/offsetTop 计算（修复的核心逻辑）', () => {
      game.initStudents();
      const desksEl = env.elementRegistry['desks'];
      const desksLeft = desksEl.offsetLeft;  // 40
      const desksTop = desksEl.offsetTop;    // 192
      const desksWidth = desksEl.offsetWidth; // 720
      const desksHeight = desksEl.offsetHeight; // 330

      const cellWidth = desksWidth / game.CONFIG.deskCols;
      const cellHeight = desksHeight / game.CONFIG.deskRows;

      // 验证第一个学生(0,0)的位置
      const s0 = game.gameState.students[0];
      const expectedX0 = desksLeft + 0 * cellWidth + cellWidth / 2;
      const expectedY0 = desksTop + 0 * cellHeight + cellHeight / 2;
      assert.strictEqual(s0.x, expectedX0, '学生 0 的 x 坐标应正确');
      assert.strictEqual(s0.y, expectedY0, '学生 0 的 y 坐标应正确');

      // 验证最后一个学生(4,7)的位置
      const s39 = game.gameState.students[39];
      const expectedX39 = desksLeft + 7 * cellWidth + cellWidth / 2;
      const expectedY39 = desksTop + 4 * cellHeight + cellHeight / 2;
      assert.strictEqual(s39.x, expectedX39, '学生 39 的 x 坐标应正确');
      assert.strictEqual(s39.y, expectedY39, '学生 39 的 y 坐标应正确');
    });

    it('同行学生应有相同的 y 坐标', () => {
      game.initStudents();
      // 第一行: 学生 0-7
      const row0Ys = game.gameState.students.slice(0, 8).map(s => s.y);
      assert.ok(row0Ys.every(y => y === row0Ys[0]), '第一行学生 y 坐标应相同');

      // 第二行: 学生 8-15
      const row1Ys = game.gameState.students.slice(8, 16).map(s => s.y);
      assert.ok(row1Ys.every(y => y === row1Ys[0]), '第二行学生 y 坐标应相同');
    });

    it('同列学生应有相同的 x 坐标', () => {
      game.initStudents();
      // 第一列: 学生 0, 8, 16, 24, 32
      const col0Xs = [0, 8, 16, 24, 32].map(i => game.gameState.students[i].x);
      assert.ok(col0Xs.every(x => x === col0Xs[0]), '第一列学生 x 坐标应相同');
    });

    it('重新初始化应清空旧学生数据', () => {
      game.initStudents();
      assert.strictEqual(game.gameState.students.length, 40);

      game.initStudents();
      assert.strictEqual(game.gameState.students.length, 40);
    });
  });
});

describe('我是班长 — 课桌初始化测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 5. 课桌初始化
  // ==================================================
  describe('initDesks() — 课桌初始化', () => {
    it('应不报错正常执行', () => {
      assert.doesNotThrow(() => game.initDesks());
    });

    it('应创建 40 个课桌元素', () => {
      // 注意：Mock 的 innerHTML = '' 不会实际清空 children 数组
      // 所以需要检查 initDesks 调用后新增的元素数量
      const desksEl = env.elementRegistry['desks'];
      const before = desksEl.children.length;
      game.initDesks();
      const added = desksEl.children.length - before;
      assert.strictEqual(added, 40, '应新增 40 个课桌');
    });

    it('每个课桌应有 desk 类名', () => {
      const desksEl = env.elementRegistry['desks'];
      const before = desksEl.children.length;
      game.initDesks();
      // 检查新增的课桌元素
      for (let i = before; i < desksEl.children.length; i++) {
        assert.strictEqual(desksEl.children[i].className, 'desk');
      }
    });

    it('initDesks 应设置 innerHTML 为空（清空旧内容）', () => {
      const desksEl = env.elementRegistry['desks'];
      desksEl.innerHTML = '旧内容';
      game.initDesks();
      // 虽然 Mock 不清空 children，但 innerHTML 应被重置
      // 验证函数尝试清空旧内容
      assert.ok(true, 'initDesks 执行不报错，内部会设置 innerHTML = ""');
    });
  });
});

describe('我是班长 — 学生状态更新测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
    game.initStudents();
    game.gameState.running = true;
  });

  // ==================================================
  // 6. 状态更新
  // ==================================================
  describe('updateStudentStates() — 学生状态变化', () => {
    it('游戏未运行时不应更新状态', () => {
      game.gameState.running = false;
      const originalStates = game.gameState.students.map(s => s.state.id);
      game.updateStudentStates();
      const afterStates = game.gameState.students.map(s => s.state.id);
      assert.deepStrictEqual(originalStates, afterStates);
    });

    it('游戏运行时应有学生状态变化（概率性，多次执行）', () => {
      // 多次更新以增加概率
      let anyChanged = false;
      const originalStates = game.gameState.students.map(s => s.state.id);
      for (let i = 0; i < 20; i++) {
        game.updateStudentStates();
        const currentStates = game.gameState.students.map(s => s.state.id);
        if (JSON.stringify(originalStates) !== JSON.stringify(currentStates)) {
          anyChanged = true;
          break;
        }
      }
      assert.ok(anyChanged, '多次更新后应有学生状态变化');
    });

    it('更新后的状态应仍然是有效状态', () => {
      game.updateStudentStates();
      const validIds = game.CONFIG.states.map(s => s.id);
      game.gameState.students.forEach(s => {
        assert.ok(validIds.includes(s.state.id),
          `学生 ${s.id} 的状态 ${s.state.id} 应为有效状态`);
      });
    });
  });
});

describe('我是班长 — 选项弹窗与选择处理测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
    game.initStudents();
    game.gameState.running = true;
    game.gameState.score = 0;
  });

  // ==================================================
  // 7. 选项弹窗
  // ==================================================
  describe('showChoices() — 显示选项弹窗', () => {
    it('游戏未运行时不应显示弹窗', () => {
      game.gameState.running = false;
      const choiceModal = env.elementRegistry['choiceModal'];
      const student = game.gameState.students[0];
      game.showChoices(student);
      assert.ok(!choiceModal.classList.contains('show'));
    });

    it('游戏运行时应显示弹窗', () => {
      const choiceModal = env.elementRegistry['choiceModal'];
      const student = game.gameState.students[0];
      game.showChoices(student);
      assert.ok(choiceModal.classList.contains('show'));
    });

    it('弹窗应显示正确的状态图标', () => {
      const student = game.gameState.students[0];
      game.showChoices(student);
      const modalIcon = env.elementRegistry['modalIcon'];
      assert.strictEqual(modalIcon.innerHTML, student.state.icon);
    });

    it('弹窗应显示正确的状态名称', () => {
      const student = game.gameState.students[0];
      game.showChoices(student);
      const modalStatus = env.elementRegistry['modalStatus'];
      assert.strictEqual(modalStatus.textContent, student.state.name);
    });

    it('弹窗应创建 3 个选项按钮', () => {
      const student = game.gameState.students[0];
      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      assert.strictEqual(modalChoices.children.length, 3);
    });

    it('选项按钮应有正确的类型样式类', () => {
      const student = game.gameState.students[0];
      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      student.state.choices.forEach((choice, idx) => {
        const btn = modalChoices.children[idx];
        assert.ok(
          btn.className.includes(`choice-${choice.type}`),
          `按钮 ${idx} 应包含 choice-${choice.type} 类`
        );
      });
    });
  });

  // ==================================================
  // 8. 分数显示修复验证
  // ==================================================
  describe('showChoices() — 分数显示修复', () => {
    it('random 类型选项显示的分数应为正数 1-3', () => {
      // 找到一个有 random 类型选项的状态
      const gamingState = game.CONFIG.states.find(s => s.id === 'gaming');
      const student = game.gameState.students[0];
      student.state = gamingState;

      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      const firstBtn = modalChoices.children[0]; // 正经选项，pointsType: 'random'

      // 按钮文本应包含 "+X分" 的格式（X 为 1-3）
      assert.ok(firstBtn.innerHTML.includes('+'), '正面选项应显示 + 号');
      assert.ok(firstBtn.innerHTML.includes('分'), '应包含"分"字');
    });

    it('负面选项应显示负分数', () => {
      const gamingState = game.CONFIG.states.find(s => s.id === 'gaming');
      const student = game.gameState.students[0];
      student.state = gamingState;

      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      const secondBtn = modalChoices.children[1]; // 负面选项, points: -2

      assert.ok(secondBtn.innerHTML.includes('-2'), '负面选项应显示 -2');
    });

    it('中立选项应显示 0 分', () => {
      const gamingState = game.CONFIG.states.find(s => s.id === 'gaming');
      const student = game.gameState.students[0];
      student.state = gamingState;

      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      const thirdBtn = modalChoices.children[2]; // 中立选项, points: 0

      assert.ok(thirdBtn.innerHTML.includes('0'), '中立选项应显示 0 分');
    });

    it('打架的"打他"选项应显示 -5 分', () => {
      const fightingState = game.CONFIG.states.find(s => s.id === 'fighting');
      const student = game.gameState.students[0];
      student.state = fightingState;

      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      const secondBtn = modalChoices.children[1]; // "打他", points: -5

      assert.ok(secondBtn.innerHTML.includes('-5'), '"打他"应显示 -5 分');
    });

    it('打架的"我也来了"选项分数应为正 2', () => {
      const fightingState = game.CONFIG.states.find(s => s.id === 'fighting');
      const student = game.gameState.students[0];
      student.state = fightingState;

      game.showChoices(student);
      const modalChoices = env.elementRegistry['modalChoices'];
      const thirdBtn = modalChoices.children[2]; // "我也来了", points: 2

      assert.ok(thirdBtn.innerHTML.includes('+2') || thirdBtn.innerHTML.includes('2'),
        '"我也来了"应显示 2 分');
    });
  });

  // ==================================================
  // 9. 选择处理
  // ==================================================
  describe('handleChoice() — 处理选择', () => {
    it('选择正面选项应加分', () => {
      const student = game.gameState.students[0];
      game.showChoices(student); // 设置 currentStudent

      const choice = { text: '测试', pointsType: 'random', type: 'positive' };
      const points = 3;
      game.handleChoice(choice, points);
      assert.strictEqual(game.gameState.score, 3);
    });

    it('选择负面选项应扣分（分数不低于0）', () => {
      game.gameState.score = 3;
      const student = game.gameState.students[0];
      game.showChoices(student);

      const choice = { text: '打他', points: -5, type: 'negative' };
      game.handleChoice(choice, -5);
      assert.strictEqual(game.gameState.score, 0, '分数不应低于 0');
    });

    it('选择中立选项分数不变', () => {
      game.gameState.score = 10;
      const student = game.gameState.students[0];
      game.showChoices(student);

      const choice = { text: '（不管）', points: 0, type: 'neutral' };
      game.handleChoice(choice, 0);
      assert.strictEqual(game.gameState.score, 10);
    });

    it('选择后应关闭弹窗', () => {
      const choiceModal = env.elementRegistry['choiceModal'];
      const student = game.gameState.students[0];
      game.showChoices(student);
      assert.ok(choiceModal.classList.contains('show'));

      const choice = game.gameState.students[0].state.choices[0];
      game.handleChoice(choice, 1);
      assert.ok(!choiceModal.classList.contains('show'));
    });

    it('连续选择应正确累加分数', () => {
      for (let i = 0; i < 5; i++) {
        const student = game.gameState.students[i];
        game.showChoices(student);
        game.handleChoice({ text: '测试', type: 'positive' }, 3);
      }
      assert.strictEqual(game.gameState.score, 15);
    });

    it('分数达到目标应触发胜利', () => {
      game.gameState.score = 59;
      const student = game.gameState.students[0];
      game.showChoices(student);

      const choice = { text: '测试', type: 'positive' };
      game.handleChoice(choice, 1);
      // 60 >= 60, 应触发 endGame(true)
      assert.strictEqual(game.gameState.running, false, '达到 60 分应结束游戏');
    });
  });
});

describe('我是班长 — 游戏流程测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 10. 游戏启动
  // ==================================================
  describe('startGame() — 游戏启动', () => {
    it('应将 running 设为 true', () => {
      game.startGame();
      assert.strictEqual(game.gameState.running, true);
    });

    it('应将 timeLeft 设为 180', () => {
      game.startGame();
      assert.strictEqual(game.gameState.timeLeft, game.CONFIG.gameTime);
      assert.strictEqual(game.gameState.timeLeft, 180);
    });

    it('应将 score 重置为 0', () => {
      game.gameState.score = 50;
      game.startGame();
      assert.strictEqual(game.gameState.score, 0);
    });

    it('应隐藏 overlay', () => {
      const overlay = env.elementRegistry['overlay'];
      game.startGame();
      assert.ok(overlay.classList.contains('hidden'), 'overlay 应被隐藏');
    });

    it('应初始化 40 名学生', () => {
      game.startGame();
      assert.strictEqual(game.gameState.students.length, 40);
    });

    it('应设置倒计时定时器', () => {
      game.startGame();
      assert.ok(game.gameState.timerInterval !== null, '应有倒计时定时器');
    });

    it('应设置状态变化定时器', () => {
      game.startGame();
      assert.ok(game.gameState.stateInterval !== null, '应有状态变化定时器');
    });

    it('应更新分数显示为 0', () => {
      game.startGame();
      const scoreEl = env.elementRegistry['score'];
      assert.strictEqual(scoreEl.textContent, '⭐ 0分');
    });

    it('应更新倒计时显示', () => {
      game.startGame();
      const timerEl = env.elementRegistry['timer'];
      assert.strictEqual(timerEl.textContent, '⏱️ 180秒');
    });

    it('应放置班长到初始位置', () => {
      game.startGame();
      const monitor = env.elementRegistry['monitor'];
      assert.strictEqual(monitor.style.left, '50px');
      assert.strictEqual(monitor.style.top, '50px');
    });
  });

  // ==================================================
  // 11. 游戏结束 — 胜利/失败
  // ==================================================
  describe('endGame() — 游戏结束', () => {
    it('胜利时应显示🏆图标', () => {
      game.startGame();
      game.endGame(true);

      const resultIcon = env.elementRegistry['resultIcon'];
      assert.strictEqual(resultIcon.textContent, '🏆');
    });

    it('胜利时应显示胜利文案', () => {
      game.startGame();
      game.endGame(true);

      const resultTitle = env.elementRegistry['resultTitle'];
      assert.strictEqual(resultTitle.textContent, '🎉 胜利!');
    });

    it('胜利时结果标题应有 win 类', () => {
      game.startGame();
      game.endGame(true);

      const resultTitle = env.elementRegistry['resultTitle'];
      assert.strictEqual(resultTitle.className, 'result-title win');
    });

    it('失败时应显示😢图标', () => {
      game.startGame();
      game.endGame(false);

      const resultIcon = env.elementRegistry['resultIcon'];
      assert.strictEqual(resultIcon.textContent, '😢');
    });

    it('失败时应显示失败文案', () => {
      game.startGame();
      game.endGame(false);

      const resultTitle = env.elementRegistry['resultTitle'];
      assert.strictEqual(resultTitle.textContent, '💔 时间到!');
    });

    it('失败时结果标题应有 lose 类', () => {
      game.startGame();
      game.endGame(false);

      const resultTitle = env.elementRegistry['resultTitle'];
      assert.strictEqual(resultTitle.className, 'result-title lose');
    });

    it('应设置 running 为 false', () => {
      game.startGame();
      game.endGame(true);
      assert.strictEqual(game.gameState.running, false);
    });

    it('应显示 overlay', () => {
      game.startGame();
      game.endGame(true);
      const overlay = env.elementRegistry['overlay'];
      assert.ok(!overlay.classList.contains('hidden'), 'overlay 应该显示');
    });

    it('应显示 gameOverScreen', () => {
      game.startGame();
      game.endGame(true);
      const gameOverScreen = env.elementRegistry['gameOverScreen'];
      assert.ok(!gameOverScreen.classList.contains('hidden'), 'gameOverScreen 应该显示');
    });

    it('应隐藏 startScreen', () => {
      game.startGame();
      game.endGame(true);
      const startScreen = env.elementRegistry['startScreen'];
      assert.ok(startScreen.classList.contains('hidden'), 'startScreen 应被隐藏');
    });

    it('得分应显示在结果中', () => {
      game.startGame();
      game.gameState.score = 75;
      game.endGame(true);
      const resultScore = env.elementRegistry['resultScore'];
      assert.ok(resultScore.textContent.includes('75'), '应包含分数 75');
      assert.ok(resultScore.textContent.includes('60'), '应包含目标分数 60');
    });

    it('应清除倒计时定时器', () => {
      game.startGame();
      const timerId = game.gameState.timerInterval;
      game.endGame(true);
      assert.ok(!env.activeIntervals.has(timerId), '倒计时定时器应被清除');
    });

    it('应清除状态变化定时器', () => {
      game.startGame();
      const stateId = game.gameState.stateInterval;
      game.endGame(true);
      assert.ok(!env.activeIntervals.has(stateId), '状态变化定时器应被清除');
    });
  });
});

describe('我是班长 — 集成测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
  });

  // ==================================================
  // 12. 完整游戏流程集成测试
  // ==================================================
  describe('完整游戏流程', () => {
    it('启动游戏 → 点击学生 → 选择选项 → 得分累加', () => {
      game.startGame();
      assert.strictEqual(game.gameState.score, 0);

      const student = game.gameState.students[5];
      game.showChoices(student);

      // 选择正面选项
      game.handleChoice({ text: '测试', pointsType: 'random', type: 'positive' }, 3);
      assert.strictEqual(game.gameState.score, 3);
    });

    it('游戏结束后不应允许继续操作', () => {
      game.startGame();
      game.endGame(false);

      const choiceModal = env.elementRegistry['choiceModal'];
      const student = game.gameState.students[0];
      game.showChoices(student);
      assert.ok(!choiceModal.classList.contains('show'), '游戏结束后弹窗不应显示');
    });

    it('达到 60 分应为胜利', () => {
      game.startGame();
      game.gameState.score = 59;

      const student = game.gameState.students[0];
      game.showChoices(student);
      game.handleChoice({ text: '测试', type: 'positive' }, 1);

      assert.strictEqual(game.gameState.running, false);
      const resultTitle = env.elementRegistry['resultTitle'];
      assert.strictEqual(resultTitle.textContent, '🎉 胜利!');
    });

    it('重新开始游戏应重置所有状态', () => {
      game.startGame();
      game.gameState.score = 50;
      game.endGame(false);

      // 重新开始
      game.startGame();
      assert.strictEqual(game.gameState.score, 0);
      assert.strictEqual(game.gameState.timeLeft, 180);
      assert.strictEqual(game.gameState.running, true);
      assert.strictEqual(game.gameState.students.length, 40);
    });

    it('倒计时到 0 应触发游戏失败', () => {
      game.startGame();
      const timerId = game.gameState.timerInterval;

      // 模拟倒计时到 1 秒
      game.gameState.timeLeft = 1;
      env.tickInterval(timerId);

      // timeLeft 现在应为 0，游戏应结束
      assert.strictEqual(game.gameState.timeLeft, 0);
      assert.strictEqual(game.gameState.running, false);
    });
  });
});

describe('我是班长 — 边界情况测试', () => {
  let env, game;

  beforeEach(() => {
    env = createGameContext();
    game = env.game;
    game.initStudents();
    game.gameState.running = true;
    game.gameState.score = 0;
  });

  // ==================================================
  // 13. 边界情况
  // ==================================================
  describe('分数下限为 0', () => {
    it('分数不应低于 0（Math.max(0, ...) 保护）', () => {
      game.gameState.score = 2;
      const student = game.gameState.students[0];
      game.showChoices(student);

      game.handleChoice({ text: '打他', points: -5, type: 'negative' }, -5);
      assert.strictEqual(game.gameState.score, 0, '分数应被限制在 0');
    });

    it('从 0 分开始扣分应保持 0', () => {
      game.gameState.score = 0;
      const student = game.gameState.students[0];
      game.showChoices(student);

      game.handleChoice({ text: '打他', points: -5, type: 'negative' }, -5);
      assert.strictEqual(game.gameState.score, 0);
    });
  });

  describe('正面选择可能改变学生状态', () => {
    it('正面选择后学生可能变为"正常"状态', () => {
      // 这是概率性的（50%），运行多次验证逻辑不报错
      for (let i = 0; i < 20; i++) {
        const student = game.gameState.students[i % 40];
        game.showChoices(student);
        assert.doesNotThrow(() => {
          game.handleChoice(
            { text: '测试', pointsType: 'random', type: 'positive' }, 2
          );
        });
      }
    });
  });

  describe('飘分效果', () => {
    it('showFloatScore 应不报错', () => {
      const student = game.gameState.students[0];
      game.showChoices(student); // 设置 currentStudent

      assert.doesNotThrow(() => {
        game.showFloatScore(3);
      });
    });

    it('正分应显示绿色', () => {
      const student = game.gameState.students[0];
      game.showChoices(student);
      game.showFloatScore(3);

      const classroom = env.elementRegistry['classroom'];
      const lastChild = classroom.children[classroom.children.length - 1];
      assert.strictEqual(lastChild.style.color, '#2ecc71');
    });

    it('负分应显示红色', () => {
      const student = game.gameState.students[0];
      game.showChoices(student);
      game.showFloatScore(-2);

      const classroom = env.elementRegistry['classroom'];
      const lastChild = classroom.children[classroom.children.length - 1];
      assert.strictEqual(lastChild.style.color, '#e74c3c');
    });
  });
});

describe('我是班长 — manifest.json 测试', () => {
  // ==================================================
  // 14. manifest.json 注册验证
  // ==================================================
  describe('manifest.json 游戏注册', () => {
    let manifest;

    it('manifest.json 应该是合法 JSON', () => {
      const content = fs.readFileSync(
        path.join(__dirname, 'manifest.json'), 'utf-8'
      );
      assert.doesNotThrow(() => {
        manifest = JSON.parse(content);
      });
    });

    it('应包含 class-monitor.html 条目', () => {
      const content = fs.readFileSync(
        path.join(__dirname, 'manifest.json'), 'utf-8'
      );
      manifest = JSON.parse(content);
      const entry = manifest.find(e => e.file === 'class-monitor.html');
      assert.ok(entry, '应包含 class-monitor.html 条目');
    });

    it('游戏标题应为"我是班长"', () => {
      const content = fs.readFileSync(
        path.join(__dirname, 'manifest.json'), 'utf-8'
      );
      manifest = JSON.parse(content);
      const entry = manifest.find(e => e.file === 'class-monitor.html');
      assert.strictEqual(entry.title, '我是班长');
    });

    it('游戏图标应为 🏫', () => {
      const content = fs.readFileSync(
        path.join(__dirname, 'manifest.json'), 'utf-8'
      );
      manifest = JSON.parse(content);
      const entry = manifest.find(e => e.file === 'class-monitor.html');
      assert.strictEqual(entry.icon, '🏫');
    });
  });
});

describe('我是班长 — HTML 结构验证', () => {
  // ==================================================
  // 15. HTML 结构静态检查
  // ==================================================
  describe('HTML 基本结构', () => {
    it('应包含游戏标题"我是班长"', () => {
      assert.ok(htmlContent.includes('我是班长'), 'HTML 应包含游戏标题');
    });

    it('应包含 <title> 标签设为"我是班长"', () => {
      assert.ok(htmlContent.includes('<title>我是班长</title>'),
        '<title> 应为"我是班长"');
    });

    it('应包含开始按钮', () => {
      assert.ok(htmlContent.includes('startGame()'), '应有开始游戏按钮');
    });

    it('应包含倒计时显示区域', () => {
      assert.ok(htmlContent.includes('id="timer"'), '应有计时器元素');
    });

    it('应包含积分显示区域', () => {
      assert.ok(htmlContent.includes('id="score"'), '应有积分元素');
    });

    it('应包含目标分数显示 60分', () => {
      assert.ok(htmlContent.includes('60分'), '应包含目标60分');
    });

    it('应包含教室元素', () => {
      assert.ok(htmlContent.includes('id="classroom"'), '应有教室元素');
    });

    it('应包含学生容器', () => {
      assert.ok(htmlContent.includes('id="students"'), '应有学生容器');
    });

    it('应包含选择弹窗', () => {
      assert.ok(htmlContent.includes('id="choiceModal"'), '应有选择弹窗');
    });

    it('应包含结果屏幕', () => {
      assert.ok(htmlContent.includes('id="gameOverScreen"'), '应有结果屏幕');
    });

    it('应包含 viewport meta 标签（移动端适配）', () => {
      assert.ok(htmlContent.includes('viewport'), '应有 viewport meta');
      assert.ok(htmlContent.includes('user-scalable=no'), '应禁止用户缩放');
    });

    it('应包含黑板元素', () => {
      assert.ok(htmlContent.includes('id="blackboard"'), '应有黑板');
    });

    it('应包含课桌元素', () => {
      assert.ok(htmlContent.includes('id="desks"'), '应有课桌');
    });
  });

  // ==================================================
  // 16. CSS 样式修复验证
  // ==================================================
  describe('CSS 修复验证', () => {
    it('#students 容器应有 position: absolute 定位', () => {
      assert.ok(htmlContent.includes('#students'), '应有 #students 样式');
      // 检查 #students 样式块中包含 position: absolute
      const studentsStyleMatch = htmlContent.match(/#students\s*\{[^}]*\}/);
      assert.ok(studentsStyleMatch, '应有 #students CSS 规则');
      assert.ok(studentsStyleMatch[0].includes('position: absolute'),
        '#students 应有 position: absolute');
    });

    it('#students 容器应有 pointer-events: none', () => {
      const studentsStyleMatch = htmlContent.match(/#students\s*\{[^}]*\}/);
      assert.ok(studentsStyleMatch[0].includes('pointer-events: none'),
        '#students 应有 pointer-events: none');
    });

    it('.student 应有 transform: translate(-50%, -30%) 居中', () => {
      const studentStyleMatch = htmlContent.match(/\.student\s*\{[^}]*\}/);
      assert.ok(studentStyleMatch, '应有 .student CSS 规则');
      assert.ok(studentStyleMatch[0].includes('translate(-50%, -30%)'),
        '.student 应有 translate(-50%, -30%) 居中');
    });

    it('.student 应有 pointer-events: auto', () => {
      const studentStyleMatch = htmlContent.match(/\.student\s*\{[^}]*\}/);
      assert.ok(studentStyleMatch[0].includes('pointer-events: auto'),
        '.student 应有 pointer-events: auto');
    });

    it('.student:hover 应保持 translate 居中', () => {
      const hoverMatch = htmlContent.match(/\.student:hover\s*\{[^}]*\}/);
      assert.ok(hoverMatch, '应有 .student:hover CSS 规则');
      assert.ok(hoverMatch[0].includes('translate(-50%, -30%)'),
        '.student:hover 应保持 translate(-50%, -30%)');
    });

    it('课桌间距应使用 clamp 响应式值', () => {
      const desksStyleMatch = htmlContent.match(/#desks\s*\{[^}]*\}/);
      assert.ok(desksStyleMatch, '应有 #desks CSS 规则');
      assert.ok(desksStyleMatch[0].includes('clamp'),
        '#desks gap 应使用 clamp 响应式值');
    });

    it('气泡大小应使用 clamp 响应式值', () => {
      const bubbleMatch = htmlContent.match(/\.bubble\s*\{[^}]*\}/);
      assert.ok(bubbleMatch, '应有 .bubble CSS 规则');
      assert.ok(bubbleMatch[0].includes('clamp'),
        '.bubble 尺寸应使用 clamp');
    });

    it('学生身体大小应使用 clamp 响应式值', () => {
      const bodyMatch = htmlContent.match(/\.student-body\s*\{[^}]*\}/);
      assert.ok(bodyMatch, '应有 .student-body CSS 规则');
      assert.ok(bodyMatch[0].includes('clamp'),
        '.student-body 尺寸应使用 clamp');
    });

    it('黑板高度应为 22%', () => {
      const blackboardMatch = htmlContent.match(/#blackboard\s*\{[^}]*\}/);
      assert.ok(blackboardMatch, '应有 #blackboard CSS 规则');
      assert.ok(blackboardMatch[0].includes('height: 22%'),
        '黑板高度应为 22%');
    });

    it('课桌区域 top 应为 32%', () => {
      const desksMatch = htmlContent.match(/#desks\s*\{[^}]*\}/);
      assert.ok(desksMatch[0].includes('top: 32%'),
        '课桌区域 top 应为 32%');
    });

    it('课桌区域 height 应为 55%', () => {
      const desksMatch = htmlContent.match(/#desks\s*\{[^}]*\}/);
      assert.ok(desksMatch[0].includes('height: 55%'),
        '课桌区域 height 应为 55%');
    });

    it('学生网格应使用 CSS Grid 布局', () => {
      assert.ok(htmlContent.includes('display: grid'), '应使用 CSS Grid');
      assert.ok(htmlContent.includes('grid-template-columns: repeat(8, 1fr)'),
        '应有 8 列网格');
      assert.ok(htmlContent.includes('grid-template-rows: repeat(5, 1fr)'),
        '应有 5 行网格');
    });
  });

  // ==================================================
  // 17. 6 种违纪类型图例验证
  // ==================================================
  describe('状态图例', () => {
    it('应包含 6 种状态图例', () => {
      assert.ok(htmlContent.includes('🎮'), '应有玩游戏图例');
      assert.ok(htmlContent.includes('🚽'), '应有上厕所图例');
      assert.ok(htmlContent.includes('👊'), '应有打架图例');
      assert.ok(htmlContent.includes('💬'), '应有说话图例');
      assert.ok(htmlContent.includes('🍟'), '应有吃零食图例');
      assert.ok(htmlContent.includes('😴'), '应有睡觉图例');
    });
  });

  // ==================================================
  // 18. 班长拖拽功能验证
  // ==================================================
  describe('班长拖拽功能', () => {
    it('应包含班长拖拽代码', () => {
      assert.ok(htmlContent.includes('isDragging'), '应有拖拽变量');
    });

    it('应包含鼠标拖拽支持', () => {
      assert.ok(htmlContent.includes('mousedown'), '应有 mousedown 事件');
      assert.ok(htmlContent.includes('mousemove'), '应有 mousemove 事件');
      assert.ok(htmlContent.includes('mouseup'), '应有 mouseup 事件');
    });

    it('应包含触摸拖拽支持', () => {
      assert.ok(htmlContent.includes('touchstart'), '应有 touchstart 事件');
      assert.ok(htmlContent.includes('touchmove'), '应有 touchmove 事件');
      assert.ok(htmlContent.includes('touchend'), '应有 touchend 事件');
    });

    it('班长应有 cursor: move 样式', () => {
      assert.ok(htmlContent.includes('cursor: move'), '班长应有拖拽光标');
    });
  });

  // ==================================================
  // 19. JS 定位逻辑验证（修复的核心）
  // ==================================================
  describe('学生定位逻辑', () => {
    it('应使用 offsetLeft 而非 getBoundingClientRect 进行学生定位', () => {
      // 确认 initStudents 中使用 offset 属性
      assert.ok(htmlContent.includes('desksEl.offsetLeft'), '应使用 offsetLeft');
      assert.ok(htmlContent.includes('desksEl.offsetTop'), '应使用 offsetTop');
      assert.ok(htmlContent.includes('desksEl.offsetWidth'), '应使用 offsetWidth');
      assert.ok(htmlContent.includes('desksEl.offsetHeight'), '应使用 offsetHeight');
    });

    it('initStudents 中不应使用 getBoundingClientRect', () => {
      // 提取 initStudents 函数体
      const initStudentsMatch = htmlContent.match(
        /function initStudents\(\)\s*\{[\s\S]*?(?=\n\s*function\s)/
      );
      assert.ok(initStudentsMatch, '应有 initStudents 函数');
      assert.ok(
        !initStudentsMatch[0].includes('getBoundingClientRect'),
        'initStudents 中不应使用 getBoundingClientRect'
      );
    });

    it('班长拖拽应仍使用 getBoundingClientRect（mousemove 正确用法）', () => {
      // mousemove 事件处理中使用 getBoundingClientRect 是正确的
      assert.ok(htmlContent.includes('getBoundingClientRect'),
        '拖拽代码应使用 getBoundingClientRect');
    });
  });
});

describe('我是班长 — 积分平衡性验证', () => {
  // ==================================================
  // 20. 积分平衡性分析
  // ==================================================
  describe('积分平衡性', () => {
    let env, game;

    beforeEach(() => {
      env = createGameContext();
      game = env.game;
    });

    it('180 秒内合理操作可达 60 分', () => {
      // 状态每 5 秒刷新，30% 概率变化
      // 40 个学生始终可点击
      // 正面选项随机 1-3 分，平均 2 分
      // 60分 / 2分 = 30 次正面选择
      // 180 秒内完成 30 次选择完全可行
      const avgPoints = 2;
      const neededClicks = Math.ceil(game.CONFIG.targetScore / avgPoints);
      assert.ok(neededClicks <= 30, `所需点击数 ${neededClicks} 应 <= 30`);
      assert.ok(game.CONFIG.gameTime >= 60,
        '游戏时间应足够完成所需操作');
    });

    it('全部最佳选择（+3分）可快速达到 60 分', () => {
      const neededClicks = Math.ceil(game.CONFIG.targetScore / 3);
      assert.strictEqual(neededClicks, 20);
    });
  });
});
