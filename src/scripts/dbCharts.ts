// Interactive charts for the Database page.
// Style follows the project's ggplot-like theme: grey panel, white grid, Dark2 colors,
// bold left-aligned title with a small grey subtitle.
// @ts-ignore - plotly.js-cartesian-dist-min ships no types
import Plotly from 'plotly.js-cartesian-dist-min';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const DARK2 = ['#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E', '#E6AB02', '#A6761D', '#666666'];
const INK = '#333333';
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';

const TIER_NAMES: Record<number, string> = {
	1: 'Tier 1 (no RF)',
	2: 'Tier 2 (some RF)',
	3: 'Tier 3 (majority RF)',
};
const TIER_COLORS: Record<number, string> = { 1: DARK2[0], 2: DARK2[1], 3: DARK2[2] };

const fmt = (n: number) => n.toLocaleString('en-US');
const hexA = (hex: string, a: number) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---------------------------------------------------------------- theme
function axis(title: string, extra: Record<string, unknown> = {}) {
	return {
		title: { text: title, font: { size: 12, color: INK }, standoff: 10 },
		gridcolor: '#ffffff',
		gridwidth: 1.1,
		zeroline: false,
		showline: false,
		ticks: 'outside',
		ticklen: 3,
		tickcolor: '#4D4D4D',
		tickfont: { size: 11, color: '#4D4D4D' },
		fixedrange: false,
		...extra,
	};
}

function layout(title: string, subtitle: string, xTitle: string, yTitle: string, extra: Record<string, unknown> = {}) {
	return {
		font: { family: FONT, color: INK, size: 11 },
		paper_bgcolor: '#ffffff',
		plot_bgcolor: '#EBEBEB',
		title: {
			text: `<b>${title}</b>`,
			x: 0,
			xref: 'paper',
			xanchor: 'left',
			y: 0.97,
			yanchor: 'top',
			font: { size: 17, color: INK },
			subtitle: { text: subtitle, font: { size: 12, color: '#777777' } },
		},
		margin: { l: 64, r: 16, t: 78, b: 56 },
		xaxis: axis(xTitle),
		yaxis: axis(yTitle),
		legend: {
			x: 0.015,
			y: 0.985,
			xanchor: 'left',
			yanchor: 'top',
			bgcolor: 'rgba(235,235,235,0.6)',
			font: { size: 11, color: INK },
			itemsizing: 'constant',
		},
		hoverlabel: { font: { family: FONT, size: 12 }, bgcolor: '#ffffff', bordercolor: '#cccccc' },
		dragmode: 'pan',
		...extra,
	};
}

const CONFIG = {
	responsive: true,
	displaylogo: false,
	scrollZoom: false,
	modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
	toImageButtonOptions: { format: 'png', scale: 3 },
};

// ---------------------------------------------------------------- helpers
async function getJSON(name: string) {
	const res = await fetch(`${BASE}/data/database/${name}`);
	if (!res.ok) throw new Error(`Could not load ${name}`);
	return res.json();
}

function ols(x: number[], y: number[]) {
	const n = x.length;
	const mx = x.reduce((a, b) => a + b, 0) / n;
	const my = y.reduce((a, b) => a + b, 0) / n;
	let sxx = 0, sxy = 0, syy = 0;
	for (let i = 0; i < n; i++) {
		sxx += (x[i] - mx) ** 2;
		sxy += (x[i] - mx) * (y[i] - my);
		syy += (y[i] - my) ** 2;
	}
	const slope = sxy / sxx;
	return { slope, intercept: my - slope * mx, r2: (sxy * sxy) / (sxx * syy), n };
}

const quantile = (arr: number[], q: number) => {
	const s = [...arr].sort((a, b) => a - b);
	const pos = (s.length - 1) * q;
	const lo = Math.floor(pos);
	return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
};

type Option = { key: string; label: string };

// Builds a button group above a chart and re-renders on change.
function withToggle(el: HTMLElement, options: Option[], render: (key: string) => void, initial = options[0].key) {
	if (options.length === 1) {
		render(options[0].key);
		return;
	}
	const group = document.createElement('div');
	group.className = 'chart-toggle';
	group.setAttribute('role', 'group');
	const buttons = options.map((o) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = o.label;
		b.dataset.key = o.key;
		b.addEventListener('click', () => select(o.key));
		group.appendChild(b);
		return b;
	});
	el.parentElement?.insertBefore(group, el);
	function select(key: string) {
		buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === key)));
		render(key);
	}
	select(initial);
}

