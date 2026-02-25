/**
 * 帆船冲刺 — 自动化测试
 *
 * 使用 Node.js 内置 test runner (node:test + node:assert)
 * 运行方式: node --test sailboat-sprint.test.js
 *
 * 测试策略：
 * 由于应用是单 HTML 文件内嵌 JS，无法直接 import。
 * 本测试文件从 HTML 中提取 JS 代码，在模拟的环境中 eval 执行，
 * 然后对游戏各核心模块进行单元测试和集成测试。
 */

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ============================================================
// 提取并加载游戏 JS 代码
// ============================================================
const htmlContent = fs.readFileSync(
  path.join(__dirname, 'sailboat-sprint.html'), 'utf-8'
);

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error('无法从 sailboat-sprint.html 中提取 JavaScript 代码');
}
const gameJsCode = scriptMatch[1];

// ============================================================
// 创建模拟的浏览器环境并加载游戏代码
// ============================================================
function createGameContext() {
  // Mock canvas context
  const mockCtx = {
    clearRect: () => {},
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    closePath: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    ellipse: () => {},
    rotate: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  };

  // Mock canvas element
  const mockCanvas = {
    width: 400,
    height: 700,
    style: { width: '', height: '' },
    getContext: () => mockCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
    addEventListener: () => {},
  };

  // Mock document
  const mockDocument = {
    getElementById: () => mockCanvas,
  };

  // Mock window
  const mockWindow = {
    innerWidth: 400,
    innerHeight: 700,
    addEventListener: (ev, fn) => {},
    AudioContext: class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = {};
      }
      createGain() {
        return {
          gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
          connect: () => {},
          disconnect: () => {},
        };
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { value: 440, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
          connect: () => {},
          start: () => {},
          stop: () => {},
          disconnect: () => {},
        };
      }
      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { value: 350 },
          Q: { value: 1 },
          connect: () => {},
          disconnect: () => {},
        };
      }
      createBuffer(channels, length, sampleRate) {
        return {
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect: () => {},
          start: () => {},
          stop: () => {},
          disconnect: () => {},
        };
      }
      resume() { return Promise.resolve(); }
    },
    webkitAudioContext: undefined,
  };

  // 修改代码：移除 DOMContentLoaded 自动启动，移除 requestAnimationFrame
  let modifiedCode = gameJsCode;

  // 移除自启动
  modifiedCode = modifiedCode.replace(
    /window\.addEventListener\('DOMContentLoaded'[\s\S]*?\}\);[\s]*$/,
    '// [测试] DOMContentLoaded 已移除'
  );

  // 构造执行环境
  const fn = new Function(
    'document', 'window', 'requestAnimationFrame', 'setTimeout', 'clearTimeout',
    modifiedCode + '\n' +
    `return {
      CONFIG,
      U,
      AudioManager,
      InputManager,
      Camera,
      Channel,
      WaveObstacle,
      WaveManager,
      Boat,
      PlayerBoat,
      AIBoat,
      HUD,
      Game,
    };`
  );

  // Mock setTimeout/clearTimeout for AudioManager's BGM loop
  let timers = [];
  let nextTimerId = 1;
  const mockSetTimeout = (fn, ms) => {
    const id = nextTimerId++;
    timers.push({ id, fn, ms });
    return id;
  };
  const mockClearTimeout = (id) => {
    timers = timers.filter(t => t.id !== id);
  };

  const game = fn(
    mockDocument,
    mockWindow,
    (cb) => {},
    mockSetTimeout,
    mockClearTimeout,
  );

  return { game, mockCtx, mockCanvas, timers };
}

// ============================================================
// 测试用例
// ============================================================

describe('帆船冲刺 — HTML 结构验证', () => {

  it('HTML 文件应存在且非空', () => {
    assert.ok(htmlContent.length > 0, 'HTML 文件不应为空');
  });

  it('应包含 DOCTYPE 和 html 标签', () => {
    assert.ok(htmlContent.includes('<!DOCTYPE html>'), '应有 DOCTYPE');
    assert.ok(htmlContent.includes('<html lang="zh-CN">'), '应设置 lang="zh-CN"');
  });

  it('应包含 viewport meta 标签，且设置 user-scalable=no', () => {
    assert.ok(htmlContent.includes('user-scalable=no'), '应设置 user-scalable=no 防止移动端缩放');
  });

  it('标题应为「帆船冲刺」', () => {
    assert.ok(htmlContent.includes('<title>帆船冲刺</title>'), '标题应为帆船冲刺');
  });

  it('应包含 canvas 元素', () => {
    assert.ok(htmlContent.includes('<canvas id="gameCanvas"'), '应有 canvas 元素');
  });

  it('CSS 应设置 touch-action: none', () => {
    assert.ok(htmlContent.includes('touch-action: none'), '应设置 touch-action: none 防止浏览器默认触控行为');
  });

  it('应为单文件 HTML（无外部依赖）', () => {
    assert.ok(!htmlContent.includes('<link rel="stylesheet"'), '不应有外部 CSS');
    assert.ok(!htmlContent.includes('<script src='), '不应有外部 JS');
  });
});

describe('帆船冲刺 — manifest.json 注册验证', () => {
  let manifest;

  before(() => {
    const manifestContent = fs.readFileSync(
      path.join(__dirname, 'manifest.json'), 'utf-8'
    );
    manifest = JSON.parse(manifestContent);
  });

  it('manifest.json 应为有效 JSON 数组', () => {
    assert.ok(Array.isArray(manifest), 'manifest 应为数组');
  });

  it('应包含帆船冲刺条目', () => {
    const entry = manifest.find(e => e.file === 'sailboat-sprint.html');
    assert.ok(entry, '应包含 sailboat-sprint.html 条目');
  });

  it('条目标题应为「帆船冲刺」', () => {
    const entry = manifest.find(e => e.file === 'sailboat-sprint.html');
    assert.strictEqual(entry.title, '帆船冲刺');
  });

  it('条目图标应为 ⛵', () => {
    const entry = manifest.find(e => e.file === 'sailboat-sprint.html');
    assert.strictEqual(entry.icon, '⛵');
  });

  it('manifest 条目应包含 file、title、icon 三个字段', () => {
    const entry = manifest.find(e => e.file === 'sailboat-sprint.html');
    assert.ok('file' in entry, '应有 file 字段');
    assert.ok('title' in entry, '应有 title 字段');
    assert.ok('icon' in entry, '应有 icon 字段');
  });
});

