/**
 * OftalmoCare — Dashboard BI Component
 * Gráficos de desfechos clínicos com Chart.js
 */
import { getFullDashboardData } from '../api/dashboard.service.js';
import { PATHOLOGY_LABELS } from '../db/db.schema.js';

const CHART_COLORS = {
  catarata: 'rgba(59,130,246,0.8)',
  refrativa: 'rgba(16,185,129,0.8)',
  retina_vitreo: 'rgba(245,158,11,0.8)',
  outro: 'rgba(148,163,184,0.8)',
};
const CHART_BG = {
  catarata: 'rgba(59,130,246,0.15)',
  refrativa: 'rgba(16,185,129,0.15)',
  retina_vitreo: 'rgba(245,158,11,0.15)',
  outro: 'rgba(148,163,184,0.15)',
};

let chartInstances = [];

export async function initDashboardBI(container) {
  container.innerHTML = `
    <div class="welcome-section"><h1>Dashboard BI</h1><p>Estatísticas e desfechos clínicos</p></div>
    <div id="bi-loading" class="text-center text-muted mt-lg"><div class="spinner spinner-lg spinner-primary" style="margin:0 auto"></div><p class="mt-md">Carregando dados...</p></div>
    <div id="bi-content" style="display:none"></div>
  `;

  const data = await getFullDashboardData();
  document.getElementById('bi-loading').style.display = 'none';
  document.getElementById('bi-content').style.display = 'block';
  renderBI(data);
}

function renderBI(data) {
  const content = document.getElementById('bi-content');
  const ov = data.overview || {};
  const av = data.avOutcomes || {};
  const dr = data.drSuccess || {};
  const mh = data.mhClosure || {};
  const lio = data.lioDistrib || {};

  content.innerHTML = `
    <!-- Stats Row -->
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon stat-icon-teal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div><div class="stat-value">${ov.totalPatients||0}</div><div class="stat-label">Pacientes</div></div></div>
      <div class="stat-card"><div class="stat-icon stat-icon-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div><div class="stat-value">${ov.totalSurgeries||0}</div><div class="stat-label">Cirurgias</div></div></div>
      <div class="stat-card"><div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div class="stat-value">${ov.surgeriesThisMonth||0}</div><div class="stat-label">Cirurgias/Mês</div></div></div>
      <div class="stat-card"><div class="stat-icon stat-icon-red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="stat-value">${ov.totalConsultations||0}</div><div class="stat-label">Evoluções</div></div></div>
    </div>

    <div class="bi-grid">
      <!-- Surgery Volume Chart -->
      <div class="bi-card" style="grid-column:1/-1">
        <div class="bi-card-header"><h3>📊 Volume Cirúrgico (12 meses)</h3></div>
        <div class="bi-chart-wrap"><canvas id="chart-volume"></canvas></div>
      </div>

      <!-- AV Outcomes -->
      <div class="bi-card">
        <div class="bi-card-header"><h3>👁️ Desfecho de Acuidade Visual</h3></div>
        ${av.totalEyes > 0 ? `
          <div class="bi-big-stat"><div class="value">${av.improvementRate}%</div><div class="label">Taxa de Melhora (${av.totalEyes} olhos)</div></div>
          <div class="bi-stat-row"><span class="bi-stat-label">AV Pré-Op Média</span><span class="bi-stat-value">${av.avgPreSnellen||'—'} (${av.avgPreLogMAR} LogMAR)</span></div>
          <div class="bi-stat-row"><span class="bi-stat-label">AV Pós-Op Média</span><span class="bi-stat-value positive">${av.avgPostSnellen||'—'} (${av.avgPostLogMAR} LogMAR)</span></div>
          <div class="bi-stat-row"><span class="bi-stat-label">Melhoraram</span><span class="bi-stat-value positive">${av.improvedCount} olhos</span></div>
        ` : '<div class="empty-state" style="padding:1rem"><p class="text-muted">Sem dados de AV pré/pós operatória.</p></div>'}
      </div>

      <!-- LIO Distribution -->
      <div class="bi-card">
        <div class="bi-card-header"><h3>🔵 Distribuição de LIOs</h3></div>
        ${lio && lio.total > 0 ? `
          <div class="bi-chart-wrap" style="height:180px"><canvas id="chart-lio"></canvas></div>
          <div class="bi-donut-legend" id="lio-legend"></div>
          <div class="bi-stat-row" style="margin-top:0.75rem"><span class="bi-stat-label">Premium</span><span class="bi-stat-value">${lio.premiumRate}% (${lio.premiumCount})</span></div>
          <div class="bi-stat-row"><span class="bi-stat-label">Plano</span><span class="bi-stat-value">${lio.planoRate}% (${lio.planoCount})</span></div>
        ` : '<div class="empty-state" style="padding:1rem"><p class="text-muted">Sem dados de LIO.</p></div>'}
      </div>

      <!-- DR Success -->
      <div class="bi-card">
        <div class="bi-card-header"><h3>🟡 Descolamento de Retina</h3></div>
        ${dr && dr.total > 0 ? `
          <div class="bi-big-stat"><div class="value">${dr.successFirstRate}%</div><div class="label">Sucesso na 1ª cirurgia (${dr.total} casos)</div></div>
          <div class="bi-stat-row"><span class="bi-stat-label">Sucesso 1ª Cirurgia</span><span class="bi-stat-value positive">${dr.successFirstSurgery}</span></div>
          <div class="bi-stat-row"><span class="bi-stat-label">Sucesso Global</span><span class="bi-stat-value positive">${dr.successOverallRate}% (${dr.successOverall})</span></div>
        ` : '<div class="empty-state" style="padding:1rem"><p class="text-muted">Sem dados de DR.</p></div>'}
      </div>

      <!-- MH Closure -->
      <div class="bi-card">
        <div class="bi-card-header"><h3>🟤 Buraco Macular</h3></div>
        ${mh && mh.total > 0 ? `
          <div class="bi-big-stat"><div class="value">${mh.closureRate}%</div><div class="label">Taxa de Fechamento (${mh.total} casos)</div></div>
          <div class="bi-stat-row"><span class="bi-stat-label">Fechados</span><span class="bi-stat-value positive">${mh.closed}</span></div>
          <div class="bi-stat-row"><span class="bi-stat-label">Total</span><span class="bi-stat-value">${mh.total}</span></div>
        ` : '<div class="empty-state" style="padding:1rem"><p class="text-muted">Sem dados de MH.</p></div>'}
      </div>
    </div>
  `;

  // Render Charts
  renderVolumeChart(data.surgeryVolume);
  if (lio && lio.total > 0) renderLIOChart(lio);
}

