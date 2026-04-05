// --- STATO ---
let viewMonth = new Date();
let statsMonth = new Date();

// --- INIZIALIZZAZIONE ---
async function init() {
    // Carica il tema
    if (localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeBtn').innerText = '☀️';
    }

    // Registra Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => console.log('PWA Ready'));
    }

    // Event Listeners
    setupEventListeners();

    // Controllo Sessione Supabase
    await checkSession(
        (user) => {
            document.getElementById('authOverlay').classList.add('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
            render();
        },
        () => {
            document.getElementById('authOverlay').classList.remove('hidden');
            document.getElementById('logoutBtn').classList.add('hidden');
        }
    );
}

function setupEventListeners() {
    // Theme
    document.getElementById('themeBtn').onclick = () => coreToggleTheme();
    
    // Auth Handlers
    window.handleLogin = async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        const err = document.getElementById('authError');
        err.innerText = "Accesso in corso...";
        try {
            await coreLogin(email, pass);
            init(); // Ricarica lo stato
        } catch (e) { err.innerText = "Errore: " + e.message; }
    };

    window.handleSignup = async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        const err = document.getElementById('authError');
        err.innerText = "Registrazione in corso...";
        try {
            await coreSignup(email, pass);
            err.innerText = "Registrazione completata! Controlla l'email per confermare (se richiesto) o prova ad accedere.";
        } catch (e) { err.innerText = "Errore: " + e.message; }
    };

    window.handleLogout = () => coreLogout();

    // Habits
    window.addHabit = () => coreAddHabit(() => {
        render();
        toggleEditor(false);
    });
    window.archiveHabit = () => {
        if (coreArchiveHabit(() => {
            render();
            toggleEditor(false);
            coreFillSelector(); // Aggiorna selettore analisi
        })) { /* success */ }
    };
    
    window.restoreHabit = () => {
        if (coreRestoreHabit(() => {
            render();
            toggleEditor(false);
            coreFillSelector();
        })) { /* success */ }
    };

    window.deleteHabitPermanent = () => {
        if (coreDeleteHabitPermanent(() => {
            render();
            toggleEditor(false);
            coreFillSelector();
        })) { /* success */ }
    };

    window.manageSelectedHabit = () => {
        const sel = document.getElementById('habitSelector');
        if (sel && sel.value !== 'all') {
            toggleEditor(true, sel.value);
        } else {
            alert("Seleziona prima un'abitudine specifica dal menu a tendina.");
        }
    };
    
    window.addEventListener('toggle-check', (e) => coreToggleCheck(e.detail, render));
    window.addEventListener('change-progress', (e) => coreChangeProgress(e.detail.id, e.detail.delta, render));
    window.addEventListener('manual-progress', (e) => coreSetManualProgress(e.detail, render));
    window.addEventListener('edit-habit', (e) => {
        toggleEditor(true, e.detail);
    });
    window.addEventListener('render-stats', () => coreRenderStats(statsMonth, renderCalendarBase));

    // Editor UI
    window.toggleEditor = (show, habitId = null) => {
        const overlay = document.getElementById('editorOverlay');
        overlay.classList.toggle('hidden', !show);
        if (show) {
            corePopulateEditor(habitId);
            document.getElementById('habitInput').focus();
        }
    };

    // Advanced UI
    window.toggleAdvanced = () => {
        const panel = document.getElementById('advancedPanel');
        const btn = document.getElementById('advBtn');
        panel.classList.toggle('hidden');
        btn.innerText = panel.classList.contains('hidden') ? "⚙️" : "❌";
    };

    window.updateAdvUI = () => {
        const type = document.getElementById('habitType').value;
        const advFields = document.querySelectorAll('.adv-field');
        // Usa style.display direttamente: sovrascrive correttamente l'inline style del div
        advFields.forEach(f => {
            f.style.display = (type === 'value') ? 'grid' : 'none';
        });
    };

    window.updateFreqUI = () => {
        const freq = document.getElementById('habitFrequency').value;
        document.getElementById('freqDaysPanel').classList.toggle('hidden', freq !== 'days');
        document.getElementById('freqWeeklyPanel').classList.toggle('hidden', freq !== 'weekly');
    };

    document.querySelectorAll('.freq-day').forEach(d => {
        d.onclick = () => d.classList.toggle('active');
    });

    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.onclick = () => {
            const parent = btn.parentElement;
            parent.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (parent.id === 'segType') {
                document.getElementById('habitType').value = btn.dataset.val;
                updateAdvUI();
            } else if (parent.id === 'segFreq') {
                document.getElementById('habitFrequency').value = btn.dataset.val;
                updateFreqUI();
            }
        };
    });

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.onclick = () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            document.getElementById('habitColor').value = dot.dataset.color;
        };
    });

    document.querySelectorAll('.emoji-opt').forEach(opt => {
        opt.onclick = () => {
            // Rimuovi attivo da tutti, aggiungi all'emoji cliccata
            document.querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            document.getElementById('habitEmoji').value = opt.innerText.trim();
        };
    });

    // Navigation
    window.switchSection = (type) => {
        coreSwitchSection(type, () => {
            coreFillSelector();
            coreRenderStats(statsMonth, renderCalendarBase);
        });
        render(); // Sempre: ri-renderizza il grid in base alla tab ora attiva
    };
    
    window.changeMonth = (dir) => {
        viewMonth.setMonth(viewMonth.getMonth() + dir);
        render();
    };

    window.changeStatsDate = (dir) => {
        statsMonth.setMonth(statsMonth.getMonth() + dir);
        coreRenderStats(statsMonth, renderCalendarBase);
    };

    window.onHabitSelectorChange = () => coreRenderStats(statsMonth, renderCalendarBase);

    // Backup
    window.exportData = () => coreExportData();
    window.importData = (e) => coreImportData(e, render);
    window.cleanupDatabase = () => {
        const removed = coreCleanupOrphanedLogs();
        if (removed > 0) {
            alert(`Pulizia completata! Rimossi ${removed} record di abitudini eliminate in precedenza.`);
            render();
        } else {
            alert("Il tuo database è già pulito. Nessun dato orfano trovato.");
        }
    };
}

function render() {
    coreRenderAll(viewMonth, (dateStr) => {
        setSelectedDate(dateStr);
        render();
    });
}

window.init = init;
window.render = render;

document.addEventListener('DOMContentLoaded', init);
