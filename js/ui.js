// --- STATO UI GLOBALE ---
let selectedDate = new Date().toISOString().split('T')[0];
let lpTimer = null;

function setSelectedDate(date) {
    selectedDate = date;
}

// --- FUNZIONI UI ---
function coreToggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    document.getElementById('themeBtn').innerText = next === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', next);
    const statsSection = document.getElementById('stats-section');
    if(statsSection && !statsSection.classList.contains('hidden')) {
        // Trigger renderStats if available
        window.dispatchEvent(new CustomEvent('render-stats'));
    }
}

function corePopulateEditor(habitId = null) {
    const input = document.getElementById('habitInput');
    const type = document.getElementById('habitType');
    const target = document.getElementById('habitTarget');
    const unit = document.getElementById('habitUnit');
    const increment = document.getElementById('habitIncrement');
    const freq = document.getElementById('habitFrequency');
    const freqWeekly = document.getElementById('habitFreqWeekly');
    const emoji = document.getElementById('habitEmoji');
    const colorInput = document.getElementById('habitColor');
    const editId = document.getElementById('editHabitId');
    const btnArchive = document.getElementById('btnArchiveHabit');
    const btnRestore = document.getElementById('btnRestoreHabit');
    const btnDeletePerm = document.getElementById('btnDeletePermanent');
    const btnConfirm = document.getElementById('btnConfirmHabit');
    const header = document.querySelector('#editorSheet h3');

    // Reset UI
    document.querySelectorAll('.freq-day').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));

    if (habitId) {
        const h = habits.find(x => x.id === habitId);
        input.value = h.name;
        type.value = h.type;
        target.value = h.target;
        unit.value = h.unit;
        increment.value = h.increment;
        freq.value = h.frequency || 'daily';
        freqWeekly.value = h.frequencyWeekly || 3;
        emoji.value = h.emoji || '';
        colorInput.value = h.color || '#4a90e2';
        
        // Active Color Dot
        const activeDot = document.querySelector(`.color-dot[data-color="${colorInput.value}"]`);
        if (activeDot) activeDot.classList.add('active');

        if (h.frequencyDays) {
            h.frequencyDays.forEach(day => {
                const el = document.querySelector(`.freq-day[data-day="${day}"]`);
                if (el) el.classList.add('active');
            });
        }
        editId.value = h.id;
        
        // Pannello pulsanti basato su archivio
        if (h.archived) {
            btnArchive.classList.add('hidden');
            btnRestore.classList.remove('hidden');
            btnConfirm.classList.add('hidden'); // Non salviamo modifiche se archiviata (va prima ripristinata)
        } else {
            btnArchive.classList.remove('hidden');
            btnRestore.classList.add('hidden');
            btnConfirm.classList.remove('hidden');
        }
        btnDeletePerm.classList.remove('hidden');

        btnConfirm.innerText = "SALVA MODIFICHE";
        header.innerText = h.archived ? "Abitudine Archiviata" : "Modifica Abitudine";
    } else {
        input.value = '';
        type.value = 'binary';
        target.value = 1;
        unit.value = '';
        increment.value = 1;
        freq.value = 'daily';
        freqWeekly.value = 3;
        emoji.value = '';
        colorInput.value = '#4a90e2';
        document.querySelector('.color-dot[data-color="#4a90e2"]').classList.add('active');
        editId.value = '';
        btnArchive.classList.add('hidden');
        btnRestore.classList.add('hidden');
        btnDeletePerm.classList.add('hidden');
        btnConfirm.classList.remove('hidden');
        btnConfirm.innerText = "AGGIUNGI ABITUDINE";
        header.innerText = "Nuova Abitudine";
    }
    updateAdvUI();
    updateFreqUI();
}

