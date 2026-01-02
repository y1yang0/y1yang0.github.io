---
title: "Cyber Cricket Fighting of Ancient Chinese Emperors"
date: 2026-02-12
categories: [Misc]
---

A playful comparison of ancient Chinese emperors - their reigns, achievements, and dynasties. Think of it as another form of cyber cricket fighting, where historical figures compete not in strength, but in legacy and influence across millennia.

<!-- more -->

<style>
:root {
    --color-seal-red: #b91c1c;
    --color-ink-black: #111827;
    --color-border: #e5e7eb;
    --color-text-secondary: #6b7280;
    --color-bg-light: #f9fafb;
}

/* Container */
.emperor-table-container {
    margin-top: 32px;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

/* Table Wrapper */
.table-wrapper {
    overflow-x: auto;
}

/* Table */
.emperor-table {
    width: 100%;
    border-collapse: collapse;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-size: 13px;
    background: white;
    margin: 0;
    display: table;
}

/* Table Header */
.emperor-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--color-ink-black);
}

.emperor-table thead tr:first-child th:first-child {
    border-top-left-radius: 16px;
}

.emperor-table thead tr:first-child th:last-child {
    border-top-right-radius: 16px;
}

.emperor-table th {
    padding: 10px 6px;
    text-align: left;
    color: white;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.08em;
    border: none;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: all 0.2s ease;
    line-height: 1.2;
}

.emperor-table th:hover {
    background: rgba(185, 28, 28, 0.2);
}

.emperor-table th.sortable::after {
    content: '⇅';
    margin-left: 6px;
    opacity: 0.4;
    font-size: 10px;
}

.emperor-table th.sort-asc::after {
    content: '↑';
    opacity: 1;
    color: var(--color-seal-red);
}

.emperor-table th.sort-desc::after {
    content: '↓';
    opacity: 1;
    color: var(--color-seal-red);
}

/* Table Body */
.emperor-table tbody tr {
    transition: all 0.2s ease;
    border-bottom: 1px solid #f1f5f9;
    height: 28px;
}

.emperor-table tbody tr:nth-child(even) {
    background: #fafafa;
}

.emperor-table tbody tr:hover {
    background: linear-gradient(90deg, #fef2f2 0%, #fff 100%);
    box-shadow: 0 1px 3px rgba(185, 28, 28, 0.1);
    transform: translateX(2px);
}

.emperor-table tbody tr.rank-1 {
    background: linear-gradient(90deg, #fef3c7 0%, #fffbeb 100%);
}

.emperor-table tbody tr.rank-2 {
    background: linear-gradient(90deg, #f3f4f6 0%, #fafafa 100%);
}

.emperor-table tbody tr.rank-3 {
    background: linear-gradient(90deg, #fed7aa 0%, #ffedd5 100%);
}

.emperor-table tbody tr:last-child {
    border-bottom: none;
}

.emperor-table tbody tr:last-child td:first-child {
    border-bottom-left-radius: 16px;
}

.emperor-table tbody tr:last-child td:last-child {
    border-bottom-right-radius: 16px;
}

.emperor-table td {
    padding: 6px 8px;
    vertical-align: middle;
    line-height: 1.2;
    height: 36px;
}

.emperor-table td:nth-child(11) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Column widths */
.emperor-table th:nth-child(1),
.emperor-table td:nth-child(1) {
    width: 35px;
    text-align: center;
}

.emperor-table th:nth-child(4),
.emperor-table td:nth-child(4) {
    width: 35px;
    text-align: center;
}

.emperor-table th:nth-child(5),
.emperor-table td:nth-child(5) {
    width: 45px;
    text-align: center;
}

.emperor-table th:nth-child(6),
.emperor-table th:nth-child(7),
.emperor-table th:nth-child(8),
.emperor-table th:nth-child(9),
.emperor-table th:nth-child(10),
.emperor-table td:nth-child(6),
.emperor-table td:nth-child(7),
.emperor-table td:nth-child(8),
.emperor-table td:nth-child(9),
.emperor-table td:nth-child(10) {
    width: 40px;
    text-align: center;
}

.emperor-table th:nth-child(11),
.emperor-table td:nth-child(11) {
    max-width: 300px;
    overflow: hidden;
}

/* Rank Badge */
.rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 10px;
}

.rank-1 .rank-badge {
    background: #fbbf24;
    color: #78350f;
    box-shadow: 0 0 0 2px #fef3c7;
}

.rank-2 .rank-badge {
    background: #d1d5db;
    color: #374151;
    box-shadow: 0 0 0 2px #f3f4f6;
}

.rank-3 .rank-badge {
    background: #fb923c;
    color: #7c2d12;
    box-shadow: 0 0 0 2px #ffedd5;
}

.rank-badge.normal {
    background: var(--color-bg-light);
    color: var(--color-text-secondary);
    font-weight: 600;
}

/* Dynasty Badge */
.dynasty-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: var(--color-seal-red);
    color: white;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(185, 28, 28, 0.3);
    line-height: 1.2;
}

/* Name */
.emperor-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 13px;
    white-space: nowrap;
}

/* Reign Years */
.reign-years {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

/* Score Value */
.score-value {
    font-weight: 700;
    color: var(--color-ink-black);
    font-size: 12px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.score-value.high {
    color: var(--color-ink-black);
    font-weight: 800;
}

.score-value.medium {
    color: var(--color-text-secondary);
}

.score-value.low {
    color: #9ca3af;
}

/* Total Score */
.total-score {
    font-size: 15px;
    font-weight: 800;
    color: var(--color-seal-red);
    text-align: center;
    font-variant-numeric: tabular-nums;
}

/* Description */
.emperor-desc {
    color: #64748b;
    line-height: 1.3;
    font-size: 12px;
    display: block;
    width: 100%;
    font-weight: 400;
}

/* Dynasty Chart */
.dynasty-chart-container {
    margin-top: 32px;
    background: white;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    overflow: hidden;
}

.dynasty-chart-header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border);
    font-size: 14px;
    font-weight: 700;
    color: var(--color-ink-black);
}

.dynasty-chart-body {
    padding: 16px 12px 8px 12px;
    overflow-x: auto;
}

.dynasty-chart-body svg {
    display: block;
}

.chart-tooltip {
    position: fixed;
    background: #1f2937;
    color: #f3f4f6;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    line-height: 1.5;
    pointer-events: none;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 200px;
    white-space: nowrap;
}

.dynasty-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    padding: 10px 20px 14px;
    border-top: 1px solid var(--color-border);
}

.dynasty-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: opacity 0.2s;
}

.dynasty-legend-item:hover {
    opacity: 0.7;
}

.dynasty-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .emperor-table {
        font-size: 11px;
    }
    
    .emperor-table th,
    .emperor-table td {
        padding: 6px 4px;
    }
    
    .emperor-desc {
        max-width: 180px;
        font-size: 11px;
    }
    
    .total-score {
        font-size: 14px;
    }
    
    .rank-badge {
        width: 22px;
        height: 22px;
        font-size: 11px;
    }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
    .emperor-table-container {
        background: #1f2937;
        border-color: rgba(255, 255, 255, 0.1);
    }
    
    .emperor-table {
        background: #1f2937;
    }
    
    .emperor-table tbody tr:nth-child(even) {
        background: #1a1f2e;
    }
    
    .emperor-table tbody tr:hover {
        background: linear-gradient(90deg, #7f1d1d 0%, #1f2937 100%);
    }
    
    .emperor-name {
        color: #f9fafb;
    }
    
    .emperor-desc {
        color: #9ca3af;
    }
    
    .score-value {
        color: #d1d5db;
    }
    
    .score-value.high {
        color: #f9fafb;
    }
}
</style>

<div id="app">
    <div class="emperor-table-container">
        <div class="table-wrapper">
            <table class="emperor-table">
                <thead>
                    <tr>
                        <th data-sort="rank">排名</th>
                        <th data-sort="name">姓名</th>
                        <th style="position:relative;cursor:default;">朝代 <span id="dynastyFilterBtn" style="cursor:pointer;font-size:10px;opacity:0.7;">▼</span><div id="dynastyDropdown" style="display:none;position:absolute;top:100%;left:0;z-index:99;background:#1f2937;border:1px solid rgba(255,255,255,0.15);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-height:240px;overflow-y:auto;min-width:70px;"></div></th>
                        <th data-sort="years" class="sortable">年</th>
                        <th data-sort="total" class="sortable sort-desc">总分</th>
                        <th data-sort="govern" class="sortable">治国</th>
                        <th data-sort="military" class="sortable">军事</th>
                        <th data-sort="welfare" class="sortable">民生</th>
                        <th data-sort="innovation" class="sortable">创新</th>
                        <th data-sort="charm" class="sortable">魅力</th>
                        <th>评价</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 40px; color: #9ca3af;">
                            载入史册...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div class="dynasty-chart-container">
        <div class="dynasty-chart-header">朝代兴衰曲线</div>
        <div class="dynasty-chart-body" id="dynastyChartBody"></div>
    </div>