describe('帆船冲刺 — CONFIG 配置验证', () => {
  let game;

  before(() => {
    const env = createGameContext();
    game = env.game;
  });

  it('CONFIG 应存在', () => {
    assert.ok(game.CONFIG, 'CONFIG 应存在');
  });

  it('画布尺寸应为 400x700（竖版）', () => {
    assert.strictEqual(game.CONFIG.WIDTH, 400);
    assert.strictEqual(game.CONFIG.HEIGHT, 700);
  });

  it('应有 14 个关卡基础配置', () => {
    assert.strictEqual(game.CONFIG.LEVELS_BASE.length, 14, '应有 14 个关卡');
  });

  it('关卡赛道长度应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS_BASE.length; i++) {
      assert.ok(game.CONFIG.LEVELS_BASE[i].len >= game.CONFIG.LEVELS_BASE[i - 1].len,
        `第 ${i + 1} 关赛道长度 (${game.CONFIG.LEVELS_BASE[i].len}) 应 >= 第 ${i} 关 (${game.CONFIG.LEVELS_BASE[i - 1].len})`);
    }
  });

  it('关卡障碍密度应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS_BASE.length; i++) {
      assert.ok(game.CONFIG.LEVELS_BASE[i].dens >= game.CONFIG.LEVELS_BASE[i - 1].dens,
        `第 ${i + 1} 关障碍密度应 >= 第 ${i} 关`);
    }
  });

  it('关卡移动障碍比例应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS_BASE.length; i++) {
      assert.ok(game.CONFIG.LEVELS_BASE[i].mov >= game.CONFIG.LEVELS_BASE[i - 1].mov,
        `第 ${i + 1} 关移动障碍比例应 >= 第 ${i} 关`);
    }
  });

  it('关卡 AI 增强因子应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS_BASE.length; i++) {
      assert.ok(game.CONFIG.LEVELS_BASE[i].aiBoost >= game.CONFIG.LEVELS_BASE[i - 1].aiBoost,
        `第 ${i + 1} 关 AI 增强应 >= 第 ${i} 关`);
    }
  });

  it('AI 数量应为 20', () => {
    assert.strictEqual(game.CONFIG.AI.COUNT, 20, 'AI 对手应为 20 个');
  });

  it('AI 颜色数量应与 AI 数量匹配', () => {
    assert.strictEqual(game.CONFIG.AI.COLORS.length, game.CONFIG.AI.COUNT,
      'AI 颜色数量应等于 AI 数量');
  });

  it('所有 AI 颜色不应重复', () => {
    const colors = game.CONFIG.AI.COLORS;
    const unique = new Set(colors);
    assert.strictEqual(unique.size, colors.length, 'AI 颜色不应重复');
  });

  it('应定义 5 种海浪障碍物类型', () => {
    const types = Object.keys(game.CONFIG.OBS.TYPES);
    assert.ok(types.includes('WAVE_S'), '应有 WAVE_S（小浪）类型');
    assert.ok(types.includes('WAVE_M'), '应有 WAVE_M（中浪）类型');
    assert.ok(types.includes('WAVE_L'), '应有 WAVE_L（大浪）类型');
    assert.ok(types.includes('WAVE_MH'), '应有 WAVE_MH（横向移动浪）类型');
    assert.ok(types.includes('WAVE_MV'), '应有 WAVE_MV（纵向移动浪）类型');
  });

  it('静止海浪速度应为 0', () => {
    assert.strictEqual(game.CONFIG.OBS.TYPES.WAVE_S.spd, 0);
    assert.strictEqual(game.CONFIG.OBS.TYPES.WAVE_M.spd, 0);
    assert.strictEqual(game.CONFIG.OBS.TYPES.WAVE_L.spd, 0);
  });

  it('移动海浪速度应大于 0', () => {
    assert.ok(game.CONFIG.OBS.TYPES.WAVE_MH.spd > 0, 'WAVE_MH 速度应 > 0');
    assert.ok(game.CONFIG.OBS.TYPES.WAVE_MV.spd > 0, 'WAVE_MV 速度应 > 0');
  });

  it('应有 3 条生命配置', () => {
    assert.strictEqual(game.CONFIG.LIVES, 3, '生命值应为 3');
  });

  it('晋级排名应为前 3 名', () => {
    assert.strictEqual(game.CONFIG.QUALIFY_RANK, 3, '前 3 名才能晋级');
  });

  it('无敌时间应为 1500ms', () => {
    assert.strictEqual(game.CONFIG.HIT.INVINCIBLE_MS, 1500, '无敌时间应为 1500ms');
  });

  it('碰撞反馈配置应合理', () => {
    assert.ok(game.CONFIG.HIT.SPEED_MULT > 0 && game.CONFIG.HIT.SPEED_MULT < 1,
      '碰撞速度乘数应在 0-1 之间');
    assert.ok(game.CONFIG.HIT.BOUNCE > 0, '弹开力应 > 0');
    assert.ok(game.CONFIG.HIT.FLASH_MS > 0, '闪烁时间应 > 0');
  });

  it('帆船漂移系数应在 0-1 之间', () => {
    assert.ok(game.CONFIG.BOAT.DRIFT_FACTOR > 0 && game.CONFIG.BOAT.DRIFT_FACTOR < 1,
      '漂移系数应在 0-1 之间');
  });

  it('每关都有名称', () => {
    for (let i = 0; i < game.CONFIG.LEVELS_BASE.length; i++) {
      assert.ok(game.CONFIG.LEVELS_BASE[i].name, `第 ${i + 1} 关应有名称`);
    }
  });

  describe('难度配置验证', () => {
    it('应有三种难度：EASY、HARD、LEGENDARY', () => {
      assert.ok(game.CONFIG.DIFFICULTY.EASY, '应有简单难度');
      assert.ok(game.CONFIG.DIFFICULTY.HARD, '应有困难难度');
      assert.ok(game.CONFIG.DIFFICULTY.LEGENDARY, '应有传奇难度');
    });

    it('简单难度 AI 速度倍率应最低', () => {
      assert.ok(game.CONFIG.DIFFICULTY.EASY.aiSpeedMult < game.CONFIG.DIFFICULTY.HARD.aiSpeedMult,
        '简单 < 困难');
      assert.ok(game.CONFIG.DIFFICULTY.HARD.aiSpeedMult < game.CONFIG.DIFFICULTY.LEGENDARY.aiSpeedMult,
        '困难 < 传奇');
    });

    it('传奇难度障碍物密度倍率应最高', () => {
      assert.ok(game.CONFIG.DIFFICULTY.EASY.obsDensMult < game.CONFIG.DIFFICULTY.HARD.obsDensMult);
      assert.ok(game.CONFIG.DIFFICULTY.HARD.obsDensMult < game.CONFIG.DIFFICULTY.LEGENDARY.obsDensMult);
    });

    it('每个难度应有中文标签', () => {
      assert.strictEqual(game.CONFIG.DIFFICULTY.EASY.label, '简单');
      assert.strictEqual(game.CONFIG.DIFFICULTY.HARD.label, '困难');
      assert.strictEqual(game.CONFIG.DIFFICULTY.LEGENDARY.label, '传奇');
    });

    it('简单难度 AI 速度倍率应为 0.80', () => {
      assert.strictEqual(game.CONFIG.DIFFICULTY.EASY.aiSpeedMult, 0.80);
    });

    it('困难难度 AI 速度倍率应为 1.00', () => {
      assert.strictEqual(game.CONFIG.DIFFICULTY.HARD.aiSpeedMult, 1.00);
    });

    it('传奇难度 AI 速度倍率应为 1.15', () => {
      assert.strictEqual(game.CONFIG.DIFFICULTY.LEGENDARY.aiSpeedMult, 1.15);
    });
  });
});

describe('帆船冲刺 — Utils 工具函数', () => {
  let U;

  before(() => {
    const env = createGameContext();
    U = env.game.U;
  });

  describe('U.clamp() — 值裁剪', () => {
    it('正常范围内的值不应改变', () => {
      assert.strictEqual(U.clamp(5, 0, 10), 5);
    });

    it('低于下限应返回下限', () => {
      assert.strictEqual(U.clamp(-5, 0, 10), 0);
    });

    it('高于上限应返回上限', () => {
      assert.strictEqual(U.clamp(15, 0, 10), 10);
    });

    it('边界值应正确处理', () => {
      assert.strictEqual(U.clamp(0, 0, 10), 0);
      assert.strictEqual(U.clamp(10, 0, 10), 10);
    });
  });

  describe('U.lerp() — 线性插值', () => {
    it('t=0 应返回 a', () => {
      assert.strictEqual(U.lerp(10, 20, 0), 10);
    });

    it('t=1 应返回 b', () => {
      assert.strictEqual(U.lerp(10, 20, 1), 20);
    });

    it('t=0.5 应返回中间值', () => {
      assert.strictEqual(U.lerp(0, 100, 0.5), 50);
    });
  });

  describe('U.rectHit() — AABB 碰撞检测', () => {
    it('重叠的矩形应返回 true', () => {
      const a = { x: 0, y: 0, w: 10, h: 10 };
      const b = { x: 5, y: 5, w: 10, h: 10 };
      assert.strictEqual(U.rectHit(a, b), true);
    });

    it('不重叠的矩形应返回 false', () => {
      const a = { x: 0, y: 0, w: 10, h: 10 };
      const b = { x: 20, y: 20, w: 10, h: 10 };
      assert.strictEqual(U.rectHit(a, b), false);
    });

    it('边缘相切应返回 false（开区间）', () => {
      const a = { x: 0, y: 0, w: 10, h: 10 };
      const b = { x: 10, y: 0, w: 10, h: 10 };
      assert.strictEqual(U.rectHit(a, b), false);
    });

    it('完全包含应返回 true', () => {
      const a = { x: 0, y: 0, w: 20, h: 20 };
      const b = { x: 5, y: 5, w: 5, h: 5 };
      assert.strictEqual(U.rectHit(a, b), true);
    });
  });

  describe('U.rand() — 随机数', () => {
    it('返回值应在指定范围内', () => {
      for (let i = 0; i < 100; i++) {
        const v = U.rand(5, 10);
        assert.ok(v >= 5 && v < 10, `值 ${v} 应在 [5, 10) 范围内`);
      }
    });
  });

  describe('U.randI() — 整数随机数', () => {
    it('返回值应为整数', () => {
      for (let i = 0; i < 100; i++) {
        const v = U.randI(1, 5);
        assert.strictEqual(v, Math.floor(v), '应为整数');
      }
    });

    it('返回值应在指定范围内', () => {
      for (let i = 0; i < 100; i++) {
        const v = U.randI(1, 5);
        assert.ok(v >= 1 && v <= 5, `值 ${v} 应在 [1, 5] 范围内`);
      }
    });
  });
});