function coreAddHabit(onComplete) {
    const input = document.getElementById('habitInput');
    const val = input.value.trim();
    if (val) {
        const freq = document.getElementById('habitFrequency').value;
        const freqWeekly = parseInt(document.getElementById('habitFreqWeekly').value) || 3;
        const freqDays = Array.from(document.querySelectorAll('.freq-day.active')).map(el => parseInt(el.dataset.day));
        
        const type = document.getElementById('habitType').value;
        const target = parseFloat(document.getElementById('habitTarget').value) || 1;
        const unit = document.getElementById('habitUnit').value || "";
        const increment = parseFloat(document.getElementById('habitIncrement').value) || 1;
        
        const emoji = document.getElementById('habitEmoji').value.trim();
        const color = document.getElementById('habitColor').value;

        const editId = document.getElementById('editHabitId').value;
        
        const habitData = {
            name: val,
            type: type,
            target: target,
            unit: unit,
            increment: increment,
            frequency: freq,
            frequencyWeekly: freqWeekly,
            frequencyDays: freqDays,
            emoji: emoji,
            color: color
        };

        if (editId) {
            const h = habits.find(x => x.id === editId);
            if (h) Object.assign(h, habitData);
        } else {
            habits.push({
                id: 'h_' + Math.random().toString(36).substr(2, 9),
                ...habitData
            });
        }
        
        // Reset editor state immediately
        corePopulateEditor(null);
        save(onComplete);
    }
}

function coreArchiveHabit(onComplete) {
    const editId = document.getElementById('editHabitId').value;
    if (editId) {
        const h = habits.find(x => x.id === editId);
        if (h) {
            if (confirm(`Vuoi archiviare "${h.name}"? Non apparirà più in home ma manterrai i dati.`)) {
                h.archived = true;
                save(onComplete);
                return true;
            }
        }
    }
    return false;
}

function coreRestoreHabit(onComplete) {
    const editId = document.getElementById('editHabitId').value;
    if (editId) {
        const h = habits.find(x => x.id === editId);
        if (h) {
            h.archived = false;
            save(onComplete);
            return true;
        }
    }
    return false;
}

function coreDeleteHabitPermanent(onComplete) {
    const editId = document.getElementById('editHabitId').value;
    if (editId) {
        const h = habits.find(x => x.id === editId);
        if (h) {
            if (confirm(`ATTENZIONE: Eliminando "${h.name}" cancellerai DEFINITIVAMENTE anche tutta la sua cronologia. Continuare?`)) {
                const idx = habits.findIndex(x => x.id === editId);
                habits.splice(idx, 1);
                
                // Pulisci i log associati in tutte le date
                for (const date in logs) {
                    if (logs[date][editId] !== undefined) {
                        delete logs[date][editId];
                        // Se la data è rimasta vuota la togliamo? Meglio di no, un oggetto vuoto va bene.
                    }
                }
                
                save(onComplete);
                return true;
            }
        }
    }
    return false;
}


function coreToggleCheck(habitId, onComplete) {
    if (!logs[selectedDate]) logs[selectedDate] = {};
    
    if (logs[selectedDate][habitId]) {
        delete logs[selectedDate][habitId];
    } else {
        logs[selectedDate][habitId] = true;
    }
    save(onComplete);
}

function coreChangeProgress(habitId, delta, onComplete) {
    if (!logs[selectedDate]) logs[selectedDate] = {};
    
    let current = logs[selectedDate][habitId] || 0;
    if (typeof current !== 'number') current = 0;
    
    let newVal = Math.max(0, current + delta);
    if (newVal === 0) delete logs[selectedDate][habitId];
    else logs[selectedDate][habitId] = newVal;
    
    save(onComplete);
}

function coreSetManualProgress(habitId, onComplete) {
    const habit = habits.find(h => h.id === habitId);
    let current = logs[selectedDate]?.[habitId] || 0;
    const val = prompt(`Inserisci valore manuale per ${habit.name} (${habit.unit}):`, current);
    if (val !== null) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num)) {
            if (!logs[selectedDate]) logs[selectedDate] = {};
            if (num <= 0) delete logs[selectedDate][habitId];
            else logs[selectedDate][habitId] = num;
            save(onComplete);
        }
    }
}

function coreSwitchSection(type, onStatsSwitch) {
    document.getElementById('calendar-section').classList.toggle('hidden', type !== 'calendar');
    document.getElementById('stats-section').classList.toggle('hidden', type !== 'stats');
    document.querySelectorAll('.s-tab').forEach(t => {
        t.classList.toggle('active', t.id === 'tab-' + (type === 'calendar' ? 'cal' : 'stats'));
    });
    if(type === 'stats' && onStatsSwitch) {
        onStatsSwitch();
    }
}