async function loadChartJS() {
  if (window.Chart) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function renderVolumeChart(volume) {
  if (!volume || !volume.labels.length) return;
  await loadChartJS();

  // Destroy old
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  const ctx = document.getElementById('chart-volume')?.getContext('2d');
  if (!ctx) return;

  const datasets = volume.datasets.map(ds => ({
    label: PATHOLOGY_LABELS[ds.pathology] || ds.pathology,
    data: ds.data,
    backgroundColor: CHART_BG[ds.pathology] || 'rgba(100,100,100,0.15)',
    borderColor: CHART_COLORS[ds.pathology] || 'rgba(100,100,100,0.8)',
    borderWidth: 2,
    borderRadius: 4,
    tension: 0.3,
  }));

  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels: volume.labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 16 } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
        y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', stepSize: 1 } },
      },
    },
  });
  chartInstances.push(chart);
}

async function renderLIOChart(lio) {
  await loadChartJS();
  const ctx = document.getElementById('chart-lio')?.getContext('2d');
  if (!ctx) return;

  const labels = Object.keys(lio.distribution);
  const values = Object.values(lio.distribution);
  const colors = ['#3b82f6','#10b981','#f59e0b','#a78bfa','#ef4444','#06b6d4','#ec4899'];

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())),
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { display: false } },
    },
  });
  chartInstances.push(chart);

  // Custom legend
  const legend = document.getElementById('lio-legend');
  if (legend) {
    legend.innerHTML = labels.map((l, i) => `<div class="bi-legend-item"><div class="bi-legend-dot" style="background:${colors[i]}"></div>${l.replace(/_/g,' ')}</div>`).join('');
  }
}