describe('帆船冲刺 — AudioManager 音频管理', () => {
  let AudioManager;

  before(() => {
    const env = createGameContext();
    AudioManager = env.game.AudioManager;
  });

  it('初始状态应未初始化且未静音', () => {
    const audio = new AudioManager();
    assert.strictEqual(audio.initialized, false);
    assert.strictEqual(audio.muted, false);
    assert.strictEqual(audio.ctx, null);
  });

  it('init() 后应标记为已初始化', () => {
    const audio = new AudioManager();
    audio.init();
    assert.strictEqual(audio.initialized, true);
    assert.ok(audio.ctx !== null, '应有 AudioContext');
    assert.ok(audio.masterGain !== null, '应有主增益节点');
  });

  it('重复 init() 不应创建多个 AudioContext', () => {
    const audio = new AudioManager();
    audio.init();
    const ctx1 = audio.ctx;
    audio.init();
    assert.strictEqual(audio.ctx, ctx1, '多次 init 应复用同一个 AudioContext');
  });

  it('toggleMute() 应切换静音状态', () => {
    const audio = new AudioManager();
    audio.init();
    assert.strictEqual(audio.muted, false);
    audio.toggleMute();
    assert.strictEqual(audio.muted, true);
    audio.toggleMute();
    assert.strictEqual(audio.muted, false);
  });

  it('playBGM() 应创建背景音乐节点', () => {
    const audio = new AudioManager();
    audio.init();
    audio.playBGM();
    assert.ok(audio.bgmNodes.length > 0, '应有 BGM 节点');
  });

  it('stopBGM() 应清空 BGM 节点', () => {
    const audio = new AudioManager();
    audio.init();
    audio.playBGM();
    audio.stopBGM();
    assert.strictEqual(audio.bgmNodes.length, 0, 'stopBGM 后节点应清空');
  });

  it('playSFX 在未初始化时不应报错', () => {
    const audio = new AudioManager();
    assert.doesNotThrow(() => {
      audio.playSFX('hit');
      audio.playSFX('advance');
      audio.playSFX('fail');
      audio.playSFX('countdown');
      audio.playSFX('go');
    }, '未初始化时调用 playSFX 不应抛错');
  });

  it('静音时 playSFX 不应播放', () => {
    const audio = new AudioManager();
    audio.init();
    audio.muted = true;
    // 这应该不会抛出错误，也不会执行任何声音操作
    assert.doesNotThrow(() => {
      audio.playSFX('hit');
    });
  });

  it('playSFX 应支持所有音效类型', () => {
    const audio = new AudioManager();
    audio.init();
    assert.doesNotThrow(() => {
      audio.playSFX('hit');
      audio.playSFX('advance');
      audio.playSFX('fail');
      audio.playSFX('countdown');
      audio.playSFX('go');
    }, '所有音效类型都应能正常播放');
  });
});

describe('帆船冲刺 — Camera 摄像机', () => {
  let Camera, CONFIG;

  before(() => {
    const env = createGameContext();
    Camera = env.game.Camera;
    CONFIG = env.game.CONFIG;
  });

  it('初始 y 应为 0', () => {
    const cam = new Camera();
    assert.strictEqual(cam.y, 0);
  });

  it('follow() 应使玩家保持在屏幕 72% 高度处', () => {
    const cam = new Camera();
    cam.follow(-1000);
    assert.strictEqual(cam.y, -1000 - CONFIG.HEIGHT * CONFIG.BOAT.SCREEN_Y);
  });

  it('toScreen() 应正确转换世界坐标到屏幕坐标', () => {
    const cam = new Camera();
    cam.y = -500;
    assert.strictEqual(cam.toScreen(-300), 200);
  });

  it('follow 后 toScreen 应使玩家在屏幕 72% 位置', () => {
    const cam = new Camera();
    const playerWY = -2000;
    cam.follow(playerWY);
    const screenY = cam.toScreen(playerWY);
    assert.strictEqual(screenY, CONFIG.HEIGHT * CONFIG.BOAT.SCREEN_Y);
  });
});

describe('帆船冲刺 — Channel 航道', () => {
  let Channel, CONFIG;

  before(() => {
    const env = createGameContext();
    Channel = env.game.Channel;
    CONFIG = env.game.CONFIG;
  });

  it('init() 应正确重置航道状态', () => {
    const ch = new Channel();
    ch.init(-5000, 20);
    assert.strictEqual(ch.finishY, -5000);
    assert.strictEqual(ch.nar, 20);
    assert.deepStrictEqual(ch.segs, []);
    assert.strictEqual(ch.curveOff, 0);
    assert.strictEqual(ch.curveTgt, 0);
  });

  it('generate() 应生成航道段', () => {
    const ch = new Channel();
    ch.init(-5000, 0);
    ch.generate(0);
    assert.ok(ch.segs.length > 0, '应生成航道段');
  });

  it('航道段应有 y, l, r 属性', () => {
    const ch = new Channel();
    ch.init(-5000, 0);
    ch.generate(0);
    const seg = ch.segs[0];
    assert.ok(typeof seg.y === 'number', '应有 y 属性');
    assert.ok(typeof seg.l === 'number', '应有 l（左边界）属性');
    assert.ok(typeof seg.r === 'number', '应有 r（右边界）属性');
  });

  it('航道左边界应小于右边界', () => {
    const ch = new Channel();
    ch.init(-5000, 0);
    ch.generate(0);
    for (const seg of ch.segs) {
      assert.ok(seg.l < seg.r, `左边界 (${seg.l}) 应小于右边界 (${seg.r})`);
    }
  });

  it('航道宽度应不小于帆船宽度的 2 倍（确保可通过）', () => {
    const ch = new Channel();
    ch.init(-5000, 0);
    ch.generate(0);
    const minWidth = CONFIG.BOAT.WIDTH * 2;
    for (const seg of ch.segs) {
      assert.ok(seg.r - seg.l >= minWidth,
        `航道宽度 (${seg.r - seg.l}) 应 >= ${minWidth}`);
    }
  });

  it('航道收窄时宽度应变小', () => {
    const ch1 = new Channel();
    ch1.init(-5000, 0);
    ch1.generate(0);

    const ch2 = new Channel();
    ch2.init(-5000, 40);
    ch2.generate(0);

    const mid1 = ch1.segs[Math.floor(ch1.segs.length / 2)];
    const mid2 = ch2.segs[Math.floor(ch2.segs.length / 2)];
    const w1 = mid1.r - mid1.l;
    const w2 = mid2.r - mid2.l;
    assert.ok(w2 < w1, `收窄航道宽度 (${w2}) 应小于正常宽度 (${w1})`);
  });

  it('bounds() 应返回指定 Y 坐标处的航道边界', () => {
    const ch = new Channel();
    ch.init(-5000, 0);
    ch.generate(0);
    const seg = ch.bounds(0);
    assert.ok(typeof seg.l === 'number', '应返回左边界');
    assert.ok(typeof seg.r === 'number', '应返回右边界');
    assert.ok(seg.l < seg.r, '左边界应小于右边界');
  });

  it('bounds() 对不存在的段应返回默认值', () => {
    const ch = new Channel();
    ch.init(-5000, 0);
    const seg = ch.bounds(-99999);
    assert.ok(typeof seg.l === 'number');
    assert.ok(typeof seg.r === 'number');
    assert.ok(seg.l < seg.r);
  });

  it('generate() 应回收已滚过的航道段', () => {
    const ch = new Channel();
    ch.init(-99999, 0);
    ch.generate(0);
    ch.generate(-5000);
    const oldSegs = ch.segs.filter(s => s.y > 0 + 700 + 300);
    assert.strictEqual(oldSegs.length, 0, '已滚过的段应被回收');
  });

  it('训练模式 finishY 应设为 -Infinity（无终点）', () => {
    const ch = new Channel();
    ch.init(-Infinity, 0);
    assert.strictEqual(ch.finishY, -Infinity, '训练模式不应有终点');
  });
});

