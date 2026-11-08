import * as PT from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/0.6.3/PolyTypes.js";

// IMPORTANT: PolyTrack replaces Math.* (Math.log, Math.pow, ...) with its own
// WASM versions, which throw until WASM has loaded. So no Math here.

const PolyMod = PT.PolyMod;
const STORAGE_KEY = "renderdistance_multiplier";
const SETTING_ID = "rd_level";
const STEPS = [0.001, 0.002, 0.003, 0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const DEFAULT_INDEX = STEPS.indexOf(1);

function installCameraHook() {
    if (globalThis.__rdCams) return;
    const cams = globalThis.__rdCams = [];

    const hookCamera = (cam) => {
        const orig = cam.updateProjectionMatrix;
        if (typeof orig !== "function") return;
        cam.updateProjectionMatrix = function () {
            const f = this.far;
            let nf = f * (globalThis.__rdMul || 1);
            // far must stay larger than near, otherwise everything becomes invisible
            const minFar = this.near * 1.5;
            if (nf < minFar) nf = minFar;
            this.far = nf;
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
            console.log("[Render Distance] Camera hook installed");
        } catch (e) {
            console.error("[Render Distance] Hook failed:", e);
        }
    }

    init = (pml) => {
        this.pml = pml;
        this.index = this.loadIndex();
        globalThis.__rdMul = STEPS[this.index];

        // Option with fixed steps in the settings
        this.settingOk = false;
        try {
            pml.registerSettingCategory("Render Distance");
            pml.registerSetting(
                "Render Distance", SETTING_ID, PT.SettingType.CUSTOM, String(STEPS[this.index]),
                STEPS.map(s => ({ title: "x" + s, value: String(s) }))
            );
            this.settingOk = true;
        } catch (e) {
            console.warn("[Render Distance] Could not register setting:", e);
        }

        pml.registerBindCategory("Render Distance");
        pml.registerKeybind("Render Distance +", "rd_increase", "keydown", "PageUp", null, () => this.setIndex(this.index + 1));
        pml.registerKeybind("Render Distance -", "rd_decrease", "keydown", "PageDown", null, () => this.setIndex(this.index - 1));
        pml.registerKeybind("Render Distance Reset", "rd_reset", "keydown", "Home", null, () => this.setIndex(DEFAULT_INDEX));
    }

    onGameLoad = () => {
        this.apply();
        if (!this.settingOk) return;
        // PML does not report changes -> poll the setting regularly.
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
        console.log(`[Render Distance] x${STEPS[this.index]} (${n} cameras${err ? ", " + err + " errors" : ""})`);
    }
}

export let polyMod = new RenderDistanceMod();
