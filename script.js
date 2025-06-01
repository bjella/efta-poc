// API base URL
const API_BASE_URL = 'https://trade.efta.int/efta/data';

// Initialize the charts
let tradeChart;

function initializeTradeChart() {
    const ctx = document.getElementById('tradeChart').getContext('2d');
    tradeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Exports',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Imports',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    notation: 'compact',
                                    maximumFractionDigits: 1
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                notation: 'compact',
                                maximumFractionDigits: 1
                            }).format(value);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

async function fetchTradeData(reporter, partner, startYear, endYear) {
    try {
        const url = `${API_BASE_URL}/${reporter}/${partner}/${startYear}/${endYear}/tradeEvolution.json`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching trade data:', error);
        return null;
    }
}

async function fetchGoodsData(reporter, partner, year) {
    try {
        const url = `${API_BASE_URL}/${reporter}/${partner}/${year}/${year}/treemap_HS2.json`;
        console.log('Fetching goods data from URL:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw API response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching goods data:', error);
        return null;
    }
}

function updateTradeChart(data) {
    if (!data || !data.records || !data.records.length) {
        return;
    }

    // Sort data by year to ensure correct order
    const sortedData = data.records.sort((a, b) => a[0] - b[0]);

    // Process the data
    // Format: [year, exports, imports, balance]
    const years = sortedData.map(item => item[0]);
    const exports = sortedData.map(item => parseFloat(item[1]) || 0);
    const imports = sortedData.map(item => parseFloat(item[2]) || 0);

    // Destroy existing chart if it exists
    if (tradeChart) {
        tradeChart.destroy();
    }

    // Reinitialize chart
    initializeTradeChart();

    // Update with new data
    tradeChart.data.labels = years;
    tradeChart.data.datasets[0].data = exports;
    tradeChart.data.datasets[1].data = imports;
    tradeChart.update();
}

function updateGoodsChart(data) {
    if (!data || !data.treemap || !data.treemap.children) {
        console.log('No goods data to display');
        return;
    }

    console.log('Processing treemap data:', data.treemap);

    // Clear previous chart
    d3.select('#goodsChart').selectAll('*').remove();

    // Set up dimensions
    const container = document.querySelector('#goodsChart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const titleHeight = 30;
    const labelHeight = 25;
    const treemapHeight = height - titleHeight - labelHeight;

    // Create tooltip div
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background-color', 'white')
        .style('border', '1px solid #ddd')
        .style('border-radius', '4px')
        .style('padding', '8px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
        .style('z-index', '1000');

    // Create SVG
    const svg = d3.select('#goodsChart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', titleHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .text(data.treemap.name);

    // Create color scale
    const color = d3.scaleOrdinal()
        .domain(['Exports', 'Imports'])
        .range(['rgba(54, 162, 235, 0.7)', 'rgba(255, 99, 132, 0.7)']);

    // Create the treemap layout
    const treemap = data => d3.treemap()
        .size([width, treemapHeight])
        .padding(1)
        .tile(d3.treemapSquarify)
        (d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value));

    const root = treemap(data.treemap);

    // Calculate the total value for each category
    const categoryTotals = {};
    root.children.forEach(category => {
        categoryTotals[category.data.name] = category.value;
    });

    // Add category labels
    const categories = root.children;
    categories.forEach((category, i) => {
        const x = (width / categories.length) * i + (width / categories.length) / 2;
        svg.append('text')
            .attr('x', x)
            .attr('y', titleHeight + labelHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', color(category.data.name))
            .text(category.data.name);
    });

    // Add cells
    const cell = svg.selectAll('g')
        .data(root.descendants().filter(d => d.depth > 1))
        .join('g')
        .attr('transform', d => `translate(${d.x0},${d.y0 + titleHeight + labelHeight})`);

    // Add rectangles with tooltip
    cell.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => d.parent.data.name === 'Exports' ? 'rgba(54, 162, 235, 0.3)' : 'rgba(255, 99, 132, 0.3)')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            const formatValue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                notation: 'compact',
                maximumFractionDigits: 1
            }).format(d.value);

            const percentage = ((d.value / categoryTotals[d.parent.data.name]) * 100).toFixed(1);

            tooltip.html(`
                <strong>${d.data.titlePrefix} - ${d.data.name}</strong><br/>
                Value: ${formatValue}<br/>
                Share: ${percentage}%
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px')
            .style('opacity', 1);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('opacity', 0);
        });

    // Add labels for subcategories
    cell.append('text')
        .attr('x', 4)
        .attr('y', 18)
        .attr('fill', '#000')
        .attr('font-size', '12px')
        .attr('font-weight', 'normal')
        .text(d => d.data.titlePrefix);

    // Add value labels
    cell.append('text')
        .attr('x', 4)
        .attr('y', 30)
        .attr('fill', '#000')
        .attr('font-size', '12px')
        .text(d => new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            maximumFractionDigits: 1
        }).format(d.value));
}

async function updateData() {
    const reporter = document.getElementById('reporterSelect').value;
    const partner = document.getElementById('partnerSelect').value;
    const endYear = document.getElementById('yearSelect').value;
    const startYear = (parseInt(endYear) - 10).toString();

    console.log('Updating data with params:', { reporter, partner, startYear, endYear });

    // Show loading states
    document.querySelectorAll('.chart-container').forEach(container => {
        container.innerHTML = '<div class="loading">Loading data...</div>';
    });

    try {
        // Fetch both trade evolution and goods data
        const [tradeData, goodsData] = await Promise.all([
            fetchTradeData(reporter, partner, startYear, endYear),
            fetchGoodsData(reporter, partner, endYear)
        ]);
        
        // Recreate chart containers
        document.querySelectorAll('.chart-container').forEach(container => {
            if (container.parentElement.querySelector('h2').textContent === 'Trade Evolution') {
                container.innerHTML = '<canvas id="tradeChart"></canvas>';
            } else {
                container.innerHTML = '<div id="goodsChart"></div>';
            }
        });
        
        if (tradeData) {
            updateTradeChart(tradeData);
        } else {
            document.querySelector('.chart-section:first-child .chart-container').innerHTML = '<div class="error">No trade data available</div>';
        }

        if (goodsData) {
            updateGoodsChart(goodsData);
        } else {
            document.querySelector('.chart-section:last-child .chart-container').innerHTML = '<div class="error">No goods data available</div>';
        }
    } catch (error) {
        console.error('Error in updateData:', error);
        document.querySelectorAll('.chart-container').forEach(container => {
            container.innerHTML = '<div class="error">Error loading data</div>';
        });
    }
}

// Event listeners
document.getElementById('reporterSelect').addEventListener('change', updateData);
document.getElementById('partnerSelect').addEventListener('change', updateData);
document.getElementById('yearSelect').addEventListener('change', updateData);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    updateData();
}); 