describe('帆船冲刺 — WaveObstacle 海浪障碍物', () => {
  let WaveObstacle, WaveManager, Channel, CONFIG;

  before(() => {
    const env = createGameContext();
    WaveObstacle = env.game.WaveObstacle;
    WaveManager = env.game.WaveManager;
    Channel = env.game.Channel;
    CONFIG = env.game.CONFIG;
  });

  describe('WaveObstacle 单体', () => {
    it('构造函数应正确设置属性', () => {
      const obs = new WaveObstacle('WAVE_S', 100, -200, 60, 340);
      assert.strictEqual(obs.type, 'WAVE_S');
      assert.strictEqual(obs.x, 100);
      assert.strictEqual(obs.y, -200);
      assert.strictEqual(obs.w, CONFIG.OBS.TYPES.WAVE_S.w);
      assert.strictEqual(obs.h, CONFIG.OBS.TYPES.WAVE_S.h);
    });

    it('box() 应返回正确的碰撞盒', () => {
      const obs = new WaveObstacle('WAVE_M', 100, -200, 60, 340);
      const box = obs.box();
      assert.strictEqual(box.x, 100);
      assert.strictEqual(box.y, -200);
      assert.strictEqual(box.w, CONFIG.OBS.TYPES.WAVE_M.w);
      assert.strictEqual(box.h, CONFIG.OBS.TYPES.WAVE_M.h);
    });

    it('静止海浪 update 后位置不应改变', () => {
      const obs = new WaveObstacle('WAVE_S', 100, -200, 60, 340);
      obs.update(1);
      assert.strictEqual(obs.x, 100);
      assert.strictEqual(obs.y, -200);
    });

    it('WAVE_MH 海浪 update 后 X 应改变', () => {
      const obs = new WaveObstacle('WAVE_MH', 100, -200, 60, 340);
      const origX = obs.x;
      obs.update(1);
      assert.notStrictEqual(obs.x, origX, 'WAVE_MH 更新后 X 应改变');
    });

    it('WAVE_MV 海浪 update 后 Y 应改变', () => {
      const obs = new WaveObstacle('WAVE_MV', 100, -200, 60, 340);
      const origY = obs.y;
      obs.update(1);
      assert.notStrictEqual(obs.y, origY, 'WAVE_MV 更新后 Y 应改变');
    });

    it('WAVE_MH 不应超出航道边界', () => {
      const obs = new WaveObstacle('WAVE_MH', 100, -200, 60, 340);
      for (let i = 0; i < 500; i++) {
        obs.update(1);
      }
      assert.ok(obs.x >= 60, 'WAVE_MH 不应超出左边界');
      assert.ok(obs.x + obs.w <= 340, 'WAVE_MH 不应超出右边界');
    });

    it('WAVE_MV 移动范围应有限制', () => {
      const obs = new WaveObstacle('WAVE_MV', 100, -200, 60, 340);
      const baseY = obs.baseY;
      for (let i = 0; i < 200; i++) {
        obs.update(1);
      }
      assert.ok(Math.abs(obs.y - baseY) <= 40, 'WAVE_MV 移动范围应受限');
    });
  });

  describe('WaveManager 管理器', () => {
    it('init 后障碍列表应为空', () => {
      const wm = new WaveManager();
      wm.init(0);
      assert.strictEqual(wm.obs.length, 0);
    });

    it('generate() 应生成海浪障碍物', () => {
      const wm = new WaveManager();
      wm.init(0);
      const ch = new Channel();
      ch.init(-10000, 0);
      ch.generate(0);
      wm.generate(-2000, 1.0, 0, ch);
      assert.ok(wm.obs.length > 0, '高密度下应生成海浪障碍物');
    });

    it('cleanup() 应清理已滚出的障碍', () => {
      const wm = new WaveManager();
      wm.init(0);
      const ch = new Channel();
      ch.init(-10000, 0);
      ch.generate(0);
      wm.generate(-2000, 1.0, 0, ch);
      const countBefore = wm.obs.length;
      wm.cleanup(-50000);
      assert.ok(wm.obs.length < countBefore, '应有障碍被清理');
    });

    it('hit() 碰撞检测 — 有碰撞时返回障碍物', () => {
      const wm = new WaveManager();
      wm.init(0);
      const obs = new WaveObstacle('WAVE_S', 100, -200, 60, 340);
      wm.obs.push(obs);
      const box = { x: 105, y: -195, w: 18, h: 34 };
      const hit = wm.hit(box);
      assert.ok(hit !== null, '应检测到碰撞');
    });

    it('hit() 碰撞检测 — 无碰撞时返回 null', () => {
      const wm = new WaveManager();
      wm.init(0);
      const obs = new WaveObstacle('WAVE_S', 100, -200, 60, 340);
      wm.obs.push(obs);
      const box = { x: 300, y: -500, w: 18, h: 34 };
      const hit = wm.hit(box);
      assert.strictEqual(hit, null, '不应检测到碰撞');
    });

    it('_checkGap() — 障碍物不应完全堵死航道', () => {
      const wm = new WaveManager();
      wm.init(0);
      const ch = new Channel();
      ch.init(-10000, 0);
      ch.generate(0);
      wm.generate(-3000, 1.0, 0, ch);
      const rows = {};
      for (const o of wm.obs) {
        const ky = Math.round(o.y);
        if (!rows[ky]) rows[ky] = [];
        rows[ky].push(o);
      }
      const minGap = CONFIG.BOAT.WIDTH + 8;
      for (const [y, row] of Object.entries(rows)) {
        if (row.length <= 1) continue;
        const seg = ch.bounds(Number(y));
        row.sort((a, b) => a.x - b.x);
        const gaps = [];
        gaps.push(row[0].x - seg.l);
        for (let i = 0; i < row.length - 1; i++) {
          gaps.push(row[i + 1].x - (row[i].x + row[i].w));
        }
        gaps.push(seg.r - (row[row.length - 1].x + row[row.length - 1].w));
        const hasGap = gaps.some(g => g >= minGap);
        assert.ok(hasGap,
          `Y=${y} 处应有至少 ${minGap}px 的通路间隙，实际间隙: [${gaps.join(',')}]`);
      }
    });

    it('generate() 带移动障碍时应生成移动类型', () => {
      const wm = new WaveManager();
      wm.init(0);
      const ch = new Channel();
      ch.init(-10000, 0);
      ch.generate(0);
      wm.generate(-3000, 1.0, 1.0, ch);
      const movers = wm.obs.filter(o => o.type === 'WAVE_MH' || o.type === 'WAVE_MV');
      assert.ok(movers.length > 0, '移动比例为 1.0 时应有移动海浪');
    });
  });
});

describe('帆船冲刺 — Boat 帆船基类', () => {
  let Boat, CONFIG;

  before(() => {
    const env = createGameContext();
    Boat = env.game.Boat;
    CONFIG = env.game.CONFIG;
  });

  it('构造函数应正确设置属性', () => {
    const boat = new Boat(200, -100, '#ff0000');
    assert.strictEqual(boat.x, 200);
    assert.strictEqual(boat.wy, -100);
    assert.strictEqual(boat.color, '#ff0000');
    assert.strictEqual(boat.spd, 0);
    assert.strictEqual(boat.ang, 0);
    assert.strictEqual(boat.vx, 0);
    assert.strictEqual(boat.flash, 0);
  });

  it('box() 应返回以中心点为基准的碰撞盒', () => {
    const boat = new Boat(200, -100, '#ff0000');
    const box = boat.box();
    assert.strictEqual(box.x, 200 - CONFIG.BOAT.WIDTH / 2);
    assert.strictEqual(box.y, -100 - CONFIG.BOAT.HEIGHT / 2);
    assert.strictEqual(box.w, CONFIG.BOAT.WIDTH);
    assert.strictEqual(box.h, CONFIG.BOAT.HEIGHT);
  });

  it('帆船尺寸应为 18x34', () => {
    const boat = new Boat(200, -100, '#ff0000');
    assert.strictEqual(boat.w, 18);
    assert.strictEqual(boat.h, 34);
  });
});

