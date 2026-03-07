document.addEventListener('DOMContentLoaded', () => {
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
        { month: 1, day: 1, text: '福', color: '#c41e3a', bgLight: '#fff5f5', bgDark: '#3d2a2a' },      // 春节 - 中国红
        { month: 1, day: 15, text: '元', color: '#ff6b35', bgLight: '#fff8f0', bgDark: '#3d3028' },    // 元宵 - 橙色
        { month: 5, day: 5, text: '糯', color: '#5c8a4d', bgLight: '#f5fff5', bgDark: '#2a3d2a' },     // 端午 - 粟绿
        { month: 7, day: 7, text: '缘', color: '#e75480', bgLight: '#fff5f8', bgDark: '#3d2a32' },     // 七夕 - 粉红
        { month: 8, day: 15, text: '月', color: '#d4a017', bgLight: '#fffcf0', bgDark: '#3d3828' },    // 中秋 - 金色
        { month: 9, day: 9, text: '菊', color: '#9b59b6', bgLight: '#faf5ff', bgDark: '#352a3d' },     // 重阳 - 紫色
        { month: 12, day: 30, text: '除', color: '#c41e3a', bgLight: '#fff5f5', bgDark: '#3d2a2a' },   // 除夕 - 中国红
        { month: 12, day: 29, text: '除', color: '#c41e3a', bgLight: '#fff5f5', bgDark: '#3d2a2a' },   // 除夕(小月) - 中国红
    ];

    // Check if today is a festival and apply easter egg
    function applyFestivalEasterEgg() {
        const sealEl = document.getElementById('darkModeToggleSeal');
        if (!sealEl) return;

        const now = new Date();
        const lunar = solarToLunar(now.getFullYear(), now.getMonth() + 1, now.getDate());
        
        // Check for festival (special handling for 除夕: check if 腊月三十 exists)
        let festival = null;
        for (const f of festivals) {
            if (lunar.month === f.month && lunar.day === f.day) {
                // For 除夕, verify it's actually the last day of the year
                if (f.month === 12 && (f.day === 30 || f.day === 29)) {
                    const daysInMonth = lunarMonthDays(lunar.year, 12);
                    if (lunar.day === daysInMonth) {
                        festival = f;
                        break;
                    }
                } else {
                    festival = f;
                    break;
                }
            }
        }

        if (festival) {
            // Update seal text
            const textEl = sealEl.querySelector('.seal-text');
            if (textEl) textEl.textContent = festival.text;
            
            // Update seal color
            document.documentElement.style.setProperty('--color-seal', festival.color);
            
            // Update background color
            document.documentElement.style.setProperty('--festival-bg-light', festival.bgLight);
            document.documentElement.style.setProperty('--festival-bg-dark', festival.bgDark);
            document.body.classList.add('festival-bg');
        }
    }

    // Apply festival easter egg on load
    applyFestivalEasterEgg();

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
        const circumference = 2 * Math.PI * 15; // r=15

        function updateReadingProgress() {
            if (!progressRing) return;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = docHeight > 0 ? scrollTop / docHeight : 0;
            const offset = circumference - (progress * circumference);
            progressRing.style.strokeDashoffset = offset;
        }

        function updateFabPosition() {
            try {
                // default margin from paper's right edge
                const margin = 16; // px
                if (!paperEl) {
                    // fallback: keep 1rem from viewport right
                    tocFabGroup.style.right = '1rem';
                    tocPanel.style.right = '1rem';
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
            } catch (e) {
                // ignore positioning errors
            }
        }

        // update on load/resize/scroll
        window.addEventListener('resize', updateFabPosition, { passive: true });
        window.addEventListener('scroll', () => {
            updateFabPosition();
            updateReadingProgress();
        }, { passive: true });
        // run once now
        updateFabPosition();
        updateReadingProgress();

        function setTocOpen(open) {
            tocPanel.dataset.open = open ? "true" : "false";
            if (tocOverlay) tocOverlay.dataset.open = open ? "true" : "false";
            tocBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            tocPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
            // simple transform for icon (no chevron here) - keep accessible
            if (!prefersReduced) {
                // no visual icon rotation needed for this icon
            }
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

        // Helper: extract code with preserved newlines (shared)
        const extractCode = (preEl) => {
            const lines = preEl.querySelectorAll('.line');
            if (lines.length > 0) {
                return Array.from(lines).map(l => l.textContent).join('\n');
            }
            const html = preEl.innerHTML.replace(/<br\s*\/?>/gi, '\n');
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || preEl.textContent;
        };

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
                            const code = extractCode(child).trim();
                            result += `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
                        } else if (child.classList?.contains('highlight')) {
                            const pre = child.querySelector('pre');
                            if (pre) {
                                const code = extractCode(pre).trim();
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
                const codePre = block.querySelector('.code pre') || block.querySelector('.highlight pre');
                let code = '';
                if (codePre) {
                    const lines = codePre.querySelectorAll('.line');
                    if (lines.length) {
                        code = Array.from(lines).map(l => l.textContent).join('\n');
                    } else {
                        const html = codePre.innerHTML.replace(/<br\s*\/?>/gi, '\n');
                        const div = document.createElement('div');
                        div.innerHTML = html;
                        code = div.textContent || '';
                    }
                }
                if (!code) code = block.querySelector('pre')?.textContent || '';
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
