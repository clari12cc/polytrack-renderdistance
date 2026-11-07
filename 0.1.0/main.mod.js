import { PolyMod } from "https://cdn.polymodloader.com/cb/polytrackmods/PolyModLoader/0.6.0/PolyTypes.js";

class templateMod extends PolyMod {
    preInit = (pml) => {
        // pre init
    }
    init = (pml) => {
        this.pml = pml; // so pml is accessible outside of init (not neccesary)
        // regular init
    }
    postInit = () => {
        // post init
    }
}

export let polyMod = new templateMod();