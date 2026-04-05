// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = "https://jugivbvvpywoiejzcxbl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Z2l2YnZ2cHl3b2llanpjeGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODA0MzEsImV4cCI6MjA5MDI1NjQzMX0.IrQ9cUIUClD25XnBgVA_wC7swbG_vMU-CHPgNFWgFJ8";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- GESTIONE DATI ---
let habits = JSON.parse(localStorage.getItem('h_final_v3')) || ["Acqua", "Esercizio", "Lettura"];
let logs = JSON.parse(localStorage.getItem('l_final_v3')) || {};

function setHabits(newHabits) {
    habits = newHabits;
    checkMigration();
}

function setLogs(newLogs) {
    logs = newLogs;
    checkMigration();
}

function checkMigration() {
    let changed = false;
    // Migrate Habits
    if (habits.length > 0 && typeof habits[0] === 'string') {
        const nameToId = {};
        habits = habits.map(name => {
            const id = 'h_' + Math.random().toString(36).substr(2, 9);
            nameToId[name] = id;
            return { id, name, type: 'binary' };
        });
        
        // Migrate Logs
        const newLogs = {};
        for (const date in logs) {
            if (Array.isArray(logs[date])) {
                newLogs[date] = {};
                logs[date].forEach(name => {
                    const id = nameToId[name];
                    if (id) newLogs[date][id] = true;
                });
            } else {
                newLogs[date] = logs[date];
            }
        }
        logs = newLogs;
        changed = true;
    }
    if (changed) save();
}

function save(callback) {
    localStorage.setItem('h_final_v3', JSON.stringify(habits));
    localStorage.setItem('l_final_v3', JSON.stringify(logs));
    syncWithCloud();
    if (callback) callback();
}

// --- FUNZIONI CLOUD (SUPABASE) ---
async function syncWithCloud() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    try {
        const { error } = await sb
            .from('user_habits')
            .upsert({ 
                user_id: user.id, 
                data: { habits, logs },
                updated_at: new Date().toISOString()
            });
        if (error) {
            console.error("Errore sincronizzazione:", error.message);
            alert("⚠️ Errore salvataggio Cloud: " + error.message);
        }
    } catch (e) { 
        console.error("Errore di connessione cloud:", e);
        alert("⚠️ Impossibile contattare il server cloud.");
    }
}

async function loadFromCloud() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;

    try {
        const { data, error } = await sb
            .from('user_habits')
            .select('data')
            .eq('user_id', user.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            return "no_data"; // Nessun dato presente nel DB per questo utente
        }
        if (error) {
            console.error("Errore Supabase in fetch:", error.message);
            alert("⚠️ Errore caricamento dal Cloud: " + error.message);
            return "error";
        }
        
        if (data && data.data) {
            setHabits(data.data.habits);
            setLogs(data.data.logs);
            localStorage.setItem('h_final_v3', JSON.stringify(habits));
            localStorage.setItem('l_final_v3', JSON.stringify(logs));
            return "loaded";
        }
    } catch (e) { console.error("Errore caricamento cloud."); }
    return "error";
}

// --- AUTH ---
async function coreLogin(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const res = await loadFromCloud();
    if (res === "no_data") await syncWithCloud();
    return data;
}

async function coreSignup(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

async function coreLogout() {
    await sb.auth.signOut();
    location.reload();
}

async function checkSession(onAuth, onNoAuth) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        const res = await loadFromCloud();
        if (res === "no_data") await syncWithCloud();
        onAuth(session.user);
    } else {
        onNoAuth();
    }
}

// --- EXPORT / IMPORT ---
function coreExportData() {
    const data = { habits, logs };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_habit_tracker_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function coreImportData(event, onComplete) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.habits && data.logs) { 
                setHabits(data.habits); 
                setLogs(data.logs); 
                save(() => {
                    alert("Dati importati con successo!");
                    if (onComplete) onComplete();
                }); 
            }
        } catch (err) { alert("File non valido"); }
    };
    reader.readAsText(file);
}

function coreCleanupOrphanedLogs() {
    const habitIds = new Set(habits.map(h => h.id));
    let removedCount = 0;
    for (const date in logs) {
        for (const habitId in logs[date]) {
            if (!habitIds.has(habitId)) {
                delete logs[date][habitId];
                removedCount++;
            }
        }
        // Se la data è vuota, la rimuoviamo per pulizia totale
        if (Object.keys(logs[date]).length === 0) {
            delete logs[date];
        }
    }
    if (removedCount > 0) {
        save();
    }
    return removedCount;
}
