import * as PT from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/0.6.0/PolyTypes.js";

// WICHTIG: PolyTrack ersetzt Math.* (Math.log, Math.pow, ...) durch eigene
// WASM-Versionen, die vor dem Laden einen Fehler werfen. Darum hier kein Math.

const PolyMod = PT.PolyMod;
const STORAGE_KEY = "renderdistance_multiplier";
const SETTING_ID = "rd_level";
const STEPS = [0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const DEFAULT_INDEX = STEPS.indexOf(1);

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
        this.index = this.loadIndex();
        globalThis.__rdMul = STEPS[this.index];

        // Auswahl mit festen Stufen in den Einstellungen
        this.settingOk = false;
        try {
            pml.registerSettingCategory("Render Distance");
            pml.registerSetting(
                "Render Distance", SETTING_ID, PT.SettingType.CUSTOM, String(STEPS[this.index]),
                STEPS.map(s => ({ title: "x" + s, value: String(s) }))
            );
            this.settingOk = true;
        } catch (e) {
            console.warn("[Render Distance] Einstellung konnte nicht registriert werden:", e);
        }

        pml.registerBindCategory("Render Distance");
        pml.registerKeybind("Render Distance +", "rd_increase", "keydown", "PageUp", null, () => this.setIndex(this.index + 1));
        pml.registerKeybind("Render Distance -", "rd_decrease", "keydown", "PageDown", null, () => this.setIndex(this.index - 1));
        pml.registerKeybind("Render Distance Reset", "rd_reset", "keydown", "Home", null, () => this.setIndex(DEFAULT_INDEX));
    }

    onGameLoad = () => {
        this.apply();
        if (!this.settingOk) return;
        // PML meldet Änderungen nicht -> Einstellung regelmässig abfragen.
        this.lastSetting = this.readSetting();
        setInterval(() => {
            const s = this.readSetting();
            if (s === this.lastSetting) return;
            this.lastSetting = s;
            const i = STEPS.indexOf(parseFloat(s));
            if (i !== -1) this.setIndex(i);
        }, 300);
    }

    readSetting() {
        try { return String(this.pml.getSetting(SETTING_ID)); } catch (e) { return null; }
    }

    loadIndex() {
        try {
            const i = STEPS.indexOf(parseFloat(localStorage.getItem(STORAGE_KEY)));
            if (i !== -1) return i;
        } catch (e) {}
        return DEFAULT_INDEX;
    }

    setIndex(i) {
        if (i < 0) i = 0;
        if (i > STEPS.length - 1) i = STEPS.length - 1;
        this.index = i;
        try { localStorage.setItem(STORAGE_KEY, String(STEPS[i])); } catch (e) {}
        this.apply();
    }

    apply() {
        globalThis.__rdMul = STEPS[this.index];
        let n = 0, err = 0;
        for (const ref of globalThis.__rdCams || []) {
            const cam = ref.deref();
            if (!cam) continue;
            try { cam.updateProjectionMatrix(); n++; } catch (e) { err++; }
        }
        console.log(`[Render Distance] x${STEPS[this.index]} (${n} Kameras${err ? ", " + err + " Fehler" : ""})`);
    }
}

export let polyMod = new RenderDistanceMod();