function draw(el: HTMLElement, data: unknown[], lay: Record<string, unknown>) {
	return Plotly.react(el, data, lay, CONFIG);
}

// ---------------------------------------------------------------- charts
type Pedons = {
	n: number;
	id: string[];
	county: string[];
	depth: (number | null)[];
	full: (number | null)[];
	m1: (number | null)[];
	tier: (number | null)[];
	critB: boolean[];
};

function pedonRows(p: Pedons, ycol: 'full' | 'm1', onlyB: boolean) {
	const rows: { x: number; y: number; tier: number; id: string; county: string }[] = [];
	for (let i = 0; i < p.n; i++) {
		const x = p.depth[i], y = p[ycol][i], t = p.tier[i];
		if (x == null || y == null || t == null) continue;
		if (onlyB && !p.critB[i]) continue;
		rows.push({ x, y, tier: t, id: p.id[i], county: p.county[i] });
	}
	return rows;
}

function scatterChart(el: HTMLElement, p: Pedons) {
	withToggle(
		el,
		[
			{ key: 'full', label: 'Full-profile stock' },
		],
		(key) => {
			const full = key === 'full';
			const rows = pedonRows(p, full ? 'full' : 'm1', full);
			const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
			rows.forEach((r) => counts[r.tier]++);
			// largest group first so the small tiers sit on top
			const order = [3, 1, 2];
			const traces: unknown[] = order.map((t) => {
				const sub = rows.filter((r) => r.tier === t);
				return {
					type: 'scatter',
					mode: 'markers',
					name: `${TIER_NAMES[t]} (n=${fmt(counts[t])})`,
					x: sub.map((r) => r.x),
					y: sub.map((r) => r.y),
					customdata: sub.map((r) => [r.id, r.county]),
					marker: { color: TIER_COLORS[t], size: 6, opacity: 0.7, line: { width: 0 } },
					hovertemplate:
						`<b>%{customdata[0]}</b><br>${TIER_NAMES[t]}<br>%{customdata[1]} County<br>` +
						`Depth: %{x:,.0f} cm<br>Stock: %{y:,.1f} kgC/m²<extra></extra>`,
				};
			});
			// legend order: tier 1, 2, 3
			traces.sort((a: any, b: any) => a.name.localeCompare(b.name));
			if (full) {
				const f = ols(rows.map((r) => r.x), rows.map((r) => r.y));
				const xs = [Math.min(...rows.map((r) => r.x)), Math.max(...rows.map((r) => r.x))];
				traces.push({
					type: 'scatter',
					mode: 'lines',
					x: xs,
					y: xs.map((x) => f.slope * x + f.intercept),
					line: { color: INK, width: 2.5 },
					name: `Linear fit: C = ${f.slope.toFixed(3)} × depth + ${f.intercept.toFixed(1)}  (r² = ${f.r2.toFixed(2)}, n = ${fmt(f.n)})`,
					hoverinfo: 'skip',
				});
			}
			draw(
				el,
				traces,
				layout(
					full ? 'Full-profile carbon stock vs max peat depth' : 'Top-1 m carbon stock vs max peat depth',
					full
						? `Criterion B pedons (peat observed to its bottom), n = ${fmt(rows.length)}`
						: `All pedons with a 1 m stock, n = ${fmt(rows.length)}`,
					'Max peat depth (cm)',
					full ? 'Full-profile C stock (kgC/m²)' : 'Top-1 m C stock (kgC/m²)',
				),
			);
		},
	);
}