function coreFillSelector() {
    const sel = document.getElementById('habitSelector');
    if (!sel) return;
    const prev = sel.value;
    let html = '<option value="all">📊 Panoramica Generale (Mese)</option>';
    habits.forEach(h => {
        const name = h.archived ? `📦 [ARCHIVIATA] ${h.name}` : `🎯 Analisi: ${h.name}`;
        html += `<option value="${h.id}" ${prev === h.id ? 'selected' : ''}>${name}</option>`;
    });
    sel.innerHTML = html;
}

function renderCalendarBase(container, dateObj, isMain, onDateSelect, targetHabitId = null) {
    const y = dateObj.getFullYear(), m = dateObj.getMonth();
    const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    container.innerHTML = ['L','M','M','G','V','S','D'].map(d => `<div class="day-name">${d}</div>`).join('');
    
    for(let i=0; i<firstDay; i++) {
        container.innerHTML += `<div></div>`;
    }
    
    for(let d=1; d<=daysInMonth; d++) {
        const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayLogs = logs[dStr] || {};
        let className = "day";
        if (isMain && dStr === selectedDate) className += " selected";
        
        let isDoneForDay = false;
        let completedCount = 0;
        let fillHtml = "";

        if (targetHabitId) {
            const h = habits.find(x => x.id === targetHabitId);
            const val = dayLogs[targetHabitId] || 0;
            const hColor = h?.color || 'var(--success)';
            const completed = (h?.type === 'value' ? val >= h.target : val === true);
            const perc = (h?.type === 'value' ? Math.min(100, (val / h.target) * 100) : (val === true ? 100 : 0));
            
            isDoneForDay = completed;
            if (perc > 0) {
                fillHtml = `<div class="habit-progress-bg" style="background:${hColor}; height:${perc}%; opacity:${completed ? 1 : 0.4}"></div>`;
            }
        } else {
            // Overview: no green bg, count only COMPLETED habits
            habits.forEach(h => {
                if (h.archived) return;
                const val = dayLogs[h.id];
                const done = (h.type === 'value' ? val >= h.target : val === true);
                if (done) completedCount++;
            });
            isDoneForDay = false; // No green background in general overview
        }

        if (isDoneForDay) className += " checked";
        
        let badge = (isMain && completedCount > 0) ? `<div class="habit-count-badge">${completedCount}</div>` : "";
        
        const dayEl = document.createElement('div');
        dayEl.className = className;
        dayEl.innerHTML = `${fillHtml}<span>${d}</span>${badge}`;
        dayEl.onclick = () => onDateSelect(dStr);
        container.appendChild(dayEl);
    }
}

function getCompletionsInWeek(habitId, dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ISO Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0,0,0,0);

    let count = 0;
    const h = habits.find(x => x.id === habitId);
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(monday);
        checkDate.setDate(monday.getDate() + i);
        const s = checkDate.toISOString().split('T')[0];
        const val = logs[s]?.[habitId];
        const isDone = (h.type === 'value' ? val >= h.target : val === true);
        if (isDone) count++;
    }
    return count;
}

