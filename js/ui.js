// --- STATO UI GLOBALE ---
let selectedDate = getLocalISODate();
let lpTimer = null;

function setSelectedDate(date) {
    selectedDate = date;
}

// --- UTILS PER ESPERIENZA UTENTE ---

// parseLocalDate è definita in stats.js (caricato prima di ui.js)

function isDatePerfect(dStr) {
    const dayLogs = logs[dStr] || {};
    const dObj = parseLocalDate(dStr);
    const dayOfWeek = dObj.getDay();
    
    let requiredTodayCount = 0;
    let requiredCompletedToday = 0;
    let completedCount = 0;

    habits.forEach(h => {
        if (h.archived) return;
        if (h.startDate && dStr < h.startDate) return;

        const params = getHabitParamsForDate(h, dStr);
        const freq = params.frequency || 'daily';
        let isRequiredToday = false;
        if (freq === 'daily') isRequiredToday = true;
        else if (freq === 'days') isRequiredToday = params.frequencyDays?.includes(dayOfWeek);

        if (isRequiredToday) requiredTodayCount++;

        const val = dayLogs[h.id];
        const done = (params.type === 'value' ? val >= params.target : val === true);
        if (done) {
            completedCount++;
            if (isRequiredToday) requiredCompletedToday++;
        }
    });

    if (requiredTodayCount > 0) {
        return requiredCompletedToday >= requiredTodayCount;
    } else {
        return completedCount > 0;
    }
}

function triggerHapticFeedback() {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(30);
        } catch(e) { console.log('Haptic vibration failed:', e); }
    }
}

// Micro confetti engine
function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ff7a00', '#ec4899', '#06b6d4'];
    const particles = [];
    
    // Center cluster
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 40,
            y: canvas.height + 20,
            angle: Math.PI * 1.5 + (Math.random() - 0.5) * (Math.PI * 0.4),
            speed: 10 + Math.random() * 12,
            radius: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 1,
            gravity: 0.3,
            drag: 0.96,
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }
    
    // Side fountain left
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: -10,
            y: canvas.height * 0.85,
            angle: -Math.PI * 0.15 + (Math.random() - 0.5) * (Math.PI * 0.15),
            speed: 16 + Math.random() * 8,
            radius: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 1,
            gravity: 0.28,
            drag: 0.95,
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }
    
    // Side fountain right
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: canvas.width + 10,
            y: canvas.height * 0.85,
            angle: -Math.PI * 0.85 + (Math.random() - 0.5) * (Math.PI * 0.15),
            speed: 16 + Math.random() * 8,
            radius: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 1,
            gravity: 0.28,
            drag: 0.95,
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }

    let animationId;
    const startTime = Date.now();
    const duration = 2000;

    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            p.speed *= p.drag;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed + p.gravity;
            p.rotation += p.rotationSpeed;
            
            const elapsed = Date.now() - startTime;
            if (elapsed > duration * 0.6) {
                p.opacity = Math.max(0, 1 - (elapsed - duration * 0.6) / (duration * 0.4));
            }
            
            if (p.opacity > 0 && p.y < canvas.height + 40 && p.x > -40 && p.x < canvas.width + 40) {
                active = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.radius, -p.radius / 2, p.radius * 2, p.radius);
                ctx.restore();
            }
        });
        
        if (active && Date.now() - startTime < duration) {
            animationId = requestAnimationFrame(update);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cancelAnimationFrame(animationId);
        }
    }
    
    update();
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialogOverlay');
        const titleEl = document.getElementById('customDialogTitle');
        const msgEl = document.getElementById('customDialogMessage');
        const inputWrapper = document.getElementById('customDialogInputWrapper');
        const btnCancel = document.getElementById('customDialogCancel');
        const btnConfirm = document.getElementById('customDialogConfirm');

        titleEl.innerText = title;
        msgEl.innerText = message;
        inputWrapper.classList.add('hidden');
        overlay.classList.remove('hidden');

        const cleanUp = () => {
            overlay.classList.add('hidden');
            btnCancel.onclick = null;
            btnConfirm.onclick = null;
        };

        btnCancel.onclick = () => {
            cleanUp();
            resolve(false);
        };

        btnConfirm.onclick = () => {
            cleanUp();
            resolve(true);
        };
    });
}