function histogramChart(el: HTMLElement, p: Pedons) {
	withToggle(
		el,
		[
			{ key: 'full', label: 'Full-profile stock' },
		],
		(key) => {
			const full = key === 'full';
			const vals = pedonRows(p, full ? 'full' : 'm1', full).map((r) => r.y);
			const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
			const median = quantile(vals, 0.5);
			const ymaxHint = 1.02;
			draw(
				el,
				[
					{
						type: 'histogram',
						x: vals,
						xbins: { size: full ? 10 : 3 },
						marker: { color: DARK2[2], opacity: 0.85, line: { color: '#ffffff', width: 1 } },
						hovertemplate: 'Stock: %{x} kgC/m²<br>Pedons: %{y}<extra></extra>',
						name: 'Pedons',
						showlegend: false,
					},
					{ type: 'scatter', mode: 'lines', x: [null], y: [null], line: { color: DARK2[1], width: 2, dash: 'dash' }, name: `Mean = ${mean.toFixed(1)}` },
					{ type: 'scatter', mode: 'lines', x: [null], y: [null], line: { color: INK, width: 2, dash: 'dot' }, name: `Median = ${median.toFixed(1)}` },
				],
				layout(
					full ? 'Full-profile carbon stock distribution' : 'Top-1 m carbon stock distribution',
					full ? `Criterion B pedons, n = ${fmt(vals.length)}` : `All pedons with a 1 m stock, n = ${fmt(vals.length)}`,
					'Carbon stock (kgC/m²)',
					'Number of pedons',
					{
						bargap: 0.02,
						legend: { x: 0.985, y: 0.985, xanchor: 'right', yanchor: 'top', bgcolor: 'rgba(235,235,235,0.6)', font: { size: 11, color: INK }, itemsizing: 'constant' },
						shapes: [
							{ type: 'line', xref: 'x', yref: 'paper', x0: mean, x1: mean, y0: 0, y1: ymaxHint - 0.02, line: { color: DARK2[1], width: 2, dash: 'dash' } },
							{ type: 'line', xref: 'x', yref: 'paper', x0: median, x1: median, y0: 0, y1: ymaxHint - 0.02, line: { color: INK, width: 2, dash: 'dot' } },
						],
					},
				),
			);
		},
	);
}

function tierBoxChart(el: HTMLElement, p: Pedons) {
	withToggle(
		el,
		[
			{ key: 'full', label: 'Full-profile stock' },
		],
		(key) => {
			const full = key === 'full';
			const rows = pedonRows(p, full ? 'full' : 'm1', full);
			const traces = [1, 2, 3].map((t) => {
				const sub = rows.filter((r) => r.tier === t);
				return {
					type: 'box',
					y: sub.map((r) => r.y),
					name: `${TIER_NAMES[t]}<br>n = ${fmt(sub.length)}`,
					boxmean: false,
					fillcolor: hexA(TIER_COLORS[t], 0.7),
					line: { color: INK, width: 1.3 },
					marker: { color: TIER_COLORS[t], size: 3, opacity: 0.6 },
					boxpoints: 'outliers',
					hoverinfo: 'y+name',
					showlegend: false,
				};
			});
			draw(
				el,
				traces,
				layout(
					full ? 'Full-profile carbon stock by gap-fill tier' : 'Top-1 m carbon stock by gap-fill tier',
					full ? 'Criterion B pedons' : 'All pedons with a 1 m stock',
					'',
					full ? 'Full-profile C stock (kgC/m²)' : 'Top-1 m C stock (kgC/m²)',
					{ margin: { l: 64, r: 16, t: 78, b: 72 } },
				),
			);
		},
	);
}

function gapChart(el: HTMLElement, h: any) {
	const methods: [string, string, string][] = [
		['measured', 'Measured lab value', DARK2[0]],
		['ash_regression', 'Ash regression', DARK2[1]],
		['rf', 'Random forest', DARK2[2]],
		['missing', 'Not filled (no von Post score)', DARK2[7]],
	];
	const labels = ['Bulk density', 'Soil organic carbon (SOC)'];
	const total = (g: any) => Object.values(g).reduce((s: number, v: any) => s + v, 0) as number;
	const tot = [total(h.gap.BD), total(h.gap.SOC)];
	const rows = [h.gap.BD, h.gap.SOC];
	draw(
		el,
		methods.map(([k, name, color]) => ({
			type: 'bar',
			orientation: 'h',
			name,
			y: labels,
			x: rows.map((g, i) => (g[k] / tot[i]) * 100),
			customdata: rows.map((g) => g[k]),
			marker: { color },
			text: rows.map((g, i) => ((g[k] / tot[i]) * 100 >= 4 ? `${((g[k] / tot[i]) * 100).toFixed(0)}%` : '')),
			textposition: 'inside',
			insidetextfont: { color: '#ffffff', size: 12 },
			hovertemplate: `${name}<br>%{customdata:,} horizons (%{x:.1f}%)<extra></extra>`,
		})),
		layout(
			'How each horizon value was obtained',
			`Share of all ${fmt(tot[0])} horizons, by gap-fill method`,
			'Share of horizons (%)',
			'',
			{
				barmode: 'stack',
				margin: { l: 150, r: 16, t: 78, b: 120 },
				legend: { orientation: 'h', traceorder: 'normal', x: 0, y: -0.32, xanchor: 'left', yanchor: 'top', font: { size: 11, color: INK } },
				yaxis: axis('', { automargin: true }),
				xaxis: axis('Share of horizons (%)', { range: [0, 100] }),
			},
		),
	);
}

