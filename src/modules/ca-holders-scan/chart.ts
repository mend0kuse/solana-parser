import { createCanvas } from 'canvas';
import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import fs from 'fs';
import { CONFIG } from './config.js';
import { ChartTokenData } from './types.js';

Chart.register(
    BarController,
    BarElement,
    ArcElement,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
);

export function createChart(name: string, tokenData: ChartTokenData[]) {
    const labels = tokenData.map((token) => token.ticker);
    const data = tokenData.map((token) => token.count).sort((a, b) => b - a);
    const canvas = createCanvas(5000, 600);
    const ctx = canvas.getContext('2d');

    if (data.length === 0) {
        console.error('No chart data available');
        return;
    }

    new Chart(ctx as any, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    barThickness: 15,
                    data,
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#F7464A',
                        '#8E44AD',
                        '#FF9F40',
                        '#7FDBFF',
                    ],
                    borderColor: ['#FFFFFF'],
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Часто встречающиеся токены у холдеров',
                    font: {
                        size: 24,
                        family: 'Arial',
                    },
                    color: '#333',
                },
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 14,
                        },
                        color: '#555',
                    },
                },
                y: {
                    ticks: {
                        font: {
                            size: 14,
                        },
                        color: '#555',
                    },
                    grid: {
                        color: '#e0e0e0',
                        tickBorderDash: [5, 5],
                    },
                },
            },
        },
    });

    const buffer = canvas.toBuffer('image/png');
    fs.writeFile(`${CONFIG.RESEARCH_FOLDER}/${name}.png`, buffer, () => {});
    console.log(`График сохранен как ${name}.png`);
}