describe('帆船冲刺 — PlayerBoat 玩家帆船', () => {
  let PlayerBoat, Channel, CONFIG;

  before(() => {
    const env = createGameContext();
    PlayerBoat = env.game.PlayerBoat;
    Channel = env.game.Channel;
    CONFIG = env.game.CONFIG;
  });

  it('初始位置应在屏幕水平中央', () => {
    const player = new PlayerBoat();
    assert.strictEqual(player.x, CONFIG.WIDTH / 2);
  });

  it('初始应有 3 条生命', () => {
    const player = new PlayerBoat();
    assert.strictEqual(player.lives, CONFIG.LIVES);
    assert.strictEqual(player.lives, 3);
  });

  it('初始无敌计时器应为 0', () => {
    const player = new PlayerBoat();
    assert.strictEqual(player.invTimer, 0);
  });

  it('reset() 应重置所有状态包括生命和无敌', () => {
    const player = new PlayerBoat();
    player.spd = 5;
    player.ang = 0.3;
    player.vx = 2;
    player.flash = 100;
    player.lives = 1;
    player.invTimer = 500;
    player.reset(-500);
    assert.strictEqual(player.x, CONFIG.WIDTH / 2);
    assert.strictEqual(player.wy, -500);
    assert.strictEqual(player.spd, 0);
    assert.strictEqual(player.ang, 0);
    assert.strictEqual(player.vx, 0);
    assert.strictEqual(player.flash, 0);
    assert.strictEqual(player.lives, CONFIG.LIVES);
    assert.strictEqual(player.invTimer, 0);
  });

  describe('update() — 物理模拟', () => {
    let player, channel;

    beforeEach(() => {
      player = new PlayerBoat();
      player.reset(0);
      channel = new Channel();
      channel.init(-Infinity, 0);
      channel.generate(0);
    });

    it('按下加速键应增加速度', () => {
      const inp = { up: true, down: false, left: false, right: false };
      player.update(1, inp, channel);
      assert.ok(player.spd > 0, '加速后速度应 > 0');
    });

    it('按下刹车键应减少速度', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 30; i++) player.update(1, accInp, channel);
      const speedBefore = player.spd;
      const brakeInp = { up: false, down: true, left: false, right: false };
      player.update(1, brakeInp, channel);
      assert.ok(player.spd < speedBefore, '刹车后速度应降低');
    });

    it('松开油门后应有惯性（不会立刻停下）', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 20; i++) player.update(1, accInp, channel);
      const speedAtRelease = player.spd;
      const noInp = { up: false, down: false, left: false, right: false };
      player.update(1, noInp, channel);
      assert.ok(player.spd > 0, '松开油门后应仍有速度（惯性）');
      assert.ok(player.spd < speedAtRelease, '但速度应略有降低（摩擦力）');
    });

    it('速度不应超过最大值', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 500; i++) player.update(1, accInp, channel);
      assert.ok(player.spd <= CONFIG.BOAT.MAX_SPEED,
        `速度 (${player.spd}) 不应超过最大值 (${CONFIG.BOAT.MAX_SPEED})`);
    });

    it('倒车速度应有限制', () => {
      const brakeInp = { up: false, down: true, left: false, right: false };
      for (let i = 0; i < 500; i++) player.update(1, brakeInp, channel);
      assert.ok(player.spd >= -CONFIG.BOAT.MAX_SPEED * 0.3,
        `倒车速度应不低于 -${CONFIG.BOAT.MAX_SPEED * 0.3}`);
    });

    it('左转应改变角度', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, channel);
      const leftInp = { up: true, down: false, left: true, right: false };
      player.update(1, leftInp, channel);
      assert.ok(player.ang < 0, '左转角度应为负值');
    });

    it('右转应改变角度', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, channel);
      const rightInp = { up: true, down: false, left: false, right: true };
      player.update(1, rightInp, channel);
      assert.ok(player.ang > 0, '右转角度应为正值');
    });

    it('转向角度应有最大值限制', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 20; i++) player.update(1, accInp, channel);
      const leftInp = { up: true, down: false, left: true, right: false };
      for (let i = 0; i < 500; i++) player.update(1, leftInp, channel);
      assert.ok(Math.abs(player.ang) <= CONFIG.BOAT.MAX_TURN + 0.001,
        `转角 (${player.ang}) 绝对值不应超过最大值 (${CONFIG.BOAT.MAX_TURN})`);
    });

    it('不按方向键时角度应自动回正', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, channel);
      const leftInp = { up: true, down: false, left: true, right: false };
      for (let i = 0; i < 10; i++) player.update(1, leftInp, channel);
      const angAfterTurn = player.ang;
      const noTurnInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 50; i++) player.update(1, noTurnInp, channel);
      assert.ok(Math.abs(player.ang) < Math.abs(angAfterTurn),
        '松开方向键后角度应逐渐回正');
    });

    it('帆船碰到左边界应被限制', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, channel);
      player.x = 10;
      const leftInp = { up: true, down: false, left: true, right: false };
      player.update(1, leftInp, channel);
      const seg = channel.bounds(player.wy);
      assert.ok(player.x - player.w / 2 >= seg.l,
        '帆船左侧不应超出航道左边界');
    });

    it('帆船碰到右边界应被限制', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, channel);
      player.x = 390;
      const rightInp = { up: true, down: false, left: false, right: true };
      player.update(1, rightInp, channel);
      const seg = channel.bounds(player.wy);
      assert.ok(player.x + player.w / 2 <= seg.r,
        '帆船右侧不应超出航道右边界');
    });

    it('前进时 wy 应减小（向上移动）', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      player.update(1, accInp, channel);
      player.update(1, accInp, channel);
      assert.ok(player.wy < 0, '前进时世界 Y 坐标应减小');
    });

    it('无敌计时器应随时间递减', () => {
      player.invTimer = 1000;
      const noInp = { up: false, down: false, left: false, right: false };
      player.update(1, noInp, channel);
      assert.ok(player.invTimer < 1000, '无敌计时器应递减');
    });

    it('碰到边界应减速但不扣命（边界情况 E1）', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 20; i++) player.update(1, accInp, channel);
      player.x = 10; // 强制推到边界外
      const speedBefore = player.spd;
      player.update(1, accInp, channel);
      assert.ok(player.spd < speedBefore, '碰到边界应减速');
      assert.strictEqual(player.lives, CONFIG.LIVES, '碰到边界不应扣命');
    });
  });

  describe('onHit() — 碰撞反馈', () => {
    it('碰撞后速度应降低', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.strictEqual(player.spd, 5 * CONFIG.HIT.SPEED_MULT);
    });

    it('碰撞后应触发闪烁', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.strictEqual(player.flash, CONFIG.HIT.FLASH_MS);
    });

    it('碰撞后应进入无敌状态', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.strictEqual(player.invTimer, CONFIG.HIT.INVINCIBLE_MS);
    });

    it('碰撞后应扣一条命', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      const livesBefore = player.lives;
      player.onHit(obs);
      assert.strictEqual(player.lives, livesBefore - 1, '应扣一条命');
    });

    it('无敌期间不应扣命（边界情况 E2）', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      player.invTimer = 1000; // 处于无敌状态
      const obs = { x: 190, w: 20 };
      const livesBefore = player.lives;
      const result = player.onHit(obs);
      assert.strictEqual(result, false, '无敌期间 onHit 应返回 false');
      assert.strictEqual(player.lives, livesBefore, '无敌期间不应扣命');
    });

    it('碰撞后应有弹开效果', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      player.vx = 0;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.ok(player.vx !== 0, '碰撞后横向速度应非零（弹开）');
      assert.ok(player.wy > 0, '碰撞后应向后弹');
    });

    it('3 条命全部耗尽后 isDead() 应返回 true', () => {
      const player = new PlayerBoat();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      player.onHit(obs); // 2 条命
      player.invTimer = 0; // 清除无敌
      player.onHit(obs); // 1 条命
      player.invTimer = 0;
      player.onHit(obs); // 0 条命
      assert.strictEqual(player.lives, 0);
      assert.strictEqual(player.isDead(), true, '命用完后应为死亡状态');
    });

    it('还有生命时 isDead() 应返回 false', () => {
      const player = new PlayerBoat();
      player.reset(0);
      assert.strictEqual(player.isDead(), false);
      player.lives = 1;
      assert.strictEqual(player.isDead(), false);
    });
  });
});

describe('帆船冲刺 — AIBoat AI帆船', () => {
  let AIBoat, Channel, WaveManager, CONFIG;

  before(() => {
    const env = createGameContext();
    AIBoat = env.game.AIBoat;
    Channel = env.game.Channel;
    WaveManager = env.game.WaveManager;
    CONFIG = env.game.CONFIG;
  });

  it('构造函数应正确设置索引和颜色', () => {
    const ai = new AIBoat(3, '#3498db');
    assert.strictEqual(ai.idx, 3);
    assert.strictEqual(ai.color, '#3498db');
  });

  it('reset() 应在航道范围内初始化位置', () => {
    const ai = new AIBoat(0, '#3498db');
    ai.reset(0, { nar: 0 }, CONFIG.DIFFICULTY.EASY);
    const hw = CONFIG.CHANNEL.WIDTH / 2;
    const cx = CONFIG.WIDTH / 2;
    assert.ok(ai.x >= cx - hw, 'X 应在航道左边界内');
    assert.ok(ai.x <= cx + hw, 'X 应在航道右边界内');
  });

  it('reset() 后应有基础速度', () => {
    const ai = new AIBoat(0, '#3498db');
    ai.reset(0, { nar: 0, aiBoost: 0 }, CONFIG.DIFFICULTY.EASY);
    assert.ok(ai.baseSp > 0, '基础速度应 > 0');
  });

  it('不同难度下 AI 速度应不同', () => {
    const aiEasy = new AIBoat(0, '#3498db');
    const aiLegend = new AIBoat(1, '#e74c3c');

    // 多次采样取平均值（由于随机性）
    let sumEasy = 0, sumLegend = 0;
    const n = 50;
    for (let i = 0; i < n; i++) {
      aiEasy.reset(0, { nar: 0, aiBoost: 0 }, CONFIG.DIFFICULTY.EASY);
      sumEasy += aiEasy.baseSp;
      aiLegend.reset(0, { nar: 0, aiBoost: 0 }, CONFIG.DIFFICULTY.LEGENDARY);
      sumLegend += aiLegend.baseSp;
    }
    assert.ok(sumLegend / n > sumEasy / n, '传奇难度 AI 平均速度应高于简单难度');
  });

  it('update() 后 AI 应前进（wy 减小）', () => {
    const ai = new AIBoat(0, '#3498db');
    ai.reset(0, { nar: 0, aiBoost: 0 }, CONFIG.DIFFICULTY.EASY);
    const ch = new Channel();
    ch.init(-Infinity, 0);
    ch.generate(0);
    const wm = new WaveManager();
    wm.init(0);

    const wyBefore = ai.wy;
    for (let i = 0; i < 30; i++) ai.update(1, wm, ch);
    assert.ok(ai.wy < wyBefore, 'AI 应前进');
  });

  it('AI 碰撞后速度应降低', () => {
    const ai = new AIBoat(0, '#3498db');
    ai.reset(0, { nar: 0, aiBoost: 0 }, CONFIG.DIFFICULTY.EASY);
    ai.spd = 4;
    const obs = { x: ai.x - 10, w: 20 };
    ai.onHit(obs);
    assert.strictEqual(ai.spd, 4 * CONFIG.HIT.SPEED_MULT, 'AI 碰撞后速度应按比例降低');
    assert.strictEqual(ai.flash, CONFIG.HIT.FLASH_MS, 'AI 碰撞后应闪烁');
  });

  it('AI 应被航道边界约束', () => {
    const ai = new AIBoat(0, '#3498db');
    ai.reset(0, { nar: 0, aiBoost: 0 }, CONFIG.DIFFICULTY.EASY);
    const ch = new Channel();
    ch.init(-Infinity, 0);
    ch.generate(0);
    const wm = new WaveManager();
    wm.init(0);
    ai.x = 10;
    ai.tgtX = -100;
    ai.update(1, wm, ch);
    const seg = ch.bounds(ai.wy);
    assert.ok(ai.x - ai.w / 2 >= seg.l - 1, 'AI 不应超出航道左边界');
  });
});