function tierCountChart(el: HTMLElement, h: any) {
	withToggle(
		el,
		[
			{ key: 'all', label: 'All eligible pedons' },
			{ key: 'critB', label: 'Criterion B pedons' },
		],
		(key) => {
			const t = h.tiers[key];
			const vals = [t['1'], t['2'], t['3']];
			const total = vals.reduce((a: number, b: number) => a + b, 0);
			draw(
				el,
				[
					{
						type: 'bar',
						x: [1, 2, 3].map((k) => `${TIER_NAMES[k]}`),
						y: vals,
						marker: { color: [1, 2, 3].map((k) => TIER_COLORS[k]) },
						text: vals.map((v: number) => `${fmt(v)}<br>(${((v / total) * 100).toFixed(1)}%)`),
						textposition: 'outside',
						cliponaxis: false,
						hovertemplate: '%{x}<br>%{y:,} pedons<extra></extra>',
					},
				],
				layout(
					'Pedons by gap-fill quality tier',
					key === 'all' ? `All eligible pedons, n = ${fmt(total)}` : `Criterion B pedons, n = ${fmt(total)}`,
					'',
					'Number of pedons',
					{ yaxis: axis('Number of pedons', { range: [0, Math.max(...vals) * 1.2] }) },
				),
			);
		},
	);
}

function ashScatter(el: HTMLElement, h: any, kind: 'bd' | 'soc') {
	const d = kind === 'bd' ? h.bd_ash : h.soc_ash;
	const x: number[] = d.ash;
	const y: number[] = kind === 'bd' ? d.bd : d.soc;
	const f = ols(x, y);
	const xs = [Math.min(...x), Math.max(...x)];
	const color = kind === 'bd' ? DARK2[0] : DARK2[1];
	draw(
		el,
		[
			{
				type: 'scatter',
				mode: 'markers',
				x,
				y,
				name: `Measured horizons (n=${fmt(x.length)})`,
				marker: { color, size: 6, opacity: 0.5, line: { width: 0 } },
				hovertemplate: kind === 'bd'
					? 'Ash: %{x:.1f}%<br>Bulk density: %{y:.3f} g/cm³<extra></extra>'
					: 'Ash: %{x:.1f}%<br>Carbon: %{y:.1f}%<extra></extra>',
			},
			{
				type: 'scatter',
				mode: 'lines',
				x: xs,
				y: xs.map((v) => f.slope * v + f.intercept),
				line: { color: INK, width: 2.5 },
				name: `Linear fit: y = ${f.slope.toFixed(kind === 'bd' ? 4 : 3)}x ${f.intercept < 0 ? '−' : '+'} ${Math.abs(f.intercept).toFixed(kind === 'bd' ? 3 : 1)}  (r² = ${f.r2.toFixed(2)})`,
				hoverinfo: 'skip',
			},
		],
		layout(
			kind === 'bd' ? 'Bulk density vs ash content' : 'Carbon content vs ash content',
			kind === 'bd'
				? 'Horizons with measured bulk density and ash, used to fill missing bulk density'
				: 'Horizons with measured carbon and ash, used to fill missing carbon',
			'Ash content (%)',
			kind === 'bd' ? 'Bulk density (g/cm³)' : 'Soil organic carbon (%)',
			kind === 'soc' ? { legend: { x: 0.985, y: 0.985, xanchor: 'right', yanchor: 'top', bgcolor: 'rgba(235,235,235,0.6)', font: { size: 11, color: INK }, itemsizing: 'constant' } } : {},
		),
	);
}

