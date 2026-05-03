// Helper: parsing corretto di stringhe data ISO in timezone locale
// IMPORTANTE: new Date('2026-04-19') viene parsato come UTC midnight, non locale!
// In UTC+2 questo crea April 18 alle 22:00 locali, causando bug nel calcolo streak.
function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // midnight locale, nessun problema timezone
}

// Helper: restituisce la data del lunedì ISO della settimana di una data stringa
function getISOWeekMonday(dateStr) {
    const d = parseLocalDate(dateStr); // Fix: usa parseLocalDate invece di new Date()
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // porta a lunedì ISO
    d.setDate(d.getDate() + diff);
    return getLocalISODate(d);
}

function getStreakStats(habitId) {
    const h = habits.find(x => x.id === habitId);
    if (!h) return { best3: [], current: 0, unit: 'gg' };
    if (!h.frequency) h.frequency = 'daily';

    // Date in cui l'abitudine è stata COMPLETATA
    const doneDates = Object.keys(logs).filter(d => {
        const val = logs[d]?.[habitId];
        return h.type === 'value' ? val >= h.target : val === true;
    }).sort();

    if (doneDates.length === 0) return { best3: [], current: 0, unit: 'gg' };

    // FIX #4: Set per lookup O(1) invece di Array.includes O(n)
    const doneDatesSet = new Set(doneDates);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalISODate(today);

    let streaks = [];

    // --- FIX #1 e #3: Logica WEEKLY corretta ---
    // Conta settimane ISO consecutive in cui si raggiunge il target (X volte a settimana)
    if (h.frequency === 'weekly') {
        const weeklyTarget = h.frequencyWeekly || 3;

        // Raggruppa le date completate per settimana ISO (chiave = lunedì della settimana)
        const weekMap = {};
        doneDates.forEach(d => {
            const weekKey = getISOWeekMonday(d);
            weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
        });

        // Filtra le settimane in cui il target è stato raggiunto e ordinale
        const successWeeks = Object.keys(weekMap)
            .filter(w => weekMap[w] >= weeklyTarget)
            .sort();

        if (successWeeks.length === 0) return { best3: [], current: 0, unit: 'sett.' };

        // Calcola streak consecutive di settimane (7 giorni di distanza tra lunedì)
        // Math.round gestisce i rari casi di transizione DST (+/- 1 ora)
        let sc = { count: 1, start: successWeeks[0], end: successWeeks[0] };
        for (let i = 1; i < successWeeks.length; i++) {
            const diffDays = (parseLocalDate(successWeeks[i]) - parseLocalDate(successWeeks[i - 1])) / 86400000;
            if (Math.round(diffDays) === 7) {
                sc.count++;
                sc.end = successWeeks[i];
            } else {
                streaks.push({ ...sc });
                sc = { count: 1, start: successWeeks[i], end: successWeeks[i] };
            }
        }
        streaks.push(sc);

        // FIX #3: Streak corrente = l'ultima settimana di successo è questa o quella scorsa
        const thisWeekMonday = getISOWeekMonday(todayStr);
        // Fix: usa parseLocalDate per evitare bug timezone su new Date(string)
        const lastWeekDate = parseLocalDate(thisWeekMonday);
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        const lastWeekMonday = getLocalISODate(lastWeekDate);

        const last = streaks[streaks.length - 1];
        const currentCount = (last && (last.end === thisWeekMonday || last.end === lastWeekMonday))
            ? last.count : 0;

        return {
            best3: [...streaks].sort((a, b) => b.count - a.count).slice(0, 3),
            current: currentCount,
            unit: 'sett.'
        };
    }

    // --- Logica DAILY e DAYS ---
    // Costruiamo la lista di giorni in cui l'abitudine ERA PREVISTA finora
    // Fix timezone: parseLocalDate crea la data a mezzanotte locale (non UTC)
    // Senza questo, new Date('2026-04-19') in UTC+2 = April 18 22:00 locale
    // e il ciclo while non includeva mai la data odierna in expectedDates
    const firstLog = parseLocalDate(doneDates[0]);
    let expectedDates = [];
    let temp = new Date(firstLog);

    while (temp <= today) {
        const dStr = getLocalISODate(temp);
        const day = temp.getDay();
        const show = h.frequency === 'daily' || (h.frequency === 'days' && h.frequencyDays.includes(day));
        if (show) expectedDates.push(dStr);
        temp.setDate(temp.getDate() + 1);
    }

    // FIX #4: uso doneDatesSet invece di doneDates.includes
    let sc = { count: 0, start: null, end: null };
    expectedDates.forEach(d => {
        if (doneDatesSet.has(d)) {
            if (sc.count === 0) sc.start = d;
            sc.count++;
            sc.end = d;
        } else {
            if (sc.count > 0) streaks.push({ ...sc });
            sc = { count: 0, start: null, end: null };
        }
    });
    if (sc.count > 0) streaks.push(sc);

    // Streak corrente: attiva se:
    // 1) last.end === oggi → abitudine già completata oggi
    // 2) last.end === ultimo giorno PREVISTO prima di oggi → l'utente non ha ancora completato oggi
    //    ma la streak non è rotta (es. la streak va fino a ieri, oggi non è ancora finito)
    // NOTA: non si usa lastExpected direttamente perché può essere oggi stesso (non ancora fatto)
    const lastExpectedBeforeToday = [...expectedDates].reverse().find(d => d < todayStr) ?? null;
    const last = streaks[streaks.length - 1];
    const currentCount = (last && (last.end === todayStr || last.end === lastExpectedBeforeToday))
        ? last.count : 0;

    return {
        best3: [...streaks].sort((a, b) => b.count - a.count).slice(0, 3),
        current: currentCount,
        unit: 'gg'
    };
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
        
        // Trova tutte le settimane ISO che si sovrappongono a questo mese
        const weeksInMonth = new Set();
        for (let d = 1; d <= lastDay; d++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            weeksInMonth.add(getISOWeekMonday(dStr));
        }
        
        // Calcolo totale atteso per il mese e pre-calcolo progressi settimanali
        let totalExpected = 0;
        habits.forEach(h => {
            const freq = h.frequency || 'daily';
            if (freq === 'daily') totalExpected += lastDay;
            else if (freq === 'days') {
                for (let d=1; d<=lastDay; d++) {
                    if (h.frequencyDays?.includes(new Date(y, m, d).getDay())) totalExpected++;
                }
            } else if (freq === 'weekly') {
                const target = h.frequencyWeekly || 3;
                totalExpected += weeksInMonth.size * target;
                
                let hProg = 0;
                weeksInMonth.forEach(mondayStr => {
                    const comps = getCompletionsInWeek(h.id, mondayStr);
                    hProg += Math.min(comps, target);
                });
                hMap[h.id] = hProg;
                totalProgress += hProg;
            }
        });

        for (let d = 1; d <= lastDay; d++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dd = new Date(dStr);
            const dayOfWeek = dd.getDay();
            const dayLogs = logs[dStr] || {};
            
            let completedToday = 0;
            let requiredTodayCount = 0;
            let requiredCompletedToday = 0;

            habits.forEach(h => {
                const freq = h.frequency || 'daily';
                let isRequiredToday = false;
                if (freq === 'daily') isRequiredToday = true;
                else if (freq === 'days') isRequiredToday = h.frequencyDays?.includes(dayOfWeek);

                if (isRequiredToday) requiredTodayCount++;

                const val = dayLogs[h.id];
                const isDone = (h.type === 'value' ? val >= h.target : val === true);
                if (isDone) { 
                    if (freq !== 'weekly') {
                        hMap[h.id]++; 
                        totalProgress++;
                    }
                    completedToday++; 
                    if (isRequiredToday) requiredCompletedToday++;
                }
            });

            labels.push(d);
            data.push(completedToday);
            // totalProgress viene già incrementato per le abitudini non settimanali nel loop sopra
            
            if (requiredTodayCount > 0) {
                if (requiredCompletedToday >= requiredTodayCount) perfectDays++;
            } else if (completedToday > 0) {
                perfectDays++;
            }
        }
        
        // totalExpected è già stato calcolato all'inizio

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
                const target = h.frequencyWeekly || 3;
                hExpected = weeksInMonth.size * target;
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
        const streakUnit = sStats.unit || 'gg';
        const streakLabel = streakUnit === 'sett.' ? 'settimane' : 'giorni';
        document.getElementById('streakContainer').innerHTML = `
            <div style="margin-top:10px; border-bottom:1px solid var(--border); padding-bottom:15px;">
                <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                    <span class="current-tag">⚡ ATTUALE: ${sStats.current} ${streakUnit}</span>
                    <span class="streak-tag">🏆 TOP 3 MIGLIORI</span>
                </div>
                ${sStats.best3.length > 0 ? sStats.best3.map((s, idx) => `
                    <div class="summary-item" style="padding:10px 15px; margin-bottom:6px; border-left: 4px solid ${idx === 0 ? 'var(--streak)' : 'var(--border)'}">
                        <span><b>#${idx + 1}</b> &nbsp; 🔥 <b>${s.count} ${streakLabel}</b></span>
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
            const weeksInMonth = new Set();
            for (let d = 1; d <= lastDay; d++) {
                const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                weeksInMonth.add(getISOWeekMonday(dStr));
            }
            const target = h.frequencyWeekly || 3;
            hExpected = weeksInMonth.size * target;
            
            // Per abitudini settimanali, i completamenti mensili considerano le settimane ISO sovrapposte
            let hProg = 0;
            weeksInMonth.forEach(mondayStr => {
                const comps = getCompletionsInWeek(h.id, mondayStr);
                hProg += Math.min(comps, target);
            });
            totalCompletes = hProg;
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