function coreRenderAll(viewMonth, onDateSelect) {
    const grid = document.getElementById('habitGrid');
    grid.className = "habit-grid";
    const dayLogs = logs[selectedDate] || {};
    const dObj = new Date(selectedDate);
    const dayOfWeek = dObj.getDay();
    
    // Filtro abitudini attivo per la data selezionata (escludendo le archiviate)
    const filteredHabits = habits.filter(h => {
        if (h.archived) return false;
        
        // Migrazione on-the-fly se manca frequenza
        if (!h.frequency) h.frequency = 'daily';

        if (h.frequency === 'daily') return true;
        if (h.frequency === 'days') {
            return h.frequencyDays && h.frequencyDays.includes(dayOfWeek);
        }
        if (h.frequency === 'weekly') {
            const count = getCompletionsInWeek(h.id, selectedDate);
            const target = h.frequencyWeekly || 3;
            // Mostra se non ancora completata per la settimana
            // OPPURE se è già stata fatta proprio OGGI (per permettere di vederla se appena segnata)
            const doneToday = (h.type === 'value' ? dayLogs[h.id] >= h.target : dayLogs[h.id] === true);
            return count < target || doneToday;
        }
        return true;
    });

    grid.innerHTML = filteredHabits.map((h, i) => {
        const val = dayLogs[h.id];
        const hColor = h.color || '#4a90e2';
        const emojiHtml = h.emoji ? `<span class="habit-emoji">${h.emoji}</span>` : '';
        
        let content = '';
        if (h.type === 'value') {
            const current = val || 0;
            const completed = current >= h.target;
            const perc = Math.min(100, (current / h.target) * 100);
            
            content = `
                <div class="habit-btn habit-numeric ${completed ? 'completed' : ''}" 
                    data-id="${h.id}" data-delta="${h.increment}"
                    style="cursor:pointer; border-color:${hColor}; color:${completed ? 'white' : hColor}">
                    <div class="habit-progress-bg" style="background:${hColor}; height:${perc}%; opacity:${completed ? 1 : 0.25}"></div>
                    <span class="habit-name">${emojiHtml} ${h.name}</span>
                    <div class="progress-val" data-manual="${h.id}" style="color:${completed ? 'white' : 'var(--primary)'}">
                        ${current} / ${h.target} <span class="unit" style="color:inherit">${h.unit}</span>
                    </div>
                </div>
            `;
        } else {
            const isActive = val === true;
            content = `
                <div class="habit-btn ${isActive ? 'active' : ''}" data-id="${h.id}" 
                    style="cursor:pointer; border-color:${hColor}; color:${isActive ? 'white' : hColor}">
                    <div class="habit-progress-bg" style="background:${hColor}; height:${isActive ? '100%' : '0%'}; opacity:${isActive ? 1 : 0}"></div>
                    <span class="habit-name">${emojiHtml} ${h.name}</span>
                </div>
            `;
        }
        return `<div class="habit-item">${content}</div>`;
    }).join('');

    // Eventi Click e Long-press
    grid.querySelectorAll('.habit-btn').forEach(btn => {
        const id = btn.dataset.id;
        const delta = parseFloat(btn.dataset.delta);

        const startLp = (e) => {
            if (lpTimer) clearTimeout(lpTimer);
            lpTimer = setTimeout(() => {
                lpTimer = null;
                window.dispatchEvent(new CustomEvent('edit-habit', { detail: id }));
            }, 700);
        };
        const resetLp = () => {
            if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; return true; }
            return false;
        };

        btn.onmousedown = startLp;
        btn.ontouchstart = (e) => {
            // Se tocchi il valore manuale, non avviare LP qui (gestito da stopPropagation)
            startLp(e);
        };

        btn.onmouseup = (e) => { 
            if(resetLp()) { 
                if (delta) window.dispatchEvent(new CustomEvent('change-progress', { detail: { id, delta } }));
                else window.dispatchEvent(new CustomEvent('toggle-check', { detail: id }));
            }
        };

        btn.ontouchend = (e) => {
            if(resetLp()) {
                e.preventDefault(); // Evita click fantasma
                if (delta) window.dispatchEvent(new CustomEvent('change-progress', { detail: { id, delta } }));
                else window.dispatchEvent(new CustomEvent('toggle-check', { detail: id }));
            }
        };
    });

    grid.querySelectorAll('.progress-val').forEach(pv => {
        pv.onclick = (e) => {
            e.stopPropagation();
            if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
            window.dispatchEvent(new CustomEvent('manual-progress', { detail: pv.dataset.manual }));
        };
        // Impedisci l'avvio del long-press del padre quando si tocca il valore
        pv.onmousedown = (e) => e.stopPropagation();
        pv.ontouchstart = (e) => e.stopPropagation();
    });

    const d = new Date(selectedDate);
    document.getElementById('dateLabel').innerText = d.toDateString() === new Date().toDateString() ? "Oggi" : d.toLocaleDateString('it-IT');
    document.getElementById('monthYear').innerText = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(viewMonth);
    
    const calGrid = document.getElementById('calendarGrid');
    renderCalendarBase(calGrid, viewMonth, true, onDateSelect);
}
