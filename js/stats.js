function getStreakStats(habitId) {
    const h = habits.find(x => x.id === habitId);
    if (!h) return { best3: [], current: 0 };
    if (!h.frequency) h.frequency = 'daily';

    // Date in cui l'abitudine è stata COMPLETATA
    let doneDates = Object.keys(logs).filter(d => {
        const val = logs[d]?.[habitId];
        return h.type === 'value' ? val >= h.target : val === true;
    }).sort();
    
    if (doneDates.length === 0) return { best3: [], current: 0 };

    // Costruiamo la lista di giorni in cui l'abitudine ERA PREVISTA finora
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstLog = new Date(doneDates[0]);
    let expectedDates = [];
    let temp = new Date(firstLog);

    while (temp <= today) {
        let dStr = getLocalISODate(temp);
        let day = temp.getDay();
        let show = false;
        if (h.frequency === 'daily') show = true;
        else if (h.frequency === 'days') show = h.frequencyDays.includes(day);
        else if (h.frequency === 'weekly') show = true; // Per le settimanali consideriamo streak normale per ora

        if (show) expectedDates.push(dStr);
        temp.setDate(temp.getDate() + 1);
    }

    // Calcolo streak basato solo sulle date attese
    let streaks = [], currentStreak = { count: 0, lastIdx: -1 };
    
    // Per settimanale usiamo logica standard di giorni consecutivi (pìù semplice)
    if (h.frequency === 'weekly') {
        let sc = { count: 1, start: doneDates[0], end: doneDates[0] };
        for (let i = 1; i < doneDates.length; i++) {
            let diff = (new Date(doneDates[i]) - new Date(doneDates[i-1])) / 86400000;
            if (diff === 1) { sc.count++; sc.end = doneDates[i]; }
            else { streaks.push({...sc}); sc = { count: 1, start: doneDates[i], end: doneDates[i] }; }
        }
        streaks.push(sc);
    } else {
        // Logica per Daily e Days: contiamo quanti 'expectedDates' consecutivi sono stati fatti
        let sc = { count: 0, start: null, end: null };
        expectedDates.forEach(d => {
            if (doneDates.includes(d)) {
                if (sc.count === 0) sc.start = d;
                sc.count++;
                sc.end = d;
            } else {
                if (sc.count > 0) streaks.push({...sc});
                sc = { count: 0, start: null, end: null };
            }
        });
        if (sc.count > 0) streaks.push(sc);
    }

    const yesterday = getLocalISODate(new Date(Date.now() - 86400000));
    const todayStr = getLocalISODate(today);
    const last = streaks[streaks.length - 1];
    
    let currentCount = 0;
    if (last) {
        // Lo streak è attuale se l'ultimo completamento è oggi o se l'ultimo GIORNO PREVISTO era ieri/oggi
        const lastExpected = expectedDates[expectedDates.length - 1];
        if (last.end === todayStr || last.end === lastExpected) {
            currentCount = last.count;
        }
    }

    return { best3: [...streaks].sort((a, b) => b.count - a.count).slice(0, 3), current: currentCount };
}