</div>
<div class="chart-tooltip" id="chartTooltip"></div>

<script>
/**
 * ==========================================
 * 1. 数据配置 (Data)
 * ==========================================
 */
const emperors = [
    // 秦朝
    { name: "秦始皇 · 嬴政", dynasty: "秦", reign: "前246–前210", desc: "首位皇帝，统一六国，书同文车同轨，修筑长城，奠定中央集权制度。", scores: { govern: 98, military: 98, welfare: 72, innovation: 99, charm: 98 } },
    { name: "秦二世 · 胡亥", dynasty: "秦", reign: "前210–前207", desc: "赵高的傀儡，指鹿为马都不敢反驳，3年把老爸的江山败光。", scores: { govern: 8, military: 10, welfare: 0, innovation: 5, charm: 5 } },
    { name: "秦三世 · 子婴", dynasty: "秦", reign: "前207", desc: "秦朝最后一位君主，在位仅46天，向刘邦投降。", scores: { govern: 5, military: 5, welfare: 0, innovation: 0, charm: 10 } },
    
    // 西汉
    { name: "汉高祖 · 刘邦", dynasty: "西汉", reign: "前202–前195", desc: "汉朝开国皇帝，平民出身，推翻秦朝，建立汉朝。", scores: { govern: 86, military: 80, welfare: 78, innovation: 72, charm: 90 } },
    { name: "汉惠帝 · 刘盈", dynasty: "西汉", reign: "前195–前188", desc: "高祖长子，仁弱，实权掌握在吕后手中。", scores: { govern: 48, military: 40, welfare: 50, innovation: 55, charm: 45 } },
    { name: "汉文帝 · 刘恒", dynasty: "西汉", reign: "前180–前157", desc: "文景之治的开创者，轻徭薄赋，与民休息。", scores: { govern: 88, military: 70, welfare: 92, innovation: 80, charm: 88 } },
    { name: "汉景帝 · 刘启", dynasty: "西汉", reign: "前157–前141", desc: "继续推行文帝政策，平定七国之乱，巩固中央集权。", scores: { govern: 85, military: 78, welfare: 80, innovation: 75, charm: 82 } },
    { name: "汉武帝 · 刘彻", dynasty: "西汉", reign: "前141–前87", desc: "雄才大略，击败匈奴，开通丝路，罢黜百家独尊儒术，开创盛世。", scores: { govern: 93, military: 99, welfare: 82, innovation: 94, charm: 96 } },
    { name: "汉昭帝 · 刘弗陵", dynasty: "西汉", reign: "前87–前74", desc: "武帝少子，继续推行休养生息政策。", scores: { govern: 73, military: 65, welfare: 72, innovation: 70, charm: 70 } },
    { name: "汉宣帝 · 刘询", dynasty: "西汉", reign: "前74–前49", desc: "中兴之主，综合儒法治国，开创孝宣中兴。", scores: { govern: 89, military: 83, welfare: 87, innovation: 85, charm: 87 } },
    { name: "汉元帝 · 刘奭", dynasty: "西汉", reign: "前49–前33", desc: "柔仁好儒，但外戚宦官干政加剧。", scores: { govern: 58, military: 50, welfare: 60, innovation: 75, charm: 55 } },
    { name: "汉成帝 · 刘骜", dynasty: "西汉", reign: "前33–前7", desc: "耽于享乐，外戚王氏势力坐大。", scores: { govern: 45, military: 40, welfare: 45, innovation: 60, charm: 42 } },
    { name: "汉哀帝 · 刘欣", dynasty: "西汉", reign: "前7–前1", desc: "试图限制外戚，但能力有限。", scores: { govern: 47, military: 42, welfare: 50, innovation: 55, charm: 45 } },
    { name: "汉平帝 · 刘衎", dynasty: "西汉", reign: "前1–6", desc: "年幼即位，王莽实际掌权。", scores: { govern: 33, military: 30, welfare: 35, innovation: 40, charm: 31 } },
    
    // 新朝
    { name: "王莽", dynasty: "新", reign: "9–23", desc: "被后世怀疑是穿越者的改革狂人，各种超前政策把自己玩死了。", scores: { govern: 40, military: 45, welfare: 35, innovation: 95, charm: 53 } },
    
    // 东汉
    { name: "汉光武帝 · 刘秀", dynasty: "东汉", reign: "25–57", desc: "史上学历最高的皇帝，完美的「位面之子」，以柔道治天下。", scores: { govern: 95, military: 90, welfare: 95, innovation: 82, charm: 96 } },
    { name: "汉明帝 · 刘庄", dynasty: "东汉", reign: "57–75", desc: "明章之治的开创者，经学兴盛。", scores: { govern: 87, military: 80, welfare: 87, innovation: 90, charm: 85 } },
    { name: "汉章帝 · 刘炟", dynasty: "东汉", reign: "75–88", desc: "继续明帝政策，东汉鼎盛时期。", scores: { govern: 84, military: 78, welfare: 85, innovation: 88, charm: 82 } },
    { name: "汉和帝 · 刘肇", dynasty: "东汉", reign: "88–105", desc: "除窦宪，但宦官势力开始抬头。", scores: { govern: 73, military: 75, welfare: 72, innovation: 78, charm: 72 } },
    { name: "汉安帝 · 刘祜", dynasty: "东汉", reign: "106–125", desc: "外戚宦官斗争激烈，朝政混乱。", scores: { govern: 53, military: 52, welfare: 50, innovation: 60, charm: 51 } },
    { name: "汉顺帝 · 刘保", dynasty: "东汉", reign: "125–144", desc: "宦官势力达到顶峰。", scores: { govern: 50, military: 50, welfare: 48, innovation: 55, charm: 49 } },
    { name: "汉桓帝 · 刘志", dynasty: "东汉", reign: "146–168", desc: "党锢之祸起，朝政腐败。", scores: { govern: 48, military: 48, welfare: 45, innovation: 52, charm: 47 } },
    { name: "汉灵帝 · 刘宏", dynasty: "东汉", reign: "168–189", desc: "开创性地把当皇帝搞成电商模式，明码标价卖官，把东汉活生生卖没了。", scores: { govern: 8, military: 10, welfare: 0, innovation: 15, charm: 7 } },
    { name: "汉献帝 · 刘协", dynasty: "东汉", reign: "189–220", desc: "傀儡皇帝，先后被董卓、曹操控制，最终禅让给曹丕。", scores: { govern: 3, military: 0, welfare: 0, innovation: 20, charm: 5 } },
    
    // 三国·魏
    { name: "魏文帝 · 曹丕", dynasty: "曹魏", reign: "220–226", desc: "曹操之子，迫汉献帝禅让，建立魏国。", scores: { govern: 73, military: 78, welfare: 70, innovation: 82, charm: 75 } },
    { name: "魏明帝 · 曹叡", dynasty: "曹魏", reign: "226–239", desc: "抵御蜀汉北伐，但奢侈好大喜功。", scores: { govern: 67, military: 72, welfare: 65, innovation: 75, charm: 68 } },
    { name: "魏齐王 · 曹芳", dynasty: "曹魏", reign: "239–254", desc: "傀儡皇帝，司马氏掌权。", scores: { govern: 5, military: 0, welfare: 5, innovation: 25, charm: 5 } },
    { name: "魏高贵乡公 · 曹髦", dynasty: "曹魏", reign: "254–260", desc: "试图反抗司马昭，被杀。", scores: { govern: 38, military: 30, welfare: 35, innovation: 50, charm: 37 } },
    { name: "魏元帝 · 曹奂", dynasty: "曹魏", reign: "260–265", desc: "禅让给司马炎，魏国灭亡。", scores: { govern: 29, military: 28, welfare: 30, innovation: 35, charm: 28 } },
    
    // 三国·蜀
    { name: "汉昭烈帝 · 刘备", dynasty: "蜀汉", reign: "221–223", desc: "汉室宗亲，三顾茅庐得诸葛亮，建立蜀汉政权。", scores: { govern: 73, military: 82, welfare: 78, innovation: 70, charm: 77 } },
    { name: "汉怀帝 · 刘禅", dynasty: "蜀汉", reign: "223–263", desc: "「乐不思蜀」成语创始人，有诸葛亮当保姆时还行，自己玩就拉胯。", scores: { govern: 38, military: 32, welfare: 38, innovation: 45, charm: 35 } },
    
    // 三国·吴
    { name: "吴大帝 · 孙权", dynasty: "东吴", reign: "229–252", desc: "据江东，联蜀抗魏，善用人才。", scores: { govern: 80, military: 85, welfare: 80, innovation: 75, charm: 82 } },
    { name: "吴废帝 · 孙亮", dynasty: "东吴", reign: "252–258", desc: "年幼即位，被孙綝废黜。", scores: { govern: 33, military: 30, welfare: 32, innovation: 38, charm: 31 } },
    { name: "吴景帝 · 孙休", dynasty: "东吴", reign: "258–264", desc: "诛杀权臣孙綝，但在位短暂。", scores: { govern: 53, military: 48, welfare: 50, innovation: 52, charm: 53 } },
    { name: "吴末帝 · 孙皓", dynasty: "东吴", reign: "264–280", desc: "暴虐无道，最终投降西晋。", scores: { govern: 28, military: 28, welfare: 22, innovation: 28, charm: 27 } },
    
    // 西晋
    { name: "晋武帝 · 司马炎", dynasty: "西晋", reign: "265–290", desc: "建立晋朝，统一三国，但为八王之乱埋下隐患。", scores: { govern: 81, military: 85, welfare: 75, innovation: 78, charm: 81 } },
    { name: "晋惠帝 · 司马衷", dynasty: "西晋", reign: "290–306", desc: "「何不食肉糜」千古名言创作者，智商感人，成功把西晋玩崩盘。", scores: { govern: 8, military: 0, welfare: 5, innovation: 10, charm: 5 } },
    { name: "晋怀帝 · 司马炽", dynasty: "西晋", reign: "306–313", desc: "被匈奴汉国俘虏杀害。", scores: { govern: 24, military: 22, welfare: 20, innovation: 28, charm: 24 } },
    { name: "晋愍帝 · 司马邺", dynasty: "西晋", reign: "313–316", desc: "西晋最后皇帝，被俘后遇害。", scores: { govern: 21, military: 20, welfare: 18, innovation: 25, charm: 21 } },
    
    // 东晋
    { name: "晋元帝 · 司马睿", dynasty: "东晋", reign: "317–322", desc: "琅琊王，在江南重建晋朝。", scores: { govern: 63, military: 58, welfare: 62, innovation: 70, charm: 63 } },
    { name: "晋明帝 · 司马绍", dynasty: "东晋", reign: "322–325", desc: "平定王敦之乱，巩固皇权。", scores: { govern: 70, military: 72, welfare: 70, innovation: 70, charm: 71 } },
    { name: "晋成帝 · 司马衍", dynasty: "东晋", reign: "325–342", desc: "年幼即位，由母后和权臣辅政。", scores: { govern: 51, military: 48, welfare: 50, innovation: 60, charm: 50 } },
    { name: "晋康帝 · 司马岳", dynasty: "东晋", reign: "342–344", desc: "在位短暂，庾氏专权。", scores: { govern: 47, military: 42, welfare: 45, innovation: 55, charm: 45 } },
    { name: "晋穆帝 · 司马聃", dynasty: "东晋", reign: "344–361", desc: "桓温北伐，收复部分失地。", scores: { govern: 59, military: 60, welfare: 58, innovation: 65, charm: 59 } },
    { name: "晋哀帝 · 司马丕", dynasty: "东晋", reign: "361–365", desc: "在位短暂，桓温势力强大。", scores: { govern: 44, military: 40, welfare: 42, innovation: 50, charm: 42 } },
    { name: "晋废帝 · 司马奕", dynasty: "东晋", reign: "365–371", desc: "被桓温废黜。", scores: { govern: 31, military: 28, welfare: 30, innovation: 38, charm: 30 } },
    { name: "晋简文帝 · 司马昱", dynasty: "东晋", reign: "371–372", desc: "桓温立，在位不足一年。", scores: { govern: 47, military: 42, welfare: 45, innovation: 58, charm: 46 } },
    { name: "晋孝武帝 · 司马曜", dynasty: "东晋", reign: "372–396", desc: "淝水之战大胜前秦，东晋中兴。", scores: { govern: 71, military: 80, welfare: 72, innovation: 75, charm: 72 } },
    { name: "晋安帝 · 司马德宗", dynasty: "东晋", reign: "396–418", desc: "智力缺陷，朝政混乱。", scores: { govern: 3, military: 0, welfare: 0, innovation: 10, charm: 5 } },
    { name: "晋恭帝 · 司马德文", dynasty: "东晋", reign: "418–420", desc: "东晋最后皇帝，禅让给刘裕。", scores: { govern: 27, military: 25, welfare: 25, innovation: 32, charm: 26 } },
    
    // 南朝·宋
    { name: "宋武帝 · 刘裕", dynasty: "南朝宋", reign: "420–422", desc: "灭东晋建宋，两次北伐收复大片土地。", scores: { govern: 80, military: 90, welfare: 75, innovation: 68, charm: 84 } },
    { name: "宋文帝 · 刘义隆", dynasty: "南朝宋", reign: "424–453", desc: "元嘉之治，南朝文化鼎盛时期。", scores: { govern: 84, military: 72, welfare: 85, innovation: 88, charm: 81 } },
    { name: "宋孝武帝 · 刘骏", dynasty: "南朝宋", reign: "453–464", desc: "平定叛乱，但杀戮过重。", scores: { govern: 67, military: 70, welfare: 60, innovation: 70, charm: 67 } },
    { name: "宋明帝 · 刘彧", dynasty: "南朝宋", reign: "465–472", desc: "猜忌宗室，大肆杀戮。", scores: { govern: 57, military: 58, welfare: 50, innovation: 62, charm: 56 } },
    { name: "宋后废帝 · 刘昱", dynasty: "南朝宋", reign: "472–477", desc: "暴虐无道，被萧道成杀害。", scores: { govern: 23, military: 22, welfare: 18, innovation: 28, charm: 21 } },
    { name: "宋顺帝 · 刘准", dynasty: "南朝宋", reign: "477–479", desc: "禅让给萧道成，宋灭。", scores: { govern: 29, military: 28, welfare: 28, innovation: 32, charm: 28 } },
    
    // 南朝·齐
    { name: "齐高帝 · 萧道成", dynasty: "南朝齐", reign: "479–482", desc: "建立南齐，为政宽简。", scores: { govern: 74, military: 75, welfare: 72, innovation: 75, charm: 74 } },
    { name: "齐武帝 · 萧赜", dynasty: "南朝齐", reign: "482–493", desc: "继续高帝政策，齐朝相对稳定。", scores: { govern: 74, military: 70, welfare: 75, innovation: 78, charm: 72 } },
    { name: "齐明帝 · 萧鸾", dynasty: "南朝齐", reign: "494–498", desc: "篡位称帝，杀戮宗室。", scores: { govern: 49, military: 50, welfare: 42, innovation: 52, charm: 49 } },
    { name: "齐和帝 · 萧宝融", dynasty: "南朝齐", reign: "501–502", desc: "禅让给萧衍，齐灭。", scores: { govern: 27, military: 25, welfare: 25, innovation: 30, charm: 26 } },
    
    // 南朝·梁
    { name: "梁武帝 · 萧衍", dynasty: "南朝梁", reign: "502–549", desc: "在位48年，前期励精图治，晚年沉迷佛教，侯景之乱饿死台城。", scores: { govern: 77, military: 60, welfare: 75, innovation: 92, charm: 73 } },
    { name: "梁简文帝 · 萧纲", dynasty: "南朝梁", reign: "549–551", desc: "被侯景扶立，最后被杀。", scores: { govern: 37, military: 30, welfare: 35, innovation: 70, charm: 35 } },
    { name: "梁元帝 · 萧绎", dynasty: "南朝梁", reign: "552–554", desc: "平定侯景，但被西魏所灭。", scores: { govern: 53, military: 52, welfare: 50, innovation: 75, charm: 53 } },
    { name: "梁敬帝 · 萧方智", dynasty: "南朝梁", reign: "555–557", desc: "禅让给陈霸先，梁灭。", scores: { govern: 29, military: 28, welfare: 28, innovation: 35, charm: 28 } },
    
    // 南朝·陈
    { name: "陈武帝 · 陈霸先", dynasty: "南朝陈", reign: "557–559", desc: "建立陈朝，收拾残局。", scores: { govern: 69, military: 75, welfare: 68, innovation: 68, charm: 71 } },
    { name: "陈文帝 · 陈蒨", dynasty: "南朝陈", reign: "559–566", desc: "励精图治，陈朝短暂中兴。", scores: { govern: 74, military: 72, welfare: 75, innovation: 75, charm: 74 } },
    { name: "陈宣帝 · 陈顼", dynasty: "南朝陈", reign: "569–582", desc: "北伐有成，收复淮南。", scores: { govern: 69, military: 75, welfare: 70, innovation: 70, charm: 71 } },
    { name: "陈后主 · 陈叔宝", dynasty: "南朝陈", reign: "582–589", desc: "荒淫无度，作玉树后庭花，陈朝被隋所灭。", scores: { govern: 23, military: 22, welfare: 20, innovation: 65, charm: 21 } },
    
    // 北朝·北魏
    { name: "魏道武帝 · 拓跋珪", dynasty: "北魏", reign: "386–409", desc: "建立北魏，统一北方。", scores: { govern: 75, military: 85, welfare: 70, innovation: 65, charm: 79 } },
    { name: "魏太武帝 · 拓跋焘", dynasty: "北魏", reign: "423–452", desc: "统一北方，灭北燕、北凉，国势鼎盛。", scores: { govern: 82, military: 92, welfare: 75, innovation: 70, charm: 85 } },
    { name: "魏孝文帝 · 元宏", dynasty: "北魏", reign: "471–499", desc: "汉化改革，迁都洛阳，推行均田制。", scores: { govern: 88, military: 75, welfare: 85, innovation: 95, charm: 88 } },
    { name: "魏宣武帝 · 元恪", dynasty: "北魏", reign: "499–515", desc: "继续孝文帝政策，但国势渐衰。", scores: { govern: 69, military: 65, welfare: 68, innovation: 75, charm: 68 } },
    { name: "魏孝明帝 · 元诩", dynasty: "北魏", reign: "515–528", desc: "胡太后专权，最后被杀。", scores: { govern: 43, military: 42, welfare: 40, innovation: 55, charm: 41 } },
    
    // 隋朝
    { name: "隋文帝 · 杨坚", dynasty: "隋", reign: "581–604", desc: "结束三百年乱世，开创三省六部制和科举制，西方人眼中的「千古一帝」。", scores: { govern: 92, military: 85, welfare: 85, innovation: 95, charm: 85 } },
    { name: "隋炀帝 · 杨广", dynasty: "隋", reign: "604–618", desc: "基建狂魔+战争贩子，修大运河三征高句丽，把老爸攒的家底挥霍一空。", scores: { govern: 55, military: 60, welfare: 10, innovation: 90, charm: 67 } },
    { name: "隋恭帝 · 杨侑", dynasty: "隋", reign: "617–618", desc: "李渊扶立，禅让给李渊，隋亡。", scores: { govern: 27, military: 25, welfare: 25, innovation: 30, charm: 26 } },
    
    // 唐朝
    { name: "唐高祖 · 李渊", dynasty: "唐", reign: "618–626", desc: "建立唐朝，统一全国。", scores: { govern: 79, military: 85, welfare: 78, innovation: 75, charm: 81 } },
    { name: "唐太宗 · 李世民", dynasty: "唐", reign: "626–649", desc: "玄武门之变夺位，开创贞观之治，被尊为天可汗。", scores: { govern: 98, military: 97, welfare: 96, innovation: 94, charm: 98 } },
    { name: "唐高宗 · 李治", dynasty: "唐", reign: "649–683", desc: "武则天渐掌大权，疆域达到最大。", scores: { govern: 70, military: 80, welfare: 72, innovation: 78, charm: 70 } },
    { name: "唐中宗 · 李显", dynasty: "唐", reign: "683–684, 705–710", desc: "两次为帝，韦后专权。", scores: { govern: 48, military: 45, welfare: 48, innovation: 55, charm: 46 } },
    { name: "唐睿宗 · 李旦", dynasty: "唐", reign: "684–690, 710–712", desc: "两次为帝，让位给武则天和李隆基。", scores: { govern: 57, military: 52, welfare: 58, innovation: 62, charm: 55 } },
    { name: "武则天", dynasty: "武周", reign: "690–705", desc: "唯一正统女皇帝，重用酷吏，发展科举，承上启下。", scores: { govern: 87, military: 78, welfare: 82, innovation: 90, charm: 90 } },
    { name: "唐玄宗 · 李隆基", dynasty: "唐", reign: "712–756", desc: "前半生雄才伟略开创盛世，后半生沉迷美色玩坏江山，典型的虎头蛇尾案例。", scores: { govern: 65, military: 55, welfare: 70, innovation: 75, charm: 80 } },
    { name: "唐肃宗 · 李亨", dynasty: "唐", reign: "756–762", desc: "平定安史之乱，但宦官势力抬头。", scores: { govern: 64, military: 72, welfare: 60, innovation: 65, charm: 67 } },
    { name: "唐代宗 · 李豫", dynasty: "唐", reign: "762–779", desc: "继续平叛，但藩镇割据形成。", scores: { govern: 59, military: 65, welfare: 55, innovation: 62, charm: 61 } },
    { name: "唐德宗 · 李适", dynasty: "唐", reign: "779–805", desc: "试图削藩，引发叛乱，实行两税法。", scores: { govern: 69, military: 60, welfare: 62, innovation: 68, charm: 65 } },
    { name: "唐宪宗 · 李纯", dynasty: "唐", reign: "805–820", desc: "削平藩镇，元和中兴，但最后被宦官所杀。", scores: { govern: 80, military: 85, welfare: 75, innovation: 75, charm: 82 } },
    { name: "唐穆宗 · 李恒", dynasty: "唐", reign: "820–824", desc: "荒于政事，朝政混乱。", scores: { govern: 44, military: 45, welfare: 42, innovation: 50, charm: 43 } },
    { name: "唐敬宗 · 李湛", dynasty: "唐", reign: "824–826", desc: "荒淫无度，被宦官所杀。", scores: { govern: 33, military: 32, welfare: 30, innovation: 38, charm: 31 } },
    { name: "唐文宗 · 李昂", dynasty: "唐", reign: "826–840", desc: "甘露之变失败，自叹家奴。", scores: { govern: 49, military: 45, welfare: 48, innovation: 60, charm: 48 } },
    { name: "唐武宗 · 李炎", dynasty: "唐", reign: "840–846", desc: "会昌中兴，灭佛毁寺。", scores: { govern: 74, military: 75, welfare: 68, innovation: 55, charm: 74 } },
    { name: "唐宣宗 · 李忱", dynasty: "唐", reign: "846–859", desc: "大中之治，唐朝最后的中兴。", scores: { govern: 79, military: 75, welfare: 78, innovation: 75, charm: 79 } },
    { name: "唐懿宗 · 李漼", dynasty: "唐", reign: "859–873", desc: "奢侈荒淫，朝政腐败。", scores: { govern: 37, military: 38, welfare: 35, innovation: 45, charm: 36 } },
    { name: "唐僖宗 · 李儇", dynasty: "唐", reign: "873–888", desc: "黄巢起义爆发，流亡四川。", scores: { govern: 31, military: 32, welfare: 28, innovation: 38, charm: 31 } },
    { name: "唐昭宗 · 李晔", dynasty: "唐", reign: "888–904", desc: "傀儡皇帝，被朱温控制。", scores: { govern: 5, military: 0, welfare: 5, innovation: 25, charm: 5 } },
    { name: "唐哀帝 · 李柷", dynasty: "唐", reign: "904–907", desc: "唐朝最后皇帝，禅让给朱温。", scores: { govern: 3, military: 0, welfare: 0, innovation: 10, charm: 5 } },
    
    // 五代·后梁
    { name: "梁太祖 · 朱温", dynasty: "后梁", reign: "907–912", desc: "灭唐建梁，五代开始。", scores: { govern: 65, military: 80, welfare: 55, innovation: 50, charm: 70 } },
    { name: "梁末帝 · 朱友贞", dynasty: "后梁", reign: "913–923", desc: "被李存勖所灭。", scores: { govern: 44, military: 48, welfare: 40, innovation: 45, charm: 45 } },
    
    // 五代·后唐
    { name: "唐庄宗 · 李存勖", dynasty: "后唐", reign: "923–926", desc: "灭后梁，但沉迷戏曲，被叛军所杀。", scores: { govern: 53, military: 85, welfare: 48, innovation: 60, charm: 60 } },
    { name: "唐明宗 · 李嗣源", dynasty: "后唐", reign: "926–933", desc: "勤政爱民，五代明君。", scores: { govern: 77, military: 75, welfare: 78, innovation: 70, charm: 76 } },
    { name: "唐末帝 · 李从珂", dynasty: "后唐", reign: "934–936", desc: "被石敬瑭引契丹所灭。", scores: { govern: 41, military: 42, welfare: 38, innovation: 45, charm: 42 } },
    
    // 五代·后晋
    { name: "晋高祖 · 石敬瑭", dynasty: "后晋", reign: "936–942", desc: "史上最不要脸「儿皇帝」，把燕云十六州当见面礼送给契丹爹，遗祸数百年。", scores: { govern: 47, military: 55, welfare: 35, innovation: 42, charm: 49 } },
    { name: "晋出帝 · 石重贵", dynasty: "后晋", reign: "942–946", desc: "拒绝向契丹称臣，被契丹所灭。", scores: { govern: 48, military: 52, welfare: 45, innovation: 48, charm: 49 } },
    
    // 五代·后汉
    { name: "汉高祖 · 刘知远", dynasty: "后汉", reign: "947–948", desc: "建立后汉，在位仅一年。", scores: { govern: 58, military: 65, welfare: 55, innovation: 52, charm: 60 } },
    { name: "汉隐帝 · 刘承祐", dynasty: "后汉", reign: "948–950", desc: "被郭威所杀。", scores: { govern: 39, military: 40, welfare: 38, innovation: 42, charm: 40 } },
    
    // 五代·后周
    { name: "周太祖 · 郭威", dynasty: "后周", reign: "951–954", desc: "建立后周，整顿军纪。", scores: { govern: 74, military: 78, welfare: 72, innovation: 68, charm: 75 } },
    { name: "周世宗 · 柴荣", dynasty: "后周", reign: "954–959", desc: "五代最英明君主，可惜英年早逝。", scores: { govern: 89, military: 92, welfare: 88, innovation: 82, charm: 90 } },
    { name: "周恭帝 · 柴宗训", dynasty: "后周", reign: "959–960", desc: "禅让给赵匡胤，五代结束。", scores: { govern: 29, military: 28, welfare: 28, innovation: 32, charm: 28 } },
    
    // 辽朝
    { name: "辽太祖 · 耶律阿保机", dynasty: "辽", reign: "916–926", desc: "统一契丹八部，建立大辽，创制契丹文字。", scores: { govern: 85, military: 90, welfare: 70, innovation: 88, charm: 86 } },
    { name: "辽太宗 · 耶律德光", dynasty: "辽", reign: "927–947", desc: "南下灭后晋，入主中原，改国号为大辽。", scores: { govern: 75, military: 88, welfare: 60, innovation: 70, charm: 78 } },
    { name: "辽景宗 · 耶律贤", dynasty: "辽", reign: "969–982", desc: "励精图治，辽朝中兴，重用汉臣。", scores: { govern: 80, military: 75, welfare: 78, innovation: 75, charm: 80 } },
    { name: "辽圣宗 · 耶律隆绪", dynasty: "辽", reign: "982–1031", desc: "澶渊之盟，辽朝全盛时期，统和中兴。", scores: { govern: 88, military: 85, welfare: 85, innovation: 82, charm: 86 } },
    { name: "辽天祚帝 · 耶律延禧", dynasty: "辽", reign: "1101–1125", desc: "亡国之君，被金所灭。", scores: { govern: 20, military: 25, welfare: 20, innovation: 15, charm: 20 } },

    // 西夏
    { name: "夏景宗 · 李元昊", dynasty: "西夏", reign: "1038–1048", desc: "建立西夏，创西夏文，三战立国。", scores: { govern: 82, military: 90, welfare: 65, innovation: 88, charm: 84 } },
    { name: "夏仁宗 · 李仁孝", dynasty: "西夏", reign: "1139–1193", desc: "西夏盛世，确立封建制度，重文教。", scores: { govern: 85, military: 70, welfare: 80, innovation: 78, charm: 82 } },
    { name: "夏末帝 · 李睍", dynasty: "西夏", reign: "1226–1227", desc: "抵抗蒙古，城破被杀。", scores: { govern: 40, military: 60, welfare: 30, innovation: 20, charm: 45 } },

    // 金朝
    { name: "金太祖 · 完颜阿骨打", dynasty: "金", reign: "1115–1123", desc: "女真英雄，3000破10万，灭辽建金。", scores: { govern: 88, military: 99, welfare: 75, innovation: 85, charm: 92 } },
    { name: "金太宗 · 完颜吴乞买", dynasty: "金", reign: "1123–1135", desc: "灭北宋，靖康之耻的制造者。", scores: { govern: 80, military: 95, welfare: 65, innovation: 70, charm: 78 } },
    { name: "金海陵王 · 完颜亮", dynasty: "金", reign: "1150–1161", desc: "迁都燕京，极具野心但残暴，采石矶战败被杀。", scores: { govern: 65, military: 75, welfare: 40, innovation: 75, charm: 55 } },
    { name: "金世宗 · 完颜雍", dynasty: "金", reign: "1161–1189", desc: "小尧舜，大定之治，金朝巅峰。", scores: { govern: 92, military: 80, welfare: 92, innovation: 85, charm: 90 } },
    { name: "金章宗 · 完颜璟", dynasty: "金", reign: "1189–1208", desc: "文化极盛，但国势转衰，明昌之治。", scores: { govern: 70, military: 60, welfare: 70, innovation: 82, charm: 75 } },
    { name: "金哀宗 · 完颜守绪", dynasty: "金", reign: "1224–1234", desc: "虽然努力试图挽救危局，奈何积重难返，蔡州自缢。", scores: { govern: 60, military: 70, welfare: 50, innovation: 50, charm: 65 } },

    // 北宋
    { name: "宋太祖 · 赵匡胤", dynasty: "北宋", reign: "960–976", desc: "陈桥兵变黄袍加身，杯酒释兵权，结束五代十国。", scores: { govern: 89, military: 85, welfare: 88, innovation: 86, charm: 89 } },
    { name: "宋太宗 · 赵光义", dynasty: "北宋", reign: "976–997", desc: "统一全国，但北伐失败，重文轻武政策确立。", scores: { govern: 80, military: 65, welfare: 80, innovation: 85, charm: 76 } },
    { name: "宋真宗 · 赵恒", dynasty: "北宋", reign: "997–1022", desc: "澶渊之盟，岁币求和，但经济文化繁荣。", scores: { govern: 79, military: 55, welfare: 85, innovation: 90, charm: 71 } },
    { name: "宋仁宗 · 赵祯", dynasty: "北宋", reign: "1022–1063", desc: "虽然打仗不行，但百姓最幸福的时代。包拯口水喷他一脸都不生气，真正的「仁」君。", scores: { govern: 90, military: 55, welfare: 95, innovation: 85, charm: 90 } },
    { name: "宋英宗 · 赵曙", dynasty: "北宋", reign: "1063–1067", desc: "在位短暂，濮议之争。", scores: { govern: 64, military: 58, welfare: 65, innovation: 70, charm: 62 } },
    { name: "宋神宗 · 赵顼", dynasty: "北宋", reign: "1067–1085", desc: "支持王安石变法，但党争激烈。", scores: { govern: 77, military: 68, welfare: 72, innovation: 82, charm: 74 } },
    { name: "宋哲宗 · 赵煦", dynasty: "北宋", reign: "1085–1100", desc: "新旧党争持续，朝政动荡。", scores: { govern: 62, military: 60, welfare: 62, innovation: 72, charm: 60 } },
    { name: "宋徽宗 · 赵佶", dynasty: "北宋", reign: "1100–1126", desc: "顶级文艺青年，琴棋书画样样精通，治国理政一窍不通，成功从艺术家转型阶下囚。", scores: { govern: 15, military: 5, welfare: 15, innovation: 40, charm: 60 } },
    { name: "宋钦宗 · 赵桓", dynasty: "北宋", reign: "1126–1127", desc: "靖康之变被俘，北宋灭亡。", scores: { govern: 29, military: 25, welfare: 28, innovation: 40, charm: 28 } },
    
    // 南宋
    { name: "宋高宗 · 赵构", dynasty: "南宋", reign: "1127–1162", desc: "南渡建立南宋，杀岳飞，偏安一隅。", scores: { govern: 60, military: 40, welfare: 60, innovation: 75, charm: 54 } },
    { name: "宋孝宗 · 赵昚", dynasty: "南宋", reign: "1162–1189", desc: "南宋最有作为君主，乾淳之治。", scores: { govern: 85, military: 72, welfare: 85, innovation: 85, charm: 81 } },
    { name: "宋光宗 · 赵惇", dynasty: "南宋", reign: "1189–1194", desc: "精神疾病，被迫退位。", scores: { govern: 39, military: 35, welfare: 38, innovation: 50, charm: 36 } },
    { name: "宋宁宗 · 赵扩", dynasty: "南宋", reign: "1194–1224", desc: "韩侂胄北伐失败，开禧北伐。", scores: { govern: 52, military: 45, welfare: 52, innovation: 65, charm: 49 } },
    { name: "宋理宗 · 赵昀", dynasty: "南宋", reign: "1224–1264", desc: "在位40年，但朝政腐败，蒙古威胁加剧。", scores: { govern: 49, military: 42, welfare: 48, innovation: 70, charm: 46 } },
    { name: "宋度宗 · 赵禥", dynasty: "南宋", reign: "1264–1274", desc: "荒淫无度，南宋危在旦夕。", scores: { govern: 29, military: 28, welfare: 28, innovation: 45, charm: 27 } },
    { name: "宋恭帝 · 赵显", dynasty: "南宋", reign: "1274–1276", desc: "幼帝，临安陷落被俘。", scores: { govern: 3, military: 0, welfare: 0, innovation: 10, charm: 5 } },
    { name: "宋端宗 · 赵昰", dynasty: "南宋", reign: "1276–1278", desc: "流亡政权，病死。", scores: { govern: 0, military: 5, welfare: 0, innovation: 10, charm: 5 } },
    { name: "宋幼主 · 赵昺", dynasty: "南宋", reign: "1278–1279", desc: "陆秀夫背负跳海，南宋灭亡。", scores: { govern: 0, military: 0, welfare: 0, innovation: 5, charm: 5 } },
    
    // 元朝
    { name: "元世祖 · 忽必烈", dynasty: "元", reign: "1260–1294", desc: "建立元朝，灭南宋，统一中国，实行汉法。", scores: { govern: 83, military: 92, welfare: 62, innovation: 82, charm: 85 } },
    { name: "元成宗 · 铁穆耳", dynasty: "元", reign: "1294–1307", desc: "守成之君，国势尚可。", scores: { govern: 70, military: 70, welfare: 68, innovation: 70, charm: 69 } },
    { name: "元武宗 · 海山", dynasty: "元", reign: "1307–1311", desc: "挥霍无度，财政困难。", scores: { govern: 49, military: 60, welfare: 48, innovation: 58, charm: 52 } },
    { name: "元仁宗 · 爱育黎拔力八达", dynasty: "元", reign: "1311–1320", desc: "推行汉化，科举复兴。", scores: { govern: 74, military: 68, welfare: 72, innovation: 80, charm: 72 } },
    { name: "元英宗 · 硕德八剌", dynasty: "元", reign: "1320–1323", desc: "励精图治，但被刺杀。", scores: { govern: 69, military: 65, welfare: 68, innovation: 72, charm: 69 } },
    { name: "元泰定帝 · 也孙铁木儿", dynasty: "元", reign: "1323–1328", desc: "政局相对稳定。", scores: { govern: 61, military: 60, welfare: 60, innovation: 65, charm: 60 } },
    { name: "元文宗 · 图帖睦尔", dynasty: "元", reign: "1328–1329, 1329–1332", desc: "酷爱汉文化，创办奎章阁。", scores: { govern: 61, military: 58, welfare: 60, innovation: 82, charm: 61 } },
    { name: "元顺帝 · 妥懽帖睦尔", dynasty: "元", reign: "1333–1368", desc: "元朝最后皇帝，红巾军起义，逃回漠北。", scores: { govern: 37, military: 38, welfare: 32, innovation: 55, charm: 36 } },
    
    // 明朝
    { name: "明太祖 · 朱元璋", dynasty: "明", reign: "1368–1398", desc: "开局一个碗，结局坐江山。对贪官是阎王，对百姓是菩萨。", scores: { govern: 94, military: 96, welfare: 85, innovation: 88, charm: 88 } },
    { name: "明惠帝 · 朱允炆", dynasty: "明", reign: "1398–1402", desc: "削藩引发靖难之役，下落成谜。", scores: { govern: 57, military: 45, welfare: 55, innovation: 65, charm: 54 } },
    { name: "明成祖 · 朱棣", dynasty: "明", reign: "1402–1424", desc: "靖难夺位，迁都北京，郑和下西洋，永乐盛世。", scores: { govern: 90, military: 95, welfare: 85, innovation: 90, charm: 92 } },
    { name: "明仁宗 · 朱高炽", dynasty: "明", reign: "1424–1425", desc: "仁政爱民，但在位仅10月。", scores: { govern: 77, military: 70, welfare: 82, innovation: 80, charm: 76 } },
    { name: "明宣宗 · 朱瞻基", dynasty: "明", reign: "1425–1435", desc: "仁宣之治，明朝盛世。", scores: { govern: 85, military: 75, welfare: 85, innovation: 78, charm: 85 } },
    { name: "明英宗 · 朱祁镇", dynasty: "明", reign: "1435–1449, 1457–1464", desc: "土木堡之变被俘，复辟夺门之变。", scores: { govern: 45, military: 35, welfare: 45, innovation: 52, charm: 42 } },
    { name: "明代宗 · 朱祁钰", dynasty: "明", reign: "1449–1457", desc: "于谦辅佐守卫北京，但被英宗复辟推翻。", scores: { govern: 67, military: 72, welfare: 68, innovation: 65, charm: 68 } },
    { name: "明宪宗 · 朱见深", dynasty: "明", reign: "1464–1487", desc: "成化犁庭，但宠信万贵妃。", scores: { govern: 65, military: 65, welfare: 62, innovation: 70, charm: 64 } },
    { name: "明孝宗 · 朱祐樘", dynasty: "明", reign: "1487–1505", desc: "弘治中兴，明君典范，一夫一妻。", scores: { govern: 89, military: 78, welfare: 92, innovation: 85, charm: 86 } },
    { name: "明武宗 · 朱厚照", dynasty: "明", reign: "1505–1521", desc: "最爱Cosplay的皇帝，给自己封大将军头衔，把紫禁城当游乐场，玩得倒是挺开心。", scores: { govern: 40, military: 65, welfare: 35, innovation: 48, charm: 44 } },
    { name: "明世宗 · 朱厚熜", dynasty: "明", reign: "1521–1567", desc: "20年不上朝的炼丹boy，在后宫专心修仙，把朝政扔给严嵩打理。", scores: { govern: 66, military: 60, welfare: 58, innovation: 68, charm: 63 } },
    { name: "明穆宗 · 朱载坖", dynasty: "明", reign: "1567–1572", desc: "隆庆开关，经济繁荣。", scores: { govern: 75, military: 65, welfare: 72, innovation: 72, charm: 70 } },
    { name: "明神宗 · 朱翊钧", dynasty: "明", reign: "1572–1620", desc: "前期有张居正带飞，后期开启躺平模式，30年罢工不上朝，把明朝活生生耗死。", scores: { govern: 50, military: 70, welfare: 58, innovation: 50, charm: 61 } },
    { name: "明光宗 · 朱常洛", dynasty: "明", reign: "1620", desc: "29天速通皇帝职业，红丸案主角，堪称明朝最短命体验卡。", scores: { govern: 0, military: 0, welfare: 0, innovation: 10, charm: 5 } },
    { name: "明熹宗 · 朱由校", dynasty: "明", reign: "1620–1627", desc: "痴迷木工的手艺人，做家具比治国在行，把朝政外包给魏忠贤自己玩斧锯。", scores: { govern: 5, military: 10, welfare: 5, innovation: 25, charm: 5 } },
    { name: "明思宗 · 朱由检", dynasty: "明", reign: "1627–1644", desc: "勤政但多疑，煤山自缢，明朝灭亡。", scores: { govern: 49, military: 48, welfare: 42, innovation: 58, charm: 50 } },
    
    // 清朝
    { name: "清太祖 · 努尔哈赤", dynasty: "清", reign: "1616–1626", desc: "建立后金，创八旗制度。", scores: { govern: 82, military: 92, welfare: 62, innovation: 75, charm: 86 } },
    { name: "清太宗 · 皇太极", dynasty: "清", reign: "1626–1643", desc: "改国号为清，为入关奠基。", scores: { govern: 86, military: 90, welfare: 75, innovation: 78, charm: 88 } },
    { name: "清世祖 · 顺治", dynasty: "清", reign: "1643–1661", desc: "顺治帝，入关第一帝，统一全国。", scores: { govern: 74, military: 82, welfare: 70, innovation: 75, charm: 76 } },
    { name: "清圣祖 · 康熙", dynasty: "清", reign: "1661–1722", desc: "康熙帝，在位61年，平三藩收台湾，康乾盛世开端。", scores: { govern: 90, military: 92, welfare: 83, innovation: 85, charm: 90 } },
    { name: "清世宗 · 雍正", dynasty: "清", reign: "1722–1735", desc: "中国历史上最勤政的皇帝，摊丁入亩取消人头税，通过改革给康乾盛世续命。", scores: { govern: 92, military: 78, welfare: 90, innovation: 90, charm: 82 } },
    { name: "清高宗 · 乾隆", dynasty: "清", reign: "1735–1796", desc: "乾隆帝，在位60年，十全武功，但晚年奢侈腐败。", scores: { govern: 84, military: 88, welfare: 80, innovation: 90, charm: 84 } },
    { name: "清仁宗 · 嘉庆", dynasty: "清", reign: "1796–1820", desc: "嘉庆帝，诛和珅，但国势已衰。", scores: { govern: 64, military: 60, welfare: 60, innovation: 68, charm: 63 } },
    { name: "清宣宗 · 道光", dynasty: "清", reign: "1820–1850", desc: "道光帝，鸦片战争战败，签订南京条约。", scores: { govern: 47, military: 38, welfare: 42, innovation: 55, charm: 45 } },
    { name: "清文宗 · 咸丰", dynasty: "清", reign: "1850–1861", desc: "咸丰帝，太平天国运动，第二次鸦片战争，英法联军。", scores: { govern: 45, military: 30, welfare: 25, innovation: 40, charm: 25 } },
    { name: "清穆宗 · 同治", dynasty: "清", reign: "1861–1875", desc: "同治帝，慈禧垂帘听政，同光中兴。", scores: { govern: 54, military: 52, welfare: 52, innovation: 60, charm: 52 } },
    { name: "清德宗 · 光绪", dynasty: "清", reign: "1875–1908", desc: "光绪帝，戊戌变法失败，被慈禧囚禁。", scores: { govern: 54, military: 45, welfare: 50, innovation: 68, charm: 51 } },
    { name: "清宣统帝 · 宣统", dynasty: "清", reign: "1908–1912", desc: "3岁就失业的史上最年轻退休皇帝，见证了2000年帝制的终结，后来还当过伪满傀儡。", scores: { govern: 0, military: 0, welfare: 0, innovation: 10, charm: 5 } }
];