function labBoxChart(el: HTMLElement, h: any) {
	const metrics: Record<string, { label: string; unit: string; fmtHover: string }> = {
		soc: { label: 'Carbon content', unit: 'Soil organic carbon (%)', fmtHover: '%{y:.1f}%' },
		bd: { label: 'Bulk density', unit: 'Bulk density (g/cm³)', fmtHover: '%{y:.3f} g/cm³' },
		ash: { label: 'Ash content', unit: 'Ash content (%)', fmtHover: '%{y:.1f}%' },
	};
	let metric = 'soc';
	let group = 'class';
	function render() {
		const m = metrics[metric];
		const src = h.lab[group][metric] as Record<string, number[]>;
		const cats = Object.keys(src).filter((k) => src[k].length > 0);
		const traces = cats.map((c, i) => ({
			type: 'box',
			y: src[c],
			name: `${c}<br>n = ${fmt(src[c].length)}`,
			fillcolor: hexA(DARK2[i % 8], 0.7),
			line: { color: INK, width: 1.3 },
			marker: { color: DARK2[i % 8], size: 3, opacity: 0.6 },
			boxpoints: 'outliers',
			hovertemplate: `${c}<br>${m.fmtHover}<extra></extra>`,
			showlegend: false,
		}));
		draw(
			el,
			traces,
			layout(
				`${m.label} by ${group === 'class' ? 'peat classification' : 'von Post humification'}`,
				'Measured horizons from the DNR Peat Inventory lab tables',
				group === 'class' ? 'Peat classification' : 'von Post humification class',
				m.unit,
				{ margin: { l: 64, r: 16, t: 78, b: 80 } },
			),
		);
	}
	const mkGroup = (opts: Option[], onPick: (k: string) => void, initial: string) => {
		const g = document.createElement('div');
		g.className = 'chart-toggle';
		const btns = opts.map((o) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.textContent = o.label;
			b.dataset.key = o.key;
			b.addEventListener('click', () => {
				btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
				onPick(o.key);
				render();
			});
			b.setAttribute('aria-pressed', String(o.key === initial));
			g.appendChild(b);
			return b;
		});
		return g;
	};
	const wrap = document.createElement('div');
	wrap.className = 'chart-toggle-row';
	wrap.append(
		mkGroup(Object.entries(metrics).map(([key, v]) => ({ key, label: v.label })), (k) => (metric = k), metric),
		mkGroup(
			[
				{ key: 'class', label: 'By classification' },
				{ key: 'vonpost', label: 'By von Post class' },
			],
			(k) => (group = k),
			group,
		),
	);
	el.parentElement?.insertBefore(wrap, el);
	render();
}

// ---------------------------------------------------------------- boot
const builders: Record<string, (el: HTMLElement, pedons: () => Promise<Pedons>, horizons: () => Promise<any>) => Promise<void>> = {
	gap: async (el, _p, h) => gapChart(el, await h()),
	tiers: async (el, _p, h) => tierCountChart(el, await h()),
	'bd-ash': async (el, _p, h) => ashScatter(el, await h(), 'bd'),
	'soc-ash': async (el, _p, h) => ashScatter(el, await h(), 'soc'),
	scatter: async (el, p) => scatterChart(el, await p()),
	histogram: async (el, p) => histogramChart(el, await p()),
	'tier-box': async (el, p) => tierBoxChart(el, await p()),
	'lab-box': async (el, _p, h) => labBoxChart(el, await h()),
};

let pedonsP: Promise<Pedons> | undefined;
let horizonsP: Promise<any> | undefined;
const getPedons = () => (pedonsP ??= getJSON('pedons.json'));
const getHorizons = () => (horizonsP ??= getJSON('horizons.json'));

function boot() {
	const els = document.querySelectorAll<HTMLElement>('[data-chart]');
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				const el = e.target as HTMLElement;
				io.unobserve(el);
				const build = builders[el.dataset.chart ?? ''];
				if (!build) continue;
				build(el, getPedons, getHorizons).catch(() => {
					el.textContent = 'This chart could not be loaded.';
					el.classList.add('chart-error');
				});
			}
		},
		{ rootMargin: '300px 0px' },
	);
	els.forEach((el) => io.observe(el));
}

boot();