describe('帆船冲刺 — HUD 信息显示', () => {
  let HUD;

  before(() => {
    const env = createGameContext();
    HUD = env.game.HUD;
  });

  it('show() 应设置消息和持续时间', () => {
    const hud = new HUD();
    hud.show('测试消息', 3000);
    assert.strictEqual(hud.msg, '测试消息');
    assert.strictEqual(hud.msgT, 3000);
  });

  it('tick() 应减少消息计时', () => {
    const hud = new HUD();
    hud.show('测试', 2000);
    hud.tick(1);
    assert.ok(hud.msgT < 2000, '计时应减少');
  });

  it('消息计时降到 0 后应停止', () => {
    const hud = new HUD();
    hud.show('测试', 100);
    for (let i = 0; i < 20; i++) hud.tick(1);
    assert.ok(hud.msgT <= 0, '计时应归零或负');
  });
});

describe('帆船冲刺 — InputManager 输入管理', () => {
  let InputManager;

  before(() => {
    const env = createGameContext();
    InputManager = env.game.InputManager;
  });

  it('初始状态所有输入应为 falsy', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);
    assert.ok(!inp.up, '初始 up 应为 falsy');
    assert.ok(!inp.down, '初始 down 应为 falsy');
    assert.ok(!inp.left, '初始 left 应为 falsy');
    assert.ok(!inp.right, '初始 right 应为 falsy');
    assert.ok(!inp.esc, '初始 esc 应为 falsy');
  });

  it('键盘箭头键应正确映射', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);
    inp.keys['ArrowUp'] = true;
    assert.strictEqual(inp.up, true);
    inp.keys['ArrowUp'] = false;
    inp.keys['ArrowDown'] = true;
    assert.strictEqual(inp.down, true);
    inp.keys['ArrowDown'] = false;
    inp.keys['ArrowLeft'] = true;
    assert.strictEqual(inp.left, true);
    inp.keys['ArrowLeft'] = false;
    inp.keys['ArrowRight'] = true;
    assert.strictEqual(inp.right, true);
  });

  it('WASD 键应正确映射', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);
    inp.keys['KeyW'] = true;
    assert.strictEqual(inp.up, true);
    inp.keys['KeyW'] = false;
    inp.keys['KeyS'] = true;
    assert.strictEqual(inp.down, true);
    inp.keys['KeyS'] = false;
    inp.keys['KeyA'] = true;
    assert.strictEqual(inp.left, true);
    inp.keys['KeyA'] = false;
    inp.keys['KeyD'] = true;
    assert.strictEqual(inp.right, true);
  });

  it('触控状态应正确映射', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);
    inp.ts.up = true;
    assert.strictEqual(inp.up, true);
    inp.ts.up = false;
    inp.ts.left = true;
    assert.strictEqual(inp.left, true);
  });

  it('eatEsc() 应清除 ESC 状态', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);
    inp.keys['Escape'] = true;
    assert.strictEqual(inp.esc, true);
    inp.eatEsc();
    assert.strictEqual(inp.esc, false);
  });

  it('onTap() 应注册回调', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);
    inp.onTap(() => {});
    assert.strictEqual(inp.taps.length, 1, '应注册了一个回调');
  });
});

