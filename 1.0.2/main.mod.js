import { PolyMod } from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/0.6.0/PolyTypes.js";

const STORAGE_KEY = "renderdistance_multiplier";
const STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

// Kein Mixin nötig: Three.js setzt im Konstruktor jeder PerspectiveCamera
// "this.isPerspectiveCamera = true". Ein Setter auf Object.prototype fängt
// diese Zuweisung ab und liefert uns so jede Kamera, sobald sie entsteht.
function installCameraHook() {
    if (globalThis.__rdCams) return;
    const cams = globalThis.__rdCams = [];

    const hookCamera = (cam) => {
        const orig = cam.updateProjectionMatrix;
        if (typeof orig !== "function") return;
        // Far-Plane nur während der Matrix-Berechnung vergrössern,
        // damit camera.far selbst (und clone/copy) unverändert bleibt.
        cam.updateProjectionMatrix = function () {
            const f = this.far;
            this.far = f * (globalThis.__rdMul || 1);
            try { orig.call(this); } finally { this.far = f; }
        };
        cams.push(new WeakRef(cam));
        if (cams.length === 1) console.log("[Render Distance] Erste Kamera gefunden");
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

        pml.registerBindCategory("Render Distance");
        pml.registerKeybind("Render Distance +", "rd_increase", "keydown", "PageUp", null, () => this.step(1));
        pml.registerKeybind("Render Distance -", "rd_decrease", "keydown", "PageDown", null, () => this.step(-1));
        pml.registerKeybind("Render Distance Reset", "rd_reset", "keydown", "Home", null, () => {
            this.index = STEPS.indexOf(1);
            this.save();
            this.apply();
        });
    }

    onGameLoad = () => this.apply();

    loadIndex() {
        try {
            const i = STEPS.indexOf(parseFloat(localStorage.getItem(STORAGE_KEY)));
            if (i !== -1) return i;
        } catch (e) {}
        return STEPS.indexOf(1);
    }

    save() {
        try { localStorage.setItem(STORAGE_KEY, String(STEPS[this.index])); } catch (e) {}
    }

    step(dir) {
        this.index = Math.max(0, Math.min(STEPS.length - 1, this.index + dir));
        this.save();
        this.apply();
    }

    apply() {
        globalThis.__rdMul = STEPS[this.index];
        let n = 0;
        for (const ref of globalThis.__rdCams || []) {
            const cam = ref.deref();
            if (cam) { cam.updateProjectionMatrix(); n++; }
        }
        console.log(`[Render Distance] x${globalThis.__rdMul} (${n} Kameras)`);
    }
}

export let polyMod = new RenderDistanceMod();
