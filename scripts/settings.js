// Register module settings
export function registerSettings() {
    game.settings.register("vestige-of-yimyar", "enableVisualEffects", {
        name: "Enable Visual Effects",
        hint: "Add visual indicators to tokens affected by Vestige's Toll",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register("vestige-of-yimyar", "showToolbarButtons", {
        name: "Show Toolbar Buttons",
        hint: "Add Vestige's Toll and Rest buttons to the token controls toolbar",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: value => {
            window.location.reload();
        }
    });
    
    // Register a submenu for vestige settings
    game.settings.registerMenu("vestige-of-yimyar", "vestigeConfig", {
        name: "Vestige Configuration",
        label: "Configure Vestige Options",
        hint: "Configure advanced options for the Vestige of Yimyar module",
        icon: "fas fa-cog",
        type: VestigeSettingsMenu,
        restricted: true
    });
    
    // Advanced settings
    game.settings.register("vestige-of-yimyar", "includeInCombatTracker", {
        name: "Show Vestige Status in Combat Tracker",
        hint: "Display Vestige's Toll status in the combat tracker",
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });
    
    game.settings.register("vestige-of-yimyar", "gmBypassDedication", {
        name: "GM Bypass Dedication Requirement",
        hint: "Allow GMs to use Vestige features on any character, even without the Dedication feat",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });
}

// Settings submenu
class VestigeSettingsMenu extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "vestige-settings",
            title: "Vestige of Yimyar Settings",
            template: "modules/vestige-of-yimyar/templates/settings-menu.hbs",
            width: 600,
            height: "auto",
            closeOnSubmit: true
        });
    }
    
    getData() {
        return {
            visualEffects: game.settings.get("vestige-of-yimyar", "enableVisualEffects"),
            toolbarButtons: game.settings.get("vestige-of-yimyar", "showToolbarButtons"),
            combatTracker: game.settings.get("vestige-of-yimyar", "includeInCombatTracker")
        };
    }
    
    async _updateObject(event, formData) {
        for (let [key, value] of Object.entries(formData)) {
            await game.settings.set("vestige-of-yimyar", key, value);
        }
    }
}