/* State */
let currentSort = { field: 'total', order: 'desc' };
let allEmperors = [];
let currentDynastyFilter = '';

/* Calculate total score */
function calculateTotal(scores) {
    return Object.values(scores).reduce((a, b) => a + b, 0);
}

/* Calculate reign years */
function calculateReignYears(reign) {
    const match = reign.match(/(前)?(\d+)[–—-](前)?(\d+)/);
    if (!match) {
        return reign.includes('–') || reign.includes('—') ? '1' : '<1';
    }
    
    const start = match[1] ? -parseInt(match[2]) : parseInt(match[2]);
    const end = match[3] ? -parseInt(match[4]) : parseInt(match[4]);
    const years = Math.abs(end - start);
    
    return years === 0 ? '<1' : years.toString();
}

/* Create score value */
function createScoreValue(value) {
    const level = value >= 80 ? 'high' : value >= 50 ? 'medium' : 'low';
    return `<span class="score-value ${level}">${value}</span>`;
}

/* Render table */
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const html = data.map((emp, index) => {
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        const rankBadgeClass = index < 3 ? '' : 'normal';
        const years = calculateReignYears(emp.reign);
        
        return `
            <tr class="${rankClass}">
                <td><span class="rank-badge ${rankBadgeClass}">${index + 1}</span></td>
                <td><span class="emperor-name">${emp.name}</span></td>
                <td><span class="dynasty-badge dynasty-${emp.dynasty}">${emp.dynasty}</span></td>
                <td><span class="reign-years">${years}</span></td>
                <td><span class="total-score">${emp.totalScore}</span></td>
                <td>${createScoreValue(emp.scores.govern)}</td>
                <td>${createScoreValue(emp.scores.military)}</td>
                <td>${createScoreValue(emp.scores.welfare)}</td>
                <td>${createScoreValue(emp.scores.innovation)}</td>
                <td>${createScoreValue(emp.scores.charm)}</td>
                <td><span class="emperor-desc" title="${emp.desc}">${emp.desc}</span></td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

/* Sort table */
function sortTable(field, forceOrder) {
    if (forceOrder) {
        currentSort.order = forceOrder;
        currentSort.field = field;
    } else if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'desc';
    }
    
    // Update header classes
    document.querySelectorAll('.emperor-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const header = document.querySelector(`th[data-sort="${field}"]`);
    if (header) {
        header.classList.add(currentSort.order === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    
    // Sort data (desc = high to low, asc = low to high)
    allEmperors.sort((a, b) => {
        let valA, valB;
        
        if (field === 'total') {
            valA = a.totalScore;
            valB = b.totalScore;
        } else if (field === 'name') {
            return currentSort.order === 'asc' 
                ? a.name.localeCompare(b.name, 'zh-CN')
                : b.name.localeCompare(a.name, 'zh-CN');
        } else if (field === 'dynasty') {
            return currentSort.order === 'asc'
                ? a.dynasty.localeCompare(b.dynasty, 'zh-CN')
                : b.dynasty.localeCompare(a.dynasty, 'zh-CN');
        } else if (field === 'years') {
            const yearsA = parseInt(calculateReignYears(a.reign)) || 0;
            const yearsB = parseInt(calculateReignYears(b.reign)) || 0;
            valA = yearsA;
            valB = yearsB;
        } else if (['govern', 'military', 'welfare', 'innovation', 'charm'].includes(field)) {
            valA = a.scores[field];
            valB = b.scores[field];
        }
        
        // desc: b - a (降序，大的在前), asc: a - b (升序，小的在前)
        return currentSort.order === 'asc' ? valA - valB : valB - valA;
    });
    
    const filtered = currentDynastyFilter
        ? allEmperors.filter(e => e.dynasty === currentDynastyFilter)
        : allEmperors;
    renderTable(filtered);
}

/* Dynasty chart colors - auto generated */
const dynastyChartColors = {};
function getDynastyColor(dynasty) {
    if (!dynastyChartColors[dynasty]) {
        // Generate a stable, visually distinct color from dynasty name hash
        let hash = 0;
        for (let i = 0; i < dynasty.length; i++) hash = dynasty.charCodeAt(i) + ((hash << 5) - hash);
        const h = ((hash % 360) + 360) % 360;
        dynastyChartColors[dynasty] = `hsl(${h}, 65%, 45%)`;
    }
    return dynastyChartColors[dynasty];
}

/* Render dynasty chart */
function renderDynastyChart() {
    const container = document.getElementById('dynastyChartBody');
    const tooltip = document.getElementById('chartTooltip');
    if (!container) return;

    // Use chronological order (original array order)
    // Filter out 新/武周, merge into adjacent dynasties for continuity
    const chartSkipDynasties = new Set(['新', '武周']);
    const data = emperors
        .filter(e => !chartSkipDynasties.has(e.dynasty))
        .map(e => {
            const mapped = { ...e, total: calculateTotal(e.scores), dynasty_orig: e.dynasty };
            if (e.dynasty === '东汉' || e.dynasty === '西汉') mapped.chartDynasty = '汉';
            else if (e.dynasty === '北宋' || e.dynasty === '南宋') mapped.chartDynasty = '宋';
            else mapped.chartDynasty = e.dynasty;
            return mapped;
        });
    const n = data.length;

    // Chart dimensions
    const pointGap = Math.max(5, Math.min(8, 1200 / n));
    const W = Math.max(800, n * pointGap + 80);
    const H = 300;
    const padL = 36, padR = 16, padT = 20, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Y scale: 0 to 500
    const yMax = 500, yMin = 0;
    const toX = i => padL + (i / (n - 1)) * chartW;
    const toY = v => padT + (1 - (v - yMin) / (yMax - yMin)) * chartH;

    // Group by chartDynasty
    const dynastyRanges = [];
    let cur = null;
    data.forEach((e, i) => {
        if (!cur || cur.dynasty !== e.chartDynasty) {
            cur = { dynasty: e.chartDynasty, start: i, end: i };
            dynastyRanges.push(cur);
        } else {
            cur.end = i;
        }
    });

    // Build SVG
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

    // Grid lines
    for (let v = 0; v <= 500; v += 100) {
        const y = toY(v);
        svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>`;
        svg += `<text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#9ca3af" font-size="9">${v}</text>`;
    }

    // Compute all points
    const pts = data.map((e, i) => ({ x: toX(i), y: toY(e.total) }));

    // Catmull-Rom to cubic bezier control points
    const yTop = toY(yMax), yBot = toY(yMin);
    const clampY = v => Math.max(yTop, Math.min(yBot, v));
    function catmullRomToBezier(p0, p1, p2, p3) {
        const t = 0.35;
        return {
            cp1x: p1.x + (p2.x - p0.x) * t / 3,
            cp1y: clampY(p1.y + (p2.y - p0.y) * t / 3),
            cp2x: p2.x - (p3.x - p1.x) * t / 3,
            cp2y: clampY(p2.y - (p3.y - p1.y) * t / 3)
        };
    }

    // Get dynasty color for a given index
    function colorAt(i) {
        for (const r of dynastyRanges) {
            if (i >= r.start && i <= r.end) return getDynastyColor(r.dynasty);
        }
        return '#6b7280';
    }

    // Dynasty background bands + labels
    dynastyRanges.forEach(range => {
        const color = getDynastyColor(range.dynasty);
        if (range.start !== range.end) {
            const x1 = toX(range.start), x2 = toX(range.end);
            svg += `<rect x="${x1}" y="${padT}" width="${x2 - x1}" height="${chartH}" fill="${color}" opacity="0.04" rx="2"/>`;
        }
        if (range.end - range.start >= 2) {
            const midIdx = Math.floor((range.start + range.end) / 2);
            svg += `<text x="${toX(midIdx)}" y="${H - 8}" text-anchor="middle" fill="${color}" font-size="9" font-weight="600" opacity="0.8">${range.dynasty}</text>`;
        }
    });

    // Draw smooth curve segment by segment, colored per dynasty
    for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(n - 1, i + 2)];
        const { cp1x, cp1y, cp2x, cp2y } = catmullRomToBezier(p0, p1, p2, p3);
        const color = colorAt(i);
        svg += `<path d="M${p1.x},${p1.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>`;
    }

    // Dots on top
    dynastyRanges.forEach(range => {
        const color = getDynastyColor(range.dynasty);
        for (let i = range.start; i <= range.end; i++) {
            const r = (i === range.start || i === range.end) ? 3 : 2;
            svg += `<circle cx="${pts[i].x}" cy="${pts[i].y}" r="${r}" fill="${color}" stroke="white" stroke-width="1" class="chart-dot" data-idx="${i}"/>`;
        }
    });

    // Reference lines: max, avg, min
    const totals = data.map(e => e.total);
    const maxVal = Math.max(...totals);
    const minVal = Math.min(...totals);
    const avg = Math.round(totals.reduce((s, v) => s + v, 0) / n);
    const maxY = toY(maxVal), avgY = toY(avg), minY = toY(minVal);
    svg += `<line x1="${padL}" y1="${maxY}" x2="${W - padR}" y2="${maxY}" stroke="#059669" stroke-width="0.7" stroke-dasharray="4,3" opacity="0.5"/>`;
    svg += `<text x="${W - padR + 2}" y="${maxY + 3}" fill="#059669" font-size="8" opacity="0.6">高${maxVal}</text>`;
    svg += `<line x1="${padL}" y1="${avgY}" x2="${W - padR}" y2="${avgY}" stroke="#b91c1c" stroke-width="0.7" stroke-dasharray="4,3" opacity="0.5"/>`;
    svg += `<text x="${W - padR + 2}" y="${avgY + 3}" fill="#b91c1c" font-size="8" opacity="0.6">均${avg}</text>`;
    svg += `<line x1="${padL}" y1="${minY}" x2="${W - padR}" y2="${minY}" stroke="#6b7280" stroke-width="0.7" stroke-dasharray="4,3" opacity="0.5"/>`;
    svg += `<text x="${W - padR + 2}" y="${minY + 3}" fill="#6b7280" font-size="8" opacity="0.6">低${minVal}</text>`;

    svg += `</svg>`;
    container.innerHTML = svg;

    // Tooltip interaction
    container.querySelectorAll('.chart-dot').forEach(dot => {
        dot.style.cursor = 'pointer';
        dot.addEventListener('mouseenter', (ev) => {
            const idx = parseInt(dot.dataset.idx);
            const e = data[idx];
            dot.setAttribute('r', '5');
            tooltip.innerHTML = `<b>${e.name}</b><br>${e.dynasty_orig || e.dynasty} · ${e.reign}<br>总分 <b>${e.total}</b>`;
            tooltip.style.opacity = '1';
            const rect = dot.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - 60) + 'px';
        });
        dot.addEventListener('mouseleave', () => {
            const idx = parseInt(dot.dataset.idx);
            const range = dynastyRanges.find(r => idx >= r.start && idx <= r.end);
            const isEdge = range && (idx === range.start || idx === range.end);
            dot.setAttribute('r', isEdge ? '3' : '2');
            tooltip.style.opacity = '0';
        });
    });
}