function coreRenderStats(statsMonth, renderCalendarBase) {
    const target = document.getElementById('habitSelector').value;
    const y = statsMonth.getFullYear(), m = statsMonth.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.getElementById('statsDateLabel').innerText = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(statsMonth);
    let labels = [], data = [];

    if (target === 'all') {
        document.getElementById('summaryList').classList.remove('hidden');
        document.getElementById('miniCalContainer').classList.add('hidden');
        let totalProgress = 0, perfectDays = 0, hMap = {}; 
        habits.forEach(h => hMap[h.id] = 0);
        
        for (let d = 1; d <= lastDay; d++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dd = new Date(dStr);
            const dayOfWeek = dd.getDay();
            const dayLogs = logs[dStr] || {};
            
            let completedToday = 0;
            let activeTodayCount = 0;

            habits.forEach(h => {
                const freq = h.frequency || 'daily';
                let isActive = false;
                if (freq === 'daily' || freq === 'weekly') isActive = true;
                else if (freq === 'days') isActive = h.frequencyDays?.includes(dayOfWeek);

                if (isActive) activeTodayCount++;

                const val = dayLogs[h.id];
                const isDone = (h.type === 'value' ? val >= h.target : val === true);
                if (isDone) { hMap[h.id]++; completedToday++; }
            });

            labels.push(d);
            data.push(completedToday);
            totalProgress += completedToday;
            if (activeTodayCount > 0 && completedToday >= activeTodayCount) perfectDays++;
        }
        
        // Calcolo totale atteso per il mese
        let totalExpected = 0;
        habits.forEach(h => {
            const freq = h.frequency || 'daily';
            if (freq === 'daily') totalExpected += lastDay;
            else if (freq === 'days') {
                for (let d=1; d<=lastDay; d++) {
                    if (h.frequencyDays?.includes(new Date(y, m, d).getDay())) totalExpected++;
                }
            } else if (freq === 'weekly') {
                totalExpected += Math.ceil(lastDay / 7) * (h.frequencyWeekly || 3);
            }
        });

        document.getElementById('statPerc').innerText = Math.round((totalProgress / (totalExpected || 1)) * 100) + "%";
        document.getElementById('statCount').innerText = perfectDays;
        document.getElementById('statLabelCount').innerText = "GIORNI PERFETTI";
        // Totale e media del mese (somma di tutti i valori registrati)
        const monthTotal = data.reduce((a, b) => a + b, 0);
        document.getElementById('statTotal').innerText = parseFloat(monthTotal.toFixed(1));
        document.getElementById('statLabelTotal').innerText = "TOTALE MESE";
        document.getElementById('statAvg').innerText = parseFloat((monthTotal / lastDay).toFixed(2));
        document.getElementById('statLabelAvg').innerText = "MEDIA GIORNALIERA";
        document.getElementById('summaryList').innerHTML = habits.map(h => {
            let hExpected = 0;
            const f = h.frequency || 'daily';
            if (f === 'daily') hExpected = lastDay;
            else if (f === 'days') {
                for(let d=1; d<=lastDay; d++) if(h.frequencyDays?.includes(new Date(y,m,d).getDay())) hExpected++;
            } else if (f === 'weekly') {
                hExpected = Math.ceil(lastDay / 7) * (h.frequencyWeekly || 3);
            }
            return `
                <div class="summary-item">
                    <b>${h.name}</b>
                    <span>${hMap[h.id]} volte <b style="color:var(--success); margin-left:8px">${Math.round((hMap[h.id]/(hExpected || 1))*100)}%</b></span>
                </div>
            `;
        }).join('');
    } else {
        document.getElementById('summaryList').classList.add('hidden');
        document.getElementById('miniCalContainer').classList.remove('hidden');
        const h = habits.find(x => x.id === target);
        if (!h) return;

        // Loop giornaliero: valori reali per il mese
        let totalCompletes = 0, totalValue = 0, activeDays = 0;
        for (let d = 1; d <= lastDay; d++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const val = logs[dStr]?.[target];
            labels.push(d);
            if (h.type === 'value') {
                const numVal = (typeof val === 'number' && val > 0) ? val : 0;
                data.push(parseFloat(numVal.toFixed(2)));
                totalValue += numVal;
                if (numVal > 0) activeDays++;
                if (typeof val === 'number' && val >= h.target) totalCompletes++;
            } else {
                const done = val === true ? 1 : 0;
                data.push(done);
                totalValue += done;
                if (done) { activeDays++; totalCompletes++; }
            }
        }
        const avgValue = activeDays > 0 ? totalValue / activeDays : 0;

        const sStats = getStreakStats(target);
        document.getElementById('streakContainer').innerHTML = `
            <div style="margin-top:10px; border-bottom:1px solid var(--border); padding-bottom:15px;">
                <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                    <span class="current-tag">⚡ ATTUALE: ${sStats.current} gg</span>
                    <span class="streak-tag">🏆 TOP 3 MIGLIORI</span>
                </div>
                ${sStats.best3.length > 0 ? sStats.best3.map((s, idx) => `
                    <div class="summary-item" style="padding:10px 15px; margin-bottom:6px; border-left: 4px solid ${idx === 0 ? 'var(--streak)' : 'var(--border)'}">
                        <span><b>#${idx + 1}</b> &nbsp; 🔥 <b>${s.count} giorni</b></span>
                        <span style="font-size:0.8em; color:var(--subtext);">fino al ${new Date(s.end).toLocaleDateString('it-IT')}</span>
                    </div>
                `).join('') : '<p style="text-align:center; color:var(--subtext); font-size:0.8em;">Nessuna sequenza</p>'}
            </div>`;

        let hExpected = 0;
        const f = h.frequency || 'daily';
        if (f === 'daily') hExpected = lastDay;
        else if (f === 'days') {
            for(let d=1; d<=lastDay; d++) if(h.frequencyDays?.includes(new Date(y,m,d).getDay())) hExpected++;
        } else if (f === 'weekly') {
            hExpected = Math.ceil(lastDay / 7) * (h.frequencyWeekly || 3);
        }

        document.getElementById('statPerc').innerText = Math.round((totalCompletes / (hExpected || 1)) * 100) + "%";
        document.getElementById('statCount').innerText = totalCompletes;
        document.getElementById('statLabelCount').innerText = "VOLTE NEL MESE (SU " + hExpected + ")";

        const unit = (h.type === 'value' && h.unit) ? ' ' + h.unit : '';
        document.getElementById('statTotal').innerText = parseFloat(totalValue.toFixed(1)) + unit;
        document.getElementById('statLabelTotal').innerText = "TOTALE MESE";
        document.getElementById('statAvg').innerText = parseFloat(avgValue.toFixed(2)) + unit;
        document.getElementById('statLabelAvg').innerText = h.type === 'value' ? "MEDIA (GG ATTIVI)" : "MEDIA GIORNALIERA";

        renderCalendarBase(document.getElementById('miniCalendar'), statsMonth, false, (dStr) => {
            if (h.type === 'value') {
                coreSetManualProgress(target, () => {
                    coreRenderStats(statsMonth, renderCalendarBase);
                }, dStr);
            } else {
                coreToggleCheck(target, () => {
                    coreRenderStats(statsMonth, renderCalendarBase);
                }, dStr);
            }
        }, target);
    }

    if (window.myChart) window.myChart.destroy();
    const singleHabit = target !== 'all' ? habits.find(x => x.id === target) : null;
    const barColor = singleHabit?.color || '#4a90e2';
    const isNumeric = singleHabit?.type === 'value';

    // 1) DISEGNA IL GRAFICO A BARRE MENSILE
    const statsChartCanvas = document.getElementById('statsChart');
    if (target === 'all' || isNumeric) {
        statsChartCanvas.style.display = 'block';
        statsChartCanvas.style.maxHeight = "200px";
        statsChartCanvas.style.height = "200px";
        window.myChart = new Chart(statsChartCanvas, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Valore', data, backgroundColor: barColor, borderRadius: 6 }] },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: isDark ? '#aaa' : '#666',
                            ...(isNumeric ? {} : { stepSize: 1 })
                        },
                        grid: { color: isDark ? '#333' : '#eee' }
                    },
                    x: {
                        ticks: { color: isDark ? '#aaa' : '#666', maxTicksLimit: 10, maxRotation: 0 },
                        grid: { display: false }
                    }
                }
            }
        });
    } else {
        statsChartCanvas.style.display = 'none';
    }

    // 2) DISEGNA IL GRAFICO RADIALE (TUTTO IL TEMPO)
    if (window.radarChartObj) window.radarChartObj.destroy();
    
    let radarLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    let radarData = [0, 0, 0, 0, 0, 0, 0];
    let radarExpected = [0, 0, 0, 0, 0, 0, 0];
    
    // Trova la data di inizio assoluta analizzando tutti i log nel database
    const allDatesLogs = Object.keys(logs).sort();
    let firstDate = allDatesLogs.length > 0 ? new Date(allDatesLogs[0]) : new Date();
    firstDate.setHours(0,0,0,0);
    const todayRadar = new Date();
    todayRadar.setHours(0,0,0,0);
    
    let tempRadar = new Date(firstDate);
    // Cosa andiamo ad analizzare?
    const habitsToCheck = target === 'all' ? habits.filter(h => !h.archived) : [singleHabit];
    
    while (tempRadar <= todayRadar) {
        let dStr = getLocalISODate(tempRadar);
        let dayOfWeek = tempRadar.getDay();
        let radarIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Lun, 6=Dom
        
        let expectedCount = 0;
        let doneCount = 0;
        
        habitsToCheck.forEach(h => {
             if (!h) return;
             const freq = h.frequency || 'daily';
             let expected = false;
             if (freq === 'daily' || freq === 'weekly') expected = true;
             else if (freq === 'days') expected = h.frequencyDays?.includes(dayOfWeek);
             
             if (expected) {
                 expectedCount++;
                 const val = logs[dStr]?.[h.id];
                 const isDone = (h.type === 'value' ? val >= h.target : val === true);
                 if (isDone) doneCount++;
             }
        });

        radarExpected[radarIdx] += expectedCount;
        radarData[radarIdx] += doneCount;
        
        tempRadar.setDate(tempRadar.getDate() + 1);
    }
    
    let radarPercs = [];
    for (let i = 0; i < 7; i++) {
        radarPercs.push(radarExpected[i] > 0 ? Math.round((radarData[i] / radarExpected[i]) * 100) : 0);
    }
    
    const radarContainer = document.getElementById('radarContainer');
    // Nascondiamo il contenitore se non ci sono dati attesi (quasi mai vero)
    if (habitsToCheck.length === 0 || radarExpected.reduce((a,b)=>a+b, 0) === 0) {
        radarContainer.classList.add('hidden');
    } else {
        radarContainer.classList.remove('hidden');
        window.radarChartObj = new Chart(document.getElementById('radarChart'), {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [{
                    label: '% Completamento Storico',
                    data: radarPercs,
                    backgroundColor: barColor + '40', // 25% opacity
                    borderColor: barColor,
                    pointBackgroundColor: barColor,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: barColor,
                    borderWidth: 2,
                }]
            },
            options: {
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) { return ' ' + context.raw + '% Storico'; }
                        }
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: isDark ? '#444' : '#ddd' },
                        grid: { color: isDark ? '#444' : '#ddd' },
                        pointLabels: { color: isDark ? '#aaa' : '#666', font: { size: 12, weight: 'bold' } },
                        ticks: { display: false, min: 0, max: 100, stepSize: 20 }
                    }
                },
                maintainAspectRatio: false
            }
        });
    }
}
