document.addEventListener('DOMContentLoaded', () => {
    // ---------- Font Loading: Wait for custom fonts before showing text ----------
    function initFontLoading() {
        // Check if Font Loading API is supported
        if (document.fonts && document.fonts.load) {
            // Load the title fonts
            const fontPromises = [
                document.fonts.load('1em "Yuji Syuku"'),
                document.fonts.load('1em "Cardo"'),
                document.fonts.load('1em "Noto Serif SC"')
            ];
            
            Promise.all(fontPromises).then(() => {
                document.documentElement.classList.add('fonts-loaded');
            }).catch(() => {
                // Fallback: show text anyway after timeout
                setTimeout(() => {
                    document.documentElement.classList.add('fonts-loaded');
                }, 500);
            });
            
            // Fallback: always show after 1.5s even if fonts not loaded
            setTimeout(() => {
                document.documentElement.classList.add('fonts-loaded');
            }, 1500);
        } else {
            // Browser doesn't support Font Loading API, show immediately
            document.documentElement.classList.add('fonts-loaded');
        }
    }
    initFontLoading();

    // ---------- 共享：从 <pre> 提取纯文本（支持 .line 或 innerHTML） ----------
    function getCodeFromPre(preEl) {
        if (!preEl) return '';
        const lines = preEl.querySelectorAll('.line');
        if (lines.length > 0) return Array.from(lines).map((l) => l.textContent).join('\n');
        const html = preEl.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || preEl.textContent || '';
    }

    // ========== Lunar Calendar & Festival Easter Eggs ==========
    // Lunar calendar data 1900-2100 (compressed)
    const lunarInfo = [
        0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
        0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
        0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
        0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
        0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
        0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,
        0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
        0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
        0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
        0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
        0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
        0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
        0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
        0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
        0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
        0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
        0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
        0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
        0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
        0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
        0x0d520
    ];

    // Get lunar month days
    function lunarMonthDays(y, m) {
        return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29;
    }

    // Get lunar year days
    function lunarYearDays(y) {
        let sum = 348;
        for (let i = 0x8000; i > 0x8; i >>= 1) {
            sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
        }
        return sum + leapDays(y);
    }

    // Get leap month (0 if none)
    function leapMonth(y) {
        return lunarInfo[y - 1900] & 0xf;
    }

    // Get leap month days
    function leapDays(y) {
        if (leapMonth(y)) {
            return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
        }
        return 0;
    }

    // Convert solar to lunar
    function solarToLunar(y, m, d) {
        const baseDate = new Date(1900, 0, 31);
        const targetDate = new Date(y, m - 1, d);
        let offset = Math.floor((targetDate - baseDate) / 86400000);
        
        let lunarYear = 1900;
        let daysInYear;
        for (; lunarYear < 2101 && offset > 0; lunarYear++) {
            daysInYear = lunarYearDays(lunarYear);
            offset -= daysInYear;
        }
        if (offset < 0) {
            offset += daysInYear;
            lunarYear--;
        }

        const leap = leapMonth(lunarYear);
        let isLeap = false;
        let lunarMonth = 1;
        let daysInMonth;
        for (; lunarMonth < 13 && offset > 0; lunarMonth++) {
            if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) {
                --lunarMonth;
                isLeap = true;
                daysInMonth = leapDays(lunarYear);
            } else {
                daysInMonth = lunarMonthDays(lunarYear, lunarMonth);
            }
            if (isLeap && lunarMonth === (leap + 1)) isLeap = false;
            offset -= daysInMonth;
        }
        if (offset < 0) {
            offset += daysInMonth;
            --lunarMonth;
        }
        const lunarDay = offset + 1;

        return { year: lunarYear, month: lunarMonth, day: lunarDay, isLeap };
    }

    // Festival config: { month, day, text, color, bgLight, bgDark }
    const festivals = [
        { month: 1, day: 1, text: '福', color: '#c41e3a', bgLight: '#fff5f5', bgDark: '#3d2a2a' },
        { month: 1, day: 15, text: '元', color: '#ff6b35', bgLight: '#fff8f0', bgDark: '#3d3028' },
        { month: 5, day: 5, text: '糯', color: '#5c8a4d', bgLight: '#f5fff5', bgDark: '#2a3d2a' },
        { month: 7, day: 7, text: '缘', color: '#e75480', bgLight: '#fff5f8', bgDark: '#3d2a32' },
        { month: 8, day: 15, text: '月', color: '#d4a017', bgLight: '#fffcf0', bgDark: '#3d3828' },
        { month: 9, day: 9, text: '菊', color: '#9b59b6', bgLight: '#faf5ff', bgDark: '#352a3d' },
        { month: 12, day: 30, text: '除', color: '#c41e3a', bgLight: '#fff5f5', bgDark: '#3d2a2a' },
        { month: 12, day: 29, text: '除', color: '#c41e3a', bgLight: '#fff5f5', bgDark: '#3d2a2a' },
    ];

    // Solar term only displays for 1-2 days when entering (default theme most of the time)
    const SOLAR_TERM_DISPLAY_DAYS = 2;

    // Solar terms data: { name, month, day, color, bgLight, bgDark, desc }
    const solarTerms = [
        { name: '立春', month: 2, day: 4, color: '#7cb342', bgLight: '#f5faf0', bgDark: '#2a332a', desc: 'Beginning of Spring' },
        { name: '雨水', month: 2, day: 19, color: '#5dade2', bgLight: '#f0f8fc', bgDark: '#28333d', desc: 'Rain Water' },
        { name: '惊蛰', month: 3, day: 5, color: '#d4a574', bgLight: '#faf5f0', bgDark: '#332f2a', desc: 'Awakening of Insects' },
        { name: '春分', month: 3, day: 20, color: '#52c41a', bgLight: '#f5fff0', bgDark: '#283328', desc: 'Spring Equinox' },
        { name: '清明', month: 4, day: 5, color: '#13c2c2', bgLight: '#f0fafa', bgDark: '#283333', desc: 'Pure Brightness' },
        { name: '谷雨', month: 4, day: 20, color: '#8fbc8f', bgLight: '#f5faf5', bgDark: '#2a332a', desc: 'Grain Rain' },
        { name: '立夏', month: 5, day: 5, color: '#2e7d32', bgLight: '#f0faf0', bgDark: '#283328', desc: 'Beginning of Summer' },
        { name: '小满', month: 5, day: 21, color: '#f5a623', bgLight: '#fffaf0', bgDark: '#333028', desc: 'Grain Buds' },
        { name: '芒种', month: 6, day: 6, color: '#e6b800', bgLight: '#fffcf0', bgDark: '#333328', desc: 'Grain in Ear' },
        { name: '夏至', month: 6, day: 21, color: '#ff6b6b', bgLight: '#fff5f5', bgDark: '#332a2a', desc: 'Summer Solstice' },
        { name: '小暑', month: 7, day: 7, color: '#ff8c42', bgLight: '#fff8f0', bgDark: '#332f28', desc: 'Minor Heat' },
        { name: '大暑', month: 7, day: 23, color: '#e74c3c', bgLight: '#fff5f5', bgDark: '#332a2a', desc: 'Major Heat' },
        { name: '立秋', month: 8, day: 7, color: '#d4a017', bgLight: '#fffcf0', bgDark: '#333328', desc: 'Beginning of Autumn' },
        { name: '处暑', month: 8, day: 23, color: '#daa520', bgLight: '#fffaf0', bgDark: '#333228', desc: 'End of Heat' },
        { name: '白露', month: 9, day: 7, color: '#b0c4de', bgLight: '#f5f8fc', bgDark: '#2a3033', desc: 'White Dew' },
        { name: '秋分', month: 9, day: 23, color: '#f0e68c', bgLight: '#fffff0', bgDark: '#333328', desc: 'Autumn Equinox' },
        { name: '寒露', month: 10, day: 8, color: '#778899', bgLight: '#f5f5f8', bgDark: '#2a2a30', desc: 'Cold Dew' },
        { name: '霜降', month: 10, day: 23, color: '#a9a9a9', bgLight: '#f8f8f8', bgDark: '#2d2d2d', desc: 'Frost Descent' },
        { name: '立冬', month: 11, day: 7, color: '#5f9ea0', bgLight: '#f0f8f8', bgDark: '#283333', desc: 'Beginning of Winter' },
        { name: '小雪', month: 11, day: 22, color: '#e8e8e8', bgLight: '#fafafa', bgDark: '#2d2d2d', desc: 'Minor Snow' },
        { name: '大雪', month: 12, day: 7, color: '#d3d3d3', bgLight: '#f8f8f8', bgDark: '#2d2d2d', desc: 'Major Snow' },
        { name: '冬至', month: 12, day: 21, color: '#2c3e50', bgLight: '#f5f5f8', bgDark: '#282a30', desc: 'Winter Solstice' },
        { name: '小寒', month: 1, day: 5, color: '#b0e0e6', bgLight: '#f5fafc', bgDark: '#283033', desc: 'Minor Cold' },
        { name: '大寒', month: 1, day: 20, color: '#4682b4', bgLight: '#f0f5fa', bgDark: '#282833', desc: 'Major Cold' }
    ];

    // Get current solar term based on date (only within 1-2 days of term date)
    function getCurrentSolarTerm(date = new Date()) {
        const sorted = [...solarTerms].sort((a, b) => {
            if (a.month !== b.month) return a.month - b.month;
            return a.day - b.day;
        });

        for (let i = sorted.length - 1; i >= 0; i--) {
            const term = sorted[i];
            let termDate = new Date(date.getFullYear(), term.month - 1, term.day);
            if (termDate > date) termDate.setFullYear(termDate.getFullYear() - 1);

            if (date >= termDate) {
                const daysSince = Math.floor((date - termDate) / 86400000);
                if (daysSince < SOLAR_TERM_DISPLAY_DAYS) {
                    return { current: term, next: sorted[(i + 1) % sorted.length] };
                }
                break;
            }
        }
        return { current: null, next: sorted[0] };
    }

    // Check for festival (returns null if no festival today)
    function checkFestival() {
        const now = new Date();
        const lunar = solarToLunar(now.getFullYear(), now.getMonth() + 1, now.getDate());
        
        for (const f of festivals) {
            if (lunar.month === f.month && lunar.day === f.day) {
                if (f.month === 12 && (f.day === 30 || f.day === 29)) {
                    const daysInMonth = lunarMonthDays(lunar.year, 12);
                    if (lunar.day === daysInMonth) return f;
                } else {
                    return f;
                }
            }
        }
        return null;
    }

    // Unified theme application (for both festival and solar term)
    function applyTheme(theme) {
        if (!theme) return;
        
        const sealEl = document.getElementById('darkModeToggleSeal');
        
        // Update seal text
        if (sealEl) {
            const textEl = sealEl.querySelector('.seal-text');
            if (textEl && theme.text) {
                textEl.textContent = theme.text;
            } else if (textEl && theme.name) {
                textEl.textContent = theme.name.charAt(0);
            }
        }
        
        // Apply CSS variables
        document.documentElement.style.setProperty('--color-seal', theme.color);
        document.documentElement.style.setProperty('--festival-bg-light', theme.bgLight);
        document.documentElement.style.setProperty('--festival-bg-dark', theme.bgDark);
        
        // Add body class
        document.body.classList.add('festival-bg');
        
        // Store for debug
        window.__SHIRO_CURRENT_THEME__ = theme;
        
        if (window.__SHIRO_DEBUG__) {
            console.log(`[Theme] Applied: ${theme.name || theme.text} - Color: ${theme.color}`);
        }
    }

    // Main init: festival > solar term (festival: 1 day; solar term: 1-2 days only)
    function initTheme() {
        const festival = checkFestival();
        
        if (festival) {
            applyTheme(festival);
            window.__SHIRO_SOLAR_TERM__ = null;
        } else {
            const { current } = getCurrentSolarTerm();
            if (current) {
                window.__SHIRO_SOLAR_TERM__ = current;
                applyTheme(current);
            } else {
                window.__SHIRO_SOLAR_TERM__ = null;
                // Default theme when neither festival nor solar term
            }
        }
    }

    initTheme();

    // ========== Debug Tool ==========
    window.shiroDebug = {
        // Get current solar term info
        getSolarTerm() {
            const { current, next } = getCurrentSolarTerm();
            const now = new Date();
            const nextDate = new Date(now.getFullYear(), next.month - 1, next.day);
            if (nextDate < now) nextDate.setFullYear(nextDate.getFullYear() + 1);
            const daysUntilNext = Math.ceil((nextDate - now) / 86400000);

            console.log('╔════════════════════════════════════════╗');
            console.log('║         节气主题 Debug 信息           ║');
            console.log('╠════════════════════════════════════════╣');
            console.log(`║ 当前节气: ${(current ? current.name : '(无)').padEnd(20)} ║`);
            if (current) {
                console.log(`║ 英文: ${current.desc.padEnd(23)} ║`);
                console.log(`║ 主题色: ${current.color.padEnd(21)} ║`);
            }
            console.log(`║ 下个节气: ${next.name.padEnd(20)} ║`);
            console.log(`║ 剩余天数: ${daysUntilNext.toString().padEnd(20)} ║`);
            console.log('╚════════════════════════════════════════╝');
            return { current, next, daysUntilNext };
        },
        
        // Preview specific solar term
        preview(name) {
            const term = solarTerms.find(t => t.name === name);
            if (!term) {
                console.error(`[Debug] 节气 "${name}" 不存在。可用节气：`, solarTerms.map(t => t.name).join(', '));
                return;
            }
            
            window.__SHIRO_SOLAR_TERM__ = term;
            applyTheme(term);
            console.log(`[Debug] Previewing: ${term.name} (${term.color})`);
            return term;
        },
        
        // Preview festival
        festival(name) {
            const f = festivals.find(f => f.text === name || f.name === name);
            if (!f) {
                console.error(`[Debug] 节日 "${name}" 不存在。可用节日：`, festivals.map(f => f.text).join(', '));
                return;
            }
            window.__SHIRO_SOLAR_TERM__ = null;
            applyTheme(f);
            console.log(`[Debug] Previewing festival: ${f.text}`);
            return f;
        },
        
        // List all solar terms
        list() {
            console.log('24节气列表:');
            solarTerms.forEach((term, i) => {
                const marker = term.name === window.__SHIRO_SOLAR_TERM__?.name ? '★' : ' ';
                console.log(` ${marker} ${(i+1).toString().padStart(2)}. ${term.name} (${term.month}/${term.day}) - ${term.color}`);
            });
            return solarTerms;
        },
        
        // Cycle through all solar terms (for testing)
        cycle(interval = 2000) {
            let index = 0;
            console.log('[Debug] Starting theme cycle...');
            
            const intervalId = setInterval(() => {
                const term = solarTerms[index];
                this.preview(term.name);
                index = (index + 1) % solarTerms.length;
            }, interval);
            
            window.__SHIRO_CYCLE_ID__ = intervalId;
            console.log('[Debug] Cycle started. Call shiroDebug.stopCycle() to stop.');
            
            return intervalId;
        },
        
        stopCycle() {
            if (window.__SHIRO_CYCLE_ID__) {
                clearInterval(window.__SHIRO_CYCLE_ID__);
                console.log('[Debug] Cycle stopped.');
                initTheme();
            }
        },
        
        // Enable/disable debug mode
        enable() {
            window.__SHIRO_DEBUG__ = true;
            console.log('[Debug] Debug mode enabled.');
            this.getSolarTerm();
        },
        
        disable() {
            window.__SHIRO_DEBUG__ = false;
            console.log('[Debug] Debug mode disabled.');
        }
    };

    // Auto-enable debug in development (localhost)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        window.shiroDebug.enable();
    }

    // ========== Dark Mode Toggle (seal button) ==========
    const DARK_KEY = 'shiro-dark-mode';
    const toggleSeal = document.getElementById('darkModeToggleSeal');

    function isDark() {
        return document.documentElement.classList.contains('dark');
    }

    function setDark(enabled, persist = true) {
        if (enabled) {
            document.documentElement.classList.add('dark');
            if (persist) try { localStorage.setItem(DARK_KEY, '1'); } catch (_) {}
        } else {
            document.documentElement.classList.remove('dark');
            if (persist) try { localStorage.setItem(DARK_KEY, '0'); } catch (_) {}
        }
        if (toggleSeal) toggleSeal.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    function toggleDark() {
        setDark(!isDark());
    }

    // Init: localStorage > prefers-color-scheme > time (19:00-07:00 dark). Time-based does not persist.
    (function initDark() {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(DARK_KEY) : null;
        if (stored === '1') setDark(true);
        else if (stored === '0') setDark(false);
        else if (window.matchMedia) {
            const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const light = window.matchMedia('(prefers-color-scheme: light)').matches;
            if (dark) setDark(true, false);
            else if (light) setDark(false, false);
            else {
                const h = new Date().getHours();
                setDark(h >= 19 || h < 7, false);
            }
        } else {
            const h = new Date().getHours();
            setDark(h >= 19 || h < 7, false);
        }
    })();

    if (toggleSeal) {
        const sealInner = toggleSeal.querySelector('.seal-inner');
        toggleSeal.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            if (btn.classList.contains('seal-spinning')) return;
            btn.classList.add('seal-spinning');
            toggleDark();
            const onEnd = () => {
                btn.classList.remove('seal-spinning');
                if (sealInner) sealInner.removeEventListener('animationend', onEnd);
            };
            if (sealInner) sealInner.addEventListener('animationend', onEnd);
        });
    }

    // Menu Logic (mobile dropdown)
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuChevron = document.getElementById('menuChevron');

    if (menuBtn && mobileMenu && menuChevron) {
        const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function setMenuOpen(open) {
            mobileMenu.dataset.open = open ? "true" : "false";
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            menuChevron.style.transform = (open && !prefersReduced) ? 'rotate(180deg)' : (prefersReduced ? 'none' : 'rotate(0deg)');
        }

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setMenuOpen(mobileMenu.dataset.open !== "true");
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setMenuOpen(false);
        });

        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
                setMenuOpen(false);
            }
        });
    }

    // TOC Floating Button Logic
    const tocBtn = document.getElementById('tocFab');
    const tocPanel = document.getElementById('tocPanel');
    const tocOverlay = document.getElementById('tocOverlay');
    const tocFabGroup = document.getElementById('tocFabGroup');
    const toTopBtn = document.getElementById('toTopBtn');

    if (tocBtn && tocPanel && tocFabGroup) {
        const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Hover expand logic: only tocFab triggers expand, group mouseleave collapses
        tocBtn.addEventListener('mouseenter', () => {
            tocFabGroup.classList.add('expanded');
        });
        tocFabGroup.addEventListener('mouseleave', () => {
            tocFabGroup.classList.remove('expanded');
        });

        // Positioning: keep the FAB fixed to the viewport but aligned to the right edge of the main 'paper' container.
        const paperEl = document.querySelector('.paper');

        // Progress ring
        const progressRing = tocBtn.querySelector('.toc-progress-ring-fill');
        const tocFabIcon = tocBtn.querySelector('.toc-icon');
        const circumference = 2 * Math.PI * 15; // r=15
        let fontsReady = false;

        function updateReadingProgress() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = docHeight > 0 ? scrollTop / docHeight : 0;

            if (progressRing) {
                const offset = circumference - (progress * circumference);
                progressRing.style.strokeDashoffset = offset;
            }

            // 阅读到底后，中心图标变为「完」字（完読＝读完），字体与印章/标题一致（Yuji Syuku 等）
            // 仅在字体加载完成后更新文字，避免字体闪烁
            if (tocFabIcon && fontsReady) {
                if (progress >= 0.9) {
                    tocFabIcon.textContent = '完';
                    tocFabIcon.classList.add('toc-icon--read');
                } else if (progress >= 0.4 && progress < 0.6) {
                    tocFabIcon.textContent = '半';
                    tocFabIcon.classList.add('toc-icon--read');
                } else if (progress >= 0.1 && progress < 0.2) {
                    tocFabIcon.textContent = '始';
                    tocFabIcon.classList.add('toc-icon--read');
                } else {
                    tocFabIcon.textContent = '☰';
                    tocFabIcon.classList.remove('toc-icon--read');
                }
            }
        }
        
        // Wait for fonts to load before updating text
        function waitForFonts(callback) {
            if (document.fonts && document.fonts.load) {
                const fonts = ['1em "Yuji Syuku"', '1em "Cardo"', '1em "Noto Serif SC"'];
                Promise.all(fonts.map(f => document.fonts.load(f).catch(() => true)))
                    .then(() => {
                        fontsReady = true;
                        document.documentElement.classList.add('fonts-loaded');
                        callback();
                    })
                    .catch(() => {
                        fontsReady = true;
                        document.documentElement.classList.add('fonts-loaded');
                        callback();
                    });
            } else {
                fontsReady = true;
                document.documentElement.classList.add('fonts-loaded');
                callback();
            }
        }
        
        waitForFonts(() => {
            // Set default icon after fonts loaded
            if (tocFabIcon && !tocFabIcon.textContent) {
                tocFabIcon.textContent = '☰';
            }
            updateReadingProgress();
        });

        function updateFabPosition() {
            try {
                // default margin from paper's right edge
                const margin = 16; // px
                if (!paperEl) {
                    // fallback: keep 1rem from viewport right
                    tocFabGroup.style.right = '1rem';
                    tocPanel.style.right = '1rem';
                    tocFabGroup.classList.remove('toc-fab-unpositioned');
                    return;
                }

                const rect = paperEl.getBoundingClientRect();
                // distance from paper's right edge to viewport right edge
                const offsetRight = Math.max(12, Math.round(window.innerWidth - rect.right));
                const rightPx = offsetRight + margin;
                tocFabGroup.style.right = rightPx + 'px';
                tocPanel.style.right = rightPx + 'px';
                // Constrain TOC button within paper boundaries
                const fabHeight = tocBtn.offsetHeight || 35;
                const fabBottomMargin = 16; // default 1rem
                const minTop = 16; // minimum distance from paper top
                // Calculate ideal bottom position
                let bottomPos = fabBottomMargin;
                // Check if paper bottom is above viewport bottom
                const paperBottom = rect.bottom;
                const viewportHeight = window.innerHeight;

                if (paperBottom < viewportHeight) {
                    // Paper's bottom is visible, constrain button to not go below it
                    const maxBottom = viewportHeight - paperBottom;
                    bottomPos = Math.max(maxBottom + fabBottomMargin, fabBottomMargin);
                }

                // Check if button would go above paper's top
                const buttonTop = viewportHeight - bottomPos - fabHeight;
                if (buttonTop < rect.top + minTop) {
                    // Adjust to stay below paper's top
                    bottomPos = viewportHeight - rect.top - minTop - fabHeight;
                }

                // Hide button if paper is completely out of view or too small
                if (rect.bottom < 0 || rect.top > viewportHeight || rect.height < fabHeight + minTop + fabBottomMargin) {
                    tocFabGroup.style.opacity = '0';
                    tocFabGroup.style.pointerEvents = 'none';
                } else {
                    tocFabGroup.style.opacity = '1';
                    tocFabGroup.style.pointerEvents = 'auto';
                }

                tocFabGroup.style.bottom = bottomPos + 'px';
                // Keep panel aligned with button
                tocPanel.style.bottom = (bottomPos + fabHeight + 12) + 'px';

                // overlay should cover the paper area — position it relative to viewport so make it full screen
                if (tocOverlay) {
                    // keep overlay fixed to viewport to cover entire screen for easier click-to-close
                    tocOverlay.style.position = 'fixed';
                }

                // 首次定位完成后才显示，避免先出现在视口右下角再跳动
                tocFabGroup.classList.remove('toc-fab-unpositioned');
            } catch (e) {
                // ignore positioning errors
            }
        }

        // TOC scroll-spy: highlight the item for the section currently in view
        const tocLinks = tocPanel.querySelectorAll('.toc a[href^="#"]');
        const articleEl = document.querySelector('.prose-shiro') || document.querySelector('.content-article');

        function updateTocActive() {
            if (!articleEl || tocLinks.length === 0) return;
            const headings = articleEl.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
            if (headings.length === 0) return;
            const threshold = 120; // px from top of viewport: heading "current" when above this
            let currentId = null;
            for (let i = 0; i < headings.length; i++) {
                const top = headings[i].getBoundingClientRect().top;
                if (top <= threshold) currentId = headings[i].id;
            }
            tocLinks.forEach((a) => {
                const href = a.getAttribute('href') || '';
                const id = href === '#' ? '' : href.slice(1);
                if (id === currentId) {
                    a.classList.add('toc-active');
                    a.setAttribute('aria-current', 'location');
                } else {
                    a.classList.remove('toc-active');
                    a.removeAttribute('aria-current');
                }
            });
        }

        // update on load/resize/scroll（load 时再算一次；scroll 用 rAF 节流，一帧只算一次）
        window.addEventListener('resize', updateFabPosition, { passive: true });
        window.addEventListener('load', updateFabPosition);
        let scrollRaf = null;
        window.addEventListener('scroll', () => {
            if (scrollRaf != null) return;
            scrollRaf = requestAnimationFrame(() => {
                updateFabPosition();
                updateReadingProgress();
                updateTocActive();
                scrollRaf = null;
            });
        }, { passive: true });
        // run once now
        updateFabPosition();
        updateReadingProgress();
        updateTocActive();

        function setTocOpen(open) {
            tocPanel.dataset.open = open ? "true" : "false";
            if (tocOverlay) tocOverlay.dataset.open = open ? "true" : "false";
            tocBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            tocPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }

        tocBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = tocPanel.dataset.open === "true";
            setTocOpen(!isOpen);
        });

        if (tocOverlay) {
            tocOverlay.addEventListener('click', () => setTocOpen(false));
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setTocOpen(false);
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!tocBtn.contains(e.target) && !tocPanel.contains(e.target)) {
                setTocOpen(false);
            }
        });

        // To Top button
        if (toTopBtn) {
            toTopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
            });
        }

        // Helper: convert table to markdown (shared)
        const extractTable = (tableEl) => {
            const rows = tableEl.querySelectorAll('tr');
            if (rows.length === 0) return '';
            let md = '\n\n';
            let isFirstRow = true;
            rows.forEach((row) => {
                const cells = row.querySelectorAll('th, td');
                if (cells.length === 0) return;
                const cellTexts = Array.from(cells).map(c => c.textContent.trim().replace(/\|/g, '\\|'));
                md += '| ' + cellTexts.join(' | ') + ' |\n';
                if (isFirstRow) {
                    md += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                    isFirstRow = false;
                }
            });
            return md + '\n';
        };

        // Helper: extract article content (shared between AI and Copy buttons)
        const extractArticleContent = () => {
            const articleEl = document.querySelector('.prose-shiro') || document.querySelector('article') || document.querySelector('main');
            if (!articleEl) return '';

            const clone = articleEl.cloneNode(true);
            clone.querySelectorAll('.gutter, .line-number, td.gutter, .copy-btn').forEach(el => el.remove());

            const extractContent = (node) => {
                let result = '';
                for (const child of node.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        result += child.textContent;
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const tag = child.tagName.toLowerCase();
                        if (child.classList?.contains('copy-btn')) continue;
                        if (/^h[1-6]$/.test(tag)) {
                            const level = parseInt(tag.charAt(1));
                            const hashes = '#'.repeat(level);
                            result += `\n\n${hashes} ${child.textContent.trim()}\n\n`;
                        } else if (tag === 'table' && !child.closest('.highlight')) {
                            result += extractTable(child);
                        } else if (tag === 'pre') {
                            const code = getCodeFromPre(child).trim();
                            result += `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
                        } else if (child.classList?.contains('highlight')) {
                            const pre = child.querySelector('pre');
                            if (pre) {
                                const code = getCodeFromPre(pre).trim();
                                result += `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
                            }
                        } else if (tag === 'code' && child.parentElement?.tagName.toLowerCase() !== 'pre') {
                            result += `\`${child.textContent}\``;
                        } else if (tag === 'p') {
                            result += `\n${child.textContent}\n`;
                        } else if (tag === 'li') {
                            result += `\n- ${child.textContent}`;
                        } else if (tag === 'br') {
                            result += '\n';
                        } else if (tag === 'button') {
                            continue;
                        } else {
                            result += extractContent(child);
                        }
                    }
                }
                return result;
            };

            return extractContent(clone).replace(/\n{3,}/g, '\n\n').trim();
        };

        // Copy Article button
        const copyArticleBtn = document.getElementById('copyArticleBtn');
        if (copyArticleBtn) {
            copyArticleBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const content = extractArticleContent();
                    await navigator.clipboard.writeText(content);
                    
                    const icon = copyArticleBtn.querySelector('.toc-icon');
                    const originalText = icon.textContent;
                    icon.textContent = '✓';
                    setTimeout(() => { icon.textContent = originalText; }, 1500);
                } catch (err) {
                    console.error('Failed to copy article:', err);
                }
            });
        }

        // Ask AI button
        const askAiBtn = document.getElementById('askAiBtn');
        if (askAiBtn) {
            askAiBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const content = extractArticleContent();
                    
                    const lang = navigator.language || navigator.userLanguage || 'en';
                    const isChinese = lang.startsWith('zh');
                    const prompt = isChinese
                        ? `我正在阅读一篇博客文章，帮我总结它。完整内容如下：\n\n${content}\n\n`
                        : `I'm reading a blog article. Help me summarize it. Here's the content:\n\n${content}\n\n`;
                    
                    await navigator.clipboard.writeText(prompt);
                    
                    const icon = askAiBtn.querySelector('.toc-icon');
                    const originalText = icon.textContent;
                    icon.textContent = '✓';
                    
                    setTimeout(() => {
                        icon.textContent = originalText;
                        window.open('https://chatgpt.com/', '_blank');
                    }, 1000);
                } catch (err) {
                    console.error('Failed to copy article:', err);
                }
            });
        }
    }

    // Code Copy Functionality
    document.querySelectorAll('.prose-shiro .highlight').forEach((block) => {
        if (block.querySelector('.copy-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        block.appendChild(btn);

        btn.onclick = async () => {
            try {
                const codePre = block.querySelector('.code pre') || block.querySelector('.highlight pre') || block.querySelector('pre');
                const code = getCodeFromPre(codePre) || block.querySelector('pre')?.textContent || '';
                await navigator.clipboard.writeText(code);
                btn.textContent = '✓';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = 'Copy';
                    btn.classList.remove('copied');
                }, 2000);
            } catch (e) {
                btn.textContent = '✗';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            }
        };
    });
});