/* Initialize */
(function init() {
    // Prepare data
    allEmperors = emperors.map(emp => ({
        ...emp,
        totalScore: calculateTotal(emp.scores)
    }));
    
    // Dynasty filter dropdown
    const dynasties = [...new Set(emperors.map(e => e.dynasty))];
    const filterBtn = document.getElementById('dynastyFilterBtn');
    const dropdown = document.getElementById('dynastyDropdown');
    if (filterBtn && dropdown) {
        const allItem = document.createElement('div');
        allItem.textContent = '全部';
        allItem.dataset.value = '';
        allItem.style.cssText = 'padding:4px 10px;cursor:pointer;font-size:11px;color:#e5e7eb;white-space:nowrap;';
        allItem.classList.add('dynasty-filter-active');
        dropdown.appendChild(allItem);
        dynasties.forEach(d => {
            const item = document.createElement('div');
            item.textContent = d;
            item.dataset.value = d;
            item.style.cssText = 'padding:4px 10px;cursor:pointer;font-size:11px;color:#e5e7eb;white-space:nowrap;';
            dropdown.appendChild(item);
        });
        dropdown.querySelectorAll('div').forEach(item => {
            item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.1)'; });
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('dynasty-filter-active')) item.style.background = '';
            });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                currentDynastyFilter = item.dataset.value;
                dropdown.querySelectorAll('div').forEach(i => {
                    i.classList.remove('dynasty-filter-active');
                    i.style.background = '';
                });
                item.classList.add('dynasty-filter-active');
                item.style.background = 'rgba(255,255,255,0.1)';
                filterBtn.textContent = currentDynastyFilter ? '▼' : '▼';
                filterBtn.style.opacity = currentDynastyFilter ? '1' : '0.7';
                dropdown.style.display = 'none';
                sortTable(currentSort.field, currentSort.order);
            });
        });
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', () => { dropdown.style.display = 'none'; });
    }
    
    // Add sort event listeners
    document.querySelectorAll('.emperor-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            sortTable(field);
        });
    });
    
    // Initial render - sorted by total score descending (high to low)
    sortTable('total', 'desc');
    
    // Render dynasty chart
    renderDynastyChart();
    
    window.addEventListener('resize', () => {
        renderDynastyChart();
    });
})();
</script>