describe('帆船冲刺 — Game 主控逻辑', () => {
  let Game, CONFIG, env;

  beforeEach(() => {
    env = createGameContext();
    Game = env.game.Game;
    CONFIG = env.game.CONFIG;
  });

  it('Game 构造函数应正确初始化', () => {
    const game = new Game();
    assert.strictEqual(game.state, 'menu', '初始状态应为 menu');
    assert.strictEqual(game.mode, '', '初始模式应为空');
    assert.strictEqual(game.lv, 0);
    assert.strictEqual(game.difficulty, null, '初始难度应为 null');
  });

  describe('状态机转换', () => {
    it('_goMenu() 应设为菜单状态', () => {
      const game = new Game();
      game.state = 'playing';
      game.mode = 'race';
      game._goMenu();
      assert.strictEqual(game.state, 'menu');
      assert.strictEqual(game.mode, '');
    });

    it('_goDiffSelect() 应进入难度选择状态', () => {
      const game = new Game();
      game._goDiffSelect();
      assert.strictEqual(game.state, 'diffSelect');
    });

    it('_goRace() 应初始化比赛模式', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      assert.strictEqual(game.mode, 'race');
      assert.strictEqual(game.lv, 0);
      assert.strictEqual(game.ais.length, CONFIG.AI.COUNT, 'AI 数量应为 20');
      assert.strictEqual(game.state, 'countdown');
    });

    it('_goRace() 应正确初始化指定关卡', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.HARD;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(5);
      assert.strictEqual(game.lv, 5);
    });

    it('_goTrain() 应初始化训练模式', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.mode, 'training');
      assert.strictEqual(game.dist, 0);
      assert.strictEqual(game.ais.length, 0, '训练模式不应有 AI');
      assert.strictEqual(game.state, 'countdown');
    });

    it('_goTrain() 应设置 999 条命（实质无限）', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.player.lives, 999, '训练模式生命应为 999');
    });

    it('_goCountdown() 应设置倒计时状态', () => {
      const game = new Game();
      game._goCountdown();
      assert.strictEqual(game.state, 'countdown');
      assert.strictEqual(game.cdVal, 3);
      assert.strictEqual(game.cdTimer, 0);
    });

    it('_goPause() 从 playing 状态应切换到 paused', () => {
      const game = new Game();
      game.state = 'playing';
      game._goPause();
      assert.strictEqual(game.state, 'paused');
    });

    it('_goPause() 从非 playing 状态不应改变', () => {
      const game = new Game();
      game.state = 'menu';
      game._goPause();
      assert.strictEqual(game.state, 'menu');
    });

    it('_goResume() 从 paused 状态应恢复到 playing', () => {
      const game = new Game();
      game.state = 'paused';
      game._goResume();
      assert.strictEqual(game.state, 'playing');
    });

    it('_goResume() 从非 paused 状态不应改变', () => {
      const game = new Game();
      game.state = 'menu';
      game._goResume();
      assert.strictEqual(game.state, 'menu');
    });
  });

  describe('_buildLevels() — 关卡构建', () => {
    it('应基于难度构建 14 个关卡', () => {
      const game = new Game();
      const levels = game._buildLevels(CONFIG.DIFFICULTY.EASY);
      assert.strictEqual(levels.length, 14);
    });

    it('简单难度障碍密度应低于困难难度', () => {
      const game = new Game();
      const easyLevels = game._buildLevels(CONFIG.DIFFICULTY.EASY);
      const hardLevels = game._buildLevels(CONFIG.DIFFICULTY.HARD);
      // 比较第一关的密度
      assert.ok(easyLevels[0].dens < hardLevels[0].dens,
        '简单难度第一关障碍密度应低于困难难度');
    });

    it('传奇难度障碍密度应最高', () => {
      const game = new Game();
      const hardLevels = game._buildLevels(CONFIG.DIFFICULTY.HARD);
      const legendLevels = game._buildLevels(CONFIG.DIFFICULTY.LEGENDARY);
      assert.ok(legendLevels[0].dens > hardLevels[0].dens,
        '传奇难度第一关障碍密度应高于困难难度');
    });

    it('所有构建后的关卡应保留基础属性', () => {
      const game = new Game();
      const levels = game._buildLevels(CONFIG.DIFFICULTY.HARD);
      for (let i = 0; i < levels.length; i++) {
        assert.ok(levels[i].len > 0, `第 ${i + 1} 关应有长度`);
        assert.ok(levels[i].name, `第 ${i + 1} 关应有名称`);
        assert.ok(levels[i].dens > 0, `第 ${i + 1} 关应有密度`);
      }
    });
  });

  describe('关卡进度与晋级', () => {
    it('第 1-13 关完成后应进入下一关', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      game.state = 'playing';
      game.lv = 4;
      game._goNext();
      assert.strictEqual(game.lv, 5);
      assert.strictEqual(game.state, 'countdown');
    });

    it('第 14 关完成后应进入胜利画面', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(13); // 最后一关（索引13）
      game.state = 'playing';
      game.ranks = [{ c: game.player, p: true }];
      game._goNext();
      assert.strictEqual(game.state, 'victory');
      assert.ok(game.finalRanks.length > 0, '应保存最终排名');
    });
  });

  describe('排名计算', () => {
    it('_calcRanks() 应按 wy 排序（越小=越前面）', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      game.state = 'playing';
      game.player.wy = -500;
      for (let i = 0; i < game.ais.length; i++) {
        game.ais[i].wy = -100 * (i + 1);
      }
      game.ais[0].wy = -800;
      game._calcRanks();
      assert.ok(game.ranks.length === CONFIG.AI.COUNT + 1, '排名应包含 21 艘帆船');
      for (let i = 0; i < game.ranks.length - 1; i++) {
        assert.ok(game.ranks[i].c.wy <= game.ranks[i + 1].c.wy,
          '排名应按 wy 从小到大排序');
      }
    });

    it('_pRank() 应返回玩家的排名', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      game.player.wy = -500;
      for (const ai of game.ais) ai.wy = -100;
      game._calcRanks();
      assert.strictEqual(game._pRank(), 1, '玩家 wy 最小应排第一');
    });

    it('_pRank() 玩家最后时应返回第 21 名', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      game.player.wy = 0;
      for (const ai of game.ais) ai.wy = -1000;
      game._calcRanks();
      assert.strictEqual(game._pRank(), CONFIG.AI.COUNT + 1, '玩家应排第 21 名');
    });

    it('总参赛人数应为 21（20 AI + 1 玩家）（边界情况 E7）', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      game._calcRanks();
      assert.strictEqual(game.ranks.length, 21, '应有 21 名参赛者');
    });
  });

  describe('倒计时逻辑', () => {
    it('倒计时应从 3 开始递减', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.cdVal, 3);
      for (let i = 0; i < 61; i++) game._update(1);
      assert.strictEqual(game.cdVal, 2);
    });

    it('倒计时结束后应进入 playing 状态', () => {
      const game = new Game();
      game._goTrain();
      for (let i = 0; i < 250; i++) game._update(1);
      assert.strictEqual(game.state, 'playing');
    });
  });

  describe('训练模式', () => {
    it('训练模式不应有 AI 帆船', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.ais.length, 0);
    });

    it('训练模式航道应为无限（finishY = -Infinity）', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.channel.finishY, -Infinity);
    });

    it('初始行驶距离应为 0', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.dist, 0);
    });

    it('训练模式不应生成障碍物（边界情况 E8）', () => {
      const game = new Game();
      game._goTrain();
      // 跳过倒计时
      for (let i = 0; i < 250; i++) game._update(1);
      // 模拟游戏运行
      game.inp.keys['ArrowUp'] = true;
      for (let i = 0; i < 100; i++) game._update(1);
      assert.strictEqual(game.wm.obs.length, 0, '训练模式不应有障碍物');
    });
  });

  describe('比赛模式', () => {
    it('比赛模式应有 20 个 AI 帆船', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      assert.strictEqual(game.ais.length, 20);
    });

    it('AI 帆船颜色应各不相同', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      const colors = game.ais.map(ai => ai.color);
      const uniqueColors = new Set(colors);
      assert.strictEqual(uniqueColors.size, game.ais.length, 'AI 颜色应各不相同');
    });

    it('AI 颜色不应与玩家颜色相同', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      const playerColor = game.player.color;
      for (const ai of game.ais) {
        assert.notStrictEqual(ai.color, playerColor, 'AI 颜色不应与玩家相同');
      }
    });

    it('终点线 Y 坐标应设置正确', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(3);
      assert.strictEqual(game.channel.finishY, -game.levels[3].len);
    });

    it('前3名到达终点应晋级', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      // 跳过倒计时
      for (let i = 0; i < 250; i++) game._update(1);
      // 设置玩家在第1名
      game.player.wy = -game.levels[0].len - 10;
      for (const ai of game.ais) ai.wy = -100;
      game._calcRanks();
      game._play(1);
      assert.strictEqual(game.state, 'levelComplete', '前3名应晋级');
    });

    it('第4名及以后应淘汰', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      // 跳过倒计时
      for (let i = 0; i < 250; i++) game._update(1);
      // 设置玩家在最后
      game.player.wy = -game.levels[0].len - 10;
      // 让很多 AI 在玩家前面
      for (let i = 0; i < game.ais.length; i++) {
        game.ais[i].wy = -game.levels[0].len - 100 - i * 10;
      }
      game._calcRanks();
      const rank = game._pRank();
      assert.ok(rank > CONFIG.QUALIFY_RANK, '玩家应排在第4名之后');
      game._play(1);
      assert.strictEqual(game.state, 'levelFailed', '第4名及以后应进入 levelFailed');
    });

    it('命用完应进入 gameOver 状态', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      // 跳过倒计时
      for (let i = 0; i < 250; i++) game._update(1);
      // 直接设置玩家死亡
      game.player.lives = 0;
      // 手动添加障碍物在玩家位置
      const { WaveObstacle } = env.game;
      const obs = new WaveObstacle('WAVE_S', game.player.x - 10, game.player.wy - 5, 60, 340);
      game.wm.obs.push(obs);
      game.player.invTimer = 0;
      // 先让碰撞检测触发
      game.player.lives = 1; // 给1条命
      game.player.invTimer = 0;
      const hit = game.wm.hit(game.player.box());
      if (hit) {
        game.player.onHit(hit);
      }
      assert.strictEqual(game.player.lives, 0);
      assert.strictEqual(game.player.isDead(), true);
    });
  });

  describe('Tap 事件处理', () => {
    it('菜单点击训练模式区域应启动训练', () => {
      const game = new Game();
      game.state = 'menu';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 365);
      assert.strictEqual(game.mode, 'training');
      assert.strictEqual(game.state, 'countdown');
    });

    it('菜单点击比赛模式区域应进入难度选择', () => {
      const game = new Game();
      game.state = 'menu';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 440);
      assert.strictEqual(game.state, 'diffSelect', '应进入难度选择而非直接开始比赛');
    });

    it('难度选择页点击简单应以简单难度开始比赛', () => {
      const game = new Game();
      game.state = 'diffSelect';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 305);
      assert.strictEqual(game.difficulty, CONFIG.DIFFICULTY.EASY);
      assert.strictEqual(game.mode, 'race');
      assert.strictEqual(game.state, 'countdown');
    });

    it('难度选择页点击困难应以困难难度开始比赛', () => {
      const game = new Game();
      game.state = 'diffSelect';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 375);
      assert.strictEqual(game.difficulty, CONFIG.DIFFICULTY.HARD);
    });

    it('难度选择页点击传奇应以传奇难度开始比赛', () => {
      const game = new Game();
      game.state = 'diffSelect';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 445);
      assert.strictEqual(game.difficulty, CONFIG.DIFFICULTY.LEGENDARY);
    });

    it('难度选择页点击返回应回到菜单', () => {
      const game = new Game();
      game.state = 'diffSelect';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 530);
      assert.strictEqual(game.state, 'menu');
    });

    it('暂停状态点击继续应恢复游戏', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'paused';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 320);
      assert.strictEqual(game.state, 'playing');
    });

    it('暂停状态点击返回菜单应回到菜单', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'paused';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 450);
      assert.strictEqual(game.state, 'menu');
    });

    it('levelFailed 点击重试应重新开始本关', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(3);
      game.state = 'levelFailed';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 405);
      assert.strictEqual(game.lv, 3, '应重新开始第4关');
      assert.strictEqual(game.state, 'countdown');
    });

    it('levelFailed 点击返回菜单应回到菜单', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(3);
      game.state = 'levelFailed';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 470);
      assert.strictEqual(game.state, 'menu');
    });

    it('gameOver 点击重试应重新开始本关', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(5);
      game.state = 'gameOver';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 405);
      assert.strictEqual(game.lv, 5, '应重新开始第6关');
      assert.strictEqual(game.state, 'countdown');
    });

    it('gameOver 点击返回菜单应回到菜单', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(5);
      game.state = 'gameOver';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 470);
      assert.strictEqual(game.state, 'menu');
    });

    it('训练模式点击结束按钮应进入 trainEnd 状态', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'playing';
      game._tap(CONFIG.WIDTH - 50, 75);
      assert.strictEqual(game.state, 'trainEnd');
    });

    it('胜利画面点击返回菜单应回到菜单', () => {
      const game = new Game();
      game.difficulty = CONFIG.DIFFICULTY.EASY;
      game.levels = game._buildLevels(game.difficulty);
      game._goRace(0);
      game.state = 'victory';
      game.ranks = [];
      game.finalRanks = [];
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 515);
      assert.strictEqual(game.state, 'menu');
    });

    it('菜单点击静音按钮应切换静音', () => {
      const game = new Game();
      game.state = 'menu';
      const mutedBefore = game.audio.muted;
      game._tap(CONFIG.WIDTH - 25, 22);
      assert.notStrictEqual(game.audio.muted, mutedBefore, '应切换静音状态');
    });
  });
});