function showCustomPrompt(title, message, defaultValue = "") {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialogOverlay');
        const titleEl = document.getElementById('customDialogTitle');
        const msgEl = document.getElementById('customDialogMessage');
        const inputWrapper = document.getElementById('customDialogInputWrapper');
        const input = document.getElementById('customDialogInput');
        const btnCancel = document.getElementById('customDialogCancel');
        const btnConfirm = document.getElementById('customDialogConfirm');

        titleEl.innerText = title;
        msgEl.innerText = message;
        input.value = defaultValue;
        inputWrapper.classList.remove('hidden');
        overlay.classList.remove('hidden');
        
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

        const cleanUp = () => {
            overlay.classList.add('hidden');
            btnCancel.onclick = null;
            btnConfirm.onclick = null;
            input.onkeydown = null;
        };

        btnCancel.onclick = () => {
            cleanUp();
            resolve(null);
        };

        btnConfirm.onclick = () => {
            const val = input.value;
            cleanUp();
            resolve(val);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = input.value;
                cleanUp();
                resolve(val);
            }
        };
    });
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
        document.querySelectorAll('#segType .seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.val === h.type));
        target.value = h.target;
        unit.value = h.unit;
        increment.value = h.increment;
        freq.value = h.frequency || 'daily';
        document.querySelectorAll('#segFreq .seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.val === (h.frequency || 'daily')));
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
        document.querySelectorAll('#segType .seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.val === 'binary'));
        target.value = 1;
        unit.value = '';
        increment.value = 1;
        freq.value = 'daily';
        document.querySelectorAll('#segFreq .seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.val === 'daily'));
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
            if (h) {
                // Se campi significativi cambiano, salva uno snapshot della versione corrente
                const SIG = ['type', 'target', 'frequency', 'frequencyDays', 'frequencyWeekly'];
                const changed = SIG.some(f => JSON.stringify(h[f]) !== JSON.stringify(habitData[f]));
                if (changed && h.startDate) {
                    if (!h.history) h.history = [];
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    h.history.push({
                        validFrom: h.startDate,
                        validUntil: getLocalISODate(yesterday),
                        type: h.type,
                        target: h.target,
                        frequency: h.frequency || 'daily',
                        frequencyDays: h.frequencyDays ? [...h.frequencyDays] : [],
                        frequencyWeekly: h.frequencyWeekly || 3
                    });
                    habitData.startDate = getLocalISODate();
                }
                Object.assign(h, habitData);
            }
        } else {
            habits.push({
                id: 'h_' + Math.random().toString(36).substr(2, 9),
                startDate: getLocalISODate(),
                history: [],
                ...habitData
            });
        }
        
        // Reset editor state immediately
        corePopulateEditor(null);
        save(onComplete);
    }
}

async function coreArchiveHabit(onComplete) {
    const editId = document.getElementById('editHabitId').value;
    if (editId) {
        const h = habits.find(x => x.id === editId);
        if (h) {
            const confirmed = await showCustomConfirm(
                "Archivia Abitudine", 
                `Vuoi archiviare "${h.name}"? Non apparirà più in home ma manterrai i dati.`
            );
            if (confirmed) {
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

async function coreDeleteHabitPermanent(onComplete) {
    const editId = document.getElementById('editHabitId').value;
    if (editId) {
        const h = habits.find(x => x.id === editId);
        if (h) {
            const confirmed = await showCustomConfirm(
                "Eliminazione Definitiva", 
                `ATTENZIONE: Eliminando "${h.name}" cancellerai DEFINITIVAMENTE anche tutta la sua cronologia. Continuare?`
            );
            if (confirmed) {
                const idx = habits.findIndex(x => x.id === editId);
                habits.splice(idx, 1);
                
                // Pulisci i log associati in tutte le date
                for (const date in logs) {
                    if (logs[date][editId] !== undefined) {
                        delete logs[date][editId];
                    }
                }
                
                save(onComplete);
                return true;
            }
        }
    }
    return false;
}


function coreToggleCheck(habitId, onComplete, targetDate = selectedDate) {
    if (!logs[targetDate]) logs[targetDate] = {};
    
    const wasPerfect = isDatePerfect(targetDate);
    const wasCompletedBefore = logs[targetDate][habitId] === true;

    if (logs[targetDate][habitId]) {
        delete logs[targetDate][habitId];
        if (Object.keys(logs[targetDate]).length === 0) delete logs[targetDate];
    } else {
        logs[targetDate][habitId] = true;
        triggerHapticFeedback();
    }
    
    save(() => {
        const isPerfect = isDatePerfect(targetDate);
        if (!wasPerfect && isPerfect) {
            triggerConfetti();
        }
        if (onComplete) onComplete();
    });
}

function coreChangeProgress(habitId, delta, onComplete, targetDate = selectedDate) {
    if (!logs[targetDate]) logs[targetDate] = {};
    
    const habit = habits.find(h => h.id === habitId);
    const wasPerfect = isDatePerfect(targetDate);
    
    let current = logs[targetDate][habitId] || 0;
    if (typeof current !== 'number') current = 0;
    
    const wasCompletedBefore = current >= habit.target;
    let newVal = Math.max(0, current + delta);
    const isCompletedAfter = newVal >= habit.target;

    if (newVal === 0) {
        delete logs[targetDate][habitId];
        if (Object.keys(logs[targetDate]).length === 0) delete logs[targetDate];
    }
    else {
        logs[targetDate][habitId] = newVal;
    }
    
    if (!wasCompletedBefore && isCompletedAfter) {
        triggerHapticFeedback();
    }
    
    save(() => {
        const isPerfect = isDatePerfect(targetDate);
        if (!wasPerfect && isPerfect) {
            triggerConfetti();
        }
        if (onComplete) onComplete();
    });
}

async function coreSetManualProgress(habitId, onComplete, targetDate = selectedDate) {
    const habit = habits.find(h => h.id === habitId);
    let current = logs[targetDate]?.[habitId] || 0;
    if (typeof current !== 'number') current = 0;
    
    const wasPerfect = isDatePerfect(targetDate);
    const wasCompletedBefore = current >= habit.target;

    const formattedDate = parseLocalDate(targetDate).toLocaleDateString('it-IT');
    const val = await showCustomPrompt(
        `Inserisci valore manuale`,
        `Digita il valore per "${habit.name}" (${habit.unit || 'unità'}) in data ${formattedDate}:`,
        current
    );
    
    if (val !== null) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num)) {
            if (!logs[targetDate]) logs[targetDate] = {};
            
            const isCompletedAfter = num >= habit.target;

            if (num <= 0) {
                delete logs[targetDate][habitId];
                if (Object.keys(logs[targetDate]).length === 0) delete logs[targetDate];
            }
            else {
                logs[targetDate][habitId] = num;
            }
            
            if (!wasCompletedBefore && isCompletedAfter) {
                triggerHapticFeedback();
            }

            save(() => {
                const isPerfect = isDatePerfect(targetDate);
                if (!wasPerfect && isPerfect) {
                    triggerConfetti();
                }
                if (onComplete) onComplete();
            });
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
    let html = '<option value="all">\uD83D\uDCCA Panoramica Generale (Mese)</option>';
    habits.forEach(h => {
        const name = h.archived ? `\uD83D\udce6 [ARCHIVIATA] ${h.name}` : `\uD83C\uDFAF Analisi: ${h.name}`;
        html += `<option value="${h.id}" ${prev === h.id ? 'selected' : ''}>${name}</option>`;
    });
    sel.innerHTML = html;
}

// --- LOGICA CLICK CONTESTUALE ---
// Se la scheda Analisi è attiva: mostra le stats dell'abitudine cliccata.
// Se la scheda Calendario è attiva: comportamento normale (toggle / progress).
function handleHabitButtonClick(id, delta) {
    const statsSection = document.getElementById('stats-section');
    const statsActive = statsSection && !statsSection.classList.contains('hidden');

    if (statsActive) {
        // Scheda Analisi: seleziona l'abitudine nel selettore e aggiorna le statistiche
        const sel = document.getElementById('habitSelector');
        if (sel) {
            sel.value = id;
            coreFillSelector();
            if (window.onHabitSelectorChange) window.onHabitSelectorChange();
            // Porta l'utente alla sezione statistiche (utile se deve scrollare)
            statsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        // Scheda Calendario: comportamento originale
        if (delta) {
            window.dispatchEvent(new CustomEvent('change-progress', { detail: { id, delta } }));
        } else {
            window.dispatchEvent(new CustomEvent('toggle-check', { detail: id }));
        }
    }
}

function renderCalendarBase(container, dateObj, isMain, onDateSelect, targetHabitId = null) {
    const y = dateObj.getFullYear(), m = dateObj.getMonth();
    const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let calHtml = ['L','M','M','G','V','S','D'].map(d => `<div class="day-name">${d}</div>`).join('');
    for(let i=0; i<firstDay; i++) {
        calHtml += `<div></div>`;
    }
    container.innerHTML = calHtml;
    
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
            // Overview: no green bg, count only COMPLETED habits and check for perfect day
            let requiredTodayCount = 0;
            let requiredCompletedToday = 0;

            habits.forEach(h => {
                if (h.archived) return;
                // Salta se il giorno è precedente alla data di inizio dell'abitudine
                if (h.startDate && dStr < h.startDate) return;

                const params = getHabitParamsForDate(h, dStr);
                const freq = params.frequency || 'daily';
                let isRequiredToday = false;
                // Costruiamo la data per prendere il giorno della settimana
                const dDate = new Date(y, m, d);
                if (freq === 'daily') isRequiredToday = true;
                else if (freq === 'days') isRequiredToday = params.frequencyDays?.includes(dDate.getDay());

                if (isRequiredToday) requiredTodayCount++;

                const val = dayLogs[h.id];
                const done = (params.type === 'value' ? val >= params.target : val === true);
                if (done) {
                    completedCount++;
                    if (isRequiredToday) requiredCompletedToday++;
                }
            });
            
            isDoneForDay = false; // No green background in general overview
            
            let isPerfectDay = false;
            if (requiredTodayCount > 0) {
                if (requiredCompletedToday >= requiredTodayCount) isPerfectDay = true;
            } else if (completedCount > 0) {
                isPerfectDay = true; // Se non ci sono obblighi ma è stato fatto qualcosa
            }
            
            if (isPerfectDay) className += " perfect-day";
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
    const [y, m, dNum] = dateStr.split('-');
    const d = new Date(y, m - 1, dNum);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ISO Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0,0,0,0);

    let count = 0;
    const h = habits.find(x => x.id === habitId);
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(monday);
        checkDate.setDate(monday.getDate() + i);
        const s = getLocalISODate(checkDate);
        const val = logs[s]?.[habitId];
        const isDone = (h.type === 'value' ? val >= h.target : val === true);
        if (isDone) count++;
    }
    return count;
}

function coreRenderAll(viewMonth, onDateSelect) {
    const grid = document.getElementById('habitGrid');
    grid.className = "habit-grid";

    const statsSection = document.getElementById('stats-section');
    const statsActive = statsSection && !statsSection.classList.contains('hidden');

    if (statsActive) {
        // === STATS MODE: bottoni di navigazione (solo nome+emoji, niente obiettivi) ===
        const activeId = document.getElementById('habitSelector')?.value || 'all';
        const allHabits = habits.filter(h => !h.archived);

        const panoramicaActive = activeId === 'all';
        let html = `<div class="habit-item">
            <div class="habit-btn stats-nav-btn" data-id="all"
                style="cursor:pointer; border-color:#4a90e2; ${panoramicaActive ? 'background:#4a90e2; color:white; box-shadow:0 3px 10px rgba(74,144,226,0.4);' : 'color:#4a90e2;'}">
                <span class="habit-name">📊 Panoramica</span>
            </div>
        </div>`;

        html += allHabits.map(h => {
            const hColor = h.color || '#4a90e2';
            const isActive = activeId === h.id;
            const emojiHtml = h.emoji ? `<span class="habit-emoji">${h.emoji}</span>` : '';
            return `<div class="habit-item">
                <div class="habit-btn stats-nav-btn" data-id="${h.id}"
                    style="cursor:pointer; border-color:${hColor}; ${isActive ? `background:${hColor}; color:white; box-shadow:0 3px 10px rgba(0,0,0,0.2);` : `color:${hColor};`}">
                    <span class="habit-name">${emojiHtml} ${h.name}</span>
                </div>
            </div>`;
        }).join('');

        grid.innerHTML = html;

        // Click handlers: navigazione statistiche (nessun long-press)
        grid.querySelectorAll('.stats-nav-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const sel = document.getElementById('habitSelector');
                if (!sel) return;
                sel.value = id;
                coreFillSelector();
                if (window.onHabitSelectorChange) window.onHabitSelectorChange();
                statsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Aggiorna lo stato visivo attivo senza full re-render
                grid.querySelectorAll('.stats-nav-btn').forEach(b => {
                    const bH = habits.find(x => x.id === b.dataset.id);
                    const bColor = b.dataset.id === 'all' ? '#4a90e2' : (bH?.color || '#4a90e2');
                    b.style.cssText = `cursor:pointer; border-color:${bColor}; color:${bColor};`;
                });
                const aH = id === 'all' ? null : habits.find(x => x.id === id);
                const aColor = id === 'all' ? '#4a90e2' : (aH?.color || '#4a90e2');
                btn.style.cssText = `cursor:pointer; border-color:${aColor}; background:${aColor}; color:white; box-shadow:0 3px 10px rgba(0,0,0,0.2);`;
            };
        });

    } else {
        // === CALENDAR MODE: codice originale invariato ===
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
                        <div class="habit-edit-icon" data-id="${h.id}" title="Modifica">⚙️</div>
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
                        <div class="habit-edit-icon" data-id="${h.id}" title="Modifica">⚙️</div>
                        <div class="habit-progress-bg" style="background:${hColor}; height:${isActive ? '100%' : '0%'}; opacity:${isActive ? 1 : 0}"></div>
                        <span class="habit-name">${emojiHtml} ${h.name}</span>
                    </div>
                `;
            }
            return `<div class="habit-item">${content}</div>`;
        }).join('');

        // Eventi Click e Long-press (solo in modalità Calendario)
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
            btn.ontouchstart = (e) => { startLp(e); };

            btn.onmouseup = (e) => {
                if(resetLp()) { handleHabitButtonClick(id, delta); }
            };

            btn.ontouchend = (e) => {
                if(resetLp()) {
                    e.preventDefault();
                    handleHabitButtonClick(id, delta);
                }
            };
        });

        grid.querySelectorAll('.progress-val').forEach(pv => {
            pv.onclick = (e) => {
                e.stopPropagation();
                if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
                window.dispatchEvent(new CustomEvent('manual-progress', { detail: pv.dataset.manual }));
            };
            pv.onmousedown = (e) => e.stopPropagation();
            pv.ontouchstart = (e) => e.stopPropagation();
        });

        // Click handler per l'icona di modifica rapida
        grid.querySelectorAll('.habit-edit-icon').forEach(editBtn => {
            editBtn.onclick = (e) => {
                e.stopPropagation();
                if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
                window.dispatchEvent(new CustomEvent('edit-habit', { detail: editBtn.dataset.id }));
            };
            editBtn.onmousedown = (e) => e.stopPropagation();
            editBtn.ontouchstart = (e) => e.stopPropagation();
        });
    }

    // Aggiornamenti comuni (sempre, indipendente dalla tab)
    const d = new Date(selectedDate);
    document.getElementById('dateLabel').innerText = d.toDateString() === new Date().toDateString() ? "Oggi" : d.toLocaleDateString('it-IT');
    document.getElementById('monthYear').innerText = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(viewMonth);

    const calGrid = document.getElementById('calendarGrid');
    renderCalendarBase(calGrid, viewMonth, true, onDateSelect);
}

