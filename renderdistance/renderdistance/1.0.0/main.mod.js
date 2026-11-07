import { PolyMod, MixinType } from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/0.6.0/PolyTypes.js";

const STORAGE_KEY = "renderdistance_multiplier";
const STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

// Wird in Three.js' updateProjectionMatrix() eingefügt.
// Läuft im Scope der Kamera, NICHT im Scope der Mod -> nur globalThis benutzen.
// Merkt sich den Original-Far-Wert des Spiels und multipliziert ihn.
const INJECT =
    "if(this.isPerspectiveCamera){" +
        "if(this.far!==this.__rdSet)this.__rdBase=this.far;" +
        "this.far=this.__rdSet=this.__rdBase*(globalThis.__rdMul||1);" +
    "}";

class RenderDistanceMod extends PolyMod {
    preInit = (pml) => {
        // Globale Mixins gehen nur in preInit.
        // Three.js ist minifiziert, darum Token-Suche. Die Kamera-Prüfung im
        // eingefügten Code macht es egal, welche Kamera-Klasse zuerst kommt.
        for (const occ of [1, 2]) {
            pml.registerGlobalMixin({
                type: MixinType.INSERT,
                token: { token: "updateProjectionMatrix(){", occ },
                func: INJECT
            });
        }
    }

    init = (pml) => {
        this.pml = pml;
        this.index = this.loadIndex();
        this.apply();

        pml.registerBindCategory("Render Distance");
        pml.registerKeybind("Render Distance +", "rd_increase", "keydown", "PageUp", null, () => this.step(1));
        pml.registerKeybind("Render Distance -", "rd_decrease", "keydown", "PageDown", null, () => this.step(-1));
        pml.registerKeybind("Render Distance Reset", "rd_reset", "keydown", "Home", null, () => {
            this.index = STEPS.indexOf(1);
            this.save();
            this.apply();
        });
    }

    loadIndex() {
        try {
            const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
            const i = STEPS.indexOf(saved);
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
        // Das Spiel ruft updateProjectionMatrix() beim Resize auf -> Resize auslösen.
        window.dispatchEvent(new Event("resize"));
        console.log(`[Render Distance] x${globalThis.__rdMul}`);
    }
}

export let polyMod = new RenderDistanceMod();
