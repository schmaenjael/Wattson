import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';

import type { DailyActivityBucket, MonthlyModerationBucket, MonthlyVerificationBucket } from '~/database';

const WIDTH = 900;
const HEIGHT = 450;
const BG = '#2B2D31';
const GRID = 'rgba(255,255,255,0.08)';
const TEXT = '#DCDDDE';
const FONT = 'sans-serif';

const canvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: BG,
  chartCallback: (ChartJS) => {
    ChartJS.defaults.color = TEXT;
    ChartJS.defaults.font.family = FONT;
    ChartJS.defaults.font.size = 13;
  },
});

const monthLabel = (ym: string): string => {
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};

const dayLabel = (ymd: string): string => {
  const [year, month, day] = ymd.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleString('en', { month: 'short', day: 'numeric' });
};

const baseScales = { x: { grid: { color: GRID }, ticks: { color: TEXT } }, y: { grid: { color: GRID }, ticks: { color: TEXT }, beginAtZero: true } };

export const renderVerificationsChart = async (data: MonthlyVerificationBucket[], months: number): Promise<Buffer> => {
  const labels = data.map((d) => monthLabel(d.month));
  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Approved',
          data: data.map((d) => d.completed),
          backgroundColor: 'rgba(27, 190, 111, 0.75)',
          borderColor: '#1BBE6F',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Rejected',
          data: data.map((d) => d.rejected),
          backgroundColor: 'rgba(230, 62, 18, 0.75)',
          borderColor: '#E63E12',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { labels: { color: TEXT } },
        title: { display: true, text: `Verifications — last ${months} months`, color: TEXT, font: { size: 16 }, padding: { bottom: 16 } },
      },
      scales: baseScales,
    },
  };
  return canvas.renderToBuffer(config);
};

export const renderEngagementChart = async (data: DailyActivityBucket[], days: number): Promise<Buffer> => {
  const labels = data.map((d) => dayLabel(d.day));
  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Messages',
          data: data.map((d) => d.messages),
          backgroundColor: 'rgba(130, 208, 244, 0.75)',
          borderColor: '#82D0F4',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Active members',
          data: data.map((d) => d.activeMembers),
          backgroundColor: 'rgba(27, 190, 111, 0.9)',
          borderColor: '#1BBE6F',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 2,
          yAxisID: 'yMembers',
          order: 1,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { labels: { color: TEXT } },
        title: { display: true, text: `Engagement — last ${days} days`, color: TEXT, font: { size: 16 }, padding: { bottom: 16 } },
      },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TEXT } },
        y: {
          grid: { color: GRID },
          ticks: { color: TEXT },
          beginAtZero: true,
          position: 'left',
          title: { display: true, text: 'Messages', color: TEXT },
        },
        yMembers: {
          grid: { drawOnChartArea: false },
          ticks: { color: TEXT },
          beginAtZero: true,
          position: 'right',
          title: { display: true, text: 'Active members', color: TEXT },
        },
      },
    },
  };
  return canvas.renderToBuffer(config);
};

export const renderModerationChart = async (data: MonthlyModerationBucket[], months: number): Promise<Buffer> => {
  const labels = data.map((d) => monthLabel(d.month));
  const config: ChartConfiguration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Warnings',
          data: data.map((d) => d.warnings),
          backgroundColor: 'rgba(253, 194, 32, 0.75)',
          borderColor: '#FDC220',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Bans',
          data: data.map((d) => d.bans),
          backgroundColor: 'rgba(230, 62, 18, 0.75)',
          borderColor: '#E63E12',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Reports',
          data: data.map((d) => d.reports),
          backgroundColor: 'rgba(130, 208, 244, 0.75)',
          borderColor: '#82D0F4',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { labels: { color: TEXT } },
        title: { display: true, text: `Moderation Actions — last ${months} months`, color: TEXT, font: { size: 16 }, padding: { bottom: 16 } },
      },
      scales: baseScales,
    },
  };
  return canvas.renderToBuffer(config);
};
