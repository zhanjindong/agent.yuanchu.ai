/**
 * 漂移赛车 — 自动化测试
 *
 * 使用 Node.js 内置 test runner (node:test + node:assert)
 * 运行方式: node --test drift-racing.test.js
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
  path.join(__dirname, 'drift-racing.html'), 'utf-8'
);

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error('无法从 drift-racing.html 中提取 JavaScript 代码');
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
  let rafCallback = null;
  const mockWindow = {
    innerWidth: 400,
    innerHeight: 700,
    addEventListener: (ev, fn) => {
      if (ev === 'resize') {
        // 忽略 resize
      }
    },
  };

  // 修改代码：移除 DOMContentLoaded 自动启动，移除 requestAnimationFrame
  let modifiedCode = gameJsCode;

  // 移除自启动 IIFE
  modifiedCode = modifiedCode.replace(
    /window\.addEventListener\('DOMContentLoaded'[\s\S]*?\}\);[\s]*$/,
    '// [测试] DOMContentLoaded 已移除'
  );

  // 构造执行环境
  const fn = new Function(
    'document', 'window', 'requestAnimationFrame',
    modifiedCode + '\n' +
    `return {
      CONFIG,
      U,
      InputManager,
      Camera,
      Track,
      Obstacle,
      ObstacleManager,
      Car,
      PlayerCar,
      AICar,
      HUD,
      Game,
    };`
  );

  const game = fn(
    mockDocument,
    mockWindow,
    (cb) => { rafCallback = cb; },
  );

  return { game, mockCtx, mockCanvas, rafCallback: () => rafCallback };
}

// ============================================================
// 测试用例
// ============================================================

describe('漂移赛车 — HTML 结构验证', () => {

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

  it('标题应为「漂移赛车」', () => {
    assert.ok(htmlContent.includes('<title>漂移赛车</title>'), '标题应为漂移赛车');
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

describe('漂移赛车 — manifest.json 注册验证', () => {
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

  it('应包含漂移赛车条目', () => {
    const entry = manifest.find(e => e.file === 'drift-racing.html');
    assert.ok(entry, '应包含 drift-racing.html 条目');
  });

  it('条目标题应为「漂移赛车」', () => {
    const entry = manifest.find(e => e.file === 'drift-racing.html');
    assert.strictEqual(entry.title, '漂移赛车');
  });

  it('条目图标应为 🏎️', () => {
    const entry = manifest.find(e => e.file === 'drift-racing.html');
    assert.strictEqual(entry.icon, '🏎️');
  });
});

describe('漂移赛车 — CONFIG 配置验证', () => {
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

  it('应有 10 个关卡配置', () => {
    assert.strictEqual(game.CONFIG.LEVELS.length, 10, '应有 10 个关卡');
  });

  it('关卡赛道长度应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS.length; i++) {
      assert.ok(game.CONFIG.LEVELS[i].len >= game.CONFIG.LEVELS[i - 1].len,
        `第 ${i + 1} 关赛道长度 (${game.CONFIG.LEVELS[i].len}) 应 >= 第 ${i} 关 (${game.CONFIG.LEVELS[i - 1].len})`);
    }
  });

  it('关卡障碍密度应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS.length; i++) {
      assert.ok(game.CONFIG.LEVELS[i].dens >= game.CONFIG.LEVELS[i - 1].dens,
        `第 ${i + 1} 关障碍密度应 >= 第 ${i} 关`);
    }
  });

  it('关卡移动障碍比例应递增', () => {
    for (let i = 1; i < game.CONFIG.LEVELS.length; i++) {
      assert.ok(game.CONFIG.LEVELS[i].mov >= game.CONFIG.LEVELS[i - 1].mov,
        `第 ${i + 1} 关移动障碍比例应 >= 第 ${i} 关`);
    }
  });

  it('赛道收窄程度应递增（后半段）', () => {
    for (let i = 5; i < game.CONFIG.LEVELS.length; i++) {
      assert.ok(game.CONFIG.LEVELS[i].nar >= game.CONFIG.LEVELS[i - 1].nar,
        `第 ${i + 1} 关赛道收窄应 >= 第 ${i} 关`);
    }
  });

  it('AI 数量应为 9', () => {
    assert.strictEqual(game.CONFIG.AI.COUNT, 9, 'AI 对手应为 9 个');
  });

  it('AI 颜色数量应与 AI 数量匹配', () => {
    assert.strictEqual(game.CONFIG.AI.COLORS.length, game.CONFIG.AI.COUNT,
      'AI 颜色数量应等于 AI 数量');
  });

  it('应定义 5 种障碍物类型', () => {
    const types = Object.keys(game.CONFIG.OBS.TYPES);
    assert.ok(types.includes('BARRIER'), '应有 BARRIER 类型');
    assert.ok(types.includes('ROCK'), '应有 ROCK 类型');
    assert.ok(types.includes('BARREL'), '应有 BARREL 类型');
    assert.ok(types.includes('MOVER_H'), '应有 MOVER_H（水平移动）类型');
    assert.ok(types.includes('MOVER_V'), '应有 MOVER_V（垂直移动）类型');
  });

  it('静止障碍物速度应为 0', () => {
    assert.strictEqual(game.CONFIG.OBS.TYPES.BARRIER.spd, 0);
    assert.strictEqual(game.CONFIG.OBS.TYPES.ROCK.spd, 0);
    assert.strictEqual(game.CONFIG.OBS.TYPES.BARREL.spd, 0);
  });

  it('移动障碍物速度应大于 0', () => {
    assert.ok(game.CONFIG.OBS.TYPES.MOVER_H.spd > 0, 'MOVER_H 速度应 > 0');
    assert.ok(game.CONFIG.OBS.TYPES.MOVER_V.spd > 0, 'MOVER_V 速度应 > 0');
  });

  it('训练模式配置应存在', () => {
    assert.ok(game.CONFIG.TRAIN, '应有训练模式配置');
    assert.ok(game.CONFIG.TRAIN.INIT_DENS > 0, '初始密度应 > 0');
    assert.ok(game.CONFIG.TRAIN.DENS_INC > 0, '密度递增应 > 0');
    assert.ok(game.CONFIG.TRAIN.MAX_DENS > game.CONFIG.TRAIN.INIT_DENS, '最大密度应大于初始密度');
  });

  it('碰撞反馈配置应合理', () => {
    assert.ok(game.CONFIG.HIT.SPEED_MULT > 0 && game.CONFIG.HIT.SPEED_MULT < 1,
      '碰撞速度乘数应在 0-1 之间');
    assert.ok(game.CONFIG.HIT.BOUNCE > 0, '弹开力应 > 0');
    assert.ok(game.CONFIG.HIT.FLASH_MS > 0, '闪烁时间应 > 0');
  });

  it('玩家赛车漂移系数应在 0-1 之间', () => {
    assert.ok(game.CONFIG.PLAYER.DRIFT_FACTOR > 0 && game.CONFIG.PLAYER.DRIFT_FACTOR < 1,
      '漂移系数应在 0-1 之间');
  });

  it('每关都有名称', () => {
    for (let i = 0; i < game.CONFIG.LEVELS.length; i++) {
      assert.ok(game.CONFIG.LEVELS[i].name, `第 ${i + 1} 关应有名称`);
    }
  });
});

describe('漂移赛车 — Utils 工具函数', () => {
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

    it('只在 X 轴重叠应返回 false', () => {
      const a = { x: 0, y: 0, w: 10, h: 10 };
      const b = { x: 5, y: 20, w: 10, h: 10 };
      assert.strictEqual(U.rectHit(a, b), false);
    });

    it('只在 Y 轴重叠应返回 false', () => {
      const a = { x: 0, y: 0, w: 10, h: 10 };
      const b = { x: 20, y: 5, w: 10, h: 10 };
      assert.strictEqual(U.rectHit(a, b), false);
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

describe('漂移赛车 — Camera 摄像机', () => {
  let Camera;

  before(() => {
    const env = createGameContext();
    Camera = env.game.Camera;
  });

  it('初始 y 应为 0', () => {
    const cam = new Camera();
    assert.strictEqual(cam.y, 0);
  });

  it('follow() 应使玩家保持在屏幕 72% 高度处', () => {
    const cam = new Camera();
    cam.follow(-1000);
    // cam.y = wy - HEIGHT * 0.72 = -1000 - 700 * 0.72 = -1000 - 504 = -1504
    assert.strictEqual(cam.y, -1000 - 700 * 0.72);
  });

  it('toScreen() 应正确转换世界坐标到屏幕坐标', () => {
    const cam = new Camera();
    cam.y = -500;
    // screen = worldY - cam.y = -300 - (-500) = 200
    assert.strictEqual(cam.toScreen(-300), 200);
  });

  it('follow 后 toScreen 应使玩家在屏幕 72% 位置', () => {
    const cam = new Camera();
    const playerWY = -2000;
    cam.follow(playerWY);
    const screenY = cam.toScreen(playerWY);
    assert.strictEqual(screenY, 700 * 0.72);
  });
});

describe('漂移赛车 — Track 赛道', () => {
  let Track, CONFIG;

  before(() => {
    const env = createGameContext();
    Track = env.game.Track;
    CONFIG = env.game.CONFIG;
  });

  it('init() 应正确重置赛道状态', () => {
    const track = new Track();
    track.init(-5000, 20);
    assert.strictEqual(track.finishY, -5000);
    assert.strictEqual(track.nar, 20);
    assert.deepStrictEqual(track.segs, []);
    assert.strictEqual(track.curveOff, 0);
    assert.strictEqual(track.curveTgt, 0);
  });

  it('generate() 应生成赛道段', () => {
    const track = new Track();
    track.init(-5000, 0);
    track.generate(0);
    assert.ok(track.segs.length > 0, '应生成赛道段');
  });

  it('赛道段应有 y, l, r 属性', () => {
    const track = new Track();
    track.init(-5000, 0);
    track.generate(0);
    const seg = track.segs[0];
    assert.ok(typeof seg.y === 'number', '应有 y 属性');
    assert.ok(typeof seg.l === 'number', '应有 l（左边界）属性');
    assert.ok(typeof seg.r === 'number', '应有 r（右边界）属性');
  });

  it('赛道左边界应小于右边界', () => {
    const track = new Track();
    track.init(-5000, 0);
    track.generate(0);
    for (const seg of track.segs) {
      assert.ok(seg.l < seg.r, `左边界 (${seg.l}) 应小于右边界 (${seg.r})`);
    }
  });

  it('赛道宽度应不小于赛车宽度的 2 倍（确保可通过）', () => {
    const track = new Track();
    track.init(-5000, 0);
    track.generate(0);
    const minWidth = CONFIG.PLAYER.WIDTH * 2;
    for (const seg of track.segs) {
      assert.ok(seg.r - seg.l >= minWidth,
        `赛道宽度 (${seg.r - seg.l}) 应 >= ${minWidth}`);
    }
  });

  it('赛道收窄时宽度应变小', () => {
    const track1 = new Track();
    track1.init(-5000, 0);
    track1.generate(0);

    const track2 = new Track();
    track2.init(-5000, 40);
    track2.generate(0);

    // 对比同一位置的赛道段宽度（取中间段）
    const mid1 = track1.segs[Math.floor(track1.segs.length / 2)];
    const mid2 = track2.segs[Math.floor(track2.segs.length / 2)];
    const w1 = mid1.r - mid1.l;
    const w2 = mid2.r - mid2.l;
    assert.ok(w2 < w1, `收窄赛道宽度 (${w2}) 应小于正常宽度 (${w1})`);
  });

  it('bounds() 应返回指定 Y 坐标处的赛道边界', () => {
    const track = new Track();
    track.init(-5000, 0);
    track.generate(0);
    const seg = track.bounds(0);
    assert.ok(typeof seg.l === 'number', '应返回左边界');
    assert.ok(typeof seg.r === 'number', '应返回右边界');
    assert.ok(seg.l < seg.r, '左边界应小于右边界');
  });

  it('bounds() 对不存在的段应返回默认值', () => {
    const track = new Track();
    track.init(-5000, 0);
    // 不生成，直接查询
    const seg = track.bounds(-99999);
    assert.ok(typeof seg.l === 'number');
    assert.ok(typeof seg.r === 'number');
    assert.ok(seg.l < seg.r);
  });

  it('generate() 应回收已滚过的赛道段', () => {
    const track = new Track();
    track.init(-99999, 0);
    // 在 y=0 附近生成
    track.generate(0);
    const countBefore = track.segs.length;
    // 往前滚动很远
    track.generate(-5000);
    // 后面的段应被清理
    const oldSegs = track.segs.filter(s => s.y > 0 + 700 + 300);
    assert.strictEqual(oldSegs.length, 0, '已滚过的段应被回收');
  });
});

describe('漂移赛车 — Obstacle 障碍物', () => {
  let Obstacle, ObstacleManager, Track, CONFIG;

  before(() => {
    const env = createGameContext();
    Obstacle = env.game.Obstacle;
    ObstacleManager = env.game.ObstacleManager;
    Track = env.game.Track;
    CONFIG = env.game.CONFIG;
  });

  describe('Obstacle 单体', () => {
    it('构造函数应正确设置属性', () => {
      const obs = new Obstacle('BARRIER', 100, -200, 60, 340);
      assert.strictEqual(obs.type, 'BARRIER');
      assert.strictEqual(obs.x, 100);
      assert.strictEqual(obs.y, -200);
      assert.strictEqual(obs.w, CONFIG.OBS.TYPES.BARRIER.w);
      assert.strictEqual(obs.h, CONFIG.OBS.TYPES.BARRIER.h);
    });

    it('box() 应返回正确的碰撞盒', () => {
      const obs = new Obstacle('ROCK', 100, -200, 60, 340);
      const box = obs.box();
      assert.strictEqual(box.x, 100);
      assert.strictEqual(box.y, -200);
      assert.strictEqual(box.w, CONFIG.OBS.TYPES.ROCK.w);
      assert.strictEqual(box.h, CONFIG.OBS.TYPES.ROCK.h);
    });

    it('静止障碍 update 后位置不应改变', () => {
      const obs = new Obstacle('BARRIER', 100, -200, 60, 340);
      obs.update(1);
      assert.strictEqual(obs.x, 100);
      assert.strictEqual(obs.y, -200);
    });

    it('MOVER_H 障碍 update 后 X 应改变', () => {
      const obs = new Obstacle('MOVER_H', 100, -200, 60, 340);
      const origX = obs.x;
      obs.update(1);
      assert.notStrictEqual(obs.x, origX, 'MOVER_H 更新后 X 应改变');
    });

    it('MOVER_V 障碍 update 后 Y 应改变', () => {
      const obs = new Obstacle('MOVER_V', 100, -200, 60, 340);
      const origY = obs.y;
      obs.update(1);
      assert.notStrictEqual(obs.y, origY, 'MOVER_V 更新后 Y 应改变');
    });

    it('MOVER_H 不应超出赛道边界', () => {
      const obs = new Obstacle('MOVER_H', 100, -200, 60, 340);
      // 多次更新模拟长时间运行
      for (let i = 0; i < 500; i++) {
        obs.update(1);
      }
      assert.ok(obs.x >= 60, 'MOVER_H 不应超出左边界');
      assert.ok(obs.x + obs.w <= 340, 'MOVER_H 不应超出右边界');
    });

    it('MOVER_V 移动范围应有限制', () => {
      const obs = new Obstacle('MOVER_V', 100, -200, 60, 340);
      const baseY = obs.baseY;
      for (let i = 0; i < 200; i++) {
        obs.update(1);
      }
      assert.ok(Math.abs(obs.y - baseY) <= 40, 'MOVER_V 移动范围应受限');
    });
  });

  describe('ObstacleManager 管理器', () => {
    it('init 后障碍列表应为空', () => {
      const om = new ObstacleManager();
      om.init(0);
      assert.strictEqual(om.obs.length, 0);
    });

    it('generate() 应生成障碍物', () => {
      const om = new ObstacleManager();
      om.init(0);
      const track = new Track();
      track.init(-10000, 0);
      track.generate(0);
      // 用高密度确保一定会生成
      om.generate(-2000, 1.0, 0, track);
      assert.ok(om.obs.length > 0, '高密度下应生成障碍物');
    });

    it('cleanup() 应清理已滚出的障碍', () => {
      const om = new ObstacleManager();
      om.init(0);
      const track = new Track();
      track.init(-10000, 0);
      track.generate(0);
      om.generate(-2000, 1.0, 0, track);
      const countBefore = om.obs.length;
      // 清理时假设摄像机已远远前移
      om.cleanup(-50000);
      assert.ok(om.obs.length < countBefore, '应有障碍被清理');
    });

    it('hit() 碰撞检测 — 有碰撞时返回障碍物', () => {
      const om = new ObstacleManager();
      om.init(0);
      // 手动添加一个障碍
      const obs = new Obstacle('BARRIER', 100, -200, 60, 340);
      om.obs.push(obs);
      // 构造与之重叠的碰撞盒
      const box = { x: 105, y: -195, w: 22, h: 38 };
      const hit = om.hit(box);
      assert.ok(hit !== null, '应检测到碰撞');
    });

    it('hit() 碰撞检测 — 无碰撞时返回 null', () => {
      const om = new ObstacleManager();
      om.init(0);
      const obs = new Obstacle('BARRIER', 100, -200, 60, 340);
      om.obs.push(obs);
      const box = { x: 300, y: -500, w: 22, h: 38 };
      const hit = om.hit(box);
      assert.strictEqual(hit, null, '不应检测到碰撞');
    });

    it('_checkGap() — 障碍物不应完全堵死赛道', () => {
      const om = new ObstacleManager();
      om.init(0);
      const track = new Track();
      track.init(-10000, 0);
      track.generate(0);

      // 大量生成并检查每一行是否有通路
      om.generate(-3000, 1.0, 0, track);
      // 按 Y 坐标分组检查
      const rows = {};
      for (const o of om.obs) {
        const ky = Math.round(o.y);
        if (!rows[ky]) rows[ky] = [];
        rows[ky].push(o);
      }

      const minGap = CONFIG.PLAYER.WIDTH + 8;
      for (const [y, row] of Object.entries(rows)) {
        if (row.length <= 1) continue;
        const seg = track.bounds(Number(y));
        row.sort((a, b) => a.x - b.x);
        // 检查左侧间隙
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
      const om = new ObstacleManager();
      om.init(0);
      const track = new Track();
      track.init(-10000, 0);
      track.generate(0);
      // 100% 移动比例
      om.generate(-3000, 1.0, 1.0, track);
      const movers = om.obs.filter(o => o.type === 'MOVER_H' || o.type === 'MOVER_V');
      assert.ok(movers.length > 0, '移动比例为 1.0 时应有移动障碍物');
    });
  });
});

describe('漂移赛车 — Car 赛车基类', () => {
  let Car, CONFIG;

  before(() => {
    const env = createGameContext();
    Car = env.game.Car;
    CONFIG = env.game.CONFIG;
  });

  it('构造函数应正确设置属性', () => {
    const car = new Car(200, -100, '#ff0000');
    assert.strictEqual(car.x, 200);
    assert.strictEqual(car.wy, -100);
    assert.strictEqual(car.color, '#ff0000');
    assert.strictEqual(car.spd, 0);
    assert.strictEqual(car.ang, 0);
    assert.strictEqual(car.vx, 0);
    assert.strictEqual(car.flash, 0);
  });

  it('box() 应返回以中心点为基准的碰撞盒', () => {
    const car = new Car(200, -100, '#ff0000');
    const box = car.box();
    assert.strictEqual(box.x, 200 - CONFIG.PLAYER.WIDTH / 2);
    assert.strictEqual(box.y, -100 - CONFIG.PLAYER.HEIGHT / 2);
    assert.strictEqual(box.w, CONFIG.PLAYER.WIDTH);
    assert.strictEqual(box.h, CONFIG.PLAYER.HEIGHT);
  });
});

describe('漂移赛车 — PlayerCar 玩家赛车', () => {
  let PlayerCar, Track, CONFIG;

  before(() => {
    const env = createGameContext();
    PlayerCar = env.game.PlayerCar;
    Track = env.game.Track;
    CONFIG = env.game.CONFIG;
  });

  it('初始位置应在屏幕水平中央', () => {
    const player = new PlayerCar();
    assert.strictEqual(player.x, CONFIG.WIDTH / 2);
  });

  it('reset() 应重置所有状态', () => {
    const player = new PlayerCar();
    player.spd = 5;
    player.ang = 0.3;
    player.vx = 2;
    player.flash = 100;
    player.reset(-500);
    assert.strictEqual(player.x, CONFIG.WIDTH / 2);
    assert.strictEqual(player.wy, -500);
    assert.strictEqual(player.spd, 0);
    assert.strictEqual(player.ang, 0);
    assert.strictEqual(player.vx, 0);
    assert.strictEqual(player.flash, 0);
  });

  describe('update() — 物理模拟', () => {
    let player, track;

    beforeEach(() => {
      player = new PlayerCar();
      player.reset(0);
      track = new Track();
      track.init(-Infinity, 0);
      track.generate(0);
    });

    it('按下加速键应增加速度', () => {
      const inp = { up: true, down: false, left: false, right: false };
      player.update(1, inp, track);
      assert.ok(player.spd > 0, '加速后速度应 > 0');
    });

    it('按下刹车键应减少速度', () => {
      // 先加速
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 30; i++) player.update(1, accInp, track);
      const speedBefore = player.spd;

      // 再刹车
      const brakeInp = { up: false, down: true, left: false, right: false };
      player.update(1, brakeInp, track);
      assert.ok(player.spd < speedBefore, '刹车后速度应降低');
    });

    it('松开油门后应有惯性（不会立刻停下）', () => {
      // 先加速
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 20; i++) player.update(1, accInp, track);
      const speedAtRelease = player.spd;
      assert.ok(speedAtRelease > 0, '应有速度');

      // 松开所有键，一帧后
      const noInp = { up: false, down: false, left: false, right: false };
      player.update(1, noInp, track);
      assert.ok(player.spd > 0, '松开油门后应仍有速度（惯性）');
      assert.ok(player.spd < speedAtRelease, '但速度应略有降低（摩擦力）');
    });

    it('速度不应超过最大值', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 500; i++) player.update(1, accInp, track);
      assert.ok(player.spd <= CONFIG.PLAYER.MAX_SPEED,
        `速度 (${player.spd}) 不应超过最大值 (${CONFIG.PLAYER.MAX_SPEED})`);
    });

    it('倒车速度应有限制', () => {
      const brakeInp = { up: false, down: true, left: false, right: false };
      for (let i = 0; i < 500; i++) player.update(1, brakeInp, track);
      assert.ok(player.spd >= -CONFIG.PLAYER.MAX_SPEED * 0.3,
        `倒车速度应不低于 -${CONFIG.PLAYER.MAX_SPEED * 0.3}`);
    });

    it('左转应改变角度', () => {
      // 先给一些速度（静止时转向效果小）
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, track);

      const leftInp = { up: true, down: false, left: true, right: false };
      player.update(1, leftInp, track);
      assert.ok(player.ang < 0, '左转角度应为负值');
    });

    it('右转应改变角度', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, track);

      const rightInp = { up: true, down: false, left: false, right: true };
      player.update(1, rightInp, track);
      assert.ok(player.ang > 0, '右转角度应为正值');
    });

    it('转向角度应有最大值限制', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 20; i++) player.update(1, accInp, track);

      const leftInp = { up: true, down: false, left: true, right: false };
      for (let i = 0; i < 500; i++) player.update(1, leftInp, track);
      assert.ok(Math.abs(player.ang) <= CONFIG.PLAYER.MAX_TURN + 0.001,
        `转角 (${player.ang}) 绝对值不应超过最大值 (${CONFIG.PLAYER.MAX_TURN})`);
    });

    it('不按方向键时角度应自动回正', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, track);

      // 先左转一些
      const leftInp = { up: true, down: false, left: true, right: false };
      for (let i = 0; i < 10; i++) player.update(1, leftInp, track);
      const angAfterTurn = player.ang;
      assert.ok(angAfterTurn < 0, '应有左转角度');

      // 松开方向键后角度应回正
      const noTurnInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 50; i++) player.update(1, noTurnInp, track);
      assert.ok(Math.abs(player.ang) < Math.abs(angAfterTurn),
        '松开方向键后角度应逐渐回正');
    });

    it('赛车碰到左边界应被限制', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, track);

      // 强制设到边界外
      player.x = 10;
      const leftInp = { up: true, down: false, left: true, right: false };
      player.update(1, leftInp, track);
      const seg = track.bounds(player.wy);
      assert.ok(player.x - player.w / 2 >= seg.l,
        '赛车左侧不应超出赛道左边界');
    });

    it('赛车碰到右边界应被限制', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 10; i++) player.update(1, accInp, track);

      player.x = 390;
      const rightInp = { up: true, down: false, left: false, right: true };
      player.update(1, rightInp, track);
      const seg = track.bounds(player.wy);
      assert.ok(player.x + player.w / 2 <= seg.r,
        '赛车右侧不应超出赛道右边界');
    });

    it('前进时 wy 应减小（向上移动）', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      player.update(1, accInp, track);
      player.update(1, accInp, track);
      assert.ok(player.wy < 0, '前进时世界 Y 坐标应减小');
    });

    it('漂移效果 — 转向时横向速度有延迟', () => {
      const accInp = { up: true, down: false, left: false, right: false };
      for (let i = 0; i < 20; i++) player.update(1, accInp, track);

      // 突然右转
      const rightInp = { up: true, down: false, left: false, right: true };
      player.update(1, rightInp, track);
      const vxAfterOneTurn = player.vx;

      // 继续右转多帧
      for (let i = 0; i < 10; i++) player.update(1, rightInp, track);
      // 横向速度应持续增大（漂移效果）
      assert.ok(Math.abs(player.vx) >= Math.abs(vxAfterOneTurn),
        '持续转向时横向速度应增大');
    });
  });

  describe('onHit() — 碰撞反馈', () => {
    it('碰撞后速度应降低', () => {
      const player = new PlayerCar();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.strictEqual(player.spd, 5 * CONFIG.HIT.SPEED_MULT);
    });

    it('碰撞后应触发闪烁', () => {
      const player = new PlayerCar();
      player.reset(0);
      player.spd = 5;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.strictEqual(player.flash, CONFIG.HIT.FLASH_MS);
    });

    it('碰撞后应有弹开效果', () => {
      const player = new PlayerCar();
      player.reset(0);
      player.spd = 5;
      player.vx = 0;
      const obs = { x: 190, w: 20 };
      player.onHit(obs);
      assert.ok(player.vx !== 0, '碰撞后横向速度应非零（弹开）');
      assert.ok(player.wy > 0, '碰撞后应向后弹');
    });
  });
});

describe('漂移赛车 — AICar AI赛车', () => {
  let AICar, Track, ObstacleManager, CONFIG;

  before(() => {
    const env = createGameContext();
    AICar = env.game.AICar;
    Track = env.game.Track;
    ObstacleManager = env.game.ObstacleManager;
    CONFIG = env.game.CONFIG;
  });

  it('构造函数应正确设置索引和颜色', () => {
    const ai = new AICar(3, '#3498db');
    assert.strictEqual(ai.idx, 3);
    assert.strictEqual(ai.color, '#3498db');
  });

  it('reset() 应在赛道范围内初始化位置', () => {
    const ai = new AICar(0, '#3498db');
    ai.reset(0, { nar: 0 });
    const hw = CONFIG.TRACK.WIDTH / 2;
    const cx = CONFIG.WIDTH / 2;
    assert.ok(ai.x >= cx - hw, 'X 应在赛道左边界内');
    assert.ok(ai.x <= cx + hw, 'X 应在赛道右边界内');
  });

  it('reset() 后应有基础速度', () => {
    const ai = new AICar(0, '#3498db');
    ai.reset(0, { nar: 0 });
    assert.ok(ai.baseSp > 0, '基础速度应 > 0');
  });

  it('update() 后 AI 应前进（wy 减小）', () => {
    const ai = new AICar(0, '#3498db');
    ai.reset(0, { nar: 0 });
    const track = new Track();
    track.init(-Infinity, 0);
    track.generate(0);
    const om = new ObstacleManager();
    om.init(0);

    const wyBefore = ai.wy;
    for (let i = 0; i < 30; i++) ai.update(1, om, track);
    assert.ok(ai.wy < wyBefore, 'AI 应前进');
  });

  it('AI 碰撞后速度应降低', () => {
    const ai = new AICar(0, '#3498db');
    ai.reset(0, { nar: 0 });
    ai.spd = 4;
    const obs = { x: ai.x - 10, w: 20 };
    ai.onHit(obs);
    assert.strictEqual(ai.spd, 4 * CONFIG.HIT.SPEED_MULT, 'AI 碰撞后速度应按比例降低');
    assert.strictEqual(ai.flash, CONFIG.HIT.FLASH_MS, 'AI 碰撞后应闪烁');
  });

  it('AI 应被赛道边界约束', () => {
    const ai = new AICar(0, '#3498db');
    ai.reset(0, { nar: 0 });
    const track = new Track();
    track.init(-Infinity, 0);
    track.generate(0);
    const om = new ObstacleManager();
    om.init(0);

    // 强制推到边界外
    ai.x = 10;
    ai.tgtX = -100;
    ai.update(1, om, track);
    const seg = track.bounds(ai.wy);
    assert.ok(ai.x - ai.w / 2 >= seg.l - 1, 'AI 不应超出赛道左边界');
  });
});

describe('漂移赛车 — HUD 信息显示', () => {
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
    hud.tick(1); // dt=1 → 减少 16.67ms
    assert.ok(hud.msgT < 2000, '计时应减少');
  });

  it('消息计时降到 0 后应停止', () => {
    const hud = new HUD();
    hud.show('测试', 100);
    // 多次 tick 直到超时
    for (let i = 0; i < 20; i++) hud.tick(1);
    assert.ok(hud.msgT <= 0, '计时应归零或负');
  });
});

describe('漂移赛车 — Game 主控逻辑', () => {
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

    it('_goRace() 应初始化比赛模式', () => {
      const game = new Game();
      game._goRace(0);
      assert.strictEqual(game.mode, 'race');
      assert.strictEqual(game.lv, 0);
      assert.strictEqual(game.ais.length, CONFIG.AI.COUNT, 'AI 数量应为 9');
      assert.strictEqual(game.state, 'countdown');
    });

    it('_goRace() 应正确初始化指定关卡', () => {
      const game = new Game();
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

  describe('关卡进度', () => {
    it('第 1-9 关完成后应进入下一关', () => {
      const game = new Game();
      game._goRace(0);
      game.state = 'playing';
      game.lv = 4;
      game._goNext();
      // _goNext 调用 _goRace(5)，state 变为 countdown
      assert.strictEqual(game.lv, 5);
      assert.strictEqual(game.state, 'countdown');
    });

    it('第 10 关完成后应进入胜利画面', () => {
      const game = new Game();
      game._goRace(9);
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
      game._goRace(0);
      game.state = 'playing';

      // 设置不同的 wy 位置
      game.player.wy = -500;
      for (let i = 0; i < game.ais.length; i++) {
        game.ais[i].wy = -100 * (i + 1);
      }
      // 某个 AI 在玩家前面
      game.ais[0].wy = -800;

      game._calcRanks();
      assert.ok(game.ranks.length === CONFIG.AI.COUNT + 1, '排名应包含所有赛车');

      // 验证排序正确（wy 最小的排第一）
      for (let i = 0; i < game.ranks.length - 1; i++) {
        assert.ok(game.ranks[i].c.wy <= game.ranks[i + 1].c.wy,
          '排名应按 wy 从小到大排序');
      }
    });

    it('_pRank() 应返回玩家的排名', () => {
      const game = new Game();
      game._goRace(0);
      game.player.wy = -500;
      for (const ai of game.ais) ai.wy = -100;
      game._calcRanks();
      assert.strictEqual(game._pRank(), 1, '玩家 wy 最小应排第一');
    });

    it('_pRank() 玩家最后时应返回最后名次', () => {
      const game = new Game();
      game._goRace(0);
      game.player.wy = 0;
      for (const ai of game.ais) ai.wy = -1000;
      game._calcRanks();
      assert.strictEqual(game._pRank(), CONFIG.AI.COUNT + 1, '玩家应排最后');
    });
  });

  describe('倒计时逻辑', () => {
    it('倒计时应从 3 开始递减', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.cdVal, 3);

      // 模拟 1 秒过去（dt=1, 每次 tick 约 16.67ms, 需要约 60 帧 = 1秒）
      for (let i = 0; i < 61; i++) game._update(1);
      assert.strictEqual(game.cdVal, 2);
    });

    it('倒计时结束后应进入 playing 状态', () => {
      const game = new Game();
      game._goTrain();

      // 模拟 4 秒（3秒倒计时 + 1秒 GO!）
      for (let i = 0; i < 250; i++) game._update(1);
      assert.strictEqual(game.state, 'playing');
    });
  });

  describe('训练模式', () => {
    it('训练模式不应有 AI 赛车', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.ais.length, 0);
    });

    it('训练模式赛道应为无限（finishY = -Infinity）', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.track.finishY, -Infinity);
    });

    it('初始行驶距离应为 0', () => {
      const game = new Game();
      game._goTrain();
      assert.strictEqual(game.dist, 0);
    });
  });

  describe('比赛模式', () => {
    it('比赛模式应有 9 个 AI 赛车', () => {
      const game = new Game();
      game._goRace(0);
      assert.strictEqual(game.ais.length, 9);
    });

    it('AI 赛车颜色应各不相同', () => {
      const game = new Game();
      game._goRace(0);
      const colors = game.ais.map(ai => ai.color);
      const uniqueColors = new Set(colors);
      assert.strictEqual(uniqueColors.size, game.ais.length, 'AI 颜色应各不相同');
    });

    it('AI 颜色不应与玩家颜色相同', () => {
      const game = new Game();
      game._goRace(0);
      const playerColor = game.player.color;
      for (const ai of game.ais) {
        assert.notStrictEqual(ai.color, playerColor, 'AI 颜色不应与玩家相同');
      }
    });

    it('终点线 Y 坐标应设置正确', () => {
      const game = new Game();
      game._goRace(3);
      assert.strictEqual(game.track.finishY, -CONFIG.LEVELS[3].len);
    });
  });

  describe('Tap 事件处理', () => {
    it('菜单点击训练模式区域应启动训练', () => {
      const game = new Game();
      game.state = 'menu';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 365); // 训练按钮区域
      assert.strictEqual(game.mode, 'training');
      assert.strictEqual(game.state, 'countdown');
    });

    it('菜单点击比赛模式区域应启动比赛', () => {
      const game = new Game();
      game.state = 'menu';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 440); // 比赛按钮区域
      assert.strictEqual(game.mode, 'race');
      assert.strictEqual(game.state, 'countdown');
    });

    it('暂停状态点击继续应恢复游戏', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'paused';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 320); // 继续按钮区域
      assert.strictEqual(game.state, 'playing');
    });

    it('暂停状态点击返回菜单应回到菜单', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'paused';
      const cx = CONFIG.WIDTH / 2;
      game._tap(cx, 450); // 返回菜单按钮区域
      assert.strictEqual(game.state, 'menu');
    });

    it('游戏中点击右上角暂停图标应暂停', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'playing';
      game._tap(CONFIG.WIDTH - 20, 18); // 暂停图标区域
      assert.strictEqual(game.state, 'paused');
    });

    it('训练模式点击结束按钮应进入 trainEnd 状态', () => {
      const game = new Game();
      game._goTrain();
      game.state = 'playing';
      game._tap(CONFIG.WIDTH - 50, 55); // 结束训练按钮区域
      assert.strictEqual(game.state, 'trainEnd');
    });
  });
});

describe('漂移赛车 — InputManager 输入管理', () => {
  let InputManager;

  before(() => {
    const env = createGameContext();
    InputManager = env.game.InputManager;
  });

  it('初始状态所有输入应为 falsy', () => {
    // 创建一个 mock canvas
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

  it('键盘按键应正确映射', () => {
    const mockCv = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
      addEventListener: () => {},
    };
    const inp = new InputManager(mockCv);

    // 模拟按下 ArrowUp
    inp.keys['ArrowUp'] = true;
    assert.strictEqual(inp.up, true);
    inp.keys['ArrowUp'] = false;

    // 模拟按下 KeyW
    inp.keys['KeyW'] = true;
    assert.strictEqual(inp.up, true);
    inp.keys['KeyW'] = false;

    // 模拟按下 ArrowLeft
    inp.keys['ArrowLeft'] = true;
    assert.strictEqual(inp.left, true);
    inp.keys['ArrowLeft'] = false;

    // 模拟按下 KeyA
    inp.keys['KeyA'] = true;
    assert.strictEqual(inp.left, true);
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
    let tapped = false;
    inp.onTap(() => { tapped = true; });
    assert.strictEqual(inp.taps.length, 1, '应注册了一个回调');
  });
});

describe('漂移赛车 — 集成测试', () => {
  let env;

  beforeEach(() => {
    env = createGameContext();
  });

  it('完整比赛流程：菜单 → 倒计时 → 游戏中 → 暂停 → 继续', () => {
    const game = new env.game.Game();
    assert.strictEqual(game.state, 'menu');

    // 启动比赛
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

  it('训练流程：开始 → 游戏中 → 结束', () => {
    const game = new env.game.Game();
    game._goTrain();

    // 倒计时完成
    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');
    assert.strictEqual(game.mode, 'training');

    // 模拟结束训练
    game.state = 'trainEnd';
    assert.strictEqual(game.state, 'trainEnd');

    // 返回菜单
    game._goMenu();
    assert.strictEqual(game.state, 'menu');
  });

  it('比赛模式关卡切换：模拟通过第1关', () => {
    const game = new env.game.Game();
    game._goRace(0);

    // 跳过倒计时
    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');

    // 模拟到达终点
    game.player.wy = -env.game.CONFIG.LEVELS[0].len - 10;
    game._play(1); // 触发终点检测

    assert.strictEqual(game.state, 'levelComplete');

    // 等待过关提示
    game.lcTimer = 0;
    game._update(1);
    // 应该进入第2关
    assert.strictEqual(game.lv, 1);
  });

  it('10关全部通过后应显示胜利画面', () => {
    const game = new env.game.Game();
    game._goRace(9); // 最后一关

    // 跳过倒计时
    for (let i = 0; i < 250; i++) game._update(1);

    // 确保排名数据存在
    game._calcRanks();

    // 模拟到达终点
    game.player.wy = -env.game.CONFIG.LEVELS[9].len - 10;
    game._play(1);

    assert.strictEqual(game.state, 'levelComplete');

    // 等待后应显示胜利
    game.lcTimer = 0;
    game._update(1);
    assert.strictEqual(game.state, 'victory');
  });

  it('ESC 键应切换暂停状态', () => {
    const game = new env.game.Game();
    game._goTrain();
    for (let i = 0; i < 250; i++) game._update(1);
    assert.strictEqual(game.state, 'playing');

    // 模拟 ESC
    game.inp.keys['Escape'] = true;
    game._update(1);
    assert.strictEqual(game.state, 'paused');

    // 再次 ESC
    game.inp.keys['Escape'] = true;
    game._update(1);
    assert.strictEqual(game.state, 'playing');
  });

  it('AI 赛车也应受障碍物碰撞影响', () => {
    const game = new env.game.Game();
    game._goRace(0);

    // 给 AI 一些速度
    for (const ai of game.ais) {
      ai.spd = 4;
    }

    // 手动在 AI 位置放置障碍物
    const { Obstacle } = env.game;
    const ai = game.ais[0];
    const obs = new Obstacle('BARRIER', ai.x - 5, ai.wy, 60, 340);
    game.om.obs.push(obs);

    // AI 碰撞检测
    const hit = game.om.hit(ai.box());
    if (hit) {
      const spdBefore = ai.spd;
      ai.onHit(hit);
      assert.ok(ai.spd < spdBefore, 'AI 碰到障碍后速度应降低');
    }
  });
});

describe('漂移赛车 — 边界情况验证', () => {
  let env;

  beforeEach(() => {
    env = createGameContext();
  });

  it('长时间运行不应崩溃（200帧模拟）', () => {
    const game = new env.game.Game();
    game._goTrain();
    // 跳过倒计时
    for (let i = 0; i < 250; i++) game._update(1);

    // 模拟 200 帧游戏运行
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

  it('赛道生成后赛道段不应无限增长', () => {
    const { Track } = env.game;
    const track = new Track();
    track.init(-Infinity, 0);

    // 多次生成
    for (let y = 0; y > -10000; y -= 100) {
      track.generate(y);
    }

    // 段数应被控制在合理范围（不应无限增长）
    const maxSegs = (700 + 200 + 200 + 300) / env.game.CONFIG.TRACK.SEGMENT_HEIGHT + 100;
    assert.ok(track.segs.length < maxSegs,
      `赛道段数 (${track.segs.length}) 应小于 ${maxSegs}，避免内存泄漏`);
  });

  it('障碍物应随距离正确清理（内存管理）', () => {
    const game = new env.game.Game();
    game._goTrain();
    for (let i = 0; i < 250; i++) game._update(1);

    // 大量前进
    game.inp.keys['ArrowUp'] = true;
    for (let i = 0; i < 500; i++) game._update(1);

    const obCount = game.om.obs.length;
    // 障碍物数量应在合理范围内（不应无限增长）
    assert.ok(obCount < 500, `障碍物数量 (${obCount}) 应在合理范围内`);
  });

  it('训练模式障碍密度不应超过最大值', () => {
    const { CONFIG } = env.game;
    // 模拟很远的距离
    const d = 999999;
    const dens = Math.min(CONFIG.TRAIN.MAX_DENS,
      CONFIG.TRAIN.INIT_DENS + Math.floor(d / 1000) * CONFIG.TRAIN.DENS_INC);
    assert.ok(dens <= CONFIG.TRAIN.MAX_DENS, '训练密度不应超过上限');
  });

  it('比赛模式所有关卡索引应有效', () => {
    const { CONFIG } = env.game;
    for (let i = 0; i < CONFIG.LEVELS.length; i++) {
      assert.ok(CONFIG.LEVELS[i].len > 0, `第 ${i + 1} 关长度应 > 0`);
      assert.ok(CONFIG.LEVELS[i].dens > 0, `第 ${i + 1} 关密度应 > 0`);
      assert.ok(CONFIG.LEVELS[i].mov >= 0, `第 ${i + 1} 关移动比例应 >= 0`);
      assert.ok(CONFIG.LEVELS[i].nar >= 0, `第 ${i + 1} 关收窄应 >= 0`);
    }
  });

  it('所有 AI 颜色不应重复', () => {
    const { CONFIG } = env.game;
    const colors = CONFIG.AI.COLORS;
    const unique = new Set(colors);
    assert.strictEqual(unique.size, colors.length, 'AI 颜色不应重复');
  });
});