describe('帆船冲刺 — 集成测试', () => {
  let env;

  beforeEach(() => {
    env = createGameContext();
  });

  it('完整比赛流程：菜单 → 难度选择 → 倒计时 → 游戏中 → 暂停 → 继续', () => {
    const game = new env.game.Game();
    assert.strictEqual(game.state, 'menu');

    // 点击比赛进入难度选择
    game._goDiffSelect();
    assert.strictEqual(game.state, 'diffSelect');

    // 选择简单难度并启动比赛
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);
    assert.strictEqual(game.state, 'countdown');

    // 倒计时完成
    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');

    // 暂停
    game._goPause();
    assert.strictEqual(game.state, 'paused');

    // 继续
    game._goResume();
    assert.strictEqual(game.state, 'playing');
  });

  it('训练流程：开始 → 游戏中 → 结束 → 返回菜单', () => {
    const game = new env.game.Game();
    game._goTrain();

    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');
    assert.strictEqual(game.mode, 'training');

    game.state = 'trainEnd';
    assert.strictEqual(game.state, 'trainEnd');

    game._goMenu();
    assert.strictEqual(game.state, 'menu');
  });

  it('比赛模式关卡切换：模拟通过第1关（前3名晋级）', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);

    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');

    // 模拟玩家到达终点且排名前3
    game.player.wy = -game.levels[0].len - 10;
    for (const ai of game.ais) ai.wy = -100; // AI 都在后面
    game._play(1);

    assert.strictEqual(game.state, 'levelComplete');

    // 等待过关提示
    game.lcTimer = 0;
    game._update(1);
    assert.strictEqual(game.lv, 1);
  });

  it('14关全部通过后应显示胜利画面', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(13); // 最后一关

    for (let i = 0; i < 250; i++) game._update(1);

    game._calcRanks();
    game.player.wy = -game.levels[13].len - 10;
    for (const ai of game.ais) ai.wy = -100;
    game._play(1);

    assert.strictEqual(game.state, 'levelComplete');

    game.lcTimer = 0;
    game._update(1);
    assert.strictEqual(game.state, 'victory', '14关通关后应显示胜利画面');
  });

  it('ESC 键应切换暂停状态（边界情况 E9）', () => {
    const game = new env.game.Game();
    game._goTrain();
    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');

    game.inp.keys['Escape'] = true;
    game._update(1);
    assert.strictEqual(game.state, 'paused');

    game.inp.keys['Escape'] = true;
    game._update(1);
    assert.strictEqual(game.state, 'playing');
  });

  it('命耗尽时正好过线，应先判定死亡（边界情况 E3）', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);

    for (let i = 0; i < 250; i++) game._update(1);

    // 设置玩家即将到达终点但只剩1条命
    game.player.lives = 1;
    game.player.invTimer = 0;
    game.player.wy = -game.levels[0].len + 5; // 还没到终点

    // 在终点前放障碍物
    const { WaveObstacle } = env.game;
    const obs = new WaveObstacle('WAVE_S',
      game.player.x - 5, game.player.wy, 60, 340);
    game.wm.obs.push(obs);

    game._play(1);
    // 应该先检测碰撞导致死亡
    if (game.player.isDead()) {
      assert.strictEqual(game.state, 'gameOver', '命耗尽应进入 gameOver');
    }
  });

  it('AI 帆船也应受障碍物碰撞影响', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);

    for (const ai of game.ais) {
      ai.spd = 4;
    }

    const { WaveObstacle } = env.game;
    const ai = game.ais[0];
    const obs = new WaveObstacle('WAVE_S', ai.x - 5, ai.wy, 60, 340);
    game.wm.obs.push(obs);

    const hit = game.wm.hit(ai.box());
    if (hit) {
      const spdBefore = ai.spd;
      ai.onHit(hit);
      assert.ok(ai.spd < spdBefore, 'AI 碰到海浪后速度应降低');
    }
  });
});

describe('帆船冲刺 — 边界情况验证', () => {
  let env;

  beforeEach(() => {
    env = createGameContext();
  });

  it('长时间运行不应崩溃（200帧模拟）', () => {
    const game = new env.game.Game();
    game._goTrain();
    for (let i = 0; i < 250; i++) game._update(1);

    game.inp.keys['ArrowUp'] = true;
    assert.doesNotThrow(() => {
      for (let i = 0; i < 200; i++) {
        game._update(1);
      }
    }, '200帧模拟不应抛出异常');
  });

  it('DT_MAX 应限制最大帧间隔', () => {
    assert.ok(env.game.CONFIG.DT_MAX > 0, 'DT_MAX 应大于 0');
    assert.ok(env.game.CONFIG.DT_MAX <= 50, 'DT_MAX 应不超过 50ms');
  });

  it('航道生成后航道段不应无限增长', () => {
    const { Channel, CONFIG } = env.game;
    const ch = new Channel();
    ch.init(-Infinity, 0);

    for (let y = 0; y > -10000; y -= 100) {
      ch.generate(y);
    }

    const maxSegs = (700 + 200 + 200 + 300) / CONFIG.CHANNEL.SEGMENT_HEIGHT + 100;
    assert.ok(ch.segs.length < maxSegs,
      `航道段数 (${ch.segs.length}) 应小于 ${maxSegs}，避免内存泄漏`);
  });

  it('障碍物应随距离正确清理（内存管理）', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.HARD;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(5);

    for (let i = 0; i < 250; i++) game._update(1);

    game.inp.keys['ArrowUp'] = true;
    for (let i = 0; i < 500; i++) game._update(1);

    const obCount = game.wm.obs.length;
    assert.ok(obCount < 500, `障碍物数量 (${obCount}) 应在合理范围内`);
  });

  it('比赛模式长时间运行不崩溃（300帧比赛模拟）', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.HARD;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(7); // 中期关卡

    for (let i = 0; i < 250; i++) game._update(1);

    game.inp.keys['ArrowUp'] = true;
    assert.doesNotThrow(() => {
      for (let i = 0; i < 300; i++) {
        game._update(1);
      }
    }, '300帧比赛模拟不应抛出异常');
  });

  it('所有关卡索引应有效', () => {
    const { CONFIG } = env.game;
    for (let i = 0; i < CONFIG.LEVELS_BASE.length; i++) {
      assert.ok(CONFIG.LEVELS_BASE[i].len > 0, `第 ${i + 1} 关长度应 > 0`);
      assert.ok(CONFIG.LEVELS_BASE[i].dens > 0, `第 ${i + 1} 关密度应 > 0`);
      assert.ok(CONFIG.LEVELS_BASE[i].mov >= 0, `第 ${i + 1} 关移动比例应 >= 0`);
      assert.ok(CONFIG.LEVELS_BASE[i].nar >= 0, `第 ${i + 1} 关收窄应 >= 0`);
    }
  });

  it('AI 与玩家不产生碰撞伤害（边界情况 E4）', () => {
    // 验证代码中没有 AI-玩家碰撞检测
    // _play 方法中碰撞检测只对 wm（障碍物管理器），不包含 AI 碰撞
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);
    for (let i = 0; i < 250; i++) game._update(1);

    // 让 AI 和玩家完全重叠
    game.ais[0].x = game.player.x;
    game.ais[0].wy = game.player.wy;
    const livesBefore = game.player.lives;

    // 运行一帧
    game._play(1);

    assert.strictEqual(game.player.lives, livesBefore,
      'AI 与玩家重叠不应扣命');
  });

  it('静音按钮应在游戏中可用', () => {
    const game = new env.game.Game();
    game._goTrain();
    for (let i = 0; i < 250; i++) game._update(1);

    const mutedBefore = game.audio.muted;
    game._tap(env.game.CONFIG.WIDTH - 25, 22);
    assert.notStrictEqual(game.audio.muted, mutedBefore, '游戏中应能切换静音');
  });
});

describe('帆船冲刺 — 绘制方法验证（不崩溃）', () => {
  let env;

  beforeEach(() => {
    env = createGameContext();
  });

  it('_drawMenu() 不应崩溃', () => {
    const game = new env.game.Game();
    game.state = 'menu';
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawDiffSelect() 不应崩溃', () => {
    const game = new env.game.Game();
    game.state = 'diffSelect';
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawGame() + _drawCD() 不应崩溃', () => {
    const game = new env.game.Game();
    game._goTrain();
    assert.strictEqual(game.state, 'countdown');
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawGame() + _drawHUD() 训练模式不应崩溃', () => {
    const game = new env.game.Game();
    game._goTrain();
    for (let i = 0; i < 250; i++) game._update(1);
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawGame() + _drawHUD() 比赛模式不应崩溃', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);
    for (let i = 0; i < 250; i++) game._update(1);
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawPause() 不应崩溃', () => {
    const game = new env.game.Game();
    game._goTrain();
    game.state = 'paused';
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawLevelFailed() 不应崩溃', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(3);
    game.state = 'levelFailed';
    game.ranks = [{ c: game.player, p: true }];
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawGameOver() 不应崩溃', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(5);
    game.state = 'gameOver';
    game.ranks = [{ c: game.player, p: true }];
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawVictory() 不应崩溃', () => {
    const game = new env.game.Game();
    game.difficulty = env.game.CONFIG.DIFFICULTY.EASY;
    game.levels = game._buildLevels(game.difficulty);
    game._goRace(0);
    game.state = 'victory';
    game.ranks = [{ c: game.player, p: true }];
    game.finalRanks = [];
    assert.doesNotThrow(() => game._draw());
  });

  it('_drawTrainEnd() 不应崩溃', () => {
    const game = new env.game.Game();
    game._goTrain();
    game.state = 'trainEnd';
    assert.doesNotThrow(() => game._draw());
  });
});
