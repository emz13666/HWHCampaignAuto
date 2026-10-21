// ==UserScript==
// @name         HWHCampaignAuto
// @name:ru      Авто-кампания
// @namespace    HWHCampaignAuto
// @version      1.0.10
// @description  Автопрохождение кампании в HeroWarsHelper с подробными логами.
// @description:ru Автопрохождение кампании: названия миссий, подробные логи, причины остановки, стоп — клик по статусу.
// @author       emz13
// @license      MIT
// @homepage     https://gitverse.ru/emz13/HWHCampaignAuto
// @supportURL   https://gitverse.ru/emz13/HWHCampaignAuto/issues
// @match        https://www.hero-wars.com/*
// @match        https://www.hero-wars.cn/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @downloadURL  https://github.com/emz13666/HWHCampaignAuto/raw/refs/heads/main/HWHCampaignAuto.user.js
// @updateURL    https://github.com/emz13666/HWHCampaignAuto/raw/refs/heads/main/HWHCampaignAuto.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

console.log('%c[HWHCampaignAuto] build v1.0.10 loaded @ ' + new Date().toISOString(), 'color:#ffd24d;font-weight:bold');
console.log('%c[HWHCampaignAuto] waiting for HWH...', 'color:#ffd24d');

(async function () {
'use strict';

const LOG = '[HWHCampaignAuto]';
const SETTINGS_KEY = 'HWHCampaignAuto.settings';
const LAST_ATTEMPT_KEY = 'HWHCampaignAuto.lastAttempt';
const WAIT_HWH_TIMEOUT = 60000;

/* ===== Логирование (единый префикс) ===== */
function lInfo(...a)  { console.log(LOG, ...a); }
function lOk(...a)    { console.log('%c' + LOG + ' ✓', 'color:#4cd964', ...a); }
function lFail(...a)  { console.log('%c' + LOG + ' ✗', 'color:#ff6b6b', ...a); }
function lStep(...a)  { console.log('%c' + LOG + ' ▶', 'color:#5ac8fa', ...a); }
function lWarn(...a)  { console.log('%c' + LOG + ' ⚠', 'color:#ffcc00', ...a); }
function lStop(...a)  { console.log('%c' + LOG + ' ⏹', 'color:#ff9500', ...a); }
function lRetry(...a) { console.log('%c' + LOG + ' ↻', 'color:#af52de', ...a); }

/* ===== Живой статус ===== */
let liveStatusTimer = null;
let liveStatusPrefix = '';
let liveStatusStart = 0;
let liveStatusBattleEnd = null;
let liveStatusHistory = [];
let liveStatusOnClick = null;

function renderLiveStatus() {
    const elapsed = ((Date.now() - liveStatusStart) / 1000).toFixed(1);
    const parts = [liveStatusPrefix];
    if (liveStatusBattleEnd) {
        const left = Math.max(0, (liveStatusBattleEnd - Date.now()) / 1000);
        parts.push(`⏱ бой ${left.toFixed(1)}с`);
    }
    parts.push(`(прошло ${elapsed}с)`);
    const head = parts.join(' ');
    const hist = liveStatusHistory.slice(-3).join('<br>');
    const text = hist ? `${hist}<br>${head}` : head;
    HWHFuncs.setProgress(text, 3600000, liveStatusOnClick);
}
function startLiveStatus(prefix, onClick) {
    stopLiveStatus(false);
    liveStatusPrefix = prefix;
    liveStatusStart = Date.now();
    liveStatusBattleEnd = null;
    liveStatusOnClick = onClick || null;
    renderLiveStatus();
    liveStatusTimer = setInterval(renderLiveStatus, 200);
}
function setBattleCountdown(seconds) {
    liveStatusBattleEnd = seconds ? (Date.now() + seconds * 1000) : null;
    renderLiveStatus();
}
function pushLiveStatus(line) {
    liveStatusHistory.push(line);
    if (liveStatusHistory.length > 3) liveStatusHistory.shift();
    renderLiveStatus();
}
function stopLiveStatus(showFinal = true, finalMessage, onClick) {
    if (liveStatusTimer) { clearInterval(liveStatusTimer); liveStatusTimer = null; }
    liveStatusBattleEnd = null;
    if (finalMessage) {
        liveStatusHistory.push(finalMessage);
        if (liveStatusHistory.length > 3) liveStatusHistory.shift();
    }
    if (showFinal) {
        const hist = liveStatusHistory.slice(-3).join('<br>');
        if (hist) HWHFuncs.setProgress(hist, 300000, onClick);
    }
    liveStatusHistory = [];
    liveStatusOnClick = null;
}

/* ===== Ожидание HWH ===== */
async function waitForHelper(timeout = WAIT_HWH_TIMEOUT) {
    const start = Date.now();
    let lastLog = 0;
    while (Date.now() - start < timeout) {
        const g = globalThis;
        if (g.HWHClasses && g.HWHFuncs && g.HWHFuncs.setProgress && g.HWHData && g.Caller && g.Calc) return true;
        if (Date.now() - lastLog > 5000) {
            lastLog = Date.now();
            lWarn(`жду HWH… (${((Date.now() - start) / 1000).toFixed(0)}с): HWHClasses=${!!g.HWHClasses} HWHFuncs=${!!g.HWHFuncs} HWHData=${!!g.HWHData} Caller=${!!g.Caller} Calc=${!!g.Calc}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}
function showHWHNotFoundPopup() {
    const msg = 'Скрипт HeroWarsHelper не найден!\n\nУстановите и включите HeroWarsHelper (https://zingery.ru/scripts/HeroWarsHelper.user.js) и перезагрузите страницу.';
    try {
        lWarn(msg);
        const id = 'hwh-campaign-no-hwh';
        if (document.getElementById(id)) return;
        const wrap = document.createElement('div');
        wrap.id = id;
        wrap.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483647;background:#190e08e6;border:2px solid #ce9767;border-radius:10px;padding:14px 18px;color:#fce1ac;font:600 14px/1.4 sans-serif;box-shadow:0 6px 24px #000a;max-width:520px;text-align:center;';
        wrap.innerHTML = '⚠️ <b>HeroWarsHelper не найден!</b><br>Установите/включите <a style="color:#ffd24d" target="_blank" href="https://zingery.ru/scripts/HeroWarsHelper.user.js">HeroWarsHelper</a> и перезагрузите страницу.<div style="margin-top:8px"><button id="'+id+'-btn" style="cursor:pointer;background:#a37738;border:1px solid #e1a960;color:#fce1ac;padding:6px 14px;border-radius:6px;font-weight:700">OK</button></div>';
        document.body.appendChild(wrap);
        wrap.querySelector('#'+id+'-btn').onclick = () => wrap.remove();
        setTimeout(() => { if (wrap.isConnected) wrap.remove(); }, 15000);
    } catch (e) { alert(msg); }
}

/* ===== Настройки ===== */
const defaultSettings = {
    firstMissionId: 134,
    lastMissionId: 299,
    repeatPerMission: 1,
    useRaidIfPossible: true,
    stopOnDefeat: true,
};
function loadSettings() {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch (e) { return { ...defaultSettings }; }
}
function saveSettings(s) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
        lInfo('настройки сохранены:', s);
    } catch (e) {
        lWarn('не удалось сохранить настройки:', e);
    }
}
function loadLastAttempt() {
    try { return JSON.parse(localStorage.getItem(LAST_ATTEMPT_KEY) || 'null'); }
    catch (e) { return null; }
}
function saveLastAttempt(obj) {
    try { localStorage.setItem(LAST_ATTEMPT_KEY, JSON.stringify(obj)); } catch (e) {}
}

/* ===== HWH готов? ===== */
if (!(await waitForHelper())) {
    lFail('HeroWarsHelper не найден');
    showHWHNotFoundPopup();
    const recheck = setInterval(async () => {
        if (await waitForHelper(1500)) {
            clearInterval(recheck);
            lOk('HWH найден (поздний старт)');
            boot();
        }
    }, 3000);
    return;
}
lOk('HWH найден, запускаю boot()');

function boot() {
console.log(`%cStart Extension ${GM_info.script.name}, v${GM_info.script.version} by ${GM_info.script.author}`, 'color: #ffd24d');
try { globalThis.HWHFuncs.addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author); } catch (e) {}

const { Caller, HWHFuncs, HWHClasses, HWHData } = globalThis;

/* ===== Названия миссий ===== */
const missionTitleCache = new Map();
function looksUntranslated(s) { return /^\s*[%$]?\s*LIB_[A-Z0-9_]+\s*[%$]?\s*$/i.test(s); }
function getMissionTitle(missionId) {
    const id = +missionId;
    if (!id) return null;
    if (missionTitleCache.has(id)) return missionTitleCache.get(id);
    let title = null;
    try {
        const t = globalThis.cheats?.translate?.('LIB_MISSION_NAME_' + id);
        if (t && typeof t === 'string' && !looksUntranslated(t) && t !== 'LIB_MISSION_NAME_' + id) title = t;
    } catch (e) {}
    if (!title) {
        try {
            const libData = globalThis.lib?.data;
            const m = libData?.mission?.[id] || globalThis.lib?.getData?.('mission')?.[id];
            if (m) {
                const cand = m.clientData?.title || m.clientData?.name || m.title || m.name;
                if (cand && typeof cand === 'string') {
                    if (looksUntranslated(cand)) {
                        try {
                            const tt = globalThis.cheats?.translate?.(cand);
                            if (tt && typeof tt === 'string' && !looksUntranslated(tt)) title = tt;
                        } catch (e) {}
                    } else title = cand;
                }
            }
        } catch (e) {}
    }
    missionTitleCache.set(id, title);
    return title;
}
function missionDisplayName(id) {
    const t = getMissionTitle(id);
    return t ? `«${t}»` : '';
}
function missionLabel(id) {
    const t = getMissionTitle(id);
    return `#${id}${t ? ' «' + t + '»' : ''}`;
}

/* ===== Кэш missionGetAll ===== */
let missionInfoCache = null;
async function loadMissionInfo() {
    if (missionInfoCache) return missionInfoCache;
    try {
        const all = await Caller.send('missionGetAll');
        const arr = Array.isArray(all) ? all : (all?.missions || []);
        missionInfoCache = new Map();
        for (const m of arr) missionInfoCache.set(+m.id, m);
        lInfo(`missionGetAll: получено ${missionInfoCache.size} миссий`);
    } catch (e) {
        lWarn('missionGetAll ошибка:', e);
        missionInfoCache = new Map();
    }
    return missionInfoCache;
}
function invalidateMissionCache() { missionInfoCache = null; lInfo('кэш миссий сброшен'); }

/* ===== Пачка ===== */
async function getMissionPack() {
    const [teamGetAll, teamGetFavor] = await Caller.send(['teamGetAll', 'teamGetFavor']);
    const list = (teamGetAll && teamGetAll.mission) || [];
    const heroes = list.filter(id => id < 6000);
    const pet = list.filter(id => id >= 6000).pop() || null;
    const rawFavor = (teamGetFavor && teamGetFavor.mission) || {};
    const favor = (rawFavor && typeof rawFavor === 'object' && !Array.isArray(rawFavor)) ? rawFavor : {};
    if (!heroes.length) throw new Error('Нет героев в пачке кампании (teamGetAll.mission)');
    return { heroes, pet, favor };
}

/* ===== Стоимость энергии ===== */
function getMissionEnergyCost(missionId) {
    try {
        const m = globalThis.lib?.data?.mission?.[missionId];
        const exp = m?.normalMode?.teamExp;
        if (typeof exp === 'number' && exp > 0) return exp;
    } catch (e) {}
    return null;
}

/* ===== Рейд / авто-старт ===== */
async function canRaid(missionId) {
    const map = await loadMissionInfo();
    const info = map.get(+missionId);
    return !!(info && (info.stars | 0) >= 3);
}
async function findRealStartMission(requestedFirst) {
    const map = await loadMissionInfo();
    if (!map.size) return requestedFirst;
    for (let id = 1; id <= requestedFirst; id++) {
        const m = map.get(id);
        if (!m) continue;
        if ((m.stars | 0) === 0) return id;
    }
    return requestedFirst;
}

/* ===== Таймер боя ===== */
async function countdownSeconds(seconds) {
    const end = Date.now() + seconds * 1000;
    setBattleCountdown(seconds);
    while (Date.now() < end) {
        if (!campaignRunning) break;
        await new Promise(r => setTimeout(r, 100));
    }
    setBattleCountdown(null);
    return campaignRunning;
}

/* ===== Одна миссия ===== */
async function runMissionOnce(missionId, pack) {
    const argsStart = { id: +missionId, heroes: pack.heroes, favor: pack.favor };
    if (pack.pet) argsStart.pet = pack.pet;

    lStep(`missionStart #${missionId} ${missionLabel(missionId)}; heroes=[${pack.heroes.join(',')}] pet=${pack.pet || '-'}`);

    const battle = await Caller.send({ name: 'missionStart', args: argsStart });
    lInfo(`missionStart #${missionId}: получен battle (${battle?.attackers ? 'attackers ok' : 'НЕТ attackers'}), расчёт...`);

    const result = await Calc(battle);
    const win = !!result?.result?.win;
    const timer = (Number(result?.battleTimer) || 10) + 2;

    lInfo(`Calc #${missionId}: win=${win}, stars=${result?.result?.stars ?? '?'}, battleTimer=${result?.battleTimer ?? '?'}s (ждём ${timer}с)`);

    if (!win) return { win: false, missionId, aborted: false };

    await countdownSeconds(timer);
    lInfo(`missionEnd #${missionId}: отправка результата...`);

    await Caller.send({
        name: 'missionEnd',
        args: { id: +missionId, result: result.result, progress: result.progress },
    });

    lOk(`missionEnd #${missionId} OK`);
    return { win: true, missionId, aborted: !campaignRunning };
}

/* ===== Классификация ошибок ===== */
function classifyError(e) {
    const msg = String(e?.message || e || '');
    if (/Previous mission not completed/i.test(msg)) {
        const m = msg.match(/#(\d+)/);
        return { kind: 'prev_mission', backTo: m ? parseInt(m[1], 10) : null, text: msg };
    }
    if (/Tries for mission|NotEnough in missionRaid|RaidTries|raidLimit/i.test(msg)) {
        return { kind: 'raid_limit', text: msg };
    }
    if (/NotEnoughEnergy|NotEnoughStamina|not enough energy|not enough stamina|NotEnough.*?[Ee]nergy|NotEnough.*?[Ss]tamina/i.test(msg)) {
        return { kind: 'no_energy', text: msg };
    }
    if (/NoAttempts|not enough attempts|no attempts|attemptsLimit/i.test(msg)) {
        return { kind: 'no_attempts', text: msg };
    }
    if (/MissionLocked|MissionNotAvailable|locked|NotAvailable/i.test(msg)) {
        return { kind: 'locked', text: msg };
    }
    return { kind: 'other', text: msg };
}

/* ===== Стоп / состояние ===== */
let campaignRunning = false;
function stopCampaign() {
    if (!campaignRunning) return;
    campaignRunning = false;
    lStop('кампания остановлена пользователем (клик по статусу)');
    pushLiveStatus('⏹ Кампания остановлена (клик по статусу)');
}

/* ===== Основной прогон ===== */
async function runCampaign(settings) {
    if (campaignRunning) {
        HWHFuncs.setProgress('Кампания уже идёт. Кликните по статусу сверху, чтобы остановить.', 5000);
        lWarn('кампания уже идёт — повторный запуск проигнорирован');
        return;
    }
    campaignRunning = true;
    invalidateMissionCache();

    lInfo('════════════════════════════════════════════');
    lInfo('ЗАПУСК КАМПАНИИ', settings);

    let pack;
    try {
        pack = await getMissionPack();
        lInfo(`пачка: heroes=[${pack.heroes.join(',')}] pet=${pack.pet || '-'} favor=${JSON.stringify(pack.favor)}`);
    }
    catch (e) {
        lFail('не удалось получить пачку:', e.message);
        HWHFuncs.setProgress('Кампания: ' + e.message, 6000);
        campaignRunning = false;
        return;
    }

    let realFirst = settings.firstMissionId;
    try {
        HWHFuncs.setProgress('Кампания: проверка доступных миссий...', false);
        lStep(`поиск реальной стартовой миссии в диапазоне 1..${settings.firstMissionId}...`);
        const detected = await findRealStartMission(settings.firstMissionId);
        if (detected !== settings.firstMissionId) {
            lWarn(`реальный старт: ${missionLabel(detected)} (запрошен #${settings.firstMissionId})`);
            realFirst = detected;
        } else {
            lInfo(`старт с ${missionLabel(realFirst)} — всё до неё пройдено`);
        }
    } catch (e) { lWarn('findRealStartMission error:', e); }

    const last = Math.max(realFirst, settings.lastMissionId);
    const stats = { passed: 0, failed: 0, raided: 0, combats: 0, current: realFirst, skipped: 0 };
    lInfo(`диапазон: ${missionLabel(realFirst)} .. ${missionLabel(last)}  (повторов на миссию: ${settings.repeatPerMission})`);
    lInfo(`опции: useRaidIfPossible=${settings.useRaidIfPossible} stopOnDefeat=${settings.stopOnDefeat}`);

    let currentEnergy = -1;
    try {
        const ui = await Caller.send('userGetInfo');
        const refill1 = (ui?.refillable || []).find(r => r.id === 1);
        if (refill1) currentEnergy = refill1.amount | 0;
        lInfo(`энергия до старта: ${currentEnergy >= 0 ? currentEnergy : 'н/д'}`);
    } catch (e) { lWarn('userGetInfo ошибка:', e); }

    let stopReason = '';

    outer:
    for (let missionId = realFirst; missionId <= last; missionId++) {
        if (!campaignRunning) { stopReason = '⏹ остановлено пользователем (клик по статусу)'; break outer; }
        stats.current = missionId;

        saveLastAttempt({ id: missionId, ts: Date.now(), title: getMissionTitle(missionId) });

        const raid = settings.useRaidIfPossible && await canRaid(missionId);
        const reps = Math.max(1, settings.repeatPerMission | 0);
        const title = missionDisplayName(missionId);
        const cost = getMissionEnergyCost(missionId);

        lInfo(`──────────── ${missionLabel(missionId)} ${raid ? '[рейд]' : '[бой]'} cost=${cost ?? '?'} energy=${currentEnergy >= 0 ? currentEnergy : '?'}`);

        if (cost != null && currentEnergy >= 0 && currentEnergy < cost) {
            stopReason = `⚡ не хватает энергии на миссию ${missionId} ${title} (нужно ${cost}, есть ${currentEnergy})`;
            lStop(`нет энергии: нужно ${cost}, есть ${currentEnergy} — остановка`);
            break outer;
        }

        for (let r = 0; r < reps; r++) {
            if (!campaignRunning) { stopReason = '⏹ остановлено пользователем (клик по статусу)'; break outer; }

            const repLabel = reps > 1 ? ` (${r + 1}/${reps})` : '';
            const prefix = `Кампания: ${missionId} ${title}${repLabel}${raid ? ' [рейд]' : ''} — клик для остановки`;
            startLiveStatus(prefix, stopCampaign);

            if (reps > 1) lStep(`повтор ${r + 1}/${reps}`);

            let done = false;
            try {
                if (raid) {
                    lStep(`missionRaid #${missionId} times=1`);
                    await Caller.send({ name: 'missionRaid', args: { id: +missionId, times: 1 } });
                    stats.raided++; stats.passed++;
                    lOk(`рейд ${missionId}${repLabel} пройден`);
                    pushLiveStatus(`Кампания: ${missionId} ${title}${repLabel}: ✓ рейд`);
                    if (cost != null && currentEnergy > 0) currentEnergy = Math.max(0, currentEnergy - cost);
                    done = true;
                } else {
                    const res = await runMissionOnce(missionId, pack);
                    if (res.win) {
                        stats.combats++; stats.passed++;
                        lOk(`бой ${missionId}${repLabel} пройден`);
                        pushLiveStatus(`Кампания: ${missionId} ${title}${repLabel}: ✓`);
                        if (cost != null && currentEnergy > 0) currentEnergy = Math.max(0, currentEnergy - cost);
                        done = true;
                        if (res.aborted) {
                            stopReason = '⏹ остановлено пользователем (клик по статусу)';
                            break outer;
                        }
                    } else {
                        stats.failed++;
                        lFail(`бой ${missionId}${repLabel} — поражение`);
                        pushLiveStatus(`Кампания: ${missionId} ${title}${repLabel}: ❌ поражение`);
                    }
                }
            } catch (e) {
                const cls = classifyError(e);
                lWarn(`ошибка миссии ${missionId}: kind=${cls.kind} msg=${cls.text.split('\n')[0]}`);
                console.warn(LOG, 'полный текст ошибки:', cls.text);

                if (cls.kind === 'prev_mission' && cls.backTo && cls.backTo >= 1 && cls.backTo < missionId) {
                    lRetry(`Previous mission not completed #${cls.backTo} — откат с ${missionId} на ${missionLabel(cls.backTo)}`);
                    pushLiveStatus(`Кампания: откат с ${missionId} на ${cls.backTo} ${missionDisplayName(cls.backTo)}`);
                    invalidateMissionCache();
                    missionId = cls.backTo - 1;
                    done = true;
                    break;
                }

                if (cls.kind === 'raid_limit') {
                    lRetry(`рейд ${missionId} недоступен (лимит) — пробую обычным боем`);
                    pushLiveStatus(`Кампания: ${missionId} ${title}: рейд недоступен, пробуем обычный бой`);
                    try {
                        const res = await runMissionOnce(missionId, pack);
                        if (res.win) {
                            stats.combats++; stats.passed++;
                            lOk(`обычный бой ${missionId}${repLabel} пройден (вместо рейда)`);
                            pushLiveStatus(`Кампания: ${missionId} ${title}${repLabel}: ✓ (обычный бой)`);
                            if (cost != null && currentEnergy > 0) currentEnergy = Math.max(0, currentEnergy - cost);
                            done = true;
                        } else {
                            stats.failed++;
                            lFail(`обычный бой ${missionId}${repLabel} — поражение`);
                            pushLiveStatus(`Кампания: ${missionId} ${title}${repLabel}: ❌ поражение (обычный бой)`);
                        }
                    } catch (e2) {
                        const cls2 = classifyError(e2);
                        lFail(`обычный бой ${missionId} ошибка: kind=${cls2.kind} msg=${cls2.text.split('\n')[0]}`);
                        if (cls2.kind === 'no_energy') {
                            stats.failed++;
                            pushLiveStatus(`Кампания: ${missionId} ${title}: ⚡ нет энергии (обычный бой)`);
                            stopReason = `⚡ не хватает энергии на миссию ${missionId} ${title}`;
                            break outer;
                        }
                        stats.failed++;
                        pushLiveStatus(`Кампания: ${missionId} ${title}: ошибка (обычный бой)`);
                    }
                    break;
                }

                if (cls.kind === 'no_energy') {
                    stats.failed++;
                    lStop(`нет энергии на миссию ${missionId}`);
                    pushLiveStatus(`Кампания: ${missionId} ${title}: ⚡ нет энергии`);
                    stopReason = `⚡ не хватает энергии на миссию ${missionId} ${title}`;
                    break outer;
                }
                if (cls.kind === 'no_attempts') {
                    stats.failed++;
                    lStop(`нет попыток на миссию ${missionId}`);
                    pushLiveStatus(`Кампания: ${missionId} ${title}: нет попыток`);
                    stopReason = `🚫 нет попыток на миссию ${missionId} ${title}`;
                    break outer;
                }
                if (cls.kind === 'locked') {
                    stats.failed++;
                    lStop(`миссия ${missionId} заблокирована`);
                    pushLiveStatus(`Кампания: ${missionId} ${title}: миссия заблокирована`);
                    stopReason = `🚫 миссия ${missionId} ${title} недоступна`;
                    break outer;
                }

                stats.failed++;
                lFail(`ошибка ${missionId}: ${cls.text.split('\n')[0]}`);
                pushLiveStatus(`Кампания: ${missionId} ${title}: ошибка`);
                if (settings.stopOnDefeat) {
                    stopReason = `💥 ошибка на миссии ${missionId} ${title}: ${cls.text.slice(0, 200)}`;
                    break outer;
                }
            } finally {
                stopLiveStatus(false);
            }

            if (!done) {
                if (settings.stopOnDefeat) {
                    stopReason = `❌ поражение на миссии ${missionId} ${title}`;
                    lStop(`поражение — остановка (stopOnDefeat=true)`);
                    break outer;
                } else {
                    stats.skipped++;
                    lWarn(`поражение — пропускаю (stopOnDefeat=false)`);
                }
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }

    campaignRunning = false;
    if (!stopReason) {
        stopReason = stats.failed
            ? `✅ достигнута последняя миссия ${last} (было ошибок: ${stats.failed})`
            : `✅ достигнута последняя миссия ${last}`;
    }

    lInfo('════════════════════════════════════════════');
    lInfo(`ИТОГ: пройдено=${stats.passed} (рейдов=${stats.raided}, боёв=${stats.combats}), ошибок=${stats.failed}, пропущено=${stats.skipped}, текущая=${stats.current}`);
    if (stopReason.startsWith('✅')) lOk(stopReason);
    else if (stopReason.startsWith('⏹')) lStop(stopReason);
    else lFail(stopReason);
    lInfo('════════════════════════════════════════════');

    const summary = `Кампания: ✓ ${stats.passed}, рейдов ${stats.raided}, ошибок ${stats.failed}<br>${stopReason}`;
    stopLiveStatus(true, summary, () => HWHFuncs.hideProgress(0));
}

/* ===== Диалог настроек ===== */
async function openCampaignDialog() {
    if (campaignRunning) {
        HWHFuncs.setProgress('Кампания уже идёт. Кликните по статусу сверху, чтобы остановить.', 5000);
        return;
    }
    const s = loadSettings();
    const lastAttempt = loadLastAttempt();
    lInfo('открыт диалог настроек, текущие:', s, 'lastAttempt:', lastAttempt);

    HWHFuncs.popup.customPopup((complete) => {
        HWHFuncs.popup.setMsgText('Настройки кампании');
        const showShortcut = !!(lastAttempt?.id && lastAttempt.id !== s.firstMissionId);
        const shortcutDefaultLabel = showShortcut
            ? `↩ Начать с ${lastAttempt.id} ${lastAttempt.title ? '«' + lastAttempt.title + '»' : ''} (прошлый запуск)`
            : '';
        HWHFuncs.popup.custom.innerHTML = `
            <div style="padding: 6px 14px 10px; color: #fce1ac; font: 600 14px sans-serif; min-width: 340px;">
                ${showShortcut ? `<div style="margin-bottom:10px;"><button id="cShortcut" type="button" style="cursor:pointer;background:#2a63c6;border:1px solid #5a90e8;color:#fff;padding:5px 10px;border-radius:6px;font-weight:700;">${shortcutDefaultLabel}</button></div>` : ''}
                <div style="margin-bottom: 10px;">
                    <label>Первая миссия:
                        <input id="cFirst" type="number" min="1" value="${s.firstMissionId}"
                            style="width: 80px; background:#170d07;color:#fce1ac;border:1px solid #cf9250;border-radius:5px;padding:3px 6px;margin-left:6px;"/>
                    </label>
                    <div id="cFirstTitle" style="font-size:12px;opacity:0.75;margin-top:3px;margin-left:8px;"></div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label>Последняя миссия:
                        <input id="cLast" type="number" min="1" value="${s.lastMissionId}"
                            style="width: 80px; background:#170d07;color:#fce1ac;border:1px solid #cf9250;border-radius:5px;padding:3px 6px;margin-left:6px;"/>
                    </label>
                    <div id="cLastTitle" style="font-size:12px;opacity:0.75;margin-top:3px;margin-left:8px;"></div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label>Повторов на миссию:
                        <input id="cRep" type="number" min="1" value="${s.repeatPerMission}"
                            style="width:60px;background:#170d07;color:#fce1ac;border:1px solid #cf9250;border-radius:5px;padding:3px 6px;margin-left:6px;"/>
                    </label>
                </div>
                <div style="margin: 10px 0 6px;">
                    <label><input id="cRaid" type="checkbox" ${s.useRaidIfPossible ? 'checked' : ''}/> Использовать рейд на 3★-миссиях</label>
                </div>
                <div style="margin-bottom: 8px;">
                    <label><input id="cStop" type="checkbox" ${s.stopOnDefeat ? 'checked' : ''}/> Останавливаться при поражении/ошибке</label>
                </div>
                <div style="margin-top:8px;font-size:12px;opacity:0.7;">
                    Настройки сохраняются автоматически. Если «первая» миссия недоступна, старт начнётся с первой непройденной. При лимите рейдов (геройские миссии) скрипт пройдёт миссию обычным боем.
                </div>
            </div>
        `;

        const firstInput = document.getElementById('cFirst');
        const lastInput  = document.getElementById('cLast');
        const repInput   = document.getElementById('cRep');
        const raidInput  = document.getElementById('cRaid');
        const stopInput  = document.getElementById('cStop');
        const firstTitle = document.getElementById('cFirstTitle');
        const lastTitle  = document.getElementById('cLastTitle');

        const readCurrent = () => ({
            firstMissionId: Math.max(1, parseInt(firstInput.value, 10) || s.firstMissionId),
            lastMissionId: Math.max(1, parseInt(lastInput.value, 10) || s.lastMissionId),
            repeatPerMission: Math.max(1, parseInt(repInput.value, 10) || 1),
            useRaidIfPossible: !!raidInput.checked,
            stopOnDefeat: !!stopInput.checked,
        });
        const normalizeLast = () => {
            const cur = readCurrent();
            return { ...cur, lastMissionId: Math.max(cur.firstMissionId, cur.lastMissionId) };
        };

        const updateTitles = () => {
            const f = parseInt(firstInput.value, 10);
            const l = parseInt(lastInput.value, 10);
            const tf = f > 0 ? getMissionTitle(f) : null;
            const tl = l > 0 ? getMissionTitle(l) : null;
            firstTitle.textContent = f > 0 ? (tf ? `→ ${tf}` : '→ название недоступно') : '';
            lastTitle.textContent  = l > 0 ? (tl ? `→ ${tl}` : '→ название недоступно') : '';
        };

        const shortcutBtn = document.getElementById('cShortcut');
        const refreshShortcutState = () => {
            if (!shortcutBtn) return;
            const curFirst = parseInt(firstInput.value, 10);
            if (curFirst === lastAttempt.id) {
                shortcutBtn.disabled = true;
                shortcutBtn.style.opacity = '0.55';
                shortcutBtn.style.cursor = 'default';
                shortcutBtn.textContent = `✓ первая миссия = ${lastAttempt.id}`;
            } else {
                shortcutBtn.disabled = false;
                shortcutBtn.style.opacity = '1';
                shortcutBtn.style.cursor = 'pointer';
                shortcutBtn.textContent = shortcutDefaultLabel;
            }
        };
        const updateTitlesAndShortcut = () => {
            updateTitles();
            refreshShortcutState();
        };

        let saveTimer = null;
        const scheduleSave = () => {
            updateTitlesAndShortcut();
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                saveSettings(normalizeLast());
            }, 300);
        };

        firstInput.addEventListener('input', scheduleSave);
        lastInput.addEventListener('input', scheduleSave);
        repInput.addEventListener('input', scheduleSave);
        raidInput.addEventListener('change', scheduleSave);
        stopInput.addEventListener('change', scheduleSave);

        if (shortcutBtn) {
            shortcutBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                if (shortcutBtn.disabled) return;
                lInfo(`шорткат: первая миссия → ${lastAttempt.id}`);
                firstInput.value = String(lastAttempt.id);
                scheduleSave();
            });
        }

        updateTitlesAndShortcut();

        HWHFuncs.popup.addButton(
            { msg: 'Запуск', result: true, color: 'green' },
            () => {
                if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
                const ns = normalizeLast();
                saveSettings(ns);
                HWHFuncs.popup.hide();
                complete(ns);
            }
        );
        HWHFuncs.popup.addButton(
            { msg: 'Отмена', result: false, isCancel: true, color: 'red' },
            () => {
                if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
                saveSettings(normalizeLast());
                lInfo('диалог настроек: отмена (изменения всё равно сохранены)');
                HWHFuncs.popup.hide();
                complete(false);
            }
        );
        HWHFuncs.popup.show();
    }).then((ns) => {
        if (ns && ns.firstMissionId) {
            HWHFuncs.setProgress('Кампания: старт...', 3000);
            runCampaign(ns);
        }
    });
}

/* ===== Одна кнопка ===== */
function installActionButtons() {
    const arr = HWHData.actionsPopupButtons;
    if (!arr) return false;
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] && (arr[i].__campaign || arr[i].__campaignContinue || arr[i].__campaignReset)) arr.splice(i, 1);
    }
    arr.push({
        __campaign: true,
        get msg() { return 'Кампания'; },
        get title() { return 'Автопрохождение кампании (подробные логи в консоли, настройки и последняя позиция запоминаются)'; },
        result() { openCampaignDialog(); },
        color: 'green',
    });
    lInfo('кнопка "Кампания" добавлена в "Действия"');
    return true;
}

/* ===== Патч «Сделать всё» ===== */
function patchDoYourBest() {
    const Original = HWHClasses.doYourBest;
    if (!Original) return false;
    if (Original.__campaignPatched || globalThis.__HWHCampaign_doYourBestPatched) return true;
    class Patched extends Original {
        constructor(...args) {
            super(...args);
            this.funcList = (this.funcList || []).filter(f => f.name !== 'campaignAuto');
            const idx = this.funcList.findIndex(f => f.name === 'testDungeon');
            const item = { name: 'campaignAuto', label: 'Кампания (авто)', checked: false };
            if (idx >= 0) this.funcList.splice(idx + 1, 0, item);
            else this.funcList.push(item);
            if (!this.functions) this.functions = {};
            this.functions.campaignAuto = async () => { await runCampaign(loadSettings()); };
        }
    }
    Patched.__campaignPatched = true;
    HWHClasses.doYourBest = Patched;
    globalThis.__HWHCampaign_doYourBestPatched = true;
    lInfo('галочка "Кампания" добавлена в "Сделать всё"');
    return true;
}

let buttonsInstalled = false, doYourBestPatched = false;
function tryInstallAll() {
    if (!buttonsInstalled) buttonsInstalled = installActionButtons();
    if (!doYourBestPatched) doYourBestPatched = patchDoYourBest();
    return buttonsInstalled && doYourBestPatched;
}
tryInstallAll();

let attempts = 0;
const maxAttempts = 120;
const retryTimer = setInterval(() => {
    attempts++;
    if (tryInstallAll() || attempts >= maxAttempts) {
        clearInterval(retryTimer);
        if (buttonsInstalled && doYourBestPatched) lOk(`v${GM_info.script.version} готов`);
        else lWarn('не удалось установить элементы за 60 сек');
    }
}, 500);

try { HWHFuncs.Events.on('startGame', () => {
    lInfo('событие startGame — переустанавливаю кнопки');
    buttonsInstalled = false;
    doYourBestPatched = false;
    tryInstallAll();
}); } catch (e) {}

} /* boot */
boot();
})();
