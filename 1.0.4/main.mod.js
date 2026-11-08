import * as PT from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/0.6.0/PolyTypes.js";

const PolyMod = PT.PolyMod;
const STORAGE_KEY = "renderdistance_multiplier";
const SETTING_ID = "rd_slider";
const STEPS = [0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const MIN = STEPS[0], MAX = STEPS[STEPS.length - 1];

// Slider (0..1) <-> Faktor (0.02..16), logarithmisch, damit kleine Werte fein einstellbar sind.
const sliderToMul = (s) => MIN * Math.pow(MAX / MIN, Math.min(1, Math.max(0, s)));
const mulToSlider = (m) => Math.log(m / MIN) / Math.log(MAX / MIN);

// Kein Mixin nötig: Three.js setzt im Konstruktor jeder PerspectiveCamera
// "this.isPerspectiveCamera = true". Ein Setter auf Object.prototype fängt
// diese Zuweisung ab und liefert uns so jede Kamera, sobald sie entsteht.
function installCameraHook() {
    if (globalThis.__rdCams) return;
    const cams = globalThis.__rdCams = [];

    const hookCamera = (cam) => {
        const orig = cam.updateProjectionMatrix;
        if (typeof orig !== "function") return;
        cam.updateProjectionMatrix = function () {
            const f = this.far;
            this.far = f * (globalThis.__rdMul || 1);
            try { orig.call(this); } finally { this.far = f; }
        };
        cams.push(new WeakRef(cam));
    };

    Object.defineProperty(Object.prototype, "isPerspectiveCamera", {
        configurable: true,
        enumerable: false,
        get() { return undefined; },
        set(v) {
            Object.defineProperty(this, "isPerspectiveCamera", {
                value: v, writable: true, configurable: true, enumerable: true
            });
            if (v === true) hookCamera(this);
        }
    });
}

class RenderDistanceMod extends PolyMod {
    preInit = (pml) => {
        try {
            installCameraHook();
            console.log("[Render Distance] Kamera-Hook installiert");
        } catch (e) {
            console.error("[Render Distance] Hook fehlgeschlagen:", e);
        }
    }

    init = (pml) => {
        this.pml = pml;
        this.mul = this.loadMul();
        globalThis.__rdMul = this.mul;

        // Slider in den Einstellungen
        this.sliderOk = false;
        try {
            if (PT.SettingType && PT.SettingType.SLIDER !== undefined) {
                pml.registerSettingCategory("Render Distance");
                pml.registerSetting("Render Distance", SETTING_ID, PT.SettingType.SLIDER, String(mulToSlider(this.mul)));
                this.sliderOk = true;
            } else {
                console.warn("[Render Distance] SettingType nicht gefunden, kein Slider");
            }
        } catch (e) {
            console.warn("[Render Distance] Slider konnte nicht registriert werden:", e);
        }

        // Tasten
        pml.registerBindCategory("Render Distance");
        pml.registerKeybind("Render Distance +", "rd_increase", "keydown", "PageUp", null, () => this.stepKey(1));
        pml.registerKeybind("Render Distance -", "rd_decrease", "keydown", "PageDown", null, () => this.stepKey(-1));
        pml.registerKeybind("Render Distance Reset", "rd_reset", "keydown", "Home", null, () => this.setMul(1));
    }

    onGameLoad = () => {
        this.apply();
        if (!this.sliderOk) return;
        // PML meldet Änderungen nicht -> Slider regelmässig abfragen.
        this.lastSlider = this.readSlider();
        setInterval(() => {
            const s = this.readSlider();
            if (s === null || s === this.lastSlider) return;
            this.lastSlider = s;
            this.setMul(sliderToMul(s), false);
        }, 300);
    }

    readSlider() {
        try {
            const s = parseFloat(this.pml.getSetting(SETTING_ID));
            return isNaN(s) ? null : s;
        } catch (e) { return null; }
    }

    loadMul() {
        try {
            const m = parseFloat(localStorage.getItem(STORAGE_KEY));
            if (m >= MIN && m <= MAX) return m;
        } catch (e) {}
        return 1;
    }

    stepKey(dir) {
        // Nächste Stufe über bzw. unter dem aktuellen Wert
        const next = dir > 0
            ? STEPS.find(s => s > this.mul + 1e-9)
            : [...STEPS].reverse().find(s => s < this.mul - 1e-9);
        if (next !== undefined) this.setMul(next);
    }

    setMul(m, log = true) {
        this.mul = Math.min(MAX, Math.max(MIN, m));
        try { localStorage.setItem(STORAGE_KEY, String(this.mul)); } catch (e) {}
        this.apply(log);
    }

    apply(log = true) {
        globalThis.__rdMul = this.mul;
        let n = 0;
        for (const ref of globalThis.__rdCams || []) {
            const cam = ref.deref();
            if (cam) { cam.updateProjectionMatrix(); n++; }
        }
        if (log) console.log(`[Render Distance] x${+this.mul.toFixed(3)} (${n} Kameras)`);
    }
}

export let polyMod = new RenderDistanceMod